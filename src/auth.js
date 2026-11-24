const jwt = require('jsonwebtoken');
const pool = require('./db');
const { jwtSecret } = require('./config');
const COOKIE = 'ct_token';

function setSession(res, user) {
  const token = jwt.sign({ id: user.id }, jwtSecret, { expiresIn: '7d' });
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 3600 * 1000 });
}
const clearSession = res => res.clearCookie(COOKIE);
const publicUser = u => ({ id: u.id, login: u.login, name: u.name, level: u.level, role: u.role });

async function requireAuth(req, res, next) {
  try {
    const token = req.cookies[COOKIE];
    if (!token) return res.status(401).json({ error: 'Требуется вход' });
    const { id } = jwt.verify(token, jwtSecret);
    const [rows] = await pool.query('SELECT id, login, name, level, role FROM `user` WHERE id=?', [id]);
    if (!rows.length) return res.status(401).json({ error: 'Требуется вход' });
    req.user = rows[0];
    next();
  } catch { res.status(401).json({ error: 'Требуется вход' }); }
}
const requireAdmin = (req, res, next) =>
  req.user?.role !== 'admin' ? res.status(403).json({ error: 'Недостаточно прав' }) : next();

module.exports = { setSession, clearSession, publicUser, requireAuth, requireAdmin };
