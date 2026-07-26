import { useState, useEffect, useCallback } from 'react';
import { gorevApi } from '../api';
import { useToast } from '../context/ToastContext';
const ONCELIK = {
  yuksek: { label: 'Yüksek', cls: 'badge-red',   icon: '🔴' },
  normal:  { label: 'Normal', cls: 'badge-amber',  icon: '🟡' },
  dusuk:   { label: 'Düşük',  cls: 'badge-gray',   icon: '⚪' },
};
export default function GorevlerPage() {
  const toast = useToast();
  const [gorevler, setGorevler] = useState([]);
  const [yeniBaslik, setYeniBaslik] = useState('');
  const [yeniOncelik, setYeniOncelik] = useState('normal');
  const [yeniAciklama, setYeniAciklama] = useState('');
  const [detayAcik, setDetayAcik] = useState(false);
  const yukle = useCallback(async () => {
    try { const r = await gorevApi.getAll(); setGorevler(r.data); } catch { toast('Yüklenemedi','error'); }
  }, []);
  useEffect(() => { yukle(); }, [yukle]);
  const handleEkle = async (e) => {
    e.preventDefault();
    if (!yeniBaslik.trim()) return;
    try { await gorevApi.create({ baslik: yeniBaslik.trim(), aciklama: yeniAciklama.trim(), oncelik: yeniOncelik }); setYeniBaslik(''); setYeniAciklama(''); setDetayAcik(false); toast('Görev eklendi ✓'); yukle(); } catch { toast('Eklenemedi','error'); }
  };
  const handleToggle = async (id) => { try { await gorevApi.toggleTamamla(id); yukle(); } catch { toast('Hata','error'); } };
  const handleSil = async (id) => { try { await gorevApi.delete(id); toast('Silindi'); yukle(); } catch { toast('Hata','error'); } };
  const aktif = gorevler.filter(g => !g.tamamlandi);
  const tamamlandi = gorevler.filter(g => g.tamamlandi);
  return (
    <div>
      <div className="page-header">
        <div className="page-title">✅ Yapılacaklar</div>
        <div style={{color:'var(--text2)',fontSize:13}}>{aktif.length} bekliyor · {tamamlandi.length} tamamlandı</div>
      </div>
      <div className="card" style={{marginBottom:20}}>
        <form onSubmit={handleEkle}>
          <div style={{display:'flex',gap:8,marginBottom:detayAcik?12:0}}>
            <input className="form-input" placeholder="Yeni görev ekle..." value={yeniBaslik} onChange={e => setYeniBaslik(e.target.value)} onFocus={() => setDetayAcik(true)} style={{flex:1}}/>
            <select className="form-input" style={{width:130}} value={yeniOncelik} onChange={e => setYeniOncelik(e.target.value)}>
              <option value="yuksek">🔴 Yüksek</option>
              <option value="normal">🟡 Normal</option>
              <option value="dusuk">⚪ Düşük</option>
            </select>
            <button type="submit" className="btn btn-primary"><i className="ti ti-plus"/> Ekle</button>
          </div>
          {detayAcik && <textarea className="form-input" placeholder="Açıklama (opsiyonel)" rows={2} value={yeniAciklama} onChange={e => setYeniAciklama(e.target.value)}/>}
        </form>
      </div>
      {aktif.length === 0 ? (
        <div style={{textAlign:'center',color:'var(--text3)',padding:'30px 0'}}>
          <i className="ti ti-circle-check" style={{fontSize:32,display:'block',marginBottom:8}}/>Tüm görevler tamamlandı 🎉
        </div>
      ) : ['yuksek','normal','dusuk'].map(onc => {
        const grup = aktif.filter(g => g.oncelik === onc); if (!grup.length) return null;
        const o = ONCELIK[onc];
        return (
          <div key={onc}>
            <div className="section-divider">{o.icon} {o.label} öncelik ({grup.length})</div>
            {grup.map(g => (
              <div key={g._id||g.id} className="gorev-card">
                <div className={`gorev-checkbox ${g.tamamlandi?'checked':''}`} onClick={() => handleToggle(g._id||g.id)}>
                  {g.tamamlandi && <i className="ti ti-check" style={{fontSize:12}}/>}
                </div>
                <div style={{flex:1}}>
                  <div className="gorev-baslik">{g.baslik}</div>
                  {g.aciklama && <div style={{fontSize:12,color:'var(--text3)',marginTop:2}}>{g.aciklama}</div>}
                </div>
                <span className={`badge ${o.cls}`}>{o.label}</span>
                <button className="btn-icon" onClick={() => handleSil(g._id||g.id)}><i className="ti ti-trash" style={{fontSize:14}}/></button>
              </div>
            ))}
          </div>
        );
      })}
      {tamamlandi.length > 0 && (
        <>
          <div className="section-divider">✓ Tamamlananlar ({tamamlandi.length})</div>
          {tamamlandi.map(g => (
            <div key={g._id||g.id} className="gorev-card tamamlandi">
              <div className="gorev-checkbox checked" onClick={() => handleToggle(g._id||g.id)}><i className="ti ti-check" style={{fontSize:12}}/></div>
              <div className="gorev-baslik tamamlandi" style={{flex:1}}>{g.baslik}</div>
              <button className="btn-icon" onClick={() => handleSil(g._id||g.id)}><i className="ti ti-trash" style={{fontSize:14}}/></button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
