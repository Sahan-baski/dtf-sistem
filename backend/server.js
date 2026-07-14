const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Uploads klasörü (Render'da /data/uploads)
const uploadsDir = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, 'uploads')
  : path.join(__dirname, './uploads');

const fs = require('fs');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

app.use('/uploads', express.static(uploadsDir));

app.use('/api/siparisler', require('./routes/siparisler'));
app.use('/api/gorevler',   require('./routes/gorevler'));
app.use('/api/shopier',    require('./routes/shopier'));
app.use('/api/musteriler', require('./routes/musteriler'));
app.use('/api/dosyalar',   require('./routes/dosyalar'));
app.use('/api/ozet',       require('./routes/ozet'));

app.get('/api/ping', (req, res) => {
  res.json({ durum: 'aktif', zaman: new Date().toISOString() });
});

app.use(express.static(path.join(__dirname, './public')));
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, './public/index.html'));
});

app.listen(PORT, () => {
  console.log(`\n✅ DTF Yönetim Sistemi çalışıyor → http://localhost:${PORT}\n`);
});
