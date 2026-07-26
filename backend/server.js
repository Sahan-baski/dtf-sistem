const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const baglan = require('./db');
const authMiddleware = require('./middleware/auth');
const User = require('./models/User');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(process.env.UPLOAD_DIR || path.join(__dirname, './uploads')));

// Auth (açık)
app.use('/api/auth', require('./routes/auth'));

// Korumalı
app.use('/api/siparisler', authMiddleware, require('./routes/siparisler'));
app.use('/api/gorevler',   authMiddleware, require('./routes/gorevler'));
app.use('/api/shopier',    authMiddleware, require('./routes/shopier'));
app.use('/api/musteriler', authMiddleware, require('./routes/musteriler'));
app.use('/api/dosyalar',   authMiddleware, require('./routes/dosyalar'));
app.use('/api/ozet',       authMiddleware, require('./routes/ozet'));

app.get('/api/ping', (req, res) => res.json({ durum: 'aktif', zaman: new Date().toISOString() }));

app.use(express.static(path.join(__dirname, './public')));
app.get('/{*path}', (req, res) => res.sendFile(path.join(__dirname, './public/index.html')));

// Admin kullanıcısını sıfırla veya oluştur
async function seedAdmin() {
  try {
    const bcrypt = require('bcryptjs');
    const mevcut = await User.findOne({ kullanici_adi: 'admin' });

    if (mevcut) {
      // Mevcut admin'in şifresini kontrol et, hatalıysa sıfırla
      const dogru = await bcrypt.compare('admin123', mevcut.sifre);
      if (!dogru) {
        mevcut.sifre = 'admin123'; // pre-save hook hashleyecek
        await mevcut.save();
        console.log('✅ Admin şifresi sıfırlandı');
      }
    } else {
      await User.create({
        kullanici_adi: 'admin',
        sifre: 'admin123',
        ad: 'Yönetici',
        rol: 'admin',
        aktif: true,
        onay_bekliyor: false,
      });
      console.log('✅ Admin oluşturuldu → kullanıcı: admin / şifre: admin123');
    }
  } catch (err) {
    console.error('Seed hatası:', err.message);
  }
}

baglan().then(async () => {
  await seedAdmin();
  app.listen(PORT, () => console.log(`✅ DTF Yönetim → http://localhost:${PORT}`));
});
