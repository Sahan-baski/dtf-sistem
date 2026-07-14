const { LowSync } = require('lowdb');
const { JSONFileSync } = require('lowdb/node');
const { join } = require('path');

// Render'da /data kalıcı, local'de backend klasörü
const dataDir = process.env.DATA_DIR || __dirname;
const file = join(dataDir, 'data.json');

const db = new LowSync(new JSONFileSync(file), {
  siparisler: [],
  gorevler: [],
  musteriler: [],
  dosyalar: [],
  ayarlar: {
    shopier_api_key: '',
    shopier_api_secret: '',
    varsayilan_teslim_gun: 3
  }
});

db.read();

module.exports = db;
