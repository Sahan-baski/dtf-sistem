const express = require('express');
const router = express.Router();
const { Musteri } = require('../models');
router.get('/', async (req,res) => { try { res.json(await Musteri.find().sort({siparis_sayisi:-1})); } catch(e){res.status(500).json({hata:e.message});} });
router.put('/:id', async (req,res) => { try { res.json(await Musteri.findByIdAndUpdate(req.params.id,req.body,{new:true})); } catch(e){res.status(500).json({hata:e.message});} });
module.exports = router;
