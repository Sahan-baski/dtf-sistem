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

    // DOĞRULAMA: eskiden fiyat/indirim_fiyat hiç kontrol edilmeden doğrudan
    // WooCommerce'e (değişken ürünlerde TÜM bedenlere birden) yazılıyordu -
    // ör. bir arayüz hatası ya da yanlışlıkla girilen negatif/harfli bir
    // değer, sitede anında yanlış/negatif bir fiyat olarak yayına girebilirdi.
    // Şimdi: sayı olmalı, negatif olamaz, indirimli fiyat normal fiyattan
    // yüksek/eşit olamaz (boş bırakmak - indirim kaldırmak - hâlâ serbest).
    const sayiMi = (v) => v === '' || v === undefined || v === null || (!isNaN(parseFloat(v)) && isFinite(v));
    if (!sayiMi(fiyat) || !sayiMi(indirim_fiyat)) return res.status(400).json({ hata: 'Fiyat sayısal bir değer olmalı.' });
    const f = fiyat === '' || fiyat === undefined || fiyat === null ? null : parseFloat(fiyat);
    const i = indirim_fiyat === '' || indirim_fiyat === undefined || indirim_fiyat === null ? null : parseFloat(indirim_fiyat);
    if (f !== null && f < 0) return res.status(400).json({ hata: 'Fiyat negatif olamaz.' });
    if (i !== null && i < 0) return res.status(400).json({ hata: 'İndirimli fiyat negatif olamaz.' });
    if (f !== null && i !== null && i >= f) return res.status(400).json({ hata: 'İndirimli fiyat, normal fiyattan düşük olmalı.' });

    const sonuc = await woo.urunFiyatGuncelle(req.params.id, tur, { fiyat, indirim_fiyat });
    res.json(sonuc);
  } catch (e) { hataYaniti(res, e, 'Fiyat güncellenemedi.'); }
});

module.exports = router;
