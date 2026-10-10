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

// Tüm sorunlu varyasyonları tek seferde düzeltir ("Tümünü Düzelt") - frontend
// zaten taramadan sahip olduğu listeyi gönderiyor, burada tekrar taramaya
// gerek yok.
router.post('/duzelt-hepsi', async (req, res) => {
  try {
    const ogeler = Array.isArray(req.body.ogeler)
      ? req.body.ogeler.map(o => ({ urun_id: Number(o.urun_id), varyasyon_id: Number(o.varyasyon_id) })).filter(o => o.urun_id && o.varyasyon_id)
      : [];
    if (!ogeler.length) return res.status(400).json({ hata: 'Düzeltilecek öğe yok.' });
    const sonuc = await denetim.coguluDuzelt(ogeler);
    res.json(sonuc);
  } catch (e) { hataYaniti(res, e, 'Toplu düzeltme başarısız oldu.'); }
});

module.exports = router;
