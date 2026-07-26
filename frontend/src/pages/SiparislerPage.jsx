import { useState, useEffect, useCallback, useRef } from 'react';
import { siparisApi, shopierApi, dosyaApi } from '../api';
import { useToast } from '../context/ToastContext';
import YeniSiparisModal, { KAYNAKLAR, ALT_KATEGORILER, ANA_KATEGORILER, ASAMA_LABEL } from '../components/YeniSiparisModal';

const DURUM = {
  bekliyor:      { label:'Bekliyor',      cls:'badge-gray'  },
  hazirlaniyor:  { label:'Hazırlanıyor',  cls:'badge-amber' },
  hazir:         { label:'Hazır',         cls:'badge-blue'  },
  kargoda:       { label:'Kargoda',       cls:'badge-green' },
  teslim_edildi: { label:'Teslim Edildi', cls:'badge-green' },
};
const KARGO_FIRMA  = ['Yurtiçi','Aras','MNG','PTT','Sürat','Elden Teslim'];
const ODEME_YONTEM = ['Nakit','Havale/EFT','Kredi Kartı','Kapıda Ödeme'];

function kalanGunHesapla(teslimTarihi) {
  if (!teslimTarihi) return null;
  const bugun = new Date(); bugun.setHours(0,0,0,0);
  const teslim = new Date(teslimTarihi + 'T00:00:00'); teslim.setHours(0,0,0,0);
  return Math.ceil((teslim - bugun) / (1000*60*60*24));
}

function kartRengi(kalanGun) {
  if (kalanGun === null) return { bg:'var(--bg2)', border:'var(--border)', label:'', labelColor:'' };
  if (kalanGun <= 0)  return { bg:'rgba(232,72,85,0.07)',  border:'#e84855', label: kalanGun===0?'BUGÜN':'GECİKTİ', labelColor:'#e84855' };
  if (kalanGun === 1) return { bg:'rgba(240,120,0,0.07)',  border:'#f07800', label:'YARIN',    labelColor:'#f07800' };
  if (kalanGun <= 7)  return { bg:'rgba(240,165,0,0.05)',  border:'#f0a500', label:'BU HAFTA', labelColor:'#f0a500' };
  return { bg:'var(--bg2)', border:'var(--border)', label:'', labelColor:'' };
}

function OdemeBadge({ odeme }) {
  if (!odeme?.tutar) return null;
  const { tutar=0, odenen=0, odendi, fatura_kesildi } = odeme;
  if (odendi||odenen>=tutar) return <span className="badge badge-green" style={{fontSize:11}}>💳 {tutar.toLocaleString('tr-TR')}₺ ✓{fatura_kesildi?' · Fatura ✓':''}</span>;
  if (odenen>0) return <span className="badge badge-amber" style={{fontSize:11}}>💳 {odenen.toLocaleString('tr-TR')}₺/{tutar.toLocaleString('tr-TR')}₺</span>;
  return <span className="badge badge-red" style={{fontSize:11}}>💳 {tutar.toLocaleString('tr-TR')}₺ ödenmedi</span>;
}

function HizliPanel({ label, onKapat, children }) {
  const ref = useRef();
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onKapat(); };
    setTimeout(() => document.addEventListener('mousedown', h), 0);
    return () => document.removeEventListener('mousedown', h);
  }, [onKapat]);
  return (
    <div ref={ref} onClick={e=>e.stopPropagation()} style={{ position:'absolute', zIndex:200, top:'calc(100% + 6px)', right:0, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:16, minWidth:260, boxShadow:'0 8px 32px rgba(0,0,0,0.4)' }}>
      <div style={{ fontSize:13, fontWeight:600, marginBottom:12, color:'var(--text)' }}>{label}</div>
      {children}
    </div>
  );
}

function SiparisKarti({ s, onDurumDegis, onSil, onAsamaDegis, onDetayAc, onYukle }) {
  const toast = useToast();
  const [asamaAcik, setAsamaAcik] = useState(false);
  const [acikPanel, setAcikPanel] = useState(null);
  const [odeme, setOdeme] = useState(s.odeme || {});
  const [kargo, setKargo] = useState(s.kargo || {});
  const dosyaInputRef = useRef();
  const sid = s._id || s.id;

  const kalanGun = kalanGunHesapla(s.teslim_tarihi);
  const renk = kartRengi(kalanGun);
  const kaynak = KAYNAKLAR.find(k => k.key === s.kaynak);
  const kategoriLabel = Object.values(ALT_KATEGORILER).flat().find(i => i.key === s.kategori)?.label;
  const durum = DURUM[s.durum] || DURUM.bekliyor;
  const tamamlanan = s.asamalar?.filter(a => a.tamamlandi).length || 0;
  const toplamAsama = s.asamalar?.length || 0;
  const togglePanel = (p) => setAcikPanel(prev => prev===p ? null : p);

  const handleOdemeKaydet = async () => {
    try { await siparisApi.updateOdeme(sid, odeme); toast('Ödeme güncellendi ✓'); setAcikPanel(null); onYukle(); }
    catch { toast('Hata','error'); }
  };
  const handleKargoKaydet = async () => {
    try { await siparisApi.updateKargo(sid, kargo); toast('Kargo güncellendi ✓'); setAcikPanel(null); onYukle(); }
    catch { toast('Hata','error'); }
  };
  const handleDosyaYukle = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const fd = new FormData(); fd.append('dosya', file);
    try { await dosyaApi.yukle(sid, fd); toast('Dosya yüklendi ✓'); onYukle(); }
    catch { toast('Yükleme hatası','error'); }
    finally { e.target.value = ''; }
  };

  return (
    <div style={{
      background: renk.bg,
      border: `1px solid ${renk.border}`,
      borderLeft: `4px solid ${renk.border}`,
      borderRadius: 'var(--radius)',
      padding: '14px 16px',
      marginBottom: 10,
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      gap: 12,
      position: 'relative',
      transition: 'box-shadow 0.15s',
    }}>
      <div style={{ flex:1, minWidth:0 }}>
        {/* Başlık */}
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5, flexWrap:'wrap' }}>
          {renk.label && (
            <span style={{ fontSize:10, fontWeight:800, color:renk.labelColor, letterSpacing:'0.08em', background:`${renk.labelColor}18`, padding:'2px 7px', borderRadius:4, border:`1px solid ${renk.labelColor}40` }}>
              {renk.label}
            </span>
          )}
          <span style={{ fontWeight:700, fontSize:15, color:'var(--text)' }}>{s.musteri_adi} {s.musteri_soyadi}</span>
          <span style={{ fontSize:12, color:'var(--text3)' }}>#{s.siparis_no}</span>
          <span className={`badge ${durum.cls}`}>{durum.label}</span>
          <OdemeBadge odeme={s.odeme}/>
        </div>

        {/* Meta */}
        <div style={{ fontSize:13, color:'var(--text2)', display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:4 }}>
          {kaynak && <span style={{ display:'flex', alignItems:'center', gap:3 }}><i className={`ti ${kaynak.icon}`} style={{ fontSize:13 }}/>{kaynak.label}</span>}
          {kategoriLabel && <><span style={{ color:'var(--border)' }}>·</span><span>{kategoriLabel}</span></>}
          {s.press_sayisi > 0 && <><span style={{ color:'var(--border)' }}>·</span><span><i className="ti ti-tool" style={{ fontSize:12 }}/> {s.press_sayisi} press</span></>}
          {s.kargo?.takip_no && <><span style={{ color:'var(--border)' }}>·</span><span><i className="ti ti-truck" style={{ fontSize:12 }}/> {s.kargo.takip_no}</span></>}
        </div>

        {/* Ürünler */}
        {s.urunler?.length > 0 && s.urunler[0]?.ad && (
          <div style={{ fontSize:13, color:'var(--text2)', marginBottom:4 }}>
            <i className="ti ti-notes" style={{ fontSize:12 }}/> {s.urunler.map((u,i) => <span key={i}>{u.adet>1?`${u.adet}× `:''}{u.ad}</span>)}
          </div>
        )}

        {/* Tarih */}
        {s.teslim_tarihi && (
          <div style={{ fontSize:13, fontWeight:600, color:renk.border || 'var(--text2)', display:'flex', alignItems:'center', gap:5 }}>
            <i className="ti ti-calendar-due" style={{ fontSize:13 }}/>
            {kalanGun === null ? 'Tarih yok' :
             kalanGun < 0 ? `${Math.abs(kalanGun)} gün geçti!` :
             kalanGun === 0 ? 'Bugün teslim!' :
             kalanGun === 1 ? 'Yarın teslim' :
             `${kalanGun} gün kaldı`}
            <span style={{ fontWeight:400, color:'var(--text3)', fontSize:12 }}>
              ({new Date(s.teslim_tarihi+'T00:00:00').toLocaleDateString('tr-TR')})
            </span>
          </div>
        )}

        {/* Aşamalar */}
        {toplamAsama > 0 && (
          <div style={{ marginTop:8 }}>
            <button onClick={()=>setAsamaAcik(a=>!a)} style={{ background:'none', border:'none', color:'var(--text3)', fontSize:12, cursor:'pointer', padding:0, display:'flex', alignItems:'center', gap:6 }}>
              <i className={`ti ti-chevron-${asamaAcik?'up':'down'}`} style={{ fontSize:12 }}/>
              Aşamalar ({tamamlanan}/{toplamAsama})
              <div style={{ width:50, height:3, background:'var(--border)', borderRadius:2, overflow:'hidden' }}>
                <div style={{ height:'100%', background:'var(--accent)', width:`${(tamamlanan/toplamAsama)*100}%` }}/>
              </div>
            </button>
            {asamaAcik && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:8 }}>
                {s.asamalar.map((a,idx) => {
                  const info = ASAMA_LABEL[a.key] || {};
                  return (
                    <button key={idx} onClick={()=>onAsamaDegis(sid, idx)} style={{
                      display:'flex', alignItems:'center', gap:5, padding:'5px 10px', borderRadius:'var(--radius-sm)', fontSize:12, cursor:'pointer',
                      border:`1px solid ${a.tamamlandi?(info.renk||'var(--green)'):'var(--border)'}`,
                      background: a.tamamlandi ? `${info.renk||'var(--green)'}22` : 'var(--bg3)',
                      color: a.tamamlandi ? (info.renk||'var(--green)') : 'var(--text2)',
                    }}>
                      <i className={`ti ${a.tamamlandi?'ti-circle-check':(info.icon||'ti-circle')}`} style={{ fontSize:13 }}/>{a.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sağ: Durum + Butonlar */}
      <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8, flexShrink:0 }}>
        <select className="status-select" value={s.durum} onChange={e=>onDurumDegis(sid, e.target.value)}>
          <option value="bekliyor">Bekliyor</option>
          <option value="hazirlaniyor">Hazırlanıyor</option>
          <option value="hazir">Hazır</option>
          <option value="kargoda">Kargoda</option>
          <option value="teslim_edildi">Teslim Edildi</option>
        </select>
        <div style={{ display:'flex', gap:5, position:'relative' }}>
          {/* Ödeme */}
          <div style={{ position:'relative' }}>
            <button className="btn-icon" onClick={()=>togglePanel('odeme')} title="Ödeme"
              style={{ color: s.odeme?.odendi?'var(--green)':s.odeme?.tutar?'var(--amber)':'var(--text2)' }}>
              <i className="ti ti-coin" style={{ fontSize:15 }}/>
            </button>
            {acikPanel==='odeme' && (
              <HizliPanel label="💳 Ödeme" onKapat={()=>setAcikPanel(null)}>
                <div style={{ display:'flex', gap:8, marginBottom:10 }}>
                  <div style={{ flex:1 }}><div style={{ fontSize:11, color:'var(--text3)', marginBottom:4 }}>Tutar (₺)</div>
                    <input className="form-input" type="number" style={{ padding:'6px 8px', fontSize:13 }} value={odeme.tutar||''} onChange={e=>setOdeme(o=>({...o,tutar:parseFloat(e.target.value)||0}))} placeholder="0"/></div>
                  <div style={{ flex:1 }}><div style={{ fontSize:11, color:'var(--text3)', marginBottom:4 }}>Alınan (₺)</div>
                    <input className="form-input" type="number" style={{ padding:'6px 8px', fontSize:13 }} value={odeme.odenen||''} onChange={e=>setOdeme(o=>({...o,odenen:parseFloat(e.target.value)||0}))} placeholder="0"/></div>
                </div>
                {odeme.tutar>0 && odeme.odenen>0 && odeme.odenen<odeme.tutar && <div style={{ fontSize:12, color:'var(--amber)', marginBottom:8 }}>⚠️ Kalan: {(odeme.tutar-odeme.odenen).toFixed(2)}₺</div>}
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
            <button className="btn-icon" onClick={()=>togglePanel('kargo')} title="Kargo" style={{ color:s.kargo?.takip_no?'var(--accent)':'var(--text2)' }}>
              <i className="ti ti-truck" style={{ fontSize:15 }}/>
            </button>
            {acikPanel==='kargo' && (
              <HizliPanel label="📦 Kargo" onKapat={()=>setAcikPanel(null)}>
                <select className="form-input" style={{ marginBottom:8, padding:'6px 8px', fontSize:13 }} value={kargo.firma||''} onChange={e=>setKargo(k=>({...k,firma:e.target.value}))}><option value="">Firma seç...</option>{KARGO_FIRMA.map(f=><option key={f}>{f}</option>)}</select>
                <input className="form-input" style={{ marginBottom:8, padding:'6px 8px', fontSize:13 }} placeholder="Takip numarası..." value={kargo.takip_no||''} onChange={e=>setKargo(k=>({...k,takip_no:e.target.value}))}/>
                <input className="form-input" type="date" style={{ marginBottom:12, padding:'6px 8px', fontSize:13 }} value={kargo.gonderim_tarihi||''} onChange={e=>setKargo(k=>({...k,gonderim_tarihi:e.target.value}))}/>
                <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center' }} onClick={handleKargoKaydet}>Kaydet</button>
              </HizliPanel>
            )}
          </div>
          {/* Dosya */}
          <button className="btn-icon" onClick={()=>dosyaInputRef.current?.click()} title="Dosya Yükle"><i className="ti ti-paperclip" style={{ fontSize:15 }}/></button>
          <input ref={dosyaInputRef} type="file" style={{ display:'none' }} accept=".jpg,.jpeg,.png,.pdf,.ai,.eps,.svg,.zip" onChange={handleDosyaYukle}/>
          {/* Detay */}
          <button className="btn-icon" onClick={()=>onDetayAc(s)} title="Detay"><i className="ti ti-dots" style={{ fontSize:15 }}/></button>
          {/* Sil */}
          <button className="btn-icon" onClick={()=>onSil(sid)} title="Sil"><i className="ti ti-trash" style={{ fontSize:15 }}/></button>
        </div>
      </div>
    </div>
  );
}

export default function SiparislerPage() {
  const toast = useToast();
  const [data, setData] = useState({ aktif:[], teslim_edilen:[] });
  const [filtre, setFiltre] = useState('hepsi');
  const [yeniModalAcik, setYeniModalAcik] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [arsivAcik, setArsivAcik] = useState(false);
  const [shopierYukleniyor, setShopierYukleniyor] = useState(false);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    try {
      const r = await siparisApi.getAll();
      // kalanGun ekle
      const bugun = new Date(); bugun.setHours(0,0,0,0);
      const withKalan = (list) => list.map(s => {
        const kg = s.teslim_tarihi ? Math.ceil((new Date(s.teslim_tarihi+'T00:00:00')-bugun)/(1000*60*60*24)) : null;
        return { ...s, kalan_gun: kg };
      });
      setData({ aktif: withKalan(r.data.aktif), teslim_edilen: r.data.teslim_edilen });
    } catch { toast('Yüklenemedi','error'); }
    finally { setYukleniyor(false); }
  }, []);

  useEffect(() => { yukle(); }, [yukle]);

  const handleDurumDegis = async (id, durum) => {
    try { await siparisApi.updateDurum(id, durum); yukle(); } catch { toast('Hata','error'); }
  };
  const handleAsamaDegis = async (id, idx) => {
    const s = [...data.aktif,...data.teslim_edilen].find(s=>(s._id||s.id)===id); if (!s) return;
    const asamalar = s.asamalar.map((a,i)=>i===idx?{...a,tamamlandi:!a.tamamlandi}:a);
    try { await siparisApi.update(id,{...s,asamalar}); yukle(); } catch { toast('Hata','error'); }
  };
  const handleYeniSiparis = async (fd) => {
    try { await siparisApi.create(fd); setYeniModalAcik(false); toast('Sipariş oluşturuldu ✓'); yukle(); }
    catch { toast('Hata','error'); }
  };
  const handleSil = async (id) => {
    if (!confirm('Silinsin mi?')) return;
    try { await siparisApi.delete(id); toast('Silindi'); yukle(); } catch { toast('Hata','error'); }
  };
  const handleShopier = async () => {
    setShopierYukleniyor(true);
    try { const r = await shopierApi.cek(); toast(r.data.mesaj); yukle(); }
    catch (e) { toast(e.response?.data?.hata||'Shopier hatası','error'); }
    finally { setShopierYukleniyor(false); }
  };

  const filtrelenmis = data.aktif.filter(s => {
    if (filtre==='hepsi') return true;
    if (filtre==='bugun') return s.kalan_gun !== null && s.kalan_gun <= 0;
    if (filtre==='hafta')  return s.kalan_gun !== null && s.kalan_gun > 0 && s.kalan_gun <= 7;
    if (filtre==='odeme')  return !s.odeme?.odendi && s.odeme?.tutar > 0;
    return s.durum === filtre;
  }).sort((a,b) => {
    const ta = a.teslim_tarihi ? new Date(a.teslim_tarihi) : new Date('2099-01-01');
    const tb = b.teslim_tarihi ? new Date(b.teslim_tarihi) : new Date('2099-01-01');
    return ta - tb;
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
            <i className="ti ti-refresh"/>{shopierYukleniyor?'Çekiliyor...':'Shopier\'den Çek'}
          </button>
          <button className="btn btn-primary" onClick={()=>setYeniModalAcik(true)}>
            <i className="ti ti-plus"/> Yeni Sipariş
          </button>
        </div>
      </div>

      {/* Filtreler */}
      <div className="filter-row">
        {[
          ['hepsi','Tümü'],
          ['bugun', bugunSayisi>0?`🔴 Bugün / Gecikmiş (${bugunSayisi})`:'🔴 Bugün'],
          ['hafta','🟡 Bu Hafta'],
          ['bekliyor','Bekliyor'],
          ['hazirlaniyor','Hazırlanıyor'],
          ['hazir','Hazır'],
          ['kargoda','Kargoda'],
          ['odeme', odemeSayisi>0?`💳 Ödeme (${odemeSayisi})`:'💳 Ödeme'],
        ].map(([key,label]) => (
          <button key={key} className={`filter-btn ${filtre===key?'active':''}`} onClick={()=>setFiltre(key)}>{label}</button>
        ))}
      </div>

      {/* Renk açıklaması */}
      <div style={{ display:'flex', gap:16, marginBottom:14, fontSize:12, color:'var(--text3)' }}>
        <span style={{ display:'flex', alignItems:'center', gap:5 }}><span style={{ width:12, height:12, borderRadius:2, background:'rgba(232,72,85,0.3)', display:'inline-block' }}/>Bugün / Gecikmiş</span>
        <span style={{ display:'flex', alignItems:'center', gap:5 }}><span style={{ width:12, height:12, borderRadius:2, background:'rgba(240,120,0,0.3)', display:'inline-block' }}/>Yarın</span>
        <span style={{ display:'flex', alignItems:'center', gap:5 }}><span style={{ width:12, height:12, borderRadius:2, background:'rgba(240,165,0,0.2)', display:'inline-block' }}/>Bu Hafta</span>
      </div>

      {yukleniyor ? (
        <div style={{ textAlign:'center', color:'var(--text2)', padding:40 }}>Yükleniyor...</div>
      ) : filtrelenmis.length === 0 ? (
        <div style={{ textAlign:'center', color:'var(--text3)', padding:40 }}>
          <i className="ti ti-clipboard-off" style={{ fontSize:32, display:'block', marginBottom:8 }}/>Sipariş bulunamadı
        </div>
      ) : filtrelenmis.map(s => (
        <SiparisKarti key={s._id||s.id} s={s}
          onDurumDegis={handleDurumDegis} onSil={handleSil}
          onAsamaDegis={handleAsamaDegis} onDetayAc={()=>{}} onYukle={yukle}/>
      ))}

      {/* Arşiv */}
      {data.teslim_edilen?.length > 0 && (
        <div style={{ marginTop:24 }}>
          <button onClick={()=>setArsivAcik(a=>!a)} className="btn btn-secondary" style={{ width:'100%', justifyContent:'center' }}>
            <i className="ti ti-archive"/>{arsivAcik?'Arşivi Gizle':`Arşivi Göster (${data.teslim_edilen.length})`}
          </button>
          {arsivAcik && data.teslim_edilen.map(s => (
            <div key={s._id||s.id} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'12px 16px', marginTop:8, opacity:0.55, display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontWeight:600 }}>{s.musteri_adi} {s.musteri_soyadi}</span>
              <span style={{ fontSize:12, color:'var(--text3)' }}>#{s.siparis_no}</span>
              <span className="badge badge-green">Teslim Edildi</span>
              <OdemeBadge odeme={s.odeme}/>
              <div style={{ marginLeft:'auto', display:'flex', gap:5 }}>
                <button className="btn-icon" onClick={()=>handleSil(s._id||s.id)}><i className="ti ti-trash" style={{ fontSize:15 }}/></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {yeniModalAcik && <YeniSiparisModal onKapat={()=>setYeniModalAcik(false)} onKaydet={handleYeniSiparis}/>}
    </div>
  );
}
