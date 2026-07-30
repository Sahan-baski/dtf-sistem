import { useState, useEffect, useCallback } from 'react';
import { musteriApi } from '../api';
export default function MusterilerPage() {
  const [musteriler, setMusteriler] = useState([]);
  const yukle = useCallback(async()=>{ try{setMusteriler((await musteriApi.getAll()).data);}catch{} },[]);
  useEffect(()=>{yukle();},[yukle]);
  return (
    <div>
      <div className="page-header"><div><div className="page-title">👥 Müşteriler</div><div className="page-sub">{musteriler.length} müşteri</div></div></div>
      {musteriler.map(m=>(
        <div key={m._id} className="card" style={{display:'flex',alignItems:'center',gap:14,padding:'14px 18px',marginBottom:8}}>
          <div style={{width:40,height:40,borderRadius:12,background:'var(--g-indigo)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,fontWeight:700,color:'white',flexShrink:0}}>{(m.ad||'?')[0].toUpperCase()}</div>
          <div style={{flex:1}}>
            <div style={{fontWeight:600,fontSize:14}}>{m.ad} {m.soyad}</div>
            <div style={{fontSize:12,color:'var(--text2)'}}>{m.telefon}</div>
          </div>
          <span className="badge badge-indigo">{m.siparis_sayisi} sipariş</span>
        </div>
      ))}
    </div>
  );
}
