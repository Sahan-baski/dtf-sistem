const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

const uploadDir = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, 'uploads')
  : path.join(__dirname, '../uploads');

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname))
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

router.post('/yukle/:siparisId', upload.single('dosya'), (req, res) => {
  if (!req.file) return res.status(400).json({ hata: 'Dosya yok' });
  db.read();
  if (!db.data.dosyalar) db.data.dosyalar = [];
  const dosya = {
    id: uuidv4(),
    siparis_id: req.params.siparisId,
    orijinal_ad: req.file.originalname,
    dosya_adi: req.file.filename,
    boyut: req.file.size,
    mime: req.file.mimetype,
    yuklenme: new Date().toISOString()
  };
  db.data.dosyalar.push(dosya);
  db.write();
  res.json(dosya);
});

router.get('/:siparisId', (req, res) => {
  db.read();
  res.json((db.data.dosyalar || []).filter(d => d.siparis_id === req.params.siparisId));
});

router.get('/indir/:dosyaAdi', (req, res) => {
  const filePath = path.join(uploadDir, req.params.dosyaAdi);
  if (!fs.existsSync(filePath)) return res.status(404).json({ hata: 'Dosya bulunamadı' });
  res.download(filePath);
});

router.delete('/:id', (req, res) => {
  db.read();
  const dosya = (db.data.dosyalar || []).find(d => d.id === req.params.id);
  if (dosya) {
    const fp = path.join(uploadDir, dosya.dosya_adi);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
    db.data.dosyalar = db.data.dosyalar.filter(d => d.id !== req.params.id);
    db.write();
  }
  res.json({ mesaj: 'Silindi' });
});

module.exports = router;
