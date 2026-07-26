const express = require('express');
const router = express.Router();
const { Siparis, Musteri } = require('../models');

function hesaplaOncelik(teslimTarihi) {
  if (!teslimTarihi) return { oncelik: 'normal', kalan_gun: null };
  const bugun = new Date(); bugun.setHours(0,0,0,0);
  const teslim = new Date(teslimTarihi); teslim.setHours(0,0,0,0);
  const kalanGun = Math.ceil((teslim - bugun) / (1000*60*60*24));
  let oncelik = 'normal';
  if (kalanGun <= 1) oncelik = 'acil';
  else if (kalanGun <= 4) oncelik = 'yakin';
  return { oncelik, kalan_gun: kalanGun };
}

router.get('/', async (req, res) => {
  try {
    const hepsi = await Siparis.find().sort({ teslim_tarihi: 1 });
    const aktif = hepsi
      .filter(s => s.durum !== 'teslim_edildi')
      .map(s => ({ ...s.toObject(), id: s._id, ...hesaplaOncelik(s.teslim_tarihi) }));
    const teslim_edilen = hepsi
      .filter(s => s.durum === 'teslim_edildi')
      .map(s => ({ ...s.toObject(), id: s._id }));
    res.json({ aktif, teslim_edilen });
  } catch (err) { res.status(500).json({ hata: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { musteri_adi, musteri_soyadi, musteri_telefon, urunler, notlar,
            teslim_tarihi, kaynak, kategori, asamalar } = req.body;
    if (!musteri_adi) return res.status(400).json({ hata: 'Müşteri adı zorunlu' });

    let teslimTarihi = teslim_tarihi;
    if (!teslimTarihi) {
      const t = new Date(); t.setDate(t.getDate() + 3);
      teslimTarihi = t.toISOString().split('T')[0];
    }

    const siparis = await Siparis.create({
      siparis_no: 'S' + Date.now().toString().slice(-6),
      musteri_adi, musteri_soyadi: musteri_soyadi || '',
      musteri_telefon: musteri_telefon || '',
      urunler: urunler || [], notlar: notlar || '',
      teslim_tarihi: teslimTarihi,
      durum: 'bekliyor', kaynak: kaynak || 'manuel',
      kategori: kategori || '', asamalar: asamalar || [],
      odeme: { tutar:0, odenen:0, odendi:false, yontem:'', fatura_kesildi:false },
      kargo: { takip_no:'', firma:'', gonderim_tarihi:'' },
    });

    // Müşteri rehberi güncelle
    const telefon = musteri_telefon?.trim();
    if (telefon) {
      await Musteri.findOneAndUpdate(
        { telefon },
        { $inc: { siparis_sayisi: 1 }, $push: { siparis_idler: siparis._id.toString() },
          $set: { son_siparis: new Date().toISOString(), ad: musteri_adi, soyad: musteri_soyadi || '' },
          $setOnInsert: { ilk_siparis: new Date().toISOString() } },
        { upsert: true, new: true }
      );
    } else if (musteri_adi) {
      await Musteri.create({ ad: musteri_adi, soyad: musteri_soyadi || '',
        telefon: '', siparis_sayisi: 1, siparis_idler: [siparis._id.toString()],
        ilk_siparis: new Date().toISOString(), son_siparis: new Date().toISOString() });
    }

    res.status(201).json({ ...siparis.toObject(), id: siparis._id });
  } catch (err) { res.status(500).json({ hata: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const s = await Siparis.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!s) return res.status(404).json({ hata: 'Bulunamadı' });
    res.json({ ...s.toObject(), id: s._id });
  } catch (err) { res.status(500).json({ hata: err.message }); }
});

router.patch('/:id/durum', async (req, res) => {
  try {
    const guncelleme = { durum: req.body.durum };
    if (req.body.durum === 'teslim_edildi') guncelleme.teslim_edildi_tarihi = new Date().toISOString();
    const s = await Siparis.findByIdAndUpdate(req.params.id, guncelleme, { new: true });
    if (!s) return res.status(404).json({ hata: 'Bulunamadı' });
    res.json({ ...s.toObject(), id: s._id });
  } catch (err) { res.status(500).json({ hata: err.message }); }
});

router.patch('/:id/odeme', async (req, res) => {
  try {
    const s = await Siparis.findByIdAndUpdate(req.params.id,
      { $set: { odeme: req.body } }, { new: true });
    if (!s) return res.status(404).json({ hata: 'Bulunamadı' });
    res.json({ ...s.toObject(), id: s._id });
  } catch (err) { res.status(500).json({ hata: err.message }); }
});

router.patch('/:id/kargo', async (req, res) => {
  try {
    const s = await Siparis.findByIdAndUpdate(req.params.id,
      { $set: { kargo: req.body } }, { new: true });
    if (!s) return res.status(404).json({ hata: 'Bulunamadı' });
    res.json({ ...s.toObject(), id: s._id });
  } catch (err) { res.status(500).json({ hata: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await Siparis.findByIdAndDelete(req.params.id);
    res.json({ mesaj: 'Silindi' });
  } catch (err) { res.status(500).json({ hata: err.message }); }
});

module.exports = router;
