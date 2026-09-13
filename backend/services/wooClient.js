/**
 * WooCommerce REST API'ye bağlanan tek noktalı axios istemcisi. WordPress
 * eklentisine hiç ihtiyaç duymadan, sitenin kendi yerleşik WooCommerce REST
 * API'siyle (WC_SITE_URL + Consumer Key/Secret) konuşuyoruz.
 *
 * Gerekli ortam değişkenleri (.env / Render → Environment):
 *   WC_SITE_URL         ör. https://mirasgiyim.com
 *   WC_CONSUMER_KEY     WooCommerce → Ayarlar → Gelişmiş → REST API'den alınır
 *   WC_CONSUMER_SECRET  aynı yerden
 */
const axios = require('axios');

let _client = null;

function client() {
  if (_client) return _client;

  const siteUrl = (process.env.WC_SITE_URL || '').replace(/\/+$/, '');
  const key = process.env.WC_CONSUMER_KEY || '';
  const secret = process.env.WC_CONSUMER_SECRET || '';

  if (!siteUrl || !key || !secret) {
    throw new Error('WooCommerce bağlantı bilgileri eksik: WC_SITE_URL / WC_CONSUMER_KEY / WC_CONSUMER_SECRET ortam değişkenlerini ayarlayın.');
  }

  _client = axios.create({
    baseURL: `${siteUrl}/wp-json/wc/v3`,
    auth: { username: key, password: secret },
    timeout: 20000,
  });
  return _client;
}

function siteUrl() {
  return (process.env.WC_SITE_URL || '').replace(/\/+$/, '');
}

/** axios hatasını okunabilir, WooCommerce'in kendi mesajını içeren bir metne çevirir. */
function hataMetni(e) {
  const wcMesaj = e.response?.data?.message;
  if (wcMesaj) return `WooCommerce: ${wcMesaj}`;
  if (e.code === 'ECONNABORTED') return 'WooCommerce isteği zaman aşımına uğradı.';
  if (e.response) return `WooCommerce HTTP ${e.response.status} hatası.`;
  return e.message || 'Bilinmeyen WooCommerce hatası.';
}

module.exports = { client, siteUrl, hataMetni };
