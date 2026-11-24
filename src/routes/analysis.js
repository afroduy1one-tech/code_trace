const express = require('express');
const multer = require('multer');
const pathMod = require('path');
const pool = require('../db');
const { requireAuth, requireAnalysisOwner, rateLimit, v } = require('../middleware');
const { parseArchive, shouldSkipPath } = require('../analysis');
const { buildRoute, CONFIG } = require('../knowledge_base');
const { maxArchiveBytes, githubToken } = require('../config');
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxArchiveBytes } });

async function collectFacts(analysisId) {
  const [files] = await pool.query('SELECT id, path, name FROM `file` WHERE analysis_id=?', [analysisId]);
  const [links] = await pool.query('SELECT source_file_id, target_file_id FROM link WHERE analysis_id=?', [analysisId]);
  return { files, links };
}

async function persistAnalysis({
  userId,
  projectId,
  projectName,
  repositoryUrl,
  files,
  links,
  entryPoints = [],
}) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    let pid = projectId;
    if (pid) {
      const [[own]] = await conn.query('SELECT user_id FROM project WHERE id=?', [pid]);
      if (!own || own.user_id !== userId) throw new Error('Проект принадлежит другому пользователю');
    } else {
      const [exist] = await conn.query('SELECT id FROM project WHERE user_id=? AND name=?', [userId, projectName]);
      if (exist.length) pid = exist[0].id;
      else {
        const [r] = await conn.query('INSERT INTO project (user_id, name, repository_url) VALUES (?,?,?)',
          [userId, projectName, repositoryUrl || null]);
        pid = r.insertId;
      }
    }
    const [ar] = await conn.query('INSERT INTO analysis (project_id) VALUES (?)', [pid]);
    const analysisId = ar.insertId;
    const idByPath = {};
    for (const f of files) {
      const [fr] = await conn.query('INSERT INTO `file` (analysis_id, path, name) VALUES (?,?,?)', [analysisId, f.path, f.name]);
      idByPath[f.path] = fr.insertId;
    }
    for (const [a, b] of links) {
      if (idByPath[a] && idByPath[b]) {
        await conn.query('INSERT INTO link (analysis_id, source_file_id, target_file_id) VALUES (?,?,?)',
          [analysisId, idByPath[a], idByPath[b]]);
      }
    }
    const paths = files.map(f => f.path);
    const [[u]] = await conn.query('SELECT level FROM `user` WHERE id=?', [userId]);
    const r = buildRoute({
    files: paths,
    links,
    level: u.level,
    entryPoints,
  });
    for (const x of r.results) {
      await conn.query('INSERT INTO analysis_result (analysis_id, result_type, description, priority) VALUES (?,?,?,?)',
        [analysisId, x.result_type, x.description, x.priority]);
    }
    for (const l of r.log) {
      await conn.query('INSERT INTO applied_rule (analysis_id, rule_code, result_description) VALUES (?,?,?)',
        [analysisId, l.rule_code, l.result_description]);
    }
    await conn.query("UPDATE analysis SET status='completed' WHERE id=?", [analysisId]);
    await conn.commit();
    return { analysisId, projectId: pid };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function ghFetch(url) {
  const headers = { 'User-Agent': 'code-trace', 'Accept': 'application/vnd.github+json' };
  if (githubToken) headers['Authorization'] = `Bearer ${githubToken}`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 20000);
  try { return await fetch(url, { headers, signal: controller.signal }); }
  finally { clearTimeout(t); }
}

const progressClients = new Map();
router.get('/progress/:token', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
  res.flushHeaders();
  progressClients.set(req.params.token, res);
  req.on('close', () => progressClients.delete(req.params.token));
});
function emit(token, pct, stage, extra = {}) {
  const res = progressClients.get(token);
  if (!res) return;
  res.write(`data: ${JSON.stringify({ pct, stage, ...extra })}\n\n`);
}

router.post('/run', requireAuth, rateLimit('run'), upload.single('archive'), v.runProject, async (req, res) => {
  const token = req.body.token || null;
  try {
    const { projectId, projectName, repositoryUrl } = req.body;
    if (!req.file) { emit(token, -1, 'Нужен архив'); return res.status(400).json({ error: 'Нужен архив проекта' }); }
    if (!projectId && !projectName) { emit(token, -1, 'Укажите название'); return res.status(400).json({ error: 'Укажите название проекта' }); }
    emit(token, 10, 'Читаем архив…');
    const { files, links, entryPoints } = parseArchive(req.file.buffer);
    emit(token, 60, 'Разбираем связи…');
    const r = await persistAnalysis({
      userId: req.user.id, projectId: projectId ? Number(projectId) : null,
      projectName, repositoryUrl, files, links, files, links, entryPoints,
    });
    emit(token, 100, 'Готово');
    res.json(r);
  } catch (e) { emit(token, -1, 'Ошибка: ' + e.message); res.status(400).json({ error: e.message }); }
});

const repoCache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

async function fetchRepoTree(owner, repo, branch) {
  const r = await ghFetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`);
  if (!r.ok) throw new Error('GitHub API: ' + r.status);
  const data = await r.json();
  if (!data.tree) throw new Error('Пустое дерево репозитория');
  return data.tree;
}
function extOf(p) { return pathMod.extname(p).toLowerCase(); }
const SUPPORTED = new Set([
  '.js','.jsx','.ts','.tsx','.mjs','.cjs','.vue','.svelte',
  '.html','.htm','.css','.scss','.sass','.less',
  '.py','.java','.kt','.go','.rs','.rb','.php','.cs','.c','.cpp','.h','.hpp','.swift',
]);

router.post('/run-url', requireAuth, rateLimit('run'), v.runUrl, async (req, res) => {
  const token = req.body.token || null;
  try {
    const { projectId, projectName, repositoryUrl } = req.body || {};
    if (projectId) {
      const [[p]] = await pool.query('SELECT user_id FROM project WHERE id=?', [projectId]);
      if (!p || (p.user_id !== req.user.id && req.user.role !== 'admin'))
        return res.status(403).json({ error: 'Нет доступа к этому проекту' });
    }
    const m = repositoryUrl.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
    if (!m) return res.status(400).json({ error: 'Поддерживается только https://github.com/owner/repo' });
    const [, owner, repo] = m;

    const cacheKey = `${owner}/${repo}`;
    let parsed;
    const cached = repoCache.get(cacheKey);
    if (cached && Date.now() - cached.at < CACHE_TTL) {
      emit(token, 100, 'Готово (из кэша)');
      parsed = cached.data;
    } else {
      emit(token, 3, 'Получаем метаданные репозитория…');
      const meta = await ghFetch(`https://api.github.com/repos/${owner}/${repo}`).then(r => r.json());
      if (meta.message) return res.status(400).json({ error: 'Репозиторий не найден: ' + meta.message });
      const branch = meta.default_branch || 'main';
      emit(token, 10, 'Загружаем дерево файлов…');
      const tree = await fetchRepoTree(owner, repo, branch);
      const wanted = tree.filter(n =>
        n.type === 'blob' &&
        !shouldSkipPath(n.path) &&
        (
          SUPPORTED.has(extOf(n.path)) ||
          pathMod.posix.basename(n.path) === 'package.json'
        )
      );
      if (!wanted.length) return res.status(400).json({ error: 'В репозитории нет поддерживаемых файлов' });
      emit(token, 20, `Скачиваем ${wanted.length} файлов…`, { total: wanted.length });
      const raws = [];
      const queue = [...wanted];
      const total = wanted.length;
      let done = 0;
      const workers = Array(Math.min(8, total)).fill(0).map(async () => {
        while (queue.length) {
          const f = queue.shift();
          const r = await ghFetch(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${encodeURI(f.path)}`);
          if (r.ok) raws.push({ path: f.path, content: await r.text() });
          done++;
          const pct = 20 + Math.round((done / total) * 60);
          emit(token, pct, `Скачиваем ${done} из ${total}…`, { done, total });
        }
      });
      await Promise.all(workers);
      emit(token, 85, 'Разбираем связи…');
      const AdmZip = require('adm-zip');
      const zip = new AdmZip();
      raws.forEach(f => zip.addFile(f.path, Buffer.from(f.content, 'utf8')));
      parsed = parseArchive(zip.toBuffer());
      repoCache.set(cacheKey, { data: parsed, at: Date.now() });
    }
    emit(token, 92, 'Сохраняем результаты…');
    const r = await persistAnalysis({
      userId: req.user.id, projectId: projectId ? Number(projectId) : null,
      projectName: projectName || repo, repositoryUrl, ...parsed,
    });
    emit(token, 100, 'Готово');
    res.json(r);
  } catch (e) {
    emit(token, -1, 'Ошибка: ' + e.message);
    res.status(400).json({ error: e.message });
  }
});

router.post('/run-demo', requireAuth, async (req, res) => {
  const files = ['index.js','config.js','authService.js','userStore.js','client.js','LoginPage.jsx','App.jsx','helpers.js','models.js','Header.jsx'].map(p => ({ path: p, name: p }));
  const links = [
    ['index.js','App.jsx'],['index.js','config.js'],['App.jsx','LoginPage.jsx'],['App.jsx','Header.jsx'],['App.jsx','config.js'],
    ['LoginPage.jsx','authService.js'],['LoginPage.jsx','helpers.js'],
    ['authService.js','userStore.js'],['userStore.js','authService.js'],
    ['authService.js','client.js'],['authService.js','config.js'],
    ['client.js','config.js'],['client.js','helpers.js'],
    ['userStore.js','models.js'],['models.js','config.js'],['Header.jsx','helpers.js'],
  ];
  const r = await persistAnalysis({ userId: req.user.id, projectId: null, projectName: 'MyApp (demo)', files, links });
  res.json(r);
});

router.get('/:id', requireAuth, requireAnalysisOwner, async (req, res) => {
  const analysis = req.analysisRow;
  const [[an]] = await pool.query('SELECT * FROM analysis WHERE id=?', [req.params.id]);
  const { files, links } = await collectFacts(req.params.id);
  const [results] = await pool.query('SELECT * FROM analysis_result WHERE analysis_id=? ORDER BY priority IS NULL, priority', [req.params.id]);
  const [rules] = await pool.query('SELECT * FROM applied_rule WHERE analysis_id=?', [req.params.id]);
  const [[proj]] = await pool.query('SELECT name FROM project WHERE id=?', [an.project_id]);
  const byId = {}; files.forEach(f => byId[f.id] = f);
  const names = files.map(f => f.path);
  const linkPairs = links.map(l => [byId[l.source_file_id].path, byId[l.target_file_id].path]);
  const [[u]] = await pool.query('SELECT level FROM `user` WHERE id=?', [req.user.id]);
  const entryPoints = rules
    .filter(r => r.rule_code === 'R7_PACKAGE_ENTRY')
    .map(r => {
      const match = r.result_description.match(
        /^Подтверждённая точка входа: (.+?) \(package\.json: (.+)\)$/
      );

      return match
        ? { path: match[1], reason: match[2] }
        : null;
    })
    .filter(Boolean);

  const route = buildRoute({
    files: names,
    links: linkPairs,
    level: u.level,
    entryPoints,
  });
  res.json({ analysis: an, project: proj, files, links, results, rules, route });
});

router.get('/compare/:left/:right', requireAuth, async (req, res) => {
  const ids = [Number(req.params.left), Number(req.params.right)];
  const [rows] = await pool.query(
    `SELECT a.id FROM analysis a JOIN project p ON p.id=a.project_id
     WHERE a.id IN (?,?) AND (p.user_id=? OR ?='admin')`,
    [...ids, req.user.id, req.user.role]);
  if (rows.length < 2 && req.user.role !== 'admin') return res.status(403).json({ error: 'Нет доступа к одному из запусков' });
  async function facts(aid) {
    const { files, links } = await collectFacts(aid);
    const byId = {}; files.forEach(f => byId[f.id] = f);
    const [probs] = await pool.query("SELECT description FROM analysis_result WHERE analysis_id=? AND result_type='problem'", [aid]);
    const [rules] = await pool.query('SELECT rule_code, result_description FROM applied_rule WHERE analysis_id=?', [aid]);
    const inCount = {}; files.forEach(f => inCount[f.path] = 0);
    links.forEach(l => { const t = byId[l.target_file_id]; if (t) inCount[t.path]++; });
    const hubs = files.filter(f => inCount[f.path] >= CONFIG.HUB_MIN_IN).map(f => ({ path: f.path, in: inCount[f.path] }));
    return {
      files: files.map(f => f.path),
      links: links.map(l => `${byId[l.source_file_id].path} → ${byId[l.target_file_id].path}`),
      problems: probs.map(p => p.description),
      rules: rules.map(r => `${r.rule_code}: ${r.result_description}`),
      hubs,
    };
  }
  const [A, B] = await Promise.all([facts(ids[0]), facts(ids[1])]);
  const diff = (aArr, bArr) => ({ added: bArr.filter(x => !aArr.includes(x)), removed: aArr.filter(x => !bArr.includes(x)) });
  res.json({
    left: { id: ids[0], ...A }, right: { id: ids[1], ...B },
    files: diff(A.files, B.files), links: diff(A.links, B.links),
    problems: diff(A.problems, B.problems), rules: diff(A.rules, B.rules),
    hubs: diff(A.hubs.map(h => `${h.path} (${h.in})`), B.hubs.map(h => `${h.path} (${h.in})`)),
  });
});

module.exports = router;