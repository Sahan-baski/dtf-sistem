import { useState } from 'react';
import { authApi } from '../api';
import { useAuth } from '../context/AuthContext';

// Hangi panel / rol seçildi
// panel: null | 'yonetim' | 'musteri'
// rol:   null | 'admin' | 'calisan' | 'musteri'

export default function LandingPage() {
  const { girisYap } = useAuth();
  const [panel, setPanel]       = useState(null);   // 'yonetim' | 'musteri'
  const [rolTipi, setRolTipi]   = useState(null);   // 'admin' | 'calisan' | 'musteri'
  const [loginAcik, setLoginAcik] = useState(false);
  const [form, setForm]         = useState({ kullanici_adi: '', sifre: '' });
  const [hata, setHata]         = useState('');
  const [yukleniyor, setYukleniyor] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleRolSec = (rol) => {
    setRolTipi(rol);
    setLoginAcik(true);
    setHata('');
    setForm({ kullanici_adi: '', sifre: '' });
  };

  const handleGiris = async (e) => {
    e.preventDefault();
    if (!form.kullanici_adi || !form.sifre) { setHata('Tüm alanları doldurun'); return; }
    setYukleniyor(true); setHata('');
    try {
      const res = await authApi.giris({
        kullanici_adi: form.kullanici_adi,
        sifre: form.sifre,
        rol_tipi: panel,
      });
      girisYap(res.data.token, res.data.kullanici);
    } catch (err) {
      setHata(err.response?.data?.hata || 'Giriş başarısız');
    } finally {
      setYukleniyor(false);
    }
  };

  const geri = () => {
    if (loginAcik) { setLoginAcik(false); setRolTipi(null); return; }
    setPanel(null);
  };

  const ROL_ETIKET = { admin: 'Yönetici', calisan: 'Çalışan', musteri: 'Müşteri' };

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: 24, position: 'relative',
    }}>
      {/* Arka plan deseni */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(ellipse at 20% 50%, rgba(79,126,248,0.07) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(46,204,143,0.05) 0%, transparent 50%)',
      }}/>

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 520, textAlign: 'center' }}>

        {/* Logo */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontSize: 36, fontWeight: 900, color: 'var(--text)', letterSpacing: -1 }}>
            DTF <span style={{ color: 'var(--accent)' }}>Yönetim</span>
          </div>
          <div style={{ fontSize: 14, color: 'var(--text2)', marginTop: 6 }}>
            {!panel && 'Devam etmek için panel seçin'}
            {panel === 'yonetim' && !loginAcik && 'Hesap türünü seçin'}
            {loginAcik && `${ROL_ETIKET[rolTipi] || ''} girişi`}
          </div>
        </div>

        {/* ── Ekran 1: 2 Ana Panel ──────────────────── */}
        {!panel && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <PanelKutu
              icon="ti-settings"
              label="Yönetim Paneli"
              alt="Siparişler, müşteriler, raporlar"
              renk="#4f7ef8"
              onClick={() => setPanel('yonetim')}
            />
            <PanelKutu
              icon="ti-user"
              label="Müşteri Paneli"
              alt="Sipariş takibi ve geçmiş"
              renk="#2ecc8f"
              onClick={() => { setPanel('musteri'); handleRolSec('musteri'); }}
            />
          </div>
        )}

        {/* ── Ekran 2: Yönetim → Yönetici / Çalışan ── */}
        {panel === 'yonetim' && !loginAcik && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <PanelKutu
              icon="ti-crown"
              label="Yönetici"
              alt="Tam erişim"
              renk="#4f7ef8"
              onClick={() => handleRolSec('admin')}
            />
            <PanelKutu
              icon="ti-tools"
              label="Çalışan"
              alt="Üretim & sipariş"
              renk="#f0a500"
              onClick={() => handleRolSec('calisan')}
            />
          </div>
        )}

        {/* ── Ekran 3: Giriş Formu ─────────────────── */}
        {loginAcik && (
          <div style={{
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', padding: 32,
          }}>
            <form onSubmit={handleGiris}>
              <div className="form-group" style={{ textAlign: 'left' }}>
                <label className="form-label">Kullanıcı Adı</label>
                <input className="form-input" value={form.kullanici_adi}
                  onChange={e => set('kullanici_adi', e.target.value)}
                  placeholder="kullanici_adi" style={{ fontSize: 15 }}/>
              </div>
              <div className="form-group" style={{ textAlign: 'left' }}>
                <label className="form-label">Şifre</label>
                <input className="form-input" type="password" value={form.sifre}
                  onChange={e => set('sifre', e.target.value)}
                  placeholder="••••••••" style={{ fontSize: 15 }}/>
              </div>
              {hata && (
                <div style={{ background: 'rgba(232,72,85,0.1)', border: '1px solid rgba(232,72,85,0.3)', borderRadius: 'var(--radius-sm)', padding: '9px 13px', marginBottom: 16, fontSize: 13, color: 'var(--red)', textAlign: 'left' }}>
                  {hata}
                </div>
              )}
              <button type="submit" className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '11px 0', fontSize: 15 }}
                disabled={yukleniyor}>
                {yukleniyor ? 'Giriş yapılıyor...' : 'Giriş Yap'}
              </button>
            </form>
          </div>
        )}

        {/* Geri butonu */}
        {panel && (
          <button onClick={geri} style={{
            marginTop: 20, background: 'none', border: 'none',
            color: 'var(--text2)', fontSize: 13, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5, margin: '20px auto 0',
          }}>
            <i className="ti ti-arrow-left"/> Geri
          </button>
        )}
      </div>
    </div>
  );
}

function PanelKutu({ icon, label, alt, renk, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button type="button" onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? `${renk}12` : 'var(--bg2)',
        border: `2px solid ${hover ? renk : 'var(--border)'}`,
        borderRadius: 'var(--radius-lg)', padding: '32px 20px',
        cursor: 'pointer', transition: 'all 0.2s',
        transform: hover ? 'translateY(-4px)' : 'none',
        boxShadow: hover ? `0 12px 40px ${renk}22` : 'none',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
      }}>
      <div style={{
        width: 56, height: 56, borderRadius: '50%',
        background: `${renk}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: `1.5px solid ${renk}40`,
      }}>
        <i className={`ti ${icon}`} style={{ fontSize: 26, color: renk }}/>
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 12, color: 'var(--text2)' }}>{alt}</div>
      </div>
    </button>
  );
}
