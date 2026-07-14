import { useState, useEffect, useCallback, useRef } from 'react';
import { siparisApi, shopierApi, dosyaApi } from '../api';
import { useToast } from '../context/ToastContext';
import YeniSiparisModal, { KAYNAKLAR, KATEGORILER, ASAMA_LABEL } from '../components/YeniSiparisModal';
import SiparisDetayModal from '../components/SiparisDetayModal';

const DURUM = {
  bekliyor:      { label: 'Bekliyor',      cls: 'badge-gray'  },
  hazirlaniyor:  { label: 'Hazırlanıyor',  cls: 'badge-amber' },
  hazir:         { label: 'Hazır',         cls: 'badge-blue'  },
  kargoda:       { label: 'Kargoda',       cls: 'badge-green' },
  teslim_edildi: { label: 'Teslim Edildi', cls: 'badge-green' },
};

const KARGO_FIRMA = ['Yurtiçi', 'Aras', 'MNG', 'PTT', 'Sürat', 'Elden Teslim'];
const ODEME_YONTEM = ['Nakit', 'Havale/EFT', 'Kredi Kartı', 'Kapıda Ödeme'];

function deadlineLabel(kalanGun) {
  if (kalanGun === null || kalanGun === undefined) return { text: 'Tarih yok', cls: '' };
  if (kalanGun < 0)   return { text: `${Math.abs(kalanGun)} gün geçti!`, cls: 'acil' };
  if (kalanGun === 0) return { text: 'Bugün teslim!', cls: 'acil' };
  if (kalanGun === 1) return { text: 'Yarın teslim',  cls: 'acil' };
  if (kalanGun <= 4)  return { text: `${kalanGun} gün kaldı`, cls: 'yakin' };
  return { text: `${kalanGun} gün kaldı`, cls: 'normal' };
}

function OdemeBadge({ odeme }) {
  if (!odeme?.tutar) return null;
  const { tutar = 0, odenen = 0, odendi, fatura_kesildi } = odeme;
  if (odendi || odenen >= tutar)
    return <span className="badge badge-green" style={{fontSize:11}}>💳 {tutar.toLocaleString('tr-TR')}₺ ✓{fatura_kesildi ? ' · Fatura ✓' : ''}</span>;
  if (odenen > 0)
    return <span className="badge badge-amber" style={{fontSize:11}}>💳 {odenen.toLocaleString('tr-TR')}₺/{tutar.toLocaleString('tr-TR')}₺</span>;
  return <span className="badge badge-red" style={{fontSize:11}}>💳 {tutar.toLocaleString('tr-TR')}₺ ödenmedi</span>;
}

// Kart üzerindeki hızlı popup bileşeni
function HizliPanel({ label, onKapat, children }) {
  const ref = useRef();
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onKapat(); };
    setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => document.removeEventListener('mousedown', handler);
  }, [onKapat]);
  return (
    <div ref={ref} style={{
      position:'absolute', zIndex:200, top:'calc(100% + 6px)', right:0,
      background:'var(--bg2)', border:'1px solid var(--border)',
      borderRadius:'var(--radius)', padding:16, minWidth:260,
      boxShadow:'0 8px 32px rgba(0,0,0,0.4)',
    }} onClick={e => e.stopPropagation()}>
      <div style={{fontSize:13, fontWeight:600, marginBottom:12, color:'var(--text)'}}>{label}</div>
      {children}
    </div>
  );
}

function SiparisKarti({ s, onDurumDegis, onSil, onAsamaDegis, onDetayAc, onYukle }) {
  const toast = useToast();
  const [asamaAcik, setAsamaAcik] = useState(false);
  const [acikPanel, setAcikPanel] = useState(null); // 'odeme' | 'kargo' | 'dosya'
  const [odeme, setOdeme] = useState(s.odeme || {});
  const [kargo, setKargo] = useState(s.kargo || {});
  const dosyaInputRef = useRef();

  const dl = deadlineLabel(s.kalan_gun);
  const kaynak = KAYNAKLAR.find(k => k.key === s.kaynak);
  const kategoriLabel = KATEGORILER.flatMap(g => g.items).find(i => i.key === s.kategori)?.label;
  const durum = DURUM[s.durum] || DURUM.bekliyor;
  const tamamlananAsama = s.asamalar?.filter(a => a.tamamlandi).length || 0;
  const toplamAsama = s.asamalar?.length || 0;

  const togglePanel = (panel) => setAcikPanel(p => p === panel ? null : panel);

  const handleOdemeKaydet = async () => {
    try { await siparisApi.updateOdeme(s.id, odeme); toast('Ödeme güncellendi ✓'); setAcikPanel(null); onYukle(); }
    catch { toast('Hata', 'error'); }
  };

  const handleKargoKaydet = async () => {
    try { await siparisApi.updateKargo(s.id, kargo); toast('Kargo güncellendi ✓'); setAcikPanel(null); onYukle(); }
    catch { toast('Hata', 'error'); }
  };

  const handleDosyaYukle = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const fd = new FormData(); fd.append('dosya', file);
    try { await dosyaApi.yukle(s.id, fd); toast('Dosya yüklendi ✓'); onYukle(); }
    catch { toast('Yükleme hatası', 'error'); }
    finally { e.target.value = ''; }
  };

  return (
    <div className={`siparis-card ${s.oncelik}`} style={{ position:'relative' }}>
      <div style={{ flex:1, minWidth:0 }}>
        {/* Başlık satırı */}
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5, flexWrap:'wrap' }}>
          <span className="siparis-musteri">{s.musteri_adi} {s.musteri_soyadi}</span>
          <span className="siparis-no">#{s.siparis_no}</span>
          <span className={`badge ${durum.cls}`}>{durum.label}</span>
          <OdemeBadge odeme={s.odeme} />
        </div>

        {/* Meta bilgiler */}
        <div className="siparis-meta" style={{ gap:10, flexWrap:'wrap' }}>
          {kaynak && <span style={{display:'flex',alignItems:'center',gap:4}}>
            <i className={`ti ${kaynak.icon}`} style={{fontSize:14}}/>{kaynak.label}
          </span>}
          {kategoriLabel && <><span style={{color:'var(--text3)'}}>·</span><span>{kategoriLabel}</span></>}
          {s.kargo?.takip_no && <><span style={{color:'var(--text3)'}}>·</span>
            <span style={{display:'flex',alignItems:'center',gap:4}}>
              <i className="ti ti-truck" style={{fontSize:13}}/>{s.kargo.takip_no}
            </span></>}
        </div>

        {/* Ürün */}
        {s.urunler?.length > 0 && s.urunler[0]?.ad && (
          <div className="siparis-meta" style={{marginTop:4}}>
            <i className="ti ti-notes" style={{fontSize:13}}/>
            {s.urunler.map((u,i) => <span key={i}>{u.adet>1?`${u.adet}× `:''}{u.ad}</span>)}
          </div>
        )}

        {/* Teslim tarihi */}
        {dl.text && (
          <div className="deadline-row" style={{marginTop:6}}>
            <i className="ti ti-calendar-due" style={{fontSize:14, color:dl.cls==='acil'?'var(--red)':dl.cls==='yakin'?'var(--amber)':'var(--green)'}}/>
            <span className={`deadline-text ${dl.cls}`}>{dl.text}</span>
            {s.teslim_tarihi && <span style={{fontSize:12,color:'var(--text3)'}}>
              ({new Date(s.teslim_tarihi+'T00:00:00').toLocaleDateString('tr-TR')})
            </span>}
          </div>
        )}

        {/* Aşamalar */}
        {toplamAsama > 0 && (
          <div style={{marginTop:8}}>
            <button onClick={()=>setAsamaAcik(a=>!a)} style={{background:'none',border:'none',color:'var(--text3)',fontSize:12,cursor:'pointer',padding:0,display:'flex',alignItems:'center',gap:6}}>
              <i className={`ti ti-chevron-${asamaAcik?'up':'down'}`} style={{fontSize:12}}/>
              Aşamalar ({tamamlananAsama}/{toplamAsama})
              <div style={{width:60,height:3,background:'var(--border)',borderRadius:2,overflow:'hidden'}}>
                <div style={{height:'100%',background:'var(--accent)',width:`${(tamamlananAsama/toplamAsama)*100}%`,transition:'width 0.3s'}}/>
              </div>
            </button>
            {asamaAcik && (
              <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:8}}>
                {s.asamalar.map((asama,idx) => {
                  const info = ASAMA_LABEL[asama.key]||{};
                  return (
                    <button key={idx} onClick={()=>onAsamaDegis(s.id,idx)} style={{
                      display:'flex',alignItems:'center',gap:5,padding:'5px 10px',
                      borderRadius:'var(--radius-sm)',fontSize:12,cursor:'pointer',
                      border:`1px solid ${asama.tamamlandi?(info.renk||'var(--green)'):'var(--border)'}`,
                      background:asama.tamamlandi?`${info.renk||'var(--green)'}22`:'var(--bg3)',
                      color:asama.tamamlandi?(info.renk||'var(--green)'):'var(--text2)',
                    }}>
                      <i className={`ti ${asama.tamamlandi?'ti-circle-check':(info.icon||'ti-circle')}`} style={{fontSize:13}}/>
                      {asama.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* SAĞ TARAF: Durum + Butonlar */}
      <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:8,flexShrink:0}}>
        <select className="status-select" value={s.durum} onChange={e=>onDurumDegis(s.id,e.target.value)}>
          <option value="bekliyor">Bekliyor</option>
          <option value="hazirlaniyor">Hazırlanıyor</option>
          <option value="hazir">Hazır</option>
          <option value="kargoda">Kargoda</option>
          <option value="teslim_edildi">Teslim Edildi</option>
        </select>

        {/* Hızlı aksiyon butonları */}
        <div style={{display:'flex',gap:5,position:'relative'}}>
          {/* Ödeme butonu */}
          <div style={{position:'relative'}}>
            <button className="btn-icon" onClick={()=>togglePanel('odeme')} title="Ödeme"
              style={{color: s.odeme?.odendi ? 'var(--green)' : s.odeme?.tutar ? 'var(--amber)' : 'var(--text2)'}}>
              <i className="ti ti-coin" style={{fontSize:15}}/>
            </button>
            {acikPanel === 'odeme' && (
              <HizliPanel label="💳 Ödeme" onKapat={()=>setAcikPanel(null)}>
                <div style={{display:'flex',gap:8,marginBottom:10}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:11,color:'var(--text3)',marginBottom:4}}>Tutar (₺)</div>
                    <input className="form-input" type="number" style={{padding:'6px 8px',fontSize:13}}
                      value={odeme.tutar||''} onChange={e=>setOdeme(o=>({...o,tutar:parseFloat(e.target.value)||0}))} placeholder="0"/>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:11,color:'var(--text3)',marginBottom:4}}>Alınan (₺)</div>
                    <input className="form-input" type="number" style={{padding:'6px 8px',fontSize:13}}
                      value={odeme.odenen||''} onChange={e=>setOdeme(o=>({...o,odenen:parseFloat(e.target.value)||0}))} placeholder="0"/>
                  </div>
                </div>
                {odeme.tutar>0 && odeme.odenen>0 && odeme.odenen<odeme.tutar && (
                  <div style={{fontSize:12,color:'var(--amber)',marginBottom:8}}>
                    ⚠️ Kalan: {(odeme.tutar-odeme.odenen).toFixed(2)}₺
                  </div>
                )}
                <select className="form-input" style={{marginBottom:10,padding:'6px 8px',fontSize:13}}
                  value={odeme.yontem||''} onChange={e=>setOdeme(o=>({...o,yontem:e.target.value}))}>
                  <option value="">Yöntem seç...</option>
                  {ODEME_YONTEM.map(y=><option key={y}>{y}</option>)}
                </select>
                <div style={{display:'flex',gap:12,marginBottom:12}}>
                  <label style={{display:'flex',alignItems:'center',gap:6,fontSize:13,cursor:'pointer'}}>
                    <input type="checkbox" checked={odeme.odendi||false}
                      onChange={e=>setOdeme(o=>({...o,odendi:e.target.checked}))}/>
                    <span style={{color:odeme.odendi?'var(--green)':'var(--text)'}}>Ödendi ✓</span>
                  </label>
                  <label style={{display:'flex',alignItems:'center',gap:6,fontSize:13,cursor:'pointer'}}>
                    <input type="checkbox" checked={odeme.fatura_kesildi||false}
                      onChange={e=>setOdeme(o=>({...o,fatura_kesildi:e.target.checked}))}/>
                    <span style={{color:odeme.fatura_kesildi?'var(--green)':'var(--text)'}}>Fatura ✓</span>
                  </label>
                </div>
                <button className="btn btn-primary" style={{width:'100%',justifyContent:'center'}} onClick={handleOdemeKaydet}>
                  Kaydet
                </button>
              </HizliPanel>
            )}
          </div>

          {/* Kargo butonu */}
          <div style={{position:'relative'}}>
            <button className="btn-icon" onClick={()=>togglePanel('kargo')} title="Kargo"
              style={{color: s.kargo?.takip_no ? 'var(--accent)' : 'var(--text2)'}}>
              <i className="ti ti-truck" style={{fontSize:15}}/>
            </button>
            {acikPanel === 'kargo' && (
              <HizliPanel label="📦 Kargo" onKapat={()=>setAcikPanel(null)}>
                <select className="form-input" style={{marginBottom:8,padding:'6px 8px',fontSize:13}}
                  value={kargo.firma||''} onChange={e=>setKargo(k=>({...k,firma:e.target.value}))}>
                  <option value="">Firma seç...</option>
                  {KARGO_FIRMA.map(f=><option key={f}>{f}</option>)}
                </select>
                <input className="form-input" style={{marginBottom:8,padding:'6px 8px',fontSize:13}}
                  placeholder="Takip numarası..." value={kargo.takip_no||''}
                  onChange={e=>setKargo(k=>({...k,takip_no:e.target.value}))}/>
                <input className="form-input" type="date" style={{marginBottom:12,padding:'6px 8px',fontSize:13}}
                  value={kargo.gonderim_tarihi||''} onChange={e=>setKargo(k=>({...k,gonderim_tarihi:e.target.value}))}/>
                <button className="btn btn-primary" style={{width:'100%',justifyContent:'center'}} onClick={handleKargoKaydet}>
                  Kaydet
                </button>
              </HizliPanel>
            )}
          </div>

          {/* Dosya yükleme butonu */}
          <div style={{position:'relative'}}>
            <button className="btn-icon" onClick={()=>dosyaInputRef.current?.click()} title="Dosya Yükle">
              <i className="ti ti-paperclip" style={{fontSize:15}}/>
            </button>
            <input ref={dosyaInputRef} type="file" style={{display:'none'}}
              accept=".jpg,.jpeg,.png,.pdf,.ai,.eps,.svg,.zip"
              onChange={handleDosyaYukle}/>
          </div>

          {/* Detay / Düzenle */}
          <button className="btn-icon" onClick={()=>onDetayAc(s)} title="Tüm Detaylar">
            <i className="ti ti-dots" style={{fontSize:15}}/>
          </button>

          {/* Sil */}
          <button className="btn-icon" onClick={()=>onSil(s.id)} title="Sil">
            <i className="ti ti-trash" style={{fontSize:15}}/>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SiparislerPage() {
  const toast = useToast();
  const [data, setData] = useState({ aktif: [], teslim_edilen: [] });
  const [filtre, setFiltre] = useState('hepsi');
  const [yeniModalAcik, setYeniModalAcik] = useState(false);
  const [detaySiparis, setDetaySiparis] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [shopierYukleniyor, setShopierYukleniyor] = useState(false);
  const [arsivAcik, setArsivAcik] = useState(false);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    try { const r = await siparisApi.getAll(); setData(r.data); }
    catch { toast('Siparişler yüklenemedi', 'error'); }
    finally { setYukleniyor(false); }
  }, []);

  useEffect(() => { yukle(); }, [yukle]);

  const handleDurumDegis = async (id, durum) => {
    try { await siparisApi.updateDurum(id, durum); yukle(); }
    catch { toast('Durum güncellenemedi', 'error'); }
  };

  const handleAsamaDegis = async (id, idx) => {
    const s = data.aktif.find(s => s.id === id); if (!s) return;
    const asamalar = s.asamalar.map((a,i) => i===idx ? {...a,tamamlandi:!a.tamamlandi} : a);
    try { await siparisApi.update(id, {...s, asamalar}); yukle(); }
    catch { toast('Güncelleme hatası', 'error'); }
  };

  const handleYeniSiparis = async (formData) => {
    try { await siparisApi.create(formData); setYeniModalAcik(false); toast('Sipariş oluşturuldu ✓'); yukle(); }
    catch { toast('Sipariş oluşturulamadı', 'error'); }
  };

  const handleShopierCek = async () => {
    setShopierYukleniyor(true);
    try { const r = await shopierApi.cek(); toast(r.data.mesaj); yukle(); }
    catch (err) { toast(err.response?.data?.hata || 'Shopier bağlantı hatası', 'error'); }
    finally { setShopierYukleniyor(false); }
  };

  const handleSil = async (id) => {
    if (!confirm('Bu siparişi silmek istediğinize emin misiniz?')) return;
    try { await siparisApi.delete(id); toast('Sipariş silindi'); yukle(); }
    catch { toast('Silinemedi', 'error'); }
  };

  const filtrelenmis = data.aktif.filter(s => {
    if (filtre === 'hepsi') return true;
    if (filtre === 'acil') return s.oncelik === 'acil';
    if (filtre === 'yakin') return s.oncelik === 'yakin';
    if (filtre === 'odeme') return !s.odeme?.odendi && s.odeme?.tutar > 0;
    return s.durum === filtre;
  });

  const aciller = filtrelenmis.filter(s => s.oncelik === 'acil');
  const yakinlar = filtrelenmis.filter(s => s.oncelik === 'yakin');
  const normaller = filtrelenmis.filter(s => s.oncelik === 'normal');
  const odemeBekleyen = data.aktif.filter(s => !s.odeme?.odendi && s.odeme?.tutar > 0).length;

  const renderGrup = (baslik, emoji, liste) => {
    if (!liste.length) return null;
    return (<>
      <div className="section-divider">{emoji} {baslik} ({liste.length})</div>
      {liste.map(s => <SiparisKarti key={s.id} s={s}
        onDurumDegis={handleDurumDegis} onSil={handleSil}
        onAsamaDegis={handleAsamaDegis} onDetayAc={setDetaySiparis} onYukle={yukle}/>)}
    </>);
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title">📦 Sipariş Takibi</div>
        <div style={{display:'flex',gap:8}}>
          <button className="btn btn-secondary" onClick={handleShopierCek} disabled={shopierYukleniyor}>
            <i className="ti ti-refresh"/>{shopierYukleniyor ? 'Çekiliyor...' : "Shopier'den Çek"}
          </button>
          <button className="btn btn-primary" onClick={() => setYeniModalAcik(true)}>
            <i className="ti ti-plus"/> Yeni Sipariş
          </button>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-card"><div className="stat-num">{data.aktif.length}</div><div className="stat-label">Aktif Sipariş</div></div>
        <div className="stat-card"><div className="stat-num" style={{color:'var(--red)'}}>{data.aktif.filter(s=>s.kalan_gun!==null&&s.kalan_gun<=0).length}</div><div className="stat-label">Bugün / Gecikmiş</div></div>
        <div className="stat-card"><div className="stat-num" style={{color:'var(--amber)'}}>{data.aktif.filter(s=>s.kalan_gun!==null&&s.kalan_gun>0&&s.kalan_gun<=7).length}</div><div className="stat-label">Bu Hafta</div></div>
        <div className="stat-card"><div className="stat-num" style={{color:'var(--green)'}}>{data.aktif.filter(s=>s.durum==='hazir').length}</div><div className="stat-label">Hazır</div></div>
      </div>

      <div className="filter-row">
        {[
          ['hepsi','Tümü'],['acil','🔴 Acil'],['yakin','🟡 Bu hafta'],
          ['bekliyor','Bekliyor'],['hazirlaniyor','Hazırlanıyor'],
          ['hazir','Hazır'],['kargoda','Kargoda'],
          ['odeme', odemeBekleyen > 0 ? `💳 Ödeme (${odemeBekleyen})` : '💳 Ödeme'],
        ].map(([key,label]) => (
          <button key={key} className={`filter-btn ${filtre===key?'active':''}`}
            onClick={()=>setFiltre(key)}>{label}</button>
        ))}
      </div>

      {yukleniyor ? (
        <div style={{textAlign:'center',color:'var(--text2)',padding:40}}>Yükleniyor...</div>
      ) : filtrelenmis.length === 0 ? (
        <div style={{textAlign:'center',color:'var(--text3)',padding:40}}>
          <i className="ti ti-clipboard-off" style={{fontSize:32,display:'block',marginBottom:8}}/>
          Sipariş bulunamadı
        </div>
      ) : filtre === 'hepsi' ? (<>
        {renderGrup('Acil — bugün ve yarın','🔴',aciller)}
        {renderGrup('Bu hafta','🟡',yakinlar)}
        {renderGrup('Sonraki hafta ve sonrası','🟢',normaller)}
      </>) : (
        filtrelenmis.map(s => <SiparisKarti key={s.id} s={s}
          onDurumDegis={handleDurumDegis} onSil={handleSil}
          onAsamaDegis={handleAsamaDegis} onDetayAc={setDetaySiparis} onYukle={yukle}/>)
      )}

      {data.teslim_edilen?.length > 0 && (
        <div style={{marginTop:24}}>
          <button onClick={()=>setArsivAcik(a=>!a)} className="btn btn-secondary" style={{width:'100%',justifyContent:'center'}}>
            <i className="ti ti-archive"/>
            {arsivAcik ? 'Arşivi Gizle' : `Arşivi Göster (${data.teslim_edilen.length})`}
          </button>
          {arsivAcik && data.teslim_edilen.map(s => (
            <div key={s.id} className="siparis-card" style={{opacity:0.55,marginTop:8,borderLeftColor:'var(--border)'}}>
              <div>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <span className="siparis-musteri">{s.musteri_adi} {s.musteri_soyadi}</span>
                  <span className="siparis-no">#{s.siparis_no}</span>
                  <span className="badge badge-green">Teslim Edildi</span>
                  <OdemeBadge odeme={s.odeme}/>
                </div>
                {s.teslim_edildi_tarihi && (
                  <div style={{fontSize:12,color:'var(--text3)',marginTop:4}}>
                    {new Date(s.teslim_edildi_tarihi).toLocaleDateString('tr-TR')}
                  </div>
                )}
              </div>
              <div style={{display:'flex',gap:5}}>
                <button className="btn-icon" onClick={()=>setDetaySiparis(s)} title="Detay / Düzenle">
                  <i className="ti ti-dots" style={{fontSize:15}}/>
                </button>
                <button className="btn-icon" onClick={()=>handleSil(s.id)} title="Sil">
                  <i className="ti ti-trash" style={{fontSize:15}}/>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {yeniModalAcik && (
        <YeniSiparisModal onKapat={()=>setYeniModalAcik(false)} onKaydet={handleYeniSiparis}/>
      )}
      {detaySiparis && (
        <SiparisDetayModal siparis={detaySiparis} onKapat={()=>setDetaySiparis(null)}
          onGuncelle={()=>{ yukle(); setDetaySiparis(null); }}/>
      )}
    </div>
  );
}
