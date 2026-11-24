const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { setSession, clearSession, publicUser, requireAuth } = require('../auth');
const { rateLimitLogin, v } = require('../middleware');
const router = express.Router();

router.post('/register', v.register, rateLimitLogin, async (req, res) => {
  const { login, password, name } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    const [r] = await pool.query(
      'INSERT INTO `user` (login, password_hash, name, level, role) VALUES (?,?,?,?,?)',
      [login, hash, name || login, 'beginner', 'user']);
    const [rows] = await pool.query('SELECT * FROM `user` WHERE id=?', [r.insertId]);
    setSession(res, rows[0]);
    res.json(publicUser(rows[0]));
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Логин занят' });
    res.status(500).json({ error: e.message });
  }
});

router.post('/login', v.login, v.password, rateLimitLogin, async (req, res) => {
  const { login, password } = req.body;
  const [rows] = await pool.query('SELECT * FROM `user` WHERE login=?', [login]);
  if (!rows.length) return res.status(401).json({ error: 'Неверный логин или пароль' });
  const ok = await bcrypt.compare(password, rows[0].password_hash);
  if (!ok) return res.status(401).json({ error: 'Неверный логин или пароль' });
  setSession(res, rows[0]);
  res.json(publicUser(rows[0]));
});

router.post('/logout', (req, res) => { clearSession(res); res.json({ ok: true }); });
router.get('/me', requireAuth, (req, res) => res.json(publicUser(req.user)));

router.patch('/level', requireAuth, async (req, res) => {
  const { level } = req.body || {};
  if (!['beginner','experienced'].includes(level)) return res.status(400).json({ error: 'Неверный уровень' });
  await pool.query('UPDATE `user` SET level=? WHERE id=?', [level, req.user.id]);
  res.json({ ok: true, level });
});

module.exports = router;
