require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../src/db');
(async () => {
  const users = [
    ['admin', 'admin', 'Администратор', 'experienced', 'admin'],
    ['demo_user', 'demo', 'Демо-пользователь', 'beginner', 'user'],
    ['pro_dev', 'demo', 'Опытный разработчик', 'experienced', 'user'],
  ];
  for (const [login, pwd, name, level, role] of users) {
    const hash = await bcrypt.hash(pwd, 10);
    const [r] = await pool.query('SELECT id FROM `user` WHERE login=?', [login]);
    if (r.length) await pool.query('UPDATE `user` SET password_hash=?, name=?, level=?, role=? WHERE id=?', [hash, name, level, role, r[0].id]);
    else await pool.query('INSERT INTO `user` (login, password_hash, name, level, role) VALUES (?,?,?,?,?)', [login, hash, name, level, role]);
    console.log(`${login} / ${pwd} (${role})`);
  }
  await pool.end();
})();
