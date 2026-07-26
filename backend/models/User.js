const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  kullanici_adi: { type: String, required: true, unique: true, lowercase: true, trim: true },
  sifre:         { type: String, required: true },
  ad:            { type: String, default: '' },
  soyad:         { type: String, default: '' },
  rol:           { type: String, enum: ['admin', 'calisan', 'musteri'], default: 'calisan' },
  aktif:         { type: Boolean, default: true },
}, { timestamps: true });

// Şifreyi kaydetmeden önce hashle
UserSchema.pre('save', async function(next) {
  if (!this.isModified('sifre')) return next();
  this.sifre = await bcrypt.hash(this.sifre, 10);
  next();
});

// Şifre kontrolü
UserSchema.methods.sifreKontrol = function(sifre) {
  return bcrypt.compare(sifre, this.sifre);
};

module.exports = mongoose.models.User || mongoose.model('User', UserSchema);
