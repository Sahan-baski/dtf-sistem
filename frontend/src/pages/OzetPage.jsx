import { useState, useEffect } from 'react';
import { siparisApi, ozetApi } from '../api';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const GRAD_CARDS = [
  { key:'aktif',        label:'Aktif Sipariş',     icon:'ti-clipboard-list', cls:'grad-indigo', sub:'Devam eden' },
  { key:'bugunTeslim',  label:'Bugün Teslim',       icon:'ti-calendar-due',   cls:'grad-blue',   sub:'Bugün bitmesi gereken' },
  { key:'buAyGelir',    label:'Bu Ay Ciro',         icon:'ti-coin',           cls:'grad-green',  sub:'Tahsil edilen', para:true },
  { key:'bekleyenTahsilat', label:'Bekleyen Tahsilat', icon:'ti-wallet',      cls:'grad-pink',   sub:'Ödeme bekleniyor', para:true },
];

export default function OzetPage({ onSiparislerGit }) {
  const [ozet, setOzet] = useState(null);
  const [bugunSiparisler, setBugunSiparisler] = useState([]);
  const [gecikmisList, setGecikmisList] = useState([]);
  const [kapasite, setKapasite] = useState({ bugun:0, yarin:0, limit:180 });

  useEffect(() => {
    const bugunStr = new Date().toISOString().split('T')[0];
    const yarinDate = new Date(); yarinDate.setDate(yarinDate.getDate()+1);
    const yarinStr = yarinDate.toISOString().split('T')[0];
    const bugunD = new Date(); bugunD.setHours(0,0,0,0);

    Promise.all([ozetApi.get(), siparisApi.getAll()]).then(([ozetRes, sipRes]) => {
      const o = ozetRes.data;
      const aktif = sipRes.data.aktif || [];
      setBugunSiparisler(aktif.filter(s=>s.teslim_tarihi===bugunStr));
      setGecikmisList(aktif.filter(s=>s.teslim_tarihi&&new Date(s.teslim_tarihi+'T00:00:00')<bugunD));
      const bp = aktif.filter(s=>s.teslim_tarihi===bugunStr).reduce((t,s)=>t+(s.press_sayisi||0),0);
      const yp = aktif.filter(s=>s.teslim_tarihi===yarinStr).reduce((t,s)=>t+(s.press_sayisi||0),0);
      setKapasite({ bugun:bp, yarin:yp, limit:180 });
      setOzet({ ...o, bugunTeslim:bugunSiparisler.length });
    }).catch(()=>{});
  }, []);

  const tarih = new Date().toLocaleDateString('tr-TR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});

  const durumData = ozet ? [
    { name:'Bekliyor',     value:Math.max(0,(ozet.aktifSiparis||0)-((ozet.hazirBekliyor||0)+(ozet.gecikmis||0))), color:'#6366f1' },
    { name:'Hazır',        value:ozet.hazirBekliyor||0, color:'#10b981' },
    { name:'Gecikmiş',     value:ozet.gecikmis||0, color:'#ef4444' },
  ].filter(d=>d.value>0) : [];

  const kapOranBugun = kapasite.limit>0?kapasite.bugun/kapasite.limit:0;
  const kapOranYarin = kapasite.limit>0?kapasite.yarin/kapasite.limit:0;

  const GradKart = ({ label, icon, cls, sub, para, val }) => (
    <div className={`grad-card ${cls}`}>
      <div className="gc-icon"><i className={`ti ${icon}`}/></div>
      <div className="gc-num">{para?(val||0).toLocaleString('tr-TR')+'₺':(val||0)}</div>
      <div className="gc-label">{label}</div>
      <div className="gc-sub">{sub}</div>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">Genel Bakış</div>
          <div className="page-sub">{tarih}</div>
        </div>
        <button className="btn btn-secondary" onClick={onSiparislerGit}>
          <i className="ti ti-clipboard-list"/> Tüm Siparişler
        </button>
      </div>

      {/* Gradient stat cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:24 }}>
        <GradKart label="Aktif Sipariş" icon="ti-clipboard-list" cls="grad-indigo" sub="Toplam açık" val={ozet?.aktifSiparis}/>
        <GradKart label="Bugün Teslim" icon="ti-calendar-due" cls="grad-blue" sub="Hemen teslim" val={bugunSiparisler.length}/>
        <GradKart label="Bu Ay Ciro" icon="ti-coin" cls="grad-green" sub="Tahsil edilen" para val={ozet?.buAyGelir}/>
        <GradKart label="Tahsilat Bekleyen" icon="ti-wallet" cls="grad-pink" sub="Ödeme bekleniyor" para val={ozet?.bekleyenTahsilat}/>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>
        {/* Bugün teslim listesi */}
        <div className="card" style={{ padding:22 }}>
          <div className="card-header">
            <div>
              <div className="card-title" style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ width:8, height:8, borderRadius:'50%', background:'var(--red)', display:'inline-block', boxShadow:'0 0 6px var(--red)' }}/>
                Bugün Teslim ({bugunSiparisler.length})
              </div>
              <div className="card-sub">Son teslim tarihi bugün</div>
            </div>
            <button className="btn btn-sm btn-secondary" onClick={onSiparislerGit}>
              Tümü <i className="ti ti-arrow-right"/>
            </button>
          </div>
          {bugunSiparisler.length===0 ? (
            <div style={{ textAlign:'center', padding:'24px 0', color:'var(--text3)' }}>
              <i className="ti ti-circle-check" style={{ fontSize:36, color:'var(--green)', display:'block', marginBottom:8 }}/>
              <div style={{ fontSize:13 }}>Bugün teslim yok 🎉</div>
            </div>
          ) : bugunSiparisler.map(s=>(
            <div key={s._id||s.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
              <div style={{ width:36, height:36, borderRadius:10, background:'rgba(239,68,68,0.15)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <i className="ti ti-user" style={{ fontSize:16, color:'var(--red)' }}/>
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:600, fontSize:14, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.musteri_adi} {s.musteri_soyadi}</div>
                <div style={{ fontSize:12, color:'var(--text2)' }}>#{s.siparis_no}</div>
              </div>
              <span className={`badge ${s.durum==='hazir'?'badge-green':s.durum==='hazirlaniyor'?'badge-amber':'badge-indigo'}`} style={{ fontSize:11 }}>
                {s.durum==='hazir'?'Hazır':s.durum==='hazirlaniyor'?'Hazırlanıyor':'Bekliyor'}
              </span>
            </div>
          ))}

          {/* Gecikmiş uyarı */}
          {gecikmisList.length>0 && (
            <div style={{ marginTop:14, padding:'10px 14px', background:'rgba(239,68,68,0.08)', borderRadius:'var(--r-xs)', border:'1px solid rgba(239,68,68,0.2)' }}>
              <div style={{ fontSize:13, color:'#fca5a5', fontWeight:600 }}>
                <i className="ti ti-alert-triangle" style={{ marginRight:6 }}/>
                {gecikmisList.length} gecikmiş sipariş var!
              </div>
            </div>
          )}
        </div>

        {/* Sağ kolon: kapasite + durum grafiği */}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {/* Press kapasitesi */}
          <div className="card" style={{ padding:22 }}>
            <div className="card-header" style={{ marginBottom:16 }}>
              <div className="card-title">Press Kapasitesi</div>
            </div>
            <div style={{ marginBottom:14 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                <span style={{ fontSize:13, color:'var(--text2)' }}>Bugün</span>
                <span style={{ fontSize:13, fontWeight:700, color: kapOranBugun>=0.9?'var(--red)':kapOranBugun>=0.6?'var(--amber)':'var(--green)' }}>
                  {kapasite.bugun} / {kapasite.limit}
                </span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width:`${Math.min(kapOranBugun*100,100)}%`, background: kapOranBugun>=0.9?'var(--red)':kapOranBugun>=0.6?'linear-gradient(90deg,var(--amber),var(--red))':'linear-gradient(90deg,var(--indigo),var(--cyan))' }}/>
              </div>
            </div>
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                <span style={{ fontSize:13, color:'var(--text2)' }}>Yarın</span>
                <span style={{ fontSize:13, fontWeight:700, color: kapOranYarin>=0.9?'var(--red)':kapOranYarin>=0.6?'var(--amber)':'var(--green)' }}>
                  {kapasite.yarin} / {kapasite.limit}
                </span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width:`${Math.min(kapOranYarin*100,100)}%`, background: kapOranYarin>=0.9?'var(--red)':kapOranYarin>=0.6?'linear-gradient(90deg,var(--amber),var(--red))':'linear-gradient(90deg,var(--green),var(--cyan))' }}/>
              </div>
            </div>
          </div>

          {/* Sipariş durumu pasta */}
          <div className="card" style={{ padding:22, flex:1 }}>
            <div className="card-header" style={{ marginBottom:8 }}>
              <div className="card-title">Sipariş Dağılımı</div>
            </div>
            {durumData.length>0 ? (
              <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                <ResponsiveContainer width={110} height={110}>
                  <PieChart>
                    <Pie data={durumData} cx="50%" cy="50%" innerRadius={28} outerRadius={48} dataKey="value" paddingAngle={3}>
                      {durumData.map((d,i)=><Cell key={i} fill={d.color}/>)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ flex:1, display:'flex', flexDirection:'column', gap:8 }}>
                  {durumData.map((d,i)=>(
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ width:10, height:10, borderRadius:3, background:d.color, flexShrink:0 }}/>
                      <span style={{ fontSize:13, color:'var(--text2)', flex:1 }}>{d.name}</span>
                      <span style={{ fontSize:14, fontWeight:700, color:'var(--text)' }}>{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ textAlign:'center', padding:'20px 0', color:'var(--text3)', fontSize:13 }}>Veri yok</div>
            )}
          </div>
        </div>
      </div>

      {/* Özet sayılar */}
      {ozet && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14 }}>
          {[
            { label:'Bu Hafta Teslim', val:ozet.buHafta,     color:'var(--indigo)', icon:'ti-calendar-week' },
            { label:'Gecikmiş',        val:ozet.gecikmis,    color:'var(--red)',    icon:'ti-alert-triangle' },
            { label:'Ödeme Bekleyen',  val:ozet.odemeBekleyen,color:'var(--amber)', icon:'ti-credit-card' },
            { label:'Hazır',           val:ozet.hazirBekliyor,color:'var(--green)', icon:'ti-package' },
          ].map((m,i)=>(
            <div key={i} className="card" style={{ padding:'18px 20px', display:'flex', alignItems:'center', gap:14 }}>
              <div style={{ width:42, height:42, borderRadius:12, background:`${m.color}18`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <i className={`ti ${m.icon}`} style={{ fontSize:20, color:m.color }}/>
              </div>
              <div>
                <div style={{ fontSize:22, fontWeight:800, color:m.color }}>{m.val||0}</div>
                <div style={{ fontSize:12, color:'var(--text2)', marginTop:2 }}>{m.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
