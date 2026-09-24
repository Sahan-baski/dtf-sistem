/**
 * Ortak stok havuzu + DTF kağıt/tasarım stoğu modelleri.
 *
 * Aynı mantık daha önce bir WordPress eklentisi (ortak-stok-senkron) olarak
 * yazılmıştı; burada WordPress'e hiç ihtiyaç duymadan, bu uygulamanın kendi
 * panelinden yönetilip WooCommerce'e sadece REST API üzerinden (WC_SITE_URL +
 * anahtarlar) yazan bir modül olarak yeniden kuruluyor.
 *
 * İki katmanlı stok modeli (aynı önceki mantık):
 *  1) Havuz + beden başına HAM stok (HavuzBedenStok) - o bedende kaç boş ürün var.
 *  2) Tasarım/DTF kağıdı başına stok (HavuzUrun.tasarim_stogu, ya da bağlıysa
 *     MasterTasarim.stok) - o baskıdan kaç adet basılabilir/mevcut.
 * Sitede (WooCommerce'de) görünen stok bu ikisinin KÜÇÜK OLANIDIR.
 */
const mongoose = require('mongoose');
const { Schema } = mongoose;

// Yeni bir ürün havuza eklendiğinde tasarım stoğu bu değerle başlar - pratikte
// sınırsız demektir (min formülü yüzünden bu kadar yüksek bir sayı asla
// sınırlayıcı olmaz). Admin isterse sonradan gerçek bir sınır girebilir.
const SINIRSIZ_TASARIM_STOGU = 99999;

const StokHavuzuSchema = new Schema({
  etiket: { type: String, required: true },
  bedenler: [{ type: String }],
}, { timestamps: true });

const HavuzBedenStokSchema = new Schema({
  havuz_id: { type: Schema.Types.ObjectId, ref: 'StokHavuzu', required: true, index: true },
  beden: { type: String, required: true },
  miktar: { type: Number, default: 0, min: 0 },
  // Bu beden hücresine artık "gerçek" (elle girilmiş, bir satışla düşmüş ya da
  // daha önce WooCommerce'ten bir kere beslenmiş) bir değer mi yazıldı? true
  // olduktan sonra "mevcutStoktanBesle" bir daha ASLA bu hücreye dokunmaz -
  // yoksa kurulum sırasında bir kereliğine WooCommerce'teki eski/kalıntı bir
  // sayıyı "benimseme" amaçlı yazılan mantık, günler sonra 0'a düşmüş
  // (gerçekten tükenmiş) bir hücreyi sessizce eski bir sayıyla geri
  // dolduruyordu - panel açıldıkça stokların "kendiliğinden" değiştiği bug'ı.
  beslendi: { type: Boolean, default: false },
}, { timestamps: true });
HavuzBedenStokSchema.index({ havuz_id: 1, beden: 1 }, { unique: true });

const MasterTasarimSchema = new Schema({
  ad: { type: String, required: true },
  stok: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

const HavuzUrunSchema = new Schema({
  havuz_id: { type: Schema.Types.ObjectId, ref: 'StokHavuzu', required: true, index: true },
  wc_urun_id: { type: Number, required: true },
  wc_urun_adi: { type: String, default: '' },
  wc_duzenleme_linki: { type: String, default: '' },
  tasarim_stogu: { type: Number, default: SINIRSIZ_TASARIM_STOGU, min: 0 },
  master_tasarim_id: { type: Schema.Types.ObjectId, ref: 'MasterTasarim', default: null },
  // Havuzun her bedeni için bu WC ürününün hangi varyasyon ID'sine karşılık
  // geldiği - WooCommerce'e stok yazarken hangi varyasyona yazacağımızı buradan
  // buluyoruz. Ürünün varyasyonları değişirse (beden eklenip çıkarılırsa) bu
  // liste yeniden tespit edilip güncellenir.
  varyasyonlar: [{
    beden: String,
    wc_varyasyon_id: Number,
  }],
}, { timestamps: true });
HavuzUrunSchema.index({ havuz_id: 1, wc_urun_id: 1 }, { unique: true });

// WooCommerce webhook'undan gelen bir siparişi İKİ KERE işlememek için (webhook
// aynı sipariş için birden fazla kez tetiklenebilir - durum her değiştiğinde).
const IslenmisSiparisSchema = new Schema({
  wc_siparis_id: { type: Number, required: true, unique: true },
  islenme_tarihi: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = {
  SINIRSIZ_TASARIM_STOGU,
  StokHavuzu: mongoose.models.StokHavuzu || mongoose.model('StokHavuzu', StokHavuzuSchema),
  HavuzBedenStok: mongoose.models.HavuzBedenStok || mongoose.model('HavuzBedenStok', HavuzBedenStokSchema),
  MasterTasarim: mongoose.models.MasterTasarim || mongoose.model('MasterTasarim', MasterTasarimSchema),
  HavuzUrun: mongoose.models.HavuzUrun || mongoose.model('HavuzUrun', HavuzUrunSchema),
  IslenmisSiparis: mongoose.models.IslenmisSiparis || mongoose.model('IslenmisSiparis', IslenmisSiparisSchema),
};
