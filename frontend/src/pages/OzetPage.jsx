import { useState, useEffect } from 'react';
import { siparisApi, ozetApi } from '../api';

export default function OzetPage({ onSiparislerGit }) {
  const [ozet, setOzet] = useState(null);
  const [bugunSiparisler, setBugunSiparisler] = useState([]);
  const [gecikmisList, setGecikmisList] = useState([]);
  const [gunlukKapasite, setGunlukKapasite] = useState({ bugun:0, yarin:0, kapasite:180 });

  useEffect(() => {
    const bugunStr = new Date().toISOString().split('T')[0];
    const yarinDate = new Date(); yarinDate.setDate(yarinDate.getDate()+1);
    const yarinStr = yarinDate.toISOString().split('T')[0];
    const bugunD = new Date(); bugunD.setHours(0,0,0,0);

    Promise.all([ozetApi.get(), siparisApi.getAll()]).then(([ozetRes, sipRes]) => {
      setOzet(ozetRes.data);
      const aktif = sipRes.data.aktif || [];
      setBugunSiparisler(aktif.filter(s => s.teslim_tarihi === bugunStr));
      setGecikmisList(aktif.filter(s => s.teslim_tarihi && new Date(s.teslim_tarihi+'T00:00:00') < bugunD));
      const bugunPress = aktif.filter(s=>s.teslim_tarihi===bugunStr).reduce((t,s)=>t+(s.press_sayisi||0),0);
      const yarinPress = aktif.filter(s=>s.teslim_tarihi===yarinStr).reduce((t,s)=>t+(s.press_sayisi||0),0);
      setGunlukKapasite({ bugun:bugunPress, yarin:yarinPress, kapasite:180 });
    }).catch(()=>{});
  }, []);

  const bugun = new Date().toLocaleDateString('tr-TR',{weekday:'long',day:'numeric',month:'long'});

  const KapasiteBadge = ({ kullanilanPress, kapasite, label }) => {
    const oran = kapasite > 0 ? kullanilanPress/kapasite : 0;
    const renk = oran>=0.9?'var(--red)':oran>=0.6?'var(--amber)':'var(--green)';
    return (
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 14px', background:'var(--bg3)', borderRadius:'var(--radius-sm)', border:`1px solid ${renk}40` }}>
        <div style={{ fontSize:12, color:'var(--text2)' }}>{label}</div>
        <div style={{ fontSize:13, fontWeight:700, color:renk }}>{kullanilanPress}/{kapasite}</div>
        <div style={{ width:50, height:4, background:'var(--border)', borderRadius:2, overflow:'hidden' }}>
          <div style={{ height:'100%', background:renk, width:`${Math.min(oran*100,100)}%` }}/>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">🏠 Genel Bakış</div>
          <div className="page-sub">{bugun}</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <KapasiteBadge kullanilanPress={gunlukKapasite.bugun} kapasite={gunlukKapasite.kapasite} label="Bugün Press"/>
          <KapasiteBadge kullanilanPress={gunlukKapasite.yarin} kapasite={gunlukKapasite.kapasite} label="Yarın Press"/>
        </div>
      </div>

      {/* Bugün teslim */}
      <div className="card" style={{ marginBottom:16, borderLeft:'4px solid var(--red)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
          <div style={{ fontSize:15, fontWeight:700, color:'var(--red)' }}>
            <i className="ti ti-calendar-due" style={{ marginRight:8 }}/>Bugün Teslim ({bugunSiparisler.length})
          </div>
          <button className="btn btn-sm btn-secondary" onClick={onSiparislerGit}>
            Tüm Siparişler <i className="ti ti-arrow-right"/>
          </button>
        </div>
        {bugunSiparisler.length===0 ? (
          <div style={{ color:'var(--text3)', fontSize:13 }}><i className="ti ti-circle-check" style={{ color:'var(--green)', marginRight:6 }}/>Bugün teslim yok 🎉</div>
        ) : bugunSiparisler.map(s => (
          <div key={s._id||s.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom:'1px solid var(--border)' }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:s.durum==='hazir'?'var(--green)':s.durum==='hazirlaniyor'?'var(--amber)':'var(--red)', flexShrink:0 }}/>
            <div style={{ flex:1 }}><span style={{ fontWeight:600 }}>{s.musteri_adi} {s.musteri_soyadi}</span><span style={{ fontSize:12, color:'var(--text3)', marginLeft:6 }}>#{s.siparis_no}</span></div>
            {s.press_sayisi>0 && <span style={{ fontSize:12, color:'var(--text2)' }}><i className="ti ti-tool" style={{ fontSize:11 }}/> {s.press_sayisi}</span>}
            <span className={`badge ${s.durum==='hazir'?'badge-blue':s.durum==='hazirlaniyor'?'badge-amber':'badge-gray'}`} style={{ fontSize:11 }}>
              {s.durum==='hazir'?'Hazır':s.durum==='hazirlaniyor'?'Hazırlanıyor':'Bekliyor'}
            </span>
          </div>
        ))}
      </div>

      {/* Gecikmiş */}
      {gecikmisList.length > 0 && (
        <div className="card" style={{ marginBottom:16, borderLeft:'4px solid var(--red)', opacity:0.85 }}>
          <div style={{ fontSize:14, fontWeight:700, color:'var(--red)', marginBottom:8 }}>
            <i className="ti ti-alert-triangle" style={{ marginRight:8 }}/>Gecikmiş Siparişler ({gecikmisList.length})
          </div>
          {gecikmisList.slice(0,5).map(s => (
            <div key={s._id||s.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 0', borderBottom:'1px solid var(--border)' }}>
              <span style={{ fontWeight:600, fontSize:14 }}>{s.musteri_adi} {s.musteri_soyadi}</span>
              <span style={{ fontSize:12, color:'var(--text3)' }}>#{s.siparis_no}</span>
              <span style={{ fontSize:12, color:'var(--red)', marginLeft:'auto' }}>{new Date(s.teslim_tarihi+'T00:00:00').toLocaleDateString('tr-TR')}</span>
            </div>
          ))}
        </div>
      )}

      {/* Genel durum */}
      {ozet && (
        <>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.08em', margin:'20px 0 12px' }}>Genel Durum</div>
          <div className="stats-row" style={{ gridTemplateColumns:'repeat(4,1fr)', marginBottom:16 }}>
            <div className="stat-card" style={{ borderTop:'3px solid var(--accent)' }}><div className="stat-num" style={{ color:'var(--accent)' }}>{ozet.aktifSiparis}</div><div className="stat-label">Aktif</div></div>
            <div className="stat-card" style={{ borderTop:'3px solid var(--amber)' }}><div className="stat-num" style={{ color:'var(--amber)' }}>{ozet.odemeBekleyen}</div><div className="stat-label">Ödeme Bekleyen</div></div>
            <div className="stat-card" style={{ borderTop:'3px solid var(--green)' }}><div className="stat-num" style={{ color:'var(--green)' }}>{ozet.hazirBekliyor}</div><div className="stat-label">Hazır</div></div>
            <div className="stat-card" style={{ borderTop:'3px solid var(--accent)' }}><div className="stat-num" style={{ color:'var(--accent)' }}>{ozet.buHafta}</div><div className="stat-label">Bu Hafta</div></div>
          </div>
          <div className="stats-row" style={{ gridTemplateColumns:'repeat(3,1fr)' }}>
            <div className="stat-card" style={{ borderTop:'3px solid var(--green)' }}><div className="stat-num" style={{ fontSize:18, color:'var(--green)' }}>{(ozet.buAyGelir||0).toLocaleString('tr-TR')}₺</div><div className="stat-label">Bu Ay Tahsil</div></div>
            <div className="stat-card" style={{ borderTop:'3px solid var(--amber)' }}><div className="stat-num" style={{ fontSize:18, color:'var(--amber)' }}>{(ozet.bekleyenTahsilat||0).toLocaleString('tr-TR')}₺</div><div className="stat-label">Bekleyen Tahsilat</div></div>
            <div className="stat-card" style={{ borderTop:'3px solid var(--red)' }}><div className="stat-num" style={{ color:'var(--red)' }}>{ozet.gecikmis}</div><div className="stat-label">Gecikmiş</div></div>
          </div>
        </>
      )}
    </div>
  );
}
