/**
 * Sipariş senkronu: WooCommerce (site) + Shopier siparişlerini çeker, Basit
 * Kargo'daki gönderilerle eşleştirip kargo durumunu teyit eder ve hepsini tek
 * bir listede (PlatformSiparis) birleştirir. 10 dakikada bir kendiliğinden
 * çalışır, panelden "Şimdi senkronla" ile de tetiklenebilir.
 *
 * Basit Kargo eşleştirmesi (sırayla):
 *  1. Üretim talimatından kargo kodu oluşturulmuş siparişler: KargoEtiket'teki basit_kargo_id
 *  2. Basit Kargo siparişinin numara/kod alanında platform sipariş numarası geçiyorsa
 *     (telefon iki tarafta da varsa ayrıca telefon da tutmalı)
 *  3. Alıcı telefonu aynı + tarihleri en fazla 7 gün farklı, henüz eşleşmemiş sipariş
 */
const PlatformSiparis = require('../models/platformSiparis');
const KargoEtiket = require('../models/kargoEtiket');
const { client: wooClient } = require('./wooClient');
const basitKargo = require('./basitKargoClient');
const shopier = require('./shopierClient');

const GUN = 24 * 3600 * 1000;
const SENKRON_GUN = 45;

const durumBilgisi = {
  son: null,          // son senkron zamanı
  calisiyor: false,
  kaynaklar: {},      // kaynak -> { durum: 'ok'|'hata'|'kapali', mesaj, sayi, zaman }
};

// ----- yardımcılar -----

const telefonAnahtari = (t) => String(t || '').replace(/\D/g, '').slice(-10);
const adSoyad = (k) => [k && k.first_name, k && k.last_name].filter(Boolean).join(' ').trim();

function bedenBul(meta) {
  const m = (meta || []).find(x => /beden|size|yaş|yas/i.test(x.display_key || x.key || ''));
  return m ? String(m.display_value || m.value || '').trim() : '';
}

// WooCommerce Türkiye il kodu (TR38) -> ad
const ILLER = ['', 'Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Amasya', 'Ankara', 'Antalya', 'Artvin', 'Aydın', 'Balıkesir', 'Bilecik', 'Bingöl', 'Bitlis', 'Bolu', 'Burdur', 'Bursa', 'Çanakkale', 'Çankırı', 'Çorum', 'Denizli', 'Diyarbakır', 'Edirne', 'Elazığ', 'Erzincan', 'Erzurum', 'Eskişehir', 'Gaziantep', 'Giresun', 'Gümüşhane', 'Hakkari', 'Hatay', 'Isparta', 'Mersin', 'İstanbul', 'İzmir', 'Kars', 'Kastamonu', 'Kayseri', 'Kırklareli', 'Kırşehir', 'Kocaeli', 'Konya', 'Kütahya', 'Malatya', 'Manisa', 'Kahramanmaraş', 'Mardin', 'Muğla', 'Muş', 'Nevşehir', 'Niğde', 'Ordu', 'Rize', 'Sakarya', 'Samsun', 'Siirt', 'Sinop', 'Sivas', 'Tekirdağ', 'Tokat', 'Trabzon', 'Tunceli', 'Şanlıurfa', 'Uşak', 'Van', 'Yozgat', 'Zonguldak', 'Aksaray', 'Bayburt', 'Karaman', 'Kırıkkale', 'Batman', 'Şırnak', 'Bartın', 'Ardahan', 'Iğdır', 'Yalova', 'Karabük', 'Kilis', 'Osmaniye', 'Düzce'];
function ilAdi(kod) {
  const m = /^TR(\d{2})$/.exec(kod || '');
  return m && ILLER[parseInt(m[1], 10)] ? ILLER[parseInt(m[1], 10)] : (kod || '');
}

// ----- Dönüştürücüler (kaynak formatı -> ortak format) -----

function wooDonustur(s) {
  const k = s.shipping && (s.shipping.address_1 || s.shipping.first_name) ? s.shipping : s.billing || {};
  return {
    kaynak: 'woocommerce',
    dis_id: String(s.id),
    numara: String(s.number || s.id),
    tarih: s.date_created_gmt ? new Date(`${s.date_created_gmt}Z`) : new Date(s.date_created),
    musteri: {
      ad_soyad: adSoyad(k) || adSoyad(s.billing),
      telefon: (s.billing && s.billing.phone) || (s.shipping && s.shipping.phone) || '',
      email: (s.billing && s.billing.email) || '',
      il: ilAdi(k.state), ilce: k.city || '', adres: [k.address_1, k.address_2].filter(Boolean).join(' '),
    },
    kalemler: (s.line_items || []).map(x => ({
      ad: x.parent_name || x.name, beden: bedenBul(x.meta_data), adet: x.quantity || 0,
      fiyat: parseFloat(x.total) || 0, gorsel: (x.image && x.image.src) || '', kod: x.sku || '', urun_id: String(x.product_id || ''),
    })),
    toplam: parseFloat(s.total) || 0,
    odeme_yontemi: s.payment_method_title || '',
    musteri_notu: s.customer_note || '',
    kaynak_durum: s.status,
  };
}

function shopierDonustur(s) {
  const k = s.shippingInfo || s.billingInfo || {};
  const tarih = s.dateCreated || s.createdAt || s.date;
  return {
    kaynak: 'shopier',
    dis_id: String(s.id),
    numara: String(s.id),
    tarih: tarih ? new Date(tarih) : new Date(),
    musteri: {
      ad_soyad: [k.firstName, k.lastName].filter(Boolean).join(' ').trim(),
      telefon: k.phone || (s.billingInfo && s.billingInfo.phone) || '',
      email: k.email || (s.billingInfo && s.billingInfo.email) || '',
      il: k.city || '', ilce: k.district || '', adres: k.address || '',
    },
    kalemler: (s.lineItems || []).map(x => {
      const sec = x.selection || {};
      const secenek = Array.isArray(x.options) ? x.options.map(o => (o && (o.value || o.title || o.name)) || o).filter(v => typeof v === 'string').join(' ') : '';
      return {
        ad: x.title || 'Ürün', beden: String(sec.variationTitle || sec.title || secenek || '').trim(),
        adet: parseInt(x.quantity, 10) || 0, fiyat: parseFloat(x.price) || 0, gorsel: '', kod: '', urun_id: String(x.productId || ''),
      };
    }),
    toplam: parseFloat(s.totals && s.totals.total) || 0,
    odeme_yontemi: s.paymentMethod || '',
    musteri_notu: s.note || '',
    kaynak_durum: String(s.status || ''),
  };
}

function basitKargoDonustur(o) {
  const alici = o.recipient || o.client || {};
  const ship = o.shipmentInfo || {};
  const kodlar = [o.orderNumber, o.code, o.foreignCode, o.externalId, o.content && o.content.code, o.content && o.content.name]
    .filter(Boolean).map(String);
  const numaralar = new Set();
  kodlar.forEach(k => (k.match(/\d{3,}/g) || []).forEach(n => numaralar.add(n.replace(/^0+/, ''))));
  return {
    id: String(o.id || ''),
    durum: o.status || '',
    barkod: o.barcode || '',
    firma: (ship.handler && ship.handler.name) || '',
    takip_no: ship.handlerShipmentCode || '',
    telefon: telefonAnahtari(alici.phone),
    tarih: o.createdTime ? new Date(o.createdTime) : null,
    numaralar: [...numaralar],
  };
}

/**
 * Birleşik durum:
 *  odeme_bekliyor · hazirlanacak · kargoya_hazir · kargoda · teslim_edildi · iade · iptal · sorunlu
 */
function birlesikDurum(sip) {
  const kd = String(sip.kaynak_durum || '').toLowerCase();
  if (/cancel|refund|failed|iptal/.test(kd)) return 'iptal';
  const bk = sip.kargo && sip.kargo.durum;
  if (bk === 'DELIVERED') return 'teslim_edildi';
  if (bk === 'RETURNING' || bk === 'RETURNED') return 'iade';
  if (bk === 'NEEDS_SUPPORT' || bk === 'LOST') return 'sorunlu';
  if (bk === 'SHIPPED' || bk === 'OUT_FOR_DELIVERY' || bk === 'DELAYED') return 'kargoda';
  if (bk === 'READY_TO_SHIP') return 'kargoya_hazir';
  if (sip.kaynak === 'woocommerce') {
    if (kd === 'on-hold' || kd === 'pending') return 'odeme_bekliyor';
    if (kd === 'completed') return 'kargoda'; // Basit Kargo teyidi yoksa: sitede "tamamlandı" = gönderilmiş kabul
  }
  if (sip.kaynak === 'shopier' && /fulfilled|shipped|kargo|gonder|gönder|complete/.test(kd) && !/unfulfilled/.test(kd)) return 'kargoda';
  return 'hazirlanacak';
}

/** Basit Kargo gönderilerini platform siparişleriyle eşleştirir (siparisler yerinde güncellenir). */
function eslestir(siparisler, bkListe, etiketHaritasi) {
  const bkById = new Map(bkListe.map(b => [b.id, b]));
  const kullanildi = new Set();
  const ata = (sip, bk, nasil) => {
    sip.kargo = { basit_kargo_id: bk.id, durum: bk.durum, firma: bk.firma, takip_no: bk.takip_no, barkod: bk.barkod, eslesme: nasil, guncellendi: new Date() };
    kullanildi.add(bk.id);
  };

  // 1) panelden oluşturulmuş kargo kodu
  for (const s of siparisler) {
    const bkId = s.kaynak === 'woocommerce' && etiketHaritasi.get(s.dis_id);
    if (bkId && bkById.has(bkId)) ata(s, bkById.get(bkId), 'etiket');
  }
  // 2) numara (+ varsa telefon teyidi)
  const numaraIndeksi = new Map();
  for (const b of bkListe) for (const n of b.numaralar) {
    if (!numaraIndeksi.has(n)) numaraIndeksi.set(n, []);
    numaraIndeksi.get(n).push(b);
  }
  for (const s of siparisler) {
    if (s.kargo && s.kargo.basit_kargo_id) continue;
    const adaylar = (numaraIndeksi.get(String(s.numara).replace(/^0+/, '')) || []).filter(b => !kullanildi.has(b.id));
    const tel = telefonAnahtari(s.musteri && s.musteri.telefon);
    const uygun = adaylar.find(b => !b.telefon || !tel || b.telefon === tel);
    if (uygun) ata(s, uygun, 'numara');
  }
  // 3) telefon + tarih yakınlığı
  for (const s of siparisler) {
    if (s.kargo && s.kargo.basit_kargo_id) continue;
    const tel = telefonAnahtari(s.musteri && s.musteri.telefon);
    if (tel.length < 10) continue;
    const aday = bkListe
      .filter(b => !kullanildi.has(b.id) && b.telefon === tel && b.tarih && s.tarih && Math.abs(b.tarih - s.tarih) <= 7 * GUN && b.tarih >= s.tarih - GUN)
      .sort((a, b) => Math.abs(a.tarih - s.tarih) - Math.abs(b.tarih - s.tarih))[0];
    if (aday) ata(s, aday, 'telefon');
  }
  return { eslesmeyen: bkListe.filter(b => !kullanildi.has(b.id)).length };
}

// ----- Kaynaklardan çekme -----

async function wooCek(baslangic) {
  const hepsi = [];
  for (let sayfa = 1; sayfa <= 30; sayfa++) {
    const { data, headers } = await wooClient().get('/orders', {
      params: {
        after: baslangic.toISOString().slice(0, 19), status: 'processing,on-hold,completed,cancelled,refunded',
        per_page: 100, page: sayfa, orderby: 'date', order: 'desc',
        _fields: 'id,number,status,date_created,date_created_gmt,total,billing,shipping,line_items,customer_note,payment_method_title',
      },
    });
    hepsi.push(...data);
    if (sayfa >= (parseInt(headers['x-wp-totalpages'], 10) || 1)) break;
  }
  return hepsi.map(wooDonustur);
}

async function basitKargoCek(baslangic) {
  const bicim = (d) => new Date(d.getTime() + 3 * 3600 * 1000).toISOString().slice(0, 19); // Türkiye saati
  const hepsi = [];
  for (let sayfa = 0; sayfa < 40; sayfa++) {
    const { liste, toplamSayfa } = await basitKargo.siparisleriFiltrele({ baslangic: bicim(baslangic), bitis: bicim(new Date()), sayfa, boyut: 100 });
    hepsi.push(...liste);
    if (!liste.length || (toplamSayfa !== null ? sayfa + 1 >= toplamSayfa : liste.length < 100)) break;
  }
  return hepsi.map(basitKargoDonustur);
}

// Shopier kalemlerinde görsel yok - sitedeki aynı isimli ürünün görselini kullan.
let urunGorselOnbellek = { zaman: 0, liste: [] };
const normal = (s) => String(s || '').toLocaleLowerCase('tr-TR').replace(/[^a-z0-9çğıöşü]+/g, ' ').trim();
async function siteUrunGorselleri() {
  if (Date.now() - urunGorselOnbellek.zaman < 60 * 60 * 1000 && urunGorselOnbellek.liste.length) return urunGorselOnbellek.liste;
  const liste = [];
  for (let sayfa = 1; sayfa <= 10; sayfa++) {
    const { data, headers } = await wooClient().get('/products', { params: { per_page: 100, page: sayfa, _fields: 'id,name,images', status: 'publish' } });
    data.forEach(u => liste.push({ ad: normal(u.name), kelimeler: new Set(normal(u.name).split(' ')), gorsel: (u.images && u.images[0] && u.images[0].src) || '' }));
    if (sayfa >= (parseInt(headers['x-wp-totalpages'], 10) || 1)) break;
  }
  urunGorselOnbellek = { zaman: Date.now(), liste };
  return liste;
}
function gorselBul(ad, urunler) {
  const n = normal(ad);
  const tam = urunler.find(u => u.ad === n && u.gorsel);
  if (tam) return tam.gorsel;
  const kelimeler = n.split(' ').filter(k => k.length > 2);
  let enIyi = null, puan = 0;
  for (const u of urunler) {
    if (!u.gorsel) continue;
    const ortak = kelimeler.filter(k => u.kelimeler.has(k)).length;
    const p = ortak / Math.max(kelimeler.length, u.kelimeler.size);
    if (p > puan) { puan = p; enIyi = u; }
  }
  return puan >= 0.6 ? enIyi.gorsel : '';
}

// ----- Ana senkron -----

async function senkronla() {
  if (durumBilgisi.calisiyor) return durumBilgisi;
  durumBilgisi.calisiyor = true;
  const baslangic = new Date(Date.now() - SENKRON_GUN * GUN);
  const k = durumBilgisi.kaynaklar;
  try {
    const siparisler = [];
    const [woo, shp, bk] = await Promise.allSettled([
      wooCek(baslangic),
      shopier.siparisleriGetir(baslangic.toISOString().slice(0, 10)).then(l => (l === null ? null : l.map(shopierDonustur))),
      basitKargo.tokenVar() ? basitKargoCek(baslangic) : Promise.resolve(null),
    ]);
    const kaydet = (ad, r, hataFn) => {
      if (r.status === 'fulfilled' && r.value === null) k[ad] = { durum: 'kapali', mesaj: 'Bağlantı bilgisi girilmemiş', zaman: new Date() };
      else if (r.status === 'fulfilled') k[ad] = { durum: 'ok', sayi: r.value.length, zaman: new Date() };
      else k[ad] = { durum: 'hata', mesaj: hataFn(r.reason), zaman: new Date() };
    };
    kaydet('woocommerce', woo, e => (e.response && e.response.data && e.response.data.message) || e.message);
    kaydet('shopier', shp, shopier.hataMetni);
    kaydet('basitkargo', bk, basitKargo.hataMetni);

    if (woo.status === 'fulfilled') siparisler.push(...woo.value);
    if (shp.status === 'fulfilled' && shp.value) {
      siparisler.push(...shp.value);
      const eksikGorsel = shp.value.some(s => s.kalemler.some(x => !x.gorsel));
      if (eksikGorsel) {
        try {
          const urunler = await siteUrunGorselleri();
          shp.value.forEach(s => s.kalemler.forEach(x => { if (!x.gorsel) x.gorsel = gorselBul(x.ad, urunler); }));
        } catch { /* görselsiz devam */ }
      }
    }

    // Önceki kargo eşleşmelerini koru (Basit Kargo o an erişilemezse durum kaybolmasın).
    const mevcut = siparisler.length ? await PlatformSiparis.find({ $or: siparisler.map(s => ({ kaynak: s.kaynak, dis_id: s.dis_id })) }, { kaynak: 1, dis_id: 1, kargo: 1 }).lean().catch(() => []) : [];
    const mevcutMap = new Map((mevcut || []).map(m => [`${m.kaynak}|${m.dis_id}`, m]));
    if (bk.status === 'fulfilled' && bk.value) {
      const etiketler = await KargoEtiket.find({ basit_kargo_id: { $ne: '' } }, { wc_siparis_id: 1, basit_kargo_id: 1 }).lean();
      const sonuc = eslestir(siparisler, bk.value, new Map(etiketler.map(e => [String(e.wc_siparis_id), String(e.basit_kargo_id)])));
      k.basitkargo.eslesmeyen = sonuc.eslesmeyen;
    }
    for (const s of siparisler) {
      if (!(s.kargo && s.kargo.basit_kargo_id)) {
        const eski = mevcutMap.get(`${s.kaynak}|${s.dis_id}`);
        if (eski && eski.kargo && eski.kargo.basit_kargo_id) s.kargo = eski.kargo;
      }
      s.durum = birlesikDurum(s);
      s.son_senkron = new Date();
    }

    if (siparisler.length) {
      await PlatformSiparis.bulkWrite(siparisler.map(s => ({
        updateOne: { filter: { kaynak: s.kaynak, dis_id: s.dis_id }, update: { $set: s }, upsert: true },
      })), { ordered: false });
    }
    durumBilgisi.son = new Date();
  } finally {
    durumBilgisi.calisiyor = false;
  }
  return durumBilgisi;
}

let zamanlayici = null;
function zamanlayiciBaslat() {
  if (zamanlayici) return;
  const calistir = () => senkronla().catch(e => console.error('[SiparisSenkron]', e.message));
  setTimeout(calistir, 20 * 1000);
  zamanlayici = setInterval(calistir, 10 * 60 * 1000);
}

module.exports = {
  senkronla, zamanlayiciBaslat, durumBilgisi,
  _test: { wooDonustur, shopierDonustur, basitKargoDonustur, birlesikDurum, eslestir, gorselBul, normal, ilAdi },
};
