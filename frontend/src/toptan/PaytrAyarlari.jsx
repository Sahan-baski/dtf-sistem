/**
 * PayTR (kartla ödeme) bağlantı ayarları - hem Ayarlar sayfasında hem de
 * Miras Sipariş Alanı → Ödeme / PayTR sekmesinde kullanılır.
 * Gizli anahtarlar sunucudan asla geri gelmez; sadece "girildi" bilgisi gösterilir.
 */
import { useState, useEffect, useCallback } from 'react';
import { toptanApi } from '../api';
import { useToast } from '../context/ToastContext';

export default function PaytrAyarlari() {
  const toast = useToast();
  const [veri, setVeri] = useState(null);
  const [form, setForm] = useState({ merchant_id: '', merchant_key: '', merchant_salt: '', test_modu: true, site_ortak: true });
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [test, setTest] = useState(null); // { basarili, mesaj } | 'bekliyor'

  const yukle = useCallback(async () => {
    const r = await toptanApi.admin.paytrGetir();
    setVeri(r.data);
    setForm({ merchant_id: r.data.paytr.merchant_id || '', merchant_key: '', merchant_salt: '', test_modu: r.data.paytr.test_modu, site_ortak: r.data.paytr.site_ortak !== false });
  }, []);
  useEffect(() => { yukle().catch(() => toast('PayTR ayarları yüklenemedi', 'error')); }, [yukle]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!veri) return <div className="card" style={{ padding: 22, color: 'var(--text3)' }}>PayTR ayarları yükleniyor…</div>;
  const p = veri.paytr;

  const kaydet = async () => {
    setKaydediliyor(true); setTest(null);
    try { await toptanApi.admin.paytrKaydet(form); toast('PayTR bilgileri kaydedildi ✓'); await yukle(); }
    catch (e) { toast(e.response?.data?.hata || 'Kaydedilemedi', 'error'); }
    finally { setKaydediliyor(false); }
  };
  const testEt = async () => {
    setTest('bekliyor');
    try { setTest((await toptanApi.admin.paytrTest()).data); }
    catch (e) { setTest({ basarili: false, mesaj: e.response?.data?.hata || 'Test yapılamadı' }); }
  };
  const kopyala = () => navigator.clipboard?.writeText(veri.bildirim_url).then(() => toast('Bildirim URL kopyalandı'), () => {});

  return (
    <div className="card" style={{ padding: 22, borderTop: `3px solid ${p.hazir ? 'var(--green)' : 'var(--amber)'}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
        <div style={{ fontSize: 15, fontWeight: 800 }}><i className="ti ti-credit-card" style={{ marginRight: 8, color: 'var(--indigo)' }} />PayTR ile Kartla Ödeme</div>
        {p.hazir
          ? <span className="badge badge-green">bağlı{p.test_modu ? ' · test modu' : ' · canlı'}</span>
          : <span className="badge badge-amber">bağlı değil</span>}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>
        Bağlanınca Miras Sipariş Alanı'nda müşteriye <b>"Kartla Öde"</b> butonu çıkar; ödeme gelince sipariş kendiliğinden "Ödendi" olur.
      </div>

      <Adim no="1" baslik="PayTR'dan bilgileri al">
        PayTR Mağaza Paneli'ne ana kullanıcıyla gir → <b>Destek &amp; Kurulum → Bilgi</b> sayfası
        (<a href="https://www.paytr.com/magaza/bilgi" target="_blank" rel="noreferrer">paytr.com/magaza/bilgi</a>).
        Oradaki <b>Mağaza No</b>, <b>Mağaza Parola</b> ve <b>Mağaza Gizli Anahtar</b> değerlerini aşağıya yapıştır.
      </Adim>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, margin: '0 0 16px 34px' }}>
        <div>
          <label className="form-label">Mağaza No (merchant_id)</label>
          <input className="form-input" value={form.merchant_id} inputMode="numeric" onChange={e => setForm(f => ({ ...f, merchant_id: e.target.value.trim() }))} />
        </div>
        <div>
          <label className="form-label">Mağaza Parola (merchant_key)</label>
          <input className="form-input" type="password" autoComplete="new-password" value={form.merchant_key}
            placeholder={p.merchant_key_girildi ? '•••••• kayıtlı - değiştirmek için yaz' : ''} onChange={e => setForm(f => ({ ...f, merchant_key: e.target.value }))} />
        </div>
        <div>
          <label className="form-label">Mağaza Gizli Anahtar (merchant_salt)</label>
          <input className="form-input" type="password" autoComplete="new-password" value={form.merchant_salt}
            placeholder={p.merchant_salt_girildi ? '•••••• kayıtlı - değiştirmek için yaz' : ''} onChange={e => setForm(f => ({ ...f, merchant_salt: e.target.value }))} />
        </div>
      </div>

      <Adim no="2" baslik="Bu PayTR mağazası başka yerde de kullanılıyor mu?">
        <div style={{ display: 'grid', gap: 6, margin: '4px 0 8px' }}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer' }}>
            <input type="radio" name="paytr_site_ortak" checked={form.site_ortak} onChange={() => setForm(f => ({ ...f, site_ortak: true }))} style={{ marginTop: 3 }} />
            <span><b style={{ color: 'var(--text)' }}>Evet, mirascocuk.com'a bağlı</b> (sitede de bu mağazayla kart ödemesi alınıyor)</span>
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer' }}>
            <input type="radio" name="paytr_site_ortak" checked={!form.site_ortak} onChange={() => setForm(f => ({ ...f, site_ortak: false }))} style={{ marginTop: 3 }} />
            <span><b style={{ color: 'var(--text)' }}>Hayır</b>, bu mağaza sadece bu panel için</span>
          </label>
        </div>
        {form.site_ortak ? (
          <div style={{ background: 'rgba(217,119,6,0.08)', borderRadius: 'var(--r-xs)', padding: '10px 12px' }}>
            <b style={{ color: 'var(--amber)' }}>PayTR'daki Bildirim URL'sini DEĞİŞTİRME</b> - PayTR'da tek bildirim adresi olur ve o adres sitenin ödemeleri için gerekli.
            Bu paneldeki ödemeler PayTR'a <b>durum sorgusuyla</b> doğrulanır: müşteri ödemeyi bitirince anında, ayrıca her 10 dakikada bir. Bu panelin sipariş numaraları "MSA" ile başlar, sitedeki siparişlerle karışmaz.
            <div style={{ marginTop: 6 }}>
              Sitedeki <b>Mağaza Görünümü</b> eklentisini <b>1.7.1</b>'e güncelle - bu ödemelerin bildirimlerini WooCommerce'e ulaşmadan karşılar.
              İstersen eklentinin ayarlarındaki <b>"dtf-sistem bildirim adresi"</b> alanına bu adresi yaz, onay anında gelir (zorunlu değil):
            </div>
          </div>
        ) : (
          <>PayTR panelinde <b>Destek &amp; Kurulum → Ayarlar → Bildirim URL Ayarı → Değiştir</b>{' '}
          (<a href="https://www.paytr.com/magaza/ayarlar" target="_blank" rel="noreferrer">paytr.com/magaza/ayarlar</a>) - bu adresi yapıştırıp kaydet.</>
        )}
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <input className="form-input" readOnly value={veri.bildirim_url} onFocus={e => e.target.select()} style={{ fontFamily: 'monospace', fontSize: 12 }} />
          <button className="btn btn-secondary btn-sm" onClick={kopyala}><i className="ti ti-copy" />Kopyala</button>
        </div>
      </Adim>

      <Adim no="3" baslik="Kaydet ve bağlantıyı test et">
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, cursor: 'pointer', margin: '4px 0 10px' }}>
          <input type="checkbox" checked={form.test_modu} onChange={e => setForm(f => ({ ...f, test_modu: e.target.checked }))} />
          Test modu (gerçek para çekilmez - PayTR'ın test kartlarıyla denenir)
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={kaydet} disabled={kaydediliyor}><i className="ti ti-device-floppy" />{kaydediliyor ? 'Kaydediliyor…' : 'Kaydet'}</button>
          <button className="btn btn-secondary" onClick={testEt} disabled={!p.hazir || test === 'bekliyor'} title={!p.hazir ? 'Önce bilgileri kaydet' : ''}>
            <i className="ti ti-plug-connected" />{test === 'bekliyor' ? 'Test ediliyor…' : 'Bağlantıyı test et'}
          </button>
        </div>
        {test && test !== 'bekliyor' && (
          <div style={{ marginTop: 10, padding: '9px 12px', borderRadius: 'var(--r-xs)', fontSize: 13, fontWeight: 600,
            background: test.basarili ? 'rgba(5,150,105,0.1)' : 'rgba(220,38,38,0.08)', color: test.basarili ? 'var(--green)' : 'var(--red)' }}>
            {test.basarili ? '✓ ' : '✗ '}{test.mesaj}
          </div>
        )}
      </Adim>

      <Adim no="4" baslik="Gerçek ödemeye geç" son>
        Test modundayken Miras Sipariş Alanı'nda bir sipariş verip PayTR test kartıyla öde; sipariş "Ödendi"ye geçiyorsa her şey tamam.
        Sonra <b>test modunun işaretini kaldırıp kaydet</b> - artık gerçek ödeme alınır. (PayTR mağazanın canlıya alınmış olması gerekir.)
      </Adim>
    </div>
  );
}

function Adim({ no, baslik, children, son }) {
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: son ? 0 : 14 }}>
      <div style={{ width: 22, height: 22, borderRadius: 999, background: 'var(--indigo)', color: '#fff', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{no}</div>
      <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
        <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{baslik}</div>
        {children}
      </div>
    </div>
  );
}
