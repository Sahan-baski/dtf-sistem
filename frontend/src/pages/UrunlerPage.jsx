import { useState, useEffect, useCallback } from 'react';
import { urunApi, kategoriApi } from '../api';
import { useToast } from '../context/ToastContext';

const RENK_SECENEKLER = ['#6366f1','#3b82f6','#10b981','#f59e0b','#ef4444','#a855f7','#ec4899','#06b6d4','#8b5cf6','#2ecc8f'];

export default function UrunlerPage() {
  const toast = useToast();
  const [kategoriler, setKategoriler] = useState([]);
  const [urunler, setUrunler] = useState([]);
  const [aktifKat, setAktifKat] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [urunModal, setUrunModal] = useState(null);
  const [katModal, setKatModal] = useState(null); // null | 'yeni' | {kategori objesi}

  const yukleKategoriler = useCallback(async () => {
    try { const r=await kategoriApi.getAll(); setKategoriler(r.data); if (!aktifKat && r.data.length>0) setAktifKat(r.data[0]); }
    catch { toast('Kategoriler yüklenemedi','error'); }
  }, [aktifKat]);

  const yukleUrunler = useCallback(async () => {
    if (!aktifKat) return;
    setYukleniyor(true);
    try { const r=await urunApi.getAll(aktifKat.key); setUrunler(r.data); }
    catch { toast('Ürünler yüklenemedi','error'); }
    finally { setYukleniyor(false); }
  }, [aktifKat]);

  useEffect(() => { yukleKategoriler(); }, []);
  useEffect(() => { yukleUrunler(); }, [yukleUrunler]);

  const handleUrunSil = async id => {
    if (!confirm('Bu ürünü silmek istediğinize emin misiniz?')) return;
    try { await urunApi.delete(id); toast('Silindi'); yukleUrunler(); }
    catch { toast('Silinemedi','error'); }
  };
  const handleUrunToggle = async id => {
    try { await urunApi.toggle(id); yukleUrunler(); }
    catch { toast('Hata','error'); }
  };
  const handleKatSil = async kat => {
    if (kat.sistem) { toast('Sistem kategorisi silinemez','error'); return; }
    if (!confirm(`"${kat.label}" kategorisi silinsin mi?`)) return;
    try { await kategoriApi.delete(kat._id); toast('Kategori silindi'); yukleKategoriler(); if (aktifKat?._id===kat._id) setAktifKat(null); }
    catch(e) { toast(e.response?.data?.hata||'Silinemedi','error'); }
  };

  const gruplar = [...new Set(kategoriler.map(k=>k.grup))];

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">🛍️ Ürün Kataloğu</div><div className="page-sub">Kategori bazlı ürün ve varyant yönetimi</div></div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-secondary" onClick={()=>setKatModal('yeni')}>
            <i className="ti ti-folder-plus"/> Kategori Ekle
          </button>
          <button className="btn btn-primary" onClick={()=>setUrunModal('yeni')}>
            <i className="ti ti-plus"/> Ürün Ekle
          </button>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'220px 1fr', gap:20 }}>
        {/* Sol: Kategoriler */}
        <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--r-sm)', padding:12, height:'fit-content' }}>
          {gruplar.map(grup => (
            <div key={grup} style={{ marginBottom:16 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.08em', padding:'4px 8px', marginBottom:4 }}>{grup}</div>
              {kategoriler.filter(k=>k.grup===grup).map(k => (
                <div key={k.key} style={{ display:'flex', alignItems:'center', gap:0, borderRadius:'var(--r-xs)', marginBottom:2, background:aktifKat?.key===k.key?`${k.renk}18`:'none' }}>
                  <button onClick={()=>setAktifKat(k)}
                    style={{ flex:1, textAlign:'left', padding:'7px 10px', border:'none', background:'none', color:aktifKat?.key===k.key?k.renk:'var(--text2)', fontSize:13, fontWeight:aktifKat?.key===k.key?600:400, cursor:'pointer' }}>
                    {k.label}
                  </button>
                  <button onClick={()=>setKatModal(k)} style={{ width:24, height:24, border:'none', background:'none', color:'var(--text3)', cursor:'pointer', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, borderRadius:4 }} title="Düzenle">
                    <i className="ti ti-edit" style={{ fontSize:12 }}/>
                  </button>
                  {!k.sistem && (
                    <button onClick={()=>handleKatSil(k)} style={{ width:24, height:24, border:'none', background:'none', color:'var(--text3)', cursor:'pointer', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, borderRadius:4 }} title="Sil">
                      <i className="ti ti-trash" style={{ fontSize:12, color:'var(--red)' }}/>
                    </button>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Sağ: Ürünler */}
        <div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
            <div>
              <span style={{ fontSize:16, fontWeight:700, color:aktifKat?.renk||'var(--text)' }}>{aktifKat?.label}</span>
              <span style={{ fontSize:13, color:'var(--text3)', marginLeft:8 }}>{urunler.length} ürün</span>
            </div>
          </div>

          {yukleniyor ? (
            <div style={{ textAlign:'center', color:'var(--text2)', padding:40 }}>Yükleniyor...</div>
          ) : urunler.length===0 ? (
            <div style={{ textAlign:'center', padding:40, color:'var(--text3)', background:'var(--bg2)', border:'2px dashed var(--border)', borderRadius:'var(--r-sm)' }}>
              <i className="ti ti-package-off" style={{ fontSize:36, display:'block', marginBottom:10 }}/>
              <div style={{ fontSize:14, marginBottom:12 }}>Bu kategoride henüz ürün yok</div>
              <button className="btn btn-primary" onClick={()=>setUrunModal('yeni')}><i className="ti ti-plus"/>İlk ürünü ekle</button>
            </div>
          ) : urunler.map(u => (
            <div key={u._id} className="card" style={{ display:'flex', alignItems:'flex-start', gap:14, padding:'14px 18px', opacity:u.aktif?1:0.5 }}>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4, flexWrap:'wrap' }}>
                  <span style={{ fontWeight:700, fontSize:15 }}>{u.ad}</span>
                  {!u.aktif && <span className="badge badge-gray">Pasif</span>}
                  {u.fiyat>0 && <span className="badge badge-green">{u.fiyat.toLocaleString('tr-TR')}₺</span>}
                  {/* Stok badge */}
                  {u.stok_takip && (
                    <span className={`badge ${u.stok_miktari>0?'badge-blue':'badge-red'}`}>
                      Stok: {u.stok_miktari}
                    </span>
                  )}
                  {!u.stok_takip && <span className="badge badge-indigo" style={{ fontSize:10 }}>Sınırsız</span>}
                </div>
                {u.aciklama && <div style={{ fontSize:13, color:'var(--text2)', marginBottom:6 }}>{u.aciklama}</div>}
                {u.ozellikler?.length>0 && (
                  <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                    {u.ozellikler.map((oz,i)=>(
                      <div key={i} style={{ fontSize:12 }}>
                        <span style={{ color:'var(--text3)', marginRight:4 }}>{oz.ad}:</span>
                        <span style={{ color:'var(--text2)' }}>{oz.degerler?.join(', ')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                <button className="btn-icon" onClick={()=>handleUrunToggle(u._id)} title={u.aktif?'Pasife al':'Aktive et'}>
                  <i className={`ti ${u.aktif?'ti-eye-off':'ti-eye'}`} style={{ fontSize:15 }}/>
                </button>
                <button className="btn-icon" onClick={()=>setUrunModal(u)} title="Düzenle">
                  <i className="ti ti-edit" style={{ fontSize:15 }}/>
                </button>
                <button className="btn-icon" onClick={()=>handleUrunSil(u._id)} title="Sil">
                  <i className="ti ti-trash" style={{ fontSize:15 }}/>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Ürün Modal */}
      {urunModal && (
        <UrunModal
          urun={urunModal==='yeni'?null:urunModal}
          kategoriKey={aktifKat?.key}
          onKapat={()=>setUrunModal(null)}
          onKaydet={()=>{ setUrunModal(null); yukleUrunler(); }}
          toast={toast}/>
      )}

      {/* Kategori Modal */}
      {katModal && (
        <KategoriModal
          kategori={katModal==='yeni'?null:katModal}
          onKapat={()=>setKatModal(null)}
          onKaydet={()=>{ setKatModal(null); yukleKategoriler(); }}
          toast={toast}/>
      )}
    </div>
  );
}

function KategoriModal({ kategori, onKapat, onKaydet, toast }) {
  const [label, setLabel] = useState(kategori?.label||'');
  const [grup, setGrup]   = useState(kategori?.grup||'Baskılı Ürün');
  const [renk, setRenk]   = useState(kategori?.renk||'#6366f1');
  const [kaydediliyor, setKaydediliyor] = useState(false);

  const handleKaydet = async () => {
    if (!label.trim()) { toast('Kategori adı zorunlu','error'); return; }
    setKaydediliyor(true);
    try {
      if (kategori?._id) await kategoriApi.update(kategori._id, { label:label.trim(), grup, renk });
      else await kategoriApi.create({ label:label.trim(), grup, renk });
      toast(kategori?'Kategori güncellendi ✓':'Kategori eklendi ✓');
      onKaydet();
    } catch(e) { toast(e.response?.data?.hata||'Hata','error'); }
    finally { setKaydediliyor(false); }
  };

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onKapat()}>
      <div className="modal" style={{ maxWidth:420 }}>
        <div className="modal-title">{kategori?'Kategori Düzenle':'Yeni Kategori'}</div>
        <div className="form-group">
          <label className="form-label">Kategori Adı *</label>
          <input className="form-input" value={label} onChange={e=>setLabel(e.target.value)} placeholder="Örn: Kapüşonlu Sweat"/>
        </div>
        <div className="form-group">
          <label className="form-label">Grup</label>
          <select className="form-input" value={grup} onChange={e=>setGrup(e.target.value)}>
            {['Baskılı Ürün','DTF Baskı','Hizmet','Özel'].map(g=><option key={g}>{g}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Renk</label>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {RENK_SECENEKLER.map(r=>(
              <button key={r} type="button" onClick={()=>setRenk(r)}
                style={{ width:28, height:28, borderRadius:8, background:r, border:`3px solid ${renk===r?'white':'transparent'}`, cursor:'pointer', boxShadow:renk===r?`0 0 0 2px ${r}`:'none' }}/>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onKapat}>İptal</button>
          <button type="button" className="btn btn-primary" onClick={handleKaydet} disabled={kaydediliyor}>
            <i className="ti ti-check"/>{kaydediliyor?'Kaydediliyor...':'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  );
}

function UrunModal({ urun, kategoriKey, onKapat, onKaydet, toast }) {
  const [ad,           setAd]           = useState(urun?.ad||'');
  const [aciklama,     setAciklama]     = useState(urun?.aciklama||'');
  const [fiyat,        setFiyat]        = useState(urun?.fiyat||'');
  const [ozellikler,   setOzellikler]   = useState(urun?.ozellikler?.length>0?urun.ozellikler:[]);
  const [stokTakip,    setStokTakip]    = useState(urun?.stok_takip||false);
  const [stokMiktari,  setStokMiktari]  = useState(urun?.stok_miktari||0);
  const [yukleniyor,   setYukleniyor]   = useState(false);

  const ozEkle    = () => setOzellikler(o=>[...o,{ad:'',degerler:[]}]);
  const ozSil     = i  => setOzellikler(o=>o.filter((_,j)=>j!==i));
  const ozAdDegis = (i,v)  => setOzellikler(o=>o.map((oz,j)=>j===i?{...oz,ad:v}:oz));
  const ozValDegis= (i,v)  => setOzellikler(o=>o.map((oz,j)=>j===i?{...oz,degerler:v.split(',').map(d=>d.trim()).filter(Boolean)}:oz));

  const handleKaydet = async () => {
    if (!ad.trim()) { toast('Ürün adı zorunlu','error'); return; }
    setYukleniyor(true);
    try {
      const veri = { kategori_key:kategoriKey, ad:ad.trim(), aciklama, fiyat:parseFloat(fiyat)||0, ozellikler:ozellikler.filter(o=>o.ad), stok_takip:stokTakip, stok_miktari:Math.max(0,parseInt(stokMiktari)||0) };
      if (urun) await urunApi.update(urun._id,veri);
      else await urunApi.create(veri);
      toast(urun?'Güncellendi ✓':'Ürün eklendi ✓');
      onKaydet();
    } catch(e) { toast(e.response?.data?.hata||'Hata','error'); }
    finally { setYukleniyor(false); }
  };

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onKapat()}>
      <div className="modal" style={{ maxWidth:560 }}>
        <div className="modal-title">{urun?'Ürünü Düzenle':'Yeni Ürün Ekle'}</div>

        <div className="form-group">
          <label className="form-label">Ürün Adı *</label>
          <input className="form-input" value={ad} onChange={e=>setAd(e.target.value)} placeholder="Örn: Polo Yaka Tişört"/>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Açıklama</label>
            <input className="form-input" value={aciklama} onChange={e=>setAciklama(e.target.value)} placeholder="Kısa bilgi..."/>
          </div>
          <div className="form-group">
            <label className="form-label">Fiyat (₺)</label>
            <input className="form-input" type="number" min="0" step="0.01" value={fiyat} onChange={e=>setFiyat(e.target.value)} placeholder="0"/>
          </div>
        </div>

        {/* Stok yönetimi */}
        <div style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:'var(--r-xs)', padding:'14px', marginBottom:14 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: stokTakip?12:0 }}>
            <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', fontSize:14 }}>
              <input type="checkbox" checked={stokTakip} onChange={e=>setStokTakip(e.target.checked)} style={{ width:16, height:16 }}/>
              <span style={{ fontWeight:600 }}>Stok Takibi</span>
              <span style={{ fontSize:12, color:'var(--text3)' }}>{stokTakip?'açık — stok sayısı izleniyor':'kapalı — sınırsız stok (toptancıdan devamlı)'}</span>
            </label>
          </div>
          {stokTakip && (
            <div>
              <label className="form-label">Mevcut Stok Miktarı (adet)</label>
              <input className="form-input" type="number" min="0" value={stokMiktari} onChange={e=>setStokMiktari(Math.max(0,parseInt(e.target.value)||0))} placeholder="0"/>
            </div>
          )}
        </div>

        {/* Özellikler */}
        <div style={{ marginBottom:14 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <label className="form-label" style={{ margin:0 }}>Özellikler / Varyantlar</label>
            <button type="button" className="btn btn-sm btn-secondary" onClick={ozEkle}><i className="ti ti-plus"/>Ekle</button>
          </div>
          {ozellikler.length===0 ? (
            <div style={{ fontSize:13, color:'var(--text3)', padding:'10px 14px', background:'var(--bg3)', borderRadius:'var(--r-xs)' }}>Beden, renk, kumaş vb. özellik ekleyebilirsiniz.</div>
          ) : ozellikler.map((oz,i)=>(
            <div key={i} style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:'var(--r-xs)', padding:'10px 12px', marginBottom:8 }}>
              <div style={{ display:'flex', gap:8, marginBottom:8 }}>
                <input className="form-input" value={oz.ad} onChange={e=>ozAdDegis(i,e.target.value)} placeholder="Özellik adı (Beden, Renk...)" style={{ flex:1, padding:'6px 10px', fontSize:13 }}/>
                <button type="button" className="btn-icon" onClick={()=>ozSil(i)}><i className="ti ti-x" style={{ fontSize:14 }}/></button>
              </div>
              <input className="form-input" value={oz.degerler?.join(', ')} onChange={e=>ozValDegis(i,e.target.value)} placeholder="S, M, L, XL  veya  Beyaz, Siyah" style={{ padding:'6px 10px', fontSize:13 }}/>
              {oz.degerler?.length>0 && (
                <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginTop:7 }}>
                  {oz.degerler.map((d,j)=><span key={j} style={{ fontSize:12, background:'var(--bg2)', border:'1px solid var(--border)', padding:'2px 8px', borderRadius:20, color:'var(--text2)' }}>{d}</span>)}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onKapat}>İptal</button>
          <button type="button" className="btn btn-primary" onClick={handleKaydet} disabled={yukleniyor}>
            <i className="ti ti-check"/>{yukleniyor?'Kaydediliyor...':'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  );
}
