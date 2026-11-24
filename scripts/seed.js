require('dotenv').config();
const pool = require('../src/db');
const { buildRoute } = require('../src/knowledge_base');
(async () => {
  const [[u]] = await pool.query("SELECT id FROM `user` WHERE login='demo_user'");
  if (!u) { console.error('Сначала: npm run create-admin'); process.exit(1); }
  const files = ['index.js','config.js','authService.js','userStore.js','client.js',
                 'LoginPage.jsx','App.jsx','helpers.js','models.js','Header.jsx'];
  const links = [
    ['index.js','App.jsx'],['index.js','config.js'],
    ['App.jsx','LoginPage.jsx'],['App.jsx','Header.jsx'],['App.jsx','config.js'],
    ['LoginPage.jsx','authService.js'],['LoginPage.jsx','helpers.js'],
    ['authService.js','userStore.js'],['userStore.js','authService.js'],
    ['authService.js','client.js'],['authService.js','config.js'],
    ['client.js','config.js'],['client.js','helpers.js'],
    ['userStore.js','models.js'],['models.js','config.js'],
    ['Header.jsx','helpers.js'],
  ];
  const [proj] = await pool.query('INSERT INTO project (user_id, name, repository_url) VALUES (?,?,?)', [u.id, 'MyApp', 'https://github.com/example/my-app']);
  const projectId = proj.insertId;
  const [ar] = await pool.query('INSERT INTO analysis (project_id) VALUES (?)', [projectId]);
  const analysisId = ar.insertId;
  const idMap = {};
  for (const f of files) {
    const [fr] = await pool.query('INSERT INTO `file` (analysis_id, path, name) VALUES (?,?,?)', [analysisId, f, f]);
    idMap[f] = fr.insertId;
  }
  for (const [a,b] of links) await pool.query('INSERT INTO link (analysis_id, source_file_id, target_file_id) VALUES (?,?,?)', [analysisId, idMap[a], idMap[b]]);
  const r = buildRoute({ files, links, level: 'beginner' });
  for (const x of r.results) await pool.query('INSERT INTO analysis_result (analysis_id, result_type, description, priority) VALUES (?,?,?,?)', [analysisId, x.result_type, x.description, x.priority]);
  for (const l of r.log) await pool.query('INSERT INTO applied_rule (analysis_id, rule_code, result_description) VALUES (?,?,?)', [analysisId, l.rule_code, l.result_description]);
  await pool.query("UPDATE analysis SET status='completed' WHERE id=?", [analysisId]);
  console.log(`Демо-проект MyApp: project=${projectId}, analysis=${analysisId}`);
  await pool.end();
})();
