const express = require('express');
const router = express.Router();
const { Gorev } = require('../models');

router.get('/', async (req, res) => {
  try {
    const gorevler = await Gorev.find().sort({ tamamlandi: 1, createdAt: -1 });
    res.json(gorevler.map(g => ({ ...g.toObject(), id: g._id })));
  } catch (err) { res.status(500).json({ hata: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { baslik, aciklama, oncelik } = req.body;
    if (!baslik) return res.status(400).json({ hata: 'Başlık zorunlu' });
    const g = await Gorev.create({ baslik, aciklama: aciklama||'', oncelik: oncelik||'normal' });
    res.status(201).json({ ...g.toObject(), id: g._id });
  } catch (err) { res.status(500).json({ hata: err.message }); }
});

router.patch('/:id/tamamla', async (req, res) => {
  try {
    const g = await Gorev.findById(req.params.id);
    if (!g) return res.status(404).json({ hata: 'Bulunamadı' });
    g.tamamlandi = !g.tamamlandi;
    g.tamamlanma_tarihi = g.tamamlandi ? new Date().toISOString() : null;
    await g.save();
    res.json({ ...g.toObject(), id: g._id });
  } catch (err) { res.status(500).json({ hata: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await Gorev.findByIdAndDelete(req.params.id);
    res.json({ mesaj: 'Silindi' });
  } catch (err) { res.status(500).json({ hata: err.message }); }
});

module.exports = router;
