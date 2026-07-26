import { useState, useEffect, useCallback, useRef } from 'react';
import { siparisApi, shopierApi, dosyaApi, ayarlarApi } from '../api';
import { useToast } from '../context/ToastContext';
import YeniSiparisModal, { KAYNAKLAR, ASAMA_LABEL } from '../components/YeniSiparisModal';
import { kategoriApi } from '../api';

const DURUM = {
  bekliyor:      { label:'Bekliyor',      cls:'badge-gray'  },
  hazirlaniyor:  { label:'Hazırlanıyor',  cls:'badge-amber' },
  hazir:         { label:'Hazır',         cls:'badge-blue'  },
  kargoda:       { label:'Kargoda',       cls:'badge-green' },
  teslim_edildi: { label:'Teslim Edildi', cls:'badge-green' },
};
const KARGO_FIRMA  = ['Yurtiçi','Aras','MNG','PTT','Sürat','Elden Teslim'];
const ODEME_YONTEM = ['Nakit','Havale/EFT','Kredi Kartı','Kapıda Ödeme'];

function kartRengi(kalanGun) {
  if (kalanGun===null) return { bg:'var(--bg2)', border:'var(--border)', etiket:'', etiketRenk:'' };
  if (kalanGun<=0)  return { bg:'rgba(232,72,85,0.07)',  border:'#e84855', etiket:kalanGun===0?'BUGÜN':'GECİKTİ', etiketRenk:'#e84855' };
  if (kalanGun===1) return { bg:'rgba(240,120,0,0.07)',  border:'#f07800', etiket:'YARIN',    etiketRenk:'#f07800' };
  if (kalanGun<=7)  return { bg:'rgba(240,165,0,0.05)',  border:'#f0a500', etiket:'BU HAFTA', etiketRenk:'#f0a500' };
  return { bg:'var(--bg2)', border:'var(--border)', etiket:'', etiketRenk:'' };
}

function OdemeBadge({ odeme }) {
  if (!odeme?.tutar) return null;
  const { tutar=0, odenen=0, odendi, fatura_kesildi } = odeme;
  if (odendi||odenen>=tutar) return <span className="badge badge-green" style={{fontSize:11}}>💳 {tutar.toLocaleString('tr-TR')}₺ ✓{fatura_kesildi?' · F✓':''}</span>;
  if (odenen>0) return <span className="badge badge-amber" style={{fontSize:11}}>💳 {odenen.toLocaleString('tr-TR')}₺/{tutar.toLocaleString('tr-TR')}₺</span>;
  return <span className="badge badge-red" style={{fontSize:11}}>💳 {tutar.toLocaleString('tr-TR')}₺ bekleniyor</span>;
}

function KapasiteBadge({ kullanilanPress, kapasite, tarih }) {
  if (!tarih) return null;
  const oran = kapasite>0 ? kullanilanPress/kapasite : 0;
  const renk = oran>=0.9?'var(--red)':oran>=0.6?'var(--amber)':'var(--green)';
  return (
    <span style={{ fontSize:11, fontWeight:600, color:renk, background:`${renk}15`, padding:'2px 8px', borderRadius:12, border:`1px solid ${renk}40`, whiteSpace:'nowrap' }}>
      {kullanilanPress}/{kapasite} press
    </span>
  );
}

function HizliPanel({ label, onKapat, children }) {
  const ref = useRef();
  useEffect(() => {
    const h=(e)=>{ if(ref.current&&!ref.current.contains(e.target))onKapat(); };
    setTimeout(()=>document.addEventListener('mousedown',h),0);
    return ()=>document.removeEventListener('mousedown',h);
  },[onKapat]);
  return (
    <div ref={ref} onClick={e=>e.stopPropagation()} style={{ position:'absolute', zIndex:200, top:'calc(100% + 6px)', right:0, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:16, minWidth:260, boxShadow:'0 8px 32px rgba(0,0,0,0.4)' }}>
      <div style={{ fontSize:13, fontWeight:600, marginBottom:12 }}>{label}</div>
      {children}
    </div>
  );
}

function SiparisKarti({ s, onDurumDegis, onSil, onAsamaDegis, onYukle, gunlukKapasite }) {
  const toast = useToast();
  const [asamaAcik, setAsamaAcik] = useState(false);
  const [acikPanel, setAcikPanel] = useState(null);
  const [odeme, setOdeme] = useState(s.odeme||{});
  const [kargo, setKargo] = useState(s.kargo||{});
  const dosyaRef = useRef();
  const sid = s._id||s.id;

  const bugun = new Date(); bugun.setHours(0,0,0,0);
  const kalanGun = s.teslim_tarihi ? Math.ceil((new Date(s.teslim_tarihi+'T00:00:00')-bugun)/(1000*60*60*24)) : null;
  const renk = kartRengi(kalanGun);
  const bugunStr = bugun.toISOString().split('T')[0];
  const yarinStr = new Date(bugun.getTime()+86400000).toISOString().split('T')[0];

  const kaynak = KAYNAKLAR.find(k=>k.key===s.kaynak);
  const durum = DURUM[s.durum]||DURUM.bekliyor;
  const tamamlanan = s.asamalar?.filter(a=>a.tamamlandi).length||0;
  const toplamAsama = s.asamalar?.length||0;

  const handleOdemeKaydet=async()=>{ try{await siparisApi.updateOdeme(sid,odeme);toast('Ödeme güncellendi ✓');setAcikPanel(null);onYukle();}catch{toast('Hata','error');} };
  const handleKargoKaydet=async()=>{ try{await siparisApi.updateKargo(sid,kargo);toast('Kargo güncellendi ✓');setAcikPanel(null);onYukle();}catch{toast('Hata','error');} };
  const handleDosyaYukle=async(e)=>{ const f=e.target.files[0];if(!f)return;const fd=new FormData();fd.append('dosya',f);try{await dosyaApi.yukle(sid,fd);toast('Dosya yüklendi ✓');onYukle();}catch{toast('Yükleme hatası','error');}finally{e.target.value='';} };

  return (
    <div style={{ background:renk.bg, border:`1px solid ${renk.border}`, borderLeft:`4px solid ${renk.border}`, borderRadius:'var(--radius)', padding:'13px 16px', marginBottom:10, display:'grid', gridTemplateColumns:'1fr auto', gap:12, position:'relative' }}>
      <div style={{ minWidth:0 }}>
        {/* Başlık */}
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5, flexWrap:'wrap' }}>
          {renk.etiket && <span style={{ fontSize:10, fontWeight:800, color:renk.etiketRenk, background:`${renk.etiketRenk}18`, padding:'2px 6px', borderRadius:3, border:`1px solid ${renk.etiketRenk}40` }}>{renk.etiket}</span>}
          <span style={{ fontWeight:700, fontSize:15 }}>{s.musteri_adi} {s.musteri_soyadi}</span>
          <span style={{ fontSize:12, color:'var(--text3)' }}>#{s.siparis_no}</span>
          <span className={`badge ${durum.cls}`}>{durum.label}</span>
          <OdemeBadge odeme={s.odeme}/>
          {/* Kapasite göstergesi — sadece bugün/yarın */}
          {(s.teslim_tarihi===bugunStr || s.teslim_tarihi===yarinStr) && s.press_sayisi>0 && gunlukKapasite && (
            <KapasiteBadge
              kullanilanPress={gunlukKapasite[s.teslim_tarihi]||0}
              kapasite={gunlukKapasite.kapasite||180}
              tarih={s.teslim_tarihi}/>
          )}
        </div>

        {/* Meta */}
        <div style={{ fontSize:13, color:'var(--text2)', display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:4 }}>
          {kaynak && <span style={{ display:'flex', alignItems:'center', gap:3 }}><i className={`ti ${kaynak.icon}`} style={{ fontSize:13 }}/>{kaynak.label}</span>}
          {s.kategori && <><span style={{ color:'var(--border)' }}>·</span><span>{s.kategori}</span></>}
          {s.baski_yonu && <><span style={{ color:'var(--border)' }}>·</span><span>{s.baski_yonu==='cift_yon'?'Çift Yön':'Tek Yön'}</span></>}
          {s.kargo?.takip_no && <><span style={{ color:'var(--border)' }}>·</span><span><i className="ti ti-truck" style={{ fontSize:12 }}/> {s.kargo.takip_no}</span></>}
        </div>

        {/* Ürünler */}
        {s.urunler?.length>0&&s.urunler[0]?.ad&&(
          <div style={{ fontSize:13, color:'var(--text)', marginBottom:4 }}>
            {s.urunler.map((u,i)=><span key={i}>{u.adet>1?`${u.adet}× `:''}{u.ad}</span>)}
          </div>
        )}

        {/* Tarih */}
        {s.teslim_tarihi && (
          <div style={{ fontSize:13, fontWeight:600, color:renk.border||'var(--text2)', display:'flex', alignItems:'center', gap:5 }}>
            <i className="ti ti-calendar-due" style={{ fontSize:13 }}/>
            {kalanGun===null?'Tarih yok':kalanGun<0?`${Math.abs(kalanGun)} gün geçti!`:kalanGun===0?'Bugün teslim!':kalanGun===1?'Yarın teslim':`${kalanGun} gün kaldı`}
            <span style={{ fontWeight:400, color:'var(--text3)', fontSize:12 }}>({new Date(s.teslim_tarihi+'T00:00:00').toLocaleDateString('tr-TR')})</span>
          </div>
        )}

        {/* Aşamalar */}
        {toplamAsama>0 && (
          <div style={{ marginTop:8 }}>
            <button onClick={()=>setAsamaAcik(a=>!a)} style={{ background:'none', border:'none', color:'var(--text3)', fontSize:12, cursor:'pointer', padding:0, display:'flex', alignItems:'center', gap:6 }}>
              <i className={`ti ti-chevron-${asamaAcik?'up':'down'}`} style={{ fontSize:12 }}/>
              Aşamalar ({tamamlanan}/{toplamAsama})
              <div style={{ width:50, height:3, background:'var(--border)', borderRadius:2, overflow:'hidden' }}><div style={{ height:'100%', background:'var(--accent)', width:`${(tamamlanan/toplamAsama)*100}%` }}/></div>
            </button>
            {asamaAcik&&(
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:8 }}>
                {s.asamalar.map((a,idx)=>{const info=ASAMA_LABEL[a.key]||{};return(
                  <button key={idx} onClick={()=>onAsamaDegis(sid,idx)} style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 10px', borderRadius:'var(--radius-sm)', fontSize:12, cursor:'pointer', border:`1px solid ${a.tamamlandi?(info.renk||'var(--green)'):'var(--border)'}`, background:a.tamamlandi?`${info.renk||'var(--green)'}22`:'var(--bg3)', color:a.tamamlandi?(info.renk||'var(--green)'):'var(--text2)' }}>
                    <i className={`ti ${a.tamamlandi?'ti-circle-check':(info.icon||'ti-circle')}`} style={{ fontSize:13 }}/>{a.label}
                  </button>
                );})}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sağ butonlar */}
      <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8, flexShrink:0 }}>
        <select className="status-select" value={s.durum} onChange={e=>onDurumDegis(sid,e.target.value)}>
          <option value="bekliyor">Bekliyor</option>
          <option value="hazirlaniyor">Hazırlanıyor</option>
          <option value="hazir">Hazır</option>
          <option value="kargoda">Kargoda</option>
          <option value="teslim_edildi">Teslim Edildi</option>
        </select>
        <div style={{ display:'flex', gap:5, position:'relative' }}>
          {/* Ödeme */}
          <div style={{ position:'relative' }}>
            <button className="btn-icon" onClick={()=>setAcikPanel(p=>p==='odeme'?null:'odeme')} style={{ color:s.odeme?.odendi?'var(--green)':s.odeme?.tutar?'var(--amber)':'var(--text2)' }}>
              <i className="ti ti-coin" style={{ fontSize:15 }}/>
            </button>
            {acikPanel==='odeme'&&(
              <HizliPanel label="💳 Ödeme" onKapat={()=>setAcikPanel(null)}>
                <div style={{ display:'flex', gap:8, marginBottom:10 }}>
                  <div style={{ flex:1 }}><div style={{ fontSize:11, color:'var(--text3)', marginBottom:4 }}>Tutar (₺)</div><input className="form-input" type="number" style={{ padding:'6px 8px', fontSize:13 }} value={odeme.tutar||''} onChange={e=>setOdeme(o=>({...o,tutar:parseFloat(e.target.value)||0}))} placeholder="0"/></div>
                  <div style={{ flex:1 }}><div style={{ fontSize:11, color:'var(--text3)', marginBottom:4 }}>Alınan (₺)</div><input className="form-input" type="number" style={{ padding:'6px 8px', fontSize:13 }} value={odeme.odenen||''} onChange={e=>setOdeme(o=>({...o,odenen:parseFloat(e.target.value)||0}))} placeholder="0"/></div>
                </div>
                {odeme.tutar>0&&odeme.odenen>0&&odeme.odenen<odeme.tutar&&<div style={{ fontSize:12, color:'var(--amber)', marginBottom:8 }}>⚠️ Kalan: {(odeme.tutar-odeme.odenen).toFixed(2)}₺</div>}
                <select className="form-input" style={{ marginBottom:10, padding:'6px 8px', fontSize:13 }} value={odeme.yontem||''} onChange={e=>setOdeme(o=>({...o,yontem:e.target.value}))}><option value="">Yöntem seç...</option>{ODEME_YONTEM.map(y=><option key={y}>{y}</option>)}</select>
                <div style={{ display:'flex', gap:12, marginBottom:12 }}>
                  <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, cursor:'pointer' }}><input type="checkbox" checked={odeme.odendi||false} onChange={e=>setOdeme(o=>({...o,odendi:e.target.checked}))}/><span style={{ color:odeme.odendi?'var(--green)':'var(--text)' }}>Ödendi ✓</span></label>
                  <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, cursor:'pointer' }}><input type="checkbox" checked={odeme.fatura_kesildi||false} onChange={e=>setOdeme(o=>({...o,fatura_kesildi:e.target.checked}))}/><span style={{ color:odeme.fatura_kesildi?'var(--green)':'var(--text)' }}>Fatura ✓</span></label>
                </div>
                <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center' }} onClick={handleOdemeKaydet}>Kaydet</button>
              </HizliPanel>
            )}
          </div>
          {/* Kargo */}
          <div style={{ position:'relative' }}>
            <button className="btn-icon" onClick={()=>setAcikPanel(p=>p==='kargo'?null:'kargo')} style={{ color:s.kargo?.takip_no?'var(--accent)':'var(--text2)' }}>
              <i className="ti ti-truck" style={{ fontSize:15 }}/>
            </button>
            {acikPanel==='kargo'&&(
              <HizliPanel label="📦 Kargo" onKapat={()=>setAcikPanel(null)}>
                <select className="form-input" style={{ marginBottom:8, padding:'6px 8px', fontSize:13 }} value={kargo.firma||''} onChange={e=>setKargo(k=>({...k,firma:e.target.value}))}><option value="">Firma seç...</option>{KARGO_FIRMA.map(f=><option key={f}>{f}</option>)}</select>
                <input className="form-input" style={{ marginBottom:8, padding:'6px 8px', fontSize:13 }} placeholder="Takip numarası..." value={kargo.takip_no||''} onChange={e=>setKargo(k=>({...k,takip_no:e.target.value}))}/>
                <input className="form-input" type="date" style={{ marginBottom:12, padding:'6px 8px', fontSize:13 }} value={kargo.gonderim_tarihi||''} onChange={e=>setKargo(k=>({...k,gonderim_tarihi:e.target.value}))}/>
                <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center' }} onClick={handleKargoKaydet}>Kaydet</button>
              </HizliPanel>
            )}
          </div>
          <button className="btn-icon" onClick={()=>dosyaRef.current?.click()} title="Dosya"><i className="ti ti-paperclip" style={{ fontSize:15 }}/></button>
          <input ref={dosyaRef} type="file" style={{ display:'none' }} accept=".jpg,.jpeg,.png,.pdf,.ai,.eps,.svg,.zip" onChange={handleDosyaYukle}/>
          <button className="btn-icon" onClick={()=>onSil(sid)}><i className="ti ti-trash" style={{ fontSize:15 }}/></button>
        </div>
      </div>
    </div>
  );
}

export default function SiparislerPage() {
  const toast = useToast();
  const [data, setData] = useState({ aktif:[], teslim_edilen:[] });
  const [kategoriler, setKategoriler] = useState([]);
  const [filtre, setFiltre] = useState('hepsi');
  const [yeniModalAcik, setYeniModalAcik] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [arsivAcik, setArsivAcik] = useState(false);
  const [shopierYukleniyor, setShopierYukleniyor] = useState(false);
  const [gunlukKapasite, setGunlukKapasite] = useState({ kapasite:180 });

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    try {
      const [sipRes, katRes, ayarRes] = await Promise.all([
        siparisApi.getAll(),
        kategoriApi.getAll(),
        ayarlarApi.get(),
      ]);
      const bugun = new Date(); bugun.setHours(0,0,0,0);
      const aktif = sipRes.data.aktif.map(s => {
        const kg = s.teslim_tarihi ? Math.ceil((new Date(s.teslim_tarihi+'T00:00:00')-bugun)/(1000*60*60*24)) : null;
        return { ...s, kalan_gun:kg };
      });

      // Günlük press yükü hesapla
      const kapasiteMap = { kapasite: ayarRes.data.gunluk_press_kapasitesi||180 };
      aktif.forEach(s => {
        if (s.teslim_tarihi && s.press_sayisi>0) {
          kapasiteMap[s.teslim_tarihi] = (kapasiteMap[s.teslim_tarihi]||0) + s.press_sayisi;
        }
      });
      setGunlukKapasite(kapasiteMap);
      setData({ aktif, teslim_edilen:sipRes.data.teslim_edilen });
      setKategoriler(katRes.data);
    } catch { toast('Yüklenemedi','error'); }
    finally { setYukleniyor(false); }
  }, []);

  useEffect(() => { yukle(); }, [yukle]);

  const handleDurumDegis=async(id,durum)=>{ try{await siparisApi.updateDurum(id,durum);yukle();}catch{toast('Hata','error');} };
  const handleAsamaDegis=async(id,idx)=>{ const s=[...data.aktif,...data.teslim_edilen].find(s=>(s._id||s.id)===id);if(!s)return;const asamalar=s.asamalar.map((a,i)=>i===idx?{...a,tamamlandi:!a.tamamlandi}:a);try{await siparisApi.update(id,{...s,asamalar});yukle();}catch{toast('Hata','error');} };
  const handleYeniSiparis=async(fd)=>{ try{await siparisApi.create(fd);setYeniModalAcik(false);toast('Sipariş oluşturuldu ✓');yukle();}catch{toast('Hata','error');} };
  const handleSil=async(id)=>{ if(!confirm('Silinsin mi?'))return;try{await siparisApi.delete(id);toast('Silindi');yukle();}catch{toast('Hata','error');} };
  const handleShopier=async()=>{ setShopierYukleniyor(true);try{const r=await shopierApi.cek();toast(r.data.mesaj);yukle();}catch(e){toast(e.response?.data?.hata||'Shopier hatası','error');}finally{setShopierYukleniyor(false);} };

  const bugunStr = new Date().toISOString().split('T')[0];
  const yarinStr = (() => { const d=new Date(); d.setDate(d.getDate()+1); return d.toISOString().split('T')[0]; })();

  const filtrelenmis = data.aktif.filter(s => {
    if (filtre==='hepsi') return true;
    if (filtre==='bugun') return s.kalan_gun!==null&&s.kalan_gun<=0;
    if (filtre==='hafta')  return s.kalan_gun!==null&&s.kalan_gun>0&&s.kalan_gun<=7;
    if (filtre==='odeme')  return !s.odeme?.odendi&&s.odeme?.tutar>0;
    return s.durum===filtre;
  }).sort((a,b)=>{
    const ta=a.teslim_tarihi?new Date(a.teslim_tarihi):new Date('2099-01-01');
    const tb=b.teslim_tarihi?new Date(b.teslim_tarihi):new Date('2099-01-01');
    return ta-tb;
  });

  const bugunSayisi = data.aktif.filter(s=>s.kalan_gun!==null&&s.kalan_gun<=0).length;
  const odemeSayisi = data.aktif.filter(s=>!s.odeme?.odendi&&s.odeme?.tutar>0).length;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">📦 Sipariş Takibi</div>
          <div className="page-sub">{data.aktif.length} aktif sipariş</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-secondary" onClick={handleShopier} disabled={shopierYukleniyor}>
            <i className="ti ti-refresh"/>{shopierYukleniyor?'...':'Shopier\'den Çek'}
          </button>
          <button className="btn btn-primary" onClick={()=>setYeniModalAcik(true)}>
            <i className="ti ti-plus"/> Yeni Sipariş
          </button>
        </div>
      </div>

      <div className="filter-row">
        {[['hepsi','Tümü'],['bugun',bugunSayisi>0?`🔴 Bugün (${bugunSayisi})`:'🔴 Bugün'],['hafta','🟡 Bu Hafta'],['bekliyor','Bekliyor'],['hazirlaniyor','Hazırlanıyor'],['hazir','Hazır'],['kargoda','Kargoda'],['odeme',odemeSayisi>0?`💳 Ödeme (${odemeSayisi})`:'💳 Ödeme']].map(([key,label])=>(
          <button key={key} className={`filter-btn ${filtre===key?'active':''}`} onClick={()=>setFiltre(key)}>{label}</button>
        ))}
      </div>

      <div style={{ display:'flex', gap:16, marginBottom:12, fontSize:12, color:'var(--text3)' }}>
        <span><span style={{ width:10, height:10, borderRadius:2, background:'rgba(232,72,85,0.3)', display:'inline-block', marginRight:5 }}/>Bugün / Gecikmiş</span>
        <span><span style={{ width:10, height:10, borderRadius:2, background:'rgba(240,120,0,0.3)', display:'inline-block', marginRight:5 }}/>Yarın</span>
        <span><span style={{ width:10, height:10, borderRadius:2, background:'rgba(240,165,0,0.2)', display:'inline-block', marginRight:5 }}/>Bu Hafta</span>
      </div>

      {yukleniyor ? <div style={{ textAlign:'center', color:'var(--text2)', padding:40 }}>Yükleniyor...</div>
      : filtrelenmis.length===0 ? <div style={{ textAlign:'center', color:'var(--text3)', padding:40 }}><i className="ti ti-clipboard-off" style={{ fontSize:32, display:'block', marginBottom:8 }}/>Sipariş bulunamadı</div>
      : filtrelenmis.map(s=>(
        <SiparisKarti key={s._id||s.id} s={s}
          onDurumDegis={handleDurumDegis} onSil={handleSil}
          onAsamaDegis={handleAsamaDegis} onYukle={yukle}
          gunlukKapasite={gunlukKapasite}/>
      ))}

      {data.teslim_edilen?.length>0&&(
        <div style={{ marginTop:24 }}>
          <button onClick={()=>setArsivAcik(a=>!a)} className="btn btn-secondary" style={{ width:'100%', justifyContent:'center' }}>
            <i className="ti ti-archive"/>{arsivAcik?'Arşivi Gizle':`Arşivi Göster (${data.teslim_edilen.length})`}
          </button>
          {arsivAcik&&data.teslim_edilen.map(s=>(
            <div key={s._id||s.id} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'11px 16px', marginTop:8, opacity:0.55, display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontWeight:600 }}>{s.musteri_adi} {s.musteri_soyadi}</span>
              <span style={{ fontSize:12, color:'var(--text3)' }}>#{s.siparis_no}</span>
              <span className="badge badge-green">Teslim Edildi</span>
              <OdemeBadge odeme={s.odeme}/>
              <button className="btn-icon" style={{ marginLeft:'auto' }} onClick={()=>handleSil(s._id||s.id)}><i className="ti ti-trash" style={{ fontSize:15 }}/></button>
            </div>
          ))}
        </div>
      )}

      {yeniModalAcik && (
        <YeniSiparisModal
          kategoriler={kategoriler}
          isMusteri={false}
          onKapat={()=>setYeniModalAcik(false)}
          onKaydet={handleYeniSiparis}/>
      )}
    </div>
  );
}
