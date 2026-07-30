const express = require('express');
const router = express.Router();
const { Kategori } = require('../models');
const SISTEM = [
  {key:'tisort_baskili',label:'Tişört (baskılı)',grup:'Baskılı Ürün',renk:'#2ecc8f',sistem:true,sira:1},
  {key:'tisort_baskisiz',label:'Tişört (baskısız)',grup:'Baskılı Ürün',renk:'#2ecc8f',sistem:true,sira:2},
  {key:'sweat_baskili',label:'Sweatshirt (baskılı)',grup:'Baskılı Ürün',renk:'#2ecc8f',sistem:true,sira:3},
  {key:'sweat_baskisiz',label:'Sweatshirt (baskısız)',grup:'Baskılı Ürün',renk:'#2ecc8f',sistem:true,sira:4},
  {key:'is_montu',label:'İş Montu',grup:'Baskılı Ürün',renk:'#2ecc8f',sistem:true,sira:5},
  {key:'sapka',label:'Şapka',grup:'Baskılı Ürün',renk:'#2ecc8f',sistem:true,sira:6},
  {key:'buzgulu_kese',label:'Büzgülü Kese',grup:'Baskılı Ürün',renk:'#2ecc8f',sistem:true,sira:7},
  {key:'buzgulu_sirt',label:'Büzgülü Sırt Çantası',grup:'Baskılı Ürün',renk:'#2ecc8f',sistem:true,sira:8},
  {key:'kol_cantasi',label:'Kol Çantası',grup:'Baskılı Ürün',renk:'#2ecc8f',sistem:true,sira:9},
  {key:'dtf_katalog',label:'DTF – Katalogdan',grup:'DTF Baskı',renk:'#4f7ef8',sistem:true,sira:10},
  {key:'dtf_hazirlama',label:'DTF – Hazırlama',grup:'DTF Baskı',renk:'#4f7ef8',sistem:true,sira:11},
  {key:'dtf_pdf',label:'DTF – Hazır PDF',grup:'DTF Baskı',renk:'#4f7ef8',sistem:true,sira:12},
  {key:'press_hizmet',label:'Pressleme Hizmeti',grup:'Hizmet',renk:'#f0a500',sistem:true,sira:13},
  {key:'baski_press',label:'Baskı + Pressleme',grup:'Hizmet',renk:'#f0a500',sistem:true,sira:14},
];
async function seed() { if(!(await Kategori.countDocuments())) await Kategori.insertMany(SISTEM); }
router.get('/', async (req,res) => { try { await seed(); res.json(await Kategori.find({aktif:true}).sort({sira:1})); } catch(e){res.status(500).json({hata:e.message});} });
router.post('/', async (req,res) => { try { const {label,grup,renk}=req.body; if(!label)return res.status(400).json({hata:'İsim zorunlu'}); const key=label.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'')+'_'+Date.now(); const sayi=await Kategori.countDocuments(); res.status(201).json(await Kategori.create({key,label,grup:grup||'Özel',renk:renk||'#7f8c8d',sistem:false,sira:sayi})); } catch(e){res.status(500).json({hata:e.message});} });
router.put('/:id', async (req,res) => { try { res.json(await Kategori.findByIdAndUpdate(req.params.id,req.body,{new:true})); } catch(e){res.status(500).json({hata:e.message});} });
router.delete('/:id', async (req,res) => { try { const k=await Kategori.findById(req.params.id); if(!k)return res.status(404).json({hata:'Bulunamadı'}); if(k.sistem)return res.status(400).json({hata:'Sistem kategorisi silinemez'}); await Kategori.findByIdAndDelete(req.params.id); res.json({mesaj:'Silindi'}); } catch(e){res.status(500).json({hata:e.message});} });
module.exports = router;
