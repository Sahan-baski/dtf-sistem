import { useState, useEffect } from 'react';
import { siparisApi, dosyaApi } from '../api';
import { useToast } from '../context/ToastContext';
import { KAYNAKLAR, KATEGORILER, ASAMA_LABEL } from './YeniSiparisModal';

const ODEME_YONTEM = ['Nakit', 'Havale/EFT', 'Kredi Kartı', 'Kapıda Ödeme'];
const KARGO_FIRMA = ['Yurtiçi', 'Aras', 'MNG', 'PTT', 'Sürat', 'Elden Teslim'];

export default function SiparisDetayModal({ siparis, onKapat, onGuncelle }) {
  const toast = useToast();
  const [aktifSekme, setAktifSekme] = useState('genel');
  const [odeme, setOdeme] = useState(siparis.odeme || {});
  const [kargo, setKargo] = useState(siparis.kargo || {});
  const [dosyalar, setDosyalar] = useState([]);
  const [dosyaYukleniyor, setDosyaYukleniyor] = useState(false);

  useEffect(() => {
    dosyaApi.getAll(siparis.id).then(r => setDosyalar(r.data)).catch(() => {});
  }, [siparis.id]);

  const kaynak = KAYNAKLAR.find(k => k.key === siparis.kaynak);
  const kategoriLabel = KATEGORILER.flatMap(g => g.items).find(i => i.key === siparis.kategori)?.label;

  const handleOdemeKaydet = async () => {
    try {
      await siparisApi.updateOdeme(siparis.id, odeme);
      toast('Ödeme bilgisi güncellendi ✓');
      onGuncelle();
    } catch { toast('Güncelleme hatası', 'error'); }
  };

  const handleKargoKaydet = async () => {
    try {
      await siparisApi.updateKargo(siparis.id, kargo);
      toast('Kargo bilgisi güncellendi ✓');
      onGuncelle();
    } catch { toast('Güncelleme hatası', 'error'); }
  };

  const handleDosyaYukle = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setDosyaYukleniyor(true);
    const formData = new FormData();
    formData.append('dosya', file);
    try {
      await dosyaApi.yukle(siparis.id, formData);
      const r = await dosyaApi.getAll(siparis.id);
      setDosyalar(r.data);
      toast('Dosya yüklendi ✓');
    } catch { toast('Yükleme hatası', 'error'); }
    finally { setDosyaYukleniyor(false); e.target.value = ''; }
  };

  const handleDosyaSil = async (id) => {
    try {
      await dosyaApi.sil(id);
      setDosyalar(d => d.filter(f => f.id !== id));
      toast('Dosya silindi');
    } catch { toast('Silinemedi', 'error'); }
  };

  // WhatsApp şablonu
  const whatsappMesaj = () => {
    const ad = `${siparis.musteri_adi} ${siparis.musteri_soyadi}`.trim();
    return encodeURIComponent(
      `Merhaba ${ad} 👋\n\nSiparişiniz hazır! 🎉\n\nSipariş No: #${siparis.siparis_no}\n\nTeslim için uygun zamanınızı belirtir misiniz?`
    );
  };

  const odemeDurumu = () => {
    const tutar = odeme.tutar || 0;
    const odenen = odeme.odenen || 0;
    if (!tutar) return null;
    if (odeme.odendi || odenen >= tutar) return { text: 'Ödendi', cls: 'badge-green', renk: 'var(--green)' };
    if (odenen > 0) return { text: `${odenen}₺ / ${tutar}₺`, cls: 'badge-amber', renk: 'var(--amber)' };
    return { text: `${tutar}₺ bekliyor`, cls: 'badge-red', renk: 'var(--red)' };
  };

  const od = odemeDurumu();
  const SEKMELER = ['genel', 'ödeme', 'kargo', 'dosyalar'];
  const SEKME_LABEL = { genel: 'Genel', 'ödeme': '💳 Ödeme', kargo: '📦 Kargo', dosyalar: '📎 Dosyalar' };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onKapat()}>
      <div className="modal" style={{ maxWidth: 600 }}>
        {/* Başlık */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)' }}>
              {siparis.musteri_adi} {siparis.musteri_soyadi}
              <span style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 400, marginLeft: 8 }}>#{siparis.siparis_no}</span>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              {kaynak && <span className="badge badge-blue"><i className={`ti ${kaynak.icon}`} /> {kaynak.label}</span>}
              {kategoriLabel && <span className="badge badge-gray">{kategoriLabel}</span>}
              {od && <span className={`badge ${od.cls}`}>{od.text}</span>}
              {siparis.odeme?.fatura_kesildi && <span className="badge badge-green">Fatura ✓</span>}
            </div>
          </div>
          <button className="btn-icon" onClick={onKapat}><i className="ti ti-x" /></button>
        </div>

        {/* Sekmeler */}
        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
          {SEKMELER.map(s => (
            <button key={s} onClick={() => setAktifSekme(s)} style={{
              padding: '8px 14px', border: 'none', background: 'none',
              color: aktifSekme === s ? 'var(--accent)' : 'var(--text2)',
              borderBottom: aktifSekme === s ? '2px solid var(--accent)' : '2px solid transparent',
              fontSize: 13, fontWeight: 500, cursor: 'pointer',
            }}>{SEKME_LABEL[s]}</button>
          ))}
        </div>

        {/* GENEL */}
        {aktifSekme === 'genel' && (
          <div>
            {siparis.musteri_telefon && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <i className="ti ti-phone" style={{ color: 'var(--text3)', fontSize: 16 }} />
                <span>{siparis.musteri_telefon}</span>
                {siparis.durum === 'hazir' && siparis.musteri_telefon && (
                  <a href={`https://wa.me/90${siparis.musteri_telefon.replace(/\D/g,'')}?text=${whatsappMesaj()}`}
                    target="_blank" rel="noreferrer"
                    className="btn btn-sm" style={{ background: '#25D366', color: '#fff', border: 'none', marginLeft: 'auto' }}>
                    <i className="ti ti-brand-whatsapp" /> WhatsApp Bildir
                  </a>
                )}
              </div>
            )}
            {siparis.notlar && (
              <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: 14, fontSize: 13, color: 'var(--text2)' }}>
                <i className="ti ti-notes" /> {siparis.notlar}
              </div>
            )}
            {siparis.urunler?.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Ürünler</div>
                {siparis.urunler.map((u, i) => (
                  <div key={i} style={{ fontSize: 14, color: 'var(--text)', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                    {u.adet > 1 && <span style={{ color: 'var(--accent)', marginRight: 6 }}>{u.adet}×</span>}
                    {u.ad}
                  </div>
                ))}
              </div>
            )}
            {/* Aşamalar */}
            {siparis.asamalar?.length > 0 && (
              <div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Üretim Aşamaları</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {siparis.asamalar.map((a, i) => {
                    const info = ASAMA_LABEL[a.key] || {};
                    return (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                        borderRadius: 'var(--radius-sm)', fontSize: 13,
                        background: a.tamamlandi ? `${info.renk || 'var(--green)'}22` : 'var(--bg3)',
                        border: `1px solid ${a.tamamlandi ? (info.renk || 'var(--green)') : 'var(--border)'}`,
                        color: a.tamamlandi ? (info.renk || 'var(--green)') : 'var(--text2)',
                      }}>
                        <i className={`ti ${a.tamamlandi ? 'ti-circle-check' : (info.icon || 'ti-circle')}`} />
                        {a.label}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ÖDEME */}
        {aktifSekme === 'ödeme' && (
          <div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Toplam Tutar (₺)</label>
                <input className="form-input" type="number" min="0" step="0.01"
                  value={odeme.tutar || ''} onChange={e => setOdeme(o => ({ ...o, tutar: parseFloat(e.target.value) || 0 }))}
                  placeholder="0.00" />
              </div>
              <div className="form-group">
                <label className="form-label">Alınan Ödeme (₺)</label>
                <input className="form-input" type="number" min="0" step="0.01"
                  value={odeme.odenen || ''} onChange={e => setOdeme(o => ({ ...o, odenen: parseFloat(e.target.value) || 0 }))}
                  placeholder="0.00" />
              </div>
            </div>
            {odeme.tutar > 0 && odeme.odenen > 0 && odeme.odenen < odeme.tutar && (
              <div style={{ background: 'rgba(240,165,0,0.1)', border: '1px solid rgba(240,165,0,0.3)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', marginBottom: 14, fontSize: 13, color: 'var(--amber)' }}>
                <i className="ti ti-alert-triangle" /> Kalan tahsilat: <strong>{(odeme.tutar - odeme.odenen).toFixed(2)}₺</strong>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Ödeme Yöntemi</label>
              <select className="form-input" value={odeme.yontem || ''} onChange={e => setOdeme(o => ({ ...o, yontem: e.target.value }))}>
                <option value="">Seçin...</option>
                {ODEME_YONTEM.map(y => <option key={y}>{y}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 20, marginBottom: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                <input type="checkbox" checked={odeme.odendi || false}
                  onChange={e => setOdeme(o => ({ ...o, odendi: e.target.checked }))}
                  style={{ width: 16, height: 16 }} />
                <span style={{ color: odeme.odendi ? 'var(--green)' : 'var(--text)' }}>
                  {odeme.odendi ? '✓ Ödeme Alındı' : 'Ödeme Alındı'}
                </span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                <input type="checkbox" checked={odeme.fatura_kesildi || false}
                  onChange={e => setOdeme(o => ({ ...o, fatura_kesildi: e.target.checked }))}
                  style={{ width: 16, height: 16 }} />
                <span style={{ color: odeme.fatura_kesildi ? 'var(--green)' : 'var(--text)' }}>
                  {odeme.fatura_kesildi ? '✓ Fatura Kesildi' : 'Fatura Kesildi'}
                </span>
              </label>
            </div>
            <div className="form-group">
              <label className="form-label">Ödeme Notu</label>
              <input className="form-input" value={odeme.notlar || ''} onChange={e => setOdeme(o => ({ ...o, notlar: e.target.value }))} placeholder="Banka, açıklama vb." />
            </div>
            <button className="btn btn-primary" onClick={handleOdemeKaydet} style={{ width: '100%' }}>
              <i className="ti ti-device-floppy" /> Kaydet
            </button>
          </div>
        )}

        {/* KARGO */}
        {aktifSekme === 'kargo' && (
          <div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Kargo Firması</label>
                <select className="form-input" value={kargo.firma || ''} onChange={e => setKargo(k => ({ ...k, firma: e.target.value }))}>
                  <option value="">Seçin...</option>
                  {KARGO_FIRMA.map(f => <option key={f}>{f}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Takip Numarası</label>
                <input className="form-input" value={kargo.takip_no || ''}
                  onChange={e => setKargo(k => ({ ...k, takip_no: e.target.value }))}
                  placeholder="Takip kodu..." />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Gönderim Tarihi</label>
              <input className="form-input" type="date" value={kargo.gonderim_tarihi || ''}
                onChange={e => setKargo(k => ({ ...k, gonderim_tarihi: e.target.value }))} />
            </div>
            {kargo.takip_no && (
              <div style={{ background: 'rgba(79,126,248,0.1)', border: '1px solid rgba(79,126,248,0.3)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', marginBottom: 14, fontSize: 13 }}>
                <i className="ti ti-truck" style={{ color: 'var(--accent)' }} /> Takip No: <strong>{kargo.takip_no}</strong>
              </div>
            )}
            <button className="btn btn-primary" onClick={handleKargoKaydet} style={{ width: '100%' }}>
              <i className="ti ti-device-floppy" /> Kaydet
            </button>
          </div>
        )}

        {/* DOSYALAR */}
        {aktifSekme === 'dosyalar' && (
          <div>
            <label style={{ display: 'block', background: 'var(--bg3)', border: '2px dashed var(--border)', borderRadius: 'var(--radius)', padding: '20px', textAlign: 'center', cursor: 'pointer', marginBottom: 16, color: 'var(--text2)', fontSize: 14 }}>
              <i className="ti ti-upload" style={{ fontSize: 24, display: 'block', marginBottom: 6, color: 'var(--accent)' }} />
              {dosyaYukleniyor ? 'Yükleniyor...' : 'Dosya / Görsel Yükle (Logo, PDF, JPG vb.)'}
              <input type="file" style={{ display: 'none' }} onChange={handleDosyaYukle}
                accept=".jpg,.jpeg,.png,.pdf,.ai,.eps,.svg,.zip" disabled={dosyaYukleniyor} />
            </label>
            {dosyalar.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '20px 0', fontSize: 13 }}>
                Henüz dosya yok
              </div>
            ) : (
              dosyalar.map(d => (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <i className="ti ti-file" style={{ fontSize: 20, color: 'var(--accent)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.orijinal_ad}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{(d.boyut / 1024).toFixed(1)} KB</div>
                  </div>
                  <a href={dosyaApi.indirUrl(d.dosya_adi)} download={d.orijinal_ad} className="btn-icon" title="İndir">
                    <i className="ti ti-download" style={{ fontSize: 14 }} />
                  </a>
                  <button className="btn-icon" onClick={() => handleDosyaSil(d.id)} title="Sil">
                    <i className="ti ti-trash" style={{ fontSize: 14 }} />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
