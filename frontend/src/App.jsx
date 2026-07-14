import { useState } from 'react';
import { ToastProvider } from './context/ToastContext';
import OzetPage from './pages/OzetPage';
import SiparislerPage from './pages/SiparislerPage';
import GorevlerPage from './pages/GorevlerPage';
import MusterilerPage from './pages/MusterilerPage';

const MENU = [
  { key: 'ozet',      label: 'Günlük Özet',     icon: 'ti-home'           },
  { key: 'siparisler',label: 'Siparişler',       icon: 'ti-clipboard-list' },
  { key: 'musteriler',label: 'Müşteriler',       icon: 'ti-users'          },
  { key: 'gorevler',  label: 'Yapılacaklar',     icon: 'ti-checkbox'       },
];

export default function App() {
  const [aktifSayfa, setAktifSayfa] = useState('ozet');
  return (
    <ToastProvider>
      <div className="app-layout">
        <aside className="sidebar">
          <div className="sidebar-logo">DTF <span>Yönetim</span></div>
          {MENU.map(m => (
            <button key={m.key} className={`nav-item ${aktifSayfa === m.key ? 'active' : ''}`}
              onClick={() => setAktifSayfa(m.key)}>
              <i className={`ti ${m.icon}`} />{m.label}
            </button>
          ))}
          <div style={{ marginTop:'auto', padding:'12px 8px', fontSize:12, color:'var(--text3)' }}>
            v2.0 · DTF Yönetim
          </div>
        </aside>
        <main className="main-content">
          {aktifSayfa === 'ozet'       && <OzetPage />}
          {aktifSayfa === 'siparisler' && <SiparislerPage />}
          {aktifSayfa === 'musteriler' && <MusterilerPage />}
          {aktifSayfa === 'gorevler'   && <GorevlerPage />}
        </main>
      </div>
    </ToastProvider>
  );
}
