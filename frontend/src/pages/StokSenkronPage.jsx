import { useState, useEffect, useCallback, useRef } from 'react';
import { stokSenkronApi } from '../api';
import { useToast } from '../context/ToastContext';

const SINIRSIZ = 99999;

export default function StokSenkronPage() {
  const toast = useToast();
  const [havuzlar, setHavuzlar] = useState([]);
  const [aktifHavuzId, setAktifHavuzId] = useState(null);
  const [tablo, setTablo] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [yeniHavuzAcik, setYeniHavuzAcik] = useState(false);
  const [duzenleAcik, setDuzenleAcik] = useState(false);

  const havuzlariYukle = useCallback(async () => {
    try {
      const r = await stokSenkronApi.havuzlar();
      setHavuzlar(r.data);
      if (!aktifHavuzId && r.data.length) setAktifHavuzId(r.data[0]._id);
    } catch { toast('Tablolar yüklenemedi', 'error'); }
  }, [aktifHavuzId]);

  const tabloyuYukle = useCallback(async () => {
    if (!aktifHavuzId) { setTablo(null); return; }
    setYukleniyor(true);
    try { const r = await stokSenkronApi.tablo(aktifHavuzId); setTablo(r.data); }
    catch { toast('Tablo yüklenemedi', 'error'); }
    finally { setYukleniyor(false); }
  }, [aktifHavuzId]);

  useEffect(() => { havuzlariYukle(); }, []);
  useEffect(() => { tabloyuYukle(); }, [tabloyuYukle]);

  const aktifHavuz = havuzlar.find(h => h._id === aktifHavuzId);

  // Tablo değiştirilir değiştirilmez eski tabloyu hemen temizle - yoksa
  // "Toplam (ortak havuz)" satırındaki kutucuklar (defaultValue ile
  // kontrolsüz input olduğu için) yeni tablo verisi gelene kadar bir önceki
  // tablonun değerlerini göstermeye devam ediyordu.
  const handleTabloDegistir = (id) => { setAktifHavuzId(id); setTablo(null); };

  const handleHavuzSil = async () => {
    if (!aktifHavuz) return;
    if (!confirm(`"${aktifHavuz.etiket}" tablosunu (ve içindeki tüm stok verilerini) tamamen silmek istediğine emin misin? Bu işlem geri alınamaz.`)) return;
    try {
      await stokSenkronApi.havuzSil(aktifHavuz._id);
      toast('Tablo silindi');
      setAktifHavuzId(null);
      havuzlariYukle();
    } catch { toast('Silinemedi', 'error'); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">🔗 Ortak Stok Senkron</div>
          <div className="page-sub">Beden bazlı ortak stok havuzu + DTF kağıt/tasarım stoğu — WooCommerce'e otomatik yansır</div>
        </div>
        <button className="btn btn-primary" onClick={() => setYeniHavuzAcik(true)}><i className="ti ti-plus" />Yeni Tablo Ekle</button>
      </div>

      {havuzlar.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
          <label className="form-label" style={{ margin: 0 }}>Tablo:</label>
          <select className="form-input" style={{ width: 'auto', minWidth: 260 }} value={aktifHavuzId || ''} onChange={e => handleTabloDegistir(e.target.value)}>
            {havuzlar.map(h => <option key={h._id} value={h._id}>{h.etiket} ({h.bedenler.length} beden)</option>)}
          </select>
          <button className="btn btn-secondary" onClick={() => setDuzenleAcik(true)}><i className="ti ti-edit" />Düzenle</button>
          <button className="btn btn-secondary" onClick={handleHavuzSil}><i className="ti ti-trash" style={{ color: 'var(--red)' }} />Sil</button>
        </div>
      )}

      {havuzlar.length === 0 && !yukleniyor && (
        <div style={{ textAlign: 'center', padding: 50, color: 'var(--text3)', background: 'var(--bg2)', border: '2px dashed var(--border)', borderRadius: 'var(--r-sm)' }}>
          <i className="ti ti-table-off" style={{ fontSize: 36, display: 'block', marginBottom: 10 }} />
          Henüz bir tablo oluşturmadın. Yukarıdaki "Yeni Tablo Ekle" ile başla.
        </div>
      )}

      {aktifHavuzId && !tablo && yukleniyor && (
        <div style={{ textAlign: 'center', color: 'var(--text3)', padding: 40 }}>Tablo yükleniyor...</div>
      )}

      {aktifHavuzId && tablo && (
        <HavuzGorunumu
          key={aktifHavuzId}
          havuzId={aktifHavuzId}
          tablo={tablo}
          yukleniyor={yukleniyor}
          onTabloDegisti={setTablo}
          toast={toast}
        />
      )}

      {yeniHavuzAcik && (
        <HavuzFormModal
          onKapat={() => setYeniHavuzAcik(false)}
          onKaydet={(id) => { setYeniHavuzAcik(false); havuzlariYukle(); setAktifHavuzId(id); }}
          toast={toast}
        />
      )}
      {duzenleAcik && aktifHavuz && (
        <HavuzFormModal
          havuz={aktifHavuz}
          onKapat={() => setDuzenleAcik(false)}
          onKaydet={() => { setDuzenleAcik(false); havuzlariYukle(); tabloyuYukle(); }}
          toast={toast}
        />
      )}
    </div>
  );
}

function HavuzFormModal({ havuz, onKapat, onKaydet, toast }) {
  const [etiket, setEtiket] = useState(havuz?.etiket || '');
  const [bedenler, setBedenler] = useState(havuz?.bedenler?.join(', ') || '');
  const [kaydediliyor, setKaydediliyor] = useState(false);

  const handleKaydet = async () => {
    if (!etiket.trim() || !bedenler.trim()) { toast('Tablo adı ve bedenler gerekli', 'error'); return; }
    setKaydediliyor(true);
    try {
      if (havuz) await stokSenkronApi.havuzGuncelle(havuz._id, { etiket: etiket.trim(), bedenler });
      else { const r = await stokSenkronApi.havuzOlustur({ etiket: etiket.trim(), bedenler }); onKaydet(r.data._id); toast('Tablo oluşturuldu ✓'); return; }
      toast('Tablo güncellendi ✓');
      onKaydet();
    } catch (e) { toast(e.response?.data?.hata || 'Hata', 'error'); }
    finally { setKaydediliyor(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onKapat()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-title">{havuz ? 'Tabloyu Düzenle' : 'Yeni Tablo Oluştur'}</div>
        <div className="form-group">
          <label className="form-label">Tablo adı</label>
          <input className="form-input" value={etiket} onChange={e => setEtiket(e.target.value)} placeholder="Örn: Ekru 0 Yaka Çocuk Kısa Kol Tişört Bedenleri" />
        </div>
        <div className="form-group">
          <label className="form-label">Bedenler (virgülle ayır)</label>
          <input className="form-input" value={bedenler} onChange={e => setBedenler(e.target.value)} placeholder="Örn: 3-4,5-6,7-8,9-10,11-12" />
          {havuz && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Mevcut bedenleri kaldırmak veri kaybına yol açabilir — dikkatli ol. Yeni eklenen bedenler 0 stokla başlar.</div>}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onKapat}>İptal</button>
          <button type="button" className="btn btn-primary" onClick={handleKaydet} disabled={kaydediliyor}>
            <i className="ti ti-check" />{kaydediliyor ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  );
}

function HavuzGorunumu({ havuzId, tablo, yukleniyor, onTabloDegisti, toast }) {
  const [mesaj, setMesaj] = useState('');

  const yenile = useCallback(async () => {
    try { const r = await stokSenkronApi.tablo(havuzId); onTabloDegisti(r.data); }
    catch { toast('Tablo yenilenemedi', 'error'); }
  }, [havuzId]);

  const goster = (m, hata) => { setMesaj(m); if (!hata) setTimeout(() => setMesaj(''), 1800); };

  const handleBedenStok = async (beden, miktar) => {
    try { const r = await stokSenkronApi.bedenStokKaydet(havuzId, beden, miktar); onTabloDegisti(r.data); goster('Kaydedildi'); }
    catch (e) { goster(e.response?.data?.hata || 'Hata', true); }
  };

  const handleUrunCikar = async (havuzUrunId) => {
    if (!confirm('Bu tasarımı tablodan kaldırmak istediğine emin misin?')) return;
    try { const r = await stokSenkronApi.urunCikar(havuzId, havuzUrunId); onTabloDegisti(r.data.tablo); }
    catch { toast('Kaldırılamadı', 'error'); }
  };

  const handleBagla = async (havuzUrunId, masterTasarimId) => {
    try { const r = await stokSenkronApi.tasarimBagla(havuzUrunId, masterTasarimId); onTabloDegisti(r.data.tablo); goster('Kaydedildi'); }
    catch (e) { goster(e.response?.data?.hata || 'Hata', true); }
  };

  return (
    <div>
      {mesaj && <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--indigo)' }}>{mesaj}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
        <UrunEklePaneli havuzId={havuzId} onEklendi={onTabloDegisti} toast={toast} />
        <TasarimStoklariPaneli havuzId={havuzId} masterTasarimlar={tablo.master_tasarimlar} onDegisti={onTabloDegisti} goster={goster} />
      </div>

      <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>
        "Tasarım Stoğu" sütunu sadece gösterir, elle girilemez — soldaki "Tasarım Stokları" panelinden değişir. Bir ürünü bir DTF kağıdına bağlamak için "Bağlı Tasarım" sütunundan seçim yap; bağlamazsan ürün "sınırsız" kabul edilir, sadece aşağıdaki havuz (fiziksel ürün) stoğuyla sınırlanır.
      </p>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <Th>Tasarım</Th>
              {tablo.bedenler.map(b => <Th key={b} alt>{b}<br /><Sub>🔒 sitede görünen</Sub></Th>)}
              <Th alt>Toplam<br /><Sub>🔒 sitede görünen</Sub></Th>
              <Th>Tasarım Stoğu<br /><Sub>✏️ gerçek stok</Sub></Th>
              <Th>Bağlı Tasarım<br /><Sub>🔗 isteğe bağlı</Sub></Th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ background: 'var(--bg2)' }}>
              <Td><strong>Toplam (ortak havuz)</strong><br /><Sub>✏️ gerçek stok</Sub></Td>
              {tablo.bedenler.map(b => (
                <Td key={b} className={hucreSinifi(tablo.havuz_stoklari[b])}>
                  <input type="number" min="0" className="form-input" style={{ width: 70, padding: '4px 8px' }}
                    defaultValue={tablo.havuz_stoklari[b]}
                    onBlur={e => handleBedenStok(b, e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && e.target.blur()} />
                </Td>
              ))}
              <Td><strong>{tablo.havuz_toplam}</strong></Td>
              <Td /><Td />
            </tr>

            {tablo.urunler.length === 0 && (
              <tr><Td colSpan={tablo.bedenler.length + 4} style={{ textAlign: 'center', color: 'var(--text3)', padding: 24 }}>Bu tabloya henüz tasarım eklenmedi.</Td></tr>
            )}

            {tablo.urunler.map(u => (
              <tr key={u.id}>
                <Td>
                  {u.duzenleme_linki
                    ? <a href={u.duzenleme_linki} target="_blank" rel="noreferrer" style={{ color: 'var(--blue)' }}>{u.ad}</a>
                    : u.ad}
                  <br />
                  <button className="btn-icon" style={{ fontSize: 11, color: 'var(--red)', padding: '2px 0' }} onClick={() => handleUrunCikar(u.id)}>Tablodan kaldır</button>
                </Td>
                {u.hucreler.map(h => (
                  <Td key={h.beden} className={hucreSinifi(h.gorunen)}>{h.gorunen}</Td>
                ))}
                <Td><strong>{u.toplam}</strong></Td>
                <Td>
                  {u.sinirsiz
                    ? <span className="badge badge-indigo" title="Bağlı olmadığı için sınırsız kabul edilir, sadece havuz stoğuyla sınırlanır.">Sınırsız</span>
                    : <input className="form-input" style={{ width: 70, padding: '4px 8px' }} value={u.tasarim_stogu} disabled title="Bu sütun sadece görüntüler — soldaki 'Tasarım Stokları' panelinden değişir." />}
                </Td>
                <Td>
                  <select className="form-input" style={{ padding: '4px 8px' }} value={u.master_tasarim_id || ''} onChange={e => handleBagla(u.id, e.target.value || null)}>
                    <option value="">— bağlı değil (sınırsız) —</option>
                    {tablo.master_tasarimlar.map(m => <option key={m.id} value={m.id}>{m.ad} ({m.stok} adet)</option>)}
                  </select>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function hucreSinifi(deger) {
  if (deger <= 0) return 'hucre-tukendi';
  if (deger <= 3) return 'hucre-azaliyor';
  return '';
}

function Th({ children, alt }) {
  return <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, color: 'var(--text3)', fontWeight: 700, whiteSpace: 'nowrap', background: alt ? 'var(--bg2)' : 'transparent' }}>{children}</th>;
}
function Td({ children, className, colSpan, style }) {
  const renkli = className === 'hucre-tukendi' ? { background: 'rgba(239,68,68,0.12)', color: 'var(--red)' }
    : className === 'hucre-azaliyor' ? { background: 'rgba(245,158,11,0.12)', color: 'var(--amber)' } : {};
  return <td colSpan={colSpan} style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', ...renkli, ...style }}>{children}</td>;
}
function Sub({ children }) { return <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 400 }}>{children}</span>; }

function UrunEklePaneli({ havuzId, onEklendi, toast }) {
  const [arama, setArama] = useState('');
  const [sonuclar, setSonuclar] = useState([]);
  const [seciliIdler, setSeciliIdler] = useState([]);
  const [ariyor, setAriyor] = useState(false);
  const [ekleniyor, setEkleniyor] = useState(false);
  const zamanlayici = useRef(null);

  useEffect(() => {
    clearTimeout(zamanlayici.current);
    if (!arama.trim()) { setSonuclar([]); return; }
    zamanlayici.current = setTimeout(async () => {
      setAriyor(true);
      try { const r = await stokSenkronApi.wcUrunAra(arama.trim()); setSonuclar(r.data); }
      catch { toast('WooCommerce ürünleri aranamadı', 'error'); }
      finally { setAriyor(false); }
    }, 400);
    return () => clearTimeout(zamanlayici.current);
  }, [arama]);

  const toggle = (id) => setSeciliIdler(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const handleEkle = async () => {
    if (!seciliIdler.length) { toast('Önce en az bir ürün seç', 'error'); return; }
    setEkleniyor(true);
    try {
      const r = await stokSenkronApi.urunEkle(havuzId, seciliIdler);
      onEklendi(r.data.tablo);
      let m = `${r.data.eklenen} ürün eklendi.`;
      if (r.data.hatalar?.length) m += ` (${r.data.hatalar.length} ürün eklenemedi)`;
      toast(m);
      setSeciliIdler([]); setArama(''); setSonuclar([]);
    } catch (e) { toast(e.response?.data?.hata || 'Hata', 'error'); }
    finally { setEkleniyor(false); }
  };

  return (
    <div className="card" style={{ padding: 16 }}>
      <strong>🔍 Tabloya Ürün Ekle</strong>
      <p style={{ fontSize: 12, color: 'var(--text3)', margin: '4px 0 10px' }}>WooCommerce'deki varyasyonlu (bedenli) ürünler arasında ara, birden fazla seçip tek seferde ekle.</p>
      <input className="form-input" value={arama} onChange={e => setArama(e.target.value)} placeholder="Ürün adı yaz..." style={{ marginBottom: 8 }} />
      <div style={{ maxHeight: 180, overflowY: 'auto', marginBottom: 10 }}>
        {ariyor && <div style={{ fontSize: 12, color: 'var(--text3)' }}>Aranıyor...</div>}
        {!ariyor && arama.trim() && sonuclar.length === 0 && <div style={{ fontSize: 12, color: 'var(--text3)' }}>Eklenebilecek ürün bulunamadı.</div>}
        {sonuclar.map(p => (
          <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 2px', fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={seciliIdler.includes(p.id)} onChange={() => toggle(p.id)} />
            {p.ad}
          </label>
        ))}
      </div>
      <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleEkle} disabled={ekleniyor}>
        <i className="ti ti-plus" />{ekleniyor ? 'Ekleniyor...' : `Seçilenleri Tabloya Ekle${seciliIdler.length ? ` (${seciliIdler.length})` : ''}`}
      </button>
    </div>
  );
}

function TasarimStoklariPaneli({ havuzId, masterTasarimlar, onDegisti, goster }) {
  const [ad, setAd] = useState('');
  const [stok, setStok] = useState('');
  const [ekleniyor, setEkleniyor] = useState(false);

  const handleEkle = async () => {
    if (!ad.trim()) { goster('Önce bir tasarım adı yaz', true); return; }
    setEkleniyor(true);
    try {
      const r = await stokSenkronApi.masterTasarimOlustur(ad.trim(), parseInt(stok) || 0, havuzId);
      if (r.data.tablo) onDegisti(r.data.tablo);
      setAd(''); setStok('');
      goster('Kaydedildi');
    } catch (e) { goster(e.response?.data?.hata || 'Hata', true); }
    finally { setEkleniyor(false); }
  };

  const handleAdDegis = async (id, yeniAd) => {
    if (!yeniAd.trim()) { goster('Tasarım adı gerekli', true); return; }
    try { const r = await stokSenkronApi.masterTasarimGuncelle(id, { ad: yeniAd.trim() }, havuzId); if (r.data.tablo) onDegisti(r.data.tablo); goster('Kaydedildi'); }
    catch (e) { goster(e.response?.data?.hata || 'Hata', true); }
  };

  const handleStokDegis = async (id, yeniStok) => {
    try { const r = await stokSenkronApi.masterTasarimGuncelle(id, { stok: parseInt(yeniStok) || 0 }, havuzId); if (r.data.tablo) onDegisti(r.data.tablo); goster('Kaydedildi'); }
    catch (e) { goster(e.response?.data?.hata || 'Hata', true); }
  };

  const handleSil = async (id) => {
    if (!confirm('Bu tasarımı silmek istediğine emin misin? Ona bağlı ürünlerin sayısı, silinmeden önceki son değerde donar.')) return;
    try { const r = await stokSenkronApi.masterTasarimSil(id, havuzId); if (r.data.tablo) onDegisti(r.data.tablo); }
    catch { goster('Silinemedi', true); }
  };

  return (
    <div className="card" style={{ padding: 16 }}>
      <strong>✏️ Tasarım Stokları (DTF kağıtların)</strong>
      <p style={{ fontSize: 12, color: 'var(--text3)', margin: '4px 0 10px' }}>Elindeki her DTF kağıdı/baskı tasarımı için bir satır aç, adını sen belirle, elindeki sayfa/adet sayısını gir. WooCommerce ürünleriyle ilgisi yok — aşağıdaki tablodaki her ürünü "Bağlı Tasarım" sütunundan buradaki bir tasarıma bağlarsın.</p>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <input className="form-input" value={ad} onChange={e => setAd(e.target.value)} placeholder="Tasarım adı (ör. Fatih Sultan Mehmet)" style={{ flex: 1 }} />
        <input className="form-input" type="number" min="0" value={stok} onChange={e => setStok(e.target.value)} placeholder="Adet" style={{ width: 70 }} />
        <button className="btn btn-primary" onClick={handleEkle} disabled={ekleniyor}>+ Ekle</button>
      </div>
      <div style={{ maxHeight: 160, overflowY: 'auto' }}>
        {(!masterTasarimlar || masterTasarimlar.length === 0) && <div style={{ fontSize: 12, color: 'var(--text3)' }}>Henüz bir tasarım eklemedin.</div>}
        {masterTasarimlar?.map(m => (
          <div key={m.id} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
            <input className="form-input" defaultValue={m.ad} style={{ flex: 1, padding: '5px 8px' }} onBlur={e => e.target.value.trim() !== m.ad && handleAdDegis(m.id, e.target.value)} />
            <input className="form-input" type="number" min="0" defaultValue={m.stok} style={{ width: 70, padding: '5px 8px' }} onBlur={e => Number(e.target.value) !== m.stok && handleStokDegis(m.id, e.target.value)} />
            <button className="btn-icon" title="Sil" onClick={() => handleSil(m.id)}><i className="ti ti-x" style={{ color: 'var(--red)' }} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
