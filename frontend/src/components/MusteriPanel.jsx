import { useState, useEffect, useCallback } from 'react';
import { siparisApi, kategoriApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import YeniSiparisModal from './YeniSiparisModal';

const DURUM_LABEL = {
  bekliyor:      { label:'Bekliyor',      cls:'badge-gray',  icon:'ti-clock'        },
  hazirlaniyor:  { label:'Hazırlanıyor',  cls:'badge-amber', icon:'ti-tool'         },
  hazir:         { label:'Hazır',         cls:'badge-blue',  icon:'ti-package'      },
  kargoda:       { label:'Kargoda',       cls:'badge-green', icon:'ti-truck'        },
  teslim_edildi: { label:'Teslim Edildi', cls:'badge-green', icon:'ti-circle-check' },
};

export default function MusteriPanel() {
  const { kullanici } = useAuth();
  const toast = useToast();
  const [sekme, setSekme] = useState('siparisler');
  const [siparisler, setSiparisler] = useState([]);
  const [kategoriler, setKategoriler] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [modalAcik, setModalAcik] = useState(false);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    try {
      const [sipRes, katRes] = await Promise.all([
        siparisApi.getBenim(),
        kategoriApi.getAll(),
      ]);
      setSiparisler(sipRes.data);
      setKategoriler(katRes.data);
    } catch { toast('Yüklenemedi', 'error'); }
    finally { setYukleniyor(false); }
  }, []);

  useEffect(() => { yukle(); }, [yukle]);

  const handleYeniSiparis = async (formData) => {
    try {
      await siparisApi.createMusteri(formData);
      setModalAcik(false);
      toast('Siparişiniz alındı ✓');
      setSekme('siparisler');
      yukle();
    } catch (err) { toast(err.response?.data?.hata || 'Sipariş gönderilemedi', 'error'); }
  };

  const bekleyenler  = siparisler.filter(s => s.durum !== 'teslim_edildi');
  const teslimEdilen = siparisler.filter(s => s.durum === 'teslim_edildi');

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      {/* Karşılama */}
      <div style={{ marginBottom: 24, padding: '20px 0' }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>
          Hoş geldiniz, {kullanici?.firma_adi || kullanici?.ad || 'Müşteri'} 👋
        </div>
        <div style={{ fontSize: 14, color: 'var(--text2)', marginTop: 4 }}>
          {bekleyenler.length} aktif sipariş · {teslimEdilen.length} teslim edildi
        </div>
      </div>

      {/* Tab + Yeni sipariş butonu */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', background: 'var(--bg3)', borderRadius: 'var(--radius-sm)', padding: 4, gap: 2 }}>
          {[['siparisler','Siparişlerim','ti-clipboard-list'], ['gecmis','Geçmiş','ti-history']].map(([key,label,icon]) => (
            <button key={key} onClick={() => setSekme(key)}
              style={{ padding: '7px 16px', border: 'none', borderRadius: 'var(--radius-sm)', background: sekme===key ? 'var(--bg2)' : 'none', color: sekme===key ? 'var(--text)' : 'var(--text2)', fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <i className={`ti ${icon}`}/>{label}
            </button>
          ))}
        </div>
        <button className="btn btn-primary" onClick={() => setModalAcik(true)}>
          <i className="ti ti-plus"/> Sipariş Ver
        </button>
      </div>

      {/* Aktif siparişler */}
      {sekme === 'siparisler' && (
        <>
          {yukleniyor ? (
            <div style={{ textAlign: 'center', color: 'var(--text2)', padding: 40 }}>Yükleniyor...</div>
          ) : bekleyenler.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>
              <i className="ti ti-clipboard-off" style={{ fontSize: 48, display: 'block', marginBottom: 12 }}/>
              <div style={{ fontSize: 16, marginBottom: 8 }}>Aktif sipariş yok</div>
              <button className="btn btn-primary" onClick={() => setModalAcik(true)}>
                <i className="ti ti-plus"/> İlk Siparişini Ver
              </button>
            </div>
          ) : bekleyenler.map(s => <SiparisKarti key={s._id||s.id} s={s}/>)}
        </>
      )}

      {/* Geçmiş */}
      {sekme === 'gecmis' && (
        <>
          {teslimEdilen.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
              <i className="ti ti-history" style={{ fontSize: 36, display: 'block', marginBottom: 8 }}/>
              Henüz teslim edilmiş sipariş yok
            </div>
          ) : teslimEdilen.map(s => <SiparisKarti key={s._id||s.id} s={s}/>)}
        </>
      )}

      {modalAcik && (
        <YeniSiparisModal
          kategoriler={kategoriler}
          isMusteri={true}
          onKapat={() => setModalAcik(false)}
          onKaydet={handleYeniSiparis}
        />
      )}
    </div>
  );
}

function SiparisKarti({ s }) {
  const durum = DURUM_LABEL[s.durum] || DURUM_LABEL.bekliyor;
  const bugun = new Date(); bugun.setHours(0,0,0,0);
  const kalanGun = s.teslim_tarihi
    ? Math.ceil((new Date(s.teslim_tarihi+'T00:00:00') - bugun) / (1000*60*60*24))
    : null;

  return (
    <div className="card" style={{ marginBottom: 12, padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div style={{ flex: 1 }}>
          {/* Başlık */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Sipariş #{s.siparis_no}</span>
            <span className={`badge ${durum.cls}`}>
              <i className={`ti ${durum.icon}`} style={{ fontSize: 10 }}/> {durum.label}
            </span>
          </div>

          {/* Ürün detayı */}
          {s.urunler?.length > 0 && s.urunler[0]?.ad && (
            <div style={{ fontSize: 14, color: 'var(--text)', marginBottom: 6 }}>
              {s.urunler.map((u,i) => <span key={i}>{u.adet>1?`${u.adet}× `:''}{u.ad}</span>)}
            </div>
          )}
          {s.notlar && <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 6 }}>{s.notlar}</div>}

          {/* Teslim tarihi */}
          {s.teslim_tarihi && (
            <div style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              <i className="ti ti-calendar" style={{ color: kalanGun!==null&&kalanGun<=0 ? 'var(--red)' : kalanGun===1 ? 'var(--amber)' : 'var(--text3)', fontSize: 14 }}/>
              <span style={{ color: kalanGun!==null&&kalanGun<=1 ? (kalanGun<=0?'var(--red)':'var(--amber)') : 'var(--text2)' }}>
                Teslim: {new Date(s.teslim_tarihi+'T00:00:00').toLocaleDateString('tr-TR')}
                {kalanGun !== null && kalanGun > 0 && <span style={{ color: 'var(--text3)', marginLeft: 4 }}>({kalanGun} gün)</span>}
                {kalanGun !== null && kalanGun === 0 && <span style={{ color: 'var(--amber)', marginLeft: 4 }}>(Bugün!)</span>}
                {kalanGun !== null && kalanGun < 0 && <span style={{ color: 'var(--red)', marginLeft: 4 }}>({Math.abs(kalanGun)} gün geçti)</span>}
              </span>
            </div>
          )}
        </div>

        {/* Ödeme durumu */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          {s.odeme?.tutar > 0 && (
            <>
              <div style={{ fontSize: 16, fontWeight: 700, color: s.odeme?.odendi ? 'var(--green)' : 'var(--amber)' }}>
                {s.odeme.tutar.toLocaleString('tr-TR')}₺
              </div>
              <div style={{ fontSize: 12, marginTop: 2 }}>
                {s.odeme?.odendi ? (
                  <span style={{ color: 'var(--green)' }}>✓ Ödendi</span>
                ) : s.odeme?.odenen > 0 ? (
                  <span style={{ color: 'var(--amber)' }}>{s.odeme.odenen.toLocaleString('tr-TR')}₺ alındı</span>
                ) : (
                  <span style={{ color: 'var(--text3)' }}>Ödeme bekleniyor</span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
