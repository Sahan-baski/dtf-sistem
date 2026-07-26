import { useState, useEffect } from 'react';
import { ayarlarApi } from '../api';
import { useToast } from '../context/ToastContext';

export default function AyarlarPage() {
  const toast = useToast();
  const [ayarlar, setAyarlar] = useState({
    gunluk_press_kapasitesi: 180,
    min_teslim_gun: 2,
    baski_hazirlama_gun: 1,
  });
  const [kaydediliyor, setKaydediliyor] = useState(false);

  useEffect(() => {
    ayarlarApi.get().then(r => setAyarlar(r.data)).catch(() => {});
  }, []);

  const set = (k, v) => setAyarlar(a => ({ ...a, [k]: v }));

  const handleKaydet = async () => {
    setKaydediliyor(true);
    try {
      await ayarlarApi.save({
        gunluk_press_kapasitesi: parseInt(ayarlar.gunluk_press_kapasitesi) || 180,
        min_teslim_gun: parseInt(ayarlar.min_teslim_gun) || 2,
        baski_hazirlama_gun: parseInt(ayarlar.baski_hazirlama_gun) || 1,
      });
      toast('Ayarlar kaydedildi ✓');
    } catch { toast('Kayıt hatası', 'error'); }
    finally { setKaydediliyor(false); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">⚙️ Ayarlar</div>
          <div className="page-sub">Sistem ve kapasite ayarları</div>
        </div>
      </div>

      <div style={{ maxWidth: 560 }}>
        {/* Press Kapasitesi */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
            <i className="ti ti-tool" style={{ color: 'var(--accent)', marginRight: 8 }}/>
            Press Kapasitesi
          </div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 18 }}>
            Günlük press makinenizin işleyebileceği maksimum press adedi. Yeni sipariş oluştururken teslim tarihi bu değere göre otomatik hesaplanır.
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">
                Günlük Press Kapasitesi
                <span style={{ color:'var(--text3)', fontWeight:'normal', marginLeft:6 }}>(adet)</span>
              </label>
              <input className="form-input" type="number" min="1" max="9999"
                value={ayarlar.gunluk_press_kapasitesi}
                onChange={e => set('gunluk_press_kapasitesi', e.target.value)}/>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                Örn: 180 = günlük 90 çift yön veya 180 tek yön press
              </div>
            </div>
          </div>

          {/* Görsel gösterim */}
          <div style={{ background: 'var(--bg3)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent)' }}>{ayarlar.gunluk_press_kapasitesi}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)' }}>Toplam press/gün</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--green)' }}>{Math.floor(ayarlar.gunluk_press_kapasitesi / 2)}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)' }}>Çift yön/gün</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--amber)' }}>{Math.ceil(ayarlar.gunluk_press_kapasitesi / 60)}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)' }}>Tahmini saat</div>
            </div>
          </div>
        </div>

        {/* Teslim Süresi */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
            <i className="ti ti-calendar-stats" style={{ color: 'var(--accent)', marginRight: 8 }}/>
            Teslim Süresi Hesabı
          </div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 18 }}>
            Sipariş oluştururken otomatik teslim tarihi nasıl hesaplansın?
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Minimum Teslim (gün)</label>
              <input className="form-input" type="number" min="1" max="30"
                value={ayarlar.min_teslim_gun}
                onChange={e => set('min_teslim_gun', e.target.value)}/>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                İş yokken bile en az bu kadar gün
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Baskı Hazırlama (gün)</label>
              <input className="form-input" type="number" min="0" max="7"
                value={ayarlar.baski_hazirlama_gun}
                onChange={e => set('baski_hazirlama_gun', e.target.value)}/>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                Dosya hazırlama + film çıkışı süresi
              </div>
            </div>
          </div>

          {/* Özet */}
          <div style={{ background: 'var(--bg3)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', fontSize: 13, color: 'var(--text2)' }}>
            <i className="ti ti-info-circle" style={{ color: 'var(--accent)', marginRight: 6 }}/>
            İş yoksa: <strong style={{ color: 'var(--text)' }}>bugün + {ayarlar.min_teslim_gun} gün</strong> teslim tarihi önerilir.
            <br/>
            Her <strong style={{ color: 'var(--text)' }}>{ayarlar.gunluk_press_kapasitesi} press</strong> dolduğunda +1 gün eklenir.
          </div>
        </div>

        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
          onClick={handleKaydet} disabled={kaydediliyor}>
          <i className="ti ti-device-floppy"/>
          {kaydediliyor ? 'Kaydediliyor...' : 'Ayarları Kaydet'}
        </button>
      </div>
    </div>
  );
}
