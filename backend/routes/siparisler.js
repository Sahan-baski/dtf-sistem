const express = require('express');
const router = express.Router();
const { Siparis, Musteri, Ayar } = require('../models');

async function olusturSiparis(body, kullanici) {
  const kapAyar = await Ayar.findOne({ anahtar:'gunluk_press_kapasitesi' });
  const kapasite = kapAyar ? kapAyar.deger : 180;
  let { musteri_adi, musteri_soyadi, musteri_telefon, urunler, notlar, teslim_tarihi, kaynak, kategori, asamalar, baski_yonu, satis_tipi, press_sayisi } = body;
  if (!press_sayisi) {
    const adet = urunler?.[0]?.adet || 1;
    press_sayisi = baski_yonu==='cift_yon'?adet*2:baski_yonu==='tek_yon'?adet:0;
  }
  if (!teslim_tarihi) {
    const aktif = await Siparis.find({ durum:{$ne:'teslim_edildi'} }).select('teslim_tarihi press_sayisi');
    const gunYuk = {};
    aktif.forEach(s => { if (s.teslim_tarihi&&s.press_sayisi>0) gunYuk[s.teslim_tarihi]=(gunYuk[s.teslim_tarihi]||0)+s.press_sayisi; });
    const bugun = new Date(); bugun.setHours(0,0,0,0);
    for (let gun=2; gun<=60; gun++) {
      const d = new Date(bugun); d.setDate(d.getDate()+gun);
      const tarih = d.toISOString().split('T')[0];
      if ((gunYuk[tarih]||0)+press_sayisi<=kapasite) { teslim_tarihi=tarih; break; }
    }
  }
  if (!teslim_tarihi) { const d=new Date(); d.setDate(d.getDate()+2); teslim_tarihi=d.toISOString().split('T')[0]; }
  const siparis = await Siparis.create({
    siparis_no:'S'+Date.now().toString().slice(-6),
    musteri_adi, musteri_soyadi:musteri_soyadi||'', musteri_telefon:musteri_telefon||'',
    musteri_user_id: kullanici?.rol==='musteri'?kullanici.id:null,
    urunler:urunler||[], notlar:notlar||'', teslim_tarihi, press_sayisi, baski_yonu:baski_yonu||'',
    satis_tipi:satis_tipi||'', durum:'bekliyor', kaynak:kaynak||'manuel', kategori:kategori||'',
    asamalar:asamalar||[], odeme:{tutar:0,odenen:0,odendi:false}, kargo:{},
  });
  const tel = musteri_telefon?.trim();
  if (tel) await Musteri.findOneAndUpdate({telefon:tel},{$inc:{siparis_sayisi:1},$push:{siparis_idler:siparis._id.toString()},$set:{son_siparis:new Date().toISOString(),ad:musteri_adi,soyad:musteri_soyadi||''},$setOnInsert:{ilk_siparis:new Date().toISOString()}},{upsert:true,new:true});
  return siparis;
}

function hesaplaKalan(teslimTarihi) {
  if (!teslimTarihi) return null;
  const b=new Date(); b.setHours(0,0,0,0);
  return Math.ceil((new Date(teslimTarihi+'T00:00:00')-b)/(1000*60*60*24));
}

router.get('/', async (req,res) => {
  try {
    const hepsi = await Siparis.find().sort({teslim_tarihi:1});
    const aktif = hepsi.filter(s=>s.durum!=='teslim_edildi').map(s=>({...s.toObject(),id:s._id,kalan_gun:hesaplaKalan(s.teslim_tarihi)}));
    const teslim_edilen = hepsi.filter(s=>s.durum==='teslim_edildi').map(s=>({...s.toObject(),id:s._id}));
    res.json({aktif,teslim_edilen});
  } catch(err){res.status(500).json({hata:err.message});}
});

router.get('/benim', async (req,res) => {
  try {
    const list = await Siparis.find({musteri_user_id:req.kullanici.id}).sort({createdAt:-1});
    res.json(list.map(s=>({...s.toObject(),id:s._id})));
  } catch(err){res.status(500).json({hata:err.message});}
});

router.post('/', async (req,res) => {
  try {
    if (!req.body.musteri_adi) return res.status(400).json({hata:'Müşteri adı zorunlu'});
    const s = await olusturSiparis(req.body,req.kullanici);
    res.status(201).json({...s.toObject(),id:s._id});
  } catch(err){res.status(500).json({hata:err.message});}
});

router.post('/musteri', async (req,res) => {
  try {
    if (req.kullanici.rol!=='musteri') return res.status(403).json({hata:'Yetkisiz'});
    const body = {...req.body, musteri_adi:req.kullanici.ad||req.kullanici.kullanici_adi, musteri_soyadi:req.kullanici.soyad||'', kaynak:'musteri_paneli'};
    const s = await olusturSiparis(body,req.kullanici);
    res.status(201).json({...s.toObject(),id:s._id});
  } catch(err){res.status(500).json({hata:err.message});}
});

router.put('/:id', async (req,res) => {
  try { const s=await Siparis.findByIdAndUpdate(req.params.id,req.body,{new:true}); res.json({...s.toObject(),id:s._id}); }
  catch(err){res.status(500).json({hata:err.message});}
});
router.patch('/:id/durum', async (req,res) => {
  try { const g={durum:req.body.durum}; if(req.body.durum==='teslim_edildi')g.teslim_edildi_tarihi=new Date().toISOString(); const s=await Siparis.findByIdAndUpdate(req.params.id,g,{new:true}); res.json({...s.toObject(),id:s._id}); }
  catch(err){res.status(500).json({hata:err.message});}
});
router.patch('/:id/odeme', async (req,res) => {
  try { const s=await Siparis.findByIdAndUpdate(req.params.id,{$set:{odeme:req.body}},{new:true}); res.json({...s.toObject(),id:s._id}); }
  catch(err){res.status(500).json({hata:err.message});}
});
router.patch('/:id/kargo', async (req,res) => {
  try { const s=await Siparis.findByIdAndUpdate(req.params.id,{$set:{kargo:req.body}},{new:true}); res.json({...s.toObject(),id:s._id}); }
  catch(err){res.status(500).json({hata:err.message});}
});
router.delete('/:id', async (req,res) => {
  try { await Siparis.findByIdAndDelete(req.params.id); res.json({mesaj:'Silindi'}); }
  catch(err){res.status(500).json({hata:err.message});}
});
module.exports = router;
