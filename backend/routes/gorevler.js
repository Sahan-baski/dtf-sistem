const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

// Tüm görevleri getir
router.get('/', (req, res) => {
  db.read();
  const gorevler = [...db.data.gorevler].sort((a, b) => {
    // Tamamlanmayanlar önce, sonra önceliğe göre
    if (a.tamamlandi !== b.tamamlandi) return a.tamamlandi ? 1 : -1;
    const oncelikSira = { yuksek: 0, normal: 1, dusuk: 2 };
    return (oncelikSira[a.oncelik] || 1) - (oncelikSira[b.oncelik] || 1);
  });
  res.json(gorevler);
});

// Yeni görev ekle
router.post('/', (req, res) => {
  db.read();
  const { baslik, aciklama, oncelik } = req.body;
  if (!baslik) return res.status(400).json({ hata: 'Başlık zorunlu' });

  const gorev = {
    id: uuidv4(),
    baslik,
    aciklama: aciklama || '',
    oncelik: oncelik || 'normal',
    tamamlandi: false,
    olusturma_tarihi: new Date().toISOString()
  };

  db.data.gorevler.push(gorev);
  db.write();
  res.status(201).json(gorev);
});

// Görev tamamla / aç
router.patch('/:id/tamamla', (req, res) => {
  db.read();
  const idx = db.data.gorevler.findIndex(g => g.id === req.params.id);
  if (idx === -1) return res.status(404).json({ hata: 'Görev bulunamadı' });

  db.data.gorevler[idx].tamamlandi = !db.data.gorevler[idx].tamamlandi;
  db.data.gorevler[idx].tamamlanma_tarihi = db.data.gorevler[idx].tamamlandi
    ? new Date().toISOString() : null;
  db.write();
  res.json(db.data.gorevler[idx]);
});

// Görev sil
router.delete('/:id', (req, res) => {
  db.read();
  db.data.gorevler = db.data.gorevler.filter(g => g.id !== req.params.id);
  db.write();
  res.json({ mesaj: 'Silindi' });
});

module.exports = router;
