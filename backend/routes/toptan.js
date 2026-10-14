/**
 * Toptan sipariş uç noktaları.
 *  - Herkese açık (giriş gerektirmeyen) iki uç: PayTR'ın ödeme bildirimi ve
 *    ödeme ekranı (iframe) sonrası yönlendirme sayfası.
 *  - Müşteri uçları: sadece admin'in "toptan yetkili" yaptığı müşteri hesapları.
 *  - /admin/... uçları: sadece admin.
 */
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { sadeceAdmin } = require('../middleware/rol');
const User = require('../models/User');
const { ToptanSiparis } = require('../models/toptan');
const { StokHavuzu, HavuzUrun } = require('../models/stokSenkron');
const toptan = require('../services/toptan');

function hataYaniti(res, e, varsayilan = 'Bir hata oluştu') {
  if (e instanceof toptan.KullaniciHatasi) return res.status(400).json({ hata: e.message });
  console.error('[Toptan]', e.message);
  res.status(500).json({ hata: varsayilan });
}

function tabanUrl(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/+$/, '');
  const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0].trim();
  return `${proto}://${req.get('host')}`;
}

function istemciIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim().replace(/^::ffff:/, '') || '127.0.0.1';
}

// ----- Herkese açık: PayTR -----

// PayTR, ödeme sonucunu bu adrese (PayTR panelindeki "Bildirim URL") POST eder.
// Cevap düz metin "OK" olmalı - aksi halde PayTR bildirimi tekrar tekrar gönderir.
router.post('/paytr-bildirim', express.urlencoded({ extended: false }), async (req, res) => {
  try {
    await toptan.paytrBildirim(req.body);
    res.type('text/plain').send('OK');
  } catch (e) {
    console.error('[Toptan] PayTR bildirimi reddedildi:', e.message);
    res.status(400).type('text/plain').send('HATA');
  }
});

// Ödeme ekranı (iframe) bittiğinde PayTR buraya yönlendirir; bu küçük sayfa
// panele "ödeme bitti" mesajı gönderir, panel pencereyi kapatıp siparişi yeniler.
// NOT: Asıl ödeme onayı bu sayfa DEĞİL, yukarıdaki imzalı bildirimdir.
router.get('/odeme-sonuc', (req, res) => {
  const basarili = req.query.durum === 'basarili';
  const no = String(req.query.no || '').replace(/[^A-Za-z0-9]/g, '');
  res.type('html').send(`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;text-align:center;padding:40px 16px;color:#1f2937">
<div style="font-size:42px">${basarili ? '✅' : '⚠️'}</div>
<h2 style="margin:10px 0">${basarili ? 'Ödemeniz alındı' : 'Ödeme tamamlanamadı'}</h2>
<p style="color:#6b7280">${basarili ? 'Siparişiniz ödeme onayının ardından hazırlanmaya başlanacaktır.' : 'Tekrar deneyebilir ya da havale/EFT ile ödeyebilirsiniz.'}</p>
<script>try{window.parent.postMessage({tip:'toptan-odeme',durum:${JSON.stringify(basarili ? 'basarili' : 'basarisiz')},no:${JSON.stringify(no)}},'*')}catch(e){}</script>
</body></html>`);
});

// ----- Buradan sonrası giriş gerektirir -----
router.use(authMiddleware);

async function toptanKullanicisi(req, res) {
  const u = await User.findById(req.kullanici.id);
  if (!u || !u.aktif) { res.status(401).json({ hata: 'Oturum geçersiz' }); return null; }
  if (u.rol === 'admin' || (u.rol === 'musteri' && u.toptan_yetkili)) return u;
  res.status(403).json({ hata: 'Toptan sipariş için hesabınızın yetkilendirilmesi gerekiyor. Lütfen bizimle iletişime geçin.', yetkisiz: true });
  return null;
}

async function kendiSiparisi(req, res, u) {
  const sip = await ToptanSiparis.findById(req.params.id);
  if (!sip || (u.rol !== 'admin' && String(sip.musteri_id) !== String(u._id))) { res.status(404).json({ hata: 'Sipariş bulunamadı' }); return null; }
  return sip;
}

router.get('/katalog', async (req, res) => {
  try {
    const u = await toptanKullanicisi(req, res); if (!u) return;
    res.json(await toptan.katalog(u));
  } catch (e) { hataYaniti(res, e, 'Ürün listesi alınamadı'); }
});

router.get('/siparislerim', async (req, res) => {
  try {
    const u = await toptanKullanicisi(req, res); if (!u) return;
    res.json(await ToptanSiparis.find({ musteri_id: u._id }).sort({ createdAt: -1 }).limit(100));
  } catch (e) { hataYaniti(res, e); }
});

router.post('/siparisler', async (req, res) => {
  try {
    const u = await toptanKullanicisi(req, res); if (!u) return;
    res.status(201).json(await toptan.siparisOlustur(u, req.body || {}));
  } catch (e) { hataYaniti(res, e, 'Sipariş oluşturulamadı'); }
});

router.post('/siparisler/:id/paytr', async (req, res) => {
  try {
    const u = await toptanKullanicisi(req, res); if (!u) return;
    const sip = await kendiSiparisi(req, res, u); if (!sip) return;
    res.json(await toptan.paytrToken(sip, { ip: istemciIp(req), tabanUrl: tabanUrl(req) }));
  } catch (e) { hataYaniti(res, e, 'Ödeme ekranı açılamadı'); }
});

router.post('/siparisler/:id/havale', async (req, res) => {
  try {
    const u = await toptanKullanicisi(req, res); if (!u) return;
    const sip = await kendiSiparisi(req, res, u); if (!sip) return;
    if (sip.durum !== 'odeme_bekliyor') return res.status(400).json({ hata: 'Bu sipariş için ödeme beklenmiyor.' });
    sip.odeme.yontem = 'havale';
    sip.gecmis.push({ olay: 'Müşteri havale/EFT ile ödeyeceğini bildirdi' });
    await sip.save();
    res.json(sip);
  } catch (e) { hataYaniti(res, e); }
});

router.post('/siparisler/:id/iptal', async (req, res) => {
  try {
    const u = await toptanKullanicisi(req, res); if (!u) return;
    const sip = await kendiSiparisi(req, res, u); if (!sip) return;
    if (sip.durum !== 'odeme_bekliyor' || sip.odeme.odendi) return res.status(400).json({ hata: 'Ödemesi yapılmış ya da hazırlanmaya başlanmış sipariş panelden iptal edilemez, lütfen bizimle iletişime geçin.' });
    res.json(await toptan.iptalEt(sip, 'Müşteri iptal etti'));
  } catch (e) { hataYaniti(res, e); }
});

// ----- Admin -----
const admin = express.Router();
admin.use(sadeceAdmin);

admin.get('/ozet', async (req, res) => {
  try { res.json(await toptan.ozet()); } catch (e) { hataYaniti(res, e); }
});

admin.get('/siparisler', async (req, res) => {
  try {
    const filtre = {};
    if (req.query.durum) filtre.durum = { $in: String(req.query.durum).split(',') };
    if (req.query.ara) {
      const r = new RegExp(String(req.query.ara).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filtre.$or = [{ siparis_no: r }, { 'teslimat.ad_soyad': r }, { 'teslimat.firma': r }, { 'teslimat.telefon': r }];
    }
    res.json(await ToptanSiparis.find(filtre).sort({ createdAt: -1 }).limit(300));
  } catch (e) { hataYaniti(res, e); }
});

admin.patch('/siparisler/:id', async (req, res) => {
  try {
    const sip = await ToptanSiparis.findById(req.params.id);
    if (!sip) return res.status(404).json({ hata: 'Bulunamadı' });
    const { durum, admin_notu, kargo } = req.body || {};
    const izinli = ['odeme_bekliyor', 'odendi', 'hazirlaniyor', 'uretimde', 'kargoda', 'tamamlandi'];
    if (durum && durum !== sip.durum) {
      if (sip.durum === 'iptal') return res.status(400).json({ hata: 'İptal edilmiş sipariş yeniden açılamaz - yeni sipariş oluşturulmalı.' });
      if (!izinli.includes(durum)) return res.status(400).json({ hata: 'Geçersiz durum' });
      sip.gecmis.push({ olay: `Durum: ${durum}` });
      sip.durum = durum;
    }
    if (admin_notu !== undefined) sip.admin_notu = String(admin_notu).slice(0, 2000);
    if (kargo) {
      sip.kargo = { firma: String(kargo.firma || '').slice(0, 100), takip_no: String(kargo.takip_no || '').slice(0, 100) };
      if (kargo.takip_no) sip.gecmis.push({ olay: `Kargo bilgisi: ${sip.kargo.firma} ${sip.kargo.takip_no}` });
    }
    await sip.save();
    res.json(sip);
  } catch (e) { hataYaniti(res, e); }
});

admin.post('/siparisler/:id/odendi', async (req, res) => {
  try {
    const sip = await ToptanSiparis.findById(req.params.id);
    if (!sip) return res.status(404).json({ hata: 'Bulunamadı' });
    if (sip.odeme.odendi) return res.json(sip);
    const yontem = req.body && req.body.yontem === 'paytr' ? 'paytr' : 'havale';
    res.json(await toptan.odendiIsaretle(sip, yontem, `Ödeme elle onaylandı (${yontem === 'havale' ? 'havale/EFT' : 'PayTR'})`));
  } catch (e) { hataYaniti(res, e); }
});

admin.post('/siparisler/:id/iptal', async (req, res) => {
  try {
    const sip = await ToptanSiparis.findById(req.params.id);
    if (!sip) return res.status(404).json({ hata: 'Bulunamadı' });
    res.json(await toptan.iptalEt(sip, (req.body && req.body.neden) || 'Yönetici iptal etti'));
  } catch (e) { hataYaniti(res, e); }
});

admin.get('/uretim-listesi', async (req, res) => {
  try { res.json(await toptan.uretimListesi()); } catch (e) { hataYaniti(res, e); }
});

admin.get('/ayarlar', async (req, res) => {
  try {
    const [ayarlar, paytr, havuzlar, musteriler] = await Promise.all([
      toptan.ayarlariGetir(),
      toptan.paytrGetir(),
      StokHavuzu.find().sort({ createdAt: 1 }).lean(),
      User.find({ rol: 'musteri' }).select('ad soyad firma_adi kullanici_adi telefon email aktif onay_bekliyor toptan_yetkili toptan_iskonto').sort({ createdAt: -1 }).lean(),
    ]);
    const urunSayilari = await HavuzUrun.aggregate([{ $group: { _id: '$havuz_id', sayi: { $sum: 1 } } }]);
    const sayiMap = new Map(urunSayilari.map(x => [String(x._id), x.sayi]));
    res.json({
      ayarlar,
      paytr: toptan.paytrGorunumu(paytr),
      bildirim_url: `${tabanUrl(req)}/api/toptan/paytr-bildirim`,
      havuzlar: havuzlar.map(h => ({ id: h._id, etiket: h.etiket, bedenler: h.bedenler, toptan_aktif: !!h.toptan_aktif, toptan_fiyat: h.toptan_fiyat || 0, urun_sayisi: sayiMap.get(String(h._id)) || 0 })),
      musteriler,
    });
  } catch (e) { hataYaniti(res, e); }
});

admin.put('/ayarlar', async (req, res) => {
  try { res.json(await toptan.ayarlariKaydet(req.body || {})); } catch (e) { hataYaniti(res, e); }
});

admin.put('/paytr', async (req, res) => {
  try { res.json(await toptan.paytrKaydet(req.body || {})); } catch (e) { hataYaniti(res, e); }
});

admin.put('/havuzlar/:id', async (req, res) => {
  try {
    const g = {};
    if (req.body.toptan_aktif !== undefined) g.toptan_aktif = !!req.body.toptan_aktif;
    if (req.body.toptan_fiyat !== undefined) g.toptan_fiyat = Math.max(0, parseFloat(req.body.toptan_fiyat) || 0);
    const h = await StokHavuzu.findByIdAndUpdate(req.params.id, g, { new: true });
    if (!h) return res.status(404).json({ hata: 'Tablo bulunamadı' });
    res.json({ id: h._id, toptan_aktif: h.toptan_aktif, toptan_fiyat: h.toptan_fiyat });
  } catch (e) { hataYaniti(res, e); }
});

admin.patch('/musteriler/:id', async (req, res) => {
  try {
    const g = {};
    if (req.body.toptan_yetkili !== undefined) g.toptan_yetkili = !!req.body.toptan_yetkili;
    if (req.body.toptan_iskonto !== undefined) g.toptan_iskonto = Math.max(0, Math.min(90, parseFloat(req.body.toptan_iskonto) || 0));
    const u = await User.findOneAndUpdate({ _id: req.params.id, rol: 'musteri' }, g, { new: true }).select('-sifre');
    if (!u) return res.status(404).json({ hata: 'Müşteri bulunamadı' });
    res.json(u);
  } catch (e) { hataYaniti(res, e); }
});

router.use('/admin', admin);

module.exports = router;
