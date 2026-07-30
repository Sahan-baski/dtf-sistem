const express = require('express');
const router = express.Router();
const Urun = require('../models/Urun');
router.get('/', async (req,res) => { try { const f=req.query.kategori?{kategori_key:req.query.kategori}:{}; res.json(await Urun.find(f).sort({sira:1,createdAt:1})); } catch(e){res.status(500).json({hata:e.message});} });
router.post('/', async (req,res) => { try { const {kategori_key,ad,aciklama,fiyat,ozellikler}=req.body; if(!kategori_key||!ad)return res.status(400).json({hata:'Zorunlu alanlar eksik'}); const sayi=await Urun.countDocuments({kategori_key}); res.status(201).json(await Urun.create({kategori_key,ad,aciklama:aciklama||'',fiyat:fiyat||0,ozellikler:ozellikler||[],sira:sayi})); } catch(e){res.status(500).json({hata:e.message});} });
router.put('/:id', async (req,res) => { try { res.json(await Urun.findByIdAndUpdate(req.params.id,req.body,{new:true})); } catch(e){res.status(500).json({hata:e.message});} });
router.patch('/:id/toggle', async (req,res) => { try { const u=await Urun.findById(req.params.id); u.aktif=!u.aktif; await u.save(); res.json(u); } catch(e){res.status(500).json({hata:e.message});} });
router.delete('/:id', async (req,res) => { try { await Urun.findByIdAndDelete(req.params.id); res.json({mesaj:'Silindi'}); } catch(e){res.status(500).json({hata:e.message});} });
module.exports = router;
