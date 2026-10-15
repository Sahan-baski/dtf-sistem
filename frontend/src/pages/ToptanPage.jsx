/**
 * Yönetim → Miras Sipariş Alanı: müşteri panelinden gelen siparişler (fiyat
 * bildirme, ödeme takibi, durum, kargo, iptal/stok iadesi), ön sipariş üretim
 * listesi, müşteri görünümü önizlemesi ve ayarlar (tablolar/fiyatlar, müşteri
 * indirimleri, minimumlar, kademe indirimleri, havale, PayTR).
 */
import { useState, useEffect, useCallback } from 'react';
import { toptanApi } from '../api';
import { useToast } from '../context/ToastContext';
import { DURUMLAR, DurumRozeti, SiparisMatrisi, proformaYazdir, tl, tarih } from '../toptan/ortak';
import ToptanBolumu from '../toptan/ToptanBolumu';
import PaytrAyarlari from '../toptan/PaytrAyarlari';

const FILTRELER = [
  { key: 'fiyat_bekliyor', ad: 'Fiyat Bekleyen', ipucu: 'Fiyatı girilmemiş tablodan gelen - fiyat bildirmen gerekiyor' },
  { key: 'odendi', ad: 'Hazırlanacak', ipucu: 'Ödemesi alınmış, hazırlanmayı bekleyen' },
  { key: 'odeme_bekliyor', ad: 'Ödeme Bekleyen' },
  { key: 'hazirlaniyor,uretimde', ad: 'Hazırlanıyor / Üretimde' },
  { key: 'kargoda', ad: 'Kargoda' },
  { key: 'tamamlandi', ad: 'Tamamlandı' },
  { key: 'iptal', ad: 'İptal' },
  { key: '', ad: 'Tümü' },
];

export default function ToptanPage({ onSayacDegisti }) {
  const toast = useToast();
  const [sekme, setSekme] = useState('siparisler');
  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">🏬 Miras Sipariş Alanı</div>
          <div className="page-sub">Müşteri panelindeki tablolardan verilen siparişler, üretim talepleri ve ödemeler — tüm müşteri hesapları sipariş verebilir</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
        {[['siparisler', 'Siparişler', 'ti-list-details'], ['uretim', 'Ön Sipariş Üretim Listesi', 'ti-printer'], ['onizleme', 'Müşteri Görünümü', 'ti-eye'], ['ayarlar', 'Tablolar & Ayarlar', 'ti-settings'], ['odeme', 'Ödeme / PayTR', 'ti-credit-card']].map(([k, ad, ikon]) => (
          <button key={k} className={`filter-btn ${sekme === k ? 'active' : ''}`} onClick={() => setSekme(k)}
            style={{ padding: '7px 14px', borderRadius: 999, border: '1px solid var(--border2)', background: sekme === k ? 'var(--indigo)' : 'var(--bg)', color: sekme === k ? '#fff' : 'var(--text2)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            <i className={`ti ${ikon}`} /> {ad}
          </button>
        ))}
      </div>
      {sekme === 'siparisler' && <Siparisler onSayacDegisti={onSayacDegisti} />}
      {sekme === 'uretim' && <UretimListesi />}
      {sekme === 'onizleme' && (
        <div>
          <div className="card" style={{ padding: '10px 14px', marginBottom: 14, fontSize: 13, color: 'var(--text2)' }}>
            <i className="ti ti-eye" /> Müşterilerin panelinde gördüğü ekranın aynısı. Buradan verilen sipariş senin adına (test siparişi) oluşturulur ve stoktan düşer - denedikten sonra Siparişler'den iptal edebilirsin.
          </div>
          <ToptanBolumu kullanici={{ _id: 'yonetici-onizleme' }} toast={toast} />
        </div>
      )}
      {sekme === 'ayarlar' && <Ayarlar />}
      {sekme === 'odeme' && <div style={{ maxWidth: 820 }}><PaytrAyarlari /></div>}
    </div>
  );
}

// ======================= Siparişler =======================

function Siparisler({ onSayacDegisti }) {
  const toast = useToast();
  const [filtre, setFiltre] = useState('odendi');
  const [ara, setAra] = useState('');
  const [liste, setListe] = useState([]);
  const [ozet, setOzet] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [secili, setSecili] = useState(null);
  const [ayarlar, setAyarlar] = useState({});

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    try {
      const [l, o] = await Promise.all([toptanApi.admin.siparisler({ durum: filtre || undefined, ara: ara || undefined }), toptanApi.admin.ozet()]);
      setListe(l.data); setOzet(o.data);
      onSayacDegisti && onSayacDegisti(o.data.aksiyon_bekleyen);
    } catch { toast('Siparişler yüklenemedi', 'error'); }
    finally { setYukleniyor(false); }
  }, [filtre, ara]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setTimeout(yukle, ara ? 300 : 0); return () => clearTimeout(t); }, [yukle, ara]);
  useEffect(() => { toptanApi.admin.ayarlar().then(r => setAyarlar(r.data.ayarlar)).catch(() => {}); }, []);

  const sayi = (key) => {
    if (!ozet) return null;
    if (!key) return Object.values(ozet.durumlar).reduce((s, d) => s + d.sayi, 0);
    return key.split(',').reduce((s, k) => s + ((ozet.durumlar[k] || {}).sayi || 0), 0);
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
        {FILTRELER.map(f => {
          const n = sayi(f.key);
          return (
            <button key={f.key} onClick={() => setFiltre(f.key)} title={f.ipucu}
              style={{ padding: '5px 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', border: `1px solid ${filtre === f.key ? 'var(--indigo)' : 'var(--border2)'}`, background: filtre === f.key ? 'var(--bg3)' : 'var(--bg)', color: filtre === f.key ? 'var(--indigo)' : 'var(--text2)' }}>
              {f.ad}{n ? <span style={{ marginLeft: 6, background: ['odendi', 'fiyat_bekliyor'].includes(f.key) ? 'var(--red)' : 'var(--bg4)', color: ['odendi', 'fiyat_bekliyor'].includes(f.key) ? '#fff' : 'var(--text2)', borderRadius: 999, padding: '0 6px', fontSize: 11 }}>{n}</span> : null}
            </button>
          );
        })}
        <input className="form-input" placeholder="Sipariş no, müşteri, telefon ara…" value={ara} onChange={e => setAra(e.target.value)} style={{ marginLeft: 'auto', maxWidth: 260, padding: '6px 10px' }} />
      </div>

      {yukleniyor && !liste.length ? <div style={{ textAlign: 'center', color: 'var(--text3)', padding: 40 }}>Yükleniyor…</div>
        : !liste.length ? <div className="card" style={{ padding: 30, textAlign: 'center', color: 'var(--text3)' }}>Bu filtrede sipariş yok.</div>
          : liste.map(s => (
            <div key={s._id} className="card" onClick={() => setSecili(s)} style={{ padding: '12px 16px', marginBottom: 8, cursor: 'pointer', display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ minWidth: 120 }}>
                <div style={{ fontWeight: 800 }}>#{s.siparis_no}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>{tarih(s.createdAt)}</div>
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontWeight: 600 }}>{s.teslimat?.firma || s.teslimat?.ad_soyad}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>{s.teslimat?.firma && `${s.teslimat.ad_soyad} · `}{s.teslimat?.il} · {s.teslimat?.telefon}</div>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text2)', minWidth: 120 }}>
                {s.stok_adet > 0 && <div><span style={{ color: 'var(--green)', fontWeight: 700 }}>{s.stok_adet}</span> stoktan</div>}
                {s.on_siparis_adet > 0 && <div><span style={{ color: 'var(--amber)', fontWeight: 700 }}>{s.on_siparis_adet}</span> ön sipariş</div>}
              </div>
              <div style={{ textAlign: 'right', minWidth: 110 }}>
                <div style={{ fontWeight: 800 }}>{s.durum === 'fiyat_bekliyor' ? 'Fiyat ver' : tl(s.toplam)}</div>
                <div style={{ fontSize: 11.5, color: s.odeme?.odendi ? 'var(--green)' : 'var(--amber)', fontWeight: 600 }}>
                  {s.odeme?.odendi ? `✓ Ödendi${s.odeme.yontem ? ` (${s.odeme.yontem === 'paytr' ? 'kart' : 'havale'})` : ''}` : s.odeme?.yontem === 'havale' ? 'Havale bekleniyor' : 'Ödenmedi'}
                </div>
              </div>
              <DurumRozeti durum={s.durum} />
            </div>
          ))}

      {secili && <SiparisDetay siparis={secili} ayarlar={ayarlar} onKapat={() => setSecili(null)} onGuncellendi={(s) => { setSecili(s); yukle(); }} />}
    </div>
  );
}

function SiparisDetay({ siparis: s, ayarlar, onKapat, onGuncellendi }) {
  const toast = useToast();
  const [kargo, setKargo] = useState({ firma: s.kargo?.firma || '', takip_no: s.kargo?.takip_no || '' });
  const [not, setNot] = useState(s.admin_notu || '');
  const [bekliyor, setBekliyor] = useState(false);
  const t = s.teslimat || {};

  const islem = async (fn, basari) => {
    setBekliyor(true);
    try { const r = await fn(); onGuncellendi(r.data); if (basari) toast(basari); }
    catch (e) { toast(e.response?.data?.hata || 'İşlem başarısız', 'error'); }
    finally { setBekliyor(false); }
  };
  const kopyala = () => {
    const metin = [t.firma, t.ad_soyad, t.telefon, `${t.adres} ${t.il}`].filter(Boolean).join('\n');
    navigator.clipboard?.writeText(metin).then(() => toast('Adres kopyalandı'), () => {});
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onKapat()}>
      <div className="modal" style={{ maxWidth: 760 }}>
        <div className="modal-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <span>#{s.siparis_no} <DurumRozeti durum={s.durum} /></span>
          <button className="btn-icon" onClick={onKapat}><i className="ti ti-x" /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12, marginBottom: 14 }}>
          <div style={{ background: 'var(--bg2)', borderRadius: 'var(--r-xs)', padding: '10px 12px', fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><b>Teslimat</b><button className="btn-icon" title="Kopyala" onClick={kopyala}><i className="ti ti-copy" /></button></div>
            {t.firma && <div><b>{t.firma}</b></div>}
            <div>{t.ad_soyad}</div><div>{t.telefon} · {t.email}</div><div>{t.adres} {t.il}</div>
            {t.vergi_no && <div>VKN/TCKN: {t.vergi_no}</div>}
            {s.musteri_notu && <div style={{ marginTop: 6, color: 'var(--amber)' }}>Not: {s.musteri_notu}</div>}
          </div>
          <div style={{ background: 'var(--bg2)', borderRadius: 'var(--r-xs)', padding: '10px 12px', fontSize: 13 }}>
            <b>Ödeme</b>
            {s.durum === 'fiyat_bekliyor' && <div style={{ color: 'var(--purple, #7e22ce)', fontWeight: 600 }}>Fiyat henüz bildirilmedi - aşağıdan gir</div>}
            <div>Ara toplam {tl(s.ara_toplam)}</div>
            {s.indirim_tutari > 0 && <div style={{ color: 'var(--green)' }}>İndirim -{tl(s.indirim_tutari)} {s.kademe_indirim_orani ? `(adet %${s.kademe_indirim_orani})` : ''} {s.musteri_indirim_orani ? `(müşteri %${s.musteri_indirim_orani})` : ''}</div>}
            <div style={{ fontSize: 16, fontWeight: 800 }}>{tl(s.toplam)}</div>
            <div style={{ color: s.odeme?.odendi ? 'var(--green)' : 'var(--amber)', fontWeight: 700 }}>
              {s.odeme?.odendi ? `✓ Ödendi ${s.odeme.odeme_tarihi ? tarih(s.odeme.odeme_tarihi) : ''}` : 'Ödenmedi'}
              {s.odeme?.yontem && <span style={{ color: 'var(--text2)', fontWeight: 400 }}> · {s.odeme.yontem === 'paytr' ? 'PayTR (kart)' : 'Havale/EFT'}</span>}
            </div>
            {s.odeme?.paytr_hata && <div style={{ color: 'var(--red)', fontSize: 12 }}>Son PayTR hatası: {s.odeme.paytr_hata}</div>}
            {!s.odeme?.odendi && !['iptal', 'fiyat_bekliyor'].includes(s.durum) && (
              <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} disabled={bekliyor}
                onClick={() => confirm(`${tl(s.toplam)} tutarındaki ödemeyi (havale/EFT) aldığını onaylıyor musun?`) && islem(() => toptanApi.admin.odendi(s._id, 'havale'), 'Ödendi olarak işaretlendi')}>
                <i className="ti ti-cash" />Ödeme alındı (havale)
              </button>
            )}
          </div>
        </div>

        {s.durum === 'fiyat_bekliyor' && <FiyatVerPaneli siparis={s} onGuncellendi={onGuncellendi} />}

        <SiparisMatrisi kalemler={s.kalemler} />

        {s.durum !== 'iptal' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginTop: 10 }}>
            <div>
              <label className="form-label">Durum</label>
              <select className="form-input" value={s.durum} disabled={bekliyor} onChange={e => islem(() => toptanApi.admin.guncelle(s._id, { durum: e.target.value }), 'Durum güncellendi')}>
                {Object.entries(DURUMLAR).filter(([k]) => k !== 'iptal').map(([k, d]) => <option key={k} value={k}>{d.ad}</option>)}
              </select>
              {!s.odeme?.odendi && ['hazirlaniyor', 'uretimde', 'kargoda'].includes(s.durum) && <div style={{ fontSize: 11.5, color: 'var(--amber)', marginTop: 3 }}>⚠️ Ödeme henüz alınmadı</div>}
            </div>
            <div>
              <label className="form-label">Kargo firması</label>
              <input className="form-input" value={kargo.firma} onChange={e => setKargo(k => ({ ...k, firma: e.target.value }))} placeholder="Aras, Sürat…" />
            </div>
            <div>
              <label className="form-label">Takip no</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input className="form-input" value={kargo.takip_no} onChange={e => setKargo(k => ({ ...k, takip_no: e.target.value }))} />
                <button className="btn btn-secondary btn-sm" disabled={bekliyor} onClick={() => islem(() => toptanApi.admin.guncelle(s._id, { kargo, ...(kargo.takip_no && s.durum !== 'tamamlandi' ? { durum: 'kargoda' } : {}) }), 'Kargo bilgisi kaydedildi')}>Kaydet</button>
              </div>
            </div>
          </div>
        )}

        <div style={{ marginTop: 10 }}>
          <label className="form-label">Not (sadece sen görürsün)</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input className="form-input" value={not} onChange={e => setNot(e.target.value)} />
            <button className="btn btn-secondary btn-sm" disabled={bekliyor} onClick={() => islem(() => toptanApi.admin.guncelle(s._id, { admin_notu: not }), 'Not kaydedildi')}>Kaydet</button>
          </div>
        </div>

        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 12, maxHeight: 130, overflowY: 'auto' }}>
          {(s.gecmis || []).slice().reverse().map((g, i) => <div key={i}>{tarih(g.tarih)} — {g.olay}</div>)}
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          {s.durum !== 'iptal' ? (
            <button className="btn btn-secondary" style={{ color: 'var(--red)' }} disabled={bekliyor}
              onClick={() => {
                const neden = prompt(`#${s.siparis_no} iptal edilecek${s.stok_dusuldu && !s.stok_iade_edildi ? ` ve ${s.stok_adet} adet stok geri eklenecek` : ''}.${s.odeme?.odendi ? '\n⚠️ Ödeme alınmış - para iadesini ayrıca yapman gerekir.' : ''}\nİptal nedeni (isteğe bağlı):`, '');
                if (neden !== null) islem(() => toptanApi.admin.iptal(s._id, neden), 'Sipariş iptal edildi');
              }}>
              <i className="ti ti-x" />İptal et{s.stok_dusuldu && !s.stok_iade_edildi ? ' (stok iade)' : ''}
            </button>
          ) : <span />}
          <button className="btn btn-secondary" onClick={() => proformaYazdir(s, ayarlar)}><i className="ti ti-printer" />Yazdır / Proforma</button>
        </div>
      </div>
    </div>
  );
}

/** Fiyatı girilmemiş tablolar için birim fiyat gir → toplam hesaplanır, sipariş müşteriye ödemeye açılır. */
function FiyatVerPaneli({ siparis: s, onGuncellendi }) {
  const toast = useToast();
  const gruplar = [];
  for (const k of s.kalemler) {
    let g = gruplar.find(x => String(x.id) === String(k.havuz_id));
    if (!g) gruplar.push(g = { id: String(k.havuz_id), etiket: k.havuz_etiket, adet: 0, fiyat: k.birim_fiyat || 0 });
    g.adet += k.adet;
  }
  const [fiyatlar, setFiyatlar] = useState(() => Object.fromEntries(gruplar.map(g => [g.id, g.fiyat > 0 ? String(g.fiyat) : ''])));
  const [tabloya, setTabloya] = useState(true);
  const [bekliyor, setBekliyor] = useState(false);
  const ara = gruplar.reduce((t, g) => t + g.adet * (parseFloat(fiyatlar[g.id]) || 0), 0);
  const tamam = gruplar.every(g => parseFloat(fiyatlar[g.id]) > 0);
  const gonder = async () => {
    setBekliyor(true);
    try { const r = await toptanApi.admin.fiyatVer(s._id, fiyatlar, tabloya); onGuncellendi(r.data); toast('Fiyat bildirildi - sipariş ödemeye açıldı ✓'); }
    catch (e) { toast(e.response?.data?.hata || 'Fiyat kaydedilemedi', 'error'); }
    finally { setBekliyor(false); }
  };
  return (
    <div style={{ border: '2px solid var(--purple, #7e22ce)', borderRadius: 'var(--r-xs)', padding: '12px 14px', marginBottom: 14 }}>
      <div style={{ fontWeight: 800, marginBottom: 2 }}>Fiyat ver</div>
      <div style={{ fontSize: 12.5, color: 'var(--text2)', marginBottom: 10 }}>Birim fiyatları gir; adet ve müşteri indirimleri otomatik uygulanır. Kaydedince sipariş müşterinin panelinde ödemeye açılır.</div>
      {gruplar.map(g => (
        <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 180, fontSize: 13 }}><b>{g.etiket}</b> <span style={{ color: 'var(--text3)' }}>· {g.adet} adet</span></div>
          <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            Birim ₺<input type="number" min="0" step="0.01" className="form-input" style={{ width: 110, padding: '4px 6px' }} value={fiyatlar[g.id]}
              onChange={e => setFiyatlar(f => ({ ...f, [g.id]: e.target.value }))} />
          </label>
        </div>
      ))}
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5, margin: '8px 0', cursor: 'pointer' }}>
        <input type="checkbox" checked={tabloya} onChange={e => setTabloya(e.target.checked)} />Fiyatı olmayan tablolara bu fiyatı kaydet (sonraki siparişlerde otomatik gelsin)
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 13 }}>İndirim öncesi: <b>{tl(ara)}</b></span>
        <button className="btn btn-primary btn-sm" disabled={!tamam || bekliyor} onClick={gonder}><i className="ti ti-send" />{bekliyor ? 'Kaydediliyor…' : 'Fiyatı bildir'}</button>
      </div>
    </div>
  );
}

// ======================= Ön sipariş üretim listesi =======================

function UretimListesi() {
  const [liste, setListe] = useState(null);
  useEffect(() => { toptanApi.admin.uretimListesi().then(r => setListe(r.data)).catch(() => setListe([])); }, []);
  if (!liste) return <div style={{ textAlign: 'center', color: 'var(--text3)', padding: 40 }}>Yükleniyor…</div>;
  if (!liste.length) return <div className="card" style={{ padding: 30, textAlign: 'center', color: 'var(--text3)' }}>Açık ön sipariş yok.</div>;

  const sira = (b) => { const m = /\d+/.exec(b); return m ? parseInt(m[0], 10) : 999; };
  const bedenler = [...new Set(liste.flatMap(s => Object.keys(s.bedenler)))].sort((a, b) => sira(a) - sira(b));
  const toplam = (b, alan) => liste.reduce((t, s) => t + ((s.bedenler[b] || {})[alan] || 0), 0);
  const td = { padding: '7px 8px', borderBottom: '1px solid var(--border)', textAlign: 'center' };

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text2)', borderBottom: '1px solid var(--border)' }}>
        Üretilecek ön sipariş adetleri. <b style={{ color: 'var(--green)' }}>Koyu sayılar ödemesi alınmış</b> (üretime geçilebilir), <span style={{ color: 'var(--amber)' }}>parantez içindekiler ödeme bekleyen</span> talepler.
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--bg2)' }}>
              <th style={{ ...td, textAlign: 'left' }}>Tasarım</th>
              {bedenler.map(b => <th key={b} style={td}>{b}</th>)}
              <th style={td}>Toplam</th>
              <th style={{ ...td, textAlign: 'left' }}>Siparişler</th>
            </tr>
          </thead>
          <tbody>
            {liste.map(s => (
              <tr key={`${s.urun_adi}|${s.havuz_etiket}`}>
                <td style={{ ...td, textAlign: 'left' }}><b>{s.urun_adi}</b><div style={{ fontSize: 11, color: 'var(--text3)' }}>{s.havuz_etiket}</div></td>
                {bedenler.map(b => {
                  const h = s.bedenler[b];
                  return <td key={b} style={td}>{h ? <><b style={{ color: 'var(--green)' }}>{h.odenen || ''}</b>{h.bekleyen ? <span style={{ color: 'var(--amber)' }}> ({h.bekleyen})</span> : ''}</> : ''}</td>;
                })}
                <td style={td}><b style={{ color: 'var(--green)' }}>{s.odenen}</b>{s.bekleyen ? <span style={{ color: 'var(--amber)' }}> ({s.bekleyen})</span> : ''}</td>
                <td style={{ ...td, textAlign: 'left', fontSize: 11.5, color: 'var(--text3)' }}>{s.siparisler.join(', ')}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: 'var(--bg2)', fontWeight: 800 }}>
              <td style={{ ...td, textAlign: 'left' }}>Toplam</td>
              {bedenler.map(b => <td key={b} style={td}><span style={{ color: 'var(--green)' }}>{toplam(b, 'odenen') || ''}</span>{toplam(b, 'bekleyen') ? <span style={{ color: 'var(--amber)', fontWeight: 500 }}> ({toplam(b, 'bekleyen')})</span> : ''}</td>)}
              <td style={td}>{liste.reduce((t, s) => t + s.odenen, 0)}</td><td style={td} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ======================= Ayarlar =======================

function Ayarlar() {
  const toast = useToast();
  const [veri, setVeri] = useState(null);
  const [genel, setGenel] = useState(null);

  const yukle = useCallback(async () => {
    const r = await toptanApi.admin.ayarlar();
    setVeri(r.data); setGenel(r.data.ayarlar);
  }, []);
  useEffect(() => { yukle().catch(() => toast('Ayarlar yüklenemedi', 'error')); }, [yukle]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!veri || !genel) return <div style={{ textAlign: 'center', color: 'var(--text3)', padding: 40 }}>Yükleniyor…</div>;

  const genelKaydet = async () => {
    try { setGenel((await toptanApi.admin.ayarlariKaydet(genel)).data); toast('Toptan ayarları kaydedildi ✓'); }
    catch (e) { toast(e.response?.data?.hata || 'Kaydedilemedi', 'error'); }
  };
  const havuzKaydet = async (h, d) => {
    try { await toptanApi.admin.havuzGuncelle(h.id, d); setVeri(v => ({ ...v, havuzlar: v.havuzlar.map(x => x.id === h.id ? { ...x, ...d } : x) })); toast('Kaydedildi'); }
    catch { toast('Kaydedilemedi', 'error'); }
  };
  const musteriKaydet = async (m, d) => {
    try { await toptanApi.admin.musteriGuncelle(m._id, d); setVeri(v => ({ ...v, musteriler: v.musteriler.map(x => x._id === m._id ? { ...x, ...d } : x) })); toast('Kaydedildi'); }
    catch { toast('Kaydedilemedi', 'error'); }
  };
  const alan = (k, etiket, tip = 'number', ek = {}) => (
    <div>
      <label className="form-label">{etiket}</label>
      <input className="form-input" type={tip} value={genel[k] ?? ''} onChange={e => setGenel(g => ({ ...g, [k]: e.target.value }))} {...ek} />
    </div>
  );

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {/* Tablolar */}
      <div className="card" style={{ padding: 18 }}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Tablolar ve birim fiyatlar</div>
        <div style={{ fontSize: 12.5, color: 'var(--text2)', marginBottom: 12, lineHeight: 1.6 }}>Stok Senkron'daki her tablo müşteri panelinde (Miras Sipariş Alanı) otomatik listelenir. Stok, sitedeki ile aynı havuzdan gelir - stoktan sipariş verilince siteden de düşer.
          Fiyat girmediğin tablodan sipariş gelirse sipariş <b>"Fiyat Bekleyen"</b> olarak düşer; fiyatı sipariş ekranından bildirirsin, müşteri sonra öder.</div>
        {veri.havuzlar.map(h => <HavuzSatiri key={h.id} h={h} onKaydet={havuzKaydet} />)}
        {!veri.havuzlar.length && <div style={{ color: 'var(--text3)' }}>Henüz Stok Senkron tablosu yok.</div>}
      </div>

      {/* Müşteriler */}
      <div className="card" style={{ padding: 18 }}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Müşteriye özel indirim</div>
        <div style={{ fontSize: 12.5, color: 'var(--text2)', marginBottom: 12 }}>Giriş yapabilen tüm müşteri hesapları Miras Sipariş Alanı'nı görür ve sipariş verebilir - ayrıca yetki vermen gerekmez. İstersen bir müşteriye özel indirim tanımla; adet indiriminin üstüne uygulanır.</div>
        {veri.musteriler.map(m => (
          <div key={m._id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontWeight: 600 }}>{m.firma_adi || `${m.ad} ${m.soyad || ''}`}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>@{m.kullanici_adi} {m.telefon && `· ${m.telefon}`} {m.onay_bekliyor && <span style={{ color: 'var(--amber)' }}>· onay bekliyor</span>}</div>
            </div>
            <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              Özel indirim %<input type="number" min="0" max="90" className="form-input" style={{ width: 70, padding: '4px 6px' }} defaultValue={m.toptan_iskonto || 0}
                onBlur={e => Number(e.target.value) !== (m.toptan_iskonto || 0) && musteriKaydet(m, { toptan_iskonto: Number(e.target.value) })} />
            </label>
          </div>
        ))}
        {!veri.musteriler.length && <div style={{ color: 'var(--text3)' }}>Henüz müşteri hesabı yok.</div>}
      </div>

      {/* Genel kurallar */}
      <div className="card" style={{ padding: 18 }}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>Sipariş kuralları</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          {alan('min_stok_adet', 'Stoktan min. adet', 'number', { min: 1 })}
          {alan('min_on_siparis_adet', 'Ön sipariş min. adet', 'number', { min: 1 })}
          {alan('odeme_sure_saat', 'Ödeme süresi (saat, 0 = sınırsız)', 'number', { min: 0 })}
          {alan('on_siparis_sure', 'Ön sipariş üretim süresi (metin)', 'text', { placeholder: '10-15 iş günü' })}
        </div>
        <div style={{ marginTop: 12 }}>{alan('fiyat_notu', 'Fiyat notu (müşteriye gösterilir)', 'text')}</div>
        <div style={{ marginTop: 12 }}>
          <label className="form-label">Adet indirimleri (toplam adede göre)</label>
          {(genel.kademeler || []).map((k, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <input type="number" className="form-input" style={{ width: 100 }} value={k.adet} onChange={e => setGenel(g => ({ ...g, kademeler: g.kademeler.map((x, j) => j === i ? { ...x, adet: e.target.value } : x) }))} />
              <span style={{ fontSize: 13 }}>adet ve üstü →</span>
              <input type="number" className="form-input" style={{ width: 80 }} value={k.indirim} onChange={e => setGenel(g => ({ ...g, kademeler: g.kademeler.map((x, j) => j === i ? { ...x, indirim: e.target.value } : x) }))} />
              <span style={{ fontSize: 13 }}>% indirim</span>
              <button className="btn-icon" onClick={() => setGenel(g => ({ ...g, kademeler: g.kademeler.filter((_, j) => j !== i) }))}><i className="ti ti-trash" /></button>
            </div>
          ))}
          <button className="btn btn-secondary btn-sm" onClick={() => setGenel(g => ({ ...g, kademeler: [...(g.kademeler || []), { adet: 300, indirim: 15 }] }))}><i className="ti ti-plus" />Kademe ekle</button>
        </div>
        <div style={{ marginTop: 12 }}>
          <label className="form-label">Havale / EFT bilgisi (boş bırakılırsa havale seçeneği gösterilmez)</label>
          <textarea className="form-input" rows={3} value={genel.havale_bilgisi || ''} onChange={e => setGenel(g => ({ ...g, havale_bilgisi: e.target.value }))} placeholder={'Banka: …\nAlıcı: …\nIBAN: TR…'} />
        </div>
        <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={genelKaydet}><i className="ti ti-device-floppy" />Kaydet</button>
      </div>

      <div className="card" style={{ padding: 14, fontSize: 13, color: 'var(--text2)' }}>
        <i className="ti ti-credit-card" /> Kartla ödeme (PayTR) bağlantısı <b>"Ödeme / PayTR"</b> sekmesinde.
      </div>
    </div>
  );
}

function HavuzSatiri({ h, onKaydet }) {
  const [fiyat, setFiyat] = useState(h.toptan_fiyat || '');
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ fontWeight: 600 }}>{h.etiket}</div>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>{h.urun_sayisi} tasarım · {h.bedenler.join(', ')}</div>
      </div>
      <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
        Birim fiyat ₺<input type="number" min="0" className="form-input" style={{ width: 110, padding: '4px 6px' }} value={fiyat} placeholder="sonra" onChange={e => setFiyat(e.target.value)}
          onBlur={() => Number(fiyat) !== (h.toptan_fiyat || 0) && onKaydet(h, { toptan_fiyat: Number(fiyat) || 0 })} />
      </label>
      <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
        <input type="checkbox" checked={!h.toptan_gizli} onChange={e => onKaydet(h, { toptan_gizli: !e.target.checked })} />
        Müşteriye göster
      </label>
    </div>
  );
}
