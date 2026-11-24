const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { requireAuth, requireAdmin, v } = require('../middleware');
const router = express.Router();

router.use(requireAuth, requireAdmin);

router.get('/stats', async (req, res) => {
  const [[u]] = await pool.query('SELECT COUNT(*) AS n FROM `user`');
  const [[p]] = await pool.query('SELECT COUNT(*) AS n FROM project');
  const [[a]] = await pool.query('SELECT COUNT(*) AS n FROM analysis');
  const [users] = await pool.query('SELECT id, login, name, level, role FROM `user`');
  const [runs] = await pool.query(`
    SELECT a.id, p.name AS project, a.analyzed_at, a.status
    FROM analysis a JOIN project p ON p.id=a.project_id ORDER BY a.analyzed_at DESC LIMIT 100`);
  const [ruleStats] = await pool.query('SELECT rule_code, COUNT(*) AS n FROM applied_rule GROUP BY rule_code ORDER BY n DESC');
  res.json({ counts: { users: u.n, projects: p.n, analyses: a.n }, users, runs, ruleStats });
});

router.patch('/users/:id', v.idParam, async (req, res) => {
  const { level, role, password } = req.body || {};
  const sets = [], vals = [];
  if (level && ['beginner','experienced'].includes(level)) { sets.push('level=?'); vals.push(level); }
  if (role && ['user','admin'].includes(role)) { sets.push('role=?'); vals.push(role); }
  if (password) { sets.push('password_hash=?'); vals.push(await bcrypt.hash(password, 10)); }
  if (!sets.length) return res.status(400).json({ error: 'Нет изменений' });
  vals.push(req.params.id);
  await pool.query(`UPDATE \`user\` SET ${sets.join(', ')} WHERE id=?`, vals);
  res.json({ ok: true });
});

router.delete('/users/:id', v.idParam, async (req, res) => {
  if (+req.params.id === req.user.id) return res.status(400).json({ error: 'Нельзя удалить себя' });
  await pool.query('DELETE FROM `user` WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

router.delete('/projects/:id', v.idParam, async (req, res) => {
  await pool.query('DELETE FROM project WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

router.delete('/analysis/:id', v.idParam, async (req, res) => {
  await pool.query('DELETE FROM analysis WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
