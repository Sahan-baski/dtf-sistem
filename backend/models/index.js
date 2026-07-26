const mongoose = require('mongoose');
const { Schema } = mongoose;

const SiparisSchema = new Schema({
  siparis_no:       { type: String, unique: true },
  dis_siparis_no:   String,
  musteri_adi:      { type: String, required: true },
  musteri_soyadi:   String,
  musteri_telefon:  String,
  musteri_adres:    String,
  musteri_user_id:  String, // müşteri panelinden geliyorsa
  urunler:          [{ ad: String, adet: Number, fiyat: Number }],
  notlar:           String,
  teslim_tarihi:    String,
  press_sayisi:     { type: Number, default: 0 },
  baski_yonu:       { type: String, enum: ['', 'tek_yon', 'cift_yon'], default: '' },
  satis_tipi:       { type: String, enum: ['perakende', 'toptan', ''], default: '' },
  durum:            { type: String, default: 'bekliyor', enum: ['bekliyor','hazirlaniyor','hazir','kargoda','teslim_edildi'] },
  kaynak:           { type: String, default: 'manuel' },
  kategori:         String,
  asamalar:         [{ key: String, label: String, tamamlandi: { type: Boolean, default: false } }],
  odeme: {
    tutar:          { type: Number, default: 0 },
    odenen:         { type: Number, default: 0 },
    odendi:         { type: Boolean, default: false },
    yontem:         String,
    fatura_kesildi: { type: Boolean, default: false },
    odeme_tarihi:   String,
    notlar:         String,
  },
  kargo: { takip_no: String, firma: String, gonderim_tarihi: String },
  teslim_edildi_tarihi: String,
}, { timestamps: true });

const GorevSchema = new Schema({
  baslik: { type: String, required: true }, aciklama: String,
  oncelik: { type: String, default: 'normal', enum: ['yuksek','normal','dusuk'] },
  tamamlandi: { type: Boolean, default: false }, tamamlanma_tarihi: String,
}, { timestamps: true });

const MusteriSchema = new Schema({
  ad: { type: String, required: true }, soyad: String, telefon: String,
  siparis_sayisi: { type: Number, default: 0 }, siparis_idler: [String],
  ilk_siparis: String, son_siparis: String, notlar: String,
}, { timestamps: true });

const DosyaSchema = new Schema({
  siparis_id: String, orijinal_ad: String, dosya_adi: String,
  boyut: Number, mime: String, yuklenme: String,
}, { timestamps: true });

const AyarSchema = new Schema({
  anahtar: { type: String, unique: true }, deger: Schema.Types.Mixed,
});

const KategoriSchema = new Schema({
  key:    { type: String, required: true, unique: true },
  label:  { type: String, required: true },
  grup:   { type: String, default: 'Genel' },
  renk:   { type: String, default: '#4f7ef8' },
  sistem: { type: Boolean, default: false }, // sistem kategorileri silinemez
  sira:   { type: Number, default: 0 },
  aktif:  { type: Boolean, default: true },
}, { timestamps: true });

module.exports = {
  Siparis:  mongoose.models.Siparis  || mongoose.model('Siparis',  SiparisSchema),
  Gorev:    mongoose.models.Gorev    || mongoose.model('Gorev',    GorevSchema),
  Musteri:  mongoose.models.Musteri  || mongoose.model('Musteri',  MusteriSchema),
  Dosya:    mongoose.models.Dosya    || mongoose.model('Dosya',    DosyaSchema),
  Ayar:     mongoose.models.Ayar     || mongoose.model('Ayar',     AyarSchema),
  Kategori: mongoose.models.Kategori || mongoose.model('Kategori', KategoriSchema),
};
