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
import AyarlarPage from './pages/AyarlarPage';
import IstatistiklerPage from './pages/IstatistiklerPage';
import MusteriPanel from './components/MusteriPanel';

const MENU = [
  { key:'ozet',         label:'Genel Bakış',  icon:'ti-home-2',         roller:['admin','calisan'] },
  { key:'siparisler',   label:'Siparişler',   icon:'ti-clipboard-list', roller:['admin','calisan'] },
  { key:'istatistikler',label:'İstatistikler',icon:'ti-chart-bar',       roller:['admin']           },
  { key:'urunler',      label:'Ürünler',      icon:'ti-shirt',          roller:['admin']           },
  { key:'musteriler',   label:'Müşteriler',   icon:'ti-users',          roller:['admin']           },
  { key:'gorevler',     label:'Görevler',     icon:'ti-checkbox',       roller:['admin','calisan'] },
  { key:'kullanicilar', label:'Kullanıcılar', icon:'ti-user-cog',       roller:['admin']           },
  { key:'ayarlar',      label:'Ayarlar',      icon:'ti-settings',       roller:['admin']           },
];

function YonetimApp() {
  const { kullanici, cikisYap } = useAuth();
  const [aktif, setAktif] = useState('ozet');
  const gorulecek = MENU.filter(m => m.roller.includes(kullanici?.rol));
  const baslarf = (kullanici?.ad || kullanici?.kullanici_adi || 'A')[0].toUpperCase();

  return (
    <>
      <nav className="topnav">
        {/* Logo */}
        <div className="topnav-logo">
          <div className="topnav-logo-badge">D</div>
          <span className="topnav-logo-text">DTF <span>Yönetim</span></span>
        </div>

        {/* Nav links */}
        <div className="topnav-links">
          {gorulecek.map(m => (
            <button key={m.key} className={`nav-link ${aktif===m.key?'active':''}`} onClick={()=>setAktif(m.key)}>
              <i className={`ti ${m.icon}`}/>{m.label}
            </button>
          ))}
        </div>

        {/* Right side */}
        <div className="topnav-right">
          <div style={{ fontSize:12, color:'var(--text2)', marginRight:4, textAlign:'right' }}>
            <div style={{ fontWeight:600, color:'var(--text)', fontSize:13 }}>{kullanici?.ad||kullanici?.kullanici_adi}</div>
            <div style={{ fontSize:11, color:'var(--indigo)' }}>{kullanici?.rol==='admin'?'Yönetici':'Çalışan'}</div>
          </div>
          <div className="user-avatar" title="Çıkış yap" onClick={cikisYap}>{baslarf}</div>
        </div>
      </nav>

      <main className="main-content">
        {aktif==='ozet'          && <OzetPage onSiparislerGit={()=>setAktif('siparisler')}/>}
        {aktif==='siparisler'    && <SiparislerPage/>}
        {aktif==='istatistikler' && <IstatistiklerPage/>}
        {aktif==='urunler'       && <UrunlerPage/>}
        {aktif==='musteriler'    && <MusterilerPage/>}
        {aktif==='gorevler'      && <GorevlerPage/>}
        {aktif==='kullanicilar'  && <KullaniciYonetimiPage/>}
        {aktif==='ayarlar'       && <AyarlarPage/>}
      </main>

      <nav className="bottom-nav">
        {gorulecek.slice(0,5).map(m => (
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
  const baslarf = (kullanici?.ad || kullanici?.kullanici_adi || 'M')[0].toUpperCase();
  return (
    <>
      <nav className="topnav">
        <div className="topnav-logo">
          <div className="topnav-logo-badge">D</div>
          <span className="topnav-logo-text">DTF <span>Yönetim</span></span>
        </div>
        <div className="topnav-right">
          <div style={{ fontSize:12, color:'var(--text2)', marginRight:4, textAlign:'right' }}>
            <div style={{ fontWeight:600, color:'var(--text)', fontSize:13 }}>{kullanici?.firma_adi||kullanici?.ad}</div>
            <div style={{ fontSize:11, color:'var(--green)' }}>Müşteri</div>
          </div>
          <div className="user-avatar" onClick={cikisYap} title="Çıkış">{baslarf}</div>
        </div>
      </nav>
      <main className="main-content"><MusteriPanel/></main>
    </>
  );
}

function AppIci() {
  const { kullanici, yukleniyor } = useAuth();
  if (yukleniyor) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text2)'}}>
      <i className="ti ti-loader-2" style={{fontSize:36,color:'var(--indigo)'}}/>
    </div>
  );
  if (!kullanici) return <LandingPage/>;
  if (kullanici.rol==='musteri') return <MusteriApp/>;
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
