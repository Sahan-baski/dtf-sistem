import { useState, useEffect, useCallback, useRef } from 'react';
import { fiyatApi } from '../api';
import { useToast } from '../context/ToastContext';

export default function FiyatGuncellePage() {
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
  const zamanlayici = useRef(null);

  useEffect(() => {
    fiyatApi.kategoriler().then(r => setKategoriler(r.data)).catch(() => {});
  }, []);

  // Arama kutusuna yazarken 400ms bekle, sonra ara ve sayfayı başa al.
  useEffect(() => {
    clearTimeout(zamanlayici.current);
    zamanlayici.current = setTimeout(() => { setArama(aramaGirdi.trim()); setSayfa(1); }, 400);
    return () => clearTimeout(zamanlayici.current);
  }, [aramaGirdi]);

  const urunleriYukle = useCallback(async () => {
    setYukleniyor(true);
    try {
      const r = await fiyatApi.urunler({ ara: arama || undefined, kategori: seciliKategori || undefined, sayfa });
      setUrunler(r.data.urunler);
      setToplamSayfa(r.data.toplamSayfa);
      setToplamUrun(r.data.toplamUrun);
    } catch (e) { toast(e.response?.data?.hata || 'Ürünler alınamadı', 'error'); }
    finally { setYukleniyor(false); }
  }, [arama, seciliKategori, sayfa]);

  useEffect(() => { urunleriYukle(); }, [urunleriYukle]);

  const handleKaydedildi = (urunId, yeni) => {
    setUrunler(u => u.map(x => x.id === urunId ? { ...x, fiyat: yeni.fiyat, indirim_fiyat: yeni.indirim_fiyat } : x));
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">💰 Fiyat Güncelle</div>
          <div className="page-sub">Ürünleri tek tek WooCommerce panelinden açmadan, tüm bedenlerine aynı anda tek bir fiyat yaz</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          className="form-input"
          style={{ maxWidth: 280 }}
          value={aramaGirdi}
          onChange={e => setAramaGirdi(e.target.value)}
          placeholder="Ürün adı ara..."
        />
        <select
          className="form-input"
          style={{ width: 'auto', minWidth: 200 }}
          value={seciliKategori}
          onChange={e => { setSeciliKategori(e.target.value); setSayfa(1); }}
        >
          <option value="">Tüm kategoriler</option>
          {kategoriler.map(k => <option key={k.id} value={k.id}>{k.ad} ({k.sayi})</option>)}
        </select>
        {!!toplamUrun && <span style={{ fontSize: 12, color: 'var(--text3)' }}>{toplamUrun} ürün</span>}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <Th>Ürün</Th>
                <Th>Tür</Th>
                <Th>Satış Fiyatı (₺)</Th>
                <Th>İndirimli Fiyat (₺)</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {yukleniyor && (
                <tr><Td colSpan={5} style={{ textAlign: 'center', color: 'var(--text3)', padding: 24 }}>Yükleniyor...</Td></tr>
              )}
              {!yukleniyor && urunler.length === 0 && (
                <tr><Td colSpan={5} style={{ textAlign: 'center', color: 'var(--text3)', padding: 24 }}>Ürün bulunamadı.</Td></tr>
              )}
              {!yukleniyor && urunler.map(u => (
                <UrunSatiri key={u.id} urun={u} onKaydedildi={handleKaydedildi} toast={toast} />
              ))}
            </tbody>
          </table>
        </div>

        {toplamSayfa > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 14, borderTop: '1px solid var(--border)' }}>
            <button className="btn btn-secondary btn-sm" disabled={sayfa <= 1} onClick={() => setSayfa(s => s - 1)}>
              <i className="ti ti-chevron-left" />Önceki
            </button>
            <span style={{ fontSize: 12, color: 'var(--text2)' }}>Sayfa {sayfa} / {toplamSayfa}</span>
            <button className="btn btn-secondary btn-sm" disabled={sayfa >= toplamSayfa} onClick={() => setSayfa(s => s + 1)}>
              Sonraki<i className="ti ti-chevron-right" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function UrunSatiri({ urun, onKaydedildi, toast }) {
  const [fiyat, setFiyat] = useState(urun.fiyat ?? '');
  const [indirimFiyat, setIndirimFiyat] = useState(urun.indirim_fiyat ?? '');
  const [kaydediliyor, setKaydediliyor] = useState(false);

  useEffect(() => { setFiyat(urun.fiyat ?? ''); setIndirimFiyat(urun.indirim_fiyat ?? ''); }, [urun.id]);

  const degisti = fiyat !== (urun.fiyat ?? '') || indirimFiyat !== (urun.indirim_fiyat ?? '');

  const handleKaydet = async () => {
    setKaydediliyor(true);
    try {
      const r = await fiyatApi.fiyatGuncelle(urun.id, urun.tur, { fiyat, indirim_fiyat: indirimFiyat });
      onKaydedildi(urun.id, r.data);
      toast('Fiyat güncellendi ✓');
    } catch (e) { toast(e.response?.data?.hata || 'Fiyat güncellenemedi', 'error'); }
    finally { setKaydediliyor(false); }
  };

  return (
    <tr>
      <Td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {urun.resim && <img src={urun.resim} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />}
          {urun.duzenleme_linki
            ? <a href={urun.duzenleme_linki} target="_blank" rel="noreferrer" style={{ color: 'var(--blue)' }}>{urun.ad}</a>
            : <span>{urun.ad}</span>}
        </div>
      </Td>
      <Td>
        <span className={`badge ${urun.tur === 'variable' ? 'badge-indigo' : 'badge-gray'}`}>
          {urun.tur === 'variable' ? 'Değişken (bedenli)' : 'Basit'}
        </span>
      </Td>
      <Td>
        <input type="number" min="0" step="0.01" className="form-input" style={{ width: 100, padding: '5px 8px' }}
          value={fiyat} onChange={e => setFiyat(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && degisti && handleKaydet()} />
      </Td>
      <Td>
        <input type="number" min="0" step="0.01" className="form-input" style={{ width: 100, padding: '5px 8px' }}
          value={indirimFiyat} onChange={e => setIndirimFiyat(e.target.value)} placeholder="—"
          onKeyDown={e => e.key === 'Enter' && degisti && handleKaydet()} />
      </Td>
      <Td>
        <button className="btn btn-primary btn-sm" disabled={!degisti || kaydediliyor} onClick={handleKaydet}>
          <i className="ti ti-check" />{kaydediliyor ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
      </Td>
    </tr>
  );
}

function Th({ children }) {
  return <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, color: 'var(--text3)', fontWeight: 700, whiteSpace: 'nowrap' }}>{children}</th>;
}
function Td({ children, colSpan, style }) {
  return <td colSpan={colSpan} style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', ...style }}>{children}</td>;
}
