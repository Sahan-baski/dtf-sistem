import { useState, useEffect, useRef } from 'react';
import { ayarlarApi } from '../api';
import { useToast } from '../context/ToastContext';

export default function AyarlarPage() {
  const toast = useToast();
  const [ayarlar, setAyarlar] = useState({ gunluk_press_kapasitesi:180, min_teslim_gun:2, baski_hazirlama_gun:1 });
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [yedekAliniyor, setYedekAliniyor] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [geriYuklemeMod, setGeriYuklemeMod] = useState('ekle');
  const dosyaRef = useRef();

  useEffect(() => { ayarlarApi.get().then(r=>setAyarlar(r.data)).catch(()=>{}); }, []);

  const handleKaydet = async () => {
    setKaydediliyor(true);
    try { await ayarlarApi.save({ gunluk_press_kapasitesi:parseInt(ayarlar.gunluk_press_kapasitesi)||180, min_teslim_gun:parseInt(ayarlar.min_teslim_gun)||2, baski_hazirlama_gun:parseInt(ayarlar.baski_hazirlama_gun)||1 }); toast('Ayarlar kaydedildi ✓'); }
    catch { toast('Kayıt hatası','error'); }
    finally { setKaydediliyor(false); }
  };

  const handleYedekAl = async () => {
    setYedekAliniyor(true);
    try {
      const token = localStorage.getItem('dtf_token');
      const res = await fetch('/api/yedek/al', { headers:{ Authorization:`Bearer ${token}` } });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const tarih = new Date().toISOString().slice(0,10);
      a.href = url; a.download = `dtf-yedek-${tarih}.json`; a.click();
      URL.revokeObjectURL(url);
      toast('Yedek indirildi ✓');
    } catch { toast('Yedek alınamadı','error'); }
    finally { setYedekAliniyor(false); }
  };

  const handleGeriYukle = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    if (!confirm(`"${geriYuklemeMod === 'sifirla' ? '⚠️ TÜM VERİLER SİLİNECEK ve yedekten geri yüklenecek' : 'Yedekteki veriler mevcut veriye eklenecek'}". Devam?`)) return;
    setYukleniyor(true);
    try {
      const text = await file.text();
      const yedek = JSON.parse(text);
      const token = localStorage.getItem('dtf_token');
      const res = await fetch('/api/yedek/yukle', { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body: JSON.stringify({ veri:yedek.veri, mod:geriYuklemeMod }) });
      const sonuc = await res.json();
      if (!res.ok) throw new Error(sonuc.hata);
      toast(`Geri yüklendi ✓ — ${Object.entries(sonuc.sonuc||{}).map(([k,v])=>`${k}: ${v}`).join(', ')}`);
    } catch(err) { toast(err.message||'Geri yükleme hatası','error'); }
    finally { setYukleniyor(false); e.target.value=''; }
  };

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">⚙️ Ayarlar</div><div className="page-sub">Kapasite ve yedekleme ayarları</div></div>
      </div>

      <div style={{ maxWidth:580, display:'flex', flexDirection:'column', gap:18 }}>

        {/* Press kapasitesi */}
        <div className="card" style={{ padding:22 }}>
          <div style={{ fontSize:14, fontWeight:700, marginBottom:4 }}><i className="ti ti-tool" style={{ color:'var(--indigo)', marginRight:8 }}/>Press Kapasitesi</div>
          <div style={{ fontSize:13, color:'var(--text2)', marginBottom:18 }}>Yeni sipariş oluştururken teslim tarihi bu değere göre hesaplanır.</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Günlük Press Kapasitesi</label>
              <input className="form-input" type="number" min="1" value={ayarlar.gunluk_press_kapasitesi} onChange={e=>setAyarlar(a=>({...a,gunluk_press_kapasitesi:e.target.value}))}/>
              <div style={{ fontSize:12, color:'var(--text3)', marginTop:4 }}>90 çift yön = 180 press</div>
            </div>
            <div className="form-group">
              <label className="form-label">Min. Teslim Günü</label>
              <input className="form-input" type="number" min="1" value={ayarlar.min_teslim_gun} onChange={e=>setAyarlar(a=>({...a,min_teslim_gun:e.target.value}))}/>
            </div>
          </div>
          <div style={{ background:'var(--bg3)', borderRadius:'var(--r-xs)', padding:'12px 16px', display:'flex', gap:24, marginBottom:18 }}>
            <div style={{ textAlign:'center' }}><div style={{ fontSize:22, fontWeight:800, color:'var(--indigo)' }}>{ayarlar.gunluk_press_kapasitesi}</div><div style={{ fontSize:11, color:'var(--text2)' }}>press/gün</div></div>
            <div style={{ textAlign:'center' }}><div style={{ fontSize:22, fontWeight:800, color:'var(--green)' }}>{Math.floor(ayarlar.gunluk_press_kapasitesi/2)}</div><div style={{ fontSize:11, color:'var(--text2)' }}>çift yön/gün</div></div>
          </div>
          <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center' }} onClick={handleKaydet} disabled={kaydediliyor}>
            <i className="ti ti-device-floppy"/>{kaydediliyor?'Kaydediliyor...':'Ayarları Kaydet'}
          </button>
        </div>

        {/* Veritabanı yedeği */}
        <div className="card" style={{ padding:22, borderTop:'3px solid var(--green)' }}>
          <div style={{ fontSize:14, fontWeight:700, marginBottom:4, color:'var(--green)' }}>
            <i className="ti ti-database-export" style={{ marginRight:8 }}/>Veritabanı Yedeği
          </div>
          <div style={{ fontSize:13, color:'var(--text2)', marginBottom:20 }}>
            Tüm sipariş, müşteri ve ürün verilerini JSON olarak bilgisayarına indir. Düzenli yedek almanı öneririz.
          </div>

          {/* Yedek al */}
          <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center', padding:'13px', background:'var(--g-green)', marginBottom:14 }}
            onClick={handleYedekAl} disabled={yedekAliniyor}>
            <i className="ti ti-download"/>
            {yedekAliniyor ? 'Hazırlanıyor...' : 'Yedeği İndir (JSON)'}
          </button>

          {/* Geri yükle */}
          <div style={{ borderTop:'1px solid var(--border)', paddingTop:16, marginTop:4 }}>
            <div style={{ fontSize:13, fontWeight:600, color:'var(--text2)', marginBottom:10 }}>Yedekten Geri Yükle</div>
            <div style={{ display:'flex', gap:8, marginBottom:12 }}>
              {[['ekle','Mevcut veriye ekle (güvenli)'],['sifirla','⚠️ Sıfırla ve yükle (tehlikeli)']].map(([k,l])=>(
                <button key={k} type="button" onClick={()=>setGeriYuklemeMod(k)}
                  style={{ flex:1, padding:'8px', border:`1.5px solid ${geriYuklemeMod===k?k==='sifirla'?'var(--red)':'var(--indigo)':'var(--border)'}`, background:geriYuklemeMod===k?k==='sifirla'?'rgba(239,68,68,0.1)':'rgba(99,102,241,0.1)':'var(--bg3)', borderRadius:'var(--r-xs)', color:geriYuklemeMod===k?k==='sifirla'?'var(--red)':'var(--indigo)':'var(--text2)', fontSize:12, cursor:'pointer' }}>
                  {l}
                </button>
              ))}
            </div>
            {geriYuklemeMod==='sifirla' && (
              <div style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)', borderRadius:'var(--r-xs)', padding:'10px 14px', marginBottom:12, fontSize:13, color:'#fca5a5' }}>
                <i className="ti ti-alert-triangle" style={{ marginRight:6 }}/>
                Bu mod mevcut tüm siparişleri, müşterileri ve ürünleri siler. Sadece sorun durumunda kullan.
              </div>
            )}
            <button className="btn btn-secondary" style={{ width:'100%', justifyContent:'center' }}
              onClick={()=>dosyaRef.current?.click()} disabled={yukleniyor}>
              <i className="ti ti-upload"/>
              {yukleniyor ? 'Yükleniyor...' : 'Yedek dosyası seç (.json)'}
            </button>
            <input ref={dosyaRef} type="file" accept=".json" style={{ display:'none' }} onChange={handleGeriYukle}/>
          </div>
        </div>

      </div>
    </div>
  );
}
