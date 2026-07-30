import { useState, useEffect, useMemo } from 'react';
import { siparisApi, ozetApi, gorevApi } from '../api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const PERIYOT = [
  { key:'6hafta', label:'6 Hafta' },
  { key:'3ay',    label:'3 Ay'    },
  { key:'6ay',    label:'6 Ay'    },
  { key:'1yil',   label:'1 Yıl'   },
];

function hesaplaPeriyot(siparisler, periyot) {
  const now = new Date(); now.setHours(23,59,59,999);
  const items = [];
  if (periyot === '1yil') {
    for (let i=11; i>=0; i--) {
      const d=new Date(now); d.setDate(1); d.setMonth(d.getMonth()-i);
      const b=new Date(d); b.setHours(0,0,0,0);
      const bit=new Date(b); bit.setMonth(bit.getMonth()+1); bit.setDate(0); bit.setHours(23,59,59,999);
      const ay=siparisler.filter(s=>{const t=new Date(s.createdAt);return t>=b&&t<=bit;});
      items.push({ label:b.toLocaleDateString('tr-TR',{month:'short'}), ciro:ay.reduce((t,s)=>t+(s.odeme?.tutar||0),0), tahsil:ay.filter(s=>s.odeme?.odendi).reduce((t,s)=>t+(s.odeme?.tutar||0),0) });
    }
  } else {
    const haftaSayisi = periyot==='6hafta'?6:periyot==='3ay'?12:24;
    for (let i=haftaSayisi-1; i>=0; i--) {
      const bitis=new Date(now); bitis.setDate(bitis.getDate()-i*7);
      const baslangic=new Date(bitis); baslangic.setDate(baslangic.getDate()-6); baslangic.setHours(0,0,0,0);
      const h=siparisler.filter(s=>{const t=new Date(s.createdAt);return t>=baslangic&&t<=bitis;});
      items.push({ label:`${baslangic.getDate()}/${baslangic.getMonth()+1}`, ciro:h.reduce((t,s)=>t+(s.odeme?.tutar||0),0), tahsil:h.filter(s=>s.odeme?.odendi).reduce((t,s)=>t+(s.odeme?.tutar||0),0) });
    }
  }
  return items;
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active||!payload?.length) return null;
  return (
    <div style={{ background:'var(--bg3)', border:'1px solid var(--border2)', borderRadius:'var(--r-xs)', padding:'10px 14px', fontSize:13 }}>
      <div style={{ fontWeight:600, marginBottom:4 }}>{label}</div>
      {payload.map((p,i)=><div key={i} style={{ color:p.fill }}>{p.name}: {p.value.toLocaleString('tr-TR')}₺</div>)}
    </div>
  );
};

function kalanGun(t) {
  if (!t) return null;
  const b=new Date(); b.setHours(0,0,0,0);
  return Math.ceil((new Date(t+'T00:00:00')-b)/864e5);
}

export default function OzetPage({ onSiparislerGit }) {
  const [ozet, setOzet] = useState(null);
  const [tumSiparisler, setTumSiparisler] = useState([]);
  const [bugunSiparisler, setBugunSiparisler] = useState([]);
  const [gecikmisList, setGecikmisList] = useState([]);
  const [bugunGorevler, setBugunGorevler] = useState([]);
  const [kapasite, setKapasite] = useState({ bugun:0, yarin:0, limit:180 });
  const [periyot, setPeriyot] = useState('6hafta');

  useEffect(() => {
    const bugunStr = new Date().toISOString().split('T')[0];
    const yarinStr = (() => { const d=new Date(); d.setDate(d.getDate()+1); return d.toISOString().split('T')[0]; })();
    const bugunD = new Date(); bugunD.setHours(0,0,0,0);

    Promise.all([ozetApi.get(), siparisApi.getAll(), gorevApi.getAll()]).then(([oz, sip, gov]) => {
      setOzet(oz.data);
      const hepsi=[...(sip.data.aktif||[]),...(sip.data.teslim_edilen||[])];
      setTumSiparisler(hepsi);
      const aktif=sip.data.aktif||[];
      setBugunSiparisler(aktif.filter(s=>s.teslim_tarihi===bugunStr));
      setGecikmisList(aktif.filter(s=>s.teslim_tarihi&&new Date(s.teslim_tarihi+'T00:00:00')<bugunD));
      const bp=aktif.filter(s=>s.teslim_tarihi===bugunStr).reduce((t,s)=>t+(s.press_sayisi||0),0);
      const yp=aktif.filter(s=>s.teslim_tarihi===yarinStr).reduce((t,s)=>t+(s.press_sayisi||0),0);
      setKapasite({bugun:bp,yarin:yp,limit:180});
      // Bugün son tarihi olan bekleyen görevler
      setBugunGorevler((gov.data||[]).filter(g=>!g.tamamlandi&&g.son_tarih===bugunStr));
    }).catch(()=>{});
  }, []);

  const chartData = useMemo(()=>hesaplaPeriyot(tumSiparisler,periyot),[tumSiparisler,periyot]);
  const tarih = new Date().toLocaleDateString('tr-TR',{weekday:'long',day:'numeric',month:'long'});

  const KapBar = ({ val, limit, label }) => {
    const oran=limit>0?val/limit:0;
    const renk=oran>=0.9?'var(--red)':oran>=0.6?'var(--amber)':'var(--indigo)';
    return (
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 12px', background:'var(--bg3)', borderRadius:'var(--r-xs)', border:`1px solid ${renk}30` }}>
        <span style={{ fontSize:12, color:'var(--text2)' }}>{label}</span>
        <span style={{ fontSize:13, fontWeight:700, color:renk }}>{val}/{limit}</span>
        <div style={{ width:44, height:4, background:'var(--border)', borderRadius:2, overflow:'hidden' }}>
          <div style={{ height:'100%', background:renk, width:`${Math.min(oran*100,100)}%` }}/>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">Genel Bakış</div><div className="page-sub">{tarih}</div></div>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <KapBar val={kapasite.bugun} limit={kapasite.limit} label="Bugün"/>
          <KapBar val={kapasite.yarin} limit={kapasite.limit} label="Yarın"/>
        </div>
      </div>

      {/* Bugün — siparişler + görevler */}
      <div style={{ display:'grid', gridTemplateColumns: bugunGorevler.length>0 ? '1fr 1fr' : '1fr', gap:16, marginBottom:16 }}>

        {/* Bugün teslim */}
        <div className="card" style={{ borderLeft:'4px solid var(--red)', padding:'18px 20px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <div style={{ fontSize:15, fontWeight:700, color:'var(--red)' }}>
              <i className="ti ti-calendar-due" style={{ marginRight:8 }}/>Bugün Teslim ({bugunSiparisler.length})
            </div>
            <button className="btn btn-sm btn-secondary" onClick={onSiparislerGit}>
              Tümü <i className="ti ti-arrow-right"/>
            </button>
          </div>
          {bugunSiparisler.length===0 ? (
            <div style={{ color:'var(--text3)', fontSize:13 }}>
              <i className="ti ti-circle-check" style={{ color:'var(--green)', marginRight:6 }}/>Bugün teslim yok 🎉
            </div>
          ) : bugunSiparisler.map(s=>(
            <div key={s._id||s.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom:'1px solid var(--border)' }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:s.durum==='hazir'?'var(--green)':s.durum==='hazirlaniyor'?'var(--amber)':'var(--red)', flexShrink:0 }}/>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:600, fontSize:14, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.musteri_adi} {s.musteri_soyadi}</div>
                <div style={{ fontSize:11, color:'var(--text3)' }}>#{s.siparis_no}</div>
              </div>
              <span className={`badge ${s.durum==='hazir'?'badge-green':s.durum==='hazirlaniyor'?'badge-amber':'badge-gray'}`} style={{ fontSize:10 }}>
                {s.durum==='hazir'?'Hazır':s.durum==='hazirlaniyor'?'Hazırlanıyor':'Bekliyor'}
              </span>
            </div>
          ))}
          {gecikmisList.length>0 && (
            <div style={{ marginTop:12, padding:'9px 12px', background:'rgba(239,68,68,0.07)', borderRadius:'var(--r-xs)', border:'1px solid rgba(239,68,68,0.2)', fontSize:13, color:'#fca5a5' }}>
              <i className="ti ti-alert-triangle" style={{ marginRight:6 }}/>{gecikmisList.length} gecikmiş sipariş var!
            </div>
          )}
        </div>

        {/* Bugün son tarihi olan görevler */}
        {bugunGorevler.length>0 && (
          <div className="card" style={{ borderLeft:'4px solid var(--amber)', padding:'18px 20px' }}>
            <div style={{ fontSize:15, fontWeight:700, color:'var(--amber)', marginBottom:12 }}>
              <i className="ti ti-checkbox" style={{ marginRight:8 }}/>Bugün Son Tarihli Görevler ({bugunGorevler.length})
            </div>
            {bugunGorevler.map(g=>(
              <div key={g._id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom:'1px solid var(--border)' }}>
                <div style={{ width:8, height:8, borderRadius:3, background:'var(--amber)', flexShrink:0 }}/>
                <div style={{ flex:1, fontSize:14, fontWeight:500 }}>{g.baslik}</div>
                <span className={`badge ${g.oncelik==='yuksek'?'badge-red':'badge-indigo'}`} style={{ fontSize:10 }}>
                  {g.oncelik==='yuksek'?'Yüksek':'Normal'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ciro grafiği */}
      <div className="card" style={{ marginBottom:20, padding:'20px 20px 16px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
          <div style={{ fontSize:15, fontWeight:700 }}>
            <i className="ti ti-chart-bar" style={{ color:'var(--indigo)', marginRight:8 }}/>Ciro Gidişatı
          </div>
          <div style={{ display:'flex', gap:4 }}>
            {PERIYOT.map(p=>(
              <button key={p.key} onClick={()=>setPeriyot(p.key)} style={{ padding:'5px 12px', borderRadius:20, border:`1px solid ${periyot===p.key?'var(--indigo)':'var(--border)'}`, background:periyot===p.key?'rgba(99,102,241,0.15)':'var(--bg3)', color:periyot===p.key?'var(--indigo)':'var(--text2)', fontSize:12, cursor:'pointer' }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ top:0,right:0,left:0,bottom:0 }} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false}/>
            <XAxis dataKey="label" tick={{ fill:'var(--text3)', fontSize:11 }} axisLine={false} tickLine={false}/>
            <YAxis tick={{ fill:'var(--text3)', fontSize:11 }} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/>
            <Tooltip content={<CustomTooltip/>}/>
            <Bar dataKey="ciro"   name="Toplam"  fill="rgba(99,102,241,0.6)"  radius={[4,4,0,0]}/>
            <Bar dataKey="tahsil" name="Tahsil"  fill="rgba(16,185,129,0.7)"  radius={[4,4,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display:'flex', gap:16, marginTop:8, justifyContent:'center' }}>
          <span style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:'var(--text2)' }}><span style={{ width:10,height:10,borderRadius:2,background:'rgba(99,102,241,0.6)',display:'inline-block' }}/>Toplam Ciro</span>
          <span style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:'var(--text2)' }}><span style={{ width:10,height:10,borderRadius:2,background:'rgba(16,185,129,0.7)',display:'inline-block' }}/>Tahsil Edilen</span>
        </div>
      </div>

      {/* Özet metrikler */}
      {ozet && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
          {[
            { label:'Aktif Sipariş', val:ozet.aktifSiparis,   color:'var(--indigo)', icon:'ti-clipboard-list' },
            { label:'Bu Hafta',      val:ozet.buHafta,         color:'var(--blue)',   icon:'ti-calendar-week' },
            { label:'Bekleyen Tahsilat', val:`${(ozet.bekleyenTahsilat||0).toLocaleString('tr-TR')}₺`, color:'var(--amber)', icon:'ti-wallet' },
            { label:'Gecikmiş',      val:ozet.gecikmis,        color:'var(--red)',    icon:'ti-alert-triangle' },
          ].map((m,i)=>(
            <div key={i} className="card" style={{ padding:'16px 18px', display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:40,height:40,borderRadius:12,background:`${m.color}18`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                <i className={`ti ${m.icon}`} style={{ fontSize:20, color:m.color }}/>
              </div>
              <div>
                <div style={{ fontSize:20, fontWeight:800, color:m.color }}>{m.val}</div>
                <div style={{ fontSize:12, color:'var(--text2)', marginTop:2 }}>{m.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
