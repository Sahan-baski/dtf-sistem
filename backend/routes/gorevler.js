const express = require('express');
const router = express.Router();
const { Gorev } = require('../models');
router.get('/', async (req,res) => { try { res.json(await Gorev.find().sort({tamamlandi:1,createdAt:-1})); } catch(e){res.status(500).json({hata:e.message});} });
router.post('/', async (req,res) => { try { res.status(201).json(await Gorev.create(req.body)); } catch(e){res.status(500).json({hata:e.message});} });
router.patch('/:id/tamamla', async (req,res) => { try { const g=await Gorev.findById(req.params.id); g.tamamlandi=!g.tamamlandi; g.tamamlanma_tarihi=g.tamamlandi?new Date().toISOString():''; await g.save(); res.json(g); } catch(e){res.status(500).json({hata:e.message});} });
router.delete('/:id', async (req,res) => { try { await Gorev.findByIdAndDelete(req.params.id); res.json({mesaj:'Silindi'}); } catch(e){res.status(500).json({hata:e.message});} });
module.exports = router;
