import { useState, useEffect, useCallback, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { uretimTalimatiApi } from '../api';
import { useToast } from '../context/ToastContext';

const DURUMLAR = [
  { key: '', label: 'Tümü' },
  { key: 'processing', label: 'İşlemde' },
  { key: 'on-hold', label: 'Beklemede' },
  { key: 'pending', label: 'Ödeme bekliyor' },
  { key: 'completed', label: 'Tamamlandı' },
];

export default function UretimTalimatiPage() {
  const toast = useToast();
  const [aktifSiparisId, setAktifSiparisId] = useState(null);

  return aktifSiparisId
    ? <SiparisDetay siparisId={aktifSiparisId} onGeri={() => setAktifSiparisId(null)} toast={toast} />
    : <SiparisListesi onSec={setAktifSiparisId} toast={toast} />;
}

function SiparisListesi({ onSec, toast }) {
  const [aramaGirdi, setAramaGirdi] = useState('');
  const [arama, setArama] = useState('');
  const [durum, setDurum] = useState('processing');
  const [sayfa, setSayfa] = useState(1);
  const [toplamSayfa, setToplamSayfa] = useState(1);
  const [siparisler, setSiparisler] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const zamanlayici = useRef(null);

  useEffect(() => {
    clearTimeout(zamanlayici.current);
    zamanlayici.current = setTimeout(() => { setArama(aramaGirdi.trim()); setSayfa(1); }, 400);
    return () => clearTimeout(zamanlayici.current);
  }, [aramaGirdi]);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    try {
      const r = await uretimTalimatiApi.siparisler({ ara: arama || undefined, durum: durum || undefined, sayfa });
      setSiparisler(r.data.siparisler);
      setToplamSayfa(r.data.toplamSayfa);
    } catch (e) { toast(e.response?.data?.hata || 'Siparişler alınamadı', 'error'); }
    finally { setYukleniyor(false); }
  }, [arama, durum, sayfa]);

  useEffect(() => { yukle(); }, [yukle]);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">📦 Üretim Talimatı</div>
          <div className="page-sub">Bir siparişi aç — içindeki her ürün/beden için üretim kutucuğu + kargo etiketi hazırla, yazdır</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <input className="form-input" style={{ maxWidth: 260 }} value={aramaGirdi} onChange={e => setAramaGirdi(e.target.value)} placeholder="Müşteri adı / sipariş no ara..." />
        <div className="filter-row" style={{ marginBottom: 0 }}>
          {DURUMLAR.map(d => (
            <button key={d.key} className={`filter-btn ${durum === d.key ? 'active' : ''}`} onClick={() => { setDurum(d.key); setSayfa(1); }}>{d.label}</button>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <Th>Sipariş No</Th><Th>Müşteri</Th><Th>Tarih</Th><Th>Ürün</Th><Th>Adet</Th><Th>Durum</Th><Th></Th>
              </tr>
            </thead>
            <tbody>
              {yukleniyor && <tr><Td colSpan={7} style={{ textAlign: 'center', color: 'var(--text3)', padding: 24 }}>Yükleniyor...</Td></tr>}
              {!yukleniyor && siparisler.length === 0 && <tr><Td colSpan={7} style={{ textAlign: 'center', color: 'var(--text3)', padding: 24 }}>Sipariş bulunamadı.</Td></tr>}
              {!yukleniyor && siparisler.map(s => (
                <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => onSec(s.id)}>
                  <Td><strong>#{s.numara}</strong></Td>
                  <Td>{s.musteri_adi}</Td>
                  <Td>{s.tarih ? new Date(s.tarih).toLocaleDateString('tr-TR') : '—'}</Td>
                  <Td>{s.kalem_sayisi} çeşit</Td>
                  <Td>{s.kalem_toplam_adet} adet</Td>
                  <Td><span className="badge badge-indigo">{s.durum}</span></Td>
                  <Td><button className="btn btn-secondary btn-sm" onClick={e => { e.stopPropagation(); onSec(s.id); }}><i className="ti ti-printer" />Aç</button></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {toplamSayfa > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 14, borderTop: '1px solid var(--border)' }}>
            <button className="btn btn-secondary btn-sm" disabled={sayfa <= 1} onClick={() => setSayfa(s => s - 1)}><i className="ti ti-chevron-left" />Önceki</button>
            <span style={{ fontSize: 12, color: 'var(--text2)' }}>Sayfa {sayfa} / {toplamSayfa}</span>
            <button className="btn btn-secondary btn-sm" disabled={sayfa >= toplamSayfa} onClick={() => setSayfa(s => s + 1)}>Sonraki<i className="ti ti-chevron-right" /></button>
          </div>
        )}
      </div>
    </div>
  );
}

// Basit Kargo'dan canlı liste alınamazsa (token tanımlı değil vb.) kullanılacak yedek liste.
const KARGO_FIRMALARI_YEDEK = ['Aras Kargo', 'Yurtiçi Kargo', 'MNG Kargo', 'Sürat Kargo', 'PTT Kargo', 'Trendyol Express', 'Hepsijet'];

function SiparisDetay({ siparisId, onGeri, toast }) {
  const [siparis, setSiparis] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [kargoFirmalari, setKargoFirmalari] = useState(KARGO_FIRMALARI_YEDEK);

  const [firmaKodu, setFirmaKodu] = useState('');
  const [firmaAdi, setFirmaAdi] = useState('');
  const [kargoNo, setKargoNo] = useState('');
  const [yukseklik, setYukseklik] = useState('');
  const [genislik, setGenislik] = useState('');
  const [derinlik, setDerinlik] = useState('');
  const [agirlik, setAgirlik] = useState('');

  const [alici, setAlici] = useState({ ad_soyad: '', telefon: '', email: '', il: '', ilce: '', adres_satir: '' });

  const [gonderici, setGonderici] = useState({ ad: '', adres: '', telefon: '' });
  const [gondericiDuzenle, setGondericiDuzenle] = useState(false);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  const [kodPaneliAcik, setKodPaneliAcik] = useState(false);
  const [kodOlusturuluyor, setKodOlusturuluyor] = useState(false);

  useEffect(() => {
    setYukleniyor(true);
    Promise.all([
      uretimTalimatiApi.siparis(siparisId),
      uretimTalimatiApi.gonderici(),
      uretimTalimatiApi.kargoFirmalari().catch(() => ({ data: null })),
    ])
      .then(([sr, gr, fr]) => {
        setSiparis(sr.data);
        const e = sr.data.kargo_etiket;
        if (e) {
          setFirmaAdi(e.firma || ''); setFirmaKodu(e.firma_kodu || ''); setKargoNo(e.kargo_no || '');
          setYukseklik(e.yukseklik || ''); setGenislik(e.genislik || ''); setDerinlik(e.derinlik || ''); setAgirlik(e.agirlik || '');
        }
        setAlici({
          ad_soyad: sr.data.alici?.ad_soyad || '',
          telefon: sr.data.alici?.telefon || '',
          email: sr.data.alici?.email || '',
          il: sr.data.alici?.il || '',
          ilce: sr.data.alici?.ilce || '',
          adres_satir: sr.data.alici?.adres_satir || sr.data.alici?.adres || '',
        });
        setGonderici(gr.data?.ad ? gr.data : { ad: '', adres: '', telefon: '' });
        if (!gr.data?.ad) setGondericiDuzenle(true);
        if (Array.isArray(fr.data) && fr.data.length) setKargoFirmalari(fr.data);
      })
      .catch(e => toast(e.response?.data?.hata || 'Sipariş alınamadı', 'error'))
      .finally(() => setYukleniyor(false));
  }, [siparisId]);

  const handleKargoKaydet = async () => {
    setKaydediliyor(true);
    try {
      await uretimTalimatiApi.kargoEtiketKaydet(siparisId, { firma: firmaAdi, firma_kodu: firmaKodu, kargo_no: kargoNo, yukseklik, genislik, derinlik, agirlik });
      toast('Kargo bilgileri kaydedildi ✓');
    } catch (e) { toast(e.response?.data?.hata || 'Kaydedilemedi', 'error'); }
    finally { setKaydediliyor(false); }
  };

  const handleGondericiKaydet = async () => {
    try { await uretimTalimatiApi.gondericiKaydet(gonderici); setGondericiDuzenle(false); toast('Gönderici bilgisi kaydedildi ✓'); }
    catch (e) { toast(e.response?.data?.hata || 'Kaydedilemedi', 'error'); }
  };

  const handleKodOlustur = async () => {
    if (!firmaKodu) { toast('Önce kargo firması seç', 'error'); return; }
    setKodOlusturuluyor(true);
    try {
      const r = await uretimTalimatiApi.kargoKoduOlustur(siparisId, {
        handlerCode: firmaKodu,
        paket: { yukseklik, genislik, derinlik, agirlik },
        alici,
      });
      setFirmaAdi(r.data.firmaAdi || firmaAdi);
      setKargoNo(r.data.kargoNo || '');
      setKodPaneliAcik(false);
      toast('Basit Kargo kodu oluşturuldu ✓');
    } catch (e) { toast(e.response?.data?.hata || 'Kargo kodu oluşturulamadı', 'error'); }
    finally { setKodOlusturuluyor(false); }
  };

  if (yukleniyor) return <div style={{ textAlign: 'center', color: 'var(--text3)', padding: 60 }}>Yükleniyor...</div>;
  if (!siparis) return null;

  const desiHesap = ((Number(yukseklik) || 0) * (Number(genislik) || 0) * (Number(derinlik) || 0)) / 3000;

  return (
    <div>
      <div className="no-print" style={{ marginBottom: 18 }}>
        <button className="btn btn-secondary btn-sm" onClick={onGeri} style={{ marginBottom: 14 }}><i className="ti ti-arrow-left" />Sipariş listesine dön</button>

        <div className="card" style={{ padding: 16, marginBottom: 12 }}>
          <strong>🚚 Kargo Etiket Bilgileri</strong>
          <p style={{ fontSize: 12, color: 'var(--text3)', margin: '4px 0 12px' }}>Kargo firmasını seç, paket ölçülerini gir. Kodu elle yapıştırabilir ya da "Basit Kargo ile Kod Oluştur" ile gerçek bir gönderi oluşturabilirsin.</p>
          <div className="form-row" style={{ marginBottom: 12 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Kargo Firması</label>
              <select className="form-input" value={firmaKodu} onChange={e => {
                const kod = e.target.value;
                setFirmaKodu(kod);
                const secilen = kargoFirmalari.find(f => (typeof f === 'string' ? f : f.kod) === kod);
                setFirmaAdi(secilen ? (typeof secilen === 'string' ? secilen : secilen.ad) : kod);
              }}>
                <option value="">— seç —</option>
                {kargoFirmalari.map(f => (
                  typeof f === 'string'
                    ? <option key={f} value={f}>{f}</option>
                    : <option key={f.kod} value={f.kod}>{f.ad}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Kargo No</label>
              <input className="form-input" value={kargoNo} onChange={e => setKargoNo(e.target.value)} placeholder="Kod / barkod" />
            </div>
          </div>
          <div className="form-row" style={{ marginBottom: 12 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Yükseklik (cm)</label>
              <input className="form-input" value={yukseklik} onChange={e => setYukseklik(e.target.value)} placeholder="0" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Genişlik (cm)</label>
              <input className="form-input" value={genislik} onChange={e => setGenislik(e.target.value)} placeholder="0" />
            </div>
          </div>
          <div className="form-row" style={{ marginBottom: 12 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Derinlik (cm)</label>
              <input className="form-input" value={derinlik} onChange={e => setDerinlik(e.target.value)} placeholder="0" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Ağırlık (kg)</label>
              <input className="form-input" value={agirlik} onChange={e => setAgirlik(e.target.value)} placeholder="0.00" />
            </div>
          </div>
          {(yukseklik && genislik && derinlik) && (
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>Hesaplanan desi: <strong>{desiHesap.toFixed(2)}</strong></div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-secondary btn-sm" onClick={handleKargoKaydet} disabled={kaydediliyor}>
              <i className="ti ti-device-floppy" />{kaydediliyor ? 'Kaydediliyor...' : 'Bilgileri Kaydet'}
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setKodPaneliAcik(v => !v)}>
              <i className="ti ti-truck-delivery" />Basit Kargo ile Kod Oluştur
            </button>
          </div>

          {kodPaneliAcik && (
            <div style={{ marginTop: 14, padding: 12, border: '1.5px dashed var(--border2)', borderRadius: 8, background: 'var(--bg2)' }}>
              <strong style={{ fontSize: 12.5 }}>Gönderi bilgilerini onayla</strong>
              <p style={{ fontSize: 11.5, color: 'var(--red)', margin: '4px 0 10px', fontWeight: 600 }}>
                Bu işlem gerçek bir kargo gönderisi oluşturur ve geri alınamaz. Onaylamadan önce alıcı bilgilerini kontrol et.
              </p>
              <div className="form-row" style={{ marginBottom: 10 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Ad Soyad</label>
                  <input className="form-input" value={alici.ad_soyad} onChange={e => setAlici(a => ({ ...a, ad_soyad: e.target.value }))} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Telefon</label>
                  <input className="form-input" value={alici.telefon} onChange={e => setAlici(a => ({ ...a, telefon: e.target.value }))} />
                </div>
              </div>
              <div className="form-row" style={{ marginBottom: 10 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">İl</label>
                  <input className="form-input" value={alici.il} onChange={e => setAlici(a => ({ ...a, il: e.target.value }))} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">İlçe</label>
                  <input className="form-input" value={alici.ilce} onChange={e => setAlici(a => ({ ...a, ilce: e.target.value }))} />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 10 }}>
                <label className="form-label">Adres</label>
                <input className="form-input" value={alici.adres_satir} onChange={e => setAlici(a => ({ ...a, adres_satir: e.target.value }))} />
              </div>
              <div className="form-group" style={{ marginBottom: 10 }}>
                <label className="form-label">E-posta</label>
                <input className="form-input" value={alici.email} onChange={e => setAlici(a => ({ ...a, email: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary btn-sm" onClick={handleKodOlustur} disabled={kodOlusturuluyor}>
                  <i className="ti ti-check" />{kodOlusturuluyor ? 'Oluşturuluyor...' : 'Onayla ve Kod Oluştur'}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => setKodPaneliAcik(false)}>Vazgeç</button>
              </div>
            </div>
          )}
        </div>

        <div className="card" style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <strong>🏭 Gönderici Bilgisi</strong>
            {!gondericiDuzenle && <button className="btn-icon" onClick={() => setGondericiDuzenle(true)}><i className="ti ti-edit" /></button>}
          </div>
          {gondericiDuzenle ? (
            <div style={{ marginTop: 10 }}>
              <div className="form-group"><label className="form-label">Ad / Firma</label><input className="form-input" value={gonderici.ad} onChange={e => setGonderici(g => ({ ...g, ad: e.target.value }))} placeholder="Şahan Baskı" /></div>
              <div className="form-group"><label className="form-label">Adres</label><input className="form-input" value={gonderici.adres} onChange={e => setGonderici(g => ({ ...g, adres: e.target.value }))} placeholder="Kayseri / Melikgazi" /></div>
              <div className="form-group" style={{ marginBottom: 10 }}><label className="form-label">Telefon</label><input className="form-input" value={gonderici.telefon} onChange={e => setGonderici(g => ({ ...g, telefon: e.target.value }))} /></div>
              <button className="btn btn-secondary btn-sm" onClick={handleGondericiKaydet}><i className="ti ti-check" />Kaydet</button>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 6 }}>{gonderici.ad} — {gonderici.adres}</div>
          )}
        </div>

        <button className="btn btn-primary" onClick={() => window.print()}><i className="ti ti-printer" />Üretim Talimatını Yazdır</button>
      </div>

      <YazdirmaAlani siparis={siparis} gonderici={gonderici} firma={firmaAdi} kargoNo={kargoNo} desi={(yukseklik && genislik && derinlik) ? desiHesap.toFixed(2) : ''} agirlik={agirlik} />
    </div>
  );
}

function YazdirmaAlani({ siparis, gonderici, firma, kargoNo, desi, agirlik }) {
  const barcodeRef = useRef(null);

  useEffect(() => {
    if (barcodeRef.current && kargoNo) {
      try { JsBarcode(barcodeRef.current, kargoNo, { format: 'CODE128', displayValue: true, fontSize: 13, height: 42, margin: 4 }); }
      catch { /* geçersiz karakter vb. - sessizce yut */ }
    }
  }, [kargoNo]);

  return (
    <div className="yazdir-alani">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .yazdir-alani, .yazdir-alani * { visibility: visible; }
          .yazdir-alani { position: absolute; top: 0; left: 0; }
          .no-print { display: none !important; }
          @page { size: A4; margin: 10mm; }
        }
        .yazdir-alani { width: 190mm; margin: 0 auto; font-family: 'Inter', sans-serif; color: #111; background: #fff; padding: 4mm; box-sizing: border-box; }
        .ut-baslik { display: flex; align-items: baseline; justify-content: space-between; border-bottom: 2px solid #111; padding-bottom: 6mm; margin-bottom: 6mm; }
        .ut-baslik .ad { font-size: 15px; }
        .ut-baslik .ad b { font-size: 16px; }
        .ut-govde::after { content: ''; display: table; clear: both; }
        .ut-etiket { float: right; width: 62mm; margin: 0 0 6mm 6mm; border: 1.5px solid #111; border-radius: 4px; padding: 8px; font-size: 11px; }
        .ut-etiket-baslik { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
        .ut-etiket-baslik b { font-size: 16px; letter-spacing: -0.5px; }
        .ut-etiket-blok { border-top: 1px solid #ccc; padding-top: 5px; margin-top: 5px; }
        .ut-etiket-blok b { display: block; font-size: 9px; text-transform: uppercase; color: #666; letter-spacing: 0.04em; margin-bottom: 2px; }
        .ut-etiket-not { background: #f5f5f5; padding: 5px 7px; font-size: 9.5px; font-weight: 600; margin-top: 6px; border-radius: 3px; }
        .ut-kutu { float: left; width: 40mm; margin: 0 4mm 4mm 0; text-align: center; }
        .ut-kutu-gorsel { width: 100%; aspect-ratio: 1; border: 1px solid #ccc; border-radius: 3px; overflow: hidden; display: flex; align-items: center; justify-content: center; background: #fafafa; }
        .ut-kutu-gorsel img { width: 100%; height: 100%; object-fit: cover; }
        .ut-kutu-etiket { display: flex; justify-content: space-between; font-size: 9px; color: #666; margin: 3px 2px 1px; }
        .ut-kutu-bar { background: #16a34a; color: #fff; font-size: 10px; font-weight: 700; border-radius: 2px; padding: 3px 6px; display: flex; justify-content: space-between; align-items: center; }
        .ut-kargo-firma { font-size: 13px; font-weight: 700; border: 1.5px solid #111; border-radius: 4px; padding: 4px 12px; }
      `}</style>

      <div className="ut-baslik">
        <div className="ad">Adı Soyadı &nbsp; <b>{siparis.musteri_adi}</b></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12 }}>Verilecek Kargo</span>
          <span className="ut-kargo-firma">{firma || '—'}</span>
        </div>
      </div>

      <div className="ut-govde">
        <div className="ut-etiket">
          <div className="ut-etiket-baslik">
            <b>Şahan</b>
            <span style={{ fontSize: 9, color: '#666' }}>GÖNDERİCİ:<br /><b style={{ fontSize: 11 }}>{gonderici.ad || '—'}</b></span>
          </div>
          <div className="ut-etiket-blok">
            <b>ALICI</b>
            <div><b>{siparis.alici?.ad_soyad}</b></div>
            <div>{siparis.alici?.adres}</div>
          </div>
          <div className="ut-etiket-blok">
            <b>KARGO BİLGİLERİ</b>
            <div>Kargo No: {kargoNo || '—'}</div>
            <div>Desi: {desi || '0.00'} &nbsp;|&nbsp; Ağırlık: {agirlik || '0.00'} kg</div>
          </div>
          <div className="ut-etiket-not">KARGO PERSONELİNE NOT:<br />Sipariş No #{siparis.numara} ile birlikte teslim edilmelidir.</div>
          {kargoNo && <svg ref={barcodeRef} style={{ width: '100%', marginTop: 6 }} />}
        </div>

        {siparis.kutular.map(k => (
          <div className="ut-kutu" key={k.kalem_id}>
            <div className="ut-kutu-gorsel">
              {k.gorsel ? <img src={k.gorsel} alt="" /> : <i className="ti ti-shirt" style={{ fontSize: 22, color: '#bbb' }} />}
            </div>
            <div className="ut-kutu-etiket"><span>Beden</span><span>Adet</span></div>
            <div className="ut-kutu-bar">
              <span>{k.beden || '—'}</span>
              <span>{k.adet <= 8 ? '●'.repeat(k.adet) : `×${k.adet}`}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Th({ children }) { return <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, color: 'var(--text3)', fontWeight: 700, whiteSpace: 'nowrap' }}>{children}</th>; }
function Td({ children, colSpan, style }) { return <td colSpan={colSpan} style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', ...style }}>{children}</td>; }
