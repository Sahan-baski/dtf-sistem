const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', (req, res) => {
  db.read();
  const bugun = new Date();
  bugun.setHours(0, 0, 0, 0);
  const bugunStr = bugun.toISOString().split('T')[0];

  const haftaSonu = new Date(bugun);
  haftaSonu.setDate(haftaSonu.getDate() + 7);

  const siparisler = db.data.siparisler || [];
  const aktif = siparisler.filter(s => s.durum !== 'teslim_edildi');

  // Bugün teslim edilecekler
  const bugunTeslim = aktif.filter(s => s.teslim_tarihi === bugunStr);

  // Gecikmiş
  const gecikmis = aktif.filter(s => {
    if (!s.teslim_tarihi) return false;
    return new Date(s.teslim_tarihi) < bugun;
  });

  // Bu hafta
  const buHafta = aktif.filter(s => {
    if (!s.teslim_tarihi) return false;
    const t = new Date(s.teslim_tarihi);
    return t >= bugun && t <= haftaSonu;
  });

  // Ödeme bekleyenler
  const odemeBekleyen = aktif.filter(s => !s.odeme?.odendi);

  // Hazır ama teslim edilmemiş
  const hazirBekliyor = aktif.filter(s => s.durum === 'hazir');

  // Bu ay gelir
  const buAy = new Date(bugun.getFullYear(), bugun.getMonth(), 1);
  const buAyGelir = siparisler
    .filter(s => s.odeme?.odendi && s.odeme?.odeme_tarihi >= buAy.toISOString())
    .reduce((t, s) => t + (s.odeme?.tutar || 0), 0);

  // Bekleyen tahsilat
  const bekleyenTahsilat = aktif
    .reduce((t, s) => t + ((s.odeme?.tutar || 0) - (s.odeme?.odenen || 0)), 0);

  // Aşamaları bekleyen işler (tamamlanmamış aşamaları olan siparişler)
  const asamaBekleyen = aktif.filter(s =>
    s.asamalar?.some(a => !a.tamamlandi)
  ).map(s => ({
    id: s.id,
    siparis_no: s.siparis_no,
    musteri: `${s.musteri_adi} ${s.musteri_soyadi}`,
    bekleyen_asama: s.asamalar?.find(a => !a.tamamlandi)?.label || '',
    teslim_tarihi: s.teslim_tarihi,
    oncelik: s.oncelik || 'normal'
  })).slice(0, 10);

  res.json({
    bugunTeslim: bugunTeslim.length,
    gecikmis: gecikmis.length,
    buHafta: buHafta.length,
    odemeBekleyen: odemeBekleyen.length,
    hazirBekliyor: hazirBekliyor.length,
    buAyGelir,
    bekleyenTahsilat,
    aktifSiparis: aktif.length,
    asamaBekleyen,
    bugunTeslimListesi: bugunTeslim.map(s => ({
      id: s.id,
      siparis_no: s.siparis_no,
      musteri: `${s.musteri_adi} ${s.musteri_soyadi}`,
      durum: s.durum,
      kategori: s.kategori
    })),
    gecikmisList: gecikmis.map(s => ({
      id: s.id,
      siparis_no: s.siparis_no,
      musteri: `${s.musteri_adi} ${s.musteri_soyadi}`,
      teslim_tarihi: s.teslim_tarihi,
      durum: s.durum
    }))
  });
});

module.exports = router;
