/**
 * "Siparişler" paneli - site (WooCommerce) + Shopier siparişleri, Basit Kargo
 * durumuyla birleştirilmiş tek liste. Ekip (admin + çalışan) erişir; Shopier
 * anahtarını sadece admin girer.
 */
const express = require('express');
const router = express.Router();
const { sadeceEkip, sadeceAdmin } = require('../middleware/rol');
const PlatformSiparis = require('../models/platformSiparis');
const { Ayar } = require('../models');
const senkron = require('../services/siparisSenkron');
const shopier = require('../services/shopierClient');
const basitKargo = require('../services/basitKargoClient');

router.use(sadeceEkip);

const ACIK = ['hazirlanacak', 'kargoya_hazir'];

router.get('/', async (req, res) => {
  try {
    const { durum, kaynak, ara, gun } = req.query;
    const f = {};
    if (durum === 'acik') f.durum = { $in: ACIK };
    else if (durum) f.durum = { $in: String(durum).split(',') };
    if (kaynak) f.kaynak = kaynak;
    if (gun) f.tarih = { $gte: new Date(Date.now() - parseInt(gun, 10) * 86400000) };
    if (ara) {
      const r = new RegExp(String(ara).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      f.$or = [{ numara: r }, { 'musteri.ad_soyad': r }, { 'musteri.telefon': r }, { 'kargo.takip_no': r }, { 'kalemler.ad': r }];
    }
    // Açık (hazırlanacak) siparişler en eskiden yeniye - önce gelen önce hazırlanır.
    const sira = durum === 'acik' || durum === 'hazirlanacak' ? { tarih: 1 } : { tarih: -1 };
    const [liste, sayilar] = await Promise.all([
      PlatformSiparis.find(f).sort(sira).limit(500).lean(),
      PlatformSiparis.aggregate([{ $group: { _id: '$durum', sayi: { $sum: 1 } } }]),
    ]);
    res.json({
      siparisler: liste,
      sayilar: Object.fromEntries(sayilar.map(x => [x._id, x.sayi])),
      senkron: senkron.durumBilgisi,
    });
  } catch (e) { console.error('[SiparisSenkron]', e.message); res.status(500).json({ hata: 'Siparişler alınamadı' }); }
});

router.post('/senkronla', async (req, res) => {
  try { res.json(await senkron.senkronla()); }
  catch (e) { console.error('[SiparisSenkron]', e.message); res.status(500).json({ hata: `Senkron başarısız: ${e.message}` }); }
});

// Talimatı yazdırılan siparişleri işaretle (listede "basıldı" görünür, tekrar basılmasın diye).
router.post('/talimat-basildi', async (req, res) => {
  try {
    const idler = Array.isArray(req.body.idler) ? req.body.idler.slice(0, 500) : [];
    await PlatformSiparis.updateMany({ _id: { $in: idler } }, { $set: { talimat_basildi: new Date() } });
    res.json({ guncellenen: idler.length });
  } catch (e) { res.status(500).json({ hata: 'İşaretlenemedi' }); }
});

router.get('/ayarlar', async (req, res) => {
  try {
    res.json({
      shopier_token_girildi: !!(await shopier.token()),
      basit_kargo_token_var: basitKargo.tokenVar(),
    });
  } catch (e) { res.status(500).json({ hata: 'Alınamadı' }); }
});

router.put('/ayarlar', sadeceAdmin, async (req, res) => {
  try {
    if (req.body.shopier_token !== undefined) {
      await Ayar.findOneAndUpdate({ anahtar: 'entegrasyon_shopier' }, { deger: { token: String(req.body.shopier_token || '').trim() } }, { upsert: true });
    }
    res.json({ shopier_token_girildi: !!(await shopier.token()) });
  } catch (e) { res.status(500).json({ hata: 'Kaydedilemedi' }); }
});

module.exports = router;
