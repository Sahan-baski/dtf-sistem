const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Dosya } = require('../models');

const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

router.post('/yukle/:siparisId', upload.single('dosya'), async (req, res) => {
  if (!req.file) return res.status(400).json({ hata: 'Dosya yok' });
  try {
    const d = await Dosya.create({
      siparis_id: req.params.siparisId,
      orijinal_ad: req.file.originalname,
      dosya_adi: req.file.filename,
      boyut: req.file.size, mime: req.file.mimetype,
      yuklenme: new Date().toISOString()
    });
    res.json({ ...d.toObject(), id: d._id });
  } catch (err) { res.status(500).json({ hata: err.message }); }
});

router.get('/:siparisId', async (req, res) => {
  try {
    const dosyalar = await Dosya.find({ siparis_id: req.params.siparisId });
    res.json(dosyalar.map(d => ({ ...d.toObject(), id: d._id })));
  } catch (err) { res.status(500).json({ hata: err.message }); }
});

router.get('/indir/:dosyaAdi', (req, res) => {
  const fp = path.join(uploadDir, req.params.dosyaAdi);
  if (!fs.existsSync(fp)) return res.status(404).json({ hata: 'Dosya bulunamadı' });
  res.download(fp);
});

router.delete('/:id', async (req, res) => {
  try {
    const d = await Dosya.findByIdAndDelete(req.params.id);
    if (d) {
      const fp = path.join(uploadDir, d.dosya_adi);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    res.json({ mesaj: 'Silindi' });
  } catch (err) { res.status(500).json({ hata: err.message }); }
});

module.exports = router;
