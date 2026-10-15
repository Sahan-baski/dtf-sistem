/**
 * Yönetim → Ayarlar → "Güvenlik Kontrolü" kartı. Canlı sunucunun ayarlarını
 * kontrol eder; hiçbir gizli değeri DÖNDÜRMEZ, sadece "tamam / sorun var" bilgisi verir.
 */
const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const User = require('../models/User');
const { sadeceAdmin } = require('../middleware/rol');

router.use(sadeceAdmin);

// GitHub'a yanlışlıkla gönderilmiş (backend/env-yeni.env) değerlerin SHA-256 özetleri.
// Değerlerin kendisi burada yok; canlıdaki değer bunlarla aynıysa "sızmış, değiştir" uyarısı verilir.
const SIZMIS = {
  JWT_SECRET: '4b91c158b240f95216f0d47433f870a2c8274dc9c1afbeb6923ba5d81afb4b19',
  WC_CONSUMER_KEY: '5c61126b876b780fb7e3e696acc76c633c3f8e012fb3fef36f66f0179904f937',
  WC_CONSUMER_SECRET: '15b6f2b89e9ceb5d4db00cabd3904212f26cd7a9cf5de34293ac22fec6e74c1d',
  WC_WEBHOOK_SECRET: '4c69c39e341a636779114ccf4942c4c214c9f92a10d94f04fd65c70991ae644d',
  BASIT_KARGO_TOKEN: 'f8a5c720c9cae2798d5bdcbc980c070508996ed932fc7537937638029e2f08df',
};
const ozet = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');
const sizmis = (ad) => !!process.env[ad] && ozet(process.env[ad]) === SIZMIS[ad];
const ZAYIF_SIFRELER = ['admin123', 'admin', '123456', '12345678', '123456789', 'password', 'sifre123', 'qwerty', '111111'];

router.get('/', async (req, res) => {
  try {
    const kontroller = [];
    const ekle = (durum, baslik, aciklama) => kontroller.push({ durum, baslik, aciklama });

    const jwtS = process.env.JWT_SECRET || '';
    if (sizmis('JWT_SECRET')) ekle('kritik', 'Giriş anahtarı (JWT_SECRET) herkesin bildiği eski değer', 'Bu değeri bilen biri şifresiz admin olarak girebilir. Render → Environment → JWT_SECRET\'ı uzun rastgele bir değerle değiştir (herkesin oturumu kapanır, tekrar giriş yapılır).');
    else if (jwtS.length < 32) ekle('uyari', 'Giriş anahtarı (JWT_SECRET) kısa', `${jwtS.length} karakter - en az 32 karakterlik rastgele bir değer önerilir.`);
    else ekle('tamam', 'Giriş anahtarı (JWT_SECRET)', 'Uzun ve sızmış listede değil.');

    for (const [ad, baslik] of [['WC_CONSUMER_KEY', 'WooCommerce API anahtarı'], ['WC_CONSUMER_SECRET', 'WooCommerce API gizli anahtarı']]) {
      if (sizmis(ad)) ekle('kritik', `${baslik} GitHub'a sızmış olanla aynı`, 'Bu anahtarla sitenin tüm siparişleri, müşteri bilgileri ve fiyatları okunup değiştirilebilir. WooCommerce → Ayarlar → Gelişmiş → REST API\'den eski anahtarı İPTAL ET, yenisini oluşturup Render\'a gir.');
    }
    if (!sizmis('WC_CONSUMER_KEY') && !sizmis('WC_CONSUMER_SECRET') && process.env.WC_CONSUMER_KEY) ekle('tamam', 'WooCommerce API anahtarı', 'Sızmış anahtar kullanılmıyor.');

    if (!process.env.WC_WEBHOOK_SECRET) ekle('kritik', 'WooCommerce webhook gizli anahtarı (WC_WEBHOOK_SECRET) yok', 'Bu sürümden itibaren anahtarsız gelen sipariş bildirimleri reddedilir - stok senkronu çalışmaz. Render\'a ekle ve WooCommerce webhook\'undaki "Gizli Anahtar" ile aynı yap.');
    else if (sizmis('WC_WEBHOOK_SECRET')) ekle('uyari', 'Webhook gizli anahtarı GitHub\'a sızmış olanla aynı', 'Bilen biri sahte sipariş bildirimiyle stokları düşürebilir. Yeni bir değer üretip hem Render\'da hem WooCommerce webhook ayarında değiştir.');
    else ekle('tamam', 'WooCommerce webhook imzası', 'Gizli anahtar ayarlı.');

    if (sizmis('BASIT_KARGO_TOKEN')) ekle('kritik', 'Basit Kargo token\'ı GitHub\'a sızmış olanla aynı', 'Bu token ile adına kargo gönderisi oluşturulabilir. Basit Kargo panelinden token\'ı yenile, Render\'a yenisini gir.');

    const ekip = await User.find({ rol: { $in: ['admin', 'calisan'] }, aktif: true });
    const zayif = [];
    for (const u of ekip) {
      for (const s of ZAYIF_SIFRELER) { if (await u.sifreKontrol(s)) { zayif.push(u.kullanici_adi); break; } }
    }
    if (zayif.length) ekle('kritik', 'Tahmin edilebilir yönetici şifresi', `Şu hesapların şifresi çok yaygın bir şifre: ${zayif.join(', ')}. Kullanıcılar sayfasından hemen değiştir (en az 12 karakter).`);
    else ekle('tamam', 'Yönetici şifreleri', 'Yaygın/varsayılan şifre kullanan ekip hesabı yok.');
    const adminSayisi = ekip.filter(u => u.rol === 'admin').length;
    if (adminSayisi > 1) ekle('bilgi', `${adminSayisi} admin hesabı var`, 'Kullanmadığın admin hesaplarını pasife al.');

    const bekleyen = await User.countDocuments({ rol: 'musteri', onay_bekliyor: true });
    ekle('bilgi', 'Müşteri onayı', `Yeni kayıt olan müşteriler sen onaylamadan giriş yapamaz.${bekleyen ? ` Şu an ${bekleyen} kayıt onay bekliyor.` : ''}`);

    if (!req.secure) ekle('uyari', 'Bağlantı HTTPS değil', 'Panel https:// ile açılmalı.');

    res.json({ kontroller, zaman: new Date() });
  } catch (e) {
    console.error('[Güvenlik]', e.message);
    res.status(500).json({ hata: 'Kontrol yapılamadı' });
  }
});

module.exports = router;
