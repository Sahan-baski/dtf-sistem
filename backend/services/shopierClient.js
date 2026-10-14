/**
 * Shopier REST API istemcisi (https://api.shopier.com/v1) - siparişleri okumak için.
 * Kimlik: Shopier → Hesap Yönetimi → Kişisel Erişim Anahtarı (önce iki adımlı
 * doğrulama açık olmalı). Anahtar panelden girilir (Ayar: entegrasyon_shopier)
 * ya da SHOPIER_TOKEN ortam değişkeninden okunur.
 */
const axios = require('axios');
const { Ayar } = require('../models');

async function token() {
  const a = await Ayar.findOne({ anahtar: 'entegrasyon_shopier' }).lean();
  return (a && a.deger && a.deger.token) || process.env.SHOPIER_TOKEN || '';
}

function hataMetni(e) {
  const d = e.response && e.response.data;
  const m = d && (d.message || d.error || (Array.isArray(d.errors) && d.errors[0] && (d.errors[0].message || d.errors[0])));
  if (m) return `Shopier: ${typeof m === 'string' ? m : JSON.stringify(m)}`;
  if (e.response) return `Shopier HTTP ${e.response.status} hatası`;
  return e.message || 'Shopier bağlantı hatası';
}

/** Verilen tarihten (YYYY-MM-DD) bu yana tüm siparişler - sayfa sayfa. */
async function siparisleriGetir(baslangicGunu) {
  const t = await token();
  if (!t) return null; // ayarlanmamış
  const istemci = axios.create({ baseURL: 'https://api.shopier.com/v1', headers: { Authorization: `Bearer ${t}`, Accept: 'application/json' }, timeout: 20000 });
  const hepsi = [];
  for (let sayfa = 1; sayfa <= 40; sayfa++) {
    const { data, headers } = await istemci.get('/orders', { params: { page: sayfa, limit: 50, dateStart: baslangicGunu } });
    const liste = Array.isArray(data) ? data : (data && (data.data || data.orders || data.items)) || [];
    hepsi.push(...liste);
    const toplamSayfa = parseInt(headers['shopier-pagination-total-pages'], 10);
    if (!liste.length || (toplamSayfa && sayfa >= toplamSayfa) || (!toplamSayfa && liste.length < 50)) break;
  }
  return hepsi;
}

module.exports = { token, siparisleriGetir, hataMetni };
