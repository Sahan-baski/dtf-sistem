const express = require('express');
const router = express.Router();
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

// Shopier'den siparişleri çek ve sisteme ekle
router.post('/cek', async (req, res) => {
  db.read();
  const { shopier_api_key, shopier_api_secret } = db.data.ayarlar;

  if (!shopier_api_key || !shopier_api_secret) {
    return res.status(400).json({ hata: 'Shopier API bilgileri eksik. Ayarlardan girin.' });
  }

  try {
    // Shopier API çağrısı
    const response = await axios.get('https://www.shopier.com/ShowExternallyData/api/?', {
      params: {
        data: JSON.stringify({
          APIKey: shopier_api_key,
          APISecret: shopier_api_secret,
          action: 'get_orders',
          status: 1 // Ödeme bekleyen + ödenen
        })
      }
    });

    const shopierData = response.data;
    if (!shopierData || shopierData.result !== 'success') {
      return res.status(400).json({ hata: 'Shopier yanıt hatası', detay: shopierData });
    }

    const mevcutSiparisNolari = new Set(
      db.data.siparisler.filter(s => s.kaynak === 'shopier').map(s => s.dis_siparis_no)
    );

    let yeniSayisi = 0;
    const bugun = new Date();
    const varsayilanGun = db.data.ayarlar.varsayilan_teslim_gun || 3;

    for (const order of (shopierData.orders || [])) {
      const siparisNo = String(order.order_id || order.id);
      if (mevcutSiparisNolari.has(siparisNo)) continue;

      const teslimTarihi = new Date(bugun);
      teslimTarihi.setDate(teslimTarihi.getDate() + varsayilanGun);

      const urunler = (order.items || []).map(item => ({
        ad: item.product_name || item.name || 'Ürün',
        adet: item.quantity || 1,
        fiyat: item.price || 0
      }));

      const siparis = {
        id: uuidv4(),
        siparis_no: 'SP' + siparisNo,
        dis_siparis_no: siparisNo,
        musteri_adi: order.buyer_name || order.name || '',
        musteri_soyadi: order.buyer_surname || order.surname || '',
        musteri_telefon: order.buyer_phone || '',
        musteri_adres: order.shipping_address || '',
        urunler,
        notlar: order.note || '',
        teslim_tarihi: teslimTarihi.toISOString().split('T')[0],
        durum: 'bekliyor',
        kaynak: 'shopier',
        olusturma_tarihi: bugun.toISOString()
      };

      db.data.siparisler.push(siparis);
      yeniSayisi++;
    }

    db.write();
    res.json({ mesaj: `${yeniSayisi} yeni sipariş eklendi`, toplam: shopierData.orders?.length || 0 });

  } catch (err) {
    res.status(500).json({ hata: 'Shopier bağlantı hatası', detay: err.message });
  }
});

// Shopier API bilgilerini kaydet
router.post('/ayarlar', (req, res) => {
  db.read();
  const { shopier_api_key, shopier_api_secret, varsayilan_teslim_gun } = req.body;
  if (shopier_api_key) db.data.ayarlar.shopier_api_key = shopier_api_key;
  if (shopier_api_secret) db.data.ayarlar.shopier_api_secret = shopier_api_secret;
  if (varsayilan_teslim_gun) db.data.ayarlar.varsayilan_teslim_gun = parseInt(varsayilan_teslim_gun);
  db.write();
  res.json({ mesaj: 'Ayarlar kaydedildi' });
});

router.get('/ayarlar', (req, res) => {
  db.read();
  res.json(db.data.ayarlar);
});

module.exports = router;
