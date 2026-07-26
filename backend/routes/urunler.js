const express = require('express');
const router = express.Router();
const Urun = require('../models/Urun');

// Tüm ürünleri getir (kategoriye göre gruplu)
router.get('/', async (req, res) => {
  try {
    const { kategori } = req.query;
    const filtre = kategori ? { kategori_key: kategori } : {};
    const urunler = await Urun.find(filtre).sort({ sira: 1, createdAt: 1 });
    res.json(urunler);
  } catch (err) { res.status(500).json({ hata: err.message }); }
});

// Ürün ekle
router.post('/', async (req, res) => {
  try {
    const { kategori_key, ad, aciklama, fiyat, ozellikler } = req.body;
    if (!kategori_key || !ad) return res.status(400).json({ hata: 'Kategori ve ürün adı zorunlu' });
    const sayi = await Urun.countDocuments({ kategori_key });
    const urun = await Urun.create({ kategori_key, ad, aciklama: aciklama||'', fiyat: fiyat||0, ozellikler: ozellikler||[], sira: sayi });
    res.status(201).json(urun);
  } catch (err) { res.status(500).json({ hata: err.message }); }
});

// Ürün güncelle
router.put('/:id', async (req, res) => {
  try {
    const urun = await Urun.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!urun) return res.status(404).json({ hata: 'Ürün bulunamadı' });
    res.json(urun);
  } catch (err) { res.status(500).json({ hata: err.message }); }
});

// Aktif/pasif toggle
router.patch('/:id/toggle', async (req, res) => {
  try {
    const urun = await Urun.findById(req.params.id);
    if (!urun) return res.status(404).json({ hata: 'Bulunamadı' });
    urun.aktif = !urun.aktif;
    await urun.save();
    res.json(urun);
  } catch (err) { res.status(500).json({ hata: err.message }); }
});

// Ürün sil
router.delete('/:id', async (req, res) => {
  try {
    await Urun.findByIdAndDelete(req.params.id);
    res.json({ mesaj: 'Silindi' });
  } catch (err) { res.status(500).json({ hata: err.message }); }
});

module.exports = router;
