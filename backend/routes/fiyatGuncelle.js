/**
 * "Fiyat Güncelle" paneli - WooCommerce'deki TÜM ürünleri listeler, bedene
 * özel ayrım olmadan tek bir satış + indirimli fiyat girilip anında
 * WooCommerce'e yazılır (değişken ürünlerde tüm varyasyonlara birden).
 */
const express = require('express');
const router = express.Router();
const woo = require('../services/wooFiyat');

function hataYaniti(res, e, varsayilan = 'Bir hata oluştu') {
  console.error('[FiyatGuncelle]', e.message);
  res.status(400).json({ hata: woo.hataMetni ? woo.hataMetni(e) : (e.message || varsayilan) });
}

router.get('/urunler', async (req, res) => {
  try {
    const { ara, kategori, sayfa } = req.query;
    const sonuc = await woo.urunleriListele({ ara, kategori, sayfa: parseInt(sayfa, 10) || 1 });
    res.json(sonuc);
  } catch (e) { hataYaniti(res, e, 'Ürünler alınamadı.'); }
});

router.get('/kategoriler', async (req, res) => {
  try { res.json(await woo.kategorileriListele()); }
  catch (e) { hataYaniti(res, e, 'Kategoriler alınamadı.'); }
});

router.put('/urunler/:id/fiyat', async (req, res) => {
  try {
    const { tur, fiyat, indirim_fiyat } = req.body;
    if (!tur) return res.status(400).json({ hata: 'Eksik bilgi.' });
    const sonuc = await woo.urunFiyatGuncelle(req.params.id, tur, { fiyat, indirim_fiyat });
    res.json(sonuc);
  } catch (e) { hataYaniti(res, e, 'Fiyat güncellenemedi.'); }
});

module.exports = router;
