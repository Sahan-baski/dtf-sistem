/**
 * Site (WooCommerce) satış istatistikleri - mirasgiyim.com'daki GERÇEK
 * siparişlerden canlı hesaplanır (yerel Siparis koleksiyonundan bağımsız).
 * mirascocuk.com aynı mağazaya yönlendiriyor - veri WC_SITE_URL'deki
 * mağazadan okunur.
 *
 * Ne hesaplanıyor:
 *  - Seçili aralıkta ciro (iadeler düşülmüş), sipariş, satılan ürün adedi,
 *    ortalama sepet, günlük/aylık ortalamalar, en iyi gün, önceki döneme göre değişim
 *  - Hızlı kartlar: bugün, dün, son 7 gün, bu ay, geçen ay
 *  - Günlük ve aylık seri (grafik için, boş günler 0 ile doldurulur)
 *  - En çok satan tasarımlar (Stok Senkron'daki Master Tasarım bağlantısına
 *    göre gruplanır - aynı baskının krem/füme sweat + ekru/beyaz tişört gibi
 *    tüm ürünleri TEK tasarım sayılır; bağlantısı olmayan ürün, adının "–"
 *    işaretinden önceki kısmına göre gruplanır), en çok satan ürünler,
 *    beden dağılımı, il dağılımı, haftanın günü ve saat dağılımı.
 *
 * Sipariş durumları: "İşleniyor" + "Tamamlandı" ciroya sayılır. "Beklemede"
 * (genelde havalesi henüz gelmemiş) ayrıca "ödeme bekleyen" olarak gösterilir.
 * İptal/iade/başarısız/ödenmemiş siparişler hiç sayılmaz.
 */
const { client, hataMetni } = require('./wooClient');
const { HavuzUrun, MasterTasarim } = require('../models/stokSenkron');

const SAYILAN = new Set(['processing', 'completed']);
const BEKLEYEN = new Set(['on-hold']);
const MAX_SAYFA = 60; // 100/sayfa -> en fazla 6000 sipariş
const ONBELLEK_SURESI = 5 * 60 * 1000;
const onbellek = new Map(); // aralık anahtarı -> { zaman, veri }

const GUN_ADLARI = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const AY_ADLARI = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

// WooCommerce Türkiye il kodları plaka numarasıyla aynı (TR38 = Kayseri).
const ILLER = ['', 'Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Amasya', 'Ankara', 'Antalya', 'Artvin', 'Aydın', 'Balıkesir',
  'Bilecik', 'Bingöl', 'Bitlis', 'Bolu', 'Burdur', 'Bursa', 'Çanakkale', 'Çankırı', 'Çorum', 'Denizli', 'Diyarbakır', 'Edirne',
  'Elazığ', 'Erzincan', 'Erzurum', 'Eskişehir', 'Gaziantep', 'Giresun', 'Gümüşhane', 'Hakkari', 'Hatay', 'Isparta', 'Mersin',
  'İstanbul', 'İzmir', 'Kars', 'Kastamonu', 'Kayseri', 'Kırklareli', 'Kırşehir', 'Kocaeli', 'Konya', 'Kütahya', 'Malatya',
  'Manisa', 'Kahramanmaraş', 'Mardin', 'Muğla', 'Muş', 'Nevşehir', 'Niğde', 'Ordu', 'Rize', 'Sakarya', 'Samsun', 'Siirt',
  'Sinop', 'Sivas', 'Tekirdağ', 'Tokat', 'Trabzon', 'Tunceli', 'Şanlıurfa', 'Uşak', 'Van', 'Yozgat', 'Zonguldak', 'Aksaray',
  'Bayburt', 'Karaman', 'Kırıkkale', 'Batman', 'Şırnak', 'Bartın', 'Ardahan', 'Iğdır', 'Yalova', 'Karabük', 'Kilis',
  'Osmaniye', 'Düzce'];

function ilAdi(kod) {
  const m = /^TR(\d{2})$/.exec(kod || '');
  if (m && ILLER[parseInt(m[1], 10)]) return ILLER[parseInt(m[1], 10)];
  return kod || 'Belirtilmemiş';
}

// ----- Tarih yardımcıları ('YYYY-MM-DD' metinleriyle, saat dilimi kayması olmadan) -----

function bugunTR() {
  // Sunucu (Render) UTC çalışıyor - "bugün" Türkiye saatine göre olmalı.
  return new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Istanbul' }).slice(0, 10);
}
function gunEkle(gun, n) {
  const [y, a, g] = gun.split('-').map(Number);
  const d = new Date(Date.UTC(y, a - 1, g + n));
  return d.toISOString().slice(0, 10);
}
function gunFarki(bas, bit) {
  const [y1, a1, g1] = bas.split('-').map(Number);
  const [y2, a2, g2] = bit.split('-').map(Number);
  return Math.round((Date.UTC(y2, a2 - 1, g2) - Date.UTC(y1, a1 - 1, g1)) / 86400000);
}
function ayBasi(gun) { return gun.slice(0, 8) + '01'; }
function oncekiAyBasi(gun) {
  const [y, a] = gun.split('-').map(Number);
  const d = new Date(Date.UTC(y, a - 2, 1));
  return d.toISOString().slice(0, 10);
}
function haftaninGunu(gun) {
  const [y, a, g] = gun.split('-').map(Number);
  return new Date(Date.UTC(y, a - 1, g)).getUTCDay();
}

/** Aralık anahtarından başlangıç/bitiş günü (tümü için başlangıç null = ilk siparişten itibaren). */
function araligiCoz({ aralik, baslangic, bitis }) {
  const bugun = bugunTR();
  if (baslangic || bitis) return { baslangic: baslangic || null, bitis: bitis || bugun };
  switch (aralik) {
    case 'bugun': return { baslangic: bugun, bitis: bugun };
    case '7gun': return { baslangic: gunEkle(bugun, -6), bitis: bugun };
    case 'buay': return { baslangic: ayBasi(bugun), bitis: bugun };
    case '3ay': return { baslangic: gunEkle(bugun, -89), bitis: bugun };
    case 'yil': return { baslangic: bugun.slice(0, 4) + '-01-01', bitis: bugun };
    case 'tumu': return { baslangic: null, bitis: bugun };
    case '30gun':
    default: return { baslangic: gunEkle(bugun, -29), bitis: bugun };
  }
}

// ----- WooCommerce'ten sipariş çekme -----

const ALANLAR = 'id,status,date_created,total,refunds,line_items,shipping,billing,payment_method_title';

async function sayfaCek(sonra, sayfa) {
  return client().get('/orders', {
    params: {
      status: 'processing,completed,on-hold',
      after: sonra ? `${sonra}T00:00:00` : undefined,
      page: sayfa,
      per_page: 100,
      orderby: 'date',
      order: 'desc',
      _fields: ALANLAR,
    },
  });
}

/** Verilen günden (dahil) bugüne kadarki tüm sayılan/bekleyen siparişler. İlk sayfadan sonra kalanları 4'erli paralel çeker. */
async function siparisleriCek(sonra) {
  const ilk = await sayfaCek(sonra, 1);
  const siparisler = [...ilk.data];
  const toplamSayfa = Math.min(parseInt(ilk.headers['x-wp-totalpages'], 10) || 1, MAX_SAYFA);
  const eksik = (parseInt(ilk.headers['x-wp-totalpages'], 10) || 1) > MAX_SAYFA;
  const kalan = [];
  for (let s = 2; s <= toplamSayfa; s++) kalan.push(s);
  while (kalan.length) {
    const grup = kalan.splice(0, 4);
    const cevaplar = await Promise.all(grup.map(s => sayfaCek(sonra, s)));
    cevaplar.forEach(c => siparisler.push(...c.data));
  }
  return { siparisler, eksik };
}

/** WC ürün ID -> Master Tasarım adı (Stok Senkron panelindeki bağlantılardan). */
async function tasarimHaritasi() {
  const harita = new Map();
  const baglilar = await HavuzUrun.find({ master_tasarim_id: { $ne: null } }, { wc_urun_id: 1, master_tasarim_id: 1 }).lean();
  if (!baglilar.length) return harita;
  const masterlar = await MasterTasarim.find({ _id: { $in: baglilar.map(b => b.master_tasarim_id) } }, { ad: 1 }).lean();
  const adlar = new Map(masterlar.map(m => [String(m._id), m.ad]));
  for (const b of baglilar) {
    const ad = adlar.get(String(b.master_tasarim_id));
    if (ad) harita.set(b.wc_urun_id, ad);
  }
  return harita;
}

/** Bağlantısı olmayan ürünler için tasarım adı tahmini: "Hezarfen Ahmet Çelebi – Krem Pamuklu..." -> "Hezarfen Ahmet Çelebi". */
function isimdenTasarim(ad) {
  const ilkParca = String(ad || '').split(/\s+[–—-]\s+|\s+[“”"]/)[0];
  return ilkParca.replace(/[“”"]/g, '').trim() || String(ad || '').trim();
}

function bedenBul(kalem) {
  const meta = kalem.meta_data || [];
  const eslesen = meta.find(m => /beden|size/i.test(m.display_key || m.key || ''));
  return eslesen ? String(eslesen.display_value || eslesen.value || '').trim() : '';
}

function yuvarla(s) { return Math.round(s * 100) / 100; }

/** Bir siparişi tek bir sade kayda indirger (iadeler düşülmüş net tutar dahil). */
function siparisiSadelestir(s) {
  const iade = (s.refunds || []).reduce((t, r) => t + Math.abs(parseFloat(r.total) || 0), 0);
  const tarih = String(s.date_created || ''); // site saatiyle, ör. "2026-09-18T21:34:12"
  const kalemler = (s.line_items || []).map(k => ({
    urun_id: k.product_id,
    ad: k.parent_name || k.name || `Ürün #${k.product_id}`,
    adet: k.quantity || 0,
    tutar: parseFloat(k.total) || 0,
    beden: bedenBul(k),
  }));
  return {
    durum: s.status,
    gun: tarih.slice(0, 10),
    saat: parseInt(tarih.slice(11, 13), 10) || 0,
    net: Math.max(0, (parseFloat(s.total) || 0) - iade),
    adet: kalemler.reduce((t, k) => t + k.adet, 0),
    kalemler,
    il: ilAdi((s.shipping && s.shipping.state) || (s.billing && s.billing.state)),
    odeme: s.payment_method_title || 'Belirtilmemiş',
  };
}

function ozetle(liste) {
  const ciro = liste.reduce((t, s) => t + s.net, 0);
  const adet = liste.reduce((t, s) => t + s.adet, 0);
  return { ciro: yuvarla(ciro), siparis: liste.length, adet };
}

function yuzdeDegisim(simdi, once) {
  if (!once) return null;
  return Math.round(((simdi - once) / once) * 1000) / 10;
}

function sirala(map, alan = 'adet', limit = 50) {
  return Array.from(map.values())
    .map(x => ({ ...x, ciro: yuvarla(x.ciro || 0) }))
    .sort((a, b) => b[alan] - a[alan])
    .slice(0, limit);
}

async function siteIstatistikleri({ aralik = '30gun', baslangic, bitis, yenile = false } = {}) {
  const coz = araligiCoz({ aralik, baslangic, bitis });
  const anahtar = `${coz.baslangic || 'tumu'}_${coz.bitis}`;
  const onceki = onbellek.get(anahtar);
  if (!yenile && onceki && Date.now() - onceki.zaman < ONBELLEK_SURESI) return onceki.veri;

  const bugun = bugunTR();
  // Hızlı kartlar (geçen ay dahil) ve "önceki döneme göre" kıyası için
  // seçili aralıktan daha geriye de gitmemiz gerekiyor.
  let cekBaslangic = null;
  if (coz.baslangic) {
    const gunSayisi = gunFarki(coz.baslangic, coz.bitis) + 1;
    const oncekiDonemBas = gunEkle(coz.baslangic, -gunSayisi);
    cekBaslangic = [oncekiDonemBas, oncekiAyBasi(bugun), gunEkle(bugun, -6)].sort()[0];
  }

  const [{ siparisler: ham, eksik }, tasarimlar] = await Promise.all([siparisleriCek(cekBaslangic), tasarimHaritasi()]);
  const hepsi = ham.map(siparisiSadelestir).filter(s => s.gun);
  const sayilan = hepsi.filter(s => SAYILAN.has(s.durum));
  const bekleyen = hepsi.filter(s => BEKLEYEN.has(s.durum));

  const ilkGun = sayilan.length ? sayilan.reduce((m, s) => (s.gun < m ? s.gun : m), sayilan[0].gun) : bugun;
  const bas = coz.baslangic || ilkGun;
  const bit = coz.bitis;
  const aralikta = s => s.gun >= bas && s.gun <= bit;
  const donem = sayilan.filter(aralikta);
  const gunSayisi = Math.max(1, gunFarki(bas, bit) + 1);

  // ----- Ana özet -----
  const ana = ozetle(donem);
  const ozet = {
    ...ana,
    ortalama_sepet: ana.siparis ? yuvarla(ana.ciro / ana.siparis) : 0,
    gun_sayisi: gunSayisi,
    gunluk_ortalama_ciro: yuvarla(ana.ciro / gunSayisi),
    gunluk_ortalama_adet: Math.round((ana.adet / gunSayisi) * 10) / 10,
    gunluk_ortalama_siparis: Math.round((ana.siparis / gunSayisi) * 10) / 10,
    aylik_ortalama_ciro: yuvarla((ana.ciro / gunSayisi) * 30),
    urun_basi_ortalama: ana.adet ? yuvarla(ana.ciro / ana.adet) : 0,
    bekleyen: ozetle(bekleyen.filter(aralikta)),
  };
  if (coz.baslangic) {
    const oBas = gunEkle(bas, -gunSayisi);
    const oBit = gunEkle(bas, -1);
    const oncekiDonem = ozetle(sayilan.filter(s => s.gun >= oBas && s.gun <= oBit));
    ozet.onceki_donem = { ...oncekiDonem, baslangic: oBas, bitis: oBit };
    ozet.degisim = {
      ciro: yuzdeDegisim(ana.ciro, oncekiDonem.ciro),
      adet: yuzdeDegisim(ana.adet, oncekiDonem.adet),
      siparis: yuzdeDegisim(ana.siparis, oncekiDonem.siparis),
    };
  }

  // ----- Hızlı kartlar -----
  const gunAraligi = (b, e) => ozetle(sayilan.filter(s => s.gun >= b && s.gun <= e));
  const dun = gunEkle(bugun, -1);
  const gecenAyBas = oncekiAyBasi(bugun);
  const gecenAyBit = gunEkle(ayBasi(bugun), -1);
  const hizli = {
    bugun: gunAraligi(bugun, bugun),
    dun: gunAraligi(dun, dun),
    son7: gunAraligi(gunEkle(bugun, -6), bugun),
    bu_ay: gunAraligi(ayBasi(bugun), bugun),
    gecen_ay: gunAraligi(gecenAyBas, gecenAyBit),
    bu_ay_gun_sayisi: gunFarki(ayBasi(bugun), bugun) + 1,
  };
  // Bu ayın, şimdiki hızla ay sonunda ulaşacağı tahmini ciro.
  const ayinGunSayisi = new Date(Date.UTC(+bugun.slice(0, 4), +bugun.slice(5, 7), 0)).getUTCDate();
  hizli.bu_ay_tahmini = yuvarla((hizli.bu_ay.ciro / hizli.bu_ay_gun_sayisi) * ayinGunSayisi);

  // ----- Seriler -----
  const gunlukMap = new Map();
  for (let g = bas; g <= bit; g = gunEkle(g, 1)) gunlukMap.set(g, { tarih: g, ciro: 0, adet: 0, siparis: 0 });
  const aylikMap = new Map();
  for (const s of donem) {
    const g = gunlukMap.get(s.gun);
    if (g) { g.ciro += s.net; g.adet += s.adet; g.siparis++; }
    const ay = s.gun.slice(0, 7);
    const a = aylikMap.get(ay) || { ay, ciro: 0, adet: 0, siparis: 0 };
    a.ciro += s.net; a.adet += s.adet; a.siparis++;
    aylikMap.set(ay, a);
  }
  const gunluk = Array.from(gunlukMap.values()).map(g => ({
    ...g,
    ciro: yuvarla(g.ciro),
    etiket: `${parseInt(g.tarih.slice(8), 10)} ${AY_ADLARI[parseInt(g.tarih.slice(5, 7), 10) - 1]}`,
  }));
  const aylik = Array.from(aylikMap.values()).sort((a, b) => a.ay.localeCompare(b.ay)).map(a => ({
    ...a,
    ciro: yuvarla(a.ciro),
    etiket: `${AY_ADLARI[parseInt(a.ay.slice(5, 7), 10) - 1]} ${a.ay.slice(2, 4)}`,
  }));
  const enIyiGun = gunluk.reduce((m, g) => (!m || g.ciro > m.ciro ? g : m), null);

  // ----- Dağılımlar -----
  const tasarimMap = new Map(), urunMap = new Map(), bedenMap = new Map(), ilMap = new Map(), odemeMap = new Map();
  const haftaGunleri = GUN_ADLARI.map((ad, i) => ({ gun: ad, sira: i, ciro: 0, adet: 0, siparis: 0 }));
  const saatler = Array.from({ length: 24 }, (_, i) => ({ saat: `${String(i).padStart(2, '0')}:00`, siparis: 0 }));

  for (const s of donem) {
    const hg = haftaGunleri[haftaninGunu(s.gun)];
    hg.ciro += s.net; hg.adet += s.adet; hg.siparis++;
    saatler[s.saat].siparis++;
    const il = ilMap.get(s.il) || { il: s.il, siparis: 0, ciro: 0 };
    il.siparis++; il.ciro += s.net; ilMap.set(s.il, il);
    const od = odemeMap.get(s.odeme) || { yontem: s.odeme, siparis: 0, ciro: 0 };
    od.siparis++; od.ciro += s.net; odemeMap.set(s.odeme, od);

    for (const k of s.kalemler) {
      const eslesme = tasarimlar.get(k.urun_id);
      const tAd = eslesme || isimdenTasarim(k.ad);
      const tKey = tAd.toLocaleLowerCase('tr-TR');
      const t = tasarimMap.get(tKey) || { ad: tAd, adet: 0, ciro: 0, urunler: new Set(), eslesmeli: !!eslesme };
      t.adet += k.adet; t.ciro += k.tutar; t.urunler.add(k.urun_id);
      if (eslesme) t.eslesmeli = true;
      tasarimMap.set(tKey, t);

      const u = urunMap.get(k.urun_id) || { id: k.urun_id, ad: k.ad, adet: 0, ciro: 0 };
      u.adet += k.adet; u.ciro += k.tutar; urunMap.set(k.urun_id, u);

      const bAd = k.beden || 'Bedensiz';
      const b = bedenMap.get(bAd) || { beden: bAd, adet: 0 };
      b.adet += k.adet; bedenMap.set(bAd, b);
    }
  }

  const toplamAdet = ana.adet || 1;
  const tasarimListesi = sirala(tasarimMap, 'adet', 50).map(t => ({
    ad: t.ad, adet: t.adet, ciro: t.ciro, urun_sayisi: t.urunler.size, eslesmeli: t.eslesmeli,
    oran: Math.round((t.adet / toplamAdet) * 1000) / 10,
  }));
  const bedenSirasi = b => { const m = /\d+/.exec(b.beden); return m ? parseInt(m[0], 10) : 999; };

  const veri = {
    site: (process.env.WC_SITE_URL || '').replace(/\/+$/, ''),
    guncellenme: new Date().toISOString(),
    aralik: { anahtar: aralik, baslangic: bas, bitis: bit },
    tarama_eksik_kaldi: eksik,
    ozet,
    hizli,
    gunluk,
    aylik,
    en_iyi_gun: enIyiGun && enIyiGun.ciro > 0 ? enIyiGun : null,
    tasarimlar: tasarimListesi,
    urunler: sirala(urunMap, 'adet', 50).map(u => ({ ...u, oran: Math.round((u.adet / toplamAdet) * 1000) / 10 })),
    bedenler: Array.from(bedenMap.values()).sort((a, b) => bedenSirasi(a) - bedenSirasi(b) || a.beden.localeCompare(b.beden)),
    iller: sirala(ilMap, 'siparis', 15),
    odeme_yontemleri: sirala(odemeMap, 'siparis', 10),
    hafta_gunleri: [...haftaGunleri.slice(1), haftaGunleri[0]].map(h => ({ ...h, ciro: yuvarla(h.ciro) })), // Pazartesi'den başlasın
    saatler,
  };
  onbellek.set(anahtar, { zaman: Date.now(), veri });
  return veri;
}

module.exports = { siteIstatistikleri, hataMetni, _test: { araligiCoz, gunEkle, gunFarki, isimdenTasarim, siparisiSadelestir, ilAdi } };
