/**
 * Müşteri panelindeki "Miras Sipariş Alanı".
 *  - Sipariş Ver: Stok Senkron'daki gibi açılır listeden tablo seçilir; seçilen
 *    tablo iki ayrı matris olarak açılır (tasarım × beden):
 *      · Stoktan Sipariş (yeşil): eldeki stoktan; beden sütununun stoğu dolunca
 *        o sütunun boş kutuları pasifleşir.
 *      · Ön Sipariş / Üretim Talebi (turuncu): stokta olmayanlar, üretilecek.
 *    Hücreler doldurulup "Sepete Ekle" ile sepete atılır; farklı tablolardan
 *    eklenenler sepette birikir ve tek siparişte gönderilir.
 *  - Siparişlerim: durum, ödeme, tekrar sipariş, proforma yazdırma.
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { toptanApi } from '../api';
import { tl, tarih, DurumRozeti, SiparisMatrisi, proformaYazdir } from './ortak';

const hk = (urunId, beden) => `${urunId}|${beden}`;

export default function ToptanBolumu({ kullanici, toast }) {
  const kullaniciId = kullanici?._id || kullanici?.id || 'x';
  const taslakAnahtari = `toptan_taslak_${kullaniciId}`;
  const [sekme, setSekme] = useState('ver');
  const [katalog, setKatalog] = useState(null);
  const [hata, setHata] = useState('');
  const [yetkisiz, setYetkisiz] = useState(false);
  const [siparisler, setSiparisler] = useState([]);
  const [miktar, setMiktar] = useState(() => {
    try { return JSON.parse(localStorage.getItem(taslakAnahtari)) || {}; } catch { return {}; }
  });
  useEffect(() => { try { localStorage.setItem(taslakAnahtari, JSON.stringify(miktar)); } catch { /* yok say */ } }, [miktar, taslakAnahtari]);

  const katalogYukle = useCallback(async () => {
    try {
      const r = await toptanApi.katalog();
      setKatalog(r.data); setHata(''); setYetkisiz(false);
    } catch (e) {
      if (e.response?.data?.yetkisiz) setYetkisiz(true);
      setHata(e.response?.data?.hata || 'Ürün listesi yüklenemedi.');
    }
  }, []);
  const siparisleriYukle = useCallback(async () => {
    try { setSiparisler((await toptanApi.siparislerim()).data); } catch { /* katalog hatası zaten gösteriliyor */ }
  }, []);
  useEffect(() => { katalogYukle(); siparisleriYukle(); }, [katalogYukle, siparisleriYukle]);

  const yapi = useMemo(() => {
    if (!katalog) return null;
    const urunler = new Map();
    katalog.tablolar.forEach(t => t.urunler.forEach(u => urunler.set(String(u.id), { ...u, tablo: t })));
    return { urunler };
  }, [katalog]);

  // ----- Stok kapasitesi hesapları (sunucu da aynı kuralları tekrar kontrol ediyor) -----
  const kullanim = useCallback((m) => {
    const sutun = {}, tasarim = {};
    if (!yapi) return { sutun, tasarim };
    for (const [k, v] of Object.entries(m)) {
      if (!v.stok) continue;
      const [uid, b] = k.split('|');
      const u = yapi.urunler.get(uid);
      if (!u) continue;
      sutun[`${u.tablo.id}|${b}`] = (sutun[`${u.tablo.id}|${b}`] || 0) + v.stok;
      tasarim[u.tasarim_anahtar] = (tasarim[u.tasarim_anahtar] || 0) + v.stok;
    }
    return { sutun, tasarim };
  }, [yapi]);

  const stokMax = useCallback((m, kul, uid, b) => {
    const u = yapi.urunler.get(uid);
    if (!u) return 0;
    const mevcut = (m[hk(uid, b)] || {}).stok || 0;
    const sutunKalan = (u.tablo.stoklar[b] || 0) - (kul.sutun[`${u.tablo.id}|${b}`] || 0) + mevcut;
    const limit = katalog.tasarim_limitleri[u.tasarim_anahtar];
    const tasarimKalan = limit === null || limit === undefined ? Infinity : limit - (kul.tasarim[u.tasarim_anahtar] || 0) + mevcut;
    return Math.max(0, Math.min(sutunKalan, tasarimKalan));
  }, [yapi, katalog]);

  // Katalog her yüklendiğinde taslağı temizle: artık olmayan ürün/bedenleri at,
  // stok azalmışsa stoktan fazlasını ön siparişe kaydır.
  useEffect(() => {
    if (!yapi) return;
    setMiktar(eski => {
      const yeni = {};
      let tasinan = 0;
      for (const [k, v] of Object.entries(eski)) {
        const [uid, b] = k.split('|');
        const u = yapi.urunler.get(uid);
        if (!u || !u.tablo.bedenler.includes(b)) continue;
        yeni[k] = { stok: 0, on: v.on || 0 };
        const max = stokMax(yeni, kullanim(yeni), uid, b);
        const stok = Math.min(v.stok || 0, max);
        tasinan += (v.stok || 0) - stok;
        yeni[k] = { stok, on: (v.on || 0) + ((v.stok || 0) - stok) };
        if (!yeni[k].stok && !yeni[k].on) delete yeni[k];
      }
      if (tasinan > 0) setTimeout(() => toast(`Stok değiştiği için taslağındaki ${tasinan} adet ön siparişe kaydırıldı`, 'error'), 0);
      return yeni;
    });
  }, [yapi]); // eslint-disable-line react-hooks/exhaustive-deps

  const tekrarSiparis = (sip) => {
    if (!yapi) return;
    const yeni = {};
    let tasinan = 0, atlanan = 0;
    for (const k of sip.kalemler) {
      const uid = String(k.havuz_urun_id);
      const u = yapi.urunler.get(uid);
      if (!u || !u.tablo.bedenler.includes(k.beden)) { atlanan += k.adet; continue; }
      const key = hk(uid, k.beden);
      const h = yeni[key] || { stok: 0, on: 0 };
      if (k.tip === 'stok') {
        yeni[key] = h;
        const max = stokMax(yeni, kullanim(yeni), uid, k.beden);
        const alinan = Math.min(max - h.stok, k.adet);
        h.stok += Math.max(0, alinan);
        h.on += k.adet - Math.max(0, alinan);
        tasinan += k.adet - Math.max(0, alinan);
      } else h.on += k.adet;
      yeni[key] = h;
    }
    setMiktar(yeni);
    setSekme('ver');
    toast(`Önceki sipariş sepete yüklendi${tasinan ? ` - stok yetmeyen ${tasinan} adet ön siparişe alındı` : ''}${atlanan ? `, artık satışta olmayan ${atlanan} adet atlandı` : ''}`);
  };

  if (yetkisiz) {
    return (
      <div className="card" style={{ padding: 30, textAlign: 'center' }}>
        <i className="ti ti-lock" style={{ fontSize: 36, color: 'var(--text3)' }} />
        <div style={{ fontSize: 16, fontWeight: 700, margin: '10px 0 6px' }}>Miras Sipariş Alanı bu hesapta kullanılamıyor</div>
        <div style={{ color: 'var(--text2)', fontSize: 14 }}>{hata || 'Lütfen müşteri hesabınızla giriş yapın.'}</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', background: 'var(--bg3)', borderRadius: 'var(--radius-sm)', padding: 4, gap: 2, marginBottom: 18, width: 'fit-content' }}>
        {[['ver', 'Sipariş Ver', 'ti-table'], ['gecmis', `Siparişlerim${siparisler.length ? ` (${siparisler.length})` : ''}`, 'ti-list-details']].map(([k, ad, ikon]) => (
          <button key={k} onClick={() => setSekme(k)}
            style={{ padding: '7px 16px', border: 'none', borderRadius: 'var(--radius-sm)', background: sekme === k ? 'var(--bg)' : 'none', color: sekme === k ? 'var(--text)' : 'var(--text2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <i className={`ti ${ikon}`} />{ad}
          </button>
        ))}
      </div>

      {hata && !katalog && <div className="card" style={{ padding: 20, color: 'var(--red)' }}>{hata}</div>}

      {sekme === 'ver' && katalog && (
        <SiparisVer
          katalog={katalog} yapi={yapi} miktar={miktar} setMiktar={setMiktar}
          kullanim={kullanim} stokMax={stokMax} toast={toast}
          onYenile={katalogYukle}
          onSiparisOlustu={() => { siparisleriYukle(); katalogYukle(); }}
          onSiparislereGit={() => setSekme('gecmis')}
        />
      )}
      {sekme === 'gecmis' && (
        <Siparislerim siparisler={siparisler} ayarlar={katalog?.ayarlar} toast={toast}
          onYenile={() => { siparisleriYukle(); katalogYukle(); }} onTekrar={tekrarSiparis} />
      )}
    </div>
  );
}

// ======================= Sipariş Ver (tablo seç → doldur → sepete ekle) =======================

const SECILI_TABLO = 'miras_alan_tablo';

/** İki hücre haritasını toplar ({ "urun|beden": {stok, on} }). */
function birlestir(a, b) {
  const s = { ...a };
  for (const [k, v] of Object.entries(b)) {
    const e = s[k] || { stok: 0, on: 0 };
    s[k] = { stok: (e.stok || 0) + (v.stok || 0), on: (e.on || 0) + (v.on || 0) };
  }
  return s;
}
const adetSay = (m) => Object.values(m).reduce((t, v) => ({ stok: t.stok + (v.stok || 0), on: t.on + (v.on || 0) }), { stok: 0, on: 0 });

function SiparisVer({ katalog, yapi, miktar: sepet, setMiktar: setSepet, kullanim, stokMax, toast, onYenile, onSiparisOlustu, onSiparislereGit }) {
  const { ayarlar } = katalog;
  const [tamamlaAcik, setTamamlaAcik] = useState(false);
  const [mod, setMod] = useState('stok'); // 'stok' = stoktan sipariş, 'on' = ön sipariş / üretim talebi
  const [taslak, setTaslak] = useState({}); // açık tabloda girilen, henüz sepete eklenmemiş adetler
  const [aktifId, setAktifId] = useState(() => { try { return localStorage.getItem(SECILI_TABLO) || ''; } catch { return ''; } });
  const aktif = katalog.tablolar.find(t => String(t.id) === String(aktifId)) || katalog.tablolar[0];
  // Stok sınırları sepetteki + açık tablodaki adetlerin TOPLAMINA göre hesaplanır.
  const kul = useMemo(() => kullanim(birlestir(sepet, taslak)), [sepet, taslak, kullanim]);
  const taslakAdet = adetSay(taslak);

  const tablodakiler = (m, tabloId) => Object.fromEntries(Object.entries(m).filter(([k]) => { const u = yapi.urunler.get(k.split('|')[0]); return u && String(u.tablo.id) === String(tabloId); }));
  const tablodanCikar = (m, tabloId) => Object.fromEntries(Object.entries(m).filter(([k]) => { const u = yapi.urunler.get(k.split('|')[0]); return !u || String(u.tablo.id) !== String(tabloId); }));

  const sepeteEkle = (sessiz) => {
    const { stok, on } = adetSay(taslak);
    if (!stok && !on) return false;
    setSepet(s => birlestir(s, taslak));
    setTaslak({});
    if (!sessiz) toast(`Sepete eklendi: ${[stok && `${stok} stoktan`, on && `${on} ön sipariş`].filter(Boolean).join(', ')} ✓`);
    return true;
  };

  const tabloAc = (id) => {
    if (String(id) === String(aktif.id)) return;
    if (taslakAdet.stok + taslakAdet.on > 0) {
      if (!confirm(`Bu tabloda sepete eklenmemiş ${taslakAdet.stok + taslakAdet.on} adet var. Sepete ekleyip diğer tabloya geçilsin mi?`)) return;
      sepeteEkle();
    }
    setAktifId(String(id)); setMod('stok');
    try { localStorage.setItem(SECILI_TABLO, String(id)); } catch { /* yok say */ }
  };

  // Sepetteki bir tabloyu düzenlemek için tabloya geri al.
  const duzenle = (tabloId) => {
    if (String(tabloId) !== String(aktif.id) && taslakAdet.stok + taslakAdet.on > 0) sepeteEkle(true);
    const geri = tablodakiler(sepet, tabloId);
    setSepet(s => tablodanCikar(s, tabloId));
    setTaslak(t => String(tabloId) === String(aktif.id) ? birlestir(t, geri) : geri);
    setAktifId(String(tabloId));
    try { localStorage.setItem(SECILI_TABLO, String(tabloId)); } catch { /* yok say */ }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const sepettenKaldir = (tabloId, etiket) => {
    if (!confirm(`"${etiket}" sepetten çıkarılsın mı?`)) return;
    setSepet(s => tablodanCikar(s, tabloId));
  };

  const ayarla = (uid, b, tip, deger) => {
    let n = Math.max(0, Math.min(9999, parseInt(deger, 10) || 0));
    if (tip === 'stok') {
      const max = stokMax(taslak, kul, uid, b);
      if (n > max) {
        toast(`Bu hücrede stokta en fazla ${max} adet var${sepet[hk(uid, b)]?.stok ? ' (sepettekiler dahil)' : ''} - fazlası için "Ön Sipariş / Üretim Talebi" tablosunu kullanın.`, 'error');
        n = max;
      }
    }
    const k = hk(uid, b);
    const yeni = { ...taslak, [k]: { ...(taslak[k] || { stok: 0, on: 0 }), [tip]: n } };
    if (!yeni[k].stok && !yeni[k].on) delete yeni[k];
    setTaslak(yeni);
  };

  // "Seri" = her bedenden 1 adet. Stok tablosunda sadece stokta olan hücrelere, ön sipariş tablosunda her hücreye.
  const seriEkle = (urunIdler, bedenler) => {
    let m = { ...taslak };
    let eklenen = 0, atlanan = 0;
    for (const uid of urunIdler) {
      for (const b of bedenler) {
        const k = hk(uid, b);
        const h = { ...(m[k] || { stok: 0, on: 0 }) };
        if (mod === 'on') { h.on += 1; eklenen++; }
        else if (stokMax(m, kullanim(birlestir(sepet, m)), uid, b) - h.stok >= 1) { h.stok += 1; eklenen++; }
        else { atlanan++; continue; }
        m = { ...m, [k]: h };
      }
    }
    setTaslak(m);
    toast(`${eklenen} adet ${mod === 'on' ? 'ön siparişe' : 'stoktan'} eklendi${atlanan ? ` - stokta olmayan ${atlanan} hücre atlandı` : ''}`);
  };

  // ----- Sepet özeti -----
  const ozet = useMemo(() => {
    let stok = 0, on = 0, ara = 0, fiyatsiz = 0;
    for (const [k, v] of Object.entries(sepet)) {
      const u = yapi.urunler.get(k.split('|')[0]);
      if (!u) continue;
      const adet = (v.stok || 0) + (v.on || 0);
      stok += v.stok || 0; on += v.on || 0;
      if (u.tablo.birim_fiyat > 0) ara += adet * u.tablo.birim_fiyat; else fiyatsiz += adet;
    }
    const adet = stok + on;
    const kademeler = ayarlar.kademeler || [];
    const kademe = kademeler.filter(k => adet >= k.adet).reduce((m, k) => Math.max(m, k.indirim), 0);
    const sonraki = kademeler.find(k => k.adet > adet && k.indirim > kademe);
    const iskonto = katalog.musteri.iskonto || 0;
    const toplam = Math.round(ara * (1 - kademe / 100) * (1 - iskonto / 100) * 100) / 100;
    const sorunlar = [];
    if (stok > 0 && stok < ayarlar.min_stok_adet) sorunlar.push(`Stoktan siparişte en az ${ayarlar.min_stok_adet} adet - ${ayarlar.min_stok_adet - stok} adet daha ekleyin`);
    if (on > 0 && on < ayarlar.min_on_siparis_adet) sorunlar.push(`Ön sipariş / üretim talebinde en az ${ayarlar.min_on_siparis_adet} adet - ${ayarlar.min_on_siparis_adet - on} adet daha ekleyin`);
    return { stok, on, adet, ara, fiyatsiz, kademe, sonraki, iskonto, toplam, sorunlar, gecerli: adet > 0 && sorunlar.length === 0 };
  }, [sepet, yapi, ayarlar, katalog]);

  // Sepet, tablo bazında (Sepetim kartı + açılır listede ✓ işareti için)
  const sepetTablolari = useMemo(() => {
    const g = new Map();
    for (const [k, v] of Object.entries(sepet)) {
      const [uid, beden] = k.split('|');
      const u = yapi.urunler.get(uid);
      if (!u) continue;
      const t = g.get(String(u.tablo.id)) || { tablo: u.tablo, stok: 0, on: 0, kalemler: [] };
      t.stok += v.stok || 0; t.on += v.on || 0;
      if (v.stok) t.kalemler.push({ tip: 'stok', havuz_etiket: u.tablo.etiket, urun_adi: u.ad, beden, adet: v.stok });
      if (v.on) t.kalemler.push({ tip: 'on_siparis', havuz_etiket: u.tablo.etiket, urun_adi: u.ad, beden, adet: v.on });
      g.set(String(u.tablo.id), t);
    }
    return [...g.values()];
  }, [sepet, yapi]);

  const tamamla = () => {
    if (taslakAdet.stok + taslakAdet.on > 0) { sepeteEkle(true); toast('Açık tablodaki adetler de sepete eklendi'); }
    setTamamlaAcik(true);
  };

  if (!katalog.tablolar.length) {
    return <div className="card" style={{ padding: 30, textAlign: 'center', color: 'var(--text2)' }}>Şu an siparişe açık ürün bulunmuyor.</div>;
  }

  const stokToplami = (t) => t.bedenler.reduce((s, b) => s + (t.stoklar[b] || 0), 0);
  const aktifTaslak = adetSay(tablodakiler(taslak, aktif.id));

  return (
    <div>
      {/* Tablo seçimi - Stok Senkron'daki gibi açılır listeden */}
      <div className="card" style={{ padding: '14px 18px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <label className="form-label" style={{ margin: 0, fontSize: 13 }}>Tablo:</label>
        <select className="form-input" style={{ width: 'auto', minWidth: 280, maxWidth: '100%', flex: '1 1 280px', fontWeight: 600 }} value={String(aktif.id)} onChange={e => tabloAc(e.target.value)}>
          {katalog.tablolar.map(t => {
            const sp = sepetTablolari.find(x => String(x.tablo.id) === String(t.id));
            return <option key={t.id} value={String(t.id)}>{t.etiket} — {stokToplami(t)} stokta{sp ? ` · ✓ sepette ${sp.stok + sp.on}` : ''}</option>;
          })}
        </select>
        <div style={{ fontSize: 12.5, color: 'var(--text2)' }}>
          {aktif.urunler.length} tasarım · {aktif.bedenler.length} beden ·{' '}
          {aktif.birim_fiyat > 0 ? <>birim <b style={{ color: 'var(--text)' }}>{tl(aktif.birim_fiyat)}</b></> : <span style={{ color: 'var(--purple, #7e22ce)' }}>fiyat sipariş sonrası bildirilir</span>}
        </div>
      </div>

      {/* Stoktan / Ön sipariş seçimi */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10, marginBottom: 12 }}>
        <ModSekmesi aktif={mod === 'stok'} renk="var(--green)" ikon="ti-package" onClick={() => setMod('stok')}
          baslik="Stoktan Sipariş" alt={`Eldeki stoktan · en az ${ayarlar.min_stok_adet} adet · ödeme sonrası hemen gönderilir`} adet={aktifTaslak.stok} />
        <ModSekmesi aktif={mod === 'on'} renk="var(--amber)" ikon="ti-tools" onClick={() => setMod('on')}
          baslik="Ön Sipariş / Üretim Talebi" alt={`Stokta olmayanlar üretilir · en az ${ayarlar.min_on_siparis_adet} adet${ayarlar.on_siparis_sure ? ` · ${ayarlar.on_siparis_sure}` : ''}`} adet={aktifTaslak.on} />
      </div>

      <MatrisTablosu key={`${aktif.id}|${mod}`} tablo={aktif} mod={mod} taslak={taslak} sepet={sepet} kul={kul} stokMax={stokMax}
        ayarla={ayarla} seriEkle={seriEkle} onModDegis={setMod}
        altBar={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '12px 18px', borderTop: '1px solid var(--border)', background: 'var(--bg2)' }}>
            <div style={{ flex: 1, minWidth: 180, fontSize: 13, color: 'var(--text2)' }}>
              {aktifTaslak.stok + aktifTaslak.on > 0
                ? <>Bu tabloda seçili: {aktifTaslak.stok > 0 && <b style={{ color: 'var(--green)' }}>{aktifTaslak.stok} stoktan</b>}{aktifTaslak.stok > 0 && aktifTaslak.on > 0 && ' · '}{aktifTaslak.on > 0 && <b style={{ color: 'var(--amber)' }}>{aktifTaslak.on} ön sipariş</b>}</>
                : 'Hücrelere adet yazın, sonra "Sepete Ekle"ye basın.'}
            </div>
            {aktifTaslak.stok + aktifTaslak.on > 0 && <button className="btn btn-secondary btn-sm" onClick={() => setTaslak({})}>Vazgeç</button>}
            <button className="btn btn-primary" disabled={!(aktifTaslak.stok + aktifTaslak.on)} onClick={() => sepeteEkle()}>
              <i className="ti ti-shopping-cart-plus" />Sepete Ekle
            </button>
          </div>
        } />

      {/* Sepetim */}
      <div className="card" style={{ padding: 0, marginBottom: 14, overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', borderBottom: sepetTablolari.length ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
          <i className="ti ti-shopping-cart" style={{ fontSize: 18, color: 'var(--indigo)' }} />
          <b style={{ fontSize: 15 }}>Sepetim</b>
          <span style={{ fontSize: 12.5, color: 'var(--text2)' }}>{ozet.adet ? `${ozet.adet} adet · ${sepetTablolari.length} tablo` : 'boş'}</span>
          {ozet.adet > 0 && <button className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => { if (confirm('Sepet tamamen boşaltılsın mı?')) setSepet({}); }}>Sepeti boşalt</button>}
        </div>
        {!sepetTablolari.length && <div style={{ padding: '4px 18px 14px', fontSize: 13, color: 'var(--text3)' }}>Bir tablo seçip hücrelere adet girin ve "Sepete Ekle"ye basın. Farklı tablolardan ekleyip tek siparişte gönderebilirsiniz.</div>}
        {sepetTablolari.map(g => (
          <SepetSatiri key={g.tablo.id} g={g} onDuzenle={() => duzenle(g.tablo.id)} onKaldir={() => sepettenKaldir(g.tablo.id, g.tablo.etiket)} />
        ))}
      </div>

      <div style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.6, margin: '0 0 14px' }}>
        {(ayarlar.kademeler || []).length > 0 && <>Adet indirimi (sepet toplamı): {ayarlar.kademeler.map(k => `${k.adet}+ adette %${k.indirim}`).join(', ')}. </>}
        {katalog.musteri.iskonto > 0 && <>Size özel ek indirim: <b style={{ color: 'var(--green)' }}>%{katalog.musteri.iskonto}</b>. </>}
        {ayarlar.fiyat_notu}
      </div>

      {/* Yapışkan sepet çubuğu */}
      <div style={{ position: 'sticky', bottom: 0, zIndex: 20, marginTop: 10 }}>
        <div className="card" style={{ padding: '12px 18px', boxShadow: '0 -4px 20px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          <i className="ti ti-shopping-cart" style={{ fontSize: 22, color: 'var(--indigo)' }} />
          <OzetSayaci ad="Stoktan" adet={ozet.stok} min={ayarlar.min_stok_adet} renk="var(--green)" />
          <OzetSayaci ad="Ön sipariş" adet={ozet.on} min={ayarlar.min_on_siparis_adet} renk="var(--amber)" />
          <div style={{ flex: 1, minWidth: 200 }}>
            {ozet.adet > 0 ? (
              <>
                <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--text)' }}>
                  {ozet.ara > 0 ? tl(ozet.toplam) : 'Fiyat bildirilecek'}
                  {ozet.ara > 0 && ozet.toplam < ozet.ara && <span style={{ fontSize: 13, color: 'var(--text3)', textDecoration: 'line-through', marginLeft: 8, fontWeight: 400 }}>{tl(ozet.ara)}</span>}
                  {ozet.ara > 0 && ozet.fiyatsiz > 0 && <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}> + {ozet.fiyatsiz} adedin fiyatı bildirilecek</span>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                  {ozet.kademe > 0 && `%${ozet.kademe} adet indirimi `}{ozet.iskonto > 0 && `· %${ozet.iskonto} size özel `}
                  {ozet.sonraki && <span style={{ color: 'var(--green)' }}>· {ozet.sonraki.adet - ozet.adet} adet daha ekleyin, %{ozet.sonraki.indirim} indirim kazanın</span>}
                </div>
              </>
            ) : <div style={{ fontSize: 13, color: 'var(--text3)' }}>Sepetiniz boş.</div>}
            {taslakAdet.stok + taslakAdet.on > 0 && <div style={{ fontSize: 12, color: 'var(--amber)', marginTop: 2 }}>• Açık tabloda sepete eklenmemiş {taslakAdet.stok + taslakAdet.on} adet var</div>}
            {ozet.sorunlar.map(s => <div key={s} style={{ fontSize: 12, color: 'var(--red)', marginTop: 2 }}>• {s}</div>)}
          </div>
          <button className="btn btn-primary" disabled={!(ozet.adet + taslakAdet.stok + taslakAdet.on)} onClick={tamamla}>
            <i className="ti ti-arrow-right" />Siparişi Tamamla
          </button>
        </div>
      </div>

      {tamamlaAcik && (
        <SiparisTamamlaModal
          katalog={katalog} yapi={yapi} miktar={sepet} ozet={ozet} toast={toast}
          onKapat={(olustu) => { setTamamlaAcik(false); if (olustu) onSiparislereGit(); }}
          onOlustu={() => { setSepet({}); onSiparisOlustu(); }}
          onStokDegisti={onYenile}
        />
      )}
    </div>
  );
}

function SepetSatiri({ g, onDuzenle, onKaldir }) {
  const [acik, setAcik] = useState(false);
  const { tablo } = g;
  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', flexWrap: 'wrap' }}>
        <button onClick={() => setAcik(a => !a)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 200, textAlign: 'left' }}>
          <i className={`ti ${acik ? 'ti-chevron-down' : 'ti-chevron-right'}`} />
          <span>
            <b style={{ fontSize: 13.5 }}>{tablo.etiket}</b>
            <span style={{ display: 'block', fontSize: 12, color: 'var(--text2)' }}>
              {g.stok > 0 && <span style={{ color: 'var(--green)', fontWeight: 700 }}>{g.stok} stoktan</span>}{g.stok > 0 && g.on > 0 && ' · '}{g.on > 0 && <span style={{ color: 'var(--amber)', fontWeight: 700 }}>{g.on} ön sipariş</span>}
              {' · '}{tablo.birim_fiyat > 0 ? `${tl((g.stok + g.on) * tablo.birim_fiyat)} (indirim öncesi)` : 'fiyat bildirilecek'}
            </span>
          </span>
        </button>
        <button className="btn btn-secondary btn-sm" onClick={onDuzenle}><i className="ti ti-edit" />Düzenle</button>
        <button className="btn btn-secondary btn-sm" onClick={onKaldir} style={{ color: 'var(--red)' }}><i className="ti ti-trash" />Kaldır</button>
      </div>
      {acik && <div style={{ padding: '0 18px 8px' }}><SiparisMatrisi kalemler={g.kalemler} /></div>}
    </div>
  );
}

function ModSekmesi({ aktif, renk, ikon, baslik, alt, adet, onClick }) {
  return (
    <button onClick={onClick}
      style={{ textAlign: 'left', padding: '11px 14px', borderRadius: 'var(--r-sm, 10px)', cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center',
        border: `2px solid ${aktif ? renk : 'var(--border2)'}`, background: aktif ? `color-mix(in srgb, ${renk} 9%, var(--bg))` : 'var(--bg)', color: 'var(--text)' }}>
      <i className={`ti ${ikon}`} style={{ fontSize: 22, color: renk }} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: 800, fontSize: 14 }}>{baslik}</span>
        <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text2)' }}>{alt}</span>
      </span>
      {adet > 0 && <span style={{ background: renk, color: '#fff', borderRadius: 999, padding: '1px 9px', fontSize: 12, fontWeight: 800 }}>{adet}</span>}
    </button>
  );
}

function OzetSayaci({ ad, adet, min, renk }) {
  const tamam = adet === 0 || adet >= min;
  return (
    <div style={{ minWidth: 86 }}>
      <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase' }}>{ad}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: adet ? renk : 'var(--text3)' }}>{adet} <span style={{ fontSize: 12, fontWeight: 500, color: tamam ? 'var(--text3)' : 'var(--red)' }}>/ min {min}</span></div>
    </div>
  );
}

function MatrisTablosu({ tablo, mod, taslak, sepet, kul, stokMax, ayarla, seriEkle, onModDegis, altBar }) {
  const { bedenler } = tablo;
  const stokModu = mod === 'stok';
  const tip = stokModu ? 'stok' : 'on';
  const renk = stokModu ? 'var(--green)' : 'var(--amber)';
  const sutunToplam = (b) => tablo.urunler.reduce((s, u) => s + ((taslak[hk(u.id, b)] || {})[tip] || 0), 0);
  const kalan = (b) => (tablo.stoklar[b] || 0) - (kul.sutun[`${tablo.id}|${b}`] || 0);
  const stilTd = { padding: '6px 5px', borderBottom: '1px solid var(--border)', textAlign: 'center' };
  const solYapiskan = { position: 'sticky', left: 0, background: 'var(--bg)', zIndex: 1 };
  const hicStokYok = stokModu && bedenler.every(b => !(tablo.stoklar[b] > 0));

  return (
    <div className="card" style={{ padding: 0, marginBottom: 16, overflow: 'hidden', borderTop: `3px solid ${renk}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', flexWrap: 'wrap', gap: 10, borderBottom: '1px solid var(--border)' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{tablo.etiket}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text2)' }}><b style={{ color: renk }}>{stokModu ? 'Stoktan sipariş' : 'Ön sipariş / üretim talebi'}</b> · {tablo.urunler.length} tasarım</div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => seriEkle(tablo.urunler.map(u => String(u.id)), bedenler)}
          title={stokModu ? 'Her tasarımdan, stokta olan her bedenden 1\'er adet ekler' : 'Her tasarımdan, her bedenden 1\'er adet üretim talebi ekler'}>
          <i className="ti ti-stack-push" />Tüm tasarımlara +1 seri
        </button>
      </div>
      {hicStokYok && (
        <div style={{ padding: '10px 18px', fontSize: 13, background: 'rgba(217,119,6,0.08)', color: 'var(--text2)' }}>
          Bu tabloda şu an stok yok. <button onClick={() => onModDegis('on')} style={{ border: 'none', background: 'none', color: 'var(--amber)', fontWeight: 700, cursor: 'pointer', padding: 0 }}>Ön sipariş / üretim talebi oluşturun →</button>
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 180 + bedenler.length * 84 }}>
          <thead>
            <tr style={{ background: 'var(--bg2)' }}>
              <th style={{ ...stilTd, ...solYapiskan, background: 'var(--bg2)', textAlign: 'left', minWidth: 190, fontSize: 12, color: 'var(--text3)' }}>Tasarım</th>
              {bedenler.map(b => {
                const k = kalan(b);
                return (
                  <th key={b} style={{ ...stilTd, minWidth: 78, background: stokModu && k <= 0 ? 'rgba(217,119,6,0.08)' : undefined }}>
                    <div style={{ fontSize: 13, fontWeight: 800 }}>{b}</div>
                    {stokModu && (
                      <div style={{ fontSize: 10.5, fontWeight: 500, color: k <= 0 ? 'var(--amber)' : 'var(--text3)' }}>
                        {k <= 0 ? (tablo.stoklar[b] > 0 ? 'stok doldu' : 'stokta yok') : `stokta ${k} kaldı`}
                      </div>
                    )}
                  </th>
                );
              })}
              <th style={{ ...stilTd, fontSize: 12, color: 'var(--text3)' }}>Toplam</th>
            </tr>
          </thead>
          <tbody>
            {tablo.urunler.map(u => {
              const uid = String(u.id);
              const satirToplam = bedenler.reduce((s, b) => s + ((taslak[hk(uid, b)] || {})[tip] || 0), 0);
              return (
                <tr key={uid}>
                  <td style={{ ...stilTd, ...solYapiskan, textAlign: 'left' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {u.gorsel
                        ? <img src={u.gorsel} alt="" loading="lazy" style={{ width: 46, height: 46, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', flexShrink: 0 }} />
                        : <div style={{ width: 46, height: 46, borderRadius: 8, background: 'var(--bg3)', flexShrink: 0 }} />}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 12.5, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} title={u.ad}>{u.ad}</div>
                        <button onClick={() => seriEkle([uid], bedenler)} style={{ marginTop: 3, fontSize: 11, padding: '1px 8px', border: '1px solid var(--border2)', borderRadius: 999, background: 'var(--bg)', color: 'var(--text2)', cursor: 'pointer' }}>+1 seri</button>
                      </div>
                    </div>
                  </td>
                  {bedenler.map(b => {
                    const k = hk(uid, b);
                    const h = taslak[k] || { stok: 0, on: 0 };
                    const sepette = (sepet[k] || {})[tip] || 0;
                    if (!stokModu) {
                      return (
                        <td key={b} style={stilTd}>
                          <HucreGirdisi deger={h.on} renk={renk} baslik="Üretim talebi (adet)" onChange={v => ayarla(uid, b, 'on', v)} />
                          {sepette > 0 && <div style={{ fontSize: 10, color: 'var(--indigo)', marginTop: 2 }}>sepette {sepette}</div>}
                        </td>
                      );
                    }
                    const max = stokMax(taslak, kul, uid, b);
                    const pasif = max <= 0 && !h.stok;
                    return (
                      <td key={b} style={{ ...stilTd, background: kalan(b) <= 0 ? 'rgba(217,119,6,0.04)' : undefined }}>
                        <HucreGirdisi deger={h.stok} renk={renk} pasif={pasif}
                          baslik={pasif ? (kalan(b) > 0 ? 'Bu tasarımın baskı stoğu doldu - ön sipariş tablosunu kullanın' : 'Bu bedende stok kalmadı - ön sipariş tablosunu kullanın') : `Stoktan (en fazla ${max})`}
                          onChange={v => ayarla(uid, b, 'stok', v)} />
                        <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
                          {pasif ? 'yok' : `en fazla ${max}`}{sepette > 0 && <span style={{ color: 'var(--indigo)' }}> · sepette {sepette}</span>}
                        </div>
                      </td>
                    );
                  })}
                  <td style={{ ...stilTd, fontWeight: 800, color: satirToplam ? renk : undefined }}>{satirToplam || ''}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: 'var(--bg2)', fontSize: 12 }}>
              <td style={{ ...stilTd, ...solYapiskan, background: 'var(--bg2)', textAlign: 'left', color: 'var(--text2)' }}>Seçilen</td>
              {bedenler.map(b => <td key={b} style={{ ...stilTd, color: renk, fontWeight: 700 }}>{sutunToplam(b) || ''}</td>)}
              <td style={{ ...stilTd, fontWeight: 800, color: renk }}>{bedenler.reduce((s, b) => s + sutunToplam(b), 0) || ''}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {stokModu && !hicStokYok && (
        <div style={{ padding: '8px 18px', fontSize: 12, color: 'var(--text3)', borderTop: '1px solid var(--border)' }}>
          Bir bedenin stoğu dolunca o sütun kapanır. Stokta olmayan ya da yetmeyen ürünler için{' '}
          <button onClick={() => onModDegis('on')} style={{ border: 'none', background: 'none', color: 'var(--amber)', fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: 12 }}>Ön Sipariş / Üretim Talebi</button> tablosunu kullanın.
        </div>
      )}
      {altBar}
    </div>
  );
}

function HucreGirdisi({ deger, renk, pasif, baslik, onChange }) {
  return (
    <input
      type="number" min="0" inputMode="numeric"
      value={deger || ''} placeholder={pasif ? '—' : '0'} disabled={pasif} title={baslik} aria-label={baslik}
      onChange={e => onChange(e.target.value)}
      onFocus={e => e.target.select()}
      style={{
        width: '100%', maxWidth: 64, display: 'block', margin: '0 auto',
        padding: '6px 4px', fontSize: 14, fontWeight: 700, textAlign: 'center',
        border: `1.5px solid ${pasif ? 'var(--border)' : renk}`, borderRadius: 7,
        background: pasif ? 'var(--bg3)' : deger ? `color-mix(in srgb, ${renk} 12%, var(--bg))` : 'var(--bg)',
        color: pasif ? 'var(--text3)' : 'var(--text)', cursor: pasif ? 'not-allowed' : 'text',
      }}
    />
  );
}

// ======================= Sipariş tamamlama + ödeme =======================

const TESLIMAT_ALANLARI = [
  ['ad_soyad', 'Ad Soyad *'], ['firma', 'Firma / Kurum'], ['telefon', 'Telefon *'], ['email', 'E-posta *'],
  ['il', 'İl *'], ['vergi_no', 'Vergi No / TCKN'],
];

function SiparisTamamlaModal({ katalog, yapi, miktar, ozet, toast, onKapat, onOlustu, onStokDegisti }) {
  const sonTeslimat = (() => { try { return JSON.parse(localStorage.getItem('toptan_son_teslimat')) || {}; } catch { return {}; } })();
  const [teslimat, setTeslimat] = useState({ ...katalog.musteri.teslimat, ...sonTeslimat });
  const [not, setNot] = useState('');
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [hata, setHata] = useState('');
  const [siparis, setSiparis] = useState(null);
  const { ayarlar } = katalog;

  const gonder = async () => {
    setGonderiliyor(true); setHata('');
    const kalemler = [];
    for (const [k, v] of Object.entries(miktar)) {
      const [uid, beden] = k.split('|');
      if (!yapi.urunler.has(uid)) continue;
      if (v.stok) kalemler.push({ havuz_urun_id: uid, beden, tip: 'stok', adet: v.stok });
      if (v.on) kalemler.push({ havuz_urun_id: uid, beden, tip: 'on_siparis', adet: v.on });
    }
    try {
      const r = await toptanApi.siparisOlustur({ kalemler, teslimat, musteri_notu: not });
      try { localStorage.setItem('toptan_son_teslimat', JSON.stringify(teslimat)); } catch { /* yok say */ }
      setSiparis(r.data);
      onOlustu();
    } catch (e) {
      const mesaj = e.response?.data?.hata || 'Sipariş oluşturulamadı.';
      setHata(mesaj);
      if (/stokta/.test(mesaj)) onStokDegisti();
    } finally { setGonderiliyor(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onKapat(!!siparis)}>
      <div className="modal" style={{ maxWidth: 640 }}>
        <div className="modal-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {siparis ? `Sipariş ${siparis.siparis_no} oluşturuldu` : 'Siparişi Tamamla'}
          <button className="btn-icon" onClick={() => onKapat(!!siparis)}><i className="ti ti-x" /></button>
        </div>

        {!siparis ? (
          <>
            <div style={{ background: 'var(--bg2)', borderRadius: 'var(--r-xs)', padding: '10px 14px', marginBottom: 14, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Stoktan</span><b>{ozet.stok} adet</b></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Ön sipariş / üretim talebi</span><b>{ozet.on} adet</b></div>
              {ozet.ara > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Ara toplam</span><span>{tl(ozet.ara)}</span></div>}
              {ozet.ara > 0 && ozet.toplam < ozet.ara && <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--green)' }}><span>İndirim</span><span>-{tl(ozet.ara - ozet.toplam)}</span></div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, marginTop: 4 }}><b>Toplam</b><b>{ozet.fiyatsiz > 0 ? (ozet.ara > 0 ? `${tl(ozet.toplam)} + bildirilecek` : 'Fiyat bildirilecek') : tl(ozet.toplam)}</b></div>
              {ozet.fiyatsiz > 0 && <div style={{ fontSize: 11.5, color: 'var(--text2)', marginTop: 2 }}>{ozet.fiyatsiz} adedin fiyatı siparişiniz incelendikten sonra size bildirilecek.</div>}
              {ayarlar.fiyat_notu && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{ayarlar.fiyat_notu}</div>}
            </div>

            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Teslimat ve fatura bilgileri</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
              {TESLIMAT_ALANLARI.map(([alan, etiket]) => (
                <div key={alan}>
                  <label className="form-label">{etiket}</label>
                  <input className="form-input" value={teslimat[alan] || ''} type={alan === 'email' ? 'email' : 'text'}
                    onChange={e => setTeslimat(t => ({ ...t, [alan]: e.target.value }))} />
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10 }}>
              <label className="form-label">Adres *</label>
              <textarea className="form-input" rows={2} value={teslimat.adres || ''} onChange={e => setTeslimat(t => ({ ...t, adres: e.target.value }))} />
            </div>
            <div style={{ marginTop: 10 }}>
              <label className="form-label">Sipariş notu</label>
              <textarea className="form-input" rows={2} value={not} onChange={e => setNot(e.target.value)} placeholder="İsteğe bağlı" />
            </div>

            <BilgiKutusu ayarlar={ayarlar} stokVar={ozet.stok > 0} onVar={ozet.on > 0} fiyatsiz={ozet.fiyatsiz > 0} />

            {hata && <div style={{ whiteSpace: 'pre-line', color: 'var(--red)', fontSize: 13, background: 'rgba(220,38,38,0.07)', padding: '8px 12px', borderRadius: 'var(--r-xs)', marginTop: 12 }}>{hata}</div>}

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => onKapat(false)}>Geri</button>
              <button className="btn btn-primary" onClick={gonder} disabled={gonderiliyor}>
                <i className={`ti ${gonderiliyor ? 'ti-loader-2' : 'ti-check'}`} />{gonderiliyor ? 'Oluşturuluyor...' : 'Siparişi Oluştur'}
              </button>
            </div>
          </>
        ) : (
          siparis.durum === 'fiyat_bekliyor' ? <FiyatBekliyorMesaji siparis={siparis} /> : <OdemePaneli siparis={siparis} ayarlar={ayarlar} toast={toast} onGuncellendi={s => s && setSiparis(s)} />
        )}
      </div>
    </div>
  );
}

function BilgiKutusu({ ayarlar, stokVar, onVar, fiyatsiz }) {
  return (
    <div style={{ marginTop: 14, fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.6, background: 'rgba(37,99,235,0.06)', borderRadius: 'var(--r-xs)', padding: '10px 14px' }}>
      <div>ℹ️ <b>Siparişiniz ödeme alındıktan sonra hazırlanmaya başlanacaktır.</b></div>
      {fiyatsiz && <div>Bazı ürünlerin fiyatı sipariş sonrası bildirilecek. Fiyat bildirildiğinde "Siparişlerim" sekmesinden ödeme yapabilirsiniz.</div>}
      {stokVar && <div>Stoktan seçtiğiniz ürünler sipariş anında sizin için ayrılır{ayarlar.odeme_sure_saat > 0 ? `; ödemeye açıldıktan sonra ${ayarlar.odeme_sure_saat} saat içinde ödenmeyen siparişler iptal edilir ve stok serbest kalır` : ''}.</div>}
      {onVar && <div>Ön sipariş ürünleri ödeme sonrası üretime alınır{ayarlar.on_siparis_sure ? ` (tahmini ${ayarlar.on_siparis_sure})` : ''}.</div>}
    </div>
  );
}

function FiyatBekliyorMesaji({ siparis }) {
  return (
    <div style={{ textAlign: 'center', padding: '20px 10px' }}>
      <div style={{ fontSize: 40 }}>🧾</div>
      <div style={{ fontSize: 16, fontWeight: 700, margin: '6px 0' }}>Siparişiniz alındı - fiyat bildirilecek</div>
      <div style={{ color: 'var(--text2)', fontSize: 13.5, lineHeight: 1.6 }}>
        Sipariş no <b>{siparis.siparis_no}</b>. Siparişinizi inceleyip fiyatı en kısa sürede bildireceğiz.
        Fiyat bildirildiğinde "Siparişlerim" sekmesinden ödeme yapabilirsiniz; siparişiniz ödeme alındıktan sonra hazırlanmaya başlanacaktır.
        {siparis.stok_adet > 0 && <> Stoktan seçtiğiniz {siparis.stok_adet} adet sizin için ayrıldı.</>}
      </div>
    </div>
  );
}

function OdemePaneli({ siparis, ayarlar, toast, onGuncellendi }) {
  const [iframeUrl, setIframeUrl] = useState('');
  const [havaleAcik, setHavaleAcik] = useState(siparis.odeme?.yontem === 'havale');
  const [bekliyor, setBekliyor] = useState(false);
  const odendi = siparis.odeme?.odendi;
  const yontemler = ayarlar?.odeme_yontemleri || {};

  useEffect(() => {
    const dinle = (e) => {
      if (!e.data || e.data.tip !== 'toptan-odeme' || e.data.no !== siparis.siparis_no) return;
      setIframeUrl('');
      if (e.data.durum === 'basarili') {
        toast('Ödemeniz alındı - onaylanıyor…');
        // Kesin onay için PayTR'a sorulur (durum sorgusu); PayTR'ın kaydı birkaç saniye gecikebildiği için birkaç kez dener.
        const dene = async (kalan) => {
          try {
            const s = (await toptanApi.paytrKontrol(siparis._id)).data;
            if (s?.odeme?.odendi) { onGuncellendi(s); toast('Ödemeniz onaylandı - siparişiniz hazırlanacak ✓'); return; }
          } catch { /* tekrar dene */ }
          if (kalan > 0) setTimeout(() => dene(kalan - 1), 4000);
          else toast('Ödemeniz birkaç dakika içinde onaylanacak; "Siparişlerim"den takip edebilirsiniz.');
        };
        setTimeout(() => dene(4), 1500);
      } else toast('Ödeme tamamlanamadı, tekrar deneyebilirsiniz.', 'error');
    };
    window.addEventListener('message', dinle);
    return () => window.removeEventListener('message', dinle);
  }, [siparis, toast, onGuncellendi]);

  const kartla = async () => {
    setBekliyor(true);
    try { setIframeUrl((await toptanApi.paytr(siparis._id)).data.iframe_url); }
    catch (e) { toast(e.response?.data?.hata || 'Ödeme ekranı açılamadı', 'error'); }
    finally { setBekliyor(false); }
  };
  const havale = async () => {
    setHavaleAcik(true);
    try { onGuncellendi((await toptanApi.havale(siparis._id)).data); } catch { /* bilgi yine de gösteriliyor */ }
  };

  if (odendi) {
    return (
      <div style={{ textAlign: 'center', padding: '20px 10px' }}>
        <div style={{ fontSize: 40 }}>✅</div>
        <div style={{ fontSize: 16, fontWeight: 700, margin: '6px 0' }}>Ödemeniz alındı</div>
        <div style={{ color: 'var(--text2)', fontSize: 13.5 }}>Siparişiniz {siparis.siparis_no} hazırlanmak üzere sıraya alındı. Durumunu "Siparişlerim" sekmesinden takip edebilirsiniz.</div>
      </div>
    );
  }

  return (
    <div>
      {!iframeUrl && (
        <>
          <div style={{ background: 'rgba(5,150,105,0.08)', borderRadius: 'var(--r-xs)', padding: '12px 14px', fontSize: 13.5, marginBottom: 14 }}>
            <b>Sipariş no: {siparis.siparis_no}</b> · Toplam <b>{tl(siparis.toplam)}</b><br />
            Siparişiniz <b>ödeme alındıktan sonra</b> hazırlanmaya başlanacaktır.
            {siparis.stok_adet > 0 && ayarlar?.odeme_sure_saat > 0 && <> Stoktan ayrılan ürünler {ayarlar.odeme_sure_saat} saat boyunca sizin için tutulur.</>}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {yontemler.paytr && <button className="btn btn-primary" onClick={kartla} disabled={bekliyor}><i className="ti ti-credit-card" />{bekliyor ? 'Açılıyor...' : 'Kartla Öde'}</button>}
            {yontemler.havale && <button className="btn btn-secondary" onClick={havale}><i className="ti ti-building-bank" />Havale / EFT ile Öde</button>}
          </div>
          {!yontemler.paytr && !yontemler.havale && <div style={{ fontSize: 13, color: 'var(--text2)' }}>Ödeme bilgileri için lütfen bizimle iletişime geçin.</div>}
          {havaleAcik && yontemler.havale && (
            <div style={{ marginTop: 14, border: '1px solid var(--border2)', borderRadius: 'var(--r-xs)', padding: '12px 14px', fontSize: 13.5 }}>
              <div style={{ whiteSpace: 'pre-line', marginBottom: 8 }}>{ayarlar.havale_bilgisi}</div>
              <div style={{ color: 'var(--amber)', fontWeight: 600 }}>Açıklamaya sipariş numaranızı ({siparis.siparis_no}) yazmayı unutmayın.</div>
              <div style={{ color: 'var(--text2)', marginTop: 4 }}>Ödemeniz kontrol edildikten sonra siparişiniz hazırlanmaya başlanacaktır.</div>
            </div>
          )}
        </>
      )}
      {iframeUrl && (
        <div>
          <iframe src={iframeUrl} title="Güvenli ödeme" style={{ width: '100%', height: 620, border: 'none', borderRadius: 'var(--r-xs)' }} allow="payment" />
          <button className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={() => setIframeUrl('')}>Ödeme ekranını kapat</button>
        </div>
      )}
    </div>
  );
}

// ======================= Siparişlerim =======================

function Siparislerim({ siparisler, ayarlar, toast, onYenile, onTekrar }) {
  const [acik, setAcik] = useState(null);
  const [odemeSiparisi, setOdemeSiparisi] = useState(null);

  if (!siparisler.length) {
    return <div className="card" style={{ padding: 30, textAlign: 'center', color: 'var(--text3)' }}><i className="ti ti-list-details" style={{ fontSize: 36, display: 'block', marginBottom: 8 }} />Henüz siparişiniz yok.</div>;
  }

  const iptal = async (s) => {
    if (!confirm(`${s.siparis_no} numaralı sipariş iptal edilsin mi? Ayrılan stok serbest bırakılacak.`)) return;
    try { await toptanApi.iptal(s._id); toast('Sipariş iptal edildi'); onYenile(); }
    catch (e) { toast(e.response?.data?.hata || 'İptal edilemedi', 'error'); }
  };

  return (
    <div>
      {siparisler.map(s => {
        const odenmedi = s.durum === 'odeme_bekliyor' && !s.odeme?.odendi;
        const fiyatBekliyor = s.durum === 'fiyat_bekliyor';
        return (
          <div key={s._id} className="card" style={{ padding: '14px 18px', marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', cursor: 'pointer' }} onClick={() => setAcik(acik === s._id ? null : s._id)}>
              <div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <b style={{ fontSize: 15 }}>#{s.siparis_no}</b> <DurumRozeti durum={s.durum} />
                  {s.odeme?.odendi && s.durum !== 'odendi' && <span className="badge badge-green">✓ Ödendi</span>}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text2)', marginTop: 4 }}>
                  {tarih(s.createdAt)} · {s.stok_adet > 0 && `${s.stok_adet} stoktan`}{s.stok_adet > 0 && s.on_siparis_adet > 0 && ' + '}{s.on_siparis_adet > 0 && `${s.on_siparis_adet} ön sipariş`}
                  {s.kargo?.takip_no && <> · Kargo: <b>{s.kargo.firma} {s.kargo.takip_no}</b></>}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 17, fontWeight: 800 }}>{fiyatBekliyor ? 'Fiyat bekleniyor' : tl(s.toplam)}</div>
                <div style={{ fontSize: 12, color: odenmedi ? 'var(--amber)' : 'var(--text3)' }}>{odenmedi ? 'Ödeme bekleniyor' : s.odeme?.odendi ? 'Ödendi' : ''}</div>
              </div>
            </div>
            {odenmedi && (
              <div style={{ fontSize: 12.5, color: 'var(--text2)', marginTop: 8 }}>Siparişiniz ödeme alındıktan sonra hazırlanacaktır.</div>
            )}
            {fiyatBekliyor && (
              <div style={{ fontSize: 12.5, color: 'var(--text2)', marginTop: 8 }}>Siparişiniz alındı, fiyat en kısa sürede bildirilecek. Fiyat bildirilince buradan ödeme yapabilirsiniz.</div>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              {odenmedi && <button className="btn btn-primary btn-sm" onClick={() => setOdemeSiparisi(s)}><i className="ti ti-credit-card" />Öde</button>}
              {odenmedi && s.odeme?.yontem === 'paytr' && (
                <button className="btn btn-secondary btn-sm" title="Kartla ödediyseniz ödemenizi şimdi doğrular"
                  onClick={async () => { try { const r = await toptanApi.paytrKontrol(s._id); toast(r.data?.odeme?.odendi ? 'Ödemeniz onaylandı ✓' : 'Henüz onaylanmış bir kart ödemesi görünmüyor'); onYenile(); } catch { toast('Kontrol edilemedi', 'error'); } }}>
                  <i className="ti ti-refresh" />Ödememi kontrol et
                </button>
              )}
              <button className="btn btn-secondary btn-sm" onClick={() => onTekrar(s)}><i className="ti ti-repeat" />Tekrar Sipariş Ver</button>
              <button className="btn btn-secondary btn-sm" onClick={() => proformaYazdir(s, ayarlar || {})}><i className="ti ti-printer" />Yazdır</button>
              {(odenmedi || fiyatBekliyor) && <button className="btn btn-secondary btn-sm" onClick={() => iptal(s)} style={{ color: 'var(--red)' }}><i className="ti ti-x" />İptal Et</button>}
            </div>
            {acik === s._id && (
              <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <SiparisMatrisi kalemler={s.kalemler} />
                <div style={{ fontSize: 12.5, color: 'var(--text2)' }}>
                  {fiyatBekliyor ? 'Fiyat bildirilecek' : <>Ara toplam {tl(s.ara_toplam)}{s.indirim_tutari > 0 && ` · indirim -${tl(s.indirim_tutari)}`} · <b style={{ color: 'var(--text)' }}>Toplam {tl(s.toplam)}</b></>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8 }}>
                  {(s.gecmis || []).slice().reverse().map((g, i) => <div key={i}>{tarih(g.tarih)} — {g.olay}</div>)}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {odemeSiparisi && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && (setOdemeSiparisi(null), onYenile())}>
          <div className="modal" style={{ maxWidth: 640 }}>
            <div className="modal-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
              Ödeme — #{odemeSiparisi.siparis_no}
              <button className="btn-icon" onClick={() => { setOdemeSiparisi(null); onYenile(); }}><i className="ti ti-x" /></button>
            </div>
            <OdemePaneli siparis={odemeSiparisi} ayarlar={ayarlar} toast={toast} onGuncellendi={s => s && setOdemeSiparisi(s)} />
          </div>
        </div>
      )}
    </div>
  );
}
