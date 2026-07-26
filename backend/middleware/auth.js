const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'dtf-gizli-2024-xK9mP';

module.exports = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ hata: 'Giriş yapmalısınız' });
  try {
    req.kullanici = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ hata: 'Oturum süresi doldu, tekrar giriş yapın' });
  }
};
