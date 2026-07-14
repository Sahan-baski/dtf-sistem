const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

// Tüm müşterileri getir
router.get('/', (req, res) => {
  db.read();
  const musteriler = [...(db.data.musteriler || [])].sort((a, b) =>
    (b.siparis_sayisi || 0) - (a.siparis_sayisi || 0)
  );
  res.json(musteriler);
});

// Telefon veya ada göre ara
router.get('/ara', (req, res) => {
  db.read();
  const { q } = req.query;
  if (!q) return res.json([]);
  const query = q.toLowerCase();
  const sonuc = (db.data.musteriler || []).filter(m =>
    `${m.ad} ${m.soyad}`.toLowerCase().includes(query) ||
    (m.telefon || '').includes(query)
  ).slice(0, 5);
  res.json(sonuc);
});

// Müşteri oluştur veya güncelle
router.post('/upsert', (req, res) => {
  db.read();
  if (!db.data.musteriler) db.data.musteriler = [];
  const { ad, soyad, telefon, siparis_id } = req.body;
  if (!ad) return res.status(400).json({ hata: 'Ad zorunlu' });

  let musteri = telefon
    ? db.data.musteriler.find(m => m.telefon === telefon)
    : null;

  if (musteri) {
    musteri.siparis_sayisi = (musteri.siparis_sayisi || 0) + 1;
    musteri.son_siparis = new Date().toISOString();
    if (siparis_id && !musteri.siparis_idler?.includes(siparis_id)) {
      musteri.siparis_idler = [...(musteri.siparis_idler || []), siparis_id];
    }
  } else {
    musteri = {
      id: uuidv4(),
      ad, soyad: soyad || '',
      telefon: telefon || '',
      siparis_sayisi: 1,
      siparis_idler: siparis_id ? [siparis_id] : [],
      ilk_siparis: new Date().toISOString(),
      son_siparis: new Date().toISOString(),
      notlar: ''
    };
    db.data.musteriler.push(musteri);
  }

  db.write();
  res.json(musteri);
});

// Müşteri notunu güncelle
router.patch('/:id/not', (req, res) => {
  db.read();
  const idx = (db.data.musteriler || []).findIndex(m => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ hata: 'Bulunamadı' });
  db.data.musteriler[idx].notlar = req.body.notlar || '';
  db.write();
  res.json(db.data.musteriler[idx]);
});

module.exports = router;
