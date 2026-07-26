import { useState, useEffect, useCallback } from 'react';
import { urunApi } from '../api';
import { useToast } from '../context/ToastContext';

const KATEGORILER = [
  { key:'tisort_baskili',   label:'Tişört (baskılı)',        grup:'Baskılı Ürün', renk:'#2ecc8f' },
  { key:'tisort_baskisiz',  label:'Tişört (baskısız)',       grup:'Baskılı Ürün', renk:'#2ecc8f' },
  { key:'sweat_baskili',    label:'Sweatshirt (baskılı)',    grup:'Baskılı Ürün', renk:'#2ecc8f' },
  { key:'sweat_baskisiz',   label:'Sweatshirt (baskısız)',   grup:'Baskılı Ürün', renk:'#2ecc8f' },
  { key:'is_montu',         label:'İş Montu',                grup:'Baskılı Ürün', renk:'#2ecc8f' },
  { key:'sapka',            label:'Şapka',                   grup:'Baskılı Ürün', renk:'#2ecc8f' },
  { key:'buzgulu_kese',     label:'Büzgülü Kese',            grup:'Baskılı Ürün', renk:'#2ecc8f' },
  { key:'buzgulu_sirt',     label:'Büzgülü Sırt Çantası',   grup:'Baskılı Ürün', renk:'#2ecc8f' },
  { key:'kol_cantasi',      label:'Kol Çantası',             grup:'Baskılı Ürün', renk:'#2ecc8f' },
  { key:'dtf_katalog',      label:'DTF – Katalogdan',        grup:'DTF Baskı',    renk:'#4f7ef8' },
  { key:'dtf_hazirlama',    label:'DTF – Hazırlama',         grup:'DTF Baskı',    renk:'#4f7ef8' },
  { key:'dtf_pdf',          label:'DTF – Hazır PDF',         grup:'DTF Baskı',    renk:'#4f7ef8' },
  { key:'press_hizmet',     label:'Pressleme Hizmeti',       grup:'Hizmet',       renk:'#f0a500' },
  { key:'baski_press',      label:'Baskı + Pressleme',       grup:'Hizmet',       renk:'#f0a500' },
];

const BEDEN_SABLONLARI = {
  tisort_baskili:  ['XS','S','M','L','XL','XXL','3XL'],
  tisort_baskisiz: ['XS','S','M','L','XL','XXL','3XL'],
  sweat_baskili:   ['S','M','L','XL','XXL','3XL'],
  sweat_baskisiz:  ['S','M','L','XL','XXL','3XL'],
  is_montu:        ['S','M','L','XL','XXL','3XL'],
  sapka:           ['Standart','S-M','L-XL'],
};

const BOSLUK = { background:'none', border:'none', padding:0, cursor:'pointer', display:'flex', alignItems:'center' };

export default function UrunlerPage() {
  const toast = useToast();
  const [aktifKat, setAktifKat] = useState(KATEGORILER[0].key);
  const [urunler, setUrunler] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [modal, setModal] = useState(null); // null | 'yeni' | urun_id

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    try { const r = await urunApi.getAll(aktifKat); setUrunler(r.data); }
    catch { toast('Yüklenemedi','error'); }
    finally { setYukleniyor(false); }
  }, [aktifKat]);

  useEffect(() => { yukle(); }, [yukle]);

  const handleSil = async (id) => {
    if (!confirm('Bu ürünü silmek istediğinize emin misiniz?')) return;
    try { await urunApi.delete(id); toast('Silindi'); yukle(); }
    catch { toast('Silinemedi','error'); }
  };

  const handleToggle = async (id) => {
    try { await urunApi.toggle(id); yukle(); }
    catch { toast('Hata','error'); }
  };

  const kat = KATEGORILER.find(k => k.key === aktifKat);
  const gruplar = [...new Set(KATEGORILER.map(k => k.grup))];

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">🛍️ Ürün Kataloğu</div>
          <div className="page-sub">Kategori bazlı ürün ve varyant yönetimi</div>
        </div>
        <button className="btn btn-primary" onClick={() => setModal('yeni')}>
          <i className="ti ti-plus"/> Ürün Ekle
        </button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'220px 1fr', gap:20 }}>

        {/* Sol: Kategori listesi */}
        <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:12, height:'fit-content' }}>
          {gruplar.map(grup => (
            <div key={grup} style={{ marginBottom:16 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.08em', padding:'4px 8px', marginBottom:4 }}>
                {grup}
              </div>
              {KATEGORILER.filter(k => k.grup === grup).map(k => (
                <button key={k.key} onClick={() => setAktifKat(k.key)}
                  style={{ width:'100%', textAlign:'left', padding:'8px 10px', borderRadius:'var(--radius-sm)', border:'none', background: aktifKat===k.key ? `${k.renk}18` : 'none', color: aktifKat===k.key ? k.renk : 'var(--text2)', fontSize:13, fontWeight: aktifKat===k.key ? 600 : 400, cursor:'pointer', transition:'all 0.15s', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span>{k.label}</span>
                  <span style={{ fontSize:11, background:'var(--bg3)', color:'var(--text3)', padding:'1px 6px', borderRadius:10 }}>
                    {/* ürün sayısı buraya gelecek */}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Sağ: Ürün listesi */}
        <div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
            <div>
              <span style={{ fontSize:16, fontWeight:700, color: kat?.renk }}>{kat?.label}</span>
              <span style={{ fontSize:13, color:'var(--text3)', marginLeft:8 }}>{urunler.length} ürün</span>
            </div>
          </div>

          {yukleniyor ? (
            <div style={{ textAlign:'center', color:'var(--text2)', padding:40 }}>Yükleniyor...</div>
          ) : urunler.length === 0 ? (
            <div style={{ textAlign:'center', padding:40, color:'var(--text3)', background:'var(--bg2)', border:'2px dashed var(--border)', borderRadius:'var(--radius)' }}>
              <i className="ti ti-package-off" style={{ fontSize:36, display:'block', marginBottom:10 }}/>
              <div style={{ fontSize:14, marginBottom:12 }}>Bu kategoride henüz ürün yok</div>
              <button className="btn btn-primary" onClick={() => setModal('yeni')}>
                <i className="ti ti-plus"/> İlk ürünü ekle
              </button>
            </div>
          ) : urunler.map(u => (
            <div key={u._id} className="card" style={{ display:'flex', alignItems:'flex-start', gap:14, padding:'14px 18px', opacity: u.aktif ? 1 : 0.5 }}>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                  <span style={{ fontWeight:700, fontSize:15 }}>{u.ad}</span>
                  {!u.aktif && <span className="badge badge-gray">Pasif</span>}
                  {u.fiyat > 0 && <span className="badge badge-green">{u.fiyat.toLocaleString('tr-TR')}₺</span>}
                </div>
                {u.aciklama && <div style={{ fontSize:13, color:'var(--text2)', marginBottom:8 }}>{u.aciklama}</div>}
                {u.ozellikler?.length > 0 && (
                  <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                    {u.ozellikler.map((oz, i) => (
                      <div key={i} style={{ fontSize:12 }}>
                        <span style={{ color:'var(--text3)', marginRight:4 }}>{oz.ad}:</span>
                        <span style={{ color:'var(--text2)' }}>{oz.degerler?.join(', ')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                <button className="btn-icon" onClick={() => setModal(u)} title={u.aktif ? 'Pasife al' : 'Aktive et'}>
                  <i className={`ti ${u.aktif ? 'ti-eye-off' : 'ti-eye'}`} style={{ fontSize:15 }}/>
                </button>
                <button className="btn-icon" onClick={() => setModal(u)} title="Düzenle">
                  <i className="ti ti-edit" style={{ fontSize:15 }}/>
                </button>
                <button className="btn-icon" onClick={() => handleSil(u._id)} title="Sil">
                  <i className="ti ti-trash" style={{ fontSize:15 }}/>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <UrunModal
          urun={modal === 'yeni' ? null : modal}
          kategoriKey={aktifKat}
          bedenSablonu={BEDEN_SABLONLARI[aktifKat]}
          onKapat={() => setModal(null)}
          onKaydet={() => { setModal(null); yukle(); }}
          toast={toast}
        />
      )}
    </div>
  );
}

function UrunModal({ urun, kategoriKey, bedenSablonu, onKapat, onKaydet, toast }) {
  const [ad,         setAd]         = useState(urun?.ad || '');
  const [aciklama,   setAciklama]   = useState(urun?.aciklama || '');
  const [fiyat,      setFiyat]      = useState(urun?.fiyat || '');
  const [ozellikler, setOzellikler] = useState(urun?.ozellikler?.length > 0 ? urun.ozellikler : []);
  const [yukleniyor, setYukleniyor] = useState(false);

  const ozEkle = () => setOzellikler(o => [...o, { ad:'', degerler:[] }]);
  const ozSil  = (i) => setOzellikler(o => o.filter((_,j) => j !== i));
  const ozAdDegis = (i, v) => setOzellikler(o => o.map((oz,j) => j===i ? {...oz, ad:v} : oz));
  const ozDegerDegis = (i, v) => {
    const degerler = v.split(',').map(d => d.trim()).filter(Boolean);
    setOzellikler(o => o.map((oz,j) => j===i ? {...oz, degerler} : oz));
  };

  const bedenEkle = () => {
    const mevcut = ozellikler.find(o => o.ad === 'Beden');
    if (mevcut) return;
    setOzellikler(o => [...o, { ad:'Beden', degerler: bedenSablonu || [] }]);
  };

  const renkEkle = () => {
    const mevcut = ozellikler.find(o => o.ad === 'Renk');
    if (mevcut) return;
    setOzellikler(o => [...o, { ad:'Renk', degerler:['Beyaz','Siyah','Lacivert','Gri'] }]);
  };

  const handleKaydet = async () => {
    if (!ad.trim()) { toast('Ürün adı zorunlu','error'); return; }
    setYukleniyor(true);
    try {
      const veri = { kategori_key: kategoriKey, ad: ad.trim(), aciklama, fiyat: parseFloat(fiyat)||0, ozellikler: ozellikler.filter(o => o.ad) };
      if (urun) await urunApi.update(urun._id, veri);
      else await urunApi.create(veri);
      toast(urun ? 'Güncellendi ✓' : 'Ürün eklendi ✓');
      onKaydet();
    } catch (err) { toast(err.response?.data?.hata || 'Hata','error'); }
    finally { setYukleniyor(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onKapat()}>
      <div className="modal" style={{ maxWidth:560 }}>
        <div className="modal-title">{urun ? 'Ürünü Düzenle' : 'Yeni Ürün Ekle'}</div>

        <div className="form-group">
          <label className="form-label">Ürün Adı *</label>
          <input className="form-input" value={ad} onChange={e => setAd(e.target.value)} placeholder="Örn: Polo Yaka Tişört"/>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Açıklama</label>
            <input className="form-input" value={aciklama} onChange={e => setAciklama(e.target.value)} placeholder="Ürün hakkında kısa bilgi"/>
          </div>
          <div className="form-group">
            <label className="form-label">Fiyat (₺)</label>
            <input className="form-input" type="number" min="0" step="0.01" value={fiyat} onChange={e => setFiyat(e.target.value)} placeholder="0"/>
          </div>
        </div>

        {/* Özellikler */}
        <div style={{ marginBottom:14 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <label className="form-label" style={{ margin:0 }}>Özellikler / Varyantlar</label>
            <div style={{ display:'flex', gap:6 }}>
              {bedenSablonu && !ozellikler.find(o=>o.ad==='Beden') && (
                <button type="button" className="btn btn-sm btn-secondary" onClick={bedenEkle}>
                  <i className="ti ti-ruler"/> Beden ekle
                </button>
              )}
              {!ozellikler.find(o=>o.ad==='Renk') && (
                <button type="button" className="btn btn-sm btn-secondary" onClick={renkEkle}>
                  <i className="ti ti-palette"/> Renk ekle
                </button>
              )}
              <button type="button" className="btn btn-sm btn-secondary" onClick={ozEkle}>
                <i className="ti ti-plus"/> Özellik ekle
              </button>
            </div>
          </div>

          {ozellikler.length === 0 ? (
            <div style={{ fontSize:13, color:'var(--text3)', padding:'10px 14px', background:'var(--bg3)', borderRadius:'var(--radius-sm)' }}>
              Henüz özellik eklenmedi. Beden, renk, kumaş vb. ekleyebilirsiniz.
            </div>
          ) : ozellikler.map((oz, i) => (
            <div key={i} style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'10px 12px', marginBottom:8 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                <input className="form-input" value={oz.ad} onChange={e => ozAdDegis(i, e.target.value)}
                  placeholder="Özellik adı (Beden, Renk, Kumaş...)"
                  style={{ flex:1, padding:'6px 10px', fontSize:13 }}/>
                <button type="button" className="btn-icon" onClick={() => ozSil(i)}>
                  <i className="ti ti-x" style={{ fontSize:14 }}/>
                </button>
              </div>
              <div>
                <div style={{ fontSize:11, color:'var(--text3)', marginBottom:4 }}>Değerler (virgülle ayır)</div>
                <input className="form-input" value={oz.degerler?.join(', ')}
                  onChange={e => ozDegerDegis(i, e.target.value)}
                  placeholder="Örn: S, M, L, XL  veya  Beyaz, Siyah, Lacivert"
                  style={{ padding:'6px 10px', fontSize:13 }}/>
                {oz.degerler?.length > 0 && (
                  <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginTop:7 }}>
                    {oz.degerler.map((d, j) => (
                      <span key={j} style={{ fontSize:12, background:'var(--bg2)', border:'1px solid var(--border)', padding:'2px 8px', borderRadius:20, color:'var(--text2)' }}>{d}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onKapat}>İptal</button>
          <button type="button" className="btn btn-primary" onClick={handleKaydet} disabled={yukleniyor}>
            <i className="ti ti-check"/> {yukleniyor ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  );
}
