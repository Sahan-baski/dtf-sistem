import { useState, useEffect, useCallback } from 'react';
import { gorevApi } from '../api';
import { useToast } from '../context/ToastContext';

function kalanGun(tarih) {
  if (!tarih) return null;
  const b = new Date(); b.setHours(0,0,0,0);
  return Math.ceil((new Date(tarih+'T00:00:00') - b) / 864e5);
}

export default function GorevlerPage() {
  const toast = useToast();
  const [gorevler, setGorevler] = useState([]);
  const [yeniBaslik, setYeniBaslik] = useState('');
  const [yeniTarih, setYeniTarih] = useState('');
  const [yeniOncelik, setYeniOncelik] = useState('normal');
  const [formAcik, setFormAcik] = useState(false);

  const yukle = useCallback(async () => {
    try { setGorevler((await gorevApi.getAll()).data); } catch {}
  }, []);

  useEffect(() => { yukle(); }, [yukle]);

  const ekle = async (e) => {
    e.preventDefault();
    if (!yeniBaslik.trim()) return;
    try {
      await gorevApi.create({ baslik: yeniBaslik.trim(), son_tarih: yeniTarih||undefined, oncelik: yeniOncelik });
      setYeniBaslik(''); setYeniTarih(''); setYeniOncelik('normal'); setFormAcik(false);
      yukle();
    } catch { toast('Hata','error'); }
  };

  const toggle = async (id) => { try { await gorevApi.toggleTamamla(id); yukle(); } catch { toast('Hata','error'); } };
  const sil    = async (id) => { try { await gorevApi.delete(id); yukle(); } catch { toast('Hata','error'); } };

  const bekleyenler = gorevler.filter(g => !g.tamamlandi);
  const tamamlananlar = gorevler.filter(g => g.tamamlandi);
  const bugunStr = new Date().toISOString().split('T')[0];

  const TarihBadge = ({ tarih }) => {
    if (!tarih) return null;
    const kg = kalanGun(tarih);
    const renk = kg < 0 ? 'var(--red)' : kg === 0 ? 'var(--amber)' : 'var(--text3)';
    const label = kg < 0 ? `${Math.abs(kg)} gün geçti` : kg === 0 ? 'Bugün!' : kg === 1 ? 'Yarın' : new Date(tarih+'T00:00:00').toLocaleDateString('tr-TR',{day:'numeric',month:'short'});
    return (
      <span style={{ fontSize:11, color:renk, display:'flex', alignItems:'center', gap:3, fontWeight: kg<=0?700:400 }}>
        <i className="ti ti-calendar" style={{ fontSize:11 }}/>{label}
      </span>
    );
  };

  const oncelikRenk = { yuksek:'var(--red)', normal:'var(--indigo)', dusuk:'var(--text3)' };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">✅ Görevler</div>
          <div className="page-sub">{bekleyenler.length} bekleyen görev</div>
        </div>
        <button className="btn btn-primary" onClick={()=>setFormAcik(a=>!a)}>
          <i className="ti ti-plus"/> Görev Ekle
        </button>
      </div>

      {/* Yeni görev formu */}
      {formAcik && (
        <div className="card" style={{ marginBottom:16, padding:'18px 20px', borderTop:'3px solid var(--indigo)' }}>
          <form onSubmit={ekle}>
            <div className="form-row" style={{ alignItems:'flex-end' }}>
              <div className="form-group" style={{ flex:2, marginBottom:0 }}>
                <label className="form-label">Görev</label>
                <input className="form-input" value={yeniBaslik} onChange={e=>setYeniBaslik(e.target.value)} placeholder="Ne yapılacak?" autoFocus/>
              </div>
              <div className="form-group" style={{ marginBottom:0 }}>
                <label className="form-label">Son Tarih</label>
                <input className="form-input" type="date" value={yeniTarih} onChange={e=>setYeniTarih(e.target.value)}/>
              </div>
              <div className="form-group" style={{ marginBottom:0 }}>
                <label className="form-label">Öncelik</label>
                <select className="form-input" value={yeniOncelik} onChange={e=>setYeniOncelik(e.target.value)}>
                  <option value="yuksek">🔴 Yüksek</option>
                  <option value="normal">🔵 Normal</option>
                  <option value="dusuk">⚪ Düşük</option>
                </select>
              </div>
              <div style={{ display:'flex', gap:8, marginBottom:0, flexShrink:0 }}>
                <button type="submit" className="btn btn-primary"><i className="ti ti-check"/>Ekle</button>
                <button type="button" className="btn btn-secondary" onClick={()=>setFormAcik(false)}>İptal</button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Bugün son tarihi olan görevler */}
      {bekleyenler.filter(g=>g.son_tarih===bugunStr).length > 0 && (
        <div style={{ marginBottom:16, padding:'10px 14px', background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:'var(--r-xs)' }}>
          <div style={{ fontSize:12, fontWeight:700, color:'var(--amber)', marginBottom:8 }}>
            <i className="ti ti-calendar-due" style={{ marginRight:6 }}/>Bugün son tarihi olan görevler
          </div>
          {bekleyenler.filter(g=>g.son_tarih===bugunStr).map(g=>(
            <div key={g._id} style={{ fontSize:13, color:'var(--text)', padding:'3px 0' }}>
              <i className="ti ti-point" style={{ color:'var(--amber)', marginRight:6 }}/>{g.baslik}
            </div>
          ))}
        </div>
      )}

      {/* Bekleyen görevler */}
      {bekleyenler.length===0 ? (
        <div style={{ textAlign:'center', padding:40, color:'var(--text3)', background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--r)' }}>
          <i className="ti ti-circle-check" style={{ fontSize:40, display:'block', marginBottom:10, color:'var(--green)' }}/>
          Tüm görevler tamamlandı!
        </div>
      ) : bekleyenler.map(g => {
        const kg = kalanGun(g.son_tarih);
        const gecikti = kg !== null && kg < 0;
        return (
          <div key={g._id} style={{ background:'var(--bg2)', border:`1px solid ${gecikti?'rgba(239,68,68,0.4)':g.son_tarih===bugunStr?'rgba(245,158,11,0.4)':'var(--border)'}`, borderRadius:'var(--r-sm)', padding:'12px 16px', marginBottom:8, display:'flex', alignItems:'center', gap:12 }}>
            <div onClick={()=>toggle(g._id)} style={{ width:22, height:22, borderRadius:7, border:`2px solid ${oncelikRenk[g.oncelik]||'var(--border2)'}`, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0, transition:'all 0.15s' }}/>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14, fontWeight:500, color:'var(--text)' }}>{g.baslik}</div>
              <div style={{ display:'flex', gap:10, marginTop:3, alignItems:'center' }}>
                <span style={{ fontSize:11, color:oncelikRenk[g.oncelik], fontWeight:600 }}>
                  {g.oncelik==='yuksek'?'🔴 Yüksek':g.oncelik==='dusuk'?'⚪ Düşük':'🔵 Normal'}
                </span>
                <TarihBadge tarih={g.son_tarih}/>
              </div>
            </div>
            <button className="btn-icon" onClick={()=>sil(g._id)} style={{ width:28, height:28 }}>
              <i className="ti ti-trash" style={{ fontSize:13 }}/>
            </button>
          </div>
        );
      })}

      {/* Tamamlananlar */}
      {tamamlananlar.length>0 && (
        <details style={{ marginTop:24 }}>
          <summary style={{ cursor:'pointer', fontSize:13, color:'var(--text3)', padding:'8px 0', userSelect:'none' }}>
            Tamamlananlar ({tamamlananlar.length})
          </summary>
          <div style={{ marginTop:8 }}>
            {tamamlananlar.map(g=>(
              <div key={g._id} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--r-xs)', padding:'10px 14px', marginBottom:6, display:'flex', alignItems:'center', gap:12, opacity:0.5 }}>
                <div onClick={()=>toggle(g._id)} style={{ width:22, height:22, borderRadius:7, background:'var(--green)', border:'2px solid var(--green)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
                  <i className="ti ti-check" style={{ fontSize:12, color:'white' }}/>
                </div>
                <div style={{ flex:1, fontSize:13, textDecoration:'line-through', color:'var(--text2)' }}>{g.baslik}</div>
                <button className="btn-icon" onClick={()=>sil(g._id)} style={{ width:26, height:26 }}>
                  <i className="ti ti-trash" style={{ fontSize:12 }}/>
                </button>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
