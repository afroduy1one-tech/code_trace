const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const csurf = require('csurf');
const path = require('path');
const pool = require('./db');
const { port, isProd } = require('./config');

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '200mb' }));
app.use(cookieParser());

const csrfProtection = csurf({ cookie: { httpOnly: true, sameSite: 'lax', secure: isProd } });
app.get('/api/csrf', csrfProtection, (req, res) => res.json({ token: req.csrfToken() }));
app.use((req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD') return next();
  if (req.path === '/api/health' || req.path === '/api/csrf' || req.path === '/api/auth/logout') return next();
  csrfProtection(req, res, next);
});

app.get('/api/health', async (req, res) => {
  try { await pool.query('SELECT 1'); res.json({ ok: true, db: true }); }
  catch { res.status(503).json({ ok: false, db: false }); }
});

app.use(express.static(path.join(__dirname, 'public')));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/analysis', require('./routes/analysis'));
app.use('/api/admin', require('./routes/admin'));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') return res.status(403).json({ error: 'CSRF token invalid' });
  if (isProd) return res.status(500).json({ error: 'Server error' });
  res.status(500).json({ error: err.message });
});

const server = app.listen(port, () => console.log(`code trace: http://localhost:${port}`));

process.on('SIGTERM', () => {
  console.log('SIGTERM: закрываем сервер…');
  server.close(() => { pool.end(); process.exit(0); });
});
process.on('SIGINT', () => {
  console.log('SIGINT: закрываем сервер…');
  server.close(() => { pool.end(); process.exit(0); });
});