/**
 * Bir WooCommerce siparişi için elle girilen veya Basit Kargo API'siyle
 * otomatik oluşturulan kargo/etiket bilgileri (kargo firması, kargo no,
 * paket ölçüleri). WooCommerce'in kendisinde tutulmaz - sadece "Üretim
 * Talimatı" yazdırma sayfasında kullanılmak üzere burada saklanır, sipariş
 * tekrar açıldığında hatırlanır.
 */
const mongoose = require('mongoose');

const KargoEtiketSchema = new mongoose.Schema({
  wc_siparis_id:  { type: Number, required: true, unique: true },
  firma:          { type: String, default: '' },
  firma_kodu:     { type: String, default: '' }, // Basit Kargo handlerCode
  kargo_no:       { type: String, default: '' }, // barkod / takip no
  basit_kargo_id: { type: String, default: '' }, // Basit Kargo'nun oluşturduğu sipariş id'si
  yukseklik:      { type: String, default: '' }, // cm
  genislik:       { type: String, default: '' }, // cm
  derinlik:       { type: String, default: '' }, // cm
  agirlik:        { type: String, default: '' }, // kg
}, { timestamps: true });

module.exports = mongoose.models.KargoEtiket || mongoose.model('KargoEtiket', KargoEtiketSchema);
