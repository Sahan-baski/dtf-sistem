const express = require('express');
const router = express.Router();
const { Siparis } = require('../models');

router.get('/', async (req, res) => {
  try {
    const siparisler = await Siparis.find().sort({ createdAt: 1 });
    const bugun = new Date(); bugun.setHours(0,0,0,0);

    // Son 12 ay ciro
    const aylikMap = {};
    for (let i = 11; i >= 0; i--) {
      const d = new Date(bugun); d.setDate(1); d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      aylikMap[key] = { ay: key, toplam: 0, tahsil: 0, siparis: 0 };
    }

    const kategoriMap = {};
    const musteriMap = {};
    let toplamCiro = 0, tahsilEdilen = 0, perakende = 0, toptan = 0;
    let bekleyenTahsilat = 0;

    siparisler.forEach(s => {
      const tutar = s.odeme?.tutar || 0;
      const odendi = s.odeme?.odendi || false;
      const tarih = new Date(s.createdAt);
      const ayKey = `${tarih.getFullYear()}-${String(tarih.getMonth()+1).padStart(2,'0')}`;

      if (aylikMap[ayKey]) {
        aylikMap[ayKey].toplam += tutar;
        aylikMap[ayKey].siparis += 1;
        if (odendi) aylikMap[ayKey].tahsil += tutar;
      }

      toplamCiro += tutar;
      if (odendi) tahsilEdilen += tutar;
      else bekleyenTahsilat += tutar;

      // Kategori
      const kat = s.kategori || 'diger';
      if (!kategoriMap[kat]) kategoriMap[kat] = { kat, ciro: 0, siparis: 0 };
      kategoriMap[kat].ciro += tutar;
      kategoriMap[kat].siparis += 1;

      // Müşteri
      const telefon = s.musteri_telefon || '';
      const ad = `${s.musteri_adi || ''} ${s.musteri_soyadi || ''}`.trim();
      const mKey = telefon || ad;
      if (!musteriMap[mKey]) musteriMap[mKey] = { ad, telefon, ciro: 0, siparis: 0 };
      musteriMap[mKey].ciro += tutar;
      musteriMap[mKey].siparis += 1;

      // Perakende/Toptan
      if (s.satis_tipi === 'perakende' || s.kaynak === 'musteri_paneli' || s.kaynak === 'shopier') perakende += tutar;
      else if (s.satis_tipi === 'toptan') toptan += tutar;
    });

    // Bu ay vs geçen ay karşılaştırma
    const aylar = Object.values(aylikMap);
    const buAy = aylar[aylar.length - 1];
    const gecenAy = aylar[aylar.length - 2];
    const buyume = gecenAy?.toplam > 0 ? ((buAy?.toplam - gecenAy?.toplam) / gecenAy?.toplam * 100).toFixed(1) : 0;

    res.json({
      aylikCiro: aylar.map(a => ({
        ...a,
        ay: new Date(a.ay + '-01').toLocaleDateString('tr-TR', { month:'short', year:'2-digit' })
      })),
      kategoriCiro: Object.values(kategoriMap).sort((a,b) => b.ciro-a.ciro).slice(0,10),
      topMusteriler: Object.values(musteriMap).sort((a,b) => b.ciro-a.ciro).slice(0,10),
      ozet: {
        toplamCiro, tahsilEdilen, bekleyenTahsilat,
        toplamSiparis: siparisler.length,
        ortalamaFiyat: siparisler.length > 0 ? Math.round(toplamCiro / siparisler.length) : 0,
        perakende, toptan, buyume: parseFloat(buyume),
        buAyCiro: buAy?.toplam || 0,
        gecenAyCiro: gecenAy?.toplam || 0,
      }
    });
  } catch (err) { res.status(500).json({ hata: err.message }); }
});

module.exports = router;
