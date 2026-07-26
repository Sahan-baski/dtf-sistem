const mongoose = require('mongoose');

const UrunSchema = new mongoose.Schema({
  kategori_key: { type: String, required: true }, // 'tisort_baskili', 'sapka' vs.
  ad:           { type: String, required: true },  // 'Polo Yaka Tişört'
  aciklama:     { type: String, default: '' },
  fiyat:        { type: Number, default: 0 },
  // Esnek özellikler: [{ad:'Renk', degerler:['Beyaz','Siyah']}, {ad:'Beden', degerler:['S','M','L']}]
  ozellikler:   [{
    ad:       { type: String },
    degerler: [{ type: String }],
  }],
  aktif:        { type: Boolean, default: true },
  sira:         { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.models.Urun || mongoose.model('Urun', UrunSchema);
