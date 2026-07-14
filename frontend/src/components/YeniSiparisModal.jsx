import { useState, useCallback } from 'react';

export const KAYNAKLAR = [
  { key: 'instagram', label: 'Instagram',        icon: 'ti-brand-instagram' },
  { key: 'whatsapp',  label: 'WhatsApp',          icon: 'ti-brand-whatsapp'  },
  { key: 'telefon',   label: 'Telefon',           icon: 'ti-phone'           },
  { key: 'dukkan',    label: 'Dükkandan / Yüz yüze', icon: 'ti-store'        },
  { key: 'shopier',   label: 'Shopier',           icon: 'ti-shopping-cart'   },
  { key: 'diger',     label: 'Diğer',             icon: 'ti-dots'            },
];

export const KATEGORILER = [
  { grup: 'DTF Baskı', renk: '#4f7ef8', items: [
    { key: 'dtf_katalog',   label: 'DTF – Katalogdan seçim',     icon: 'ti-layout-grid'    },
    { key: 'dtf_hazirlama', label: 'DTF – Benim hazırlamamla',   icon: 'ti-pencil'         },
    { key: 'dtf_pdf',       label: 'DTF – Hazır PDF (metre)',    icon: 'ti-file-type-pdf'  },
  ]},
  { grup: 'Tekstil Ürünü', renk: '#2ecc8f', items: [
    { key: 'tisort_baskili',  label: 'Tişört (baskılı)',           icon: 'ti-shirt' },
    { key: 'tisort_baskisiz', label: 'Tişört (baskısız)',          icon: 'ti-shirt' },
    { key: 'sweat_baskili',   label: 'Sweatshirt (baskılı)',       icon: 'ti-shirt' },
    { key: 'sweat_baskisiz',  label: 'Sweatshirt (baskısız)',      icon: 'ti-shirt' },
    { key: 'is_montu',        label: 'İş Montu',                   icon: 'ti-shirt' },
    { key: 'sapka',           label: 'Şapka',                      icon: 'ti-hat'   },
    { key: 'buzgulu_kese',    label: 'Büzgülü Kese',               icon: 'ti-bag'   },
    { key: 'buzgulu_sirt',    label: 'Büzgülü Sırt Çantası',       icon: 'ti-backpack' },
    { key: 'kol_cantasi',     label: 'Kol Çantası',                icon: 'ti-briefcase' },
  ]},
  { grup: 'Sadece Hizmet', renk: '#f0a500', items: [
    { key: 'press_hizmet', label: 'Pressleme Hizmeti (müşteri malı)', icon: 'ti-tool' },
    { key: 'baski_press',  label: 'Baskı + Pressleme (müşteri malı)', icon: 'ti-tool' },
  ]},
];

export const ASAMALAR = {
  dtf_katalog:      ['baskı_hazırlama', 'paketleme', 'teslim'],
  dtf_hazirlama:    ['baskı_hazırlama', 'paketleme', 'teslim'],
  dtf_pdf:          ['paketleme', 'teslim'],
  tisort_baskili:   ['tedarik', 'baskı_hazırlama', 'pressing', 'paketleme', 'teslim'],
  tisort_baskisiz:  ['tedarik', 'paketleme', 'teslim'],
  sweat_baskili:    ['tedarik', 'baskı_hazırlama', 'pressing', 'paketleme', 'teslim'],
  sweat_baskisiz:   ['tedarik', 'paketleme', 'teslim'],
  is_montu:         ['tedarik', 'baskı_hazırlama', 'pressing', 'paketleme', 'teslim'],
  sapka:            ['tedarik', 'baskı_hazırlama', 'pressing', 'paketleme', 'teslim'],
  buzgulu_kese:     ['tedarik', 'baskı_hazırlama', 'pressing', 'paketleme', 'teslim'],
  buzgulu_sirt:     ['tedarik', 'baskı_hazırlama', 'pressing', 'paketleme', 'teslim'],
  kol_cantasi:      ['tedarik', 'baskı_hazırlama', 'pressing', 'paketleme', 'teslim'],
  press_hizmet:     ['pressing', 'teslim'],
  baski_press:      ['baskı_hazırlama', 'pressing', 'teslim'],
};

export const ASAMA_LABEL = {
  tedarik:          { label: 'Tedarik',          icon: 'ti-truck',   renk: '#9b59b6' },
  'baskı_hazırlama':{ label: 'Baskı Hazırlama',  icon: 'ti-pencil',  renk: '#4f7ef8' },
  pressing:         { label: 'Pressing',          icon: 'ti-tool',    renk: '#f0a500' },
  paketleme:        { label: 'Paketleme',         icon: 'ti-package', renk: '#2ecc8f' },
  teslim:           { label: 'Teslim',            icon: 'ti-check',   renk: '#2ecc8f' },
};

// Adım 1 — kaynak seçimi (saf, state yok)
function AdimKaynak({ secili, onSec }) {
  return (
    <div>
      <div className="modal-title">📨 Sipariş nereden geldi?</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        {KAYNAKLAR.map(k => (
          <button key={k.key} type="button"
            onClick={() => onSec(k.key)}
            style={{
              background: secili===k.key ? 'rgba(79,126,248,0.2)' : 'var(--bg3)',
              border:`1px solid ${secili===k.key ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius:'var(--radius)', padding:'14px 12px',
              color:'var(--text)', cursor:'pointer',
              display:'flex', alignItems:'center', gap:10,
              fontSize:14, fontWeight:500,
            }}>
            <i className={`ti ${k.icon}`} style={{fontSize:22,color:'var(--accent)'}}/>
            {k.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// Adım 2 — kategori seçimi
function AdimKategori({ secili, onSec, onGeri }) {
  return (
    <div>
      <div className="modal-title">🏷️ Sipariş kategorisi?</div>
      {KATEGORILER.map(grup => (
        <div key={grup.grup} style={{marginBottom:16}}>
          <div style={{fontSize:11,fontWeight:700,color:grup.renk,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>
            {grup.grup}
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {grup.items.map(item => (
              <button key={item.key} type="button"
                onClick={() => onSec(item.key)}
                style={{
                  background: secili===item.key ? `${grup.renk}22` : 'var(--bg3)',
                  border:`1px solid ${secili===item.key ? grup.renk : 'var(--border)'}`,
                  borderRadius:'var(--radius-sm)', padding:'10px 14px',
                  color:'var(--text)', cursor:'pointer',
                  display:'flex', alignItems:'center', gap:10,
                  fontSize:14, textAlign:'left',
                }}>
                <i className={`ti ${item.icon}`} style={{fontSize:18,color:grup.renk}}/>
                {item.label}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="modal-footer">
        <button type="button" className="btn btn-secondary" onClick={onGeri}>← Geri</button>
      </div>
    </div>
  );
}

// Adım 3 — detay formu (kendi state'i var, re-render izole)
function AdimDetay({ kaynak, kategori, onGeri, onKaydet }) {
  const bugun = new Date().toISOString().split('T')[0];
  const kaynakLabel = KAYNAKLAR.find(k => k.key === kaynak)?.label;
  const kategoriLabel = KATEGORILER.flatMap(g => g.items).find(i => i.key === kategori)?.label;
  const asamalar = ASAMALAR[kategori] || [];

  const [musteriAdi,    setMusteriAdi]    = useState('');
  const [musteriSoyadi, setMusteriSoyadi] = useState('');
  const [telefon,       setTelefon]       = useState('');
  const [teslimTarihi,  setTeslimTarihi]  = useState('');
  const [urunDetay,     setUrunDetay]     = useState('');
  const [adet,          setAdet]          = useState('');
  const [notlar,        setNotlar]        = useState('');

  const handleGonder = useCallback(() => {
    if (!musteriAdi.trim()) { alert('Müşteri adı zorunlu'); return; }
    const asamaListesi = asamalar.map(a => ({
      key: a, label: ASAMA_LABEL[a]?.label || a, tamamlandi: false,
    }));
    onKaydet({
      musteri_adi:     musteriAdi.trim(),
      musteri_soyadi:  musteriSoyadi.trim(),
      musteri_telefon: telefon.trim(),
      notlar:          notlar.trim(),
      teslim_tarihi:   teslimTarihi || undefined,
      kaynak,
      kategori,
      asamalar:        asamaListesi,
      urunler: urunDetay.trim()
        ? [{ ad: urunDetay.trim(), adet: parseInt(adet) || 1 }]
        : [],
    });
  }, [musteriAdi, musteriSoyadi, telefon, notlar, teslimTarihi, urunDetay, adet, kaynak, kategori, asamalar, onKaydet]);

  return (
    <div>
      <div className="modal-title">📦 Sipariş Detayları</div>

      <div style={{display:'flex',gap:8,marginBottom:18,flexWrap:'wrap'}}>
        <span className="badge badge-blue">{kaynakLabel}</span>
        <span className="badge badge-gray">{kategoriLabel}</span>
      </div>

      {asamalar.length > 0 && (
        <div style={{display:'flex',gap:6,marginBottom:18,flexWrap:'wrap',alignItems:'center'}}>
          {asamalar.map((a,i) => {
            const info = ASAMA_LABEL[a];
            return (
              <span key={a} style={{display:'flex',alignItems:'center',gap:4,fontSize:12,color:'var(--text2)'}}>
                {i > 0 && <i className="ti ti-chevron-right" style={{fontSize:11,color:'var(--text3)'}}/>}
                <i className={`ti ${info?.icon}`} style={{color:info?.renk}}/>
                {info?.label}
              </span>
            );
          })}
        </div>
      )}

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Ad *</label>
          <input className="form-input" value={musteriAdi}
            onChange={e => setMusteriAdi(e.target.value)}
            placeholder="Ahmet"/>
        </div>
        <div className="form-group">
          <label className="form-label">Soyad</label>
          <input className="form-input" value={musteriSoyadi}
            onChange={e => setMusteriSoyadi(e.target.value)}
            placeholder="Yılmaz"/>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Telefon</label>
          <input className="form-input" value={telefon}
            onChange={e => setTelefon(e.target.value)}
            placeholder="05xx xxx xx xx"/>
        </div>
        <div className="form-group">
          <label className="form-label">Adet</label>
          <input className="form-input" type="number" min="1" value={adet}
            onChange={e => setAdet(e.target.value)}
            placeholder="1"/>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">
          Son Teslim Tarihi
          <span style={{color:'var(--text3)',fontWeight:'normal'}}> (boş = otomatik 3 gün)</span>
        </label>
        <input className="form-input" type="date" min={bugun}
          value={teslimTarihi}
          onChange={e => setTeslimTarihi(e.target.value)}/>
      </div>

      <div className="form-group">
        <label className="form-label">Sipariş / Ürün Detayı</label>
        <textarea className="form-input" rows={3} value={urunDetay}
          onChange={e => setUrunDetay(e.target.value)}
          placeholder="Ölçü, renk, özel istek vb."/>
      </div>

      <div className="form-group">
        <label className="form-label">Not</label>
        <textarea className="form-input" rows={2} value={notlar}
          onChange={e => setNotlar(e.target.value)}
          placeholder="Ekstra not..."/>
      </div>

      <div className="modal-footer">
        <button type="button" className="btn btn-secondary" onClick={onGeri}>← Geri</button>
        <button type="button" className="btn btn-primary" onClick={handleGonder}>
          <i className="ti ti-check"/> Siparişi Oluştur
        </button>
      </div>
    </div>
  );
}

// Ana modal — sadece adım yönetimi, input state'i yok
export default function YeniSiparisModal({ onKapat, onKaydet }) {
  const [adim,     setAdim]     = useState(1);
  const [kaynak,   setKaynak]   = useState('');
  const [kategori, setKategori] = useState('');

  const handleKaynakSec = (k)   => { setKaynak(k);   setAdim(2); };
  const handleKategoriSec = (k) => { setKategori(k); setAdim(3); };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onKapat()}>
      <div className="modal" style={{maxWidth:560}}>
        {/* Adım çubuğu */}
        <div style={{display:'flex',gap:6,marginBottom:20}}>
          {['Kaynak','Kategori','Detay'].map((s,i) => (
            <div key={s} style={{
              flex:1, height:4, borderRadius:2,
              background: adim > i ? 'var(--accent)' : 'var(--border)',
              transition:'background 0.2s',
            }}/>
          ))}
        </div>

        {adim === 1 && (
          <>
            <AdimKaynak secili={kaynak} onSec={handleKaynakSec}/>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onKapat}>İptal</button>
            </div>
          </>
        )}

        {adim === 2 && (
          <AdimKategori secili={kategori} onSec={handleKategoriSec} onGeri={() => setAdim(1)}/>
        )}

        {adim === 3 && (
          <AdimDetay
            kaynak={kaynak}
            kategori={kategori}
            onGeri={() => setAdim(2)}
            onKaydet={onKaydet}
          />
        )}
      </div>
    </div>
  );
}
