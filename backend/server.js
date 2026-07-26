const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const baglan = require('./db');
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(process.env.UPLOAD_DIR || path.join(__dirname, './uploads')));

app.use('/api/siparisler', require('./routes/siparisler'));
app.use('/api/gorevler',   require('./routes/gorevler'));
app.use('/api/shopier',    require('./routes/shopier'));
app.use('/api/musteriler', require('./routes/musteriler'));
app.use('/api/dosyalar',   require('./routes/dosyalar'));
app.use('/api/ozet',       require('./routes/ozet'));

app.get('/api/ping', (req, res) => res.json({ durum: 'aktif', zaman: new Date().toISOString() }));

app.use(express.static(path.join(__dirname, './public')));
app.get('/{*path}', (req, res) => res.sendFile(path.join(__dirname, './public/index.html')));

baglan().then(() => {
  app.listen(PORT, () => console.log(`✅ DTF Yönetim → http://localhost:${PORT}`));
});
