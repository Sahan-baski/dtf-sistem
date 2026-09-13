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

## Fiyat Güncelle modülü

Aynı WooCommerce bağlantısını (yukarıdaki 4 ortam değişkeni) kullanır, ayrı bir kurulum gerekmez. Menüden **Fiyat Güncelle** — mağazadaki tüm ürünler (arama/kategori filtreli) tek bir tabloda listelenir, her ürün için tek bir satış fiyatı ve isteğe bağlı bir indirimli fiyat girilir (beden bazlı ayrım yoktur). Değişken (bedenli) bir ürünün fiyatı kaydedildiğinde, aynı fiyat o ürünün TÜM varyasyonlarına tek seferde (toplu istekle) yazılır.

## Ürünler modülü (WooCommerce ürün yönetimi)

Menüden **Ürünler** — mağazadaki (mirasgiyim.com) ürünleri doğrudan buradan listeler, yeni ürün ekler, siler. Panelden eklenen bir ürün **anında sitede yayınlanır**, WooCommerce paneline tekrar girmeye gerek kalmaz.

Kurulum (yukarıdaki 4 WooCommerce değişkenine ek olarak, sadece görsel yükleme için):

1. WordPress'te (mirasgiyim.com/wp-admin) → **Kullanıcılar → Profilim** → sayfanın altında **Uygulama Şifreleri** bölümü → bir isim yaz (ör. "DTF Sistem") → **Yeni Uygulama Şifresi Ekle**. Oluşan şifreyi kopyala (boşluklarıyla birlikte, sadece bir kez gösterilir).
2. `backend/.env` (ve Render → Environment) içine ekle:
   - `WP_KULLANICI_ADI` — WordPress'e giriş yaptığın kullanıcı adı
   - `WP_UYGULAMA_SIFRESI` — 1. adımda oluşturduğun şifre

Ürün eklerken:
- Kategori mevcut WooCommerce kategorilerinden seçilir ya da yeni bir isim yazılıp anında WooCommerce'de yeni kategori olarak oluşturulur.
- "Bedenli ürün" işaretlenirse, daha önce **Varyasyon Grupları** panelinden oluşturulmuş hazır bir beden listesi (ör. "Çocuk Grubu 1": 3-4,5-6,7-8,9-10,11-12,13-14,15-16 veya "Yetişkin Grubu": S,M,L,XL,XXL,XXXL) seçilip, ürüne özel olarak elle de değiştirilebilir. Ürün, bu bedenlerin her biri için bir varyasyon içeren "değişken" bir WooCommerce ürünü olarak oluşturulur.
- Bu modül; Siparişler sayfası ve Müşteri Paneli'nin kullandığı eski yerel ürün/kategori listesinden (fason/toptan sipariş oluşturmak için kullanılan) tamamen ayrıdır, onlara dokunmaz.

## Üretim Talimatı modülü

Menüden **Üretim Talimatı** — WooCommerce siparişlerini listeler, bir sipariş açıldığında içindeki her ürün/beden için bir üretim kutucuğu (görsel + beden + adet) ve bir kargo etiketi içeren, A4 genişliğinde yazdırılabilir bir sayfa hazırlar.

Kargo no elle de girilebilir; Basit Kargo entegrasyonu kurulursa panelden **gerçek bir kargo kodu/barkodu** oluşturulabilir (tek tıkla, onay panelinden alıcı bilgileri kontrol edildikten sonra):

1. Basit Kargo hesabı → API/MCP token'ları bölümünden bir token oluştur.
2. `backend/.env` (ve Render → Environment) içine ekle:
   - `BASIT_KARGO_TOKEN` — 1. adımda oluşturduğun token
3. Token girilmezse "Basit Kargo ile Kod Oluştur" ve kargo firması listesi çalışmaz; kargo no/firma/paket bilgileri yine elle girilip kaydedilebilir ve üretim talimatına yansır.

⚠️ Bu token GERÇEK kargo gönderileri oluşturabilir. Koda veya Git'e asla gömülmemeli, sadece `.env` ve Render'ın Environment ayarlarında durmalı.
