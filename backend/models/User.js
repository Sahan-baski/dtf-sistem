const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  kullanici_adi: { type: String, required: true, unique: true, lowercase: true, trim: true },
  sifre:         { type: String, required: true },
  ad:            { type: String, default: '' },
  soyad:         { type: String, default: '' },
  rol:           { type: String, enum: ['admin','calisan','musteri'], default: 'calisan' },
  aktif:         { type: Boolean, default: true },
  firma_adi:     { type: String, default: '' },
  telefon:       { type: String, default: '' },
  email:         { type: String, default: '' },
  adres:         { type: String, default: '' },
  vergi_no:      { type: String, default: '' },
  onay_bekliyor: { type: Boolean, default: false },
}, { timestamps: true });

// next parametresi olmadan async kullan — Mongoose 6+ promise tabanlı
UserSchema.pre('save', async function() {
  if (!this.isModified('sifre')) return;
  this.sifre = await bcrypt.hash(this.sifre, 10);
});

UserSchema.methods.sifreKontrol = function(sifre) {
  return bcrypt.compare(sifre, this.sifre);
};

module.exports = mongoose.models.User || mongoose.model('User', UserSchema);
