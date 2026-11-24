const AdmZip = require('adm-zip');
const path = require('path');
const { maxFiles } = require('./config');

const CODE_EXT = [
  '.js','.jsx','.ts','.tsx','.mjs','.cjs','.vue','.svelte',
  '.html','.htm','.css','.scss','.sass','.less',
  '.py','.java','.kt','.go','.rs','.rb','.php','.cs','.c','.cpp','.h','.hpp','.swift',
];
// Каталоги и файлы, которые не являются исходным кодом проекта.
const SKIP_DIRS = new Set([
  '__MACOSX', 'node_modules', '.git', 'dist', 'build', 'coverage',
  '.next', '.nuxt', '.output', '.cache', 'vendor', 'target',
  '__pycache__', '.pytest_cache', '.venv', 'venv',
]);

const SKIP_FILES = new Set([
  '.DS_Store', 'Thumbs.db', 'desktop.ini',
]);

function normalizeProjectPath(filePath) {
  return String(filePath || '').replace(/\\/g, '/').replace(/^\.\//, '');
}

function shouldSkipPath(filePath) {
  const normalized = normalizeProjectPath(filePath);
  const segments = normalized.split('/').filter(Boolean);
  if (!segments.length) return true;

  // AppleDouble-файлы macOS: ._filename.js, ._package.json и т.п.
  if (segments.some(segment => segment.startsWith('._'))) return true;
  if (segments.some(segment => SKIP_DIRS.has(segment))) return true;

  const fileName = segments[segments.length - 1];
  if (SKIP_FILES.has(fileName)) return true;
  return false;
}


const ENTRY_EXTENSIONS = [
  '.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.html',
];

function findEntryFile(packageDir, target, filePaths) {
  if (typeof target !== 'string' || !target.trim()) return null;

  const cleanTarget = target.trim().replace(/^\.\//, '');
  const resolved = path.posix.normalize(
    path.posix.join(packageDir, cleanTarget)
  );

  const candidates = [
    resolved,
    ...ENTRY_EXTENSIONS.map(ext => resolved + ext),
    ...ENTRY_EXTENSIONS.map(ext =>
      path.posix.join(resolved, 'index' + ext)
    ),
  ];

  return candidates.find(candidate => filePaths.has(candidate)) || null;
}

function extractEntryPoints(zip, files) {
  const filePaths = new Set(files.map(f => f.path));
  const entryPoints = new Map();

  function addEntry(packageDir, target, reason) {
    const resolved = findEntryFile(packageDir, target, filePaths);
    if (!resolved) return;

    if (!entryPoints.has(resolved)) {
      entryPoints.set(resolved, new Set());
    }

    entryPoints.get(resolved).add(reason);
  }

  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;

    const packagePath = normalizeProjectPath(entry.entryName);

    if (shouldSkipPath(packagePath)) continue;
    if (path.posix.basename(packagePath) !== 'package.json') continue;

    let pkg;

    try {
      pkg = JSON.parse(entry.getData().toString('utf8'));
    } catch {
      continue;
    }

    const packageDir = path.posix.dirname(packagePath);

    if (pkg.main) {
      addEntry(packageDir, pkg.main, 'main');
    }

    const scripts = pkg.scripts || {};

    for (const scriptName of ['start', 'dev']) {
      const command = scripts[scriptName];

      if (typeof command !== 'string') continue;

      // Поддерживаем прямой запуск через node и node --watch.
      const matches = command.matchAll(
        /\bnode(?:\s+--watch)?\s+([^\s;&|]+)/g
      );

      for (const match of matches) {
        addEntry(
          packageDir,
          match[1],
          `scripts.${scriptName}`
        );
      }
    }
  }

  return [...entryPoints].map(([path, reasons]) => ({
    path,
    reason: [...reasons].join(', '),
  }));
}

// Регулярки по типам файлов
const RE = {
  js: [
    /import\s+[^'"]*from\s+['"]([^'"]+)['"]/g,
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ],
  html: [
    /<script[^>]+src=['"]([^'"]+)['"]/g,
    /<link[^>]+href=['"]([^'"]+\.css[^'"]*)['"]/g,
    /<img[^>]+src=['"]([^'"]+)['"]/g,
  ],
  css: [
    /@import\s+['"]([^'"]+)['"]/g,
    /url\(\s*['"]?([^'")]+)['"]?\s*\)/g,
  ],
  py: [
    /^import\s+([\w.]+)/gm,
    /^from\s+([\w.]+)\s+import/gm,
  ],
  java: [
    /^import\s+([\w.]+);/gm,
  ],
  go: [
    /^\s*"([^"]+)"/gm,
  ],
  rs: [
    /^use\s+([\w:]+)/gm,
    /^\s*mod\s+(\w+);/gm,
  ],
  rb: [
    /require_relative\s+['"]([^'"]+)['"]/g,
    /require\s+['"]([^'"]+)['"]/g,
  ],
  php: [
    /require(_once)?\s*\(?\s*['"]([^'"]+)['"]/g,
    /include(_once)?\s*\(?\s*['"]([^'"]+)['"]/g,
  ],
  c: [
    /#include\s+["']([^"']+)["']/g,
  ],
};

function parseArchive(zipBuffer) {
  let zip;
  try { zip = new AdmZip(zipBuffer); } catch { throw new Error('Не удалось открыть архив (не zip?)'); }
  const entries = zip.getEntries().filter(e => !e.isDirectory);

  const files = [], byPath = new Map();
  for (const entry of entries) {
    const rel = normalizeProjectPath(entry.entryName);
    if (shouldSkipPath(rel)) continue;
    const ext = path.extname(rel).toLowerCase();
    if (!CODE_EXT.includes(ext)) continue;
    const name = path.basename(rel);
    const keyNoExt = rel.replace(/\.[^.]+$/, '');
    if (byPath.has(keyNoExt)) continue;
    const content = entry.getData().toString('utf8');
    files.push({ key: rel, path: rel, name, ext, content });
    byPath.set(keyNoExt, rel);
    byPath.set(rel, rel);
    if (files.length > maxFiles) throw new Error(`Слишком много файлов (>${maxFiles})`);
  }
  if (!files.length) throw new Error('В архиве не найдено файлов кода (JS/TS/HTML/CSS/Python/Java/Go/Rust/Ruby/PHP/C)');

  // Нормализация импортов в единый вид
  const links = [];
  for (const f of files) {
    const found = new Set();
    const base = path.posix.dirname(f.path);
    const ext = f.ext;
    let groups = [];

    if (['.js','.jsx','.ts','.tsx','.mjs','.cjs','.vue','.svelte'].includes(ext)) groups = RE.js;
    else if (['.html','.htm'].includes(ext)) groups = RE.html;
    else if (['.css','.scss','.sass','.less'].includes(ext)) groups = RE.css;
    else if (ext === '.py') groups = RE.py;
    else if (ext === '.java' || ext === '.kt') groups = RE.java;
    else if (ext === '.go') groups = RE.go;
    else if (ext === '.rs') groups = RE.rs;
    else if (ext === '.rb') groups = RE.rb;
    else if (ext === '.php') groups = RE.php;
    else if (['.c','.cpp','.h','.hpp','.cs'].includes(ext)) groups = RE.c;

    for (const re of groups) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(f.content))) {
        let spec = m[1];
        if (!spec) continue;
        if (spec.startsWith('http://') || spec.startsWith('https://')) continue;
        if (spec.startsWith('data:')) continue;

        let candidates = [];
        if (spec.startsWith('.')) {
          const resolved = path.posix.normalize(path.posix.join(base, spec));
          candidates = [resolved, resolved + '.js', resolved + '.ts', resolved + '.tsx',
            resolved + '.html', resolved + '.css',
            resolved + '/index.js', resolved + '/index.ts', resolved + '/index.html'];
        } else if (spec.startsWith('/')) {
          candidates = [spec.slice(1), spec.slice(1) + '.html', spec.slice(1) + '.css'];
        } else {
          // Python/Java пакетный импорт (a.b.c) → путь a/b/c и a/b/c.py
          const dotted = spec.replace(/\./g, '/');
          candidates = [
            dotted, dotted + '.py', dotted + '.java', dotted + '.kt',
            'src/' + dotted + '.py', 'src/' + dotted + '.java',
            // Go / Rust / Ruby — по имени
            spec, spec + '.go', spec + '.rs', spec + '.rb',
            base + '/' + spec, base + '/' + spec + '.py',
            base + '/' + spec + '.js', base + '/' + spec + '.ts',
          ];
        }
        for (const c of candidates) {
          const target = byPath.get(c);
          if (target && target !== f.path) { found.add(target); break; }
        }
      }
    }
    for (const t of found) links.push([f.path, t]);
  }
  const uniq = new Map();
  for (const [a,b] of links) uniq.set(a+'→'+b, [a,b]);
  const resultFiles = files.map(f => ({
  path: f.path,
  name: f.name,
}));

const entryPoints = extractEntryPoints(zip, resultFiles);

return {
  files: resultFiles,
  links: [...uniq.values()],
  entryPoints,
};
}
module.exports = { parseArchive, shouldSkipPath };