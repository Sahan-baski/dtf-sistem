/**
 * Siparişler → "Site & Shopier": WooCommerce + Shopier siparişleri, Basit
 * Kargo'daki gönderi durumuyla birleştirilmiş tek liste. 10 dakikada bir
 * sunucuda kendiliğinden senkronlanır. "Talimat Hazırla" açık siparişlerin
 * hazırlama talimatını A4'e 6'şar sipariş olacak şekilde yazdırır.
 * Site siparişine tıklayınca eski "Üretim Talimatı" detayı (kargo kodu
 * oluşturma + tekli çıktı) açılır.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { siparisSenkronApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { SiparisDetay as UretimDetay } from '../pages/UretimTalimatiPage';
import { talimatYazdir } from './talimatYazdir';

export const BIRLESIK_DURUMLAR = {
  hazirlanacak:   { ad: 'Hazırlanacak',  cls: 'badge-amber',  ikon: 'ti-package' },
  kargoya_hazir:  { ad: 'Kargoya Hazır', cls: 'badge-blue',   ikon: 'ti-barcode' },
  kargoda:        { ad: 'Kargoda',       cls: 'badge-indigo', ikon: 'ti-truck' },
  teslim_edildi:  { ad: 'Teslim Edildi', cls: 'badge-green',  ikon: 'ti-circle-check' },
  sorunlu:        { ad: 'Sorunlu',       cls: 'badge-red',    ikon: 'ti-alert-triangle' },
  iade:           { ad: 'İade',          cls: 'badge-red',    ikon: 'ti-arrow-back-up' },
  odeme_bekliyor: { ad: 'Ödeme Bekliyor', cls: 'badge-gray',  ikon: 'ti-clock' },
  iptal:          { ad: 'İptal',         cls: 'badge-gray',   ikon: 'ti-x' },
};
const BK_DURUM = { NEW: 'Yeni', READY_TO_SHIP: 'Barkodlu, kargoya verilecek', SHIPPED: 'Kargoya verildi', OUT_FOR_DELIVERY: 'Dağıtımda', DELIVERED: 'Teslim edildi', NEEDS_SUPPORT: 'Destek gerekiyor', DELAYED: 'Gecikmede', RETURNING: 'İade yolunda', RETURNED: 'İade edildi', LOST: 'Kayıp' };

const FILTRELER = [
  ['acik', 'Hazırlanacak + Kargoya Hazır'], ['hazirlanacak', 'Hazırlanacak'], ['kargoya_hazir', 'Kargoya Hazır'], ['kargoda', 'Kargoda'],
  ['teslim_edildi', 'Teslim Edildi'], ['sorunlu,iade', 'Sorunlu / İade'], ['odeme_bekliyor', 'Ödeme Bekleyen'], ['iptal', 'İptal'], ['', 'Tümü'],
];

function gecenSure(t) {
  if (!t) return '';
  const dk = Math.round((Date.now() - new Date(t)) / 60000);
  if (dk < 1) return 'az önce';
  if (dk < 60) return `${dk} dk önce`;
  if (dk < 1440) return `${Math.round(dk / 60)} saat önce`;
  return `${Math.round(dk / 1440)} gün önce`;
}

export default function SiteSiparisleri({ toast }) {
  const { kullanici } = useAuth();
  const [filtre, setFiltre] = useState('acik');
  const [kaynak, setKaynak] = useState('');
  const [ara, setAra] = useState('');
  const [veri, setVeri] = useState({ siparisler: [], sayilar: {}, senkron: null });
  const [yukleniyor, setYukleniyor] = useState(true);
  const [senkronda, setSenkronda] = useState(false);
  const [secili, setSecili] = useState(new Set());
  const [detay, setDetay] = useState(null);
  const [talimatAcik, setTalimatAcik] = useState(false);
  const [ayarAcik, setAyarAcik] = useState(false);
  const [ozetAcik, setOzetAcik] = useState(false);

  const yukle = useCallback(async (sessiz) => {
    if (!sessiz) setYukleniyor(true);
    try { setVeri((await siparisSenkronApi.liste({ durum: filtre || undefined, kaynak: kaynak || undefined, ara: ara || undefined })).data); }
    catch (e) { if (!sessiz) toast(e.response?.data?.hata || 'Siparişler yüklenemedi', 'error'); }
    finally { setYukleniyor(false); }
  }, [filtre, kaynak, ara]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { const t = setTimeout(() => yukle(), ara ? 300 : 0); return () => clearTimeout(t); }, [yukle, ara]);
  useEffect(() => { const t = setInterval(() => yukle(true), 60000); return () => clearInterval(t); }, [yukle]);

  const senkronla = useCallback(async (sessiz) => {
    setSenkronda(true);
    try { await siparisSenkronApi.senkronla(); await yukle(true); if (!sessiz) toast('Siparişler güncellendi ✓'); }
    catch (e) { if (!sessiz) toast(e.response?.data?.hata || 'Senkron başarısız', 'error'); }
    finally { setSenkronda(false); }
  }, [yukle]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sayfa açıldığında son senkron 10 dakikadan eskiyse hemen bir kez senkronla.
  useEffect(() => {
    if (!veri.senkron) return;
    const son = veri.senkron.son ? new Date(veri.senkron.son) : null;
    if (!veri.senkron.calisiyor && (!son || Date.now() - son > 10 * 60000)) senkronla(true);
  }, [veri.senkron?.son]); // eslint-disable-line react-hooks/exhaustive-deps

  const { siparisler, sayilar, senkron } = veri;
  const acikSayi = (sayilar.hazirlanacak || 0) + (sayilar.kargoya_hazir || 0);
  const hazirlanacakUrun = useMemo(() => siparisler.filter(s => s.durum === 'hazirlanacak').reduce((t, s) => t + s.kalemler.reduce((a, k) => a + (k.adet || 0), 0), 0), [siparisler]);

  const toggleSec = (id) => setSecili(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  if (detay && detay.kaynak === 'woocommerce') {
    return <UretimDetay siparisId={detay.dis_id} toast={toast} onGeri={() => { setDetay(null); yukle(true); }} />;
  }

  return (
    <div>
      {/* Senkron durumu + aksiyonlar */}
      <div className="card" style={{ padding: '12px 16px', marginBottom: 14, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240, fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.6 }}>
          <div><b style={{ color: 'var(--text)' }}>Otomatik senkron</b> (10 dakikada bir) · son: {senkron?.son ? gecenSure(senkron.son) : 'henüz yok'}{senkronda || senkron?.calisiyor ? ' · şu an güncelleniyor…' : ''}</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <KaynakDurumu ad="Site (WooCommerce)" d={senkron?.kaynaklar?.woocommerce} />
            <KaynakDurumu ad="Shopier" d={senkron?.kaynaklar?.shopier} />
            <KaynakDurumu ad="Basit Kargo" d={senkron?.kaynaklar?.basitkargo} ek={senkron?.kaynaklar?.basitkargo?.eslesmeyen ? `${senkron.kaynaklar.basitkargo.eslesmeyen} gönderi eşleşmedi` : ''} />
          </div>
        </div>
        <button className="btn btn-secondary" onClick={() => senkronla(false)} disabled={senkronda}><i className={`ti ${senkronda ? 'ti-loader-2' : 'ti-refresh'}`} />Şimdi Senkronla</button>
        <button className="btn btn-primary" onClick={() => setTalimatAcik(true)}><i className="ti ti-printer" />Talimat Hazırla</button>
        {kullanici?.rol === 'admin' && <button className="btn-icon" title="Shopier bağlantısı" onClick={() => setAyarAcik(true)}><i className="ti ti-settings" /></button>}
      </div>

      {/* Günün özeti */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 14 }}>
        <OzetKart baslik="Hazırlanacak" deger={sayilar.hazirlanacak || 0} alt={filtre === 'acik' || filtre === 'hazirlanacak' ? `${hazirlanacakUrun} ürün` : ''} renk="var(--amber)" onClick={() => setFiltre('hazirlanacak')} />
        <OzetKart baslik="Kargoya Hazır" deger={sayilar.kargoya_hazir || 0} alt="barkodlu, kargocuya verilecek" renk="var(--blue)" onClick={() => setFiltre('kargoya_hazir')} />
        <OzetKart baslik="Kargoda" deger={sayilar.kargoda || 0} renk="var(--indigo)" onClick={() => setFiltre('kargoda')} />
        <OzetKart baslik="Sorunlu / İade" deger={(sayilar.sorunlu || 0) + (sayilar.iade || 0)} renk="var(--red)" onClick={() => setFiltre('sorunlu,iade')} />
      </div>

      {/* Filtreler */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        {FILTRELER.map(([k, ad]) => (
          <button key={k} className={`filter-btn ${filtre === k ? 'active' : ''}`} onClick={() => { setFiltre(k); setSecili(new Set()); }}>
            {ad}{k === 'acik' ? ` (${acikSayi})` : k && !k.includes(',') && sayilar[k] ? ` (${sayilar[k]})` : ''}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <select className="form-input" style={{ width: 'auto', padding: '6px 10px' }} value={kaynak} onChange={e => setKaynak(e.target.value)}>
          <option value="">Tüm kaynaklar</option><option value="woocommerce">Sadece site</option><option value="shopier">Sadece Shopier</option>
        </select>
        <input className="form-input" style={{ maxWidth: 300, padding: '6px 10px' }} placeholder="Sipariş no, müşteri, telefon, ürün, takip no…" value={ara} onChange={e => setAra(e.target.value)} />
        {(filtre === 'acik' || filtre === 'hazirlanacak') && siparisler.length > 0 && (
          <button className="btn btn-secondary btn-sm" onClick={() => setOzetAcik(a => !a)}><i className="ti ti-list-numbers" />{ozetAcik ? 'Toplu özeti gizle' : 'Toplu ürün özeti'}</button>
        )}
        {secili.size > 0 && <span style={{ fontSize: 12.5, color: 'var(--text2)', alignSelf: 'center' }}>{secili.size} seçili · <a href="#" onClick={e => { e.preventDefault(); setSecili(new Set()); }}>temizle</a></span>}
      </div>

      {ozetAcik && <TopluOzet siparisler={siparisler.filter(s => s.durum === 'hazirlanacak')} />}

      {yukleniyor && !siparisler.length ? <div style={{ textAlign: 'center', color: 'var(--text3)', padding: 40 }}>Yükleniyor…</div>
        : !siparisler.length ? (
          <div className="card" style={{ padding: 30, textAlign: 'center', color: 'var(--text3)' }}>
            <i className="ti ti-clipboard-off" style={{ fontSize: 32, display: 'block', marginBottom: 8 }} />
            {senkron?.son ? 'Bu filtrede sipariş yok.' : 'İlk senkron yapılıyor, birkaç saniye içinde siparişler gelecek…'}
          </div>
        ) : siparisler.map(s => (
          <SiparisSatiri key={s._id} s={s} secili={secili.has(s._id)} onSec={() => toggleSec(s._id)} onAc={() => setDetay(s)} />
        ))}

      {talimatAcik && (
        <TalimatModal
          acikSiparisler={filtre === 'acik' ? siparisler : null}
          seciliSiparisler={siparisler.filter(s => secili.has(s._id))}
          toast={toast}
          onKapat={() => setTalimatAcik(false)}
          onBasildi={() => { setTalimatAcik(false); setSecili(new Set()); yukle(true); }}
        />
      )}
      {detay && detay.kaynak === 'shopier' && <ShopierDetay s={detay} onKapat={() => setDetay(null)} />}
      {ayarAcik && <EntegrasyonAyarlari toast={toast} onKapat={() => setAyarAcik(false)} onKaydedildi={() => { setAyarAcik(false); senkronla(false); }} />}
    </div>
  );
}

function KaynakDurumu({ ad, d, ek }) {
  if (!d) return <span>{ad}: <span style={{ color: 'var(--text3)' }}>—</span></span>;
  if (d.durum === 'ok') return <span>{ad}: <span style={{ color: 'var(--green)', fontWeight: 600 }}>✓ {d.sayi}</span>{ek && <span style={{ color: 'var(--text3)' }}> ({ek})</span>}</span>;
  if (d.durum === 'kapali') return <span>{ad}: <span style={{ color: 'var(--text3)' }}>bağlı değil</span></span>;
  return <span title={d.mesaj}>{ad}: <span style={{ color: 'var(--red)', fontWeight: 600 }}>⚠ {String(d.mesaj || 'hata').slice(0, 60)}</span></span>;
}

function OzetKart({ baslik, deger, alt, renk, onClick }) {
  return (
    <div className="stat-card" onClick={onClick} style={{ cursor: 'pointer', borderTop: `3px solid ${renk}` }}>
      <div style={{ fontSize: 24, fontWeight: 800, color: deger ? renk : 'var(--text3)' }}>{deger}</div>
      <div style={{ fontSize: 12.5, color: 'var(--text2)' }}>{baslik}</div>
      {alt && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{alt}</div>}
    </div>
  );
}

function SiparisSatiri({ s, secili, onSec, onAc }) {
  const d = BIRLESIK_DURUMLAR[s.durum] || BIRLESIK_DURUMLAR.hazirlanacak;
  const gun = s.tarih ? Math.floor((Date.now() - new Date(s.tarih)) / 86400000) : 0;
  const gecikti = s.durum === 'hazirlanacak' && gun >= 2;
  const adet = s.kalemler.reduce((t, k) => t + (k.adet || 0), 0);
  return (
    <div className="card" style={{ padding: '10px 14px', marginBottom: 8, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', borderLeft: gecikti ? '4px solid var(--red)' : undefined }}>
      <input type="checkbox" checked={secili} onChange={onSec} onClick={e => e.stopPropagation()} style={{ width: 16, height: 16 }} title="Talimat için seç" />
      <div style={{ minWidth: 150, cursor: 'pointer' }} onClick={onAc}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 9.5, fontWeight: 800, color: '#fff', background: s.kaynak === 'shopier' ? '#7c3aed' : '#15803d', padding: '1px 6px', borderRadius: 4 }}>{s.kaynak === 'shopier' ? 'SHOPIER' : 'SİTE'}</span>
          <b>#{s.numara}</b>
        </div>
        <div style={{ fontSize: 11.5, color: gecikti ? 'var(--red)' : 'var(--text3)', fontWeight: gecikti ? 700 : 400 }}>
          {s.tarih ? new Date(s.tarih).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}{gecikti ? ` · ${gun} gündür bekliyor` : ''}
        </div>
      </div>
      <div style={{ minWidth: 150, flex: '0 1 200px', cursor: 'pointer' }} onClick={onAc}>
        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{s.musteri?.ad_soyad || '—'}</div>
        <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>{[s.musteri?.il, s.musteri?.ilce].filter(Boolean).join(' / ')}</div>
      </div>
      <div style={{ flex: 1, minWidth: 200, display: 'flex', gap: 6, flexWrap: 'wrap', cursor: 'pointer' }} onClick={onAc}>
        {s.kalemler.slice(0, 6).map((k, i) => (
          <div key={i} title={`${k.ad} · ${k.beden} · ${k.adet} adet`} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--bg2)', borderRadius: 8, padding: 3, paddingRight: 7 }}>
            {k.gorsel ? <img src={k.gorsel} alt="" loading="lazy" style={{ width: 34, height: 34, objectFit: 'cover', borderRadius: 6 }} /> : <div style={{ width: 34, height: 34, borderRadius: 6, background: 'var(--bg3)' }} />}
            <div style={{ fontSize: 11.5, lineHeight: 1.2 }}><b>{k.beden || '—'}</b><div style={{ color: k.adet > 1 ? 'var(--red)' : 'var(--text3)', fontWeight: k.adet > 1 ? 700 : 400 }}>×{k.adet}</div></div>
          </div>
        ))}
        {s.kalemler.length > 6 && <span style={{ fontSize: 12, color: 'var(--text3)', alignSelf: 'center' }}>+{s.kalemler.length - 6}</span>}
      </div>
      <div style={{ minWidth: 130, fontSize: 11.5, color: 'var(--text2)', textAlign: 'right' }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{Math.round(s.toplam || 0).toLocaleString('tr-TR')}₺ <span style={{ fontWeight: 400, color: 'var(--text3)' }}>· {adet} ürün</span></div>
        {s.kargo?.basit_kargo_id
          ? <div title={`Basit Kargo eşleşmesi: ${s.kargo.eslesme}`}>{s.kargo.firma || 'Basit Kargo'}{s.kargo.takip_no ? ` · ${s.kargo.takip_no}` : ''}<div style={{ color: 'var(--text3)' }}>{BK_DURUM[s.kargo.durum] || s.kargo.durum}</div></div>
          : <div style={{ color: 'var(--text3)' }}>Kargo kaydı yok</div>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, minWidth: 110 }}>
        <span className={`badge ${d.cls}`}><i className={`ti ${d.ikon}`} style={{ fontSize: 10 }} /> {d.ad}</span>
        {s.talimat_basildi && <span style={{ fontSize: 10.5, color: 'var(--text3)' }} title={new Date(s.talimat_basildi).toLocaleString('tr-TR')}><i className="ti ti-printer" /> talimat basıldı</span>}
      </div>
    </div>
  );
}

function TopluOzet({ siparisler }) {
  const satirlar = useMemo(() => {
    const m = new Map();
    for (const s of siparisler) for (const k of s.kalemler) {
      const a = m.get(k.ad) || { ad: k.ad, gorsel: k.gorsel, bedenler: {}, toplam: 0 };
      a.bedenler[k.beden || '—'] = (a.bedenler[k.beden || '—'] || 0) + k.adet;
      a.toplam += k.adet;
      m.set(k.ad, a);
    }
    return [...m.values()].sort((a, b) => b.toplam - a.toplam);
  }, [siparisler]);
  const sira = (b) => { const x = /\d+/.exec(b); return x ? parseInt(x[0], 10) : 999; };
  const bedenler = [...new Set(satirlar.flatMap(a => Object.keys(a.bedenler)))].sort((a, b) => sira(a) - sira(b));
  const td = { padding: '5px 8px', borderBottom: '1px solid var(--border)', textAlign: 'center' };
  if (!satirlar.length) return null;
  return (
    <div className="card" style={{ padding: 0, marginBottom: 14, overflowX: 'auto' }}>
      <div style={{ padding: '10px 14px', fontSize: 13, fontWeight: 700 }}>Hazırlanacak siparişlerin toplu ürün listesi <span style={{ fontWeight: 400, color: 'var(--text3)' }}>— baskıya toplu girmek için</span></div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
        <thead><tr style={{ background: 'var(--bg2)' }}><th style={{ ...td, textAlign: 'left' }}>Ürün</th>{bedenler.map(b => <th key={b} style={td}>{b}</th>)}<th style={td}>Toplam</th></tr></thead>
        <tbody>{satirlar.map(a => (
          <tr key={a.ad}>
            <td style={{ ...td, textAlign: 'left' }}><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{a.gorsel && <img src={a.gorsel} alt="" style={{ width: 28, height: 28, borderRadius: 5, objectFit: 'cover' }} />}{a.ad}</div></td>
            {bedenler.map(b => <td key={b} style={td}>{a.bedenler[b] || ''}</td>)}
            <td style={{ ...td, fontWeight: 800 }}>{a.toplam}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function TalimatModal({ acikSiparisler, seciliSiparisler, toast, onKapat, onBasildi }) {
  const [liste, setListe] = useState(acikSiparisler);
  const [kapsam, setKapsam] = useState(seciliSiparisler.length ? 'secili' : 'basilmamis');
  const [ozetEkle, setOzetEkle] = useState(true);
  useEffect(() => {
    if (acikSiparisler) return;
    siparisSenkronApi.liste({ durum: 'acik' }).then(r => setListe(r.data.siparisler)).catch(() => setListe([]));
  }, [acikSiparisler]);

  const hazirlanacak = (liste || []).filter(s => s.durum === 'hazirlanacak');
  const basilmamis = hazirlanacak.filter(s => !s.talimat_basildi);
  const secenekler = [
    ['basilmamis', `Talimatı henüz basılmamış hazırlanacak siparişler (${basilmamis.length})`, basilmamis],
    ['hepsi', `Tüm hazırlanacak siparişler (${hazirlanacak.length})`, hazirlanacak],
    ...(seciliSiparisler.length ? [['secili', `Listede seçtiklerim (${seciliSiparisler.length})`, seciliSiparisler]] : []),
  ];
  const hedef = (secenekler.find(x => x[0] === kapsam) || secenekler[0])[2];
  const sayfa = Math.ceil(hedef.length / 6);

  const yazdir = async () => {
    if (!hedef.length) return;
    if (!talimatYazdir(hedef, { ozetEkle })) return;
    try { await siparisSenkronApi.talimatBasildi(hedef.map(s => s._id)); } catch { /* yazdırma yine de açıldı */ }
    toast(`${hedef.length} siparişin talimatı hazırlandı`);
    onBasildi();
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onKapat()}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-title">🖨️ Hazırlama Talimatı</div>
        {!liste ? <div style={{ color: 'var(--text3)', padding: 20 }}>Yükleniyor…</div> : (
          <>
            {secenekler.map(([k, ad]) => (
              <label key={k} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 0', cursor: 'pointer', fontSize: 13.5 }}>
                <input type="radio" checked={kapsam === k} onChange={() => setKapsam(k)} />{ad}
              </label>
            ))}
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 0', cursor: 'pointer', fontSize: 13.5, borderTop: '1px solid var(--border)', marginTop: 6 }}>
              <input type="checkbox" checked={ozetEkle} onChange={e => setOzetEkle(e.target.checked)} />Sona toplu ürün özeti sayfası ekle (tasarım × beden toplamları)
            </label>
            <div style={{ fontSize: 12.5, color: 'var(--text2)', background: 'var(--bg2)', borderRadius: 8, padding: '8px 12px', marginTop: 8 }}>
              A4'e alt alta 6 sipariş · {hedef.length} sipariş = {sayfa} sayfa{ozetEkle && hedef.length ? ' + 1 özet sayfası' : ''}. En eski sipariş en üstte. Yazdırılanlar listede "talimat basıldı" olarak işaretlenir.
            </div>
          </>
        )}
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onKapat}>Vazgeç</button>
          <button className="btn btn-primary" disabled={!hedef.length} onClick={yazdir}><i className="ti ti-printer" />Yazdır</button>
        </div>
      </div>
    </div>
  );
}

function ShopierDetay({ s, onKapat }) {
  const d = BIRLESIK_DURUMLAR[s.durum] || BIRLESIK_DURUMLAR.hazirlanacak;
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onKapat()}>
      <div className="modal" style={{ maxWidth: 620 }}>
        <div className="modal-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Shopier #{s.numara} <span className={`badge ${d.cls}`}>{d.ad}</span></span>
          <button className="btn-icon" onClick={onKapat}><i className="ti ti-x" /></button>
        </div>
        <div style={{ fontSize: 13.5, lineHeight: 1.6, marginBottom: 12 }}>
          <b>{s.musteri?.ad_soyad}</b> · {s.musteri?.telefon}<br />{s.musteri?.adres} {s.musteri?.ilce} / {s.musteri?.il}
          {s.musteri_notu && <div style={{ color: 'var(--amber)' }}>Not: {s.musteri_notu}</div>}
        </div>
        {s.kalemler.map((k, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
            {k.gorsel ? <img src={k.gorsel} alt="" style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 8 }} /> : <div style={{ width: 52, height: 52, borderRadius: 8, background: 'var(--bg3)' }} />}
            <div style={{ flex: 1, fontSize: 13 }}>{k.ad}<div style={{ color: 'var(--text3)' }}>Beden: <b style={{ color: 'var(--text)' }}>{k.beden || '—'}</b></div></div>
            <b style={{ fontSize: 16, color: k.adet > 1 ? 'var(--red)' : 'var(--text)' }}>×{k.adet}</b>
          </div>
        ))}
        <div style={{ fontSize: 13, marginTop: 12, color: 'var(--text2)' }}>
          Toplam <b style={{ color: 'var(--text)' }}>{Math.round(s.toplam || 0).toLocaleString('tr-TR')}₺</b> · Shopier durumu: {s.kaynak_durum || '—'}<br />
          Kargo: {s.kargo?.basit_kargo_id ? `${s.kargo.firma || 'Basit Kargo'} ${s.kargo.takip_no || ''} · ${BK_DURUM[s.kargo.durum] || s.kargo.durum}` : 'Basit Kargo\'da eşleşen gönderi yok'}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => talimatYazdir([s], { ozetEkle: false })}><i className="ti ti-printer" />Tek talimat yazdır</button>
        </div>
      </div>
    </div>
  );
}

function EntegrasyonAyarlari({ toast, onKapat, onKaydedildi }) {
  const [durum, setDurum] = useState(null);
  const [token, setToken] = useState('');
  useEffect(() => { siparisSenkronApi.ayarlar().then(r => setDurum(r.data)).catch(() => setDurum({})); }, []);
  const kaydet = async () => {
    try { await siparisSenkronApi.ayarlariKaydet({ shopier_token: token }); toast('Shopier anahtarı kaydedildi ✓'); onKaydedildi(); }
    catch { toast('Kaydedilemedi', 'error'); }
  };
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onKapat()}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-title">Sipariş kaynakları</div>
        {!durum ? 'Yükleniyor…' : (
          <div style={{ fontSize: 13.5, lineHeight: 1.6 }}>
            <div><b>Site (WooCommerce):</b> mevcut WooCommerce bağlantısı kullanılıyor ✓</div>
            <div><b>Basit Kargo:</b> {durum.basit_kargo_token_var ? 'bağlı ✓ (Render\'daki BASIT_KARGO_TOKEN)' : <span style={{ color: 'var(--red)' }}>BASIT_KARGO_TOKEN tanımlı değil</span>}</div>
            <div style={{ marginTop: 12 }}><b>Shopier:</b> {durum.shopier_token_girildi ? <span style={{ color: 'var(--green)' }}>anahtar girildi ✓</span> : 'bağlı değil'}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text2)', margin: '4px 0 8px' }}>
              Shopier → Hesap Yönetimi → <b>Kişisel Erişim Anahtarı</b> bölümünden oluştur (önce hesabında iki adımlı doğrulama açık olmalı). Anahtar sadece bir kez gösterilir, kopyalayıp buraya yapıştır.
            </div>
            <input className="form-input" type="password" autoComplete="new-password" value={token} onChange={e => setToken(e.target.value)} placeholder={durum.shopier_token_girildi ? '•••••• girildi - değiştirmek için yaz' : 'Shopier kişisel erişim anahtarı'} />
          </div>
        )}
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onKapat}>Kapat</button>
          <button className="btn btn-primary" disabled={!token.trim()} onClick={kaydet}>Kaydet ve senkronla</button>
        </div>
      </div>
    </div>
  );
}
