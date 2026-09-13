/**
 * "Üretim Talimatı" paneli - WooCommerce siparişlerini listeler, bir
 * siparişin üretim/kargo çıktısını (her varyasyon bir kutu + kargo etiketi)
 * hazırlar. Sadece OKUMA (WooCommerce'e yazma yok) + kargo etiket bilgisini
 * (firma/kargo no/desi/ağırlık) yerelde saklar.
 */
const express = require('express');
const router = express.Router();
const woo = require('../services/wooSiparis');
const basitKargo = require('../services/basitKargoClient');
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
    res.json({
      ...siparis,
      kargo_etiket: etiket ? {
        firma: etiket.firma, firma_kodu: etiket.firma_kodu, kargo_no: etiket.kargo_no,
        basit_kargo_id: etiket.basit_kargo_id,
        yukseklik: etiket.yukseklik, genislik: etiket.genislik, derinlik: etiket.derinlik, agirlik: etiket.agirlik,
      } : null,
    });
  } catch (e) { hataYaniti(res, e, 'Sipariş alınamadı.'); }
});

router.put('/siparisler/:id/kargo-etiket', async (req, res) => {
  try {
    const { firma, firma_kodu, kargo_no, basit_kargo_id, yukseklik, genislik, derinlik, agirlik } = req.body;
    const guncel = await KargoEtiket.findOneAndUpdate(
      { wc_siparis_id: req.params.id },
      {
        firma: firma || '', firma_kodu: firma_kodu || '', kargo_no: kargo_no || '',
        basit_kargo_id: basit_kargo_id || '',
        yukseklik: yukseklik || '', genislik: genislik || '', derinlik: derinlik || '', agirlik: agirlik || '',
      },
      { upsert: true, new: true }
    );
    res.json({
      firma: guncel.firma, firma_kodu: guncel.firma_kodu, kargo_no: guncel.kargo_no,
      basit_kargo_id: guncel.basit_kargo_id,
      yukseklik: guncel.yukseklik, genislik: guncel.genislik, derinlik: guncel.derinlik, agirlik: guncel.agirlik,
    });
  } catch (e) { hataYaniti(res, e, 'Kaydedilemedi.'); }
});

// ----- Basit Kargo entegrasyonu -----

router.get('/kargo-firmalari', async (req, res) => {
  try {
    res.json(await basitKargo.firmalariListele());
  } catch (e) {
    console.error('[UretimTalimati] Basit Kargo firma listesi hatası:', e.message);
    res.status(400).json({ hata: (basitKargo.hataMetni ? basitKargo.hataMetni(e) : null) || e.message || 'Kargo firmaları alınamadı.' });
  }
});

// GERÇEK bir kargo gönderisi + kod/barkod oluşturur - geri alınamaz. Bu yüzden
// sadece kullanıcı panelden alıcı bilgilerini onaylayıp elle tıkladığında çağrılmalı.
router.post('/siparisler/:id/kargo-kodu-olustur', async (req, res) => {
  try {
    const { handlerCode, paket, alici } = req.body;
    if (!handlerCode) return res.status(400).json({ hata: 'Kargo firması seçilmedi.' });

    const yukseklik = Number(paket?.yukseklik), genislik = Number(paket?.genislik);
    const derinlik = Number(paket?.derinlik), agirlik = Number(paket?.agirlik);
    if (!(yukseklik > 0 && genislik > 0 && derinlik > 0 && agirlik > 0)) {
      return res.status(400).json({ hata: 'Paket yükseklik, genişlik, derinlik ve ağırlık değerleri sıfırdan büyük olmalı - Basit Kargo boş/sıfır ölçülerde hata veriyor.' });
    }

    const siparis = await woo.siparisGetir(req.params.id);
    const sonuc = await basitKargo.siparisVeKoduOlustur({
      handlerCode,
      siparisNo: siparis.numara,
      urunler: siparis.kutular.map(k => ({ ad: k.ad, kod: k.kod, adet: k.adet })),
      paket: paket || {},
      alici: alici || siparis.alici,
    });

    const guncel = await KargoEtiket.findOneAndUpdate(
      { wc_siparis_id: req.params.id },
      {
        firma: sonuc.firmaAdi || '',
        firma_kodu: sonuc.firmaKodu || handlerCode,
        kargo_no: sonuc.kargoNo || '',
        basit_kargo_id: sonuc.basitKargoId != null ? String(sonuc.basitKargoId) : '',
        yukseklik: paket?.yukseklik || '', genislik: paket?.genislik || '',
        derinlik: paket?.derinlik || '', agirlik: paket?.agirlik || '',
      },
      { upsert: true, new: true }
    );

    res.json({ ...sonuc, etiket: guncel });
  } catch (e) {
    console.error('[UretimTalimati] Basit Kargo kod oluşturma hatası:', e.message);
    res.status(400).json({ hata: (basitKargo.hataMetni ? basitKargo.hataMetni(e) : null) || e.message || 'Kargo kodu oluşturulamadı.' });
  }
});

// Basit Kargo'nun kendi hazır barkod etiketini (SVG) getirir - kod
// oluşturulduktan sonra yazdırma alanında doğrudan bu gömülür.
router.get('/siparisler/:id/kargo-etiket-svg', async (req, res) => {
  try {
    const etiket = await KargoEtiket.findOne({ wc_siparis_id: req.params.id });
    if (!etiket?.basit_kargo_id) return res.status(404).json({ hata: 'Bu sipariş için Basit Kargo etiketi henüz oluşturulmamış.' });
    const svg = await basitKargo.etiketSvgGetir(etiket.basit_kargo_id);
    res.json({ svg });
  } catch (e) {
    console.error('[UretimTalimati] Etiket SVG hatası:', e.message);
    res.status(400).json({ hata: (basitKargo.hataMetni ? basitKargo.hataMetni(e) : null) || e.message || 'Etiket alınamadı.' });
  }
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
