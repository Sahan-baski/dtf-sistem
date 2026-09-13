/**
 * WooCommerce REST API üzerinden ürün/varyasyon okuma-yazma yardımcıları.
 * Eski WordPress eklentisindeki mantığın aynısı (beden özniteliğini isme göre
 * bulma, varyasyon stoğu yazma) - sadece artık PHP/$wpdb yerine REST API.
 */
const { client, siteUrl, hataMetni } = require('./wooClient');

function bedenNormallestir(deger) {
  return String(deger || '').trim().toLowerCase();
}

/**
 * Bir WooCommerce ürününün ("değişken" tipte) tüm varyasyonlarını çeker ve
 * "Beden"/"Size" özniteliğine göre normalize edilmiş beden -> varyasyon ID
 * eşlemesi çıkarır. Öznitelik adı "Beden", "Size", "pa_beden" gibi farklı
 * şekillerde olabileceği için isimde "beden" ya da "size" geçen ilk özniteliği
 * kullanıyoruz (WordPress eklentisindeki mantıkla birebir aynı).
 */
async function bedeneGoreVaryasyonlariTespitEt(urunId) {
  const harita = {};
  let sayfa = 1;
  for (;;) {
    const { data } = await client().get(`/products/${urunId}/variations`, {
      params: { per_page: 100, page: sayfa },
    });
    for (const v of data) {
      const beden = (v.attributes || []).find(a => /beden|size/i.test(a.name || ''));
      if (beden && beden.option) {
        harita[bedenNormallestir(beden.option)] = v.id;
      }
    }
    if (data.length < 100) break;
    sayfa++;
    if (sayfa > 20) break; // güvenlik: 2000 varyasyondan fazlasını tarama
  }
  return harita;
}

/** Tek bir ürünü getirir (başlık, düzenleme linki için). */
async function urunGetir(urunId) {
  try {
    const { data } = await client().get(`/products/${urunId}`);
    return data;
  } catch (e) {
    return null;
  }
}

/** Tek bir varyasyonu getirir (mevcut stok miktarını okumak için, "besleme" adımında kullanılır). */
async function varyasyonGetir(urunId, varyasyonId) {
  try {
    const { data } = await client().get(`/products/${urunId}/variations/${varyasyonId}`);
    return data;
  } catch (e) {
    return null;
  }
}

/** Bir varyasyonun stok miktarını WooCommerce'e yazar (mutlak değer, min formülünün sonucu). */
async function varyasyonStokYaz(urunId, varyasyonId, miktar) {
  await client().put(`/products/${urunId}/variations/${varyasyonId}`, {
    manage_stock: true,
    stock_quantity: miktar,
    stock_status: miktar > 0 ? 'instock' : 'outofstock',
  });
}

/**
 * Tabloya eklenecek ürünleri aramak için: "değişken" (varyasyonlu) ürünler
 * arasında arama yapar. WordPress eklentisinin aksine tüm katalogu tek seferde
 * çekmek yerine WooCommerce'in kendi arama parametresini kullanıyoruz - katalog
 * büyüse de hızlı kalır.
 */
async function degiskenUrunAra(arama) {
  const { data } = await client().get('/products', {
    params: {
      type: 'variable',
      status: 'publish',
      per_page: 20,
      orderby: 'title',
      order: 'asc',
      search: arama || undefined,
    },
  });
  return data.map(p => ({ id: p.id, ad: p.name }));
}

function duzenlemeLinki(urunId) {
  const base = siteUrl();
  return base ? `${base}/wp-admin/post.php?post=${urunId}&action=edit` : '';
}

module.exports = {
  bedenNormallestir,
  bedeneGoreVaryasyonlariTespitEt,
  urunGetir,
  varyasyonGetir,
  varyasyonStokYaz,
  degiskenUrunAra,
  duzenlemeLinki,
  hataMetni,
};
