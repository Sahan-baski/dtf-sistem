# dtf-sistem

## Ortak Stok Senkron modülü

WooCommerce (mirasgiyim.com) ile bu uygulama arasında, ayrı bir WordPress eklentisine ihtiyaç duymadan çalışan beden bazlı ortak stok havuzu + DTF kağıt/tasarım stoğu senkronu. Menüden **Stok Senkron**.

Kurulum:

1. `backend/.env.example` dosyasını `backend/.env` olarak kopyala, `WC_SITE_URL`, `WC_CONSUMER_KEY`, `WC_CONSUMER_SECRET`, `WC_WEBHOOK_SECRET` alanlarını doldur.
   - Consumer Key/Secret: WooCommerce → Ayarlar → Gelişmiş → REST API → Anahtar Ekle (Yetki: Okuma/Yazma).
   - Render'da aynı 4 değeri Environment sekmesinden de ekle (production için).
2. Sipariş tamamlandığında stoğun OTOMATİK düşmesi için: WooCommerce → Ayarlar → Gelişmiş → Webhooklar → Webhook Ekle:
   - Konu: **Sipariş güncellendi**
   - Teslimat URL'i: `https://<render-adresin>/api/webhooks/woocommerce/siparis`
   - Gizli Anahtar: `.env`'deki `WC_WEBHOOK_SECRET` ile birebir aynı değer
   - Durum: Aktif
3. `guncelle.bat` ile derleyip GitHub'a gönder, Render otomatik deploy eder.
