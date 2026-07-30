import { useState, useCallback, useEffect } from 'react';
import { musteriApi } from '../api';

export const KAYNAKLAR = [
  { key:'instagram', label:'Instagram', icon:'ti-brand-instagram' },
  { key:'whatsapp',  label:'WhatsApp',  icon:'ti-brand-whatsapp'  },
  { key:'telefon',   label:'Telefon',   icon:'ti-phone'           },
  { key:'dukkan',    label:'Dükkan',    icon:'ti-store'           },
  { key:'shopier',   label:'Shopier',   icon:'ti-shopping-cart'   },
  { key:'diger',     label:'Diğer',     icon:'ti-dots'            },
];

export const ASAMALAR = {
  tisort_baskili: ['tedarik','baskı_hazırlama','pressing','paketleme','teslim'],
  tisort_baskisiz:['tedarik','paketleme','teslim'],
  sweat_baskili:  ['tedarik','baskı_hazırlama','pressing','paketleme','teslim'],
  sweat_baskisiz: ['tedarik','paketleme','teslim'],
  is_montu:       ['tedarik','baskı_hazırlama','pressing','paketleme','teslim'],
  sapka:          ['tedarik','baskı_hazırlama','pressing','paketleme','teslim'],
  buzgulu_kese:   ['tedarik','baskı_hazırlama','pressing','paketleme','teslim'],
  buzgulu_sirt:   ['tedarik','baskı_hazırlama','pressing','paketleme','teslim'],
  kol_cantasi:    ['tedarik','baskı_hazırlama','pressing','paketleme','teslim'],
  dtf_katalog:    ['baskı_hazırlama','paketleme','teslim'],
  dtf_hazirlama:  ['baskı_hazırlama','paketleme','teslim'],
  dtf_pdf:        ['paketleme','teslim'],
  press_hizmet:   ['pressing','teslim'],
  baski_press:    ['baskı_hazırlama','pressing','teslim'],
};

export const ASAMA_LABEL = {
  tedarik:           { label:'Tedarik',         icon:'ti-truck',   renk:'#9b59b6' },
  'baskı_hazırlama': { label:'Baskı Hazırlama', icon:'ti-pencil',  renk:'#4f7ef8' },
  pressing:          { label:'Pressing',         icon:'ti-tool',    renk:'#f0a500' },
  paketleme:         { label:'Paketleme',        icon:'ti-package', renk:'#2ecc8f' },
  teslim:            { label:'Teslim',           icon:'ti-check',   renk:'#2ecc8f' },
};

function AdimGrup({ kategoriler, onSec, onKapat }) {
  const gruplar = [...new Set(kategoriler.map(k=>k.grup))];
  const RENK_MAP = { 'DTF Baskı':'#4f7ef8', 'Baskılı Ürün':'#2ecc8f', 'Hizmet':'#f0a500' };
  return (
    <div>
      <div className="modal-title">Sipariş Türü</div>
      <div style={{ display:'grid', gridTemplateColumns:`repeat(${Math.min(gruplar.length,3)},1fr)`, gap:12 }}>
        {gruplar.map(g => {
          const renk = RENK_MAP[g]||'#7f8c8d';
          return (
            <button key={g} type="button" onClick={()=>onSec(g)}
              style={{ background:'var(--bg3)', border:`2px solid var(--border)`, borderRadius:'var(--r)', padding:'20px 14px', cursor:'pointer', textAlign:'center', transition:'all 0.2s' }}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=renk;e.currentTarget.style.transform='translateY(-3px)';}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.transform='none';}}>
              <div style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>{g}</div>
              <div style={{ fontSize:11, color:'var(--text3)', marginTop:4 }}>{kategoriler.filter(k=>k.grup===g).length} kategori</div>
            </button>
          );
        })}
      </div>
      <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={onKapat}>İptal</button></div>
    </div>
  );
}

function AdimKategori({ kategoriler, grup, secili, onSec, onGeri }) {
  const liste = kategoriler.filter(k=>k.grup===grup);
  return (
    <div>
      <div className="modal-title">{grup}</div>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {liste.map(k=>(
          <button key={k.key} type="button" onClick={()=>onSec(k)}
            style={{ background:secili?.key===k.key?`${k.renk}18`:'var(--bg3)', border:`1.5px solid ${secili?.key===k.key?k.renk:'var(--border)'}`, borderRadius:'var(--r-xs)', padding:'11px 16px', color:'var(--text)', cursor:'pointer', display:'flex', alignItems:'center', gap:10, fontSize:14, textAlign:'left', transition:'all 0.15s' }}>
            <span style={{ width:10, height:10, borderRadius:'50%', background:k.renk, flexShrink:0 }}/>
            {k.label}
          </button>
        ))}
      </div>
      <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={onGeri}>← Geri</button></div>
    </div>
  );
}

function AdimKaynak({ secili, onSec, onGeri }) {
  return (
    <div>
      <div className="modal-title">Nereden geldi?</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        {KAYNAKLAR.map(k=>(
          <button key={k.key} type="button" onClick={()=>onSec(k.key)}
            style={{ background:secili===k.key?'rgba(99,102,241,0.15)':'var(--bg3)', border:`1.5px solid ${secili===k.key?'var(--indigo)':'var(--border)'}`, borderRadius:'var(--r-xs)', padding:'12px 14px', color:'var(--text)', cursor:'pointer', display:'flex', alignItems:'center', gap:10, fontSize:14, fontWeight:500 }}>
            <i className={`ti ${k.icon}`} style={{ fontSize:20, color:'var(--indigo)' }}/>{k.label}
          </button>
        ))}
      </div>
      <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={onGeri}>← Geri</button></div>
    </div>
  );
}

function AdimDetay({ kategori, kaynak, isMusteri, onGeri, onKaydet }) {
  const bugun = new Date().toISOString().split('T')[0];
  const asamaListesi = ASAMALAR[kategori?.key]||[];

  const [musteriAdSoyad,  setMusteriAdSoyad]  = useState('');
  const [telefon,         setTelefon]         = useState('');
  const [teslimTarihi,    setTeslimTarihi]    = useState('');
  const [urunDetay,       setUrunDetay]       = useState('');
  const [adet,            setAdet]            = useState('');
  const [baskiYonu,       setBaskiYonu]       = useState('');
  const [satisTipi,       setSatisTipi]       = useState('');
  const [notlar,          setNotlar]          = useState('');
  const [hesaplaniyor,    setHesaplaniyor]    = useState(false);
  const [hesaplananTarih, setHesaplananTarih] = useState(null);
  const [musteriler,      setMusteriler]      = useState([]);
  const [musteriArama,    setMusteriArama]    = useState('');
  const [musteriMenuAcik, setMusteriMenuAcik] = useState(false);

  // Mevcut müşterileri yükle
  useEffect(() => {
    if (!isMusteri) musteriApi.getAll().then(r=>setMusteriler(r.data)).catch(()=>{});
  }, [isMusteri]);

  const filtrelenmisMusteri = musteriler.filter(m =>
    musteriArama.length > 0 && (`${m.ad} ${m.soyad||''} ${m.telefon||''}`).toLowerCase().includes(musteriArama.toLowerCase())
  ).slice(0,8);

  const musteriSec = m => {
    setMusteriAdSoyad(`${m.ad}${m.soyad?' '+m.soyad:''}`);
    setTelefon(m.telefon||'');
    setMusteriArama('');
    setMusteriMenuAcik(false);
  };

  const handleOtomatikTarih = async () => {
    const adetSayi = parseInt(adet)||1;
    const ps = baskiYonu==='cift_yon'?adetSayi*2:baskiYonu==='tek_yon'?adetSayi:adetSayi;
    setHesaplaniyor(true);
    try {
      const { ayarlarApi } = await import('../api');
      const res = await ayarlarApi.hesaplaTeslimTarihi(ps);
      setTeslimTarihi(res.data.teslim_tarihi);
      setHesaplananTarih(res.data.teslim_tarihi);
    } catch {
      const d=new Date(); d.setDate(d.getDate()+2);
      const t=d.toISOString().split('T')[0];
      setTeslimTarihi(t); setHesaplananTarih(t);
    } finally { setHesaplaniyor(false); }
  };

  const handleGonder = useCallback(async () => {
    if (!isMusteri && !musteriAdSoyad.trim()) { alert('Müşteri adı zorunlu'); return; }
    let teslim = teslimTarihi;
    if (!teslim) {
      try {
        const { ayarlarApi } = await import('../api');
        const adetSayi=parseInt(adet)||1;
        const ps=baskiYonu==='cift_yon'?adetSayi*2:baskiYonu==='tek_yon'?adetSayi:adetSayi;
        const res=await ayarlarApi.hesaplaTeslimTarihi(ps);
        teslim=res.data.teslim_tarihi;
      } catch { const d=new Date();d.setDate(d.getDate()+2);teslim=d.toISOString().split('T')[0]; }
    }
    const adetSayi=parseInt(adet)||1;
    const ps=baskiYonu==='cift_yon'?adetSayi*2:baskiYonu==='tek_yon'?adetSayi:0;
    const adParts = musteriAdSoyad.trim().split(' ');
    const musteriAdi = adParts[0]||'';
    const musteriSoyadi = adParts.slice(1).join(' ');
    onKaydet({
      musteri_adi:musteriAdi, musteri_soyadi:musteriSoyadi, musteri_telefon:telefon.trim(),
      notlar:notlar.trim(), teslim_tarihi:teslim, baski_yonu:baskiYonu, satis_tipi:satisTipi,
      press_sayisi:ps, kaynak:kaynak||'musteri_paneli', kategori:kategori?.key||'',
      asamalar:asamaListesi.map(a=>({key:a,label:ASAMA_LABEL[a]?.label||a,tamamlandi:false})),
      urunler:urunDetay.trim()?[{ad:urunDetay.trim(),adet:adetSayi}]:[],
    });
  }, [musteriAdSoyad,telefon,notlar,teslimTarihi,urunDetay,adet,baskiYonu,satisTipi,kaynak,kategori,asamaListesi,isMusteri,onKaydet]);

  return (
    <div>
      <div className="modal-title">Sipariş Detayları</div>
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
        {kategori && <span className="badge badge-indigo">{kategori.label}</span>}
        {!isMusteri && kaynak && <span className="badge badge-gray">{KAYNAKLAR.find(k=>k.key===kaynak)?.label}</span>}
      </div>

      {!isMusteri && (
        <>
          {/* Mevcut müşteri seç */}
          <div className="form-group">
            <label className="form-label">Mevcut Müşterilerden Seç</label>
            <div style={{ position:'relative' }}>
              <input className="form-input" value={musteriArama} onChange={e=>{ setMusteriArama(e.target.value); setMusteriMenuAcik(true); }} onFocus={()=>setMusteriMenuAcik(true)} placeholder="Ad, soyad veya telefon ile ara..."/>
              {musteriMenuAcik && filtrelenmisMusteri.length>0 && (
                <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:100, background:'var(--bg2)', border:'1px solid var(--border2)', borderRadius:'var(--r-xs)', boxShadow:'0 8px 24px rgba(0,0,0,0.4)', maxHeight:220, overflowY:'auto', marginTop:4 }}>
                  {filtrelenmisMusteri.map(m=>(
                    <button key={m._id} type="button" onClick={()=>musteriSec(m)}
                      style={{ width:'100%', textAlign:'left', padding:'10px 14px', border:'none', background:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:10, color:'var(--text)' }}
                      onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'}
                      onMouseLeave={e=>e.currentTarget.style.background='none'}>
                      <div style={{ width:32, height:32, borderRadius:8, background:'var(--g-indigo)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'white', flexShrink:0 }}>
                        {(m.ad||'?')[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize:13, fontWeight:600 }}>{m.ad} {m.soyad}</div>
                        <div style={{ fontSize:11, color:'var(--text3)' }}>{m.telefon} · {m.siparis_sayisi} sipariş</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Ad Soyad birleşik */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Ad Soyad *</label>
              <input className="form-input" value={musteriAdSoyad} onChange={e=>setMusteriAdSoyad(e.target.value)} onClick={()=>setMusteriMenuAcik(false)} placeholder="Ahmet Yılmaz"/>
            </div>
            <div className="form-group">
              <label className="form-label">Telefon</label>
              <input className="form-input" value={telefon} onChange={e=>setTelefon(e.target.value)} placeholder="05xx xxx xx xx"/>
            </div>
          </div>
        </>
      )}

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Adet</label>
          <input className="form-input" type="number" min="1" value={adet} onChange={e=>setAdet(e.target.value)} placeholder="1"/>
        </div>
        {!isMusteri && (
          <div className="form-group">
            <label className="form-label">Satış Tipi</label>
            <select className="form-input" value={satisTipi} onChange={e=>setSatisTipi(e.target.value)}>
              <option value="">Belirtilmedi</option>
              <option value="perakende">Perakende</option>
              <option value="toptan">Toptan</option>
            </select>
          </div>
        )}
      </div>

      {/* Baskı yönü */}
      <div className="form-group">
        <label className="form-label">Baskı Yönü <span style={{ color:'var(--text3)', fontWeight:'normal' }}>(opsiyonel)</span></label>
        <div style={{ display:'flex', gap:8 }}>
          {[{key:'',label:'Seçilmedi'},{key:'tek_yon',label:'Tek Yön'},{key:'cift_yon',label:'Çift Yön'}].map(b=>(
            <button key={b.key} type="button" onClick={()=>setBaskiYonu(b.key)}
              style={{ flex:1, padding:'8px', border:`1.5px solid ${baskiYonu===b.key?'var(--indigo)':'var(--border)'}`, background:baskiYonu===b.key?'rgba(99,102,241,0.15)':'var(--bg3)', borderRadius:'var(--r-xs)', color:baskiYonu===b.key?'var(--indigo)':'var(--text2)', fontSize:13, cursor:'pointer' }}>
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {/* Teslim tarihi */}
      <div className="form-group">
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
          <label className="form-label" style={{ margin:0 }}>Son Teslim Tarihi</label>
          <button type="button" className="btn btn-sm btn-secondary" onClick={handleOtomatikTarih} disabled={hesaplaniyor}>
            <i className="ti ti-calendar-stats"/>{hesaplaniyor?'...':'Otomatik'}
          </button>
        </div>
        <input className="form-input" type="date" min={bugun} value={teslimTarihi} onChange={e=>setTeslimTarihi(e.target.value)}/>
        {hesaplananTarih && teslimTarihi===hesaplananTarih && (
          <div style={{ fontSize:12, color:'var(--green)', marginTop:4 }}>
            <i className="ti ti-circle-check"/> Kapasiteye göre: {new Date(teslimTarihi+'T00:00:00').toLocaleDateString('tr-TR')}
          </div>
        )}
      </div>

      <div className="form-group">
        <label className="form-label">Sipariş Detayı</label>
        <textarea className="form-input" rows={3} value={urunDetay} onChange={e=>setUrunDetay(e.target.value)} placeholder="Ürün, ölçü, renk, özel istek..."/>
      </div>
      <div className="form-group">
        <label className="form-label">Not</label>
        <textarea className="form-input" rows={2} value={notlar} onChange={e=>setNotlar(e.target.value)} placeholder="Ekstra not..."/>
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

export default function YeniSiparisModal({ onKapat, onKaydet, kategoriler=[], isMusteri=false }) {
  const ADIM_SAYISI = isMusteri ? 3 : 4;
  const [adim,   setAdim]   = useState(1);
  const [grup,   setGrup]   = useState('');
  const [kat,    setKat]    = useState(null);
  const [kaynak, setKaynak] = useState('');

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onKapat()}>
      <div className="modal" style={{ maxWidth:560 }}>
        <div style={{ display:'flex', gap:4, marginBottom:24 }}>
          {Array.from({length:ADIM_SAYISI},(_,i)=>(
            <div key={i} style={{ flex:1, height:3, borderRadius:2, background:adim>i?'var(--indigo)':'var(--border)', transition:'background 0.2s' }}/>
          ))}
        </div>
        {adim===1 && <AdimGrup kategoriler={kategoriler} onSec={g=>{setGrup(g);setAdim(2);}} onKapat={onKapat}/>}
        {adim===2 && <AdimKategori kategoriler={kategoriler} grup={grup} secili={kat} onSec={k=>{setKat(k);setAdim(isMusteri?3:3);}} onGeri={()=>setAdim(1)}/>}
        {adim===3 && !isMusteri && <AdimKaynak secili={kaynak} onSec={k=>{setKaynak(k);setAdim(4);}} onGeri={()=>setAdim(2)}/>}
        {((adim===3&&isMusteri)||(adim===4&&!isMusteri)) && (
          <AdimDetay kategori={kat} kaynak={kaynak} isMusteri={isMusteri} onGeri={()=>setAdim(isMusteri?2:3)} onKaydet={onKaydet}/>
        )}
      </div>
    </div>
  );
}
