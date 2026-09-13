/**
 * Ürün eklerken seçilebilen, tekrar kullanılabilir hazır beden grupları
 * (ör. "Çocuk Grubu 1" -> 3-4,5-6,7-8,... / "Yetişkin Grubu" -> S,M,L,XL...).
 * Shopier'deki "varyasyon grubu" mantığının aynısı - sadece bir başlangıç
 * listesi verir, ürün eklenirken bu liste elle de değiştirilebilir.
 */
const mongoose = require('mongoose');

const VaryasyonGrubuSchema = new mongoose.Schema({
  ad:       { type: String, required: true },
  bedenler: [{ type: String }],
}, { timestamps: true });

module.exports = mongoose.models.VaryasyonGrubu || mongoose.model('VaryasyonGrubu', VaryasyonGrubuSchema);
