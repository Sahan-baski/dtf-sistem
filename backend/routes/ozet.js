const express = require('express');
const router = express.Router();
const { Siparis } = require('../models');

router.get('/', async (req, res) => {
  try {
    const bugun = new Date(); bugun.setHours(0,0,0,0);
    const bugunStr = bugun.toISOString().split('T')[0];
    const haftaSonu = new Date(bugun); haftaSonu.setDate(haftaSonu.getDate() + 7);

    const aktif = await Siparis.find({ durum: { $ne: 'teslim_edildi' } });

    const bugunTeslim = aktif.filter(s => s.teslim_tarihi === bugunStr);
    const gecikmis = aktif.filter(s => s.teslim_tarihi && new Date(s.teslim_tarihi) < bugun);
    const buHafta = aktif.filter(s => {
      if (!s.teslim_tarihi) return false;
      const t = new Date(s.teslim_tarihi);
      return t >= bugun && t <= haftaSonu;
    });

    const odemeBekleyen = aktif.filter(s => !s.odeme?.odendi).length;
    const hazirBekliyor = aktif.filter(s => s.durum === 'hazir').length;

    const buAy = new Date(bugun.getFullYear(), bugun.getMonth(), 1);
    const odenenler = await Siparis.find({ 'odeme.odendi': true, 'odeme.odeme_tarihi': { $gte: buAy.toISOString() } });
    const buAyGelir = odenenler.reduce((t, s) => t + (s.odeme?.tutar || 0), 0);
    const bekleyenTahsilat = aktif.reduce((t, s) => t + ((s.odeme?.tutar || 0) - (s.odeme?.odenen || 0)), 0);

    const asamaBekleyen = aktif
      .filter(s => s.asamalar?.some(a => !a.tamamlandi))
      .slice(0, 10)
      .map(s => ({
        id: s._id, siparis_no: s.siparis_no,
        musteri: `${s.musteri_adi} ${s.musteri_soyadi || ''}`.trim(),
        bekleyen_asama: s.asamalar?.find(a => !a.tamamlandi)?.label || '',
        teslim_tarihi: s.teslim_tarihi
      }));

    res.json({
      bugunTeslim: bugunTeslim.length,
      gecikmis: gecikmis.length,
      buHafta: buHafta.length,
      odemeBekleyen,
      hazirBekliyor,
      buAyGelir,
      bekleyenTahsilat,
      aktifSiparis: aktif.length,
      asamaBekleyen,
      bugunTeslimListesi: bugunTeslim.map(s => ({
        id: s._id, siparis_no: s.siparis_no,
        musteri: `${s.musteri_adi} ${s.musteri_soyadi || ''}`.trim(),
        durum: s.durum, kategori: s.kategori
      })),
      gecikmisList: gecikmis.map(s => ({
        id: s._id, siparis_no: s.siparis_no,
        musteri: `${s.musteri_adi} ${s.musteri_soyadi || ''}`.trim(),
        teslim_tarihi: s.teslim_tarihi, durum: s.durum
      }))
    });
  } catch (err) { res.status(500).json({ hata: err.message }); }
});

module.exports = router;
