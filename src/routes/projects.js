const express = require('express');
const pool = require('../db');
const { requireAuth, requireProjectOwner } = require('../middleware');
const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const [projects] = await pool.query(`
    SELECT p.id, p.name, p.repository_url, p.created_at,
      (SELECT COUNT(*) FROM analysis a WHERE a.project_id=p.id) AS runs,
      (SELECT MAX(analyzed_at) FROM analysis a WHERE a.project_id=p.id) AS last_run,
      (SELECT status FROM analysis a WHERE a.project_id=p.id ORDER BY analyzed_at DESC LIMIT 1) AS last_status
    FROM project p WHERE p.user_id=? ORDER BY p.created_at DESC`, [req.user.id]);
  res.json(projects);
});

router.get('/:id', requireAuth, requireProjectOwner, async (req, res) => {
  const [[p]] = await pool.query('SELECT * FROM project WHERE id=?', [req.params.id]);
  const [runs] = await pool.query('SELECT id, analyzed_at, status FROM analysis WHERE project_id=? ORDER BY id DESC', [p.id]);
  res.json({ project: p, runs });
});

router.delete('/:id', requireAuth, requireProjectOwner, async (req, res) => {
  await pool.query('DELETE FROM project WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
