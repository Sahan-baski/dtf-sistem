import { useState } from 'react';
import { ToastProvider } from './context/ToastContext';
import OzetPage from './pages/OzetPage';
import SiparislerPage from './pages/SiparislerPage';
import GorevlerPage from './pages/GorevlerPage';
import MusterilerPage from './pages/MusterilerPage';

const MENU = [
  { key:'ozet',       label:'Genel Bakış', icon:'ti-home-2'         },
  { key:'siparisler', label:'Siparişler',  icon:'ti-clipboard-list' },
  { key:'musteriler', label:'Müşteriler',  icon:'ti-users'          },
  { key:'gorevler',   label:'Görevler',    icon:'ti-checkbox'       },
];

export default function App() {
  const [aktif, setAktif] = useState('ozet');
  return (
    <ToastProvider>
      {/* Top Nav */}
      <nav className="topnav">
        <div className="topnav-logo">DTF <span>Yönetim</span></div>
        <div className="topnav-links">
          {MENU.map(m => (
            <button key={m.key} className={`nav-link ${aktif===m.key?'active':''}`} onClick={()=>setAktif(m.key)}>
              <i className={`ti ${m.icon}`}/>{m.label}
            </button>
          ))}
        </div>
      </nav>

      {/* İçerik */}
      <main className="main-content">
        {aktif==='ozet'       && <OzetPage/>}
        {aktif==='siparisler' && <SiparislerPage/>}
        {aktif==='musteriler' && <MusterilerPage/>}
        {aktif==='gorevler'   && <GorevlerPage/>}
      </main>

      {/* Mobil Alt Nav */}
      <nav className="bottom-nav">
        {MENU.map(m => (
          <button key={m.key} className={`bottom-nav-item ${aktif===m.key?'active':''}`} onClick={()=>setAktif(m.key)}>
            <i className={`ti ${m.icon}`}/>
            {m.label}
          </button>
        ))}
      </nav>
    </ToastProvider>
  );
}
