import { useState, useEffect } from 'react';
import { musteriApi } from '../api';
import { useToast } from '../context/ToastContext';
export default function MusterilerPage() {
  const toast = useToast();
  const [musteriler, setMusteriler] = useState([]);
  const [arama, setArama] = useState('');
  useEffect(() => {
    musteriApi.getAll().then(r => setMusteriler(r.data)).catch(() => toast('Yüklenemedi','error'));
  }, []);
  const filtrelenmis = musteriler.filter(m =>
    arama === '' || `${m.ad} ${m.soyad}`.toLowerCase().includes(arama.toLowerCase()) || (m.telefon||'').includes(arama)
  );
  return (
    <div>
      <div className="page-header">
        <div className="page-title">👥 Müşteri Rehberi</div>
        <div style={{color:'var(--text2)',fontSize:13}}>{musteriler.length} müşteri</div>
      </div>
      <div className="stats-row" style={{gridTemplateColumns:'repeat(3,1fr)',marginBottom:20}}>
        <div className="stat-card"><div className="stat-num">{musteriler.length}</div><div className="stat-label">Toplam Müşteri</div></div>
        <div className="stat-card"><div className="stat-num" style={{color:'var(--accent)'}}>{musteriler.filter(m=>m.siparis_sayisi>1).length}</div><div className="stat-label">Tekrarlayan</div></div>
        <div className="stat-card"><div className="stat-num" style={{color:'var(--green)'}}>{musteriler.reduce((t,m)=>t+(m.siparis_sayisi||0),0)}</div><div className="stat-label">Toplam Sipariş</div></div>
      </div>
      <input className="form-input" style={{marginBottom:16}} placeholder="🔍 Ad, soyad veya telefon ara..." value={arama} onChange={e => setArama(e.target.value)}/>
      {filtrelenmis.length === 0 ? (
        <div style={{textAlign:'center',color:'var(--text3)',padding:40}}>
          <i className="ti ti-users-group" style={{fontSize:32,display:'block',marginBottom:8}}/>
          {arama ? 'Sonuç bulunamadı' : 'Henüz müşteri yok'}
        </div>
      ) : filtrelenmis.map(m => (
        <div key={m._id||m.id} className="card" style={{display:'flex',alignItems:'center',gap:14,padding:'12px 16px'}}>
          <div style={{width:40,height:40,borderRadius:'50%',flexShrink:0,background:'rgba(79,126,248,0.15)',border:'1px solid rgba(79,126,248,0.3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,fontWeight:700,color:'var(--accent)'}}>
            {m.ad?.[0]?.toUpperCase()}
          </div>
          <div style={{flex:1}}>
            <div style={{fontWeight:600,fontSize:15}}>
              {m.ad} {m.soyad}
              {m.siparis_sayisi > 1 && <span style={{fontSize:11,background:'rgba(79,126,248,0.15)',color:'var(--accent)',padding:'2px 7px',borderRadius:10,marginLeft:8,border:'1px solid rgba(79,126,248,0.3)'}}>Sadık müşteri</span>}
            </div>
            {m.telefon && <div style={{fontSize:13,color:'var(--text2)',marginTop:2}}><i className="ti ti-phone" style={{fontSize:12}}/> {m.telefon}</div>}
            {m.son_siparis && <div style={{fontSize:12,color:'var(--text3)',marginTop:1}}>Son sipariş: {new Date(m.son_siparis).toLocaleDateString('tr-TR')}</div>}
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:22,fontWeight:700,color:m.siparis_sayisi>2?'var(--green)':'var(--text)'}}>{m.siparis_sayisi}</div>
            <div style={{fontSize:11,color:'var(--text3)'}}>sipariş</div>
          </div>
          {m.telefon && <a href={`https://wa.me/90${m.telefon.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className="btn-icon" title="WhatsApp"><i className="ti ti-brand-whatsapp" style={{fontSize:16,color:'#25D366'}}/></a>}
        </div>
      ))}
    </div>
  );
}
