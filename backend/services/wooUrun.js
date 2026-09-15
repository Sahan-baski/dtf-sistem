/**
 * "Ürünler" paneli - WooCommerce'de GERÇEK ürün oluşturma/silme/listeleme.
 * Burada eklenen bir ürün doğrudan mirasgiyim.com'da yayınlanır - WooCommerce
 * paneline elle girmeye gerek kalmaz. Bedenli ürünlerde "Beden" adında bir
 * ürün-özel (global olmayan) öznitelik oluşturulur ve her bedene bir
 * varyasyon yazılır - tıpkı elle WooCommerce'de yapıldığı gibi.
 */
const { client, hataMetni } = require('./wooClient');
const { duzenlemeLinki } = require('./wooHelpers');
const wp = require('./wpClient');
const { kategorileriListele, urunleriListele } = require('./wooFiyat');

/** Yeni bir WooCommerce ürün kategorisi oluşturur (panelden "+ yeni kategori" ile). */
async function kategoriOlustur(ad) {
  const { data } = await client().post('/products/categories', { name: ad });
  return { id: data.id, ad: data.name, sayi: data.count || 0 };
}

/** Bir görseli WordPress medya kütüphanesine yükler, WooCommerce'de kullanılacak medya ID'sini döner. */
async function resimYukle(buffer, dosyaAdi, mimeType) {
  const { data } = await wp.client().post('/media', buffer, {
    headers: {
      'Content-Disposition': `attachment; filename="${dosyaAdi.replace(/"/g, '')}"`,
      'Content-Type': mimeType,
    },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });
  return { id: data.id, url: data.source_url };
}

/**
 * Yeni bir ürün oluşturur ve doğrudan yayınlar.
 * bedenler doluysa "değişken" (varyasyonlu) ürün olur - her bedene aynı
 * fiyatla bir varyasyon eklenir (fiyat sonradan Stok Senkron / Fiyat
 * Güncelle panellerinden bağımsız olarak da değiştirilebilir).
 */
async function urunOlustur({ ad, kategoriId, aciklama, fiyat, indirimFiyat, bedenler, resimMediaId }) {
  const bedenli = Array.isArray(bedenler) && bedenler.length > 0;

  const govde = {
    name: ad,
    type: bedenli ? 'variable' : 'simple',
    status: 'publish',
    description: aciklama || '',
    categories: kategoriId ? [{ id: Number(kategoriId) }] : [],
    images: resimMediaId ? [{ id: resimMediaId }] : [],
  };

  if (!bedenli) {
    if (fiyat !== undefined && fiyat !== '') govde.regular_price = String(fiyat);
    if (indirimFiyat !== undefined && indirimFiyat !== '') govde.sale_price = String(indirimFiyat);
  } else {
    govde.attributes = [{
      name: 'Beden',
      options: bedenler,
      variation: true,
      visible: true,
    }];
  }

  const { data: urun } = await client().post('/products', govde);

  if (bedenli) {
    const fiyatAlanlari = {};
    if (fiyat !== undefined && fiyat !== '') fiyatAlanlari.regular_price = String(fiyat);
    if (indirimFiyat !== undefined && indirimFiyat !== '') fiyatAlanlari.sale_price = String(indirimFiyat);

    await client().post(`/products/${urun.id}/variations/batch`, {
      create: bedenler.map(b => ({
        ...fiyatAlanlari,
        attributes: [{ name: 'Beden', option: b }],
      })),
    });
  }

  return { id: urun.id, ad: urun.name, duzenleme_linki: duzenlemeLinki(urun.id) };
}

/** Bir ürünü çöpe taşır (force=true verilirse kalıcı siler). */
async function urunSil(urunId, kalici = false) {
  await client().delete(`/products/${urunId}`, { params: { force: !!kalici } });
}

/**
 * Bir beden tablosu görselini (WP medya id + url) tek bir ürüne uygular:
 * isteğe göre açıklamanın sonuna görsel olarak ekler ve/veya ürünün
 * mevcut fotoğraflarını koruyarak galerisine ek fotoğraf olarak ekler.
 * Aynı görsel zaten eklenmişse (URL açıklamada geçiyor / medya ID galeride
 * varsa) tekrar eklenmez - aynı ürüne birden fazla kez uygulamak güvenlidir.
 */
async function bedenTablosuUygula(urunId, { mediaId, url }, { aciklamayaEkle = true, galeriyeEkle = true } = {}) {
  const { data: urun } = await client().get(`/products/${urunId}`);
  const govde = {};

  if (aciklamayaEkle) {
    const mevcutAciklama = urun.description || '';
    if (!mevcutAciklama.includes(url)) {
      const etiket = `<img src="${url}" alt="Beden Tablosu" style="max-width:100%;height:auto;" />`;
      govde.description = mevcutAciklama ? `${mevcutAciklama}\n${etiket}` : etiket;
    }
  }

  if (galeriyeEkle) {
    const mevcutGorseller = urun.images || [];
    const zatenVar = mevcutGorseller.some(g => g.id === mediaId);
    if (!zatenVar) {
      govde.images = [
        ...mevcutGorseller.map(g => (g.id ? { id: g.id } : { src: g.src })),
        { id: mediaId },
      ];
    }
  }

  if (!Object.keys(govde).length) return { degisti: false };
  await client().put(`/products/${urunId}`, govde);
  return { degisti: true };
}

module.exports = {
  kategorileriListele,
  kategoriOlustur,
  urunleriListele,
  urunOlustur,
  urunSil,
  bedenTablosuUygula,
  resimYukle,
  hataMetni,
  wpHataMetni: wp.hataMetni,
};
