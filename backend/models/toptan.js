/**
 * Toptan sipariş - müşteri panelindeki stok tablosundan (tasarım × beden)
 * kendi seçtiği adetlerle verdiği sipariş. Bir siparişte iki tür kalem olabilir:
 *  - "stok":       eldeki stoktan; sipariş oluşturulduğu AN stok havuzundan
 *                  düşülür (siteyle aynı havuz - başkasına satılamaz). İptal
 *                  edilirse stok geri eklenir.
 *  - "on_siparis": stokta olmayan / yetmeyen ürün için üretim talebi; stoğa
 *                  dokunmaz, ödeme alındıktan sonra üretime geçilir.
 */
const mongoose = require('mongoose');
const { Schema } = mongoose;

const KalemSchema = new Schema({
  tip: { type: String, enum: ['stok', 'on_siparis'], required: true },
  havuz_id: { type: Schema.Types.ObjectId, ref: 'StokHavuzu' },
  havuz_etiket: String,
  havuz_urun_id: { type: Schema.Types.ObjectId, ref: 'HavuzUrun' },
  wc_urun_id: Number,
  urun_adi: String,
  beden: String,
  adet: { type: Number, min: 1 },
  birim_fiyat: Number, // indirimler ÖNCESİ liste (toptan) fiyatı
}, { _id: false });

const ToptanSiparisSchema = new Schema({
  siparis_no: { type: String, unique: true, index: true }, // PayTR merchant_oid olarak da kullanılır - sadece harf/rakam
  musteri_id: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  teslimat: {
    ad_soyad: String, firma: String, telefon: String, email: String,
    adres: String, il: String, vergi_no: String,
  },
  kalemler: [KalemSchema],
  stok_adet: { type: Number, default: 0 },
  on_siparis_adet: { type: Number, default: 0 },
  ara_toplam: { type: Number, default: 0 },
  kademe_indirim_orani: { type: Number, default: 0 },
  musteri_indirim_orani: { type: Number, default: 0 },
  indirim_tutari: { type: Number, default: 0 },
  toplam: { type: Number, default: 0 },
  durum: {
    type: String, default: 'odeme_bekliyor', index: true,
    enum: ['fiyat_bekliyor', 'odeme_bekliyor', 'odendi', 'hazirlaniyor', 'uretimde', 'kargoda', 'tamamlandi', 'iptal'],
  },
  odeme: {
    yontem: { type: String, enum: ['', 'paytr', 'havale'], default: '' },
    odendi: { type: Boolean, default: false },
    odeme_tarihi: Date,
    paytr_durum: String,
    paytr_hata: String,
    paytr_tutar_kurus: Number,
    paytr_token_zamani: Date,
    paytr_oidler: [String], // PayTR'a gönderilen merchant_oid'ler (her ödeme denemesi ayrı: MSA<siparis_no>D<n>)
    paytr_son_sorgu: Date,
  },
  // Fiyatı girilmemiş tablodan gelen siparişler 'fiyat_bekliyor' başlar; yönetici fiyatı
  // bildirince 'odeme_bekliyor'a geçer ve ödeme süresi bu andan itibaren işler.
  fiyat_verilme_tarihi: Date,
  stok_dusuldu: { type: Boolean, default: false },
  stok_iade_edildi: { type: Boolean, default: false },
  musteri_notu: String,
  admin_notu: String,
  kargo: { firma: String, takip_no: String },
  gecmis: [{ tarih: { type: Date, default: Date.now }, olay: String, _id: false }],
}, { timestamps: true });

module.exports = {
  ToptanSiparis: mongoose.models.ToptanSiparis || mongoose.model('ToptanSiparis', ToptanSiparisSchema),
};
