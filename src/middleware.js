const { body, param, validationResult } = require('express-validator');
const pool = require('./db');
const { requireAuth, requireAdmin } = require('./auth');

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
  next();
}

async function requireProjectOwner(req, res, next) {
  const projectId = Number(req.params.id || req.body.projectId);
  if (!projectId) return res.status(400).json({ error: 'Некорректный id' });
  const [[p]] = await pool.query('SELECT user_id FROM project WHERE id=?', [projectId]);
  if (!p) return res.status(404).json({ error: 'Проект не найден' });
  if (p.user_id !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Доступ запрещён' });
  next();
}

async function requireAnalysisOwner(req, res, next) {
  const analysisId = Number(req.params.id);
  if (!analysisId) return res.status(400).json({ error: 'Некорректный id' });
  const [[row]] = await pool.query(`
    SELECT a.id, a.project_id, p.user_id FROM analysis a
    JOIN project p ON p.id=a.project_id WHERE a.id=?`, [analysisId]);
  if (!row) return res.status(404).json({ error: 'Анализ не найден' });
  if (row.user_id !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Доступ запрещён' });
  req.analysisRow = row;
  next();
}

const rate = new Map();
function rateLimit(key, limit = 20, windowMs = 10 * 60 * 1000) {
  return (req, res, next) => {
    const k = key + ':' + (req.user?.id || req.ip);
    const now = Date.now();
    const entry = rate.get(k) || { count: 0, since: now };
    if (now - entry.since > windowMs) { entry.count = 0; entry.since = now; }
    entry.count++;
    rate.set(k, entry);
    if (entry.count > limit) return res.status(429).json({ error: 'Слишком много запросов, подождите' });
    next();
  };
}

const loginAttempts = new Map();
function rateLimitLogin(req, res, next) {
  const key = req.ip + ':' + (req.body?.login || '');
  const now = Date.now();
  const entry = loginAttempts.get(key) || { count: 0, firstAt: now };
  if (now - entry.firstAt > 15 * 60 * 1000) { entry.count = 0; entry.firstAt = now; }
  entry.count++;
  loginAttempts.set(key, entry);
  if (entry.count > 10) return res.status(429).json({ error: 'Слишком много попыток. Подождите 15 минут.' });
  next();
}

const v = {
  login: [body('login').isString().trim().isLength({ min: 3, max: 50 }).withMessage('Логин 3–50 символов'), validate],
  password: [body('password').isString().isLength({ min: 4, max: 100 }).withMessage('Пароль 4–100 символов'), validate],
  register: [
    body('login').isString().trim().isLength({ min: 3, max: 50 }).withMessage('Логин 3–50 символов'),
    body('password').isString().isLength({ min: 4, max: 100 }).withMessage('Пароль 4–100 символов'),
    body('name').optional().isString().trim().isLength({ max: 100 }),
    validate,
  ],
  runProject: [
    body('projectName').optional().isString().trim().isLength({ min: 1, max: 150 }),
    body('projectId').optional().isInt({ min: 1 }),
    body('repositoryUrl').optional().isString().isLength({ max: 500 }),
    validate,
  ],
  runUrl: [
    body('repositoryUrl').isString().matches(/^https?:\/\/github\.com\/[^/]+\/[^/]+/).withMessage('Нужна GitHub-ссылка'),
    body('projectName').optional().isString().trim().isLength({ min: 1, max: 150 }),
    body('projectId').optional().isInt({ min: 1 }),
    validate,
  ],
  idParam: [param('id').isInt({ min: 1 }), validate],
};

module.exports = {
  requireAuth, requireAdmin,
  requireProjectOwner, requireAnalysisOwner,
  rateLimit, rateLimitLogin,
  v, validate,
};
