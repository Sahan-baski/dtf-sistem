const express = require('express');
const router = express.Router();
const { Ayar, Siparis } = require('../models');

const VARSAYILANLAR = {
  gunluk_press_kapasitesi: 180,
  min_teslim_gun: 2,
  baski_hazirlama_gun: 1,
};

// Tüm ayarları getir
router.get('/', async (req, res) => {
  try {
    const ayarlar = await Ayar.find();
    const sonuc = { ...VARSAYILANLAR };
    ayarlar.forEach(a => { sonuc[a.anahtar] = a.deger; });
    res.json(sonuc);
  } catch (err) { res.status(500).json({ hata: err.message }); }
});

// Ayar kaydet
router.post('/', async (req, res) => {
  try {
    for (const [anahtar, deger] of Object.entries(req.body)) {
      await Ayar.findOneAndUpdate({ anahtar }, { deger }, { upsert: true });
    }
    res.json({ mesaj: 'Ayarlar kaydedildi' });
  } catch (err) { res.status(500).json({ hata: err.message }); }
});

// Önerilen teslim tarihi hesapla
router.get('/teslim-tarihi', async (req, res) => {
  try {
    const pressSayisi = parseInt(req.query.press_sayisi) || 0;

    // Kapasiteyi al
    const kapAyar = await Ayar.findOne({ anahtar: 'gunluk_press_kapasitesi' });
    const kapasite = kapAyar ? kapAyar.deger : 180;
    const minGun   = 2;

    // Mevcut aktif siparişlerin press yükü
    const aktifSiparisler = await Siparis.find({ durum: { $ne: 'teslim_edildi' } })
      .select('teslim_tarihi press_sayisi');

    const gunYuk = {};
    aktifSiparisler.forEach(s => {
      if (s.teslim_tarihi && s.press_sayisi > 0) {
        gunYuk[s.teslim_tarihi] = (gunYuk[s.teslim_tarihi] || 0) + s.press_sayisi;
      }
    });

    // Gün 2'den başla: gün 1 = baskı hazırlama
    const bugun = new Date(); bugun.setHours(0,0,0,0);
    let teslimTarihi = null;

    for (let gun = minGun; gun <= 60; gun++) {
      const d = new Date(bugun);
      d.setDate(d.getDate() + gun);
      const tarih = d.toISOString().split('T')[0];
      const mevcutYuk = gunYuk[tarih] || 0;
      if (mevcutYuk + pressSayisi <= kapasite) {
        teslimTarihi = tarih;
        break;
      }
    }

    if (!teslimTarihi) {
      const d = new Date(bugun); d.setDate(d.getDate() + 30);
      teslimTarihi = d.toISOString().split('T')[0];
    }

    res.json({ teslim_tarihi: teslimTarihi, kapasite, gunYuk });
  } catch (err) { res.status(500).json({ hata: err.message }); }
});

module.exports = router;
