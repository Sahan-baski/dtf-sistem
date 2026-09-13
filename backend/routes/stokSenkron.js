/**
 * "Ortak Stok Senkron" paneli için AJAX değil, düz REST uçları (JWT ile korunur -
 * server.js'de authMiddleware zaten uygulanıyor). Her mutasyon isteğinden sonra
 * frontend ilgili havuzun GÜNCEL tablo verisini ayrıca GET /havuzlar/:id/tablo
 * ile çeker.
 */
const express = require('express');
const router = express.Router();
const { StokHavuzu, HavuzBedenStok, HavuzUrun, MasterTasarim } = require('../models/stokSenkron');
const motor = require('../services/stokMotoru');
const woo = require('../services/wooHelpers');

function hataYaniti(res, e, varsayilan = 'Bir hata oluştu') {
  console.error('[StokSenkron]', e.message);
  res.status(400).json({ hata: e.message || varsayilan });
}

// ----- Havuzlar -----

router.get('/havuzlar', async (req, res) => {
  try {
    const havuzlar = await StokHavuzu.find().sort({ createdAt: 1 });
    res.json(havuzlar);
  } catch (e) { hataYaniti(res, e); }
});

router.post('/havuzlar', async (req, res) => {
  try {
    const etiket = (req.body.etiket || '').trim();
    const bedenler = temizleBedenler(req.body.bedenler);
    if (!etiket || !bedenler.length) return res.status(400).json({ hata: 'Tablo adı ve en az bir beden gerekli.' });

    const havuz = await StokHavuzu.create({ etiket, bedenler });
    await Promise.all(bedenler.map(b => HavuzBedenStok.findOneAndUpdate({ havuz_id: havuz._id, beden: b }, { $setOnInsert: { miktar: 0 } }, { upsert: true })));
    res.status(201).json(havuz);
  } catch (e) { hataYaniti(res, e); }
});

router.put('/havuzlar/:id', async (req, res) => {
  try {
    const etiket = (req.body.etiket || '').trim();
    const bedenler = temizleBedenler(req.body.bedenler);
    if (!etiket || !bedenler.length) return res.status(400).json({ hata: 'Tablo adı ve en az bir beden gerekli.' });

    const havuz = await StokHavuzu.findByIdAndUpdate(req.params.id, { etiket, bedenler }, { new: true });
    if (!havuz) return res.status(404).json({ hata: 'Tablo bulunamadı.' });

    await Promise.all(bedenler.map(b => HavuzBedenStok.findOneAndUpdate({ havuz_id: havuz._id, beden: b }, { $setOnInsert: { miktar: 0 } }, { upsert: true })));

    // Beden listesi değiştiyse (yeni beden eklendiyse), mevcut ürünlerin
    // varyasyon eşlemesini yeni bedenler için yeniden tespit et.
    const urunler = await HavuzUrun.find({ havuz_id: havuz._id });
    for (const u of urunler) await motor.urunuHavuzaEkle(havuz._id, u.wc_urun_id);

    res.json(havuz);
  } catch (e) { hataYaniti(res, e); }
});

router.delete('/havuzlar/:id', async (req, res) => {
  try {
    await StokHavuzu.findByIdAndDelete(req.params.id);
    await HavuzBedenStok.deleteMany({ havuz_id: req.params.id });
    await HavuzUrun.deleteMany({ havuz_id: req.params.id });
    res.json({ mesaj: 'Silindi' });
  } catch (e) { hataYaniti(res, e); }
});

router.get('/havuzlar/:id/tablo', async (req, res) => {
  try {
    const tablo = await motor.tabloVerisi(req.params.id);
    if (!tablo) return res.status(404).json({ hata: 'Tablo bulunamadı.' });
    res.json(tablo);
  } catch (e) { hataYaniti(res, e); }
});

// ----- Havuz + beden ham stoğu -----

router.post('/havuzlar/:id/beden-stok', async (req, res) => {
  try {
    const { beden, miktar } = req.body;
    if (!beden || miktar === undefined || miktar === null) return res.status(400).json({ hata: 'Eksik bilgi.' });
    await motor.havuzHamStoguAyarla(req.params.id, beden, miktar);
    res.json(await motor.tabloVerisi(req.params.id, { besle: false }));
  } catch (e) { hataYaniti(res, e); }
});

// ----- Ürün ekleme / çıkarma -----

router.get('/wc-urunler', async (req, res) => {
  try {
    res.json(await woo.degiskenUrunAra(req.query.ara));
  } catch (e) { hataYaniti(res, e, 'WooCommerce ürünleri aranamadı.'); }
});

router.post('/havuzlar/:id/urun-ekle', async (req, res) => {
  try {
    const idler = Array.isArray(req.body.wc_urun_idler) ? req.body.wc_urun_idler.map(Number).filter(Boolean) : [];
    if (!idler.length) return res.status(400).json({ hata: 'En az bir ürün seçmelisin.' });

    let eklenen = 0;
    const hatalar = [];
    for (const id of idler) {
      try { await motor.urunuHavuzaEkle(req.params.id, id); eklenen++; }
      catch (e) { hatalar.push({ id, hata: woo.hataMetni(e) }); }
    }
    res.json({ eklenen, hatalar, tablo: await motor.tabloVerisi(req.params.id, { besle: false }) });
  } catch (e) { hataYaniti(res, e); }
});

router.delete('/havuzlar/:havuzId/urunler/:havuzUrunId', async (req, res) => {
  try {
    await motor.urunuHavuzdanCikar(req.params.havuzUrunId);
    res.json({ tablo: await motor.tabloVerisi(req.params.havuzId, { besle: false }) });
  } catch (e) { hataYaniti(res, e); }
});

// ----- Bir ürünü bir DTF kağıt/tasarım kaydına bağlama -----

router.post('/urunler/:havuzUrunId/tasarim-baglantisi', async (req, res) => {
  try {
    const havuzUrun = await HavuzUrun.findById(req.params.havuzUrunId);
    if (!havuzUrun) return res.status(404).json({ hata: 'Ürün bulunamadı.' });
    await motor.masterTasarimaBagla(req.params.havuzUrunId, req.body.master_tasarim_id || null);
    res.json({ tablo: await motor.tabloVerisi(havuzUrun.havuz_id, { besle: false }) });
  } catch (e) { hataYaniti(res, e); }
});

// ----- "Kağıt/Tasarım" master kayıtları -----

router.get('/master-tasarimlar', async (req, res) => {
  try { res.json(await MasterTasarim.find().sort({ ad: 1 })); }
  catch (e) { hataYaniti(res, e); }
});

router.post('/master-tasarimlar', async (req, res) => {
  try {
    const ad = (req.body.ad || '').trim();
    if (!ad) return res.status(400).json({ hata: 'Tasarım adı gerekli.' });
    const doc = await motor.masterTasarimOlustur(ad, req.body.stok || 0);
    res.status(201).json({ master_tasarim: doc, tablo: req.body.havuz_id ? await motor.tabloVerisi(req.body.havuz_id, { besle: false }) : null });
  } catch (e) { hataYaniti(res, e); }
});

router.put('/master-tasarimlar/:id', async (req, res) => {
  try {
    if (req.body.ad !== undefined) {
      const ad = (req.body.ad || '').trim();
      if (!ad) return res.status(400).json({ hata: 'Tasarım adı gerekli.' });
      await motor.masterTasarimAdDegistir(req.params.id, ad);
    }
    if (req.body.stok !== undefined) {
      await motor.masterTasarimStoguAyarla(req.params.id, req.body.stok);
    }
    res.json({ tablo: req.body.havuz_id ? await motor.tabloVerisi(req.body.havuz_id, { besle: false }) : null });
  } catch (e) { hataYaniti(res, e); }
});

router.delete('/master-tasarimlar/:id', async (req, res) => {
  try {
    await motor.masterTasarimSil(req.params.id);
    res.json({ tablo: req.query.havuz_id ? await motor.tabloVerisi(req.query.havuz_id, { besle: false }) : null });
  } catch (e) { hataYaniti(res, e); }
});

// ----- Test Satışı (gerçek bir sipariş olmadan simülasyon) -----

router.post('/urunler/:havuzUrunId/test-satisi', async (req, res) => {
  try {
    const havuzUrun = await HavuzUrun.findById(req.params.havuzUrunId);
    if (!havuzUrun) return res.status(404).json({ hata: 'Ürün bulunamadı.' });
    const { beden, adet } = req.body;
    if (!beden || !adet) return res.status(400).json({ hata: 'Eksik bilgi.' });
    await motor.satisUygula(req.params.havuzUrunId, beden, adet);
    res.json({ tablo: await motor.tabloVerisi(havuzUrun.havuz_id, { besle: false }) });
  } catch (e) { hataYaniti(res, e); }
});

function temizleBedenler(bedenler) {
  if (Array.isArray(bedenler)) return bedenler.map(b => String(b).trim()).filter(Boolean);
  if (typeof bedenler === 'string') return bedenler.split(',').map(b => b.trim()).filter(Boolean);
  return [];
}

module.exports = router;
