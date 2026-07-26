import { useState, useCallback } from 'react';

export const ANA_KATEGORILER = [
  { key: 'dtf',          label: 'DTF Baskı',     icon: 'ti-layers-intersect', renk: '#4f7ef8', aciklama: 'Film baskı, metre usulü' },
  { key: 'baskili_urun', label: 'Baskılı Ürün',  icon: 'ti-shirt',            renk: '#2ecc8f', aciklama: 'Tekstil + baskı birlikte' },
  { key: 'baski_hizmet', label: 'Baskı Hizmeti', icon: 'ti-tool',             renk: '#f0a500', aciklama: 'Müşteri malına pressleme' },
];

export const ALT_KATEGORILER = {
  dtf: [
    { key: 'dtf_katalog',   label: 'Katalogdan seçim',    icon: 'ti-layout-grid'   },
    { key: 'dtf_hazirlama', label: 'Benim hazırlamamla',  icon: 'ti-pencil'        },
    { key: 'dtf_pdf',       label: 'Hazır PDF (metre)',   icon: 'ti-file-type-pdf' },
  ],
  baskili_urun: [
    { key: 'tisort_baskili',  label: 'Tişört (baskılı)',        icon: 'ti-shirt'     },
    { key: 'sweat_baskili',   label: 'Sweatshirt (baskılı)',    icon: 'ti-shirt'     },
    { key: 'is_montu',        label: 'İş Montu',                icon: 'ti-shirt'     },
    { key: 'sapka',           label: 'Şapka',                   icon: 'ti-hat'       },
    { key: 'buzgulu_kese',    label: 'Büzgülü Kese',            icon: 'ti-bag'       },
    { key: 'buzgulu_sirt',    label: 'Büzgülü Sırt Çantası',    icon: 'ti-backpack'  },
    { key: 'kol_cantasi',     label: 'Kol Çantası',             icon: 'ti-briefcase' },
    { key: 'tisort_baskisiz', label: 'Tişört (baskısız)',       icon: 'ti-shirt'     },
    { key: 'sweat_baskisiz',  label: 'Sweatshirt (baskısız)',   icon: 'ti-shirt'     },
  ],
  baski_hizmet: [
    { key: 'press_hizmet', label: 'Sadece Pressleme',       icon: 'ti-tool' },
    { key: 'baski_press',  label: 'Baskı + Pressleme',      icon: 'ti-tool' },
  ],
};

export const KAYNAKLAR = [
  { key: 'instagram', label: 'Instagram', icon: 'ti-brand-instagram' },
  { key: 'whatsapp',  label: 'WhatsApp',  icon: 'ti-brand-whatsapp'  },
  { key: 'telefon',   label: 'Telefon',   icon: 'ti-phone'           },
  { key: 'dukkan',    label: 'Dükkan',    icon: 'ti-store'           },
  { key: 'shopier',   label: 'Shopier',   icon: 'ti-shopping-cart'   },
  { key: 'diger',     label: 'Diğer',     icon: 'ti-dots'            },
];

export const ASAMALAR = {
  dtf_katalog:      ['baskı_hazırlama','paketleme','teslim'],
  dtf_hazirlama:    ['baskı_hazırlama','paketleme','teslim'],
  dtf_pdf:          ['paketleme','teslim'],
  tisort_baskili:   ['tedarik','baskı_hazırlama','pressing','paketleme','teslim'],
  tisort_baskisiz:  ['tedarik','paketleme','teslim'],
  sweat_baskili:    ['tedarik','baskı_hazırlama','pressing','paketleme','teslim'],
  sweat_baskisiz:   ['tedarik','paketleme','teslim'],
  is_montu:         ['tedarik','baskı_hazırlama','pressing','paketleme','teslim'],
  sapka:            ['tedarik','baskı_hazırlama','pressing','paketleme','teslim'],
  buzgulu_kese:     ['tedarik','baskı_hazırlama','pressing','paketleme','teslim'],
  buzgulu_sirt:     ['tedarik','baskı_hazırlama','pressing','paketleme','teslim'],
  kol_cantasi:      ['tedarik','baskı_hazırlama','pressing','paketleme','teslim'],
  press_hizmet:     ['pressing','teslim'],
  baski_press:      ['baskı_hazırlama','pressing','teslim'],
};

export const ASAMA_LABEL = {
  tedarik:           { label:'Tedarik',         icon:'ti-truck',   renk:'#9b59b6' },
  'baskı_hazırlama': { label:'Baskı Hazırlama', icon:'ti-pencil',  renk:'#4f7ef8' },
  pressing:          { label:'Pressing',         icon:'ti-tool',    renk:'#f0a500' },
  paketleme:         { label:'Paketleme',        icon:'ti-package', renk:'#2ecc8f' },
  teslim:            { label:'Teslim',           icon:'ti-check',   renk:'#2ecc8f' },
};

// ── Adım 1: 3 ana kutu ───────────────────────────────────────────────
function AdimAnaKategori({ secili, onSec }) {
  return (
    <div>
      <div className="modal-title">Yeni Sipariş</div>
      <div className="kategori-grid">
        {ANA_KATEGORILER.map(k => (
          <button key={k.key} type="button"
            onClick={() => onSec(k.key)}
            className={`kategori-kutu ${secili===k.key?'selected':''}`}
            style={{ '--k-renk': k.renk }}>
            <i className={`ti ${k.icon}`} style={{ color: k.renk }}/>
            <div className="kategori-kutu-label">{k.label}</div>
            <div className="kategori-kutu-alt">{k.aciklama}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Adım 2: Alt kategori ─────────────────────────────────────────────
function AdimAltKategori({ anaKategori, secili, onSec, onGeri }) {
  const ana = ANA_KATEGORILER.find(k => k.key === anaKategori);
  const altlar = ALT_KATEGORILER[anaKategori] || [];
  return (
    <div>
      <div className="modal-title" style={{ display:'flex', alignItems:'center', gap:10 }}>
        <i className={`ti ${ana?.icon}`} style={{ color: ana?.renk, fontSize:20 }}/>
        {ana?.label}
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {altlar.map(item => (
          <button key={item.key} type="button" onClick={() => onSec(item.key)}
            style={{
              background: secili===item.key ? `${ana?.renk}18` : 'var(--bg3)',
              border:`1.5px solid ${secili===item.key ? (ana?.renk||'var(--accent)') : 'var(--border)'}`,
              borderRadius:'var(--radius-sm)', padding:'11px 16px', color:'var(--text)',
              cursor:'pointer', display:'flex', alignItems:'center', gap:12, fontSize:14, textAlign:'left',
              transition:'all 0.15s',
            }}>
            <i className={`ti ${item.icon}`} style={{ fontSize:18, color: ana?.renk }}/>
            {item.label}
          </button>
        ))}
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-secondary" onClick={onGeri}>← Geri</button>
      </div>
    </div>
  );
}

// ── Adım 3: Kaynak ────────────────────────────────────────────────────
function AdimKaynak({ secili, onSec, onGeri }) {
  return (
    <div>
      <div className="modal-title">Sipariş nereden geldi?</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        {KAYNAKLAR.map(k => (
          <button key={k.key} type="button" onClick={() => onSec(k.key)} style={{
            background: secili===k.key ? 'rgba(79,126,248,0.15)' : 'var(--bg3)',
            border:`1.5px solid ${secili===k.key ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius:'var(--radius-sm)', padding:'12px 14px', color:'var(--text)',
            cursor:'pointer', display:'flex', alignItems:'center', gap:10, fontSize:14, fontWeight:500,
          }}>
            <i className={`ti ${k.icon}`} style={{ fontSize:20, color:'var(--accent)' }}/>{k.label}
          </button>
        ))}
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-secondary" onClick={onGeri}>← Geri</button>
      </div>
    </div>
  );
}

// ── Adım 4: Detay formu ───────────────────────────────────────────────
function AdimDetay({ anaKategori, altKategori, kaynak, onGeri, onKaydet }) {
  const bugun = new Date().toISOString().split('T')[0];
  const ana   = ANA_KATEGORILER.find(k => k.key === anaKategori);
  const alt   = (ALT_KATEGORILER[anaKategori]||[]).find(i => i.key === altKategori);
  const kaynakLabel = KAYNAKLAR.find(k => k.key === kaynak)?.label;
  const asamaListesi = ASAMALAR[altKategori] || [];

  const [musteriAdi,    setMusteriAdi]    = useState('');
  const [musteriSoyadi, setMusteriSoyadi] = useState('');
  const [telefon,       setTelefon]       = useState('');
  const [teslimTarihi,  setTeslimTarihi]  = useState('');
  const [urunDetay,     setUrunDetay]     = useState('');
  const [adet,          setAdet]          = useState('');
  const [notlar,        setNotlar]        = useState('');

  const handleGonder = useCallback(() => {
    if (!musteriAdi.trim()) { alert('Müşteri adı zorunlu'); return; }
    onKaydet({
      musteri_adi: musteriAdi.trim(), musteri_soyadi: musteriSoyadi.trim(),
      musteri_telefon: telefon.trim(), notlar: notlar.trim(),
      teslim_tarihi: teslimTarihi || undefined, kaynak, kategori: altKategori,
      asamalar: asamaListesi.map(a => ({ key:a, label:ASAMA_LABEL[a]?.label||a, tamamlandi:false })),
      urunler: urunDetay.trim() ? [{ ad:urunDetay.trim(), adet:parseInt(adet)||1 }] : [],
    });
  }, [musteriAdi,musteriSoyadi,telefon,notlar,teslimTarihi,urunDetay,adet,kaynak,altKategori,asamaListesi,onKaydet]);

  return (
    <div>
      <div className="modal-title">Sipariş Detayları</div>
      <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
        <span className="badge badge-blue"><i className={`ti ${ana?.icon}`}/> {ana?.label}</span>
        {alt && <span className="badge badge-gray">{alt.label}</span>}
        <span className="badge badge-gray">{kaynakLabel}</span>
      </div>
      {asamaListesi.length > 0 && (
        <div style={{ display:'flex', gap:6, marginBottom:18, flexWrap:'wrap', alignItems:'center', background:'var(--bg3)', padding:'10px 14px', borderRadius:'var(--radius-sm)' }}>
          {asamaListesi.map((a,i) => { const info=ASAMA_LABEL[a]; return (
            <span key={a} style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, color:'var(--text2)' }}>
              {i>0 && <i className="ti ti-chevron-right" style={{ fontSize:10, color:'var(--text3)' }}/>}
              <i className={`ti ${info?.icon}`} style={{ color:info?.renk }}/>{info?.label}
            </span>
          );})}
        </div>
      )}
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Ad *</label>
          <input className="form-input" value={musteriAdi} onChange={e=>setMusteriAdi(e.target.value)} placeholder="Ahmet"/>
        </div>
        <div className="form-group">
          <label className="form-label">Soyad</label>
          <input className="form-input" value={musteriSoyadi} onChange={e=>setMusteriSoyadi(e.target.value)} placeholder="Yılmaz"/>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Telefon</label>
          <input className="form-input" value={telefon} onChange={e=>setTelefon(e.target.value)} placeholder="05xx xxx xx xx"/>
        </div>
        <div className="form-group">
          <label className="form-label">Adet</label>
          <input className="form-input" type="number" min="1" value={adet} onChange={e=>setAdet(e.target.value)} placeholder="1"/>
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Son Teslim Tarihi <span style={{ color:'var(--text3)', fontWeight:'normal' }}>(boş = 3 gün)</span></label>
        <input className="form-input" type="date" min={bugun} value={teslimTarihi} onChange={e=>setTeslimTarihi(e.target.value)}/>
      </div>
      <div className="form-group">
        <label className="form-label">Ürün / Sipariş Detayı</label>
        <textarea className="form-input" rows={3} value={urunDetay} onChange={e=>setUrunDetay(e.target.value)} placeholder="Ölçü, renk, özel istek vb."/>
      </div>
      <div className="form-group">
        <label className="form-label">Not</label>
        <textarea className="form-input" rows={2} value={notlar} onChange={e=>setNotlar(e.target.value)} placeholder="Ekstra not..."/>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-secondary" onClick={onGeri}>← Geri</button>
        <button type="button" className="btn btn-primary" onClick={handleGonder}><i className="ti ti-check"/> Siparişi Oluştur</button>
      </div>
    </div>
  );
}

// ── Ana modal bileşeni ────────────────────────────────────────────────
export default function YeniSiparisModal({ onKapat, onKaydet }) {
  const [adim,        setAdim]        = useState(1);
  const [anaKategori, setAnaKategori] = useState('');
  const [altKategori, setAltKategori] = useState('');
  const [kaynak,      setKaynak]      = useState('');

  const ADIM_SAYISI = 4;
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget && onKapat()}>
      <div className="modal" style={{ maxWidth:560 }}>
        {/* Adım göstergesi */}
        <div style={{ display:'flex', gap:5, marginBottom:24 }}>
          {Array.from({length:ADIM_SAYISI},(_,i)=>(
            <div key={i} style={{ flex:1, height:3, borderRadius:2, background:adim>i?'var(--accent)':'var(--border)', transition:'background 0.2s' }}/>
          ))}
        </div>

        {adim===1 && (
          <>
            <AdimAnaKategori secili={anaKategori} onSec={k=>{ setAnaKategori(k); setAdim(2); }}/>
            <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={onKapat}>İptal</button></div>
          </>
        )}
        {adim===2 && <AdimAltKategori anaKategori={anaKategori} secili={altKategori} onSec={k=>{ setAltKategori(k); setAdim(3); }} onGeri={()=>setAdim(1)}/>}
        {adim===3 && <AdimKaynak secili={kaynak} onSec={k=>{ setKaynak(k); setAdim(4); }} onGeri={()=>setAdim(2)}/>}
        {adim===4 && <AdimDetay anaKategori={anaKategori} altKategori={altKategori} kaynak={kaynak} onGeri={()=>setAdim(3)} onKaydet={onKaydet}/>}
      </div>
    </div>
  );
}
