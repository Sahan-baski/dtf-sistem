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

// ===================== Site (WooCommerce) satış istatistikleri =====================

const ACCENT = '#4f7ef8';

const SITE_ARALIKLARI = [
  { key: 'bugun', ad: 'Bugün' },
  { key: '7gun', ad: 'Son 7 Gün' },
  { key: 'buay', ad: 'Bu Ay' },
  { key: '30gun', ad: 'Son 30 Gün' },
  { key: '3ay', ad: 'Son 3 Ay' },
  { key: 'yil', ad: 'Bu Yıl' },
  { key: 'tumu', ad: 'Tüm Zamanlar' },
];

const GUN_KISA = { Pazartesi: 'Pzt', Salı: 'Sal', Çarşamba: 'Çar', Perşembe: 'Per', Cuma: 'Cum', Cumartesi: 'Cmt', Pazar: 'Paz' };

const tl = (n) => `${Math.round(n || 0).toLocaleString('tr-TR')}₺`;
const sayi = (n) => (n || 0).toLocaleString('tr-TR', { maximumFractionDigits: 1 });

function Degisim({ deger }) {
  if (deger === null || deger === undefined) return null;
  const artis = deger >= 0;
  return (
    <span style={{ fontSize: 11, color: artis ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
      {artis ? '▲' : '▼'} %{Math.abs(deger).toLocaleString('tr-TR')} <span style={{ color: 'var(--text3)', fontWeight: 400 }}>önceki döneme göre</span>
    </span>
  );
}

function HizliKart({ baslik, veri, alt }) {
  return (
    <div className="stat-card">
      <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 600 }}>{baslik}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: '4px 0 2px' }}>{tl(veri.ciro)}</div>
      <div style={{ fontSize: 12, color: 'var(--text2)' }}>{veri.siparis} sipariş · {veri.adet} ürün</div>
      {alt && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{alt}</div>}
    </div>
  );
}

function DonemKart({ baslik, deger, alt, degisim }) {
  return (
    <div className="stat-card">
      <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{deger}</div>
      <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 3 }}>{baslik}</div>
      {degisim !== undefined && <div style={{ marginTop: 3 }}><Degisim deger={degisim} /></div>}
      {alt && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{alt}</div>}
    </div>
  );
}

function Kart({ baslik, ikon, sag, children }) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
          {ikon && <i className={`ti ${ikon}`} style={{ color: ACCENT, marginRight: 8 }} />}{baslik}
        </div>
        {sag}
      </div>
      {children}
    </div>
  );
}

// Tek seriyi gösteren grafik tooltip'i - aynı gün/ayın ciro, ürün ve sipariş sayısını birlikte gösterir.
const SeriTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: 12.5, color: 'var(--text)' }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
      <div>Ciro: <strong>{tl(d.ciro)}</strong></div>
      <div>Satılan ürün: <strong>{d.adet}</strong></div>
      <div>Sipariş: <strong>{d.siparis}</strong></div>
    </div>
  );
};

const AdetTooltip = ({ active, payload, label, birim = 'adet' }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontSize: 12.5, color: 'var(--text)' }}>
      <strong>{label}</strong>: {sayi(payload[0].value)} {birim}
    </div>
  );
};

function SiraliListe({ satirlar, deger, etiket, alt }) {
  if (!satirlar.length) return <div style={{ textAlign: 'center', color: 'var(--text3)', padding: 20 }}>Bu aralıkta satış yok.</div>;
  const enYuksek = Math.max(...satirlar.map(deger), 1);
  return satirlar.map((s, i) => (
    <div key={i} style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12.5, marginBottom: 3 }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>
          <span style={{ color: 'var(--text3)', marginRight: 6 }}>{i + 1}.</span>{etiket(s)}
        </span>
        <span style={{ color: 'var(--text2)', whiteSpace: 'nowrap' }}>{alt(s)}</span>
      </div>
      <div style={{ background: 'var(--bg2)', borderRadius: 4, height: 7, overflow: 'hidden' }}>
        <div style={{ width: `${Math.max(2, (deger(s) / enYuksek) * 100)}%`, height: '100%', background: ACCENT, borderRadius: 4 }} />
      </div>
    </div>
  ));
}

function SiteIstatistikleri() {
  const [aralik, setAralik] = useState('30gun');
  const [veri, setVeri] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState('');
  const [grafikMetrik, setGrafikMetrik] = useState('ciro');
  const [tasarimMetrik, setTasarimMetrik] = useState('adet');

  const yukle = (yenile = false) => {
    setYukleniyor(true);
    setHata('');
    istatistikApi.site(aralik, yenile)
      .then(r => setVeri(r.data))
      .catch(e => setHata(e.response?.data?.hata || 'Site satış verisi alınamadı.'))
      .finally(() => setYukleniyor(false));
  };
  useEffect(() => { yukle(false); }, [aralik]);

  const izgara = (min) => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 14, marginBottom: 20 });

  const ust = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
      <div>
        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>🛒 Site Satışları</div>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>
          {veri?.site ? veri.site.replace(/^https?:\/\//, '') : 'mirasgiyim.com'} siparişlerinden canlı
          {veri?.guncellenme && ` · son güncelleme ${new Date(veri.guncellenme).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <select className="form-input" style={{ padding: '5px 8px', fontSize: 12.5, width: 'auto' }} value={aralik} onChange={e => setAralik(e.target.value)}>
          {SITE_ARALIKLARI.map(a => <option key={a.key} value={a.key}>{a.ad}</option>)}
        </select>
        <button className="btn btn-secondary" onClick={() => yukle(true)} disabled={yukleniyor} title="Önbelleği atla, siteden şimdi tekrar çek">
          <i className={`ti ${yukleniyor ? 'ti-loader-2' : 'ti-refresh'}`} />Yenile
        </button>
      </div>
    </div>
  );

  if (yukleniyor && !veri) return <div style={{ marginBottom: 32 }}>{ust}<div style={{ textAlign: 'center', color: 'var(--text3)', padding: 40 }}>Siteden siparişler çekiliyor...</div></div>;
  if (hata && !veri) return <div style={{ marginBottom: 32 }}>{ust}<div style={{ textAlign: 'center', color: 'var(--red)', padding: 40 }}>{hata}</div></div>;
  if (!veri) return null;

  const { ozet, hizli } = veri;
  const gunlukMu = ozet.gun_sayisi <= 120;
  const seri = gunlukMu ? veri.gunluk : veri.aylik;
  const metrikAdi = { ciro: 'Ciro', adet: 'Satılan Ürün', siparis: 'Sipariş' }[grafikMetrik];
  const tasarimlar = veri.tasarimlar.slice().sort((a, b) => b[tasarimMetrik] - a[tasarimMetrik]).slice(0, 12);
  const eslesmesizVar = veri.tasarimlar.some(t => !t.eslesmeli);

  return (
    <div style={{ marginBottom: 36, opacity: yukleniyor ? 0.6 : 1, transition: 'opacity .2s' }}>
      {ust}
      {hata && <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 10 }}>{hata}</div>}
      {veri.tarama_eksik_kaldi && (
        <div style={{ fontSize: 12, color: 'var(--amber)', marginBottom: 12 }}>⚠️ Sipariş geçmişi çok büyük - en eski bazı siparişler bu hesaba dahil olmamış olabilir.</div>
      )}

      {/* Hızlı bakış - seçili aralıktan bağımsız */}
      <div style={izgara(170)}>
        <HizliKart baslik="Bugün" veri={hizli.bugun} />
        <HizliKart baslik="Dün" veri={hizli.dun} />
        <HizliKart baslik="Son 7 Gün" veri={hizli.son7} />
        <HizliKart baslik="Bu Ay" veri={hizli.bu_ay} alt={`Bu hızla ay sonu: ~${tl(hizli.bu_ay_tahmini)}`} />
        <HizliKart baslik="Geçen Ay" veri={hizli.gecen_ay} />
      </div>

      {/* Seçili dönem */}
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginBottom: 10 }}>
        {SITE_ARALIKLARI.find(a => a.key === aralik)?.ad} <span style={{ fontWeight: 400, color: 'var(--text3)' }}>({veri.aralik.baslangic} → {veri.aralik.bitis}, {ozet.gun_sayisi} gün)</span>
      </div>
      <div style={izgara(170)}>
        <DonemKart baslik="Ciro" deger={tl(ozet.ciro)} degisim={ozet.degisim?.ciro} alt="iadeler düşülmüş, kargo dahil" />
        <DonemKart baslik="Satılan Ürün" deger={`${ozet.adet} adet`} degisim={ozet.degisim?.adet} />
        <DonemKart baslik="Sipariş" deger={ozet.siparis} degisim={ozet.degisim?.siparis} />
        <DonemKart baslik="Ortalama Sepet" deger={tl(ozet.ortalama_sepet)} alt={`ürün başı ort. ${tl(ozet.urun_basi_ortalama)}`} />
        <DonemKart baslik="Günlük Ort. Ciro" deger={tl(ozet.gunluk_ortalama_ciro)} alt={`aylık ort. ~${tl(ozet.aylik_ortalama_ciro)}`} />
        <DonemKart baslik="Günlük Ort. Satış" deger={`${sayi(ozet.gunluk_ortalama_adet)} ürün`} alt={`${sayi(ozet.gunluk_ortalama_siparis)} sipariş/gün`} />
        {ozet.bekleyen?.siparis > 0 && (
          <DonemKart baslik="Ödeme Bekleyen" deger={tl(ozet.bekleyen.ciro)} alt={`${ozet.bekleyen.siparis} sipariş "Beklemede" (havale vb.) - ciroya dahil değil`} />
        )}
      </div>

      {/* Zaman serisi - tek seri, metrik seçilebilir (iki farklı ölçek tek grafikte karışmasın) */}
      <div style={{ marginBottom: 20 }}>
        <Kart
          baslik={`${gunlukMu ? 'Günlük' : 'Aylık'} ${metrikAdi}`}
          ikon="ti-chart-bar"
          sag={
            <select className="form-input" style={{ padding: '4px 8px', fontSize: 12, width: 'auto' }} value={grafikMetrik} onChange={e => setGrafikMetrik(e.target.value)}>
              <option value="ciro">Ciro</option>
              <option value="adet">Satılan ürün</option>
              <option value="siparis">Sipariş</option>
            </select>
          }
        >
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={seri} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="etiket" tick={{ fill: 'var(--text3)', fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={14} />
              <YAxis tick={{ fill: 'var(--text3)', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false}
                tickFormatter={v => grafikMetrik === 'ciro' ? (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : v) : v} />
              <Tooltip content={<SeriTooltip />} cursor={{ fill: 'var(--bg2)' }} />
              <Bar dataKey={grafikMetrik} name={metrikAdi} fill={ACCENT} radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
          {veri.en_iyi_gun && (
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8 }}>
              🏆 Bu aralıktaki en iyi gün: <strong style={{ color: 'var(--text)' }}>{veri.en_iyi_gun.etiket}</strong> — {tl(veri.en_iyi_gun.ciro)}, {veri.en_iyi_gun.adet} ürün
            </div>
          )}
        </Kart>
      </div>

      {/* En çok satanlar */}
      <div style={izgara(320)}>
        <Kart
          baslik="En Çok Satan Tasarımlar"
          ikon="ti-palette"
          sag={
            <select className="form-input" style={{ padding: '4px 8px', fontSize: 12, width: 'auto' }} value={tasarimMetrik} onChange={e => setTasarimMetrik(e.target.value)}>
              <option value="adet">Adete göre</option>
              <option value="ciro">Ciroya göre</option>
            </select>
          }
        >
          <SiraliListe
            satirlar={tasarimlar}
            deger={t => t[tasarimMetrik]}
            etiket={t => <>{t.ad}{t.urun_sayisi > 1 && <span style={{ color: 'var(--text3)', fontSize: 11 }}> · {t.urun_sayisi} ürün</span>}</>}
            alt={t => tasarimMetrik === 'adet' ? `${t.adet} adet · %${t.oran}` : tl(t.ciro)}
          />
          {eslesmesizVar && (
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 10, lineHeight: 1.5 }}>
              Aynı baskının farklı ürünleri (krem/füme sweat, ekru/beyaz tişört…) Stok Senkron'da aynı Master Tasarım'a bağlıysa tek tasarım sayılır. Bağlı olmayanlar ürün adının "–" işaretinden önceki kısmına göre gruplanır.
            </div>
          )}
        </Kart>

        <Kart baslik="En Çok Satan Ürünler" ikon="ti-shirt">
          <SiraliListe
            satirlar={veri.urunler.slice(0, 12)}
            deger={u => u.adet}
            etiket={u => u.ad}
            alt={u => `${u.adet} adet · ${tl(u.ciro)}`}
          />
        </Kart>
      </div>

      {/* Dağılımlar */}
      <div style={izgara(320)}>
        <Kart baslik="Beden Dağılımı" ikon="ti-ruler-measure">
          {veri.bedenler.length === 0 ? <div style={{ textAlign: 'center', color: 'var(--text3)', padding: 20 }}>Veri yok</div> : (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={veri.bedenler} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="beden" tick={{ fill: 'var(--text3)', fontSize: 10.5 }} axisLine={false} tickLine={false} interval={0} />
                <YAxis tick={{ fill: 'var(--text3)', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<AdetTooltip />} cursor={{ fill: 'var(--bg2)' }} />
                <Bar dataKey="adet" fill={ACCENT} radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          )}
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>Hangi bedenden ne kadar boş ürün stoklaman gerektiğini planlamak için.</div>
        </Kart>

        <Kart baslik="Haftanın Günlerine Göre" ikon="ti-calendar-week">
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={veri.hafta_gunleri} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="gun" tick={{ fill: 'var(--text3)', fontSize: 10.5 }} axisLine={false} tickLine={false} interval={0} tickFormatter={g => GUN_KISA[g] || g} />
              <YAxis tick={{ fill: 'var(--text3)', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<SeriTooltip />} cursor={{ fill: 'var(--bg2)' }} />
              <Bar dataKey="adet" fill={ACCENT} radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>Satılan ürün adedi. Paylaşım/reklam zamanlaması için.</div>
        </Kart>

        <Kart baslik="Saatlere Göre Sipariş" ikon="ti-clock">
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={veri.saatler} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="saat" tick={{ fill: 'var(--text3)', fontSize: 10.5 }} axisLine={false} tickLine={false} interval={2} tickFormatter={s => s.slice(0, 2)} />
              <YAxis tick={{ fill: 'var(--text3)', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<AdetTooltip birim="sipariş" />} cursor={{ fill: 'var(--bg2)' }} />
              <Bar dataKey="siparis" fill={ACCENT} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Kart>

        <Kart baslik="İllere Göre" ikon="ti-map-pin">
          <SiraliListe
            satirlar={veri.iller.slice(0, 10)}
            deger={il => il.siparis}
            etiket={il => il.il}
            alt={il => `${il.siparis} sipariş · ${tl(il.ciro)}`}
          />
          {veri.odeme_yontemleri.length > 0 && (
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              Ödeme: {veri.odeme_yontemleri.map(o => `${o.yontem} (${o.siparis})`).join(' · ')}
            </div>
          )}
        </Kart>
      </div>
    </div>
  );
}

// ===================== Atölye / manuel sipariş istatistikleri (yerel kayıtlar) =====================

export default function IstatistiklerPage() {
  const [atolyeAcik, setAtolyeAcik] = useState(false);
  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">📊 İstatistikler</div>
          <div className="page-sub">Site satışları canlı olarak mirasgiyim.com'dan çekilir</div>
        </div>
      </div>

      <SiteIstatistikleri />

      <div className="card" style={{ padding: '14px 20px', marginBottom: 20, cursor: 'pointer' }} onClick={() => setAtolyeAcik(a => !a)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
            🏭 Atölye / Manuel Siparişler <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--text3)' }}>(bu panelden elle girilen siparişler - kurumsal, toptan vb.)</span>
          </div>
          <i className={`ti ${atolyeAcik ? 'ti-chevron-up' : 'ti-chevron-down'}`} />
        </div>
      </div>
      {atolyeAcik && <AtolyeIstatistikleri />}
    </div>
  );
}

function AtolyeIstatistikleri() {
  const [data, setData] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  useEffect(() => {
    istatistikApi.get()
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setYukleniyor(false));
  }, []);

  if (yukleniyor) return <div style={{textAlign:'center',color:'var(--text2)',padding:40}}>Yükleniyor...</div>;
  if (!data) return <div style={{textAlign:'center',color:'var(--red)',padding:40}}>Veri alınamadı</div>;

  const { ozet, aylikCiro, kategoriCiro, topMusteriler } = data;

  const buyumePozitif = ozet.buyume >= 0;

  return (
    <div>

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

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(320px, 1fr))', gap:20, marginBottom:20 }}>
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
