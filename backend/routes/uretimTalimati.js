/**
 * "Üretim Talimatı" paneli - WooCommerce siparişlerini listeler, bir
 * siparişin üretim/kargo çıktısını (her varyasyon bir kutu + kargo etiketi)
 * hazırlar. Sadece OKUMA (WooCommerce'e yazma yok) + kargo etiket bilgisini
 * (firma/kargo no/desi/ağırlık) yerelde saklar.
 */
const express = require('express');
const router = express.Router();
const woo = require('../services/wooSiparis');
const KargoEtiket = require('../models/kargoEtiket');
const { Ayar } = require('../models');

const GONDERICI_ANAHTAR = 'uretim_talimati_gonderici';

function hataYaniti(res, e, varsayilan = 'Bir hata oluştu') {
  console.error('[UretimTalimati]', e.message);
  res.status(400).json({ hata: (woo.hataMetni ? woo.hataMetni(e) : null) || e.message || varsayilan });
}

router.get('/siparisler', async (req, res) => {
  try {
    const { ara, durum, sayfa } = req.query;
    res.json(await woo.siparisleriListele({ ara, durum, sayfa: parseInt(sayfa, 10) || 1 }));
  } catch (e) { hataYaniti(res, e, 'Siparişler alınamadı.'); }
});

router.get('/siparisler/:id', async (req, res) => {
  try {
    const siparis = await woo.siparisGetir(req.params.id);
    const etiket = await KargoEtiket.findOne({ wc_siparis_id: req.params.id });
    res.json({ ...siparis, kargo_etiket: etiket ? { firma: etiket.firma, kargo_no: etiket.kargo_no, desi: etiket.desi, agirlik: etiket.agirlik } : null });
  } catch (e) { hataYaniti(res, e, 'Sipariş alınamadı.'); }
});

router.put('/siparisler/:id/kargo-etiket', async (req, res) => {
  try {
    const { firma, kargo_no, desi, agirlik } = req.body;
    const guncel = await KargoEtiket.findOneAndUpdate(
      { wc_siparis_id: req.params.id },
      { firma: firma || '', kargo_no: kargo_no || '', desi: desi || '', agirlik: agirlik || '' },
      { upsert: true, new: true }
    );
    res.json({ firma: guncel.firma, kargo_no: guncel.kargo_no, desi: guncel.desi, agirlik: guncel.agirlik });
  } catch (e) { hataYaniti(res, e, 'Kaydedilemedi.'); }
});

// ----- Gönderici bilgisi (sabit, tüm etiketlerde aynı - burada bir kere girilir) -----

router.get('/gonderici', async (req, res) => {
  try {
    const ayar = await Ayar.findOne({ anahtar: GONDERICI_ANAHTAR });
    res.json(ayar ? ayar.deger : { ad: '', adres: '', telefon: '' });
  } catch (e) { hataYaniti(res, e); }
});

router.put('/gonderici', async (req, res) => {
  try {
    const { ad, adres, telefon } = req.body;
    await Ayar.findOneAndUpdate({ anahtar: GONDERICI_ANAHTAR }, { deger: { ad: ad || '', adres: adres || '', telefon: telefon || '' } }, { upsert: true });
    res.json({ mesaj: 'Kaydedildi' });
  } catch (e) { hataYaniti(res, e); }
});

module.exports = router;
