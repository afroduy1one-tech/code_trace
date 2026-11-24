require('dotenv').config();
module.exports = {
  port: Number(process.env.PORT || 3001),
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'code_guide',
  },
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  maxArchiveBytes: 100 * 1024 * 1024,
  maxFiles: Number(process.env.MAX_FILES || 800),
  githubToken: process.env.GITHUB_TOKEN || '',
  isProd: process.env.NODE_ENV === 'production',
};