/** Ayarlar → Güvenlik Kontrolü: canlı sunucunun güvenlik ayarlarını kontrol eder (gizli değer göstermez). */
import { useState, useEffect, useCallback } from 'react';
import { guvenlikApi } from '../api';

const RENK = { kritik: 'var(--red)', uyari: 'var(--amber)', tamam: 'var(--green)', bilgi: 'var(--text3)' };
const IKON = { kritik: '⛔', uyari: '⚠️', tamam: '✓', bilgi: 'ℹ️' };

export default function GuvenlikKontrolu() {
  const [veri, setVeri] = useState(null);
  const [hata, setHata] = useState('');
  const [yukleniyor, setYukleniyor] = useState(false);
  const yukle = useCallback(async () => {
    setYukleniyor(true); setHata('');
    try { setVeri((await guvenlikApi.durum()).data); }
    catch (e) { setHata(e.response?.data?.hata || 'Kontrol yapılamadı'); }
    finally { setYukleniyor(false); }
  }, []);
  useEffect(() => { yukle(); }, [yukle]);

  const kritik = veri?.kontroller.filter(k => k.durum === 'kritik').length || 0;
  const uyari = veri?.kontroller.filter(k => k.durum === 'uyari').length || 0;
  const sira = { kritik: 0, uyari: 1, bilgi: 2, tamam: 3 };

  return (
    <div className="card" style={{ padding: 22, borderTop: `3px solid ${kritik ? 'var(--red)' : uyari ? 'var(--amber)' : 'var(--green)'}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <div style={{ fontSize: 15, fontWeight: 800 }}><i className="ti ti-shield-lock" style={{ marginRight: 8, color: 'var(--indigo)' }} />Güvenlik Kontrolü</div>
        {veri && (kritik ? <span className="badge badge-red">{kritik} kritik</span> : uyari ? <span className="badge badge-amber">{uyari} uyarı</span> : <span className="badge badge-green">sorun yok</span>)}
        <button className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={yukle} disabled={yukleniyor}><i className="ti ti-refresh" />{yukleniyor ? 'Kontrol ediliyor…' : 'Tekrar kontrol et'}</button>
      </div>
      <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>Canlı sunucudaki anahtarları ve şifreleri kontrol eder. Hiçbir gizli bilgi ekranda gösterilmez.</div>
      {hata && <div style={{ color: 'var(--red)', fontSize: 13 }}>{hata}</div>}
      {veri && veri.kontroller.slice().sort((a, b) => sira[a.durum] - sira[b.durum]).map((k, i) => (
        <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderTop: i ? '1px solid var(--border)' : 'none' }}>
          <span style={{ width: 20, textAlign: 'center', color: RENK[k.durum], fontWeight: 800 }}>{IKON[k.durum]}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: k.durum === 'tamam' || k.durum === 'bilgi' ? 'var(--text)' : RENK[k.durum] }}>{k.baslik}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.5 }}>{k.aciklama}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
