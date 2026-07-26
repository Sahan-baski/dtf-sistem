const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { Siparis, Musteri, Ayar } = require('../models');

function hesaplaOncelik(teslimTarihi) {
  if (!teslimTarihi) return { oncelik:'normal', kalan_gun:null };
  const bugun = new Date(); bugun.setHours(0,0,0,0);
  const teslim = new Date(teslimTarihi); teslim.setHours(0,0,0,0);
  const kalanGun = Math.ceil((teslim-bugun)/(1000*60*60*24));
  return { oncelik: kalanGun<=1?'acil':kalanGun<=4?'yakin':'normal', kalan_gun:kalanGun };
}

async function olusturSiparis(body, kullanici) {
  const { Ayar } = require('../models');
  const kapAyar = await Ayar.findOne({ anahtar:'gunluk_press_kapasitesi' });
  const kapasite = kapAyar ? kapAyar.deger : 180;
  const minGun = 2;

  let { musteri_adi, musteri_soyadi, musteri_telefon, urunler, notlar,
        teslim_tarihi, kaynak, kategori, asamalar, baski_yonu, satis_tipi,
        press_sayisi } = body;

  // Press hesapla
  if (!press_sayisi) {
    const adet = urunler?.[0]?.adet || 1;
    press_sayisi = baski_yonu === 'cift_yon' ? adet*2 : baski_yonu === 'tek_yon' ? adet : 0;
  }

  // Teslim tarihi otomatik hesapla
  if (!teslim_tarihi && press_sayisi > 0) {
    const aktif = await Siparis.find({ durum:{$ne:'teslim_edildi'} }).select('teslim_tarihi press_sayisi');
    const gunYuk = {};
    aktif.forEach(s => {
      if (s.teslim_tarihi && s.press_sayisi>0) gunYuk[s.teslim_tarihi] = (gunYuk[s.teslim_tarihi]||0)+s.press_sayisi;
    });
    const bugun = new Date(); bugun.setHours(0,0,0,0);
    for (let gun=minGun; gun<=60; gun++) {
      const d = new Date(bugun); d.setDate(d.getDate()+gun);
      const tarih = d.toISOString().split('T')[0];
      if ((gunYuk[tarih]||0)+press_sayisi <= kapasite) { teslim_tarihi=tarih; break; }
    }
  }
  if (!teslim_tarihi) {
    const d = new Date(); d.setDate(d.getDate()+minGun);
    teslim_tarihi = d.toISOString().split('T')[0];
  }

  const siparis = await Siparis.create({
    siparis_no: 'S'+Date.now().toString().slice(-6),
    musteri_adi, musteri_soyadi:musteri_soyadi||'', musteri_telefon:musteri_telefon||'',
    musteri_user_id: kullanici?.rol==='musteri' ? kullanici.id : null,
    urunler:urunler||[], notlar:notlar||'', teslim_tarihi,
    press_sayisi, baski_yonu:baski_yonu||'', satis_tipi:satis_tipi||'',
    durum:'bekliyor', kaynak:kaynak||'manuel', kategori:kategori||'',
    asamalar:asamalar||[],
    odeme:{tutar:0,odenen:0,odendi:false,yontem:'',fatura_kesildi:false},
    kargo:{takip_no:'',firma:'',gonderim_tarihi:''},
  });

  // Müşteri rehberi güncelle
  const tel = musteri_telefon?.trim();
  if (tel) {
    await Musteri.findOneAndUpdate({telefon:tel},{$inc:{siparis_sayisi:1},$push:{siparis_idler:siparis._id.toString()},$set:{son_siparis:new Date().toISOString(),ad:musteri_adi,soyad:musteri_soyadi||''},$setOnInsert:{ilk_siparis:new Date().toISOString()}},{upsert:true,new:true});
  }
  return siparis;
}

// Tüm siparişler (admin/çalışan)
router.get('/', async (req, res) => {
  try {
    const hepsi = await Siparis.find().sort({teslim_tarihi:1});
    const aktif = hepsi.filter(s=>s.durum!=='teslim_edildi').map(s=>({...s.toObject(),id:s._id,...hesaplaOncelik(s.teslim_tarihi)}));
    const teslim_edilen = hepsi.filter(s=>s.durum==='teslim_edildi').map(s=>({...s.toObject(),id:s._id}));
    res.json({aktif,teslim_edilen});
  } catch(err){res.status(500).json({hata:err.message});}
});

// Müşterinin kendi siparişleri
router.get('/benim', async (req, res) => {
  try {
    const siparisler = await Siparis.find({musteri_user_id:req.kullanici.id}).sort({createdAt:-1});
    res.json(siparisler.map(s=>({...s.toObject(),id:s._id})));
  } catch(err){res.status(500).json({hata:err.message});}
});

// Admin sipariş oluştur
router.post('/', async (req, res) => {
  try {
    if (!req.body.musteri_adi) return res.status(400).json({hata:'Müşteri adı zorunlu'});
    const siparis = await olusturSiparis(req.body, req.kullanici);
    res.status(201).json({...siparis.toObject(),id:siparis._id});
  } catch(err){res.status(500).json({hata:err.message});}
});

// Müşteri sipariş oluştur
router.post('/musteri', async (req, res) => {
  try {
    if (req.kullanici.rol !== 'musteri') return res.status(403).json({hata:'Yetkisiz'});
    const body = {
      ...req.body,
      musteri_adi: req.kullanici.ad || req.kullanici.kullanici_adi,
      musteri_soyadi: req.kullanici.soyad || '',
      kaynak: 'musteri_paneli',
    };
    if (!body.musteri_adi) return res.status(400).json({hata:'Müşteri adı gerekli'});
    const siparis = await olusturSiparis(body, req.kullanici);
    res.status(201).json({...siparis.toObject(),id:siparis._id});
  } catch(err){res.status(500).json({hata:err.message});}
});

// Güncelle
router.put('/:id', async (req, res) => {
  try {
    const s = await Siparis.findByIdAndUpdate(req.params.id,req.body,{new:true});
    if (!s) return res.status(404).json({hata:'Bulunamadı'});
    res.json({...s.toObject(),id:s._id});
  } catch(err){res.status(500).json({hata:err.message});}
});

router.patch('/:id/durum', async (req, res) => {
  try {
    const g={durum:req.body.durum};
    if (req.body.durum==='teslim_edildi') g.teslim_edildi_tarihi=new Date().toISOString();
    const s=await Siparis.findByIdAndUpdate(req.params.id,g,{new:true});
    if (!s) return res.status(404).json({hata:'Bulunamadı'});
    res.json({...s.toObject(),id:s._id});
  } catch(err){res.status(500).json({hata:err.message});}
});

router.patch('/:id/odeme', async (req, res) => {
  try {
    const s=await Siparis.findByIdAndUpdate(req.params.id,{$set:{odeme:req.body}},{new:true});
    res.json({...s.toObject(),id:s._id});
  } catch(err){res.status(500).json({hata:err.message});}
});

router.patch('/:id/kargo', async (req, res) => {
  try {
    const s=await Siparis.findByIdAndUpdate(req.params.id,{$set:{kargo:req.body}},{new:true});
    res.json({...s.toObject(),id:s._id});
  } catch(err){res.status(500).json({hata:err.message});}
});

router.delete('/:id', async (req, res) => {
  try {
    await Siparis.findByIdAndDelete(req.params.id);
    res.json({mesaj:'Silindi'});
  } catch(err){res.status(500).json({hata:err.message});}
});

module.exports = router;
