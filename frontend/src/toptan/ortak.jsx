// Toptan sipariş - müşteri ve yönetim panellerinin ortak parçaları.

export const DURUMLAR = {
  odeme_bekliyor: { ad: 'Ödeme Bekleniyor', cls: 'badge-amber', ikon: 'ti-clock' },
  odendi:         { ad: 'Ödendi',           cls: 'badge-blue',  ikon: 'ti-cash' },
  hazirlaniyor:   { ad: 'Hazırlanıyor',     cls: 'badge-indigo', ikon: 'ti-package' },
  uretimde:       { ad: 'Üretimde',         cls: 'badge-purple', ikon: 'ti-printer' },
  kargoda:        { ad: 'Kargoda',          cls: 'badge-green', ikon: 'ti-truck' },
  tamamlandi:     { ad: 'Tamamlandı',       cls: 'badge-green', ikon: 'ti-circle-check' },
  iptal:          { ad: 'İptal',            cls: 'badge-red',   ikon: 'ti-x' },
};

export const tl = (n) => `${(Math.round((n || 0) * 100) / 100).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}₺`;
export const tarih = (d) => d ? new Date(d).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

export function DurumRozeti({ durum }) {
  const d = DURUMLAR[durum] || DURUMLAR.odeme_bekliyor;
  return <span className={`badge ${d.cls}`}><i className={`ti ${d.ikon}`} style={{ fontSize: 10 }} /> {d.ad}</span>;
}

/** Sipariş kalemlerini tablo (havuz) → ürün → beden matrisine çevirir - özet tabloları için. */
export function kalemMatrisi(kalemler) {
  const tablolar = new Map();
  for (const k of kalemler || []) {
    const t = tablolar.get(k.havuz_etiket) || { etiket: k.havuz_etiket, bedenler: [], urunler: new Map() };
    if (!t.bedenler.includes(k.beden)) t.bedenler.push(k.beden);
    const u = t.urunler.get(k.urun_adi) || { ad: k.urun_adi, hucreler: {} };
    const h = u.hucreler[k.beden] || { stok: 0, on: 0 };
    if (k.tip === 'on_siparis') h.on += k.adet; else h.stok += k.adet;
    u.hucreler[k.beden] = h;
    t.urunler.set(k.urun_adi, u);
    tablolar.set(k.havuz_etiket, t);
  }
  const sira = (b) => { const m = /\d+/.exec(b); return m ? parseInt(m[0], 10) : 999; };
  return [...tablolar.values()].map(t => ({ ...t, bedenler: t.bedenler.sort((a, b) => sira(a) - sira(b)), urunler: [...t.urunler.values()] }));
}

/** Sipariş içeriğini tasarım × beden tablosu olarak gösterir (stok yeşil, ön sipariş turuncu). */
export function SiparisMatrisi({ kalemler }) {
  const tablolar = kalemMatrisi(kalemler);
  return tablolar.map(t => (
    <div key={t.etiket} style={{ marginBottom: 12, overflowX: 'auto' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 4 }}>{t.etiket}</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
        <thead>
          <tr>
            <th style={thS}>Tasarım</th>
            {t.bedenler.map(b => <th key={b} style={{ ...thS, textAlign: 'center' }}>{b}</th>)}
            <th style={{ ...thS, textAlign: 'center' }}>Toplam</th>
          </tr>
        </thead>
        <tbody>
          {t.urunler.map(u => {
            const top = Object.values(u.hucreler).reduce((s, h) => s + h.stok + h.on, 0);
            return (
              <tr key={u.ad}>
                <td style={tdS}>{u.ad}</td>
                {t.bedenler.map(b => {
                  const h = u.hucreler[b];
                  return (
                    <td key={b} style={{ ...tdS, textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {h && h.stok > 0 && <span style={{ color: 'var(--green)', fontWeight: 700 }}>{h.stok}</span>}
                      {h && h.stok > 0 && h.on > 0 && ' + '}
                      {h && h.on > 0 && <span style={{ color: 'var(--amber)', fontWeight: 700 }}>{h.on} ön</span>}
                      {!h && <span style={{ color: 'var(--text3)' }}>–</span>}
                    </td>
                  );
                })}
                <td style={{ ...tdS, textAlign: 'center', fontWeight: 700 }}>{top}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  ));
}
const thS = { textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--border2)', color: 'var(--text3)', fontWeight: 600, fontSize: 11.5 };
const tdS = { padding: '6px 8px', borderBottom: '1px solid var(--border)' };

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Yazdırılabilir proforma / sipariş formu - yeni pencerede açar, yazdır diyaloğunu tetikler. */
export function proformaYazdir(sip, notlar = {}) {
  const tablolar = kalemMatrisi(sip.kalemler);
  const birimFiyat = new Map(sip.kalemler.map(k => [k.havuz_etiket, k.birim_fiyat]));
  const tabloHtml = tablolar.map(t => `
    <h3>${esc(t.etiket)} <small>(birim ${esc(tl(birimFiyat.get(t.etiket)))})</small></h3>
    <table><thead><tr><th>Tasarım</th>${t.bedenler.map(b => `<th>${esc(b)}</th>`).join('')}<th>Toplam</th></tr></thead><tbody>
    ${t.urunler.map(u => `<tr><td>${esc(u.ad)}</td>${t.bedenler.map(b => { const h = u.hucreler[b]; return `<td class="c">${h ? `${h.stok || ''}${h.stok && h.on ? ' + ' : ''}${h.on ? h.on + ' ön' : ''}` : '–'}</td>`; }).join('')}<td class="c"><b>${Object.values(u.hucreler).reduce((s, h) => s + h.stok + h.on, 0)}</b></td></tr>`).join('')}
    </tbody></table>`).join('');
  const t = sip.teslimat || {};
  const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Sipariş ${esc(sip.siparis_no)}</title>
<style>body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111;margin:28px;font-size:13px}h1{font-size:20px;margin:0}h3{font-size:14px;margin:18px 0 6px}small{color:#666;font-weight:400}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:5px 7px;text-align:left}th{background:#f3f4f6;font-size:12px}.c{text-align:center}
.ust{display:flex;justify-content:space-between;gap:20px;margin-bottom:16px}.kutu{border:1px solid #ddd;border-radius:6px;padding:10px 12px;min-width:220px}.top td{border:none;padding:3px 0}.top{width:auto;margin-left:auto;margin-top:14px}
.not{margin-top:18px;color:#444;font-size:12px}@media print{body{margin:10mm}}</style></head><body>
<div class="ust"><div><h1>Miras &amp; Şahan — Toptan Sipariş</h1><div style="margin-top:6px">Sipariş No: <b>${esc(sip.siparis_no)}</b><br>Tarih: ${esc(tarih(sip.createdAt))}<br>Durum: ${esc((DURUMLAR[sip.durum] || {}).ad || sip.durum)} · Ödeme: ${sip.odeme && sip.odeme.odendi ? 'Ödendi' : 'Bekleniyor'}</div></div>
<div class="kutu"><b>${esc(t.firma || t.ad_soyad)}</b><br>${t.firma ? esc(t.ad_soyad) + '<br>' : ''}${esc(t.adres)} ${esc(t.il)}<br>${esc(t.telefon)} · ${esc(t.email)}${t.vergi_no ? '<br>VKN/TCKN: ' + esc(t.vergi_no) : ''}</div></div>
${tabloHtml}
<table class="top"><tr><td>Stoktan:</td><td class="c"><b>${sip.stok_adet}</b> adet</td></tr><tr><td>Ön sipariş:</td><td class="c"><b>${sip.on_siparis_adet}</b> adet</td></tr>
<tr><td>Ara toplam:</td><td class="c">${esc(tl(sip.ara_toplam))}</td></tr>
${sip.kademe_indirim_orani ? `<tr><td>Adet indirimi (%${sip.kademe_indirim_orani}):</td><td class="c"></td></tr>` : ''}
${sip.musteri_indirim_orani ? `<tr><td>Müşteri indirimi (%${sip.musteri_indirim_orani}):</td><td class="c"></td></tr>` : ''}
${sip.indirim_tutari ? `<tr><td>Toplam indirim:</td><td class="c">-${esc(tl(sip.indirim_tutari))}</td></tr>` : ''}
<tr><td><b>Genel toplam:</b></td><td class="c"><b>${esc(tl(sip.toplam))}</b></td></tr></table>
<div class="not">${esc(notlar.fiyat_notu || '')}${sip.on_siparis_adet ? `<br>Ön sipariş ürünleri ödeme sonrası üretime alınır${notlar.on_siparis_sure ? ' (tahmini ' + esc(notlar.on_siparis_sure) + ')' : ''}.` : ''}${sip.musteri_notu ? '<br>Not: ' + esc(sip.musteri_notu) : ''}</div>
<script>window.onload=function(){setTimeout(function(){window.print()},300)}</script></body></html>`;
  const w = window.open('', '_blank');
  if (!w) { alert('Yazdırma penceresi açılamadı - tarayıcının açılır pencere engelini kapatın.'); return; }
  w.document.open(); w.document.write(html); w.document.close();
}
