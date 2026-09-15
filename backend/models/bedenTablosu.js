/**
 * Tekrar tekrar kullanılabilecek "Beden Tablosu" görselleri (ör. "Çocuk
 * Grubu 1" ya da "Yetişkin Grubu" ölçü tabloları) - WordPress medya
 * kütüphanesine bir kere yüklenir, burada sadece referansı (medya ID + URL)
 * tutulur; "Ürünler" panelinden seçilen ürünlere toplu olarak uygulanır.
 */
const mongoose = require('mongoose');

const BedenTablosuSchema = new mongoose.Schema({
  ad:          { type: String, required: true },
  wp_media_id: { type: Number, required: true },
  url:         { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.models.BedenTablosu || mongoose.model('BedenTablosu', BedenTablosuSchema);
