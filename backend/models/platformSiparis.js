/**
 * Site (WooCommerce) ve Shopier siparişlerinin bu panelde tutulan senkron
 * kopyası - Basit Kargo'dan gelen kargo durumuyla birleştirilmiş tek liste.
 * Kaynak sistemler asıl kayıt yeridir; burada sadece okunup birleştirilir,
 * her senkronda güncellenir. Panele özgü alanlar (talimat basıldı vb.)
 * senkronda ezilmez.
 */
const mongoose = require('mongoose');
const { Schema } = mongoose;

const PlatformSiparisSchema = new Schema({
  kaynak: { type: String, enum: ['woocommerce', 'shopier'], required: true },
  dis_id: { type: String, required: true },   // kaynaktaki sipariş id'si
  numara: { type: String, default: '' },      // müşteriye görünen sipariş no
  tarih: Date,
  musteri: { ad_soyad: String, telefon: String, email: String, il: String, ilce: String, adres: String },
  kalemler: [{ _id: false, ad: String, beden: String, adet: Number, fiyat: Number, gorsel: String, kod: String, urun_id: String }],
  toplam: Number,
  odeme_yontemi: String,
  musteri_notu: String,
  kaynak_durum: String,                       // kaynağın kendi durumu (ör. processing, completed)
  kargo: {
    basit_kargo_id: String,
    durum: String,                             // Basit Kargo durumu (NEW, READY_TO_SHIP, SHIPPED, DELIVERED...)
    firma: String,
    takip_no: String,
    barkod: String,
    eslesme: String,                           // nasıl eşleşti: etiket / numara / telefon
    guncellendi: Date,
  },
  durum: { type: String, index: true },        // birleşik durum - bkz. services/siparisSenkron.js birlesikDurum()
  talimat_basildi: Date,
  son_senkron: Date,
}, { timestamps: true });
PlatformSiparisSchema.index({ kaynak: 1, dis_id: 1 }, { unique: true });
PlatformSiparisSchema.index({ tarih: -1 });

module.exports = mongoose.models.PlatformSiparis || mongoose.model('PlatformSiparis', PlatformSiparisSchema);
