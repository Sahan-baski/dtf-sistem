const mongoose = require('mongoose');
const UrunSchema = new mongoose.Schema({
  kategori_key:        { type: String, required: true },
  ad:                  { type: String, required: true },
  aciklama:            { type: String, default: '' },
  fiyat:               { type: Number, default: 0 },
  ozellikler:          [{ ad: String, degerler: [String] }],
  stok_takip:          { type: Boolean, default: false }, // false = sınırsız stok
  stok_miktari:        { type: Number, default: 0, min: 0 },
  varsayilan_baski:    { type: String, enum: ['', 'tek_yon', 'cift_yon'], default: '' },
  aktif:               { type: Boolean, default: true },
  sira:                { type: Number, default: 0 },
}, { timestamps: true });
module.exports = mongoose.models.Urun || mongoose.model('Urun', UrunSchema);
