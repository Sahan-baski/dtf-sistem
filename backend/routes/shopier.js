const express = require('express');
const router = express.Router();
const { Ayar } = require('../models');
router.post('/cek', async (req,res) => { res.json({mesaj:'Shopier bağlantısı yapılandırılmamış', eklenen:0}); });
module.exports = router;
