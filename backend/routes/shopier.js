const express = require('express');
const router = express.Router();
const { Ayar } = require('../models');
const { sadeceEkip } = require('../middleware/rol');
// Şu an devre dışı bir stub, ama ileride gerçek ödeme senkronu için
// kullanılacağından ileriye dönük olarak ekip-only kilitlendi.
router.use(sadeceEkip);
router.post('/cek', async (req,res) => { res.json({mesaj:'Shopier bağlantısı yapılandırılmamış', eklenen:0}); });
module.exports = router;
