/**
 * Bir WooCommerce siparişi için elle girilen kargo/etiket bilgileri (kargo
 * firması, Basit Kargo'dan alınan kargo no, desi, ağırlık). WooCommerce'in
 * kendisinde tutulmaz - sadece "Üretim Talimatı" yazdırma sayfasında
 * kullanılmak üzere burada saklanır, sipariş tekrar açıldığında hatırlanır.
 */
const mongoose = require('mongoose');

const KargoEtiketSchema = new mongoose.Schema({
  wc_siparis_id: { type: Number, required: true, unique: true },
  firma:         { type: String, default: '' },
  kargo_no:      { type: String, default: '' },
  desi:          { type: String, default: '' },
  agirlik:       { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.models.KargoEtiket || mongoose.model('KargoEtiket', KargoEtiketSchema);
