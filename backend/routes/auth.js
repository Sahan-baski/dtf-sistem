const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'dtf-gizli-2024-xK9mP';
const TOKEN_SURE = '7d';

// Giriş
router.post('/giris', async (req, res) => {
  try {
    const { kullanici_adi, sifre, rol_tipi } = req.body;
    if (!kullanici_adi || !sifre) return res.status(400).json({ hata: 'Kullanıcı adı ve şifre gerekli' });

    const user = await User.findOne({ kullanici_adi: kullanici_adi.toLowerCase(), aktif: true });
    if (!user) return res.status(401).json({ hata: 'Kullanıcı adı veya şifre hatalı' });

    const dogru = await user.sifreKontrol(sifre);
    if (!dogru) return res.status(401).json({ hata: 'Kullanıcı adı veya şifre hatalı' });

    // Rol kontrolü — hangi panel için giriş yapıldığını kontrol et
    if (rol_tipi === 'musteri' && user.rol !== 'musteri')
      return res.status(403).json({ hata: 'Bu panel için yetkiniz yok' });
    if (rol_tipi === 'yonetim' && user.rol === 'musteri')
      return res.status(403).json({ hata: 'Bu panel için yetkiniz yok' });

    const token = jwt.sign(
      { id: user._id, kullanici_adi: user.kullanici_adi, rol: user.rol, ad: user.ad, soyad: user.soyad },
      JWT_SECRET,
      { expiresIn: TOKEN_SURE }
    );

    res.json({
      token,
      kullanici: { id: user._id, kullanici_adi: user.kullanici_adi, rol: user.rol, ad: user.ad, soyad: user.soyad }
    });
  } catch (err) {
    res.status(500).json({ hata: err.message });
  }
});

// Mevcut kullanıcı bilgisi
router.get('/ben', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.kullanici.id).select('-sifre');
    if (!user) return res.status(404).json({ hata: 'Kullanıcı bulunamadı' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ hata: err.message });
  }
});

// Kullanıcı listesi (sadece admin)
router.get('/kullanicilar', authMiddleware, async (req, res) => {
  try {
    if (req.kullanici.rol !== 'admin') return res.status(403).json({ hata: 'Yetkisiz' });
    const kullanicilar = await User.find().select('-sifre').sort({ createdAt: -1 });
    res.json(kullanicilar);
  } catch (err) {
    res.status(500).json({ hata: err.message });
  }
});

// Kullanıcı ekle (sadece admin)
router.post('/kullanicilar', authMiddleware, async (req, res) => {
  try {
    if (req.kullanici.rol !== 'admin') return res.status(403).json({ hata: 'Yetkisiz' });
    const { kullanici_adi, sifre, ad, soyad, rol } = req.body;
    if (!kullanici_adi || !sifre) return res.status(400).json({ hata: 'Kullanıcı adı ve şifre gerekli' });
    const user = await User.create({ kullanici_adi, sifre, ad: ad||'', soyad: soyad||'', rol: rol||'calisan' });
    res.status(201).json({ id: user._id, kullanici_adi: user.kullanici_adi, rol: user.rol });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ hata: 'Bu kullanıcı adı zaten alınmış' });
    res.status(500).json({ hata: err.message });
  }
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
  } catch (err) {
    res.status(500).json({ hata: err.message });
  }
});

// Kullanıcı sil (sadece admin)
router.delete('/kullanicilar/:id', authMiddleware, async (req, res) => {
  try {
    if (req.kullanici.rol !== 'admin') return res.status(403).json({ hata: 'Yetkisiz' });
    await User.findByIdAndDelete(req.params.id);
    res.json({ mesaj: 'Silindi' });
  } catch (err) {
    res.status(500).json({ hata: err.message });
  }
});

module.exports = router;
