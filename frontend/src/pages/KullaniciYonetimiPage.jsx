import { useState, useEffect, useCallback } from 'react';
import { authApiEk } from '../api';
import { useToast } from '../context/ToastContext';

const ROL = {
  admin:    { label: 'Yönetici', cls: 'badge-blue',  renk: '#4f7ef8' },
  calisan:  { label: 'Çalışan',  cls: 'badge-amber', renk: '#f0a500' },
  musteri:  { label: 'Müşteri',  cls: 'badge-green', renk: '#2ecc8f' },
};

export default function KullaniciYonetimiPage() {
  const toast = useToast();
  const [kullanicilar, setKullanicilar] = useState([]);
  const [modalAcik, setModalAcik] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [form, setForm] = useState({ kullanici_adi:'', sifre:'', ad:'', soyad:'', rol:'calisan', firma_adi:'', telefon:'', email:'' });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const yukle = useCallback(async () => {
    try { const r = await authApiEk.kullanicilar(); setKullanicilar(r.data); }
    catch { toast('Yüklenemedi','error'); }
    finally { setYukleniyor(false); }
  }, []);

  useEffect(() => { yukle(); }, [yukle]);

  const handleEkle = async (e) => {
    e.preventDefault();
    if (!form.kullanici_adi || !form.sifre) { toast('Kullanıcı adı ve şifre zorunlu','error'); return; }
    try {
      await authApiEk.kullaniciEkle(form);
      toast('Kullanıcı eklendi ✓');
      setModalAcik(false);
      setForm({ kullanici_adi:'', sifre:'', ad:'', soyad:'', rol:'calisan', firma_adi:'', telefon:'', email:'' });
      yukle();
    } catch (err) { toast(err.response?.data?.hata || 'Hata','error'); }
  };

  const handleOnayla = async (id, aktif, onay_bekliyor) => {
    try {
      await authApiEk.kullaniciGuncelle(id, { aktif, onay_bekliyor });
      toast(aktif ? 'Hesap onaylandı ✓' : 'Hesap pasife alındı');
      yukle();
    } catch { toast('Hata','error'); }
  };

  const handleSil = async (id) => {
    if (!confirm('Bu kullanıcıyı silmek istediğinize emin misiniz?')) return;
    try { await authApiEk.kullaniciSil(id); toast('Silindi'); yukle(); }
    catch { toast('Silinemedi','error'); }
  };

  const bekleyenler = kullanicilar.filter(u => u.onay_bekliyor);
  const aktifler   = kullanicilar.filter(u => !u.onay_bekliyor && u.aktif);
  const pasifler   = kullanicilar.filter(u => !u.onay_bekliyor && !u.aktif);

  const KullaniciKarti = ({ u }) => (
    <div className="card" style={{ display:'flex', alignItems:'center', gap:14, padding:'13px 18px', marginBottom:8 }}>
      <div style={{ width:40, height:40, borderRadius:'50%', flexShrink:0, background:`${ROL[u.rol]?.renk}18`, border:`1.5px solid ${ROL[u.rol]?.renk}40`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:700, color:ROL[u.rol]?.renk }}>
        {(u.ad||u.kullanici_adi)?.[0]?.toUpperCase()}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <span style={{ fontWeight:700, fontSize:14 }}>{u.ad} {u.soyad}</span>
          <span style={{ fontSize:12, color:'var(--text3)' }}>@{u.kullanici_adi}</span>
          <span className={`badge ${ROL[u.rol]?.cls}`}>{ROL[u.rol]?.label}</span>
          {u.onay_bekliyor && <span className="badge badge-amber">⏳ Onay bekliyor</span>}
          {!u.aktif && !u.onay_bekliyor && <span className="badge badge-gray">Pasif</span>}
        </div>
        <div style={{ fontSize:12, color:'var(--text2)', marginTop:3, display:'flex', gap:12, flexWrap:'wrap' }}>
          {u.firma_adi && <span><i className="ti ti-building" style={{fontSize:12}}/> {u.firma_adi}</span>}
          {u.telefon   && <span><i className="ti ti-phone"    style={{fontSize:12}}/> {u.telefon}</span>}
          {u.email     && <span><i className="ti ti-mail"     style={{fontSize:12}}/> {u.email}</span>}
        </div>
      </div>
      <div style={{ display:'flex', gap:6, flexShrink:0 }}>
        {u.onay_bekliyor && (
          <button className="btn btn-sm btn-primary" onClick={() => handleOnayla(u._id, true, false)}>
            <i className="ti ti-check"/> Onayla
          </button>
        )}
        {!u.onay_bekliyor && u.aktif && (
          <button className="btn-icon" onClick={() => handleOnayla(u._id, false, false)} title="Pasife al">
            <i className="ti ti-user-off" style={{fontSize:15}}/>
          </button>
        )}
        {!u.aktif && !u.onay_bekliyor && (
          <button className="btn-icon" onClick={() => handleOnayla(u._id, true, false)} title="Aktive et">
            <i className="ti ti-user-check" style={{fontSize:15}}/>
          </button>
        )}
        <button className="btn-icon" onClick={() => handleSil(u._id)} title="Sil">
          <i className="ti ti-trash" style={{fontSize:15}}/>
        </button>
      </div>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">👤 Kullanıcı Yönetimi</div>
          <div className="page-sub">{kullanicilar.length} kullanıcı · {bekleyenler.length} onay bekliyor</div>
        </div>
        <button className="btn btn-primary" onClick={() => setModalAcik(true)}>
          <i className="ti ti-user-plus"/> Kullanıcı Ekle
        </button>
      </div>

      <div className="stats-row" style={{ gridTemplateColumns:'repeat(4,1fr)' }}>
        <div className="stat-card"><div className="stat-num" style={{color:'var(--red)'}}>{bekleyenler.length}</div><div className="stat-label">Onay Bekliyor</div></div>
        <div className="stat-card"><div className="stat-num" style={{color:'var(--accent)'}}>{aktifler.filter(u=>u.rol==='admin').length}</div><div className="stat-label">Yönetici</div></div>
        <div className="stat-card"><div className="stat-num" style={{color:'var(--amber)'}}>{aktifler.filter(u=>u.rol==='calisan').length}</div><div className="stat-label">Çalışan</div></div>
        <div className="stat-card"><div className="stat-num" style={{color:'var(--green)'}}>{aktifler.filter(u=>u.rol==='musteri').length}</div><div className="stat-label">Müşteri</div></div>
      </div>

      {bekleyenler.length > 0 && (
        <>
          <div className="section-divider">⏳ Onay bekleyenler ({bekleyenler.length})</div>
          {bekleyenler.map(u => <KullaniciKarti key={u._id} u={u}/>)}
        </>
      )}

      {aktifler.length > 0 && (
        <>
          <div className="section-divider">✓ Aktif kullanıcılar ({aktifler.length})</div>
          {aktifler.map(u => <KullaniciKarti key={u._id} u={u}/>)}
        </>
      )}

      {pasifler.length > 0 && (
        <>
          <div className="section-divider">○ Pasif kullanıcılar ({pasifler.length})</div>
          {pasifler.map(u => <KullaniciKarti key={u._id} u={u}/>)}
        </>
      )}

      {yukleniyor && <div style={{textAlign:'center',color:'var(--text2)',padding:40}}>Yükleniyor...</div>}

      {/* Kullanıcı Ekle Modalı */}
      {modalAcik && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModalAcik(false)}>
          <div className="modal" style={{maxWidth:500}}>
            <div className="modal-title">👤 Yeni Kullanıcı</div>
            <form onSubmit={handleEkle}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Ad *</label>
                  <input className="form-input" value={form.ad} onChange={e=>set('ad',e.target.value)} placeholder="Ahmet"/>
                </div>
                <div className="form-group">
                  <label className="form-label">Soyad</label>
                  <input className="form-input" value={form.soyad} onChange={e=>set('soyad',e.target.value)} placeholder="Yılmaz"/>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Kullanıcı Adı *</label>
                  <input className="form-input" value={form.kullanici_adi} onChange={e=>set('kullanici_adi',e.target.value)} placeholder="ahmet123"/>
                </div>
                <div className="form-group">
                  <label className="form-label">Şifre *</label>
                  <input className="form-input" type="password" value={form.sifre} onChange={e=>set('sifre',e.target.value)} placeholder="••••••"/>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Rol</label>
                <select className="form-input" value={form.rol} onChange={e=>set('rol',e.target.value)}>
                  <option value="admin">Yönetici</option>
                  <option value="calisan">Çalışan</option>
                  <option value="musteri">Müşteri</option>
                </select>
              </div>
              {form.rol === 'musteri' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Firma Adı</label>
                    <input className="form-input" value={form.firma_adi} onChange={e=>set('firma_adi',e.target.value)} placeholder="ABC Tekstil"/>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Telefon</label>
                      <input className="form-input" value={form.telefon} onChange={e=>set('telefon',e.target.value)} placeholder="05xx xxx xx xx"/>
                    </div>
                    <div className="form-group">
                      <label className="form-label">E-posta</label>
                      <input className="form-input" value={form.email} onChange={e=>set('email',e.target.value)} placeholder="info@firma.com"/>
                    </div>
                  </div>
                </>
              )}
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={()=>setModalAcik(false)}>İptal</button>
                <button type="submit" className="btn btn-primary"><i className="ti ti-check"/> Ekle</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
