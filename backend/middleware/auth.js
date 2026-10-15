const jwt = require('jsonwebtoken');
const User = require('../models/User');
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

// Token'ı geçerli olsa bile kullanıcı veritabanında hâlâ var/aktif/onaylı mı
// diye bakılır ve ROL veritabanından alınır: pasife alınan, silinen ya da rolü
// düşürülen bir hesabın eski token'ı (30 gün geçerli) artık işe yaramaz.
// Her istekte veritabanına gitmemek için 30 sn'lik küçük bir önbellek var.
const onbellek = new Map(); // id -> { u, zaman }
const SURE = 30 * 1000;

async function kullaniciGetir(id) {
  const k = onbellek.get(String(id));
  if (k && Date.now() - k.zaman < SURE) return k.u;
  const u = await User.findById(id).select('rol aktif onay_bekliyor kullanici_adi ad soyad').lean();
  onbellek.set(String(id), { u, zaman: Date.now() });
  if (onbellek.size > 5000) onbellek.clear();
  return u;
}

const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ hata: 'Token gerekli' });
  let veri;
  try { veri = jwt.verify(token, SECRET); }
  catch { return res.status(401).json({ hata: 'Geçersiz token' }); }
  try {
    const u = await kullaniciGetir(veri.id);
    if (!u || !u.aktif || u.onay_bekliyor) return res.status(401).json({ hata: 'Oturum geçersiz - lütfen tekrar giriş yapın.' });
    req.kullanici = { ...veri, rol: u.rol, kullanici_adi: u.kullanici_adi, ad: u.ad, soyad: u.soyad };
    next();
  } catch {
    res.status(401).json({ hata: 'Geçersiz token' });
  }
};

authMiddleware.onbellekTemizle = (id) => { if (id) onbellek.delete(String(id)); else onbellek.clear(); };

module.exports = authMiddleware;
