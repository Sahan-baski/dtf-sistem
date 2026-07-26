const express = require('express');
const router = express.Router();
const { Musteri } = require('../models');

router.get('/', async (req, res) => {
  try {
    const musteriler = await Musteri.find().sort({ siparis_sayisi: -1 });
    res.json(musteriler.map(m => ({ ...m.toObject(), id: m._id })));
  } catch (err) { res.status(500).json({ hata: err.message }); }
});

router.get('/ara', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);
    const sonuc = await Musteri.find({
      $or: [
        { ad: { $regex: q, $options: 'i' } },
        { soyad: { $regex: q, $options: 'i' } },
        { telefon: { $regex: q } }
      ]
    }).limit(5);
    res.json(sonuc.map(m => ({ ...m.toObject(), id: m._id })));
  } catch (err) { res.status(500).json({ hata: err.message }); }
});

module.exports = router;
