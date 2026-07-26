import { useState } from 'react';
import { authApi, authApiEk } from '../api';
import { useAuth } from '../context/AuthContext';

export default function LandingPage() {
  const { girisYap } = useAuth();
  const [ekran, setEkran] = useState('ana'); // ana | yonetim | musteri_giris | kayit
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
      setBasari('Kaydınız alındı! Yönetici onayından sonra giriş yapabilirsiniz.');
      setEkran('musteri_giris');
    } catch (err) { setHata(err.response?.data?.hata || 'Kayıt başarısız'); }
    finally { setYukleniyor(false); }
  };

  const geri = () => { setEkran('ana'); setHata(''); setBasari(''); };

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24, position:'relative' }}>
      <div style={{ position:'fixed', inset:0, pointerEvents:'none', background:'radial-gradient(ellipse at 20% 50%, rgba(79,126,248,0.07) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(46,204,143,0.05) 0%, transparent 50%)' }}/>

      <div style={{ position:'relative', zIndex:1, width:'100%', maxWidth:500, textAlign:'center' }}>

        {/* Logo */}
        <div style={{ marginBottom:44 }}>
          <div style={{ fontSize:38, fontWeight:900, color:'var(--text)', letterSpacing:-1 }}>
            DTF <span style={{ color:'var(--accent)' }}>Yönetim</span>
          </div>
          <div style={{ fontSize:14, color:'var(--text2)', marginTop:6 }}>
            {ekran==='ana'         && 'Panel seçin'}
            {ekran==='yonetim'     && 'Hesap türünü seçin'}
            {ekran==='musteri_giris'&&'Müşteri girişi'}
            {ekran==='kayit'       && 'Yeni müşteri kaydı'}
          </div>
        </div>

        {/* Başarı mesajı */}
        {basari && (
          <div style={{ background:'rgba(46,204,143,0.1)', border:'1px solid rgba(46,204,143,0.3)', borderRadius:'var(--radius-sm)', padding:'12px 16px', marginBottom:20, fontSize:13, color:'var(--green)', textAlign:'left' }}>
            <i className="ti ti-circle-check"/> {basari}
          </div>
        )}

        {/* ── ANA EKRAN ──────────────────────────── */}
        {ekran==='ana' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            <KutuBtn icon="ti-settings" label="Yönetim Paneli" alt="Siparişler, raporlar" renk="#4f7ef8" onClick={()=>setEkran('yonetim')}/>
            <KutuBtn icon="ti-user"     label="Müşteri Paneli" alt="Sipariş takibi"       renk="#2ecc8f" onClick={()=>setEkran('musteri_giris')}/>
          </div>
        )}

        {/* ── YÖNETİM PANEL SEÇİMİ ──────────────── */}
        {ekran==='yonetim' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            <KutuBtn icon="ti-crown" label="Yönetici" alt="Tam erişim"       renk="#4f7ef8" onClick={()=>setEkran('admin_giris')}/>
            <KutuBtn icon="ti-tools" label="Çalışan"  alt="Üretim & sipariş" renk="#f0a500" onClick={()=>setEkran('calisan_giris')}/>
          </div>
        )}

        {/* ── GİRİŞ FORMLARI ────────────────────── */}
        {(ekran==='admin_giris'||ekran==='calisan_giris'||ekran==='musteri_giris') && (
          <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:28 }}>
            <form onSubmit={e=>handleGiris(e, ekran==='musteri_giris'?'musteri':'yonetim')}>
              <div className="form-group" style={{ textAlign:'left' }}>
                <label className="form-label">Kullanıcı Adı</label>
                <input className="form-input" value={loginForm.kullanici_adi} onChange={e=>setL('kullanici_adi',e.target.value)} placeholder="kullanici_adi" style={{ fontSize:15 }}/>
              </div>
              <div className="form-group" style={{ textAlign:'left' }}>
                <label className="form-label">Şifre</label>
                <input className="form-input" type="password" value={loginForm.sifre} onChange={e=>setL('sifre',e.target.value)} placeholder="••••••••" style={{ fontSize:15 }}/>
              </div>
              {hata && <div style={{ background:'rgba(232,72,85,0.1)', border:'1px solid rgba(232,72,85,0.3)', borderRadius:'var(--radius-sm)', padding:'9px 13px', marginBottom:14, fontSize:13, color:'var(--red)', textAlign:'left' }}>{hata}</div>}
              <button type="submit" className="btn btn-primary" style={{ width:'100%', justifyContent:'center', padding:'12px 0', fontSize:15 }} disabled={yukleniyor}>
                {yukleniyor ? 'Giriş yapılıyor...' : 'Giriş Yap'}
              </button>
            </form>

            {/* Müşteri panelinde kayıt ol linki */}
            {ekran==='musteri_giris' && (
              <div style={{ marginTop:18, paddingTop:16, borderTop:'1px solid var(--border)', textAlign:'center' }}>
                <span style={{ fontSize:13, color:'var(--text2)' }}>Hesabınız yok mu? </span>
                <button type="button" onClick={()=>{ setEkran('kayit'); setHata(''); }}
                  style={{ background:'none', border:'none', color:'var(--accent)', fontSize:13, fontWeight:600, cursor:'pointer', textDecoration:'underline' }}>
                  Müşteri Ol
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── KAYIT FORMU ────────────────────────── */}
        {ekran==='kayit' && (
          <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:28, textAlign:'left' }}>
            <form onSubmit={handleKayit}>

              <div style={{ fontSize:12, fontWeight:700, color:'var(--accent)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12 }}>Kişisel Bilgiler</div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Ad *</label>
                  <input className="form-input" value={kayitForm.ad} onChange={e=>setK('ad',e.target.value)} placeholder="Ahmet"/>
                </div>
                <div className="form-group">
                  <label className="form-label">Soyad</label>
                  <input className="form-input" value={kayitForm.soyad} onChange={e=>setK('soyad',e.target.value)} placeholder="Yılmaz"/>
                </div>
              </div>

              <div style={{ fontSize:12, fontWeight:700, color:'var(--green)', textTransform:'uppercase', letterSpacing:'0.08em', margin:'8px 0 12px' }}>Firma Bilgileri</div>
              <div className="form-group">
                <label className="form-label">Firma Adı *</label>
                <input className="form-input" value={kayitForm.firma_adi} onChange={e=>setK('firma_adi',e.target.value)} placeholder="ABC Tekstil Ltd."/>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Telefon *</label>
                  <input className="form-input" value={kayitForm.telefon} onChange={e=>setK('telefon',e.target.value)} placeholder="05xx xxx xx xx"/>
                </div>
                <div className="form-group">
                  <label className="form-label">E-posta</label>
                  <input className="form-input" type="email" value={kayitForm.email} onChange={e=>setK('email',e.target.value)} placeholder="info@firma.com"/>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Vergi No</label>
                  <input className="form-input" value={kayitForm.vergi_no} onChange={e=>setK('vergi_no',e.target.value)} placeholder="1234567890"/>
                </div>
                <div className="form-group">
                  <label className="form-label">Adres</label>
                  <input className="form-input" value={kayitForm.adres} onChange={e=>setK('adres',e.target.value)} placeholder="İlçe, Şehir"/>
                </div>
              </div>

              <div style={{ fontSize:12, fontWeight:700, color:'var(--amber)', textTransform:'uppercase', letterSpacing:'0.08em', margin:'8px 0 12px' }}>Hesap Bilgileri</div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Kullanıcı Adı *</label>
                  <input className="form-input" value={kayitForm.kullanici_adi} onChange={e=>setK('kullanici_adi',e.target.value)} placeholder="abc_tekstil"/>
                </div>
                <div className="form-group">
                  <label className="form-label">Şifre * (min 6)</label>
                  <input className="form-input" type="password" value={kayitForm.sifre} onChange={e=>setK('sifre',e.target.value)} placeholder="••••••"/>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Şifre Tekrar *</label>
                <input className="form-input" type="password" value={kayitForm.sifre2} onChange={e=>setK('sifre2',e.target.value)} placeholder="••••••"/>
              </div>

              {hata && <div style={{ background:'rgba(232,72,85,0.1)', border:'1px solid rgba(232,72,85,0.3)', borderRadius:'var(--radius-sm)', padding:'9px 13px', marginBottom:14, fontSize:13, color:'var(--red)' }}>{hata}</div>}

              <div style={{ fontSize:12, color:'var(--text3)', marginBottom:14 }}>
                * Kaydınız yönetici onayından sonra aktif olacaktır.
              </div>

              <button type="submit" className="btn btn-primary" style={{ width:'100%', justifyContent:'center', padding:'12px 0', fontSize:15 }} disabled={yukleniyor}>
                {yukleniyor ? 'Kaydediliyor...' : 'Kayıt Ol'}
              </button>
            </form>
          </div>
        )}

        {/* Geri butonu */}
        {ekran !== 'ana' && (
          <button onClick={geri} style={{ marginTop:18, background:'none', border:'none', color:'var(--text2)', fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', gap:5, margin:'18px auto 0' }}>
            <i className="ti ti-arrow-left"/> Geri
          </button>
        )}
      </div>
    </div>
  );
}

function KutuBtn({ icon, label, alt, renk, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button type="button" onClick={onClick}
      onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}
      style={{ background:hover?`${renk}12`:'var(--bg2)', border:`2px solid ${hover?renk:'var(--border)'}`, borderRadius:'var(--radius-lg)', padding:'28px 16px', cursor:'pointer', transition:'all 0.2s', transform:hover?'translateY(-4px)':'none', boxShadow:hover?`0 12px 40px ${renk}22`:'none', display:'flex', flexDirection:'column', alignItems:'center', gap:12 }}>
      <div style={{ width:52, height:52, borderRadius:'50%', background:`${renk}18`, display:'flex', alignItems:'center', justifyContent:'center', border:`1.5px solid ${renk}40` }}>
        <i className={`ti ${icon}`} style={{ fontSize:24, color:renk }}/>
      </div>
      <div>
        <div style={{ fontSize:15, fontWeight:700, color:'var(--text)', marginBottom:4 }}>{label}</div>
        <div style={{ fontSize:12, color:'var(--text2)' }}>{alt}</div>
      </div>
    </button>
  );
}
