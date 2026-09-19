/**
 * WooCommerce'den gelen sipariş webhook'u - bir sipariş "processing" ya da
 * "completed" durumuna geldiğinde, o siparişteki her satır için ortak stok
 * havuzundan (ve varsa bağlı DTF kağıt/tasarım stoğundan) otomatik düşer.
 *
 * WooCommerce tarafında kurulum: WooCommerce → Ayarlar → Gelişmiş → Webhooklar
 *   Konu (Topic):     Sipariş güncellendi (Order updated)
 *   Teslimat URL'i:   https://<render-adresin>/api/webhooks/woocommerce/siparis
 *   Gizli Anahtar:    WC_WEBHOOK_SECRET ortam değişkeniyle AYNI değer
 *
 * Bu uçta JWT auth YOK (WooCommerce token'ımızı bilmiyor) - onun yerine
 * WooCommerce'in gönderdiği HMAC-SHA256 imzasını (x-wc-webhook-signature)
 * doğruluyoruz. server.js, ham (parse edilmemiş) gövdeyi req.rawBody olarak
 * saklıyor - imza kontrolü onun üzerinden yapılıyor.
 */
const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { IslenmisSiparis } = require('../models/stokSenkron');
const motor = require('../services/stokMotoru');

// WooCommerce, webhook'u ilk oluştururken/etkinleştirirken içeriksiz bir "ping"
// isteği de gönderir - bunun için de 200 dönmemiz gerekir.
const SAYILAN_DURUMLAR = ['processing', 'completed'];

function imzaGecerliMi(req) {
  const gizliAnahtar = process.env.WC_WEBHOOK_SECRET;
  if (!gizliAnahtar) {
    console.warn('[StokSenkron/Webhook] WC_WEBHOOK_SECRET ayarlanmamış - imza doğrulaması ATLANIYOR (güvenli değil, lütfen ayarlayın).');
    return true;
  }
  const gelenImza = req.headers['x-wc-webhook-signature'];
  if (!gelenImza || !req.rawBody) return false;
  const hesaplanan = crypto.createHmac('sha256', gizliAnahtar).update(req.rawBody).digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(gelenImza), Buffer.from(hesaplanan));
  } catch {
    return false;
  }
}

router.post('/siparis', async (req, res) => {
  if (!imzaGecerliMi(req)) {
    console.warn('[StokSenkron/Webhook] Geçersiz imza, istek reddedildi.');
    return res.status(401).json({ hata: 'Geçersiz imza' });
  }

  const siparis = req.body;
  if (!siparis || !siparis.id) {
    return res.json({ atlandi: true, sebep: 'Boş/ping isteği' }); // webhook aktivasyon testi
  }

  try {
    if (!SAYILAN_DURUMLAR.includes(siparis.status)) {
      return res.json({ atlandi: true, sebep: `Durum "${siparis.status}" sayılmıyor` });
    }

    // NOT: önce "işlendi mi?" diye OKUYUP sonra kaydı YAZMAK yerine, ikisini
    // tek adımda (atomik) yapıyoruz. Eskisi, WooCommerce aynı sipariş için
    // webhook'u neredeyse aynı anda iki kez gönderirse (bu olabiliyor), her
    // ikisinin de "henüz işlenmemiş" görüp siparişi İKİ KEZ stoktan
    // düşürmesine yol açabiliyordu. wc_siparis_id üzerindeki tekil (unique)
    // indeks sayesinde bu "iddia et" adımı veritabanı seviyesinde güvenli.
    const oncekiKayit = await IslenmisSiparis.findOneAndUpdate(
      { wc_siparis_id: siparis.id },
      { $setOnInsert: { wc_siparis_id: siparis.id, islenme_tarihi: new Date() } },
      { upsert: true, new: false }
    );
    if (oncekiKayit) {
      return res.json({ atlandi: true, sebep: 'Bu sipariş zaten işlenmiş' });
    }

    let dusulenSatir = 0;
    for (const satir of siparis.line_items || []) {
      if (!satir.variation_id) continue;
      const eslesme = await motor.varyasyonIdIleBul(satir.variation_id);
      if (!eslesme) continue;
      await motor.satisUygula(eslesme.havuzUrunId, eslesme.beden, satir.quantity);
      dusulenSatir++;
    }

    res.json({ islendi: true, dusulenSatir });
  } catch (e) {
    console.error('[StokSenkron/Webhook] Sipariş işlenemedi:', e.message);
    res.status(500).json({ hata: e.message });
  }
});

module.exports = router;
