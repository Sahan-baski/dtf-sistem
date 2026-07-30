const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const SECRET = process.env.JWT_SECRET || 'dtf-gizli-2024-xK9mP';

router.post('/giris', async (req, res) => {
  try {
    const { kullanici_adi, sifre, rol_tipi } = req.body;
    const u = await User.findOne({ kullanici_adi: kullanici_adi?.toLowerCase() });
    if (!u) return res.status(401).json({ hata: 'Kullanıcı bulunamadı' });
    if (!u.aktif) return res.status(401).json({ hata: 'Hesap pasif' });
    if (u.onay_bekliyor) return res.status(401).json({ hata: 'Hesabınız onay bekliyor' });
    const dogru = await u.sifreKontrol(sifre);
    if (!dogru) return res.status(401).json({ hata: 'Şifre hatalı' });
    if (rol_tipi === 'yonetim' && u.rol === 'musteri') return res.status(401).json({ hata: 'Bu panel için yetkiniz yok' });
    if (rol_tipi === 'musteri' && u.rol !== 'musteri') return res.status(401).json({ hata: 'Yönetim panelinden giriş yapın' });
    const token = jwt.sign({ id: u._id, rol: u.rol, kullanici_adi: u.kullanici_adi }, SECRET, { expiresIn: '30d' });
    res.json({ token, kullanici: { id: u._id, kullanici_adi: u.kullanici_adi, ad: u.ad, soyad: u.soyad, rol: u.rol, firma_adi: u.firma_adi } });
  } catch (err) { res.status(500).json({ hata: err.message }); }
});

router.post('/kayit', async (req, res) => {
  try {
    const { kullanici_adi, sifre, ad, soyad, firma_adi, telefon, email, adres, vergi_no } = req.body;
    if (!kullanici_adi || !sifre || !ad) return res.status(400).json({ hata: 'Zorunlu alanlar eksik' });
    const var_mi = await User.findOne({ kullanici_adi: kullanici_adi.toLowerCase() });
    if (var_mi) return res.status(400).json({ hata: 'Bu kullanıcı adı alınmış' });
    const u = await User.create({ kullanici_adi, sifre, ad, soyad: soyad||'', firma_adi: firma_adi||'', telefon: telefon||'', email: email||'', adres: adres||'', vergi_no: vergi_no||'', rol: 'musteri', onay_bekliyor: true, aktif: true });
    res.status(201).json({ mesaj: 'Kayıt alındı, onay bekleniyor' });
  } catch (err) { res.status(500).json({ hata: err.message }); }
});

const authMiddleware = require('../middleware/auth');
router.get('/ben', authMiddleware, async (req, res) => {
  try {
    const u = await User.findById(req.kullanici.id).select('-sifre');
    if (!u) return res.status(404).json({ hata: 'Bulunamadı' });
    res.json(u);
  } catch (err) { res.status(500).json({ hata: err.message }); }
});

router.get('/kullanicilar', authMiddleware, async (req, res) => {
  try {
    const liste = await User.find().select('-sifre').sort({ createdAt: -1 });
    res.json(liste);
  } catch (err) { res.status(500).json({ hata: err.message }); }
});

router.post('/kullanicilar', authMiddleware, async (req, res) => {
  try {
    const { kullanici_adi, sifre, ad, soyad, rol } = req.body;
    if (!kullanici_adi || !sifre || !ad) return res.status(400).json({ hata: 'Eksik alan' });
    const u = await User.create({ kullanici_adi, sifre, ad, soyad: soyad||'', rol: rol||'calisan', aktif: true, onay_bekliyor: false });
    res.status(201).json({ ...u.toObject(), sifre: undefined });
  } catch (err) { res.status(500).json({ hata: err.message }); }
});

router.patch('/kullanicilar/:id', authMiddleware, async (req, res) => {
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
    const u = await User.findByIdAndUpdate(req.params.id, guncelle, { new: true }).select('-sifre');
    res.json(u);
  } catch (err) { res.status(500).json({ hata: err.message }); }
});

router.delete('/kullanicilar/:id', authMiddleware, async (req, res) => {
  try { await User.findByIdAndDelete(req.params.id); res.json({ mesaj: 'Silindi' }); }
  catch (err) { res.status(500).json({ hata: err.message }); }
});

module.exports = router;
