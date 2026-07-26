import { useState, useEffect } from 'react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { istatistikApi } from '../api';

const RENKLER = ['#4f7ef8','#2ecc8f','#f0a500','#e84855','#9b59b6','#1abc9c','#e67e22','#3498db'];

function MetrikKart({ baslik, deger, renk, icon, alt }) {
  return (
    <div className="stat-card" style={{ borderTop:`3px solid ${renk||'var(--border)'}` }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:renk||'var(--text)' }}>{deger}</div>
          <div style={{ fontSize:12, color:'var(--text2)', marginTop:4 }}>{baslik}</div>
          {alt && <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>{alt}</div>}
        </div>
        {icon && <i className={`ti ${icon}`} style={{ fontSize:24, color:renk, opacity:0.5 }}/>}
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'10px 14px', fontSize:13 }}>
      <div style={{ fontWeight:600, marginBottom:4, color:'var(--text)' }}>{label}</div>
      {payload.map((p,i) => (
        <div key={i} style={{ color:p.color }}>{p.name}: {typeof p.value==='number'?p.value.toLocaleString('tr-TR')+'₺':p.value}</div>
      ))}
    </div>
  );
};

export default function IstatistiklerPage() {
  const [data, setData] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  useEffect(() => {
    istatistikApi.get()
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setYukleniyor(false));
  }, []);

  if (yukleniyor) return <div style={{textAlign:'center',color:'var(--text2)',padding:60}}>Yükleniyor...</div>;
  if (!data) return <div style={{textAlign:'center',color:'var(--red)',padding:60}}>Veri alınamadı</div>;

  const { ozet, aylikCiro, kategoriCiro, topMusteriler } = data;

  const buyumePozitif = ozet.buyume >= 0;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">📊 İstatistikler</div>
          <div className="page-sub">Satış ve ciro analizi</div>
        </div>
      </div>

      {/* Özet metrikler */}
      <div className="stats-row" style={{ gridTemplateColumns:'repeat(4,1fr)', marginBottom:24 }}>
        <MetrikKart baslik="Toplam Ciro" deger={`${ozet.toplamCiro.toLocaleString('tr-TR')}₺`} renk="var(--accent)" icon="ti-chart-line"/>
        <MetrikKart baslik="Bu Ay Ciro" deger={`${ozet.buAyCiro.toLocaleString('tr-TR')}₺`}
          renk={buyumePozitif?'var(--green)':'var(--red)'}
          alt={`${buyumePozitif?'▲':'▼'} %${Math.abs(ozet.buyume)} geçen ay`} icon="ti-trending-up"/>
        <MetrikKart baslik="Tahsil Edilen" deger={`${ozet.tahsilEdilen.toLocaleString('tr-TR')}₺`} renk="var(--green)" icon="ti-coin"/>
        <MetrikKart baslik="Bekleyen Tahsilat" deger={`${ozet.bekleyenTahsilat.toLocaleString('tr-TR')}₺`} renk="var(--amber)" icon="ti-clock"/>
      </div>

      <div className="stats-row" style={{ gridTemplateColumns:'repeat(4,1fr)', marginBottom:28 }}>
        <MetrikKart baslik="Toplam Sipariş" deger={ozet.toplamSiparis} renk="var(--accent)" icon="ti-clipboard-list"/>
        <MetrikKart baslik="Ort. Sipariş Tutarı" deger={`${ozet.ortalamaFiyat.toLocaleString('tr-TR')}₺`} renk="var(--text)" icon="ti-calculator"/>
        <MetrikKart baslik="Perakende Ciro" deger={`${(ozet.perakende||0).toLocaleString('tr-TR')}₺`} renk="#9b59b6" icon="ti-user"/>
        <MetrikKart baslik="Toptan Ciro" deger={`${(ozet.toptan||0).toLocaleString('tr-TR')}₺`} renk="#1abc9c" icon="ti-building-factory"/>
      </div>

      {/* Aylık ciro grafiği */}
      <div className="card" style={{ marginBottom:20, padding:20 }}>
        <div style={{ fontSize:15, fontWeight:700, marginBottom:16, color:'var(--text)' }}>
          <i className="ti ti-chart-area" style={{ color:'var(--accent)', marginRight:8 }}/>
          Aylık Ciro (Son 12 Ay)
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={aylikCiro} margin={{ top:5, right:10, left:10, bottom:5 }}>
            <defs>
              <linearGradient id="ciroGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4f7ef8" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#4f7ef8" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="tahsilGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2ecc8f" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#2ecc8f" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
            <XAxis dataKey="ay" tick={{ fill:'var(--text3)', fontSize:11 }} axisLine={false} tickLine={false}/>
            <YAxis tick={{ fill:'var(--text3)', fontSize:11 }} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1000).toFixed(0)}k₺`}/>
            <Tooltip content={<CustomTooltip/>}/>
            <Area type="monotone" dataKey="toplam" name="Toplam Ciro" stroke="#4f7ef8" fill="url(#ciroGrad)" strokeWidth={2}/>
            <Area type="monotone" dataKey="tahsil" name="Tahsil Edilen" stroke="#2ecc8f" fill="url(#tahsilGrad)" strokeWidth={2}/>
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>
        {/* Kategori bazlı ciro */}
        <div className="card" style={{ padding:20 }}>
          <div style={{ fontSize:15, fontWeight:700, marginBottom:16, color:'var(--text)' }}>
            <i className="ti ti-chart-bar" style={{ color:'var(--amber)', marginRight:8 }}/>
            Kategoriye Göre Ciro
          </div>
          {kategoriCiro.length === 0 ? (
            <div style={{ textAlign:'center', color:'var(--text3)', padding:20 }}>Veri yok</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={kategoriCiro.slice(0,7)} layout="vertical" margin={{ left:0, right:20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false}/>
                <XAxis type="number" tick={{ fill:'var(--text3)', fontSize:10 }} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/>
                <YAxis type="category" dataKey="kat" tick={{ fill:'var(--text2)', fontSize:11 }} axisLine={false} tickLine={false} width={90}/>
                <Tooltip content={<CustomTooltip/>}/>
                <Bar dataKey="ciro" name="Ciro" radius={[0,4,4,0]}>
                  {kategoriCiro.slice(0,7).map((_, i) => <Cell key={i} fill={RENKLER[i%RENKLER.length]}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* En çok ciro yapan müşteriler */}
        <div className="card" style={{ padding:20 }}>
          <div style={{ fontSize:15, fontWeight:700, marginBottom:16, color:'var(--text)' }}>
            <i className="ti ti-trophy" style={{ color:'#f0a500', marginRight:8 }}/>
            En Çok Ciro Yapan Müşteriler
          </div>
          {topMusteriler.length === 0 ? (
            <div style={{ textAlign:'center', color:'var(--text3)', padding:20 }}>Veri yok</div>
          ) : topMusteriler.slice(0,8).map((m, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 0', borderBottom:'1px solid var(--border)' }}>
              <div style={{ width:22, height:22, borderRadius:'50%', background:`${RENKLER[i%RENKLER.length]}22`, border:`1px solid ${RENKLER[i%RENKLER.length]}40`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:RENKLER[i%RENKLER.length], flexShrink:0 }}>
                {i+1}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.ad||'İsimsiz'}</div>
                {m.telefon && <div style={{ fontSize:11, color:'var(--text3)' }}>{m.telefon}</div>}
              </div>
              <div style={{ textAlign:'right', flexShrink:0 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--green)' }}>{m.ciro.toLocaleString('tr-TR')}₺</div>
                <div style={{ fontSize:11, color:'var(--text3)' }}>{m.siparis} sipariş</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
