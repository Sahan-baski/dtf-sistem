const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sadeceAdmin } = require('../middleware/rol');
const { hizSiniri } = require('../middleware/guvenlik');

// Şifre deneme saldırısına karşı: aynı IP + kullanıcı adıyla 15 dakikada en fazla
// 8 hatalı giriş; ayrıca bir IP'den 15 dakikada en fazla 40 giriş isteği.
const girisKullaniciSiniri = hizSiniri({ pencereMs: 15 * 60 * 1000, limit: 8, mesaj: 'Çok fazla hatalı giriş denemesi. 15 dakika sonra tekrar deneyin.',
  anahtarFn: (req) => `${req.ip}|${String(req.body?.kullanici_adi || '').toLowerCase()}` });
const girisIpSiniri = hizSiniri({ pencereMs: 15 * 60 * 1000, limit: 40, mesaj: 'Çok fazla giriş denemesi. Biraz sonra tekrar deneyin.' });
const kayitSiniri = hizSiniri({ pencereMs: 60 * 60 * 1000, limit: 5, mesaj: 'Bu bağlantıdan çok fazla kayıt denemesi yapıldı. Daha sonra tekrar deneyin.' });
const metin = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const HATALI_GIRIS = 'Kullanıcı adı veya şifre hatalı';
// middleware/auth.js ile AYNI mantık: sabit yedek değer yok, ayarlanmamışsa
// modül yüklenirken hata fırlatılır - bkz. middleware/auth.js'deki açıklama.
const SECRET = process.env.JWT_SECRET;
if (!SECRET) throw new Error('JWT_SECRET ortam değişkeni ayarlanmamış - sunucu güvenli başlatılamaz.');

router.post('/giris', girisIpSiniri, girisKullaniciSiniri, async (req, res) => {
  try {
    const { rol_tipi } = req.body || {};
    const kullanici_adi = metin(req.body?.kullanici_adi, 60).toLowerCase();
    const sifre = typeof req.body?.sifre === 'string' ? req.body.sifre : '';
    if (!kullanici_adi || !sifre) return res.status(400).json({ hata: 'Kullanıcı adı ve şifre gerekli' });
    const u = await User.findOne({ kullanici_adi });
    // Kullanıcı adının var olup olmadığı dışarıya sızdırılmaz: yok da olsa şifre yanlış da olsa aynı mesaj.
    if (!u) return res.status(401).json({ hata: HATALI_GIRIS });
    const dogru = await u.sifreKontrol(sifre);
    if (!dogru) return res.status(401).json({ hata: HATALI_GIRIS });
    girisKullaniciSiniri.sifirla(req);
    if (!u.aktif) return res.status(401).json({ hata: 'Hesap pasif' });
    if (u.onay_bekliyor) return res.status(401).json({ hata: 'Hesabınız onay bekliyor' });
    if (rol_tipi === 'yonetim' && u.rol === 'musteri') return res.status(401).json({ hata: 'Bu panel için yetkiniz yok' });
    if (rol_tipi === 'musteri' && u.rol !== 'musteri') return res.status(401).json({ hata: 'Yönetim panelinden giriş yapın' });
    const token = jwt.sign({ id: u._id, rol: u.rol, kullanici_adi: u.kullanici_adi }, SECRET, { expiresIn: '30d' });
    res.json({ token, kullanici: { id: u._id, kullanici_adi: u.kullanici_adi, ad: u.ad, soyad: u.soyad, rol: u.rol, firma_adi: u.firma_adi } });
  } catch (err) { console.error('[Giriş]', err.message); res.status(500).json({ hata: 'Giriş yapılamadı' }); }
});

router.post('/kayit', kayitSiniri, async (req, res) => {
  try {
    const b = req.body || {};
    const kullanici_adi = metin(b.kullanici_adi, 40).toLowerCase();
    const sifre = typeof b.sifre === 'string' ? b.sifre : '';
    const ad = metin(b.ad, 80);
    if (!kullanici_adi || !sifre || !ad) return res.status(400).json({ hata: 'Zorunlu alanlar eksik' });
    if (!/^[a-z0-9._-]{3,40}$/.test(kullanici_adi)) return res.status(400).json({ hata: 'Kullanıcı adı 3-40 karakter olmalı; sadece harf, rakam, nokta, tire ve alt çizgi içerebilir.' });
    if (sifre.length < 8 || sifre.length > 200) return res.status(400).json({ hata: 'Şifre en az 8 karakter olmalı.' });
    const var_mi = await User.findOne({ kullanici_adi });
    if (var_mi) return res.status(400).json({ hata: 'Bu kullanıcı adı alınmış' });
    const u = await User.create({ kullanici_adi, sifre, ad, soyad: metin(b.soyad, 80), firma_adi: metin(b.firma_adi, 150), telefon: metin(b.telefon, 30), email: metin(b.email, 150), adres: metin(b.adres, 500), vergi_no: metin(b.vergi_no, 30), rol: 'musteri', onay_bekliyor: true, aktif: true });
    res.status(201).json({ mesaj: 'Kayıt alındı, onay bekleniyor' });
  } catch (err) { console.error('[Kayıt]', err.message); res.status(500).json({ hata: 'Kayıt yapılamadı' }); }
});

const authMiddleware = require('../middleware/auth');
router.get('/ben', authMiddleware, async (req, res) => {
  try {
    const u = await User.findById(req.kullanici.id).select('-sifre');
    if (!u) return res.status(404).json({ hata: 'Bulunamadı' });
    res.json(u);
  } catch (err) { res.status(500).json({ hata: err.message }); }
});

// ÖNEMLİ: bu dört rota (kullanıcı listeleme/oluşturma/düzenleme/silme) artık
// sadece admin rolüne açık. Eskiden sadece "giriş yapmış olmak" yeterliydi -
// yani örneğin kayıt olan herhangi bir müşteri hesabı, kendi kullanıcı
// kaydını PATCH ile {"rol":"admin"} yaparak tüm panele admin olarak
// sızabiliyordu. Şimdi sadeceAdmin bunu engelliyor.
router.get('/kullanicilar', authMiddleware, sadeceAdmin, async (req, res) => {
  try {
    const liste = await User.find().select('-sifre').sort({ createdAt: -1 });
    res.json(liste);
  } catch (err) { res.status(500).json({ hata: err.message }); }
});

router.post('/kullanicilar', authMiddleware, sadeceAdmin, async (req, res) => {
  try {
    const { kullanici_adi, sifre, ad, soyad, rol } = req.body;
    if (!kullanici_adi || !sifre || !ad) return res.status(400).json({ hata: 'Eksik alan' });
    const u = await User.create({ kullanici_adi, sifre, ad, soyad: soyad||'', rol: rol||'calisan', aktif: true, onay_bekliyor: false });
    res.status(201).json({ ...u.toObject(), sifre: undefined });
  } catch (err) { res.status(500).json({ hata: err.message }); }
});

router.patch('/kullanicilar/:id', authMiddleware, sadeceAdmin, async (req, res) => {
  try {
    const { aktif, onay_bekliyor, sifre, rol } = req.body;
    const guncelle = {};
    if (aktif !== undefined) guncelle.aktif = aktif;
    if (onay_bekliyor !== undefined) guncelle.onay_bekliyor = onay_bekliyor;
    if (rol) guncelle.rol = rol;
    if (sifre) {
      const u = await User.findById(req.params.id);
      if (u) { u.sifre = sifre; await u.save(); }
    }
    if (guncelle.rol && !['admin', 'calisan', 'musteri'].includes(guncelle.rol)) return res.status(400).json({ hata: 'Geçersiz rol' });
    const u = await User.findByIdAndUpdate(req.params.id, guncelle, { new: true }).select('-sifre');
    authMiddleware.onbellekTemizle(req.params.id); // pasife alma / rol değişikliği hemen geçerli olsun
    res.json(u);
  } catch (err) { res.status(500).json({ hata: err.message }); }
});

router.delete('/kullanicilar/:id', authMiddleware, sadeceAdmin, async (req, res) => {
  try {
    if (String(req.params.id) === String(req.kullanici.id)) return res.status(400).json({ hata: 'Kendi hesabını silemezsin' });
    await User.findByIdAndDelete(req.params.id); authMiddleware.onbellekTemizle(req.params.id); res.json({ mesaj: 'Silindi' });
  }
  catch (err) { res.status(500).json({ hata: err.message }); }
});

module.exports = router;
