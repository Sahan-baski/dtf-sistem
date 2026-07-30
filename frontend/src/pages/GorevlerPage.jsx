import { useState, useEffect, useCallback } from 'react';
import { gorevApi } from '../api';
import { useToast } from '../context/ToastContext';
export default function GorevlerPage() {
  const toast = useToast();
  const [gorevler, setGorevler] = useState([]);
  const [yeni, setYeni] = useState('');
  const yukle = useCallback(async () => { try { setGorevler((await gorevApi.getAll()).data); } catch{} }, []);
  useEffect(()=>{ yukle(); },[yukle]);
  const ekle = async (e) => { e.preventDefault(); if(!yeni.trim())return; try { await gorevApi.create({baslik:yeni.trim()}); setYeni(''); yukle(); } catch{ toast('Hata','error'); } };
  const toggle = async (id) => { try { await gorevApi.toggleTamamla(id); yukle(); } catch{ toast('Hata','error'); } };
  const sil = async (id) => { try { await gorevApi.delete(id); yukle(); } catch{ toast('Hata','error'); } };
  return (
    <div>
      <div className="page-header"><div><div className="page-title">✅ Görevler</div><div className="page-sub">{gorevler.filter(g=>!g.tamamlandi).length} bekleyen görev</div></div></div>
      <form onSubmit={ekle} style={{ display:'flex', gap:10, marginBottom:20 }}>
        <input className="form-input" value={yeni} onChange={e=>setYeni(e.target.value)} placeholder="Yeni görev ekle..." style={{ flex:1 }}/>
        <button type="submit" className="btn btn-primary"><i className="ti ti-plus"/>Ekle</button>
      </form>
      {gorevler.map(g=>(
        <div key={g._id} className={`gorev-card ${g.tamamlandi?'tamamlandi':''}`}>
          <div className={`gorev-checkbox ${g.tamamlandi?'checked':''}`} onClick={()=>toggle(g._id)}>
            {g.tamamlandi && <i className="ti ti-check" style={{fontSize:12}}/>}
          </div>
          <div className={`gorev-baslik ${g.tamamlandi?'tamamlandi':''}`}>{g.baslik}</div>
          <span className={`badge ${g.oncelik==='yuksek'?'badge-red':g.oncelik==='dusuk'?'badge-gray':'badge-indigo'}`} style={{fontSize:11}}>{g.oncelik==='yuksek'?'Yüksek':g.oncelik==='dusuk'?'Düşük':'Normal'}</span>
          <button className="btn-icon" onClick={()=>sil(g._id)}><i className="ti ti-trash" style={{fontSize:14}}/></button>
        </div>
      ))}
    </div>
  );
}
