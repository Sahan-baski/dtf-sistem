const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const axios = require('axios');

function hesaplaOncelik(teslimTarihi) {
  if (!teslimTarihi) return { oncelik: 'normal', kalan_gun: null };
  const bugun = new Date(); bugun.setHours(0,0,0,0);
  const teslim = new Date(teslimTarihi); teslim.setHours(0,0,0,0);
  const kalanGun = Math.ceil((teslim - bugun) / (1000*60*60*24));
  let oncelik = 'normal';
  if (kalanGun <= 1) oncelik = 'acil';
  else if (kalanGun <= 4) oncelik = 'yakin';
  return { oncelik, kalan_gun: kalanGun };
}

router.get('/', (req, res) => {
  db.read();
  const aktif = db.data.siparisler
    .filter(s => s.durum !== 'teslim_edildi')
    .map(s => ({ ...s, ...hesaplaOncelik(s.teslim_tarihi) }))
    .sort((a, b) => {
      const ta = a.teslim_tarihi ? new Date(a.teslim_tarihi) : new Date('2099-01-01');
      const tb = b.teslim_tarihi ? new Date(b.teslim_tarihi) : new Date('2099-01-01');
      return ta - tb;
    });
  const teslim_edilen = db.data.siparisler.filter(s => s.durum === 'teslim_edildi');
  res.json({ aktif, teslim_edilen });
});

router.post('/', (req, res) => {
  db.read();
  const { musteri_adi, musteri_soyadi, musteri_telefon, urunler, notlar,
          teslim_tarihi, kaynak, kategori, asamalar, tutar } = req.body;
  if (!musteri_adi) return res.status(400).json({ hata: 'Müşteri adı zorunlu' });

  const bugun = new Date();
  let teslimTarihi = teslim_tarihi;
  if (!teslimTarihi) {
    const t = new Date(bugun);
    t.setDate(t.getDate() + (db.data.ayarlar.varsayilan_teslim_gun || 3));
    teslimTarihi = t.toISOString().split('T')[0];
  }

  const siparis = {
    id: uuidv4(),
    siparis_no: 'S' + Date.now().toString().slice(-6),
    musteri_adi, musteri_soyadi: musteri_soyadi || '',
    musteri_telefon: musteri_telefon || '',
    urunler: urunler || [],
    notlar: notlar || '',
    teslim_tarihi: teslimTarihi,
    durum: 'bekliyor',
    kaynak: kaynak || 'manuel',
    kategori: kategori || '',
    asamalar: asamalar || [],
    odeme: {
      tutar: tutar || 0,
      odenen: 0,
      odendi: false,
      yontem: '',
      fatura_kesildi: false,
      odeme_tarihi: null,
      notlar: ''
    },
    kargo: { takip_no: '', firma: '', gonderim_tarihi: null },
    olusturma_tarihi: bugun.toISOString()
  };

  db.data.siparisler.push(siparis);

  // Müşteri rehberine ekle/güncelle
  if (!db.data.musteriler) db.data.musteriler = [];
  const telefon = musteri_telefon?.trim();
  let musteri = telefon ? db.data.musteriler.find(m => m.telefon === telefon) : null;
  if (musteri) {
    musteri.siparis_sayisi = (musteri.siparis_sayisi || 0) + 1;
    musteri.son_siparis = bugun.toISOString();
    musteri.siparis_idler = [...(musteri.siparis_idler || []), siparis.id];
  } else if (musteri_adi) {
    db.data.musteriler.push({
      id: uuidv4(), ad: musteri_adi, soyad: musteri_soyadi || '',
      telefon: telefon || '', siparis_sayisi: 1,
      siparis_idler: [siparis.id],
      ilk_siparis: bugun.toISOString(),
      son_siparis: bugun.toISOString(), notlar: ''
    });
  }

  db.write();
  res.status(201).json(siparis);
});

router.put('/:id', (req, res) => {
  db.read();
  const idx = db.data.siparisler.findIndex(s => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ hata: 'Bulunamadı' });
  db.data.siparisler[idx] = { ...db.data.siparisler[idx], ...req.body, id: req.params.id };
  db.write();
  res.json(db.data.siparisler[idx]);
});

router.patch('/:id/durum', (req, res) => {
  db.read();
  const idx = db.data.siparisler.findIndex(s => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ hata: 'Bulunamadı' });
  db.data.siparisler[idx].durum = req.body.durum;
  if (req.body.durum === 'teslim_edildi')
    db.data.siparisler[idx].teslim_edildi_tarihi = new Date().toISOString();
  db.write();
  res.json(db.data.siparisler[idx]);
});

// Ödeme güncelle
router.patch('/:id/odeme', (req, res) => {
  db.read();
  const idx = db.data.siparisler.findIndex(s => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ hata: 'Bulunamadı' });
  db.data.siparisler[idx].odeme = {
    ...db.data.siparisler[idx].odeme,
    ...req.body,
    odeme_tarihi: req.body.odendi ? new Date().toISOString() : db.data.siparisler[idx].odeme?.odeme_tarihi
  };
  db.write();
  res.json(db.data.siparisler[idx]);
});

// Kargo güncelle
router.patch('/:id/kargo', (req, res) => {
  db.read();
  const idx = db.data.siparisler.findIndex(s => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ hata: 'Bulunamadı' });
  db.data.siparisler[idx].kargo = { ...db.data.siparisler[idx].kargo, ...req.body };
  db.write();
  res.json(db.data.siparisler[idx]);
});

router.delete('/:id', (req, res) => {
  db.read();
  db.data.siparisler = db.data.siparisler.filter(s => s.id !== req.params.id);
  db.write();
  res.json({ mesaj: 'Silindi' });
});

module.exports = router;
