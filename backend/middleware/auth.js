const jwt = require('jsonwebtoken');
// ÖNEMLİ: sabit bir "yedek" (fallback) değer YOK - JWT_SECRET ortam
// değişkeni ayarlanmamışsa sunucu güvenli olmayan bir şekilde başlamasın
// diye burada hemen (modül yüklenirken) hata fırlatılıyor. Eskiden burada
// 'dtf-gizli-2024-xK9mP' gibi kod içinde sabit/GitHub'da herkese açık bir
// değer vardı - bu değeri bilen HERKES sahte bir admin token'ı üretip tüm
// panele sızabilirdi. O yüzden hem bu değer artık geçersiz kılınmalı (Render'da
// JWT_SECRET'ı yeni/rastgele bir değere ayarlamak yeterli) hem de bundan
// sonra hep .env / ortam değişkeninden okunacak.
const SECRET = process.env.JWT_SECRET;
if (!SECRET) throw new Error('JWT_SECRET ortam değişkeni ayarlanmamış - sunucu güvenli başlatılamaz.');
module.exports = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ hata: 'Token gerekli' });
  try { req.kullanici = jwt.verify(token, SECRET); next(); }
  catch { res.status(401).json({ hata: 'Geçersiz token' }); }
};
