/**
 * WordPress'in kendi REST API'sine (WooCommerce'in değil - medya/görsel
 * yükleme WooCommerce REST API'sinde yok, WP'nin kendi /wp-json/wp/v2
 * uçlarında) bağlanan istemci. WooCommerce Consumer Key/Secret'tan TAMAMEN
 * FARKLI bir kimlik bilgisi gerekir: bir WordPress "Uygulama Şifresi"
 * (Kullanıcılar → Profilim → Uygulama Şifreleri).
 *
 * Gerekli ortam değişkenleri (.env / Render → Environment):
 *   WP_KULLANICI_ADI     WordPress'te giriş yaptığın kullanıcı adı
 *   WP_UYGULAMA_SIFRESI  "Uygulama Şifreleri" bölümünden oluşturulan şifre
 */
const axios = require('axios');

let _client = null;

function client() {
  if (_client) return _client;

  const siteUrl = (process.env.WC_SITE_URL || '').replace(/\/+$/, '');
  const kullanici = process.env.WP_KULLANICI_ADI || '';
  const sifre = process.env.WP_UYGULAMA_SIFRESI || '';

  if (!siteUrl || !kullanici || !sifre) {
    throw new Error('WordPress medya bağlantı bilgileri eksik: WP_KULLANICI_ADI / WP_UYGULAMA_SIFRESI ortam değişkenlerini ayarlayın (WooCommerce anahtarlarından farklıdır).');
  }

  _client = axios.create({
    baseURL: `${siteUrl}/wp-json/wp/v2`,
    auth: { username: kullanici, password: sifre },
    timeout: 30000,
  });
  return _client;
}

/** axios hatasını okunabilir bir metne çevirir. */
function hataMetni(e) {
  const wpMesaj = e.response?.data?.message;
  if (wpMesaj) return `WordPress: ${wpMesaj}`;
  if (e.code === 'ECONNABORTED') return 'WordPress isteği zaman aşımına uğradı.';
  if (e.response) return `WordPress HTTP ${e.response.status} hatası.`;
  return e.message || 'Bilinmeyen WordPress hatası.';
}

module.exports = { client, hataMetni };
