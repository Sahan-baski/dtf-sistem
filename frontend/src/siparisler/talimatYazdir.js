/**
 * Hazırlama talimatı çıktısı: bir A4 sayfasına alt alta 6 sipariş; her sipariş
 * sayfayı soldan sağa kaplayan bir şerit. Solda müşteri/kargo bilgisi, sağda
 * her ürün için ana görsel + beden + adet. İsteğe bağlı son sayfa: tüm
 * siparişlerin tasarım × beden toplamı (baskıya toplu girmek için).
 */
import JsBarcode from 'jsbarcode';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const KAYNAK = { woocommerce: 'SİTE', shopier: 'SHOPIER' };

function barkodSvg(kod) {
  if (!kod) return '';
  try {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    JsBarcode(svg, kod, { format: 'CODE128', displayValue: false, height: 34, margin: 0, width: 1.4 });
    return svg.outerHTML;
  } catch { return ''; }
}

// Ürün sayısına göre kutu boyutu (mm): şerit içi kullanılabilir alan ~132mm × 40mm.
function yerlesim(n) {
  if (n <= 4) return { boyut: 30, satir: 1, max: n };
  if (n <= 6) return { boyut: Math.floor(130 / n) - 3, satir: 1, max: n };
  return { boyut: 12.5, satir: 2, max: 16 };
}

function serit(s) {
  const kalemler = s.kalemler || [];
  const y = yerlesim(kalemler.length);
  const gosterilen = kalemler.slice(0, y.max);
  const kalan = kalemler.length - gosterilen.length;
  const toplamAdet = kalemler.reduce((t, k) => t + (k.adet || 0), 0);
  const tarih = s.tarih ? new Date(s.tarih).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
  const m = s.musteri || {};
  const kargo = s.kargo || {};
  const kutular = gosterilen.map(k => `
    <div class="kutu" style="width:${y.boyut}mm">
      <div class="gorsel" style="width:${y.boyut}mm;height:${y.boyut}mm">${k.gorsel ? `<img src="${esc(k.gorsel)}">` : '<span>görsel yok</span>'}</div>
      <div class="bilgi"><b class="beden">${esc(k.beden || '—')}</b><b class="adet${k.adet > 1 ? ' coklu' : ''}">×${k.adet}</b></div>
      ${y.satir === 1 ? `<div class="ad">${esc(k.ad)}</div>` : ''}
    </div>`).join('');
  return `
  <div class="serit">
    <div class="sol">
      <div class="ust"><span class="tik"></span><b class="no">#${esc(s.numara)}</b><span class="kaynak ${esc(s.kaynak)}">${KAYNAK[s.kaynak] || ''}</span><span class="tarih">${esc(tarih)}</span></div>
      <div class="musteri">${esc(m.ad_soyad || '—')}</div>
      <div class="kucuk">${esc([m.il, m.ilce].filter(Boolean).join(' / '))}${m.telefon ? ` · ${esc(m.telefon)}` : ''}</div>
      <div class="kucuk"><b>${toplamAdet} ürün</b>${kargo.firma ? ` · ${esc(kargo.firma)}` : ''}${kargo.takip_no ? ` · ${esc(kargo.takip_no)}` : ''}</div>
      ${s.musteri_notu ? `<div class="not">Not: ${esc(s.musteri_notu.slice(0, 90))}</div>` : ''}
      ${kargo.barkod ? `<div class="barkod">${barkodSvg(kargo.barkod)}<div>${esc(kargo.barkod)}</div></div>` : ''}
    </div>
    <div class="sag${y.satir === 2 ? ' iki' : ''}">${kutular}${kalan > 0 ? `<div class="fazla">+${kalan} ürün daha<br><small>(siparişi panelden aç)</small></div>` : ''}</div>
  </div>`;
}

function ozetSayfasi(siparisler) {
  const harita = new Map();
  for (const s of siparisler) for (const k of s.kalemler || []) {
    const a = harita.get(k.ad) || { ad: k.ad, gorsel: k.gorsel, bedenler: {}, toplam: 0 };
    const b = k.beden || '—';
    a.bedenler[b] = (a.bedenler[b] || 0) + (k.adet || 0);
    a.toplam += k.adet || 0;
    if (!a.gorsel && k.gorsel) a.gorsel = k.gorsel;
    harita.set(k.ad, a);
  }
  const sira = (b) => { const m = /\d+/.exec(b); return m ? parseInt(m[0], 10) : 999; };
  const bedenler = [...new Set([...harita.values()].flatMap(a => Object.keys(a.bedenler)))].sort((a, b) => sira(a) - sira(b));
  const satirlar = [...harita.values()].sort((a, b) => b.toplam - a.toplam);
  const genelToplam = satirlar.reduce((t, a) => t + a.toplam, 0);
  return `
  <div class="sayfa ozet">
    <div class="baslik"><b>Toplu Ürün Özeti</b><span>${siparisler.length} sipariş · ${genelToplam} ürün · ${new Date().toLocaleDateString('tr-TR')}</span></div>
    <table>
      <thead><tr><th></th><th class="sol-hiza">Ürün</th>${bedenler.map(b => `<th>${esc(b)}</th>`).join('')}<th>Toplam</th></tr></thead>
      <tbody>${satirlar.map(a => `<tr><td class="kucuk-gorsel">${a.gorsel ? `<img src="${esc(a.gorsel)}">` : ''}</td><td class="sol-hiza">${esc(a.ad)}</td>${bedenler.map(b => `<td>${a.bedenler[b] || ''}</td>`).join('')}<td><b>${a.toplam}</b></td></tr>`).join('')}</tbody>
      <tfoot><tr><td></td><td class="sol-hiza"><b>Toplam</b></td>${bedenler.map(b => `<td><b>${satirlar.reduce((t, a) => t + (a.bedenler[b] || 0), 0) || ''}</b></td>`).join('')}<td><b>${genelToplam}</b></td></tr></tfoot>
    </table>
  </div>`;
}

export function talimatYazdir(siparisler, { ozetEkle = true } = {}) {
  const sayfalar = [];
  for (let i = 0; i < siparisler.length; i += 6) sayfalar.push(siparisler.slice(i, i + 6));
  const tarih = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
  const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Hazırlama Talimatı ${esc(tarih)}</title>
<style>
@page { size: A4 portrait; margin: 7mm 8mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; color: #111; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.sayfa { width: 194mm; height: 283mm; page-break-after: always; break-after: page; overflow: hidden; }
.sayfa:last-child { page-break-after: auto; break-after: auto; }
.baslik { height: 7mm; display: flex; justify-content: space-between; align-items: center; font-size: 10.5px; border-bottom: 1.5px solid #111; margin-bottom: 1mm; }
.baslik b { font-size: 12.5px; }
.serit { height: 45.8mm; display: flex; border-bottom: 1px dashed #888; padding: 2mm 0; overflow: hidden; }
.sol { width: 60mm; flex-shrink: 0; padding-right: 3mm; border-right: 1px solid #ddd; display: flex; flex-direction: column; gap: 0.6mm; overflow: hidden; }
.ust { display: flex; align-items: center; gap: 1.5mm; }
.tik { width: 4mm; height: 4mm; border: 1.5px solid #111; border-radius: 1mm; flex-shrink: 0; }
.no { font-size: 14px; }
.kaynak { font-size: 8px; font-weight: 800; padding: 0.4mm 1.4mm; border-radius: 1mm; color: #fff; background: #15803d; }
.kaynak.shopier { background: #7c3aed; }
.tarih { font-size: 9px; color: #555; margin-left: auto; }
.musteri { font-size: 13.5px; font-weight: 800; line-height: 1.15; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.kucuk { font-size: 9.5px; color: #333; line-height: 1.25; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.not { font-size: 9px; background: #fff3cd; padding: 0.6mm 1mm; border-radius: 1mm; line-height: 1.2; max-height: 7mm; overflow: hidden; }
.barkod { margin-top: auto; font-size: 8px; text-align: center; }
.barkod svg { width: 52mm; height: 8mm; display: block; margin: 0 auto; }
.sag { flex: 1; display: flex; flex-wrap: wrap; align-content: flex-start; gap: 2mm 3mm; padding-left: 3mm; overflow: hidden; }
.sag.iki { gap: 1.2mm 2mm; }
.kutu { display: flex; flex-direction: column; }
.gorsel { border: 1px solid #bbb; border-radius: 1.5mm; overflow: hidden; display: flex; align-items: center; justify-content: center; background: #f6f6f6; }
.gorsel img { width: 100%; height: 100%; object-fit: cover; }
.gorsel span { font-size: 7px; color: #999; }
.bilgi { display: flex; justify-content: space-between; align-items: center; margin-top: 0.8mm; gap: 1mm; }
.beden { background: #111; color: #fff; font-size: 10px; padding: 0.3mm 1.6mm; border-radius: 1mm; white-space: nowrap; }
.adet { font-size: 12px; }
.adet.coklu { color: #fff; background: #dc2626; padding: 0 1.4mm; border-radius: 1mm; }
.ad { font-size: 7.5px; color: #444; line-height: 1.15; max-height: 5.5mm; overflow: hidden; margin-top: 0.5mm; }
.sag.iki .beden { font-size: 8px; padding: 0.2mm 1mm; }
.sag.iki .adet { font-size: 9px; }
.fazla { font-size: 10px; font-weight: 700; color: #b91c1c; align-self: center; }
.ozet table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 3mm; }
.ozet th, .ozet td { border: 1px solid #bbb; padding: 1.2mm 1.5mm; text-align: center; }
.ozet th { background: #f0f0f0; }
.ozet .sol-hiza { text-align: left; }
.kucuk-gorsel { width: 11mm; padding: 0.5mm !important; }
.kucuk-gorsel img { width: 10mm; height: 10mm; object-fit: cover; display: block; border-radius: 1mm; }
@media screen { body { background: #e5e7eb; padding: 10mm 0; } .sayfa { background: #fff; margin: 0 auto 8mm; padding: 7mm 8mm; width: 210mm; height: 297mm; box-shadow: 0 2px 12px rgba(0,0,0,.15); } }
</style></head><body>
${sayfalar.map((grup, i) => `
<div class="sayfa">
  <div class="baslik"><b>Hazırlama Talimatı — ${esc(tarih)}</b><span>Sayfa ${i + 1}/${sayfalar.length} · ${siparisler.length} sipariş · ${siparisler.reduce((t, s) => t + (s.kalemler || []).reduce((a, k) => a + (k.adet || 0), 0), 0)} ürün</span></div>
  ${grup.map(serit).join('')}
</div>`).join('')}
${ozetEkle && siparisler.length ? ozetSayfasi(siparisler) : ''}
<script>
  // Görseller yüklendikten sonra yazdır (yüklenmeyenler en geç 4 sn beklenir).
  var imgs = Array.prototype.slice.call(document.images);
  Promise.race([
    Promise.all(imgs.map(function (im) { return im.complete ? 1 : new Promise(function (r) { im.onload = im.onerror = r; }); })),
    new Promise(function (r) { setTimeout(r, 4000); })
  ]).then(function () { setTimeout(function () { window.print(); }, 200); });
</script>
</body></html>`;
  const w = window.open('', '_blank');
  if (!w) { alert('Yazdırma penceresi açılamadı - tarayıcının açılır pencere engelini kapatın.'); return false; }
  w.document.open(); w.document.write(html); w.document.close();
  return true;
}

export const _test = { yerlesim };
