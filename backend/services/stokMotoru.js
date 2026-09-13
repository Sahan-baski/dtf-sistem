/**
 * Çekirdek senkron mantığı - İKİ KATMANLI stok modeli:
 *   1) Havuz + beden başına HAM stok (o bedende kaç boş ürün var - havuzdaki
 *      tüm ürünler paylaşır).
 *   2) Ürünün kendi "tasarım stoğu" (elindeki DTF kağıdı sayısı) - bir
 *      MasterTasarim kaydına bağlıysa oradan çözülür, değilse ürünün kendi
 *      tasarim_stogu alanından.
 * Sitede (WooCommerce'de) görünen stok HER ZAMAN bu ikisinin KÜÇÜK OLANIDIR.
 * Bu iki sayıdan biri değiştiğinde etkilenen tüm hücreler yeniden hesaplanıp
 * ilgili WooCommerce varyasyonuna hemen (REST API ile) yazılır.
 */
const { StokHavuzu, HavuzBedenStok, MasterTasarim, HavuzUrun, SINIRSIZ_TASARIM_STOGU } = require('../models/stokSenkron');
const woo = require('./wooHelpers');

async function havuzBedenleri(havuzId) {
  const havuz = await StokHavuzu.findById(havuzId);
  return havuz ? havuz.bedenler : [];
}

async function havuzStok(havuzId, beden) {
  const row = await HavuzBedenStok.findOne({ havuz_id: havuzId, beden });
  return row ? row.miktar : 0;
}

async function havuzStokAyarla(havuzId, beden, miktar) {
  miktar = Math.max(0, parseInt(miktar, 10) || 0);
  await HavuzBedenStok.findOneAndUpdate({ havuz_id: havuzId, beden }, { miktar }, { upsert: true });
  return miktar;
}

/** Bir ürünün GÖRÜNEN tasarım stoğu - bağlıysa master kaydın, değilse kendi sütununun değeri. */
async function tasarimStogu(havuzUrun) {
  if (havuzUrun.master_tasarim_id) {
    const master = await MasterTasarim.findById(havuzUrun.master_tasarim_id);
    if (master) return master.stok;
  }
  return havuzUrun.tasarim_stogu;
}

async function varyasyonaYaz(havuzUrun, beden, miktar) {
  const v = (havuzUrun.varyasyonlar || []).find(x => x.beden === beden);
  if (!v || !v.wc_varyasyon_id) return;
  try {
    await woo.varyasyonStokYaz(havuzUrun.wc_urun_id, v.wc_varyasyon_id, miktar);
  } catch (e) {
    console.error('[StokSenkron] Varyasyon stoğu yazılamadı:', havuzUrun.wc_urun_id, v.wc_varyasyon_id, woo.hataMetni(e));
    throw new Error(woo.hataMetni(e));
  }
}

async function hucreyiYenidenHesapla(havuzUrunId, beden) {
  const havuzUrun = await HavuzUrun.findById(havuzUrunId);
  if (!havuzUrun) return 0;
  const hs = await havuzStok(havuzUrun.havuz_id, beden);
  const ts = await tasarimStogu(havuzUrun);
  const gorunen = Math.min(hs, ts);
  await varyasyonaYaz(havuzUrun, beden, gorunen);
  return gorunen;
}

async function havuzBedeniYenidenHesapla(havuzId, beden) {
  const urunler = await HavuzUrun.find({ havuz_id: havuzId });
  const sonuclar = await Promise.allSettled(urunler.map(u => hucreyiYenidenHesapla(u._id, beden)));
  return ilkHatayiFirlat(sonuclar);
}

async function urununTumBedenleriniYenidenHesapla(havuzUrunId) {
  const havuzUrun = await HavuzUrun.findById(havuzUrunId);
  if (!havuzUrun) return;
  const bedenler = await havuzBedenleri(havuzUrun.havuz_id);
  const sonuclar = await Promise.allSettled(bedenler.map(b => hucreyiYenidenHesapla(havuzUrunId, b)));
  return ilkHatayiFirlat(sonuclar);
}

function ilkHatayiFirlat(sonuclar) {
  const basarisiz = sonuclar.find(s => s.status === 'rejected');
  if (basarisiz) throw basarisiz.reason;
}

async function havuzHamStoguAyarla(havuzId, beden, miktar) {
  const yeni = await havuzStokAyarla(havuzId, beden, miktar);
  await havuzBedeniYenidenHesapla(havuzId, beden);
  return yeni;
}

async function urunTasarimStoguAyarla(havuzUrunId, miktar) {
  miktar = Math.max(0, parseInt(miktar, 10) || 0);
  await HavuzUrun.findByIdAndUpdate(havuzUrunId, { tasarim_stogu: miktar });
  await urununTumBedenleriniYenidenHesapla(havuzUrunId);
  return miktar;
}

async function masterTasarimStoguAyarla(masterId, miktar) {
  miktar = Math.max(0, parseInt(miktar, 10) || 0);
  await MasterTasarim.findByIdAndUpdate(masterId, { stok: miktar });
  const bagliUrunler = await HavuzUrun.find({ master_tasarim_id: masterId });
  for (const u of bagliUrunler) await urununTumBedenleriniYenidenHesapla(u._id);
  return miktar;
}

async function masterTasarimOlustur(ad, stok) {
  const doc = await MasterTasarim.create({ ad, stok: Math.max(0, parseInt(stok, 10) || 0) });
  return doc;
}

async function masterTasarimAdDegistir(masterId, ad) {
  await MasterTasarim.findByIdAndUpdate(masterId, { ad });
}

async function baglantiyiKaldir(havuzUrunId) {
  const havuzUrun = await HavuzUrun.findById(havuzUrunId);
  if (!havuzUrun) return;
  const donmusDeger = await tasarimStogu(havuzUrun); // bağlıyken çözümlenmiş son değer
  await HavuzUrun.findByIdAndUpdate(havuzUrunId, { tasarim_stogu: donmusDeger, master_tasarim_id: null });
  await urununTumBedenleriniYenidenHesapla(havuzUrunId);
}

async function masterTasarimaBagla(havuzUrunId, masterId) {
  if (!masterId) return baglantiyiKaldir(havuzUrunId);
  const master = await MasterTasarim.findById(masterId);
  if (!master) throw new Error('Seçilen tasarım bulunamadı.');
  await HavuzUrun.findByIdAndUpdate(havuzUrunId, { master_tasarim_id: masterId });
  await urununTumBedenleriniYenidenHesapla(havuzUrunId);
}

async function masterTasarimSil(masterId) {
  const bagliUrunler = await HavuzUrun.find({ master_tasarim_id: masterId });
  for (const u of bagliUrunler) await baglantiyiKaldir(u._id);
  await MasterTasarim.findByIdAndDelete(masterId);
}

/** Bir WooCommerce ürününü (değişken tip) havuza ekler / bedenlerini yeniden tespit eder. */
async function urunuHavuzaEkle(havuzId, wcUrunId) {
  const bedenler = await havuzBedenleri(havuzId);
  const varyasyonHaritasi = await woo.bedeneGoreVaryasyonlariTespitEt(wcUrunId);
  const varyasyonlar = bedenler.map(b => ({
    beden: b,
    wc_varyasyon_id: varyasyonHaritasi[woo.bedenNormallestir(b)] || 0,
  }));
  const urun = await woo.urunGetir(wcUrunId);

  const mevcut = await HavuzUrun.findOne({ havuz_id: havuzId, wc_urun_id: wcUrunId });
  if (mevcut) {
    mevcut.varyasyonlar = varyasyonlar;
    if (urun) { mevcut.wc_urun_adi = urun.name; mevcut.wc_duzenleme_linki = woo.duzenlemeLinki(wcUrunId); }
    await mevcut.save();
    return mevcut;
  }

  return HavuzUrun.create({
    havuz_id: havuzId,
    wc_urun_id: wcUrunId,
    wc_urun_adi: urun ? urun.name : `#${wcUrunId}`,
    wc_duzenleme_linki: woo.duzenlemeLinki(wcUrunId),
    tasarim_stogu: SINIRSIZ_TASARIM_STOGU,
    varyasyonlar,
  });
}

async function urunuHavuzdanCikar(havuzUrunId) {
  await HavuzUrun.findByIdAndDelete(havuzUrunId);
}

/**
 * Havuzun hâlâ 0 olan (hiç elle girilmemiş) bedenlerini, o havuzdaki ürünlerin
 * WooCommerce'te ZATEN kayıtlı gerçek varyasyon stoklarından besler - "tabloyu
 * her açtığımda mevcut stoğum senkron görünmeli" beklentisi için. Havuzda o
 * beden için zaten bir sayı varsa asla üzerine yazmaz.
 */
async function mevcutStoktanBesle(havuzId) {
  const urunler = await HavuzUrun.find({ havuz_id: havuzId });
  if (!urunler.length) return;
  const bedenler = await havuzBedenleri(havuzId);

  for (const beden of bedenler) {
    if ((await havuzStok(havuzId, beden)) > 0) continue;

    let enYuksek = 0;
    for (const u of urunler) {
      const v = (u.varyasyonlar || []).find(x => x.beden === beden);
      if (!v || !v.wc_varyasyon_id) continue;
      const varyasyon = await woo.varyasyonGetir(u.wc_urun_id, v.wc_varyasyon_id);
      if (varyasyon && varyasyon.manage_stock && typeof varyasyon.stock_quantity === 'number' && varyasyon.stock_quantity > enYuksek) {
        enYuksek = varyasyon.stock_quantity;
      }
    }
    if (enYuksek > 0) await havuzHamStoguAyarla(havuzId, beden, enYuksek);
  }
}

/** Yönetim tablosu için: havuzun tüm verisi (ham stok + tasarım stokları + hesaplanmış görünen değerler). */
async function tabloVerisi(havuzId, { besle = true } = {}) {
  if (besle) {
    try { await mevcutStoktanBesle(havuzId); }
    catch (e) { console.error('[StokSenkron] Mevcut stoktan besleme hatası:', e.message); }
  }

  const havuz = await StokHavuzu.findById(havuzId);
  if (!havuz) return null;
  const bedenler = havuz.bedenler;

  const havuzStoklari = {};
  for (const b of bedenler) havuzStoklari[b] = await havuzStok(havuzId, b);
  const havuzToplam = Object.values(havuzStoklari).reduce((a, b) => a + b, 0);

  const havuzUrunleri = await HavuzUrun.find({ havuz_id: havuzId }).sort({ createdAt: 1 });
  const masterTasarimlar = await MasterTasarim.find().sort({ ad: 1 });

  const urunler = [];
  for (const u of havuzUrunleri) {
    const ts = await tasarimStogu(u);
    let toplam = 0;
    const hucreler = bedenler.map(b => {
      const gorunen = Math.min(havuzStoklari[b], ts);
      toplam += gorunen;
      return { beden: b, gorunen };
    });
    urunler.push({
      id: u._id,
      wc_urun_id: u.wc_urun_id,
      ad: u.wc_urun_adi,
      duzenleme_linki: u.wc_duzenleme_linki,
      tasarim_stogu: ts,
      sinirsiz: !u.master_tasarim_id && ts >= SINIRSIZ_TASARIM_STOGU,
      master_tasarim_id: u.master_tasarim_id || null,
      hucreler,
      toplam,
    });
  }

  return {
    havuz_id: havuz._id,
    etiket: havuz.etiket,
    bedenler,
    havuz_stoklari: havuzStoklari,
    havuz_toplam: havuzToplam,
    urunler,
    master_tasarimlar: masterTasarimlar.map(m => ({ id: m._id, ad: m.ad, stok: m.stok })),
  };
}

/**
 * Bir SATIŞ olayını uygular (WooCommerce siparişinden webhook ile ya da
 * panelden elle "test satışı"). Aynı anda hem havuzun hem tasarımın/kağıdın
 * stoğunu düşürür - çünkü bir satış hem bir fiziksel ürünü hem bir baskıyı
 * tüketir. Etkilenen TÜM hücreler otomatik yeniden hesaplanıp yazılır.
 */
async function satisUygula(havuzUrunId, beden, adet) {
  adet = Math.max(0, parseInt(adet, 10) || 0);
  if (adet <= 0) return;

  const havuzUrun = await HavuzUrun.findById(havuzUrunId);
  if (!havuzUrun) return;

  const mevcutHavuzStok = await havuzStok(havuzUrun.havuz_id, beden);
  await havuzHamStoguAyarla(havuzUrun.havuz_id, beden, Math.max(0, mevcutHavuzStok - adet));

  if (havuzUrun.master_tasarim_id) {
    const master = await MasterTasarim.findById(havuzUrun.master_tasarim_id);
    await masterTasarimStoguAyarla(havuzUrun.master_tasarim_id, Math.max(0, (master ? master.stok : 0) - adet));
  } else {
    await urunTasarimStoguAyarla(havuzUrunId, Math.max(0, havuzUrun.tasarim_stogu - adet));
  }
}

/** WooCommerce varyasyon ID'sinden hangi havuz ürünü + bedene karşılık geldiğini bulur (webhook için). */
async function varyasyonIdIleBul(wcVaryasyonId) {
  const havuzUrun = await HavuzUrun.findOne({ 'varyasyonlar.wc_varyasyon_id': wcVaryasyonId });
  if (!havuzUrun) return null;
  const v = havuzUrun.varyasyonlar.find(x => x.wc_varyasyon_id === wcVaryasyonId);
  return v ? { havuzUrunId: havuzUrun._id, beden: v.beden } : null;
}

module.exports = {
  havuzBedenleri,
  havuzHamStoguAyarla,
  urunTasarimStoguAyarla,
  masterTasarimStoguAyarla,
  masterTasarimOlustur,
  masterTasarimAdDegistir,
  masterTasarimSil,
  masterTasarimaBagla,
  baglantiyiKaldir,
  urunuHavuzaEkle,
  urunuHavuzdanCikar,
  tabloVerisi,
  satisUygula,
  varyasyonIdIleBul,
};
