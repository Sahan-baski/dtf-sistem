import { useState, useEffect, useCallback, useRef } from 'react';
import { urunYonetimiApi } from '../api';
import { useToast } from '../context/ToastContext';

export default function UrunYonetimiPage() {
  const toast = useToast();
  const [kategoriler, setKategoriler] = useState([]);
  const [seciliKategori, setSeciliKategori] = useState('');
  const [aramaGirdi, setAramaGirdi] = useState('');
  const [arama, setArama] = useState('');
  const [sayfa, setSayfa] = useState(1);
  const [toplamSayfa, setToplamSayfa] = useState(1);
  const [toplamUrun, setToplamUrun] = useState(0);
  const [urunler, setUrunler] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [yeniUrunAcik, setYeniUrunAcik] = useState(false);
  const [gruplarAcik, setGruplarAcik] = useState(false);
  const zamanlayici = useRef(null);

  const kategorileriYukle = useCallback(() => {
    urunYonetimiApi.kategoriler().then(r => setKategoriler(r.data)).catch(() => {});
  }, []);

  useEffect(() => { kategorileriYukle(); }, [kategorileriYukle]);

  useEffect(() => {
    clearTimeout(zamanlayici.current);
    zamanlayici.current = setTimeout(() => { setArama(aramaGirdi.trim()); setSayfa(1); }, 400);
    return () => clearTimeout(zamanlayici.current);
  }, [aramaGirdi]);

  const urunleriYukle = useCallback(async () => {
    setYukleniyor(true);
    try {
      const r = await urunYonetimiApi.urunler({ ara: arama || undefined, kategori: seciliKategori || undefined, sayfa });
      setUrunler(r.data.urunler);
      setToplamSayfa(r.data.toplamSayfa);
      setToplamUrun(r.data.toplamUrun);
    } catch (e) { toast(e.response?.data?.hata || 'Ürünler alınamadı', 'error'); }
    finally { setYukleniyor(false); }
  }, [arama, seciliKategori, sayfa]);

  useEffect(() => { urunleriYukle(); }, [urunleriYukle]);

  const handleSil = async (urun) => {
    if (!confirm(`"${urun.ad}" ürününü sitede çöpe taşımak istediğine emin misin?`)) return;
    try { await urunYonetimiApi.urunSil(urun.id); toast('Ürün çöpe taşındı ✓'); urunleriYukle(); }
    catch (e) { toast(e.response?.data?.hata || 'Silinemedi', 'error'); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">🛍️ Ürünler</div>
          <div className="page-sub">mirasgiyim.com'daki ürünler — buradan eklediğin ürün doğrudan sitede yayınlanır</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => setGruplarAcik(true)}><i className="ti ti-ruler-2" />Varyasyon Grupları</button>
          <button className="btn btn-primary" onClick={() => setYeniUrunAcik(true)}><i className="ti ti-plus" />Yeni Ürün Ekle</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <input className="form-input" style={{ maxWidth: 280 }} value={aramaGirdi} onChange={e => setAramaGirdi(e.target.value)} placeholder="Ürün adı ara..." />
        <select className="form-input" style={{ width: 'auto', minWidth: 200 }} value={seciliKategori} onChange={e => { setSeciliKategori(e.target.value); setSayfa(1); }}>
          <option value="">Tüm kategoriler</option>
          {kategoriler.map(k => <option key={k.id} value={k.id}>{k.ad} ({k.sayi})</option>)}
        </select>
        {!!toplamUrun && <span style={{ fontSize: 12, color: 'var(--text3)' }}>{toplamUrun} ürün</span>}
      </div>

      {yukleniyor && <div style={{ textAlign: 'center', color: 'var(--text3)', padding: 40 }}>Yükleniyor...</div>}

      {!yukleniyor && urunler.length === 0 && (
        <div style={{ textAlign: 'center', padding: 50, color: 'var(--text3)', background: 'var(--bg2)', border: '2px dashed var(--border)', borderRadius: 'var(--r-sm)' }}>
          <i className="ti ti-shirt-off" style={{ fontSize: 36, display: 'block', marginBottom: 10 }} />
          Ürün bulunamadı.
        </div>
      )}

      {!yukleniyor && urunler.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
          {urunler.map(u => <UrunKarti key={u.id} urun={u} onSil={() => handleSil(u)} />)}
        </div>
      )}

      {toplamSayfa > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 18 }}>
          <button className="btn btn-secondary btn-sm" disabled={sayfa <= 1} onClick={() => setSayfa(s => s - 1)}><i className="ti ti-chevron-left" />Önceki</button>
          <span style={{ fontSize: 12, color: 'var(--text2)' }}>Sayfa {sayfa} / {toplamSayfa}</span>
          <button className="btn btn-secondary btn-sm" disabled={sayfa >= toplamSayfa} onClick={() => setSayfa(s => s + 1)}>Sonraki<i className="ti ti-chevron-right" /></button>
        </div>
      )}

      {yeniUrunAcik && (
        <YeniUrunModal
          kategoriler={kategoriler}
          onKapat={() => setYeniUrunAcik(false)}
          onEklendi={() => { setYeniUrunAcik(false); kategorileriYukle(); setSayfa(1); urunleriYukle(); }}
          toast={toast}
        />
      )}
      {gruplarAcik && <VaryasyonGruplariModal onKapat={() => setGruplarAcik(false)} toast={toast} />}
    </div>
  );
}

function UrunKarti({ urun, onSil }) {
  return (
    <div className="card" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ width: '100%', aspectRatio: '1', borderRadius: 'var(--r-xs)', background: 'var(--bg3)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {urun.resim
          ? <img src={urun.resim} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <i className="ti ti-photo" style={{ fontSize: 30, color: 'var(--text3)' }} />}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>{urun.ad}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span className={`badge ${urun.tur === 'variable' ? 'badge-indigo' : 'badge-gray'}`}>{urun.tur === 'variable' ? 'Değişken' : 'Basit'}</span>
        {urun.fiyat && <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>{urun.fiyat}₺</span>}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
        {urun.duzenleme_linki && (
          <a href={urun.duzenleme_linki} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
            <i className="ti ti-edit" />Düzenle
          </a>
        )}
        <button className="btn-icon" title="Sil" onClick={onSil}><i className="ti ti-trash" style={{ color: 'var(--red)' }} /></button>
      </div>
    </div>
  );
}

function YeniUrunModal({ kategoriler, onKapat, onEklendi, toast }) {
  const [ad, setAd] = useState('');
  const [kategoriId, setKategoriId] = useState('');
  const [yeniKategoriAcik, setYeniKategoriAcik] = useState(false);
  const [yeniKategoriAdi, setYeniKategoriAdi] = useState('');
  const [aciklama, setAciklama] = useState('');
  const [fiyat, setFiyat] = useState('');
  const [indirimFiyat, setIndirimFiyat] = useState('');
  const [bedenli, setBedenli] = useState(false);
  const [seciliGrupId, setSeciliGrupId] = useState('');
  const [bedenlerMetni, setBedenlerMetni] = useState('');
  const [gruplar, setGruplar] = useState([]);
  const [resimDosya, setResimDosya] = useState(null);
  const [onizleme, setOnizleme] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  useEffect(() => { urunYonetimiApi.varyasyonGruplari().then(r => setGruplar(r.data)).catch(() => {}); }, []);

  const handleGrupSec = (id) => {
    setSeciliGrupId(id);
    const grup = gruplar.find(g => g._id === id);
    if (grup) setBedenlerMetni(grup.bedenler.join(', '));
  };

  const handleResimSec = (e) => {
    const dosya = e.target.files?.[0];
    if (!dosya) return;
    setResimDosya(dosya);
    setOnizleme(URL.createObjectURL(dosya));
  };

  const handleKaydet = async () => {
    if (!ad.trim()) { toast('Ürün adı gerekli', 'error'); return; }
    setKaydediliyor(true);
    try {
      let kId = kategoriId;
      if (yeniKategoriAcik && yeniKategoriAdi.trim()) {
        const r = await urunYonetimiApi.kategoriOlustur(yeniKategoriAdi.trim());
        kId = r.data.id;
      }
      const bedenler = bedenli
        ? bedenlerMetni.split(',').map(b => b.trim()).filter(Boolean)
        : [];

      const fd = new FormData();
      fd.append('ad', ad.trim());
      if (kId) fd.append('kategori_id', kId);
      fd.append('aciklama', aciklama);
      if (fiyat !== '') fd.append('fiyat', fiyat);
      if (indirimFiyat !== '') fd.append('indirim_fiyat', indirimFiyat);
      if (bedenler.length) fd.append('bedenler', JSON.stringify(bedenler));
      if (resimDosya) fd.append('resim', resimDosya);

      await urunYonetimiApi.urunOlustur(fd);
      toast('Ürün sitede yayınlandı ✓');
      onEklendi();
    } catch (e) { toast(e.response?.data?.hata || 'Ürün eklenemedi', 'error'); }
    finally { setKaydediliyor(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onKapat()}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-title">Yeni Ürün Ekle</div>

        <div className="form-group">
          <label className="form-label">Ürün adı</label>
          <input className="form-input" value={ad} onChange={e => setAd(e.target.value)} placeholder="Örn: Fatih Sultan Mehmet Baskılı Tişört" />
        </div>

        <div className="form-group">
          <label className="form-label">Kategori</label>
          {!yeniKategoriAcik ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <select className="form-input" style={{ flex: 1 }} value={kategoriId} onChange={e => setKategoriId(e.target.value)}>
                <option value="">— kategori seç —</option>
                {kategoriler.map(k => <option key={k.id} value={k.id}>{k.ad}</option>)}
              </select>
              <button type="button" className="btn btn-secondary" onClick={() => setYeniKategoriAcik(true)}>+ Yeni</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="form-input" style={{ flex: 1 }} value={yeniKategoriAdi} onChange={e => setYeniKategoriAdi(e.target.value)} placeholder="Yeni kategori adı (örn: İslami Anahtarlık)" />
              <button type="button" className="btn btn-secondary" onClick={() => { setYeniKategoriAcik(false); setYeniKategoriAdi(''); }}>Vazgeç</button>
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">Açıklama</label>
          <textarea className="form-input" rows={3} value={aciklama} onChange={e => setAciklama(e.target.value)} style={{ resize: 'vertical' }} />
        </div>

        <div className="form-group">
          <label className="form-label">Görsel</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {onizleme && <img src={onizleme} alt="" style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover' }} />}
            <input type="file" accept="image/*" onChange={handleResimSec} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Satış fiyatı (₺)</label>
            <input type="number" min="0" step="0.01" className="form-input" value={fiyat} onChange={e => setFiyat(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">İndirimli fiyat (₺)</label>
            <input type="number" min="0" step="0.01" className="form-input" value={indirimFiyat} onChange={e => setIndirimFiyat(e.target.value)} placeholder="—" />
          </div>
        </div>

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
            <input type="checkbox" checked={bedenli} onChange={e => setBedenli(e.target.checked)} />
            Bedenli ürün (varyasyonlu)
          </label>
        </div>

        {bedenli && (
          <>
            <div className="form-group">
              <label className="form-label">Hazır varyasyon grubu</label>
              <select className="form-input" value={seciliGrupId} onChange={e => handleGrupSec(e.target.value)}>
                <option value="">— seçme, elle gir —</option>
                {gruplar.map(g => <option key={g._id} value={g._id}>{g.ad} ({g.bedenler.join(', ')})</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Bedenler (virgülle ayır — istersen değiştir)</label>
              <input className="form-input" value={bedenlerMetni} onChange={e => setBedenlerMetni(e.target.value)} placeholder="Örn: 3-4, 5-6, 7-8, 9-10" />
            </div>
          </>
        )}

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onKapat}>İptal</button>
          <button type="button" className="btn btn-primary" onClick={handleKaydet} disabled={kaydediliyor}>
            <i className="ti ti-check" />{kaydediliyor ? 'Yayınlanıyor...' : 'Siteye Yayınla'}
          </button>
        </div>
      </div>
    </div>
  );
}

function VaryasyonGruplariModal({ onKapat, toast }) {
  const [gruplar, setGruplar] = useState([]);
  const [ad, setAd] = useState('');
  const [bedenler, setBedenler] = useState('');
  const [ekleniyor, setEkleniyor] = useState(false);

  const yukle = useCallback(() => { urunYonetimiApi.varyasyonGruplari().then(r => setGruplar(r.data)).catch(() => {}); }, []);
  useEffect(() => { yukle(); }, [yukle]);

  const handleEkle = async () => {
    if (!ad.trim() || !bedenler.trim()) { toast('Grup adı ve bedenler gerekli', 'error'); return; }
    setEkleniyor(true);
    try {
      await urunYonetimiApi.varyasyonGrubuOlustur(ad.trim(), bedenler);
      setAd(''); setBedenler('');
      yukle();
      toast('Grup eklendi ✓');
    } catch (e) { toast(e.response?.data?.hata || 'Eklenemedi', 'error'); }
    finally { setEkleniyor(false); }
  };

  const handeGuncelle = async (g, yeniAd, yeniBedenler) => {
    try { await urunYonetimiApi.varyasyonGrubuGuncelle(g._id, yeniAd, yeniBedenler); yukle(); toast('Güncellendi ✓'); }
    catch (e) { toast(e.response?.data?.hata || 'Güncellenemedi', 'error'); }
  };

  const handleSil = async (g) => {
    if (!confirm(`"${g.ad}" grubunu silmek istediğine emin misin?`)) return;
    try { await urunYonetimiApi.varyasyonGrubuSil(g._id); yukle(); }
    catch { toast('Silinemedi', 'error'); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onKapat()}>
      <div className="modal" style={{ maxWidth: 540 }}>
        <div className="modal-title">Varyasyon Grupları</div>
        <p style={{ fontSize: 12, color: 'var(--text3)', margin: '-14px 0 16px' }}>
          Ürün eklerken tekrar tekrar yazmamak için hazır beden listeleri — ör. "Çocuk Grubu 1" ya da "Yetişkin Grubu". Bir ürüne eklerken seçtikten sonra yine de elle değiştirebilirsin.
        </p>

        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          <input className="form-input" value={ad} onChange={e => setAd(e.target.value)} placeholder="Grup adı (ör. Çocuk Grubu 1)" style={{ flex: 1 }} />
          <input className="form-input" value={bedenler} onChange={e => setBedenler(e.target.value)} placeholder="3-4, 5-6, 7-8..." style={{ flex: 1 }} />
          <button className="btn btn-primary" onClick={handleEkle} disabled={ekleniyor}>+ Ekle</button>
        </div>

        <div style={{ maxHeight: 320, overflowY: 'auto' }}>
          {gruplar.length === 0 && <div style={{ fontSize: 12, color: 'var(--text3)' }}>Henüz bir grup eklemedin.</div>}
          {gruplar.map(g => (
            <GrupSatiri key={g._id} grup={g} onGuncelle={handeGuncelle} onSil={() => handleSil(g)} />
          ))}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onKapat}>Kapat</button>
        </div>
      </div>
    </div>
  );
}

function GrupSatiri({ grup, onGuncelle, onSil }) {
  const [ad, setAd] = useState(grup.ad);
  const [bedenler, setBedenler] = useState(grup.bedenler.join(', '));
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
      <input className="form-input" style={{ flex: 1, padding: '6px 8px' }} value={ad} onChange={e => setAd(e.target.value)}
        onBlur={() => (ad.trim() !== grup.ad) && onGuncelle(grup, ad.trim(), bedenler)} />
      <input className="form-input" style={{ flex: 1, padding: '6px 8px' }} value={bedenler} onChange={e => setBedenler(e.target.value)}
        onBlur={() => (bedenler !== grup.bedenler.join(', ')) && onGuncelle(grup, ad.trim(), bedenler)} />
      <button className="btn-icon" title="Sil" onClick={onSil}><i className="ti ti-x" style={{ color: 'var(--red)' }} /></button>
    </div>
  );
}
