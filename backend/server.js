const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const baglan = require('./db');
const authMiddleware = require('./middleware/auth');
const User = require('./models/User');

const { guvenlikBasliklari, nosqlTemizle } = require('./middleware/guvenlik');

const app = express();
const PORT = process.env.PORT || 3001;
app.set('trust proxy', 1);          // Render'ın önündeki proxy: req.ip gerçek ziyaretçi IP'si olsun (hız sınırı için)
app.disable('x-powered-by');
app.use(guvenlikBasliklari);
// CORS: panel ve API aynı adresten sunuluyor, başka sitelerin tarayıcıdan API'yi
// çağırmasına gerek yok. Gerekirse CORS_ORIGINS="https://a.com,https://b.com" ile açılır.
const izinliOriginler = String(process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({ origin: izinliOriginler.length ? izinliOriginler : false }));
// verify: WooCommerce webhook imzasını (HMAC) kontrol edebilmek için ham gövdeyi
// de saklıyoruz - JSON.parse edilmiş req.body'den imza tekrar hesaplanamaz.
// Boyut sınırı: normal istekler 2MB; sadece yedekten geri yükleme büyük olabilir.
const jsonKucuk = express.json({ limit: '2mb', verify: (req, _res, buf) => { req.rawBody = buf; } });
const jsonBuyuk = express.json({ limit: '50mb' });
app.use((req, res, next) => (req.path.startsWith('/api/yedek') ? jsonBuyuk : jsonKucuk)(req, res, next));
// NOT: /uploads artık herkese açık sunulmuyor - dosyalar sadece giriş yapmış ekip
// üyelerine /api/dosyalar/indir üzerinden verilir.

// WooCommerce webhook'u - JWT gerektirmez (WooCommerce token'ımızı taşıyamaz),
// onun yerine kendi HMAC imza kontrolünü yapar. Auth middleware'in dışında.
app.use('/api/webhooks/woocommerce', require('./routes/webhookWoo'));
app.use(nosqlTemizle); // MongoDB operatör enjeksiyonu ({"$ne": ...}) engeli - webhook'tan SONRA (imza ham gövdeyle kontrol ediliyor)

app.use('/api/auth',          require('./routes/auth'));
app.use('/api/siparisler',    authMiddleware, require('./routes/siparisler'));
app.use('/api/gorevler',      authMiddleware, require('./routes/gorevler'));
app.use('/api/shopier',       authMiddleware, require('./routes/shopier'));
app.use('/api/musteriler',    authMiddleware, require('./routes/musteriler'));
app.use('/api/dosyalar',      authMiddleware, require('./routes/dosyalar'));
app.use('/api/ozet',          authMiddleware, require('./routes/ozet'));
app.use('/api/urunler',       authMiddleware, require('./routes/urunler'));
app.use('/api/stok-senkron',  authMiddleware, require('./routes/stokSenkron'));
app.use('/api/fiyat-guncelle',authMiddleware, require('./routes/fiyatGuncelle'));
app.use('/api/urun-yonetimi',authMiddleware, require('./routes/urunYonetimi'));
app.use('/api/uretim-talimati',authMiddleware, require('./routes/uretimTalimati'));
app.use('/api/ayarlar',       authMiddleware, require('./routes/ayarlar'));
app.use('/api/kategoriler',   authMiddleware, require('./routes/kategoriler'));
app.use('/api/istatistikler', authMiddleware, require('./routes/istatistikler'));
app.use('/api/yedek',         authMiddleware, require('./routes/yedek'));
app.use('/api/varyasyon-denetim', authMiddleware, require('./routes/varyasyonDenetim'));
// Toptan sipariş: PayTR bildirim/sonuç uçları herkese açık, geri kalanını route kendi korur.
app.use('/api/toptan', require('./routes/toptan'));
app.use('/api/siparis-senkron', authMiddleware, require('./routes/siparisSenkron'));
app.use('/api/guvenlik',      authMiddleware, require('./routes/guvenlik'));
app.get('/api/ping', (req,res) => res.json({durum:'aktif'}));
app.use('/api', (req, res) => res.status(404).json({ hata: 'Bulunamadı' }));
app.use(express.static(path.join(__dirname,'./public')));
app.get('/{*path}', (req,res) => res.sendFile(path.join(__dirname,'./public/index.html')));

async function seedAdmin() {
  try {
    // ÖNEMLİ: eskiden burada, admin kullanıcısının şifresi 'admin123' DEĞİLSE
    // (yani admin şifresini değiştirmişse) sunucu her yeniden başladığında
    // şifreyi sessizce 'admin123'e GERİ SIFIRLIYORDU - bu, kim bilse (ya da
    // bu koddan okuyabilse) herkesin her zaman içeri girebildiği kalıcı bir
    // arka kapıydı. Şimdi admin hesabı SADECE hiç yoksa (ilk kurulum)
    // oluşturuluyor - zaten varsa dokunulmuyor.
    const mevcut = await User.findOne({kullanici_adi:'admin'});
    if (!mevcut) { await User.create({kullanici_adi:'admin',sifre:'admin123',ad:'Yönetici',rol:'admin',aktif:true,onay_bekliyor:false}); console.log('✅ Admin oluşturuldu (kullanıcı adı: admin, şifre: admin123 - lütfen ilk girişte değiştir).'); }
  } catch(e){ console.error('Seed hatası:',e.message); }
}

baglan().then(async () => { await seedAdmin(); require('./services/toptan').zamanlayiciBaslat(); require('./services/siparisSenkron').zamanlayiciBaslat(); app.listen(PORT, ()=>console.log(`✅ Miras & Şahan → http://localhost:${PORT}`)); });
