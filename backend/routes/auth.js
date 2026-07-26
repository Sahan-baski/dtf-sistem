const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'dtf-gizli-2024-xK9mP';

function tokenOlustur(user) {
  return jwt.sign(
    { id: user._id, kullanici_adi: user.kullanici_adi, rol: user.rol, ad: user.ad, soyad: user.soyad },
    JWT_SECRET, { expiresIn: '7d' }
  );
}

// Giriş
router.post('/giris', async (req, res) => {
  try {
    const { kullanici_adi, sifre, rol_tipi } = req.body;
    if (!kullanici_adi || !sifre) return res.status(400).json({ hata: 'Kullanıcı adı ve şifre gerekli' });
    const user = await User.findOne({ kullanici_adi: kullanici_adi.toLowerCase().trim(), aktif: true });
    if (!user) return res.status(401).json({ hata: 'Kullanıcı adı veya şifre hatalı' });
    if (user.onay_bekliyor) return res.status(403).json({ hata: 'Hesabınız henüz onaylanmadı. Yönetici onayı bekleniyor.' });
    const dogru = await user.sifreKontrol(sifre);
    if (!dogru) return res.status(401).json({ hata: 'Kullanıcı adı veya şifre hatalı' });
    if (rol_tipi === 'musteri' && user.rol !== 'musteri') return res.status(403).json({ hata: 'Bu panel için yetkiniz yok' });
    if (rol_tipi === 'yonetim' && user.rol === 'musteri') return res.status(403).json({ hata: 'Bu panel için yetkiniz yok' });
    const token = tokenOlustur(user);
    res.json({ token, kullanici: { id: user._id, kullanici_adi: user.kullanici_adi, rol: user.rol, ad: user.ad, soyad: user.soyad, firma_adi: user.firma_adi } });
  } catch (err) { res.status(500).json({ hata: err.message }); }
});

// Müşteri kaydı (herkese açık)
router.post('/kayit', async (req, res) => {
  try {
    const { kullanici_adi, sifre, ad, soyad, firma_adi, telefon, email, adres, vergi_no } = req.body;
    if (!kullanici_adi || !sifre) return res.status(400).json({ hata: 'Kullanıcı adı ve şifre zorunlu' });
    if (!firma_adi) return res.status(400).json({ hata: 'Firma adı zorunlu' });
    if (!telefon) return res.status(400).json({ hata: 'Telefon numarası zorunlu' });
    if (!ad) return res.status(400).json({ hata: 'Ad zorunlu' });
    if (sifre.length < 6) return res.status(400).json({ hata: 'Şifre en az 6 karakter olmalı' });

    const user = await User.create({
      kullanici_adi: kullanici_adi.toLowerCase().trim(),
      sifre, ad, soyad: soyad||'',
      firma_adi, telefon, email: email||'', adres: adres||'', vergi_no: vergi_no||'',
      rol: 'musteri', aktif: true, onay_bekliyor: true
    });
    res.status(201).json({ mesaj: 'Kaydınız alındı. Yönetici onayından sonra giriş yapabilirsiniz.' });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ hata: 'Bu kullanıcı adı zaten alınmış' });
    res.status(500).json({ hata: err.message });
  }
});

// Ben kimim
router.get('/ben', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.kullanici.id).select('-sifre');
    if (!user) return res.status(404).json({ hata: 'Bulunamadı' });
    res.json(user);
  } catch (err) { res.status(500).json({ hata: err.message }); }
});

// Kullanıcı listesi (admin)
router.get('/kullanicilar', authMiddleware, async (req, res) => {
  try {
    if (req.kullanici.rol !== 'admin') return res.status(403).json({ hata: 'Yetkisiz' });
    const liste = await User.find().select('-sifre').sort({ createdAt: -1 });
    res.json(liste);
  } catch (err) { res.status(500).json({ hata: err.message }); }
});

// Kullanıcı ekle (admin)
router.post('/kullanicilar', authMiddleware, async (req, res) => {
  try {
    if (req.kullanici.rol !== 'admin') return res.status(403).json({ hata: 'Yetkisiz' });
    const { kullanici_adi, sifre, ad, soyad, rol, firma_adi, telefon, email } = req.body;
    if (!kullanici_adi || !sifre) return res.status(400).json({ hata: 'Kullanıcı adı ve şifre zorunlu' });
    const user = await User.create({ kullanici_adi, sifre, ad:ad||'', soyad:soyad||'', rol:rol||'calisan', firma_adi:firma_adi||'', telefon:telefon||'', email:email||'', aktif:true, onay_bekliyor:false });
    res.status(201).json({ id: user._id, kullanici_adi: user.kullanici_adi, rol: user.rol });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ hata: 'Bu kullanıcı adı zaten alınmış' });
    res.status(500).json({ hata: err.message });
  }
});

// Onay ver / aktif-pasif (admin)
router.patch('/kullanicilar/:id', authMiddleware, async (req, res) => {
  try {
    if (req.kullanici.rol !== 'admin') return res.status(403).json({ hata: 'Yetkisiz' });
    const { aktif, onay_bekliyor } = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, { aktif, onay_bekliyor }, { new: true }).select('-sifre');
    res.json(user);
  } catch (err) { res.status(500).json({ hata: err.message }); }
});

// Kullanıcı sil (admin)
router.delete('/kullanicilar/:id', authMiddleware, async (req, res) => {
  try {
    if (req.kullanici.rol !== 'admin') return res.status(403).json({ hata: 'Yetkisiz' });
    if (req.params.id === req.kullanici.id) return res.status(400).json({ hata: 'Kendinizi silemezsiniz' });
    await User.findByIdAndDelete(req.params.id);
    res.json({ mesaj: 'Silindi' });
  } catch (err) { res.status(500).json({ hata: err.message }); }
});

// Şifre değiştir
router.patch('/sifre', authMiddleware, async (req, res) => {
  try {
    const { eski_sifre, yeni_sifre } = req.body;
    const user = await User.findById(req.kullanici.id);
    const dogru = await user.sifreKontrol(eski_sifre);
    if (!dogru) return res.status(401).json({ hata: 'Mevcut şifre hatalı' });
    user.sifre = yeni_sifre;
    await user.save();
    res.json({ mesaj: 'Şifre güncellendi' });
  } catch (err) { res.status(500).json({ hata: err.message }); }
});

module.exports = router;
