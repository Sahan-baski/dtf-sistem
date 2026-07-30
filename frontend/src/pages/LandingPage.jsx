import { useState } from 'react';
import { authApi, authApiEk } from '../api';
import { useAuth } from '../context/AuthContext';

export default function LandingPage() {
  const { girisYap } = useAuth();
  const [ekran, setEkran] = useState('ana');
  const [loginForm, setLoginForm] = useState({ kullanici_adi:'', sifre:'' });
  const [kayitForm, setKayitForm] = useState({ kullanici_adi:'', sifre:'', sifre2:'', ad:'', soyad:'', firma_adi:'', telefon:'', email:'', adres:'', vergi_no:'' });
  const [hata, setHata] = useState('');
  const [basari, setBasari] = useState('');
  const [yukleniyor, setYukleniyor] = useState(false);

  const setL = (k,v) => setLoginForm(f=>({...f,[k]:v}));
  const setK = (k,v) => setKayitForm(f=>({...f,[k]:v}));

  const handleGiris = async (e, rolTipi) => {
    e.preventDefault();
    if (!loginForm.kullanici_adi || !loginForm.sifre) { setHata('Tüm alanları doldurun'); return; }
    setYukleniyor(true); setHata('');
    try {
      const res = await authApi.giris({ ...loginForm, rol_tipi: rolTipi });
      girisYap(res.data.token, res.data.kullanici);
    } catch (err) { setHata(err.response?.data?.hata || 'Giriş başarısız'); }
    finally { setYukleniyor(false); }
  };

  const handleKayit = async (e) => {
    e.preventDefault();
    if (!kayitForm.ad || !kayitForm.firma_adi || !kayitForm.telefon || !kayitForm.kullanici_adi || !kayitForm.sifre)
      { setHata('Zorunlu alanları doldurun'); return; }
    if (kayitForm.sifre !== kayitForm.sifre2) { setHata('Şifreler eşleşmiyor'); return; }
    if (kayitForm.sifre.length < 6) { setHata('Şifre en az 6 karakter olmalı'); return; }
    setYukleniyor(true); setHata('');
    try {
      await authApiEk.kayit(kayitForm);
      setBasari('Kaydınız alındı. Yönetici onayından sonra giriş yapabilirsiniz.');
      setEkran('musteri_giris');
    } catch (err) { setHata(err.response?.data?.hata || 'Kayıt başarısız'); }
    finally { setYukleniyor(false); }
  };

  const geri = () => { setEkran('ana'); setHata(''); setBasari(''); };

  return (
    <div className="landing-bg" style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:24, minHeight:'100vh' }}>
      <div className="landing-glow-1"/>
      <div className="landing-glow-2"/>

      <div style={{ position:'relative', zIndex:1, width:'100%', maxWidth:480 }}>
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:40 }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:12, marginBottom:8 }}>
            <div style={{ width:48, height:48, borderRadius:14, background:'var(--g-indigo)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, fontWeight:800, color:'white', boxShadow:'var(--glow-indigo)' }}>D</div>
            <div style={{ fontSize:26, fontWeight:800, color:'var(--text)', letterSpacing:-0.5 }}>
              DTF <span style={{ color:'var(--indigo)' }}>Yönetim</span>
            </div>
          </div>
          <div style={{ fontSize:14, color:'var(--text2)' }}>
            {ekran==='ana' ? 'Devam etmek için panel seçin'
            : ekran==='yonetim' ? 'Hesap türünü seçin'
            : ekran==='kayit' ? 'Müşteri kaydı'
            : 'Giriş yapın'}
          </div>
        </div>

        {/* Başarı */}
        {basari && <div style={{ background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.3)', borderRadius:'var(--r-xs)', padding:'12px 16px', marginBottom:20, fontSize:13, color:'var(--green)' }}>{basari}</div>}

        {/* ANA */}
        {ekran==='ana' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            <PanelKutu icon="ti-settings-2" label="Yönetim Paneli" alt="Siparişler, raporlar" gradient="var(--g-indigo)" glow="var(--glow-indigo)" onClick={()=>setEkran('yonetim')}/>
            <PanelKutu icon="ti-user-circle" label="Müşteri Paneli" alt="Sipariş ver, takip et" gradient="var(--g-green)" glow="var(--glow-green)" onClick={()=>setEkran('musteri_giris')}/>
          </div>
        )}

        {/* YÖNETİM ALT SEÇİM */}
        {ekran==='yonetim' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            <PanelKutu icon="ti-crown" label="Yönetici" alt="Tam erişim" gradient="var(--g-indigo)" glow="var(--glow-indigo)" onClick={()=>setEkran('admin_giris')}/>
            <PanelKutu icon="ti-tools" label="Çalışan" alt="Üretim & sipariş" gradient="var(--g-orange)" glow="0 8px 32px rgba(245,158,11,0.35)" onClick={()=>setEkran('calisan_giris')}/>
          </div>
        )}

        {/* GİRİŞ FORMLARI */}
        {(ekran==='admin_giris'||ekran==='calisan_giris'||ekran==='musteri_giris') && (
          <div style={{ background:'var(--bg2)', border:'1px solid var(--border2)', borderRadius:'var(--r)', padding:28, boxShadow:'0 24px 60px rgba(0,0,0,0.5)' }}>
            <form onSubmit={e=>handleGiris(e, ekran==='musteri_giris'?'musteri':'yonetim')}>
              <div className="form-group">
                <label className="form-label">Kullanıcı Adı</label>
                <input className="form-input" value={loginForm.kullanici_adi} onChange={e=>setL('kullanici_adi',e.target.value)} placeholder="kullanici_adi" style={{ fontSize:15 }}/>
              </div>
              <div className="form-group">
                <label className="form-label">Şifre</label>
                <input className="form-input" type="password" value={loginForm.sifre} onChange={e=>setL('sifre',e.target.value)} placeholder="••••••••" style={{ fontSize:15 }}/>
              </div>
              {hata && <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'var(--r-xs)', padding:'10px 14px', marginBottom:16, fontSize:13, color:'#fca5a5' }}>{hata}</div>}
              <button type="submit" className="btn btn-primary" style={{ width:'100%', justifyContent:'center', padding:'12px 0', fontSize:15 }} disabled={yukleniyor}>
                {yukleniyor ? <><i className="ti ti-loader-2"/> Giriş yapılıyor...</> : 'Giriş Yap'}
              </button>
            </form>
            {ekran==='musteri_giris' && (
              <div style={{ marginTop:18, paddingTop:16, borderTop:'1px solid var(--border)', textAlign:'center' }}>
                <span style={{ fontSize:13, color:'var(--text2)' }}>Hesabınız yok mu? </span>
                <button type="button" onClick={()=>{ setEkran('kayit'); setHata(''); }}
                  style={{ background:'none', border:'none', color:'var(--indigo)', fontSize:13, fontWeight:600, cursor:'pointer', textDecoration:'underline' }}>
                  Müşteri Ol
                </button>
              </div>
            )}
          </div>
        )}

        {/* KAYIT FORMU */}
        {ekran==='kayit' && (
          <div style={{ background:'var(--bg2)', border:'1px solid var(--border2)', borderRadius:'var(--r)', padding:28, boxShadow:'0 24px 60px rgba(0,0,0,0.5)', textAlign:'left' }}>
            <form onSubmit={handleKayit}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--indigo)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12 }}>Kişisel Bilgiler</div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Ad *</label><input className="form-input" value={kayitForm.ad} onChange={e=>setK('ad',e.target.value)} placeholder="Ahmet"/></div>
                <div className="form-group"><label className="form-label">Soyad</label><input className="form-input" value={kayitForm.soyad} onChange={e=>setK('soyad',e.target.value)} placeholder="Yılmaz"/></div>
              </div>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--green)', textTransform:'uppercase', letterSpacing:'0.08em', margin:'8px 0 12px' }}>Firma Bilgileri</div>
              <div className="form-group"><label className="form-label">Firma Adı *</label><input className="form-input" value={kayitForm.firma_adi} onChange={e=>setK('firma_adi',e.target.value)} placeholder="ABC Tekstil"/></div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Telefon *</label><input className="form-input" value={kayitForm.telefon} onChange={e=>setK('telefon',e.target.value)} placeholder="05xx xxx xx xx"/></div>
                <div className="form-group"><label className="form-label">E-posta</label><input className="form-input" type="email" value={kayitForm.email} onChange={e=>setK('email',e.target.value)} placeholder="info@firma.com"/></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Vergi No</label><input className="form-input" value={kayitForm.vergi_no} onChange={e=>setK('vergi_no',e.target.value)} placeholder="1234567890"/></div>
                <div className="form-group"><label className="form-label">Adres</label><input className="form-input" value={kayitForm.adres} onChange={e=>setK('adres',e.target.value)} placeholder="İlçe, Şehir"/></div>
              </div>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--amber)', textTransform:'uppercase', letterSpacing:'0.08em', margin:'8px 0 12px' }}>Hesap Bilgileri</div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Kullanıcı Adı *</label><input className="form-input" value={kayitForm.kullanici_adi} onChange={e=>setK('kullanici_adi',e.target.value)} placeholder="abc_tekstil"/></div>
                <div className="form-group"><label className="form-label">Şifre * (min 6)</label><input className="form-input" type="password" value={kayitForm.sifre} onChange={e=>setK('sifre',e.target.value)} placeholder="••••••"/></div>
              </div>
              <div className="form-group"><label className="form-label">Şifre Tekrar *</label><input className="form-input" type="password" value={kayitForm.sifre2} onChange={e=>setK('sifre2',e.target.value)} placeholder="••••••"/></div>
              {hata && <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'var(--r-xs)', padding:'10px 14px', marginBottom:14, fontSize:13, color:'#fca5a5' }}>{hata}</div>}
              <div style={{ fontSize:12, color:'var(--text3)', marginBottom:14 }}>* Kaydınız yönetici onayından sonra aktif olacaktır.</div>
              <button type="submit" className="btn btn-primary" style={{ width:'100%', justifyContent:'center', padding:'12px 0', fontSize:15 }} disabled={yukleniyor}>
                {yukleniyor ? 'Kaydediliyor...' : 'Kayıt Ol'}
              </button>
            </form>
          </div>
        )}

        {ekran !== 'ana' && (
          <button onClick={geri} style={{ marginTop:20, background:'none', border:'none', color:'var(--text2)', fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', gap:5, margin:'20px auto 0' }}>
            <i className="ti ti-arrow-left"/> Geri
          </button>
        )}
      </div>
    </div>
  );
}

function PanelKutu({ icon, label, alt, gradient, glow, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button type="button" onClick={onClick}
      onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}
      style={{ background:'var(--bg2)', border:`1.5px solid ${hover?'rgba(99,102,241,0.4)':'var(--border2)'}`, borderRadius:'var(--r)', padding:'28px 20px', cursor:'pointer', transition:'all 0.2s', transform:hover?'translateY(-4px)':'none', boxShadow:hover?glow:'none', display:'flex', flexDirection:'column', alignItems:'center', gap:14 }}>
      <div style={{ width:56, height:56, borderRadius:16, background:gradient, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:hover?glow:'none' }}>
        <i className={`ti ${icon}`} style={{ fontSize:26, color:'white' }}/>
      </div>
      <div>
        <div style={{ fontSize:15, fontWeight:700, color:'var(--text)', marginBottom:4 }}>{label}</div>
        <div style={{ fontSize:12, color:'var(--text2)' }}>{alt}</div>
      </div>
    </button>
  );
}
