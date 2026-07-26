const express = require('express');
const router = express.Router();
const axios = require('axios');
const { Siparis, Ayar } = require('../models');

async function getAyar(key, varsayilan) {
  const a = await Ayar.findOne({ anahtar: key });
  return a ? a.deger : varsayilan;
}

router.post('/cek', async (req, res) => {
  try {
    const api_key = await getAyar('shopier_api_key', '');
    const api_secret = await getAyar('shopier_api_secret', '');
    if (!api_key || !api_secret)
      return res.status(400).json({ hata: 'Shopier API bilgileri eksik. Ayarlardan girin.' });

    const response = await axios.get('https://www.shopier.com/ShowExternallyData/api/?', {
      params: { data: JSON.stringify({ APIKey: api_key, APISecret: api_secret, action: 'get_orders', status: 1 }) }
    });
    const shopierData = response.data;
    if (!shopierData || shopierData.result !== 'success')
      return res.status(400).json({ hata: 'Shopier yanıt hatası' });

    const mevcutlar = await Siparis.find({ kaynak: 'shopier' }).select('dis_siparis_no');
    const mevcutSet = new Set(mevcutlar.map(s => s.dis_siparis_no));

    let yeniSayisi = 0;
    const varsayilanGun = await getAyar('varsayilan_teslim_gun', 3);

    for (const order of (shopierData.orders || [])) {
      const siparisNo = String(order.order_id || order.id);
      if (mevcutSet.has(siparisNo)) continue;
      const t = new Date(); t.setDate(t.getDate() + varsayilanGun);
      await Siparis.create({
        siparis_no: 'SP' + siparisNo, dis_siparis_no: siparisNo,
        musteri_adi: order.buyer_name || '', musteri_soyadi: order.buyer_surname || '',
        musteri_telefon: order.buyer_phone || '', musteri_adres: order.shipping_address || '',
        urunler: (order.items || []).map(i => ({ ad: i.product_name || i.name || 'Ürün', adet: i.quantity || 1, fiyat: i.price || 0 })),
        notlar: order.note || '', teslim_tarihi: t.toISOString().split('T')[0],
        durum: 'bekliyor', kaynak: 'shopier', kategori: '', asamalar: [],
        odeme: { tutar: 0, odenen: 0, odendi: false, yontem: '', fatura_kesildi: false },
        kargo: { takip_no: '', firma: '', gonderim_tarihi: '' },
      });
      yeniSayisi++;
    }
    res.json({ mesaj: `${yeniSayisi} yeni sipariş eklendi`, toplam: shopierData.orders?.length || 0 });
  } catch (err) { res.status(500).json({ hata: 'Shopier bağlantı hatası', detay: err.message }); }
});

router.post('/ayarlar', async (req, res) => {
  try {
    const { shopier_api_key, shopier_api_secret, varsayilan_teslim_gun } = req.body;
    if (shopier_api_key) await Ayar.findOneAndUpdate({ anahtar: 'shopier_api_key' }, { deger: shopier_api_key }, { upsert: true });
    if (shopier_api_secret) await Ayar.findOneAndUpdate({ anahtar: 'shopier_api_secret' }, { deger: shopier_api_secret }, { upsert: true });
    if (varsayilan_teslim_gun) await Ayar.findOneAndUpdate({ anahtar: 'varsayilan_teslim_gun' }, { deger: parseInt(varsayilan_teslim_gun) }, { upsert: true });
    res.json({ mesaj: 'Ayarlar kaydedildi' });
  } catch (err) { res.status(500).json({ hata: err.message }); }
});

router.get('/ayarlar', async (req, res) => {
  try {
    const keys = ['shopier_api_key', 'shopier_api_secret', 'varsayilan_teslim_gun'];
    const ayarlar = {};
    for (const k of keys) ayarlar[k] = await getAyar(k, k === 'varsayilan_teslim_gun' ? 3 : '');
    res.json(ayarlar);
  } catch (err) { res.status(500).json({ hata: err.message }); }
});

module.exports = router;
