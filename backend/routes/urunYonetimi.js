/**
 * "Ürünler" paneli uçları - WooCommerce'de gerçek ürün oluşturma/listeleme/
 * silme + tekrar kullanılabilir "Varyasyon Grubu" (hazır beden listesi)
 * yönetimi. Not: bu, Siparişler/Müşteri Paneli'nin kullandığı eski yerel
 * /api/urunler ve /api/kategoriler uçlarından TAMAMEN AYRI ve bağımsızdır -
 * onlara hiç dokunmuyor.
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const woo = require('../services/wooUrun');
const VaryasyonGrubu = require('../models/varyasyonGrubu');
const BedenTablosu = require('../models/bedenTablosu');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });
const { sadeceEkip } = require('../middleware/rol');
// WooCommerce'de gerçek ürün oluşturma/silme - müşteri panelinden hiç
// kullanılmıyor, ekip-only.
router.use(sadeceEkip);

function hataYaniti(res, e, varsayilan = 'Bir hata oluştu') {
  console.error('[UrunYonetimi]', e.message);
  const metin = (woo.hataMetni ? woo.hataMetni(e) : null) || e.message || varsayilan;
  res.status(400).json({ hata: metin });
}

// ----- WooCommerce kategorileri -----

router.get('/kategoriler', async (req, res) => {
  try { res.json(await woo.kategorileriListele()); }
  catch (e) { hataYaniti(res, e, 'Kategoriler alınamadı.'); }
});

router.post('/kategoriler', async (req, res) => {
  try {
    const ad = (req.body.ad || '').trim();
    if (!ad) return res.status(400).json({ hata: 'Kategori adı gerekli.' });
    res.status(201).json(await woo.kategoriOlustur(ad));
  } catch (e) { hataYaniti(res, e, 'Kategori oluşturulamadı.'); }
});

// ----- Ürünler -----

router.get('/urunler', async (req, res) => {
  try {
    const { ara, kategori, sayfa } = req.query;
    res.json(await woo.urunleriListele({ ara, kategori, sayfa: parseInt(sayfa, 10) || 1 }));
  } catch (e) { hataYaniti(res, e, 'Ürünler alınamadı.'); }
});

router.post('/urunler', upload.single('resim'), async (req, res) => {
  try {
    const { ad, kategori_id, aciklama, fiyat, indirim_fiyat } = req.body;
    if (!ad || !ad.trim()) return res.status(400).json({ hata: 'Ürün adı gerekli.' });

    let bedenler = [];
    if (req.body.bedenler) {
      try { bedenler = JSON.parse(req.body.bedenler); } catch { bedenler = String(req.body.bedenler).split(',').map(b => b.trim()).filter(Boolean); }
    }

    let resimMediaId = null;
    if (req.file) {
      try {
        const yuklenen = await woo.resimYukle(req.file.buffer, req.file.originalname, req.file.mimetype);
        resimMediaId = yuklenen.id;
      } catch (e) {
        return res.status(400).json({ hata: `Görsel yüklenemedi: ${woo.wpHataMetni ? woo.wpHataMetni(e) : e.message}` });
      }
    }

    const urun = await woo.urunOlustur({
      ad: ad.trim(),
      kategoriId: kategori_id || null,
      aciklama: aciklama || '',
      fiyat,
      indirimFiyat: indirim_fiyat,
      bedenler,
      resimMediaId,
    });
    res.status(201).json(urun);
  } catch (e) { hataYaniti(res, e, 'Ürün oluşturulamadı.'); }
});

router.delete('/urunler/:id', async (req, res) => {
  try { await woo.urunSil(req.params.id, req.query.kalici === '1'); res.json({ mesaj: 'Silindi' }); }
  catch (e) { hataYaniti(res, e, 'Ürün silinemedi.'); }
});

// ----- Beden Tabloları (tekrar kullanılabilir, birden çok ürüne uygulanabilir görseller) -----

router.get('/beden-tablolari', async (req, res) => {
  try { res.json(await BedenTablosu.find().sort({ createdAt: -1 })); }
  catch (e) { hataYaniti(res, e); }
});

router.post('/beden-tablolari', upload.single('resim'), async (req, res) => {
  try {
    const ad = (req.body.ad || '').trim();
    if (!ad) return res.status(400).json({ hata: 'Beden tablosu adı gerekli.' });
    if (!req.file) return res.status(400).json({ hata: 'Görsel gerekli.' });

    let yuklenen;
    try { yuklenen = await woo.resimYukle(req.file.buffer, req.file.originalname, req.file.mimetype); }
    catch (e) { return res.status(400).json({ hata: `Görsel yüklenemedi: ${woo.wpHataMetni ? woo.wpHataMetni(e) : e.message}` }); }

    const kayit = await BedenTablosu.create({ ad, wp_media_id: yuklenen.id, url: yuklenen.url });
    res.status(201).json(kayit);
  } catch (e) { hataYaniti(res, e, 'Beden tablosu kaydedilemedi.'); }
});

router.delete('/beden-tablolari/:id', async (req, res) => {
  try { await BedenTablosu.findByIdAndDelete(req.params.id); res.json({ mesaj: 'Silindi' }); }
  catch (e) { hataYaniti(res, e); }
});

// Seçilen ürünlere (10-15 tanesine birden) bir beden tablosu görselini toplu uygular.
router.post('/urunler/beden-tablosu-uygula', async (req, res) => {
  try {
    const { urun_idler, beden_tablosu_id, aciklamaya_ekle, galeriye_ekle } = req.body;
    const idler = Array.isArray(urun_idler) ? urun_idler.map(Number).filter(Boolean) : [];
    if (!idler.length) return res.status(400).json({ hata: 'En az bir ürün seçmelisin.' });
    if (aciklamaya_ekle === false && galeriye_ekle === false) return res.status(400).json({ hata: 'Açıklama veya galeriden en az biri seçili olmalı.' });

    const tablo = await BedenTablosu.findById(beden_tablosu_id);
    if (!tablo) return res.status(404).json({ hata: 'Beden tablosu bulunamadı.' });

    const secenekler = { aciklamayaEkle: aciklamaya_ekle !== false, galeriyeEkle: galeriye_ekle !== false };

    let basarili = 0;
    const hatalar = [];
    for (const id of idler) {
      try { await woo.bedenTablosuUygula(id, { mediaId: tablo.wp_media_id, url: tablo.url }, secenekler); basarili++; }
      catch (e) { hatalar.push({ id, hata: woo.hataMetni ? woo.hataMetni(e) : e.message }); }
    }
    res.json({ basarili, toplam: idler.length, hatalar });
  } catch (e) { hataYaniti(res, e, 'Beden tablosu uygulanamadı.'); }
});

// ----- Varyasyon Grupları (hazır beden listeleri) -----

router.get('/varyasyon-gruplari', async (req, res) => {
  try { res.json(await VaryasyonGrubu.find().sort({ ad: 1 })); }
  catch (e) { hataYaniti(res, e); }
});

router.post('/varyasyon-gruplari', async (req, res) => {
  try {
    const ad = (req.body.ad || '').trim();
    const bedenler = temizleBedenler(req.body.bedenler);
    if (!ad || !bedenler.length) return res.status(400).json({ hata: 'Grup adı ve en az bir beden gerekli.' });
    res.status(201).json(await VaryasyonGrubu.create({ ad, bedenler }));
  } catch (e) { hataYaniti(res, e); }
});

router.put('/varyasyon-gruplari/:id', async (req, res) => {
  try {
    const ad = (req.body.ad || '').trim();
    const bedenler = temizleBedenler(req.body.bedenler);
    if (!ad || !bedenler.length) return res.status(400).json({ hata: 'Grup adı ve en az bir beden gerekli.' });
    const guncel = await VaryasyonGrubu.findByIdAndUpdate(req.params.id, { ad, bedenler }, { new: true });
    if (!guncel) return res.status(404).json({ hata: 'Grup bulunamadı.' });
    res.json(guncel);
  } catch (e) { hataYaniti(res, e); }
});

router.delete('/varyasyon-gruplari/:id', async (req, res) => {
  try { await VaryasyonGrubu.findByIdAndDelete(req.params.id); res.json({ mesaj: 'Silindi' }); }
  catch (e) { hataYaniti(res, e); }
});

function temizleBedenler(bedenler) {
  if (Array.isArray(bedenler)) return bedenler.map(b => String(b).trim()).filter(Boolean);
  if (typeof bedenler === 'string') return bedenler.split(',').map(b => b.trim()).filter(Boolean);
  return [];
}

module.exports = router;
