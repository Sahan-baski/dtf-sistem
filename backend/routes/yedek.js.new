const express = require('express');
const router = express.Router();
const { Siparis, Gorev, Musteri, Ayar, Kategori } = require('../models');
const User = require('../models/User');
const Urun = require('../models/Urun');

// Yedek al — JSON olarak indir
router.get('/al', async (req, res) => {
  try {
    const [siparisler, gorevler, musteriler, kullanicilar, urunler, ayarlar, kategoriler] = await Promise.all([
      Siparis.find().lean(),
      Gorev.find().lean(),
      Musteri.find().lean(),
      User.find().select('-sifre').lean(),
      Urun.find().lean(),
      Ayar.find().lean(),
      Kategori.find().lean(),
    ]);
    const yedek = {
      versiyon: '1.0',
      tarih: new Date().toISOString(),
      ozet: { siparis:siparisler.length, musteri:musteriler.length, urun:urunler.length, gorev:gorevler.length },
      veri: { siparisler, gorevler, musteriler, kullanicilar, urunler, ayarlar, kategoriler },
    };
    const tarihStr = new Date().toISOString().slice(0,10);
    res.setHeader('Content-Type','application/json');
    res.setHeader('Content-Disposition',`attachment; filename="dtf-yedek-${tarihStr}.json"`);
    res.json(yedek);
  } catch(e){ res.status(500).json({hata:e.message}); }
});

// Geri yükle
router.post('/yukle', async (req, res) => {
  try {
    const { veri, mod } = req.body;
    if (!veri) return res.status(400).json({hata:'Yedek verisi bulunamadı'});
    const sonuc = {};
    if (mod === 'ekle') {
      if (veri.siparisler?.length) {
        let n=0; for(const s of veri.siparisler){ if(!(await Siparis.findOne({siparis_no:s.siparis_no}))){ await Siparis.create({...s,_id:undefined}); n++; } } sonuc.siparisler=n;
      }
      if (veri.musteriler?.length) {
        let n=0; for(const m of veri.musteriler){ if(!(await Musteri.findOne({telefon:m.telefon}))){ await Musteri.create({...m,_id:undefined}); n++; } } sonuc.musteriler=n;
      }
      if (veri.urunler?.length) {
        let n=0; for(const u of veri.urunler){ if(!(await Urun.findOne({ad:u.ad,kategori_key:u.kategori_key}))){ await Urun.create({...u,_id:undefined}); n++; } } sonuc.urunler=n;
      }
    } else if (mod === 'sifirla') {
      await Promise.all([Siparis.deleteMany({}),Gorev.deleteMany({}),Musteri.deleteMany({}),Urun.deleteMany({})]);
      if(veri.siparisler?.length){ await Siparis.insertMany(veri.siparisler.map(s=>({...s,_id:undefined}))); sonuc.siparisler=veri.siparisler.length; }
      if(veri.gorevler?.length){ await Gorev.insertMany(veri.gorevler.map(g=>({...g,_id:undefined}))); sonuc.gorevler=veri.gorevler.length; }
      if(veri.musteriler?.length){ await Musteri.insertMany(veri.musteriler.map(m=>({...m,_id:undefined}))); sonuc.musteriler=veri.musteriler.length; }
      if(veri.urunler?.length){ await Urun.insertMany(veri.urunler.map(u=>({...u,_id:undefined}))); sonuc.urunler=veri.urunler.length; }
    }
    res.json({mesaj:'Geri yükleme tamamlandı', sonuc});
  } catch(e){ res.status(500).json({hata:e.message}); }
});

module.exports = router;
