import { useState } from 'react';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import LandingPage from './pages/LandingPage';
import OzetPage from './pages/OzetPage';
import SiparislerPage from './pages/SiparislerPage';
import GorevlerPage from './pages/GorevlerPage';
import MusterilerPage from './pages/MusterilerPage';
import KullaniciYonetimiPage from './pages/KullaniciYonetimiPage';
import UrunlerPage from './pages/UrunlerPage';

const MENU = [
  { key:'ozet',        label:'Genel Bakış',   icon:'ti-home-2',         roller:['admin','calisan'] },
  { key:'siparisler',  label:'Siparişler',    icon:'ti-clipboard-list', roller:['admin','calisan'] },
  { key:'urunler',     label:'Ürünler',       icon:'ti-shirt',          roller:['admin']           },
  { key:'musteriler',  label:'Müşteriler',    icon:'ti-users',          roller:['admin']           },
  { key:'gorevler',    label:'Görevler',      icon:'ti-checkbox',       roller:['admin','calisan'] },
  { key:'kullanicilar',label:'Kullanıcılar',  icon:'ti-user-cog',       roller:['admin']           },
];

function YonetimApp() {
  const { kullanici, cikisYap } = useAuth();
  const [aktif, setAktif] = useState('ozet');
  const gorulecek = MENU.filter(m => m.roller.includes(kullanici?.rol));

  return (
    <>
      <nav className="topnav">
        <div className="topnav-logo">DTF <span>Yönetim</span></div>
        <div className="topnav-links">
          {gorulecek.map(m => (
            <button key={m.key} className={`nav-link ${aktif===m.key?'active':''}`} onClick={()=>setAktif(m.key)}>
              <i className={`ti ${m.icon}`}/>{m.label}
            </button>
          ))}
        </div>
        <div className="topnav-right">
          <div style={{fontSize:13,color:'var(--text2)',marginRight:8}}>
            <span style={{color:'var(--text)',fontWeight:600}}>{kullanici?.ad||kullanici?.kullanici_adi}</span>
            <span style={{marginLeft:6,fontSize:11,background:'rgba(79,126,248,0.15)',color:'var(--accent)',padding:'2px 8px',borderRadius:10,border:'1px solid rgba(79,126,248,0.3)'}}>
              {kullanici?.rol==='admin'?'Yönetici':'Çalışan'}
            </span>
          </div>
          <button className="btn-icon" onClick={cikisYap} title="Çıkış yap">
            <i className="ti ti-logout" style={{fontSize:16}}/>
          </button>
        </div>
      </nav>
      <main className="main-content">
        {aktif==='ozet'         && <OzetPage/>}
        {aktif==='siparisler'   && <SiparislerPage/>}
        {aktif==='urunler'      && <UrunlerPage/>}
        {aktif==='musteriler'   && <MusterilerPage/>}
        {aktif==='gorevler'     && <GorevlerPage/>}
        {aktif==='kullanicilar' && <KullaniciYonetimiPage/>}
      </main>
      <nav className="bottom-nav">
        {gorulecek.map(m => (
          <button key={m.key} className={`bottom-nav-item ${aktif===m.key?'active':''}`} onClick={()=>setAktif(m.key)}>
            <i className={`ti ${m.icon}`}/>{m.label}
          </button>
        ))}
      </nav>
    </>
  );
}

function MusteriApp() {
  const { kullanici, cikisYap } = useAuth();
  return (
    <>
      <nav className="topnav">
        <div className="topnav-logo">DTF <span>Yönetim</span></div>
        <div className="topnav-right">
          <span style={{fontSize:13,color:'var(--text2)',marginRight:8}}>{kullanici?.firma_adi||kullanici?.ad||kullanici?.kullanici_adi}</span>
          <button className="btn-icon" onClick={cikisYap} title="Çıkış"><i className="ti ti-logout" style={{fontSize:16}}/></button>
        </div>
      </nav>
      <main className="main-content" style={{textAlign:'center',paddingTop:80}}>
        <i className="ti ti-package" style={{fontSize:52,color:'var(--accent)',display:'block',marginBottom:16}}/>
        <div style={{fontSize:22,fontWeight:800,marginBottom:8}}>Hoş geldiniz{kullanici?.firma_adi?`, ${kullanici.firma_adi}`:''}</div>
        <div style={{color:'var(--text2)',fontSize:14}}>Müşteri paneli yakında aktif olacak.</div>
      </main>
    </>
  );
}

function AppIci() {
  const { kullanici, yukleniyor } = useAuth();
  if (yukleniyor) return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text2)'}}><i className="ti ti-loader-2" style={{fontSize:32}}/></div>;
  if (!kullanici) return <LandingPage/>;
  if (kullanici.rol === 'musteri') return <MusteriApp/>;
  return <YonetimApp/>;
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppIci/>
      </ToastProvider>
    </AuthProvider>
  );
}
