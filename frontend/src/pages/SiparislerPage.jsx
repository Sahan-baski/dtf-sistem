import { useState, useEffect, useCallback, useRef } from 'react';
import { siparisApi, shopierApi, dosyaApi, ayarlarApi, musteriApi } from '../api';
import { kategoriApi } from '../api';
import { useToast } from '../context/ToastContext';
import YeniSiparisModal, { ASAMA_LABEL } from '../components/YeniSiparisModal';

const DURUM_OPT = ['bekliyor','hazirlaniyor','hazir','kargoda','teslim_edildi'];
const DURUM_LABEL = { bekliyor:'Bekliyor', hazirlaniyor:'Hazırlanıyor', hazir:'Hazır', kargoda:'Kargoda', teslim_edildi:'Teslim Edildi' };
const DURUM_CLS   = { bekliyor:'badge-gray', hazirlaniyor:'badge-amber', hazir:'badge-blue', kargoda:'badge-green', teslim_edildi:'badge-green' };
const KARGO_FIRMA  = ['Yurtiçi','Aras','MNG','PTT','Sürat','Elden Teslim'];
const ODEME_YONTEM = ['Nakit','Havale/EFT','Kredi Kartı','Kapıda Ödeme'];

function kalanGun(t) {
  if (!t) return null;
  const b=new Date(); b.setHours(0,0,0,0);
  return Math.ceil((new Date(t+'T00:00:00')-b)/(864e5));
}

function urgency(kg) {
  if (kg===null) return { bg:'var(--bg2)', border:'var(--border)', chip:'', chipRenk:'' };
  if (kg<=0)  return { bg:'rgba(239,68,68,0.07)',   border:'#ef4444', chip:kg===0?'BUGÜN':'GECİKTİ', chipRenk:'#ef4444' };
  if (kg===1) return { bg:'rgba(245,158,11,0.07)',  border:'#f59e0b', chip:'YARIN',    chipRenk:'#f59e0b' };
  if (kg<=7)  return { bg:'rgba(99,102,241,0.04)',  border:'#6366f1', chip:'BU HAFTA', chipRenk:'#6366f1' };
  return { bg:'var(--bg2)', border:'var(--border)', chip:'', chipRenk:'' };
}

function HizliPanel({ label, onKapat, children }) {
  const ref = useRef();
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) onKapat(); };
    setTimeout(() => document.addEventListener('mousedown', h), 0);
    return () => document.removeEventListener('mousedown', h);
  }, [onKapat]);
  return (
    <div ref={ref} onClick={e=>e.stopPropagation()} style={{ position:'absolute', zIndex:300, top:'calc(100% + 6px)', right:0, background:'var(--bg2)', border:'1px solid var(--border2)', borderRadius:'var(--r-sm)', padding:16, minWidth:260, boxShadow:'0 16px 48px rgba(0,0,0,0.5)' }}>
      <div style={{ fontSize:13, fontWeight:600, marginBottom:12 }}>{label}</div>
      {children}
    </div>
  );
}

function SiparisKarti({ s, onYukle, onSil, onDurumDegis, onAsamaDegis, gunlukKapasite }) {
  const toast = useToast();
  const [acikPanel, setAcikPanel] = useState(null);
  const [asamaAcik, setAsamaAcik] = useState(false);
  const [odeme, setOdeme] = useState(s.odeme || {});
  const [kargo, setKargo] = useState(s.kargo || {});
  const dosyaRef = useRef();
  const sid = s._id || s.id;

  const kg = kalanGun(s.teslim_tarihi);
  const urg = urgency(kg);
  const bugunStr = new Date().toISOString().split('T')[0];
  const yarinStr = (() => { const d=new Date(); d.setDate(d.getDate()+1); return d.toISOString().split('T')[0]; })();

  const tarihLabel = kg===null ? '—'
    : kg < 0  ? `${Math.abs(kg)} gün geçti`
    : kg === 0 ? 'Bugün teslim!'
    : kg === 1 ? 'Yarın teslim'
    : `${kg} gün kaldı`;
  const tarihRenk = kg!==null && kg<=0?'var(--red)':kg===1?'var(--amber)':'var(--text2)';

  const odemeRenk = s.odeme?.odendi?'var(--green)':s.odeme?.tutar>0?'var(--amber)':'var(--text3)';
  const odemeLabel = !s.odeme?.tutar ? '—'
    : s.odeme?.odendi ? `${s.odeme.tutar.toLocaleString('tr-TR')}₺ ✓`
    : s.odeme?.odenen > 0 ? `${s.odeme.odenen.toLocaleString('tr-TR')} / ${s.odeme.tutar.toLocaleString('tr-TR')}₺`
    : `${s.odeme.tutar.toLocaleString('tr-TR')}₺ bekleniyor`;

  const kapBadge = (s.teslim_tarihi===bugunStr||s.teslim_tarihi===yarinStr) && s.press_sayisi>0 && gunlukKapasite;

  const togglePanel = p => setAcikPanel(v => v===p ? null : p);

  const handleOdemeKaydet = async () => {
    try { await siparisApi.updateOdeme(sid, odeme); toast('Ödeme güncellendi ✓'); setAcikPanel(null); onYukle(); }
    catch { toast('Hata','error'); }
  };
  const handleKargoKaydet = async () => {
    try { await siparisApi.updateKargo(sid, kargo); toast('Kargo güncellendi ✓'); setAcikPanel(null); onYukle(); }
    catch { toast('Hata','error'); }
  };
  const handleDosyaYukle = async e => {
    const f = e.target.files[0]; if (!f) return;
    const fd = new FormData(); fd.append('dosya', f);
    try { await dosyaApi.yukle(sid, fd); toast('Dosya yüklendi ✓'); onYukle(); }
    catch { toast('Yükleme hatası','error'); } finally { e.target.value = ''; }
  };

  const tamamlanan = s.asamalar?.filter(a=>a.tamamlandi).length || 0;
  const toplamAsama = s.asamalar?.length || 0;

  return (
    <div style={{ background:urg.bg, border:`1px solid ${urg.border}`, borderLeft:`4px solid ${urg.border}`, borderRadius:'var(--r-sm)', overflow:'hidden', display:'flex', flexDirection:'column' }}>
      {/* Ana grid: 4 sütun */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 100px 108px 116px', minHeight:80 }}>

        {/* ── Sütun 1: Müşteri ─────────────────────────────── */}
        <div style={{ padding:'12px 14px', borderRight:'1px solid var(--border)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:5, flexWrap:'wrap' }}>
            {urg.chip && (
              <span style={{ fontSize:9, fontWeight:800, color:urg.chipRenk, background:`${urg.chipRenk}18`, padding:'2px 6px', borderRadius:4, border:`1px solid ${urg.chipRenk}40`, letterSpacing:'0.06em' }}>{urg.chip}</span>
            )}
            <span style={{ fontWeight:700, fontSize:14, color:'var(--text)' }}>{s.musteri_adi} {s.musteri_soyadi}</span>
            <span style={{ fontSize:11, color:'var(--text3)' }}>#{s.siparis_no}</span>
            {kapBadge && (
              <span style={{ fontSize:10, fontWeight:600, color:'var(--indigo)', background:'rgba(99,102,241,0.12)', padding:'2px 7px', borderRadius:10 }}>
                {gunlukKapasite[s.teslim_tarihi]||0}/{gunlukKapasite.kapasite||180} press
              </span>
            )}
          </div>
          <div style={{ fontSize:12, color:'var(--text2)', marginBottom:4, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            {s.kaynak && <span style={{ display:'flex', alignItems:'center', gap:3 }}><i className="ti ti-brand-whatsapp" style={{ fontSize:12 }}/>{s.kaynak}</span>}
            {s.kategori && <span style={{ color:'var(--text3)' }}>·</span>}
            {s.kategori && <span>{s.kategori}</span>}
            {s.baski_yonu && <><span style={{ color:'var(--text3)' }}>·</span><span>{s.baski_yonu==='cift_yon'?'Çift Yön':'Tek Yön'}</span></>}
          </div>
          {s.urunler?.length>0 && s.urunler[0]?.ad && (
            <div style={{ fontSize:13, color:'var(--text)', marginBottom:4 }}>
              {s.urunler.map((u,i)=><span key={i}>{u.adet>1?`${u.adet}× `:''}{u.ad}</span>)}
            </div>
          )}
          {s.notlar && <div style={{ fontSize:12, color:'var(--text3)', fontStyle:'italic' }}>{s.notlar.slice(0,60)}{s.notlar.length>60?'…':''}</div>}
          {/* Aşamalar */}
          {toplamAsama>0 && (
            <div style={{ marginTop:6 }}>
              <button onClick={()=>setAsamaAcik(a=>!a)} style={{ background:'none', border:'none', color:'var(--text3)', fontSize:11, cursor:'pointer', padding:0, display:'flex', alignItems:'center', gap:5 }}>
                <i className={`ti ti-chevron-${asamaAcik?'up':'down'}`} style={{ fontSize:11 }}/>
                Aşamalar ({tamamlanan}/{toplamAsama})
                <div style={{ width:40, height:3, background:'var(--border)', borderRadius:2, overflow:'hidden' }}>
                  <div style={{ height:'100%', background:'var(--indigo)', width:`${(tamamlanan/toplamAsama)*100}%` }}/>
                </div>
              </button>
              {asamaAcik && (
                <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:6 }}>
                  {s.asamalar.map((a,idx)=>{ const info=ASAMA_LABEL[a.key]||{}; return (
                    <button key={idx} onClick={()=>onAsamaDegis(sid,idx)} style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 8px', borderRadius:20, fontSize:11, cursor:'pointer', border:`1px solid ${a.tamamlandi?(info.renk||'var(--green)'):'var(--border)'}`, background:a.tamamlandi?`${info.renk||'var(--green)'}18`:'var(--bg3)', color:a.tamamlandi?(info.renk||'var(--green)'):'var(--text2)' }}>
                      <i className={`ti ${a.tamamlandi?'ti-circle-check':(info.icon||'ti-circle')}`} style={{ fontSize:11 }}/>{a.label}
                    </button>
                  );})}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Sütun 2: Durum + Aksiyonlar ─────────────────── */}
        <div style={{ padding:'10px 8px', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', gap:6 }}>
          <select className="status-select" value={s.durum} onChange={e=>onDurumDegis(sid,e.target.value)} style={{ width:'100%', fontSize:12 }}>
            {DURUM_OPT.map(d=><option key={d} value={d}>{DURUM_LABEL[d]}</option>)}
          </select>
          {/* Aksiyonlar */}
          <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
            {/* Ödeme */}
            <div style={{ position:'relative' }}>
              <button className="btn-icon" title="Ödeme" onClick={()=>togglePanel('odeme')} style={{ width:28, height:28, color:s.odeme?.odendi?'var(--green)':s.odeme?.tutar?'var(--amber)':'var(--text3)' }}>
                <i className="ti ti-coin" style={{ fontSize:13 }}/>
              </button>
              {acikPanel==='odeme' && (
                <HizliPanel label="💳 Ödeme" onKapat={()=>setAcikPanel(null)}>
                  <div style={{ display:'flex', gap:8, marginBottom:10 }}>
                    <div style={{ flex:1 }}><div style={{ fontSize:11, color:'var(--text2)', marginBottom:4 }}>Tutar (₺)</div><input className="form-input" type="number" style={{ padding:'6px 8px', fontSize:13 }} value={odeme.tutar||''} onChange={e=>setOdeme(o=>({...o,tutar:parseFloat(e.target.value)||0}))} placeholder="0"/></div>
                    <div style={{ flex:1 }}><div style={{ fontSize:11, color:'var(--text2)', marginBottom:4 }}>Alınan (₺)</div><input className="form-input" type="number" style={{ padding:'6px 8px', fontSize:13 }} value={odeme.odenen||''} onChange={e=>setOdeme(o=>({...o,odenen:parseFloat(e.target.value)||0}))} placeholder="0"/></div>
                  </div>
                  {odeme.tutar>0&&odeme.odenen>0&&odeme.odenen<odeme.tutar && <div style={{ fontSize:12, color:'var(--amber)', marginBottom:8 }}>⚠️ Kalan: {(odeme.tutar-odeme.odenen).toFixed(2)}₺</div>}
                  <select className="form-input" style={{ marginBottom:10, padding:'6px 8px', fontSize:13 }} value={odeme.yontem||''} onChange={e=>setOdeme(o=>({...o,yontem:e.target.value}))}>
                    <option value="">Yöntem...</option>{ODEME_YONTEM.map(y=><option key={y}>{y}</option>)}
                  </select>
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
              <button className="btn-icon" title="Kargo" onClick={()=>togglePanel('kargo')} style={{ width:28, height:28, color:s.kargo?.takip_no?'var(--indigo)':'var(--text3)' }}>
                <i className="ti ti-truck" style={{ fontSize:13 }}/>
              </button>
              {acikPanel==='kargo' && (
                <HizliPanel label="📦 Kargo" onKapat={()=>setAcikPanel(null)}>
                  <select className="form-input" style={{ marginBottom:8, padding:'6px 8px', fontSize:13 }} value={kargo.firma||''} onChange={e=>setKargo(k=>({...k,firma:e.target.value}))}><option value="">Firma...</option>{KARGO_FIRMA.map(f=><option key={f}>{f}</option>)}</select>
                  <input className="form-input" style={{ marginBottom:8, padding:'6px 8px', fontSize:13 }} placeholder="Takip no..." value={kargo.takip_no||''} onChange={e=>setKargo(k=>({...k,takip_no:e.target.value}))}/>
                  <input className="form-input" type="date" style={{ marginBottom:12, padding:'6px 8px', fontSize:13 }} value={kargo.gonderim_tarihi||''} onChange={e=>setKargo(k=>({...k,gonderim_tarihi:e.target.value}))}/>
                  <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center' }} onClick={handleKargoKaydet}>Kaydet</button>
                </HizliPanel>
              )}
            </div>
            <button className="btn-icon" title="Dosya" onClick={()=>dosyaRef.current?.click()} style={{ width:28, height:28 }}><i className="ti ti-paperclip" style={{ fontSize:13 }}/></button>
            <input ref={dosyaRef} type="file" style={{ display:'none' }} accept=".jpg,.jpeg,.png,.pdf,.ai,.eps,.svg,.zip" onChange={handleDosyaYukle}/>
            <button className="btn-icon" title="Sil" onClick={()=>onSil(sid)} style={{ width:28, height:28, color:'var(--red)' }}><i className="ti ti-trash" style={{ fontSize:13 }}/></button>
          </div>
        </div>

        {/* ── Sütun 3: Zamansal durum ─────────────────────── */}
        <div style={{ padding:'12px 10px', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', gap:4 }}>
          <div style={{ fontSize:12, fontWeight:700, color:tarihRenk }}>{tarihLabel}</div>
          {s.teslim_tarihi && (
            <div style={{ fontSize:11, color:'var(--text3)' }}>
              <i className="ti ti-calendar" style={{ fontSize:11, marginRight:3 }}/>
              {new Date(s.teslim_tarihi+'T00:00:00').toLocaleDateString('tr-TR',{day:'numeric',month:'short'})}
            </div>
          )}
          {s.kargo?.takip_no && (
            <div style={{ fontSize:11, color:'var(--indigo)', marginTop:4 }}>
              <i className="ti ti-truck" style={{ fontSize:11 }}/> {s.kargo.firma||'Kargo'}
            </div>
          )}
        </div>

        {/* ── Sütun 4: Ödeme durumu ────────────────────────── */}
        <div style={{ padding:'12px 10px', display:'flex', flexDirection:'column', gap:4 }}>
          <div style={{ fontSize:12, fontWeight:700, color:odemeRenk }}>{odemeLabel}</div>
          {s.odeme?.fatura_kesildi && <div style={{ fontSize:11, color:'var(--green)' }}>Fatura ✓</div>}
          {s.odeme?.yontem && <div style={{ fontSize:11, color:'var(--text3)' }}>{s.odeme.yontem}</div>}
          {!s.odeme?.tutar && <div style={{ fontSize:11, color:'var(--text3)' }}>Ödeme girilmedi</div>}
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
      const [sipRes, katRes, ayarRes] = await Promise.all([siparisApi.getAll(), kategoriApi.getAll(), ayarlarApi.get()]);
      const bugun = new Date(); bugun.setHours(0,0,0,0);
      const aktif = sipRes.data.aktif.map(s => ({
        ...s, kalan_gun: s.teslim_tarihi ? Math.ceil((new Date(s.teslim_tarihi+'T00:00:00')-bugun)/864e5) : null
      }));
      const kapMap = { kapasite: ayarRes.data.gunluk_press_kapasitesi||180 };
      aktif.forEach(s => { if (s.teslim_tarihi&&s.press_sayisi>0) kapMap[s.teslim_tarihi]=(kapMap[s.teslim_tarihi]||0)+s.press_sayisi; });
      setGunlukKapasite(kapMap);
      setData({ aktif, teslim_edilen: sipRes.data.teslim_edilen });
      setKategoriler(katRes.data);
    } catch { toast('Yüklenemedi','error'); }
    finally { setYukleniyor(false); }
  }, []);

  useEffect(() => { yukle(); }, [yukle]);

  const handleDurumDegis = async (id, durum) => { try { await siparisApi.updateDurum(id,durum); yukle(); } catch { toast('Hata','error'); } };
  const handleAsamaDegis = async (id, idx) => {
    const list = [...data.aktif, ...data.teslim_edilen];
    const s = list.find(s=>(s._id||s.id)===id); if (!s) return;
    const asamalar = s.asamalar.map((a,i)=>i===idx?{...a,tamamlandi:!a.tamamlandi}:a);
    try { await siparisApi.update(id,{...s,asamalar}); yukle(); } catch { toast('Hata','error'); }
  };
  const handleYeniSiparis = async fd => { try { await siparisApi.create(fd); setYeniModalAcik(false); toast('Sipariş oluşturuldu ✓'); yukle(); } catch { toast('Hata','error'); } };
  const handleSil = async id => { if (!confirm('Silinsin mi?')) return; try { await siparisApi.delete(id); toast('Silindi'); yukle(); } catch { toast('Hata','error'); } };
  const handleShopier = async () => { setShopierYukleniyor(true); try { const r=await shopierApi.cek(); toast(r.data.mesaj); yukle(); } catch(e) { toast(e.response?.data?.hata||'Shopier hatası','error'); } finally { setShopierYukleniyor(false); } };

  const filtrelenmis = data.aktif.filter(s => {
    if (filtre==='hepsi') return true;
    if (filtre==='bugun') return s.kalan_gun!==null&&s.kalan_gun<=0;
    if (filtre==='hafta') return s.kalan_gun!==null&&s.kalan_gun>0&&s.kalan_gun<=7;
    if (filtre==='odeme') return !s.odeme?.odendi&&s.odeme?.tutar>0;
    return s.durum===filtre;
  }).sort((a,b) => {
    const ta = a.teslim_tarihi?new Date(a.teslim_tarihi):new Date('2099-01-01');
    const tb = b.teslim_tarihi?new Date(b.teslim_tarihi):new Date('2099-01-01');
    return ta-tb;
  });

  const bugunSayisi = data.aktif.filter(s=>s.kalan_gun!==null&&s.kalan_gun<=0).length;
  const odemeSayisi = data.aktif.filter(s=>!s.odeme?.odendi&&s.odeme?.tutar>0).length;

  const KART_PROPS = { onDurumDegis:handleDurumDegis, onSil:handleSil, onAsamaDegis:handleAsamaDegis, onYukle:yukle, gunlukKapasite };

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">📦 Sipariş Takibi</div><div className="page-sub">{data.aktif.length} aktif sipariş</div></div>
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
        {[['hepsi','Tümü'],['bugun',bugunSayisi>0?`🔴 Bugün (${bugunSayisi})`:'🔴 Bugün'],['hafta','🟡 Bu Hafta'],['bekliyor','Bekliyor'],['hazirlaniyor','Hazırlanıyor'],['hazir','Hazır'],['kargoda','Kargoda'],['odeme',odemeSayisi>0?`💳 Ödeme (${odemeSayisi})`:'💳 Ödeme']].map(([k,l])=>(
          <button key={k} className={`filter-btn ${filtre===k?'active':''}`} onClick={()=>setFiltre(k)}>{l}</button>
        ))}
      </div>

      {yukleniyor ? (
        <div style={{ textAlign:'center', color:'var(--text2)', padding:40 }}>Yükleniyor...</div>
      ) : filtrelenmis.length===0 ? (
        <div style={{ textAlign:'center', color:'var(--text3)', padding:40 }}>
          <i className="ti ti-clipboard-off" style={{ fontSize:32, display:'block', marginBottom:8 }}/>Sipariş bulunamadı
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:12 }}>
          {filtrelenmis.map(s=><SiparisKarti key={s._id||s.id} s={s} {...KART_PROPS}/>)}
        </div>
      )}

      {/* Arşiv */}
      {data.teslim_edilen?.length>0 && (
        <div style={{ marginTop:24 }}>
          <button onClick={()=>setArsivAcik(a=>!a)} className="btn btn-secondary" style={{ width:'100%', justifyContent:'center', marginBottom:12 }}>
            <i className="ti ti-archive"/>{arsivAcik?'Arşivi Gizle':`Arşivi Göster (${data.teslim_edilen.length})`}
          </button>
          {arsivAcik && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:12 }}>
              {data.teslim_edilen.map(s=>(
                <div key={s._id||s.id} style={{ opacity:0.7 }}>
                  <SiparisKarti s={s} {...KART_PROPS}/>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {yeniModalAcik && (
        <YeniSiparisModal kategoriler={kategoriler} isMusteri={false} onKapat={()=>setYeniModalAcik(false)} onKaydet={handleYeniSiparis}/>
      )}
    </div>
  );
}
