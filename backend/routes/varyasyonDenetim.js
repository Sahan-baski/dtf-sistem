/**
 * "Varyasyon Görsel Denetimi" - müşteri şikayeti üzerine eklendi: "ürünü
 * sepete eklerken görseli değişiyor". Bkz. services/varyasyonGorselDenetimi.js
 * dosyasının başındaki açıklama - kök neden ve çözüm orada detaylandırıldı.
 */
const express = require('express');
const router = express.Router();
const { sadeceEkip } = require('../middleware/rol');
const denetim = require('../services/varyasyonGorselDenetimi');
const woo = require('../services/wooHelpers');

router.use(sadeceEkip);

function hataYaniti(res, e, varsayilan = 'Bir hata oluştu') {
  console.error('[VaryasyonDenetim]', e.message);
  res.status(400).json({ hata: woo.hataMetni ? woo.hataMetni(e) : (e.message || varsayilan) });
}

// Tüm katalogu tarar - ürünün kendi galerisinde olmayan (başka bir üründen
// sızmış) varyasyon görsellerini bulur. Yüzlerce ürün varsa biraz sürebilir.
router.get('/tara', async (req, res) => {
  try {
    const sorunlu = await denetim.taraYanlisVaryasyonGorselleri();
    res.json({ sorunlu, taranan_zaman: new Date().toISOString() });
  } catch (e) { hataYaniti(res, e, 'Tarama başarısız oldu.'); }
});

// Tek bir varyasyonun yanlış görselini kaldırır.
router.post('/duzelt', async (req, res) => {
  try {
    const urunId = Number(req.body.urun_id);
    const varyasyonId = Number(req.body.varyasyon_id);
    if (!urunId || !varyasyonId) return res.status(400).json({ hata: 'Eksik bilgi.' });
    await denetim.varyasyonGorseliniKaldir(urunId, varyasyonId);
    res.json({ duzeltildi: true });
  } catch (e) { hataYaniti(res, e, 'Düzeltilemedi.'); }
});

module.exports = router;
