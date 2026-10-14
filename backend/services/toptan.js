/**
 * Toptan sipariş motoru.
 *
 * Müşteri, Stok Senkron'daki "toptan satışa açık" tabloları (havuzları) görür;
 * her hücreye (tasarım × beden) iki ayrı adet girebilir:
 *   - stoktan:     o bedenin havuz stoğu + tasarımın (DTF kağıdı) stoğu ile sınırlı.
 *                  Sipariş oluşturulduğu AN stoktan düşülür (site ile aynı havuz).
 *   - ön sipariş:  stokta olmayan/yetmeyen için üretim talebi, stoğa dokunmaz.
 * Minimumlar: stoktan en az X adet, ön siparişte en az Y adet (Toptan Ayarlar).
 * Fiyat: tablo başına toptan birim fiyatı → toplam adede göre kademe indirimi →
 * müşteriye özel ek indirim.
 * Ödeme: PayTR (iFrame API) ya da havale/EFT. Belirlenen süre içinde ödenmeyen
 * siparişler otomatik iptal edilir ve ayrılan stok serbest bırakılır.
 */
const crypto = require('crypto');
const axios = require('axios');
const { Ayar } = require('../models');
const User = require('../models/User');
const { ToptanSiparis } = require('../models/toptan');
const { StokHavuzu, HavuzBedenStok, HavuzUrun, MasterTasarim, SINIRSIZ_TASARIM_STOGU } = require('../models/stokSenkron');
const motor = require('./stokMotoru');
const { client } = require('./wooClient');

class KullaniciHatasi extends Error {}

const VARSAYILAN_AYARLAR = {
  min_stok_adet: 20,
  min_on_siparis_adet: 60,
  kademeler: [{ adet: 100, indirim: 5 }, { adet: 200, indirim: 10 }],
  odeme_sure_saat: 48,
  on_siparis_sure: '10-15 iş günü',
  fiyat_notu: 'Fiyatlara KDV dahildir.',
  havale_bilgisi: '',
};

// ----- Ayarlar -----

async function ayarlariGetir() {
  const a = await Ayar.findOne({ anahtar: 'toptan_ayarlar' }).lean();
  return { ...VARSAYILAN_AYARLAR, ...((a && a.deger) || {}) };
}

function tamSayi(v, varsayilan, min, max) {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return varsayilan;
  return Math.max(min, Math.min(max, n));
}

async function ayarlariKaydet(g) {
  const mevcut = await ayarlariGetir();
  const kademeler = (Array.isArray(g.kademeler) ? g.kademeler : mevcut.kademeler)
    .map(k => ({ adet: tamSayi(k.adet, 0, 1, 100000), indirim: Math.max(0, Math.min(90, parseFloat(k.indirim) || 0)) }))
    .filter(k => k.adet > 0 && k.indirim > 0)
    .sort((a, b) => a.adet - b.adet);
  const yeni = {
    min_stok_adet: tamSayi(g.min_stok_adet, mevcut.min_stok_adet, 1, 100000),
    min_on_siparis_adet: tamSayi(g.min_on_siparis_adet, mevcut.min_on_siparis_adet, 1, 100000),
    kademeler,
    odeme_sure_saat: tamSayi(g.odeme_sure_saat, mevcut.odeme_sure_saat, 0, 24 * 30),
    on_siparis_sure: String(g.on_siparis_sure ?? mevcut.on_siparis_sure).slice(0, 100),
    fiyat_notu: String(g.fiyat_notu ?? mevcut.fiyat_notu).slice(0, 300),
    havale_bilgisi: String(g.havale_bilgisi ?? mevcut.havale_bilgisi).slice(0, 1000),
  };
  await Ayar.findOneAndUpdate({ anahtar: 'toptan_ayarlar' }, { deger: yeni }, { upsert: true });
  return yeni;
}

// PayTR anahtarları AYRI bir kayıtta - genel /api/ayarlar uç noktası bunları
// asla döndürmez (bkz. routes/ayarlar.js), panelde de sadece "girildi" bilgisi gösterilir.
async function paytrGetir() {
  const a = await Ayar.findOne({ anahtar: 'toptan_paytr' }).lean();
  return { merchant_id: '', merchant_key: '', merchant_salt: '', test_modu: true, ...((a && a.deger) || {}) };
}
const paytrHazir = (p) => !!(p.merchant_id && p.merchant_key && p.merchant_salt);
function paytrGorunumu(p) {
  return { merchant_id: p.merchant_id, merchant_key_girildi: !!p.merchant_key, merchant_salt_girildi: !!p.merchant_salt, test_modu: !!p.test_modu, hazir: paytrHazir(p) };
}
async function paytrKaydet(g) {
  const p = await paytrGetir();
  const yeni = {
    merchant_id: String(g.merchant_id ?? p.merchant_id).trim(),
    // Boş gönderilirse eskisini koru (panel gizli alanları geri göndermiyor).
    merchant_key: g.merchant_key ? String(g.merchant_key).trim() : p.merchant_key,
    merchant_salt: g.merchant_salt ? String(g.merchant_salt).trim() : p.merchant_salt,
    test_modu: g.test_modu !== undefined ? !!g.test_modu : p.test_modu,
  };
  await Ayar.findOneAndUpdate({ anahtar: 'toptan_paytr' }, { deger: yeni }, { upsert: true });
  return paytrGorunumu(yeni);
}

// ----- Eşzamanlılık kilidi: aynı anda gelen iki sipariş aynı stoğu ayırmasın -----

let kuyruk = Promise.resolve();
function kilitli(fn) {
  const p = kuyruk.then(fn, fn);
  kuyruk = p.catch(() => {});
  return p;
}

// ----- Ürün görselleri (WooCommerce'ten, 30 dk önbellekli) -----

const gorselOnbellek = new Map(); // wc_urun_id -> { src, zaman }
async function urunGorselleri(wcIdler) {
  const simdi = Date.now();
  const eksik = wcIdler.filter(id => { const g = gorselOnbellek.get(id); return !g || simdi - g.zaman > 30 * 60 * 1000; });
  for (let i = 0; i < eksik.length; i += 100) {
    const grup = eksik.slice(i, i + 100);
    try {
      const { data } = await client().get('/products', { params: { include: grup.join(','), per_page: 100, _fields: 'id,images' } });
      const bulunan = new Set();
      for (const u of data) {
        bulunan.add(u.id);
        gorselOnbellek.set(u.id, { src: (u.images && u.images[0] && u.images[0].src) || '', zaman: simdi });
      }
      grup.filter(id => !bulunan.has(id)).forEach(id => gorselOnbellek.set(id, { src: '', zaman: simdi }));
    } catch (e) {
      console.error('[Toptan] Ürün görselleri alınamadı:', e.message);
    }
  }
  const sonuc = {};
  wcIdler.forEach(id => { sonuc[id] = (gorselOnbellek.get(id) || {}).src || ''; });
  return sonuc;
}

// ----- Müsaitlik (stok) -----

/** Toptana açık tabloların güncel stok durumu + her ürünün tasarım (DTF kağıdı) limiti. */
async function musaitlik() {
  const havuzlar = await StokHavuzu.find({ toptan_aktif: true, toptan_fiyat: { $gt: 0 } }).sort({ createdAt: 1 }).lean();
  const havuzIdler = havuzlar.map(h => h._id);
  const [stoklar, urunler] = await Promise.all([
    HavuzBedenStok.find({ havuz_id: { $in: havuzIdler } }).lean(),
    HavuzUrun.find({ havuz_id: { $in: havuzIdler } }).sort({ createdAt: 1 }).lean(),
  ]);
  const masterIdler = [...new Set(urunler.filter(u => u.master_tasarim_id).map(u => String(u.master_tasarim_id)))];
  const masterlar = masterIdler.length ? await MasterTasarim.find({ _id: { $in: masterIdler } }).lean() : [];

  const havuzStok = {}; // havuzId -> { beden: adet }
  for (const h of havuzlar) {
    havuzStok[h._id] = {};
    h.bedenler.forEach(b => { havuzStok[h._id][b] = 0; });
  }
  stoklar.forEach(s => { if (havuzStok[s.havuz_id] && s.beden in havuzStok[s.havuz_id]) havuzStok[s.havuz_id][s.beden] = Math.max(0, s.miktar); });

  // Tasarım limiti: aynı Master Tasarım'a bağlı ürünler (farklı tablolarda bile)
  // AYNI limiti paylaşır. null = sınırsız (tasarım stoğu girilmemiş).
  const tasarimLimitleri = {};
  masterlar.forEach(m => { tasarimLimitleri[`m:${m._id}`] = m.stok >= SINIRSIZ_TASARIM_STOGU ? null : Math.max(0, m.stok); });
  const urunMap = new Map();
  for (const u of urunler) {
    let anahtar;
    if (u.master_tasarim_id && `m:${u.master_tasarim_id}` in tasarimLimitleri) anahtar = `m:${u.master_tasarim_id}`;
    else {
      anahtar = `u:${u._id}`;
      tasarimLimitleri[anahtar] = u.tasarim_stogu >= SINIRSIZ_TASARIM_STOGU ? null : Math.max(0, u.tasarim_stogu);
    }
    urunMap.set(String(u._id), { ...u, tasarim_anahtar: anahtar });
  }
  return { havuzlar, havuzMap: new Map(havuzlar.map(h => [String(h._id), h])), havuzStok, tasarimLimitleri, urunMap };
}

/** Müşteri panelindeki sipariş tablosu için katalog. */
async function katalog(kullanici) {
  const [m, ayar, paytr] = await Promise.all([musaitlik(), ayarlariGetir(), paytrGetir()]);
  const gorseller = await urunGorselleri([...m.urunMap.values()].map(u => u.wc_urun_id));
  const tablolar = m.havuzlar.map(h => ({
    id: h._id,
    etiket: h.etiket,
    bedenler: h.bedenler,
    birim_fiyat: h.toptan_fiyat,
    stoklar: m.havuzStok[h._id],
    urunler: [...m.urunMap.values()].filter(u => String(u.havuz_id) === String(h._id)).map(u => ({
      id: u._id, ad: u.wc_urun_adi, wc_urun_id: u.wc_urun_id, gorsel: gorseller[u.wc_urun_id] || '', tasarim_anahtar: u.tasarim_anahtar,
    })),
  })).filter(t => t.urunler.length);
  return {
    ayarlar: {
      min_stok_adet: ayar.min_stok_adet,
      min_on_siparis_adet: ayar.min_on_siparis_adet,
      kademeler: ayar.kademeler,
      odeme_sure_saat: ayar.odeme_sure_saat,
      on_siparis_sure: ayar.on_siparis_sure,
      fiyat_notu: ayar.fiyat_notu,
      havale_bilgisi: ayar.havale_bilgisi,
      odeme_yontemleri: { paytr: paytrHazir(paytr), havale: !!ayar.havale_bilgisi.trim() },
    },
    musteri: {
      iskonto: kullanici.toptan_iskonto || 0,
      teslimat: {
        ad_soyad: [kullanici.ad, kullanici.soyad].filter(Boolean).join(' '),
        firma: kullanici.firma_adi || '', telefon: kullanici.telefon || '', email: kullanici.email || '',
        adres: kullanici.adres || '', il: '', vergi_no: kullanici.vergi_no || '',
      },
    },
    tablolar,
    tasarim_limitleri: m.tasarimLimitleri,
  };
}

// ----- Doğrulama + fiyat -----

function dogrula(girdi, m) {
  const hatalar = [];
  const birlesik = new Map();
  for (const k of (Array.isArray(girdi) ? girdi : [])) {
    const adet = parseInt(k.adet, 10);
    if (!adet || adet < 1) continue;
    if (adet > 100000) { hatalar.push('Geçersiz adet.'); continue; }
    const tip = k.tip === 'on_siparis' ? 'on_siparis' : 'stok';
    const urun = m.urunMap.get(String(k.havuz_urun_id));
    if (!urun) { hatalar.push('Listede olmayan bir ürün seçilmiş - sayfayı yenileyip tekrar deneyin.'); continue; }
    const havuz = m.havuzMap.get(String(urun.havuz_id));
    if (!havuz || !havuz.bedenler.includes(k.beden)) { hatalar.push(`${urun.wc_urun_adi}: geçersiz beden.`); continue; }
    const anahtar = `${tip}|${urun._id}|${k.beden}`;
    const onceki = birlesik.get(anahtar);
    if (onceki) onceki.adet += adet;
    else birlesik.set(anahtar, {
      tip, havuz_id: havuz._id, havuz_etiket: havuz.etiket, havuz_urun_id: urun._id, wc_urun_id: urun.wc_urun_id,
      urun_adi: urun.wc_urun_adi, beden: k.beden, adet, birim_fiyat: havuz.toptan_fiyat, tasarim_anahtar: urun.tasarim_anahtar,
    });
  }
  const kalemler = [...birlesik.values()];

  // Stoktan kalemler: beden sütunu toplamı havuz stoğunu, tasarım toplamı tasarım stoğunu aşamaz.
  const sutun = new Map(), tasarim = new Map();
  for (const k of kalemler.filter(k => k.tip === 'stok')) {
    const s = `${k.havuz_id}|${k.beden}`;
    sutun.set(s, (sutun.get(s) || 0) + k.adet);
    tasarim.set(k.tasarim_anahtar, (tasarim.get(k.tasarim_anahtar) || 0) + k.adet);
  }
  for (const [s, adet] of sutun) {
    const [havuzId, beden] = s.split('|');
    const mevcut = (m.havuzStok[havuzId] || {})[beden] || 0;
    if (adet > mevcut) hatalar.push(`${m.havuzMap.get(havuzId).etiket} - ${beden}: stokta ${mevcut} adet var, ${adet} istendi. Fazlasını ön sipariş olarak girebilirsiniz.`);
  }
  for (const [anahtar, adet] of tasarim) {
    const limit = m.tasarimLimitleri[anahtar];
    if (limit !== null && limit !== undefined && adet > limit) {
      const ornek = kalemler.find(k => k.tasarim_anahtar === anahtar);
      hatalar.push(`${ornek ? ornek.urun_adi : 'Bir tasarım'}: bu tasarımdan stokta toplam ${limit} adet var, ${adet} istendi.`);
    }
  }
  kalemler.forEach(k => { delete k.tasarim_anahtar; });
  return { kalemler, hatalar };
}

const yuvarla = (n) => Math.round(n * 100) / 100;

function fiyatHesapla(kalemler, ayar, musteriIskonto) {
  const araToplam = kalemler.reduce((t, k) => t + k.adet * k.birim_fiyat, 0);
  const toplamAdet = kalemler.reduce((t, k) => t + k.adet, 0);
  const kademe = (ayar.kademeler || []).filter(k => toplamAdet >= k.adet).reduce((m, k) => Math.max(m, k.indirim), 0);
  const musteri = Math.max(0, Math.min(90, musteriIskonto || 0));
  const toplam = yuvarla(araToplam * (1 - kademe / 100) * (1 - musteri / 100));
  return {
    ara_toplam: yuvarla(araToplam), kademe_indirim_orani: kademe, musteri_indirim_orani: musteri,
    indirim_tutari: yuvarla(araToplam - toplam), toplam,
    stok_adet: kalemler.filter(k => k.tip === 'stok').reduce((t, k) => t + k.adet, 0),
    on_siparis_adet: kalemler.filter(k => k.tip === 'on_siparis').reduce((t, k) => t + k.adet, 0),
  };
}

async function yeniSiparisNo() {
  const d = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Istanbul' }).slice(2, 10).replace(/-/g, '');
  for (let i = 0; i < 20; i++) {
    const no = `T${d}${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
    if (!(await ToptanSiparis.exists({ siparis_no: no }))) return no;
  }
  throw new Error('Sipariş numarası üretilemedi.');
}

function teslimatDogrula(t = {}) {
  const temiz = {};
  for (const alan of ['ad_soyad', 'firma', 'telefon', 'email', 'adres', 'il', 'vergi_no']) temiz[alan] = String(t[alan] || '').trim().slice(0, 400);
  const eksik = [];
  if (!temiz.ad_soyad) eksik.push('ad soyad');
  if (!temiz.telefon) eksik.push('telefon');
  if (!/^\S+@\S+\.\S+$/.test(temiz.email)) eksik.push('geçerli e-posta');
  if (!temiz.adres) eksik.push('adres');
  if (!temiz.il) eksik.push('il');
  if (eksik.length) throw new KullaniciHatasi(`Teslimat bilgileri eksik: ${eksik.join(', ')}.`);
  return temiz;
}

// ----- Sipariş oluşturma / iptal / ödeme -----

async function siparisOlustur(kullanici, { kalemler, teslimat, musteri_notu }) {
  return kilitli(async () => {
    const [ayar, m] = await Promise.all([ayarlariGetir(), musaitlik()]);
    const { kalemler: temiz, hatalar } = dogrula(kalemler, m);
    if (hatalar.length) throw new KullaniciHatasi(hatalar.join('\n'));
    if (!temiz.length) throw new KullaniciHatasi('Tabloya en az bir adet girin.');
    const fiyat = fiyatHesapla(temiz, ayar, kullanici.toptan_iskonto);
    if (fiyat.stok_adet > 0 && fiyat.stok_adet < ayar.min_stok_adet) throw new KullaniciHatasi(`Stoktan siparişte en az ${ayar.min_stok_adet} adet olmalı (şu an ${fiyat.stok_adet}).`);
    if (fiyat.on_siparis_adet > 0 && fiyat.on_siparis_adet < ayar.min_on_siparis_adet) throw new KullaniciHatasi(`Ön siparişte en az ${ayar.min_on_siparis_adet} adet olmalı (şu an ${fiyat.on_siparis_adet}).`);
    const tes = teslimatDogrula(teslimat);

    const sip = await ToptanSiparis.create({
      siparis_no: await yeniSiparisNo(),
      musteri_id: kullanici._id,
      teslimat: tes,
      kalemler: temiz,
      ...fiyat,
      musteri_notu: String(musteri_notu || '').slice(0, 1000),
      gecmis: [{ olay: `Sipariş oluşturuldu (${fiyat.stok_adet} stoktan, ${fiyat.on_siparis_adet} ön sipariş)` }],
    });

    const stokKalemleri = temiz.filter(k => k.tip === 'stok');
    if (stokKalemleri.length) {
      let hareket;
      try {
        hareket = await motor.topluStokHareketi(stokKalemleri, -1);
      } catch (e) {
        await ToptanSiparis.deleteOne({ _id: sip._id });
        throw e;
      }
      sip.stok_dusuldu = true;
      sip.gecmis.push({ olay: `${fiyat.stok_adet} adet stoktan ayrıldı` });
      await sip.save();
      setImmediate(() => hareket.senkronla().catch(e => console.error('[Toptan] WooCommerce stok senkronu:', e.message)));
    }
    return sip;
  });
}

async function iptalEt(sip, neden) {
  return kilitli(async () => {
    const guncel = await ToptanSiparis.findById(sip._id);
    if (!guncel || guncel.durum === 'iptal') return guncel;
    if (guncel.stok_dusuldu && !guncel.stok_iade_edildi) {
      const hareket = await motor.topluStokHareketi(guncel.kalemler.filter(k => k.tip === 'stok'), +1);
      guncel.stok_iade_edildi = true;
      guncel.gecmis.push({ olay: `${guncel.stok_adet} adet stok geri eklendi` });
      setImmediate(() => hareket.senkronla().catch(e => console.error('[Toptan] WooCommerce stok senkronu:', e.message)));
    }
    guncel.durum = 'iptal';
    guncel.gecmis.push({ olay: `İptal edildi${neden ? `: ${neden}` : ''}` });
    await guncel.save();
    return guncel;
  });
}

async function odendiIsaretle(sip, yontem, aciklama) {
  sip.odeme.odendi = true;
  sip.odeme.odeme_tarihi = new Date();
  if (yontem) sip.odeme.yontem = yontem;
  if (sip.durum === 'odeme_bekliyor') sip.durum = 'odendi';
  sip.gecmis.push({ olay: aciklama || 'Ödeme alındı' });
  await sip.save();
  return sip;
}

/** Süresi içinde ödenmeyen siparişleri iptal eder, ayrılan stoğu geri bırakır. */
async function odemesizleriIptalEt() {
  const ayar = await ayarlariGetir();
  if (!ayar.odeme_sure_saat) return 0;
  const sinir = new Date(Date.now() - ayar.odeme_sure_saat * 3600 * 1000);
  const odemeEkraniSiniri = new Date(Date.now() - 60 * 60 * 1000); // son 1 saatte PayTR ekranı açıldıysa bekle
  const adaylar = await ToptanSiparis.find({ durum: 'odeme_bekliyor', 'odeme.odendi': false, createdAt: { $lt: sinir } });
  let sayi = 0;
  for (const s of adaylar) {
    if (s.odeme.paytr_token_zamani && s.odeme.paytr_token_zamani > odemeEkraniSiniri) continue;
    await iptalEt(s, `${ayar.odeme_sure_saat} saat içinde ödeme yapılmadı`);
    sayi++;
  }
  if (sayi) console.log(`[Toptan] ${sayi} ödenmemiş sipariş otomatik iptal edildi.`);
  return sayi;
}

let zamanlayici = null;
function zamanlayiciBaslat() {
  if (zamanlayici) return;
  const calistir = () => odemesizleriIptalEt().catch(e => console.error('[Toptan] Otomatik iptal hatası:', e.message));
  setTimeout(calistir, 60 * 1000);
  zamanlayici = setInterval(calistir, 30 * 60 * 1000);
}

// ----- PayTR (iFrame API) -----

function hmac(anahtar, metin) {
  return crypto.createHmac('sha256', anahtar).update(metin).digest('base64');
}

function paytrSepeti(sip) {
  const oran = sip.ara_toplam > 0 ? sip.toplam / sip.ara_toplam : 1;
  const grup = new Map();
  for (const k of sip.kalemler) {
    const ad = `${k.urun_adi}${k.tip === 'on_siparis' ? ' (Ön sipariş)' : ''}`.slice(0, 100);
    const g = grup.get(ad) || { ad, fiyat: yuvarla(k.birim_fiyat * oran), adet: 0 };
    g.adet += k.adet;
    grup.set(ad, g);
  }
  const sepet = [...grup.values()].map(g => [g.ad, g.fiyat.toFixed(2), g.adet]);
  return Buffer.from(JSON.stringify(sepet)).toString('base64');
}

async function paytrToken(sip, { ip, tabanUrl }) {
  const p = await paytrGetir();
  if (!paytrHazir(p)) throw new KullaniciHatasi('Kartla ödeme şu an kullanılamıyor. Havale/EFT ile ödeyebilir ya da bizimle iletişime geçebilirsiniz.');
  if (sip.durum === 'iptal') throw new KullaniciHatasi('Bu sipariş iptal edilmiş.');
  if (sip.odeme.odendi) throw new KullaniciHatasi('Bu sipariş zaten ödenmiş.');

  const alanlar = {
    merchant_id: p.merchant_id,
    user_ip: ip,
    merchant_oid: sip.siparis_no,
    email: sip.teslimat.email,
    payment_amount: String(Math.round(sip.toplam * 100)),
    user_basket: paytrSepeti(sip),
    no_installment: '0',
    max_installment: '0',
    currency: 'TL',
    test_mode: p.test_modu ? '1' : '0',
  };
  const hashMetni = alanlar.merchant_id + alanlar.user_ip + alanlar.merchant_oid + alanlar.email + alanlar.payment_amount
    + alanlar.user_basket + alanlar.no_installment + alanlar.max_installment + alanlar.currency + alanlar.test_mode;
  const govde = new URLSearchParams({
    ...alanlar,
    paytr_token: hmac(p.merchant_key, hashMetni + p.merchant_salt),
    debug_on: p.test_modu ? '1' : '0',
    user_name: (sip.teslimat.firma ? `${sip.teslimat.ad_soyad} - ${sip.teslimat.firma}` : sip.teslimat.ad_soyad).slice(0, 60),
    user_address: `${sip.teslimat.adres} ${sip.teslimat.il}`.slice(0, 400),
    user_phone: sip.teslimat.telefon.slice(0, 20),
    merchant_ok_url: `${tabanUrl}/api/toptan/odeme-sonuc?durum=basarili&no=${sip.siparis_no}`,
    merchant_fail_url: `${tabanUrl}/api/toptan/odeme-sonuc?durum=basarisiz&no=${sip.siparis_no}`,
    timeout_limit: '30',
    lang: 'tr',
  });
  const { data } = await axios.post('https://www.paytr.com/odeme/api/get-token', govde.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 20000,
  });
  if (!data || data.status !== 'success') throw new KullaniciHatasi(`PayTR ödeme ekranı açılamadı: ${(data && data.reason) || 'bilinmeyen hata'}`);

  sip.odeme.yontem = 'paytr';
  sip.odeme.paytr_tutar_kurus = Math.round(sip.toplam * 100);
  sip.odeme.paytr_token_zamani = new Date();
  sip.markModified('odeme');
  await sip.save();
  return { token: data.token, iframe_url: `https://www.paytr.com/odeme/guvenli/${data.token}` };
}

/** PayTR'ın sunucumuza gönderdiği ödeme sonucu bildirimi. Hash doğrulanmazsa reddedilir. */
async function paytrBildirim(govde) {
  const p = await paytrGetir();
  const { merchant_oid, status, total_amount, hash } = govde || {};
  if (!paytrHazir(p)) throw new Error('PayTR ayarlı değil');
  const beklenen = hmac(p.merchant_key, `${merchant_oid}${p.merchant_salt}${status}${total_amount}`);
  if (!hash || hash !== beklenen) throw new Error('PAYTR bildirim hash doğrulanamadı');

  const sip = await ToptanSiparis.findOne({ siparis_no: merchant_oid });
  if (!sip || sip.odeme.odendi) return; // bilinmeyen ya da zaten işlenmiş (PayTR aynı bildirimi tekrarlayabilir)
  sip.odeme.paytr_durum = status;
  if (status === 'success') {
    const tl = (parseInt(total_amount, 10) || 0) / 100;
    if (sip.durum === 'iptal') {
      sip.odeme.odendi = true;
      sip.odeme.odeme_tarihi = new Date();
      sip.gecmis.push({ olay: `⚠️ İPTAL EDİLMİŞ siparişe PayTR ödemesi geldi (${tl}₺) - stok yeniden ayrılmadı, iade ya da elle yeniden işleme gerekebilir` });
      sip.markModified('odeme');
      await sip.save();
    } else {
      await odendiIsaretle(sip, 'paytr', `PayTR ile ödendi (${tl.toLocaleString('tr-TR')}₺)`);
    }
  } else {
    sip.odeme.paytr_hata = `${govde.failed_reason_code || ''} ${govde.failed_reason_msg || ''}`.trim();
    sip.gecmis.push({ olay: `PayTR ödemesi başarısız: ${sip.odeme.paytr_hata || 'bilinmiyor'}` });
    sip.markModified('odeme');
    await sip.save();
  }
}

// ----- Raporlar -----

/** Ödenmiş ve henüz üretimi bitmemiş ön siparişlerin tasarım × beden toplamı - üretim planı için. */
async function uretimListesi() {
  const siparisler = await ToptanSiparis.find({ durum: { $in: ['odeme_bekliyor', 'odendi', 'hazirlaniyor', 'uretimde'] }, on_siparis_adet: { $gt: 0 } }).sort({ createdAt: 1 }).lean();
  const harita = new Map();
  for (const s of siparisler) {
    const odendi = !!(s.odeme && s.odeme.odendi);
    for (const k of s.kalemler.filter(k => k.tip === 'on_siparis')) {
      const anahtar = `${k.urun_adi}|${k.havuz_etiket}`;
      const satir = harita.get(anahtar) || { urun_adi: k.urun_adi, havuz_etiket: k.havuz_etiket, bedenler: {}, odenen: 0, bekleyen: 0, siparisler: new Set() };
      satir.bedenler[k.beden] = satir.bedenler[k.beden] || { odenen: 0, bekleyen: 0 };
      satir.bedenler[k.beden][odendi ? 'odenen' : 'bekleyen'] += k.adet;
      satir[odendi ? 'odenen' : 'bekleyen'] += k.adet;
      satir.siparisler.add(s.siparis_no);
      harita.set(anahtar, satir);
    }
  }
  return [...harita.values()].map(s => ({ ...s, siparisler: [...s.siparisler] })).sort((a, b) => b.odenen - a.odenen || b.bekleyen - a.bekleyen);
}

async function ozet() {
  const sayilar = await ToptanSiparis.aggregate([{ $group: { _id: '$durum', sayi: { $sum: 1 }, tutar: { $sum: '$toplam' } } }]);
  const s = {};
  sayilar.forEach(x => { s[x._id] = { sayi: x.sayi, tutar: x.tutar }; });
  return { durumlar: s, aksiyon_bekleyen: (s.odendi && s.odendi.sayi) || 0 };
}

module.exports = {
  KullaniciHatasi,
  ayarlariGetir, ayarlariKaydet, paytrGetir, paytrKaydet, paytrGorunumu,
  musaitlik, katalog, dogrula, fiyatHesapla,
  siparisOlustur, iptalEt, odendiIsaretle, odemesizleriIptalEt, zamanlayiciBaslat,
  paytrToken, paytrBildirim, paytrSepeti, hmac,
  uretimListesi, ozet,
};
