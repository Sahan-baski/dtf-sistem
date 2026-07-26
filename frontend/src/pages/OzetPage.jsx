import { useState, useEffect } from 'react';
import { ozetApi } from '../api';
function StatKart({ sayi, label, renk, icon }) {
  return (
    <div className="stat-card" style={{borderTop:`3px solid ${renk||'var(--border)'}`}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
        <div className="stat-num" style={{color:renk||'var(--text)'}}>{sayi}</div>
        {icon && <i className={`ti ${icon}`} style={{fontSize:22,color:renk,opacity:0.6}}/>}
      </div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
export default function OzetPage() {
  const [ozet, setOzet] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  useEffect(() => {
    ozetApi.get().then(r => { setOzet(r.data); setYukleniyor(false); }).catch(() => setYukleniyor(false));
    const iv = setInterval(() => ozetApi.get().then(r => setOzet(r.data)).catch(()=>{}), 30000);
    return () => clearInterval(iv);
  }, []);
  if (yukleniyor) return <div style={{textAlign:'center',color:'var(--text2)',padding:60}}>Yükleniyor...</div>;
  if (!ozet) return <div style={{textAlign:'center',color:'var(--red)',padding:60}}>Bağlantı hatası</div>;
  const bugun = new Date().toLocaleDateString('tr-TR',{weekday:'long',day:'numeric',month:'long'});
  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">🏠 Günlük Özet</div><div style={{fontSize:13,color:'var(--text3)',marginTop:2}}>{bugun}</div></div>
      </div>
      <div className="stats-row" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
        <StatKart sayi={ozet.gecikmis} label="Gecikmiş" renk="var(--red)" icon="ti-alert-triangle"/>
        <StatKart sayi={ozet.bugunTeslim} label="Bugün Teslim" renk="var(--amber)" icon="ti-calendar-due"/>
        <StatKart sayi={ozet.buHafta} label="Bu Hafta" renk="var(--accent)" icon="ti-calendar-week"/>
        <StatKart sayi={ozet.hazirBekliyor} label="Hazır / Bekliyor" renk="var(--green)" icon="ti-package"/>
      </div>
      <div className="stats-row" style={{gridTemplateColumns:'repeat(3,1fr)',marginBottom:24}}>
        <StatKart sayi={`${(ozet.buAyGelir||0).toLocaleString('tr-TR')}₺`} label="Bu Ay Tahsil" renk="var(--green)" icon="ti-coin"/>
        <StatKart sayi={`${(ozet.bekleyenTahsilat||0).toLocaleString('tr-TR')}₺`} label="Bekleyen Tahsilat" renk="var(--amber)" icon="ti-clock"/>
        <StatKart sayi={ozet.odemeBekleyen} label="Ödeme Bekleyen" renk="var(--red)" icon="ti-credit-card-off"/>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
        <div>
          <div className="section-divider">🔴 Bugün teslim edilecekler</div>
          {ozet.bugunTeslimListesi?.length===0 ? <div style={{color:'var(--text3)',fontSize:13,padding:'12px 0'}}>Bugün teslim yok 🎉</div>
            : ozet.bugunTeslimListesi?.map(s => (
              <div key={s.id} className="card" style={{padding:'10px 14px',marginBottom:8}}>
                <div style={{fontWeight:600,fontSize:14}}>{s.musteri}</div>
                <div style={{fontSize:12,color:'var(--text2)',marginTop:2}}>#{s.siparis_no} · {s.kategori}</div>
              </div>
            ))}
        </div>
        <div>
          <div className="section-divider">⚠️ Gecikmiş siparişler</div>
          {ozet.gecikmisList?.length===0 ? <div style={{color:'var(--text3)',fontSize:13,padding:'12px 0'}}>Gecikmiş sipariş yok ✓</div>
            : ozet.gecikmisList?.map(s => (
              <div key={s.id} className="card" style={{padding:'10px 14px',marginBottom:8,borderLeft:'3px solid var(--red)'}}>
                <div style={{fontWeight:600,fontSize:14,color:'var(--red)'}}>{s.musteri}</div>
                <div style={{fontSize:12,color:'var(--text2)',marginTop:2}}>#{s.siparis_no} · {s.teslim_tarihi?new Date(s.teslim_tarihi+'T00:00:00').toLocaleDateString('tr-TR'):'?'}</div>
              </div>
            ))}
        </div>
      </div>
      {ozet.asamaBekleyen?.length > 0 && (
        <div style={{marginTop:8}}>
          <div className="section-divider">🔧 Devam eden aşamalar</div>
          {ozet.asamaBekleyen.map(s => (
            <div key={s.id} className="card" style={{padding:'10px 14px',marginBottom:8,display:'flex',alignItems:'center',gap:12}}>
              <div style={{flex:1}}><span style={{fontWeight:600,fontSize:14}}>{s.musteri}</span><span style={{fontSize:12,color:'var(--text3)',marginLeft:8}}>#{s.siparis_no}</span></div>
              <div style={{fontSize:12,background:'rgba(79,126,248,0.15)',color:'var(--accent)',padding:'3px 10px',borderRadius:20,border:'1px solid rgba(79,126,248,0.3)'}}>{s.bekleyen_asama}</div>
              {s.teslim_tarihi && <div style={{fontSize:12,color:'var(--text3)'}}>{new Date(s.teslim_tarihi+'T00:00:00').toLocaleDateString('tr-TR')}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
