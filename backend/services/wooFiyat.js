/**
 * "Fiyat Güncelle" paneli için WooCommerce ürün fiyatı okuma/yazma yardımcıları.
 * Beden/varyasyon ayrımı YOK - her ürün için TEK bir satış fiyatı ve (isteğe
 * bağlı) tek bir indirimli fiyat girilir. Ürün "değişken" (bedenli) ise bu
 * fiyat ürünün TÜM varyasyonlarına aynı anda uygulanır (WooCommerce'de
 * değişken ürünlerde sitede görünen fiyat varyasyonlardan gelir, üst üründen
 * değil) - ayrıca üst ürünün kendi fiyat alanları da tutarlılık için yazılır.
 */
const { client, hataMetni } = require('./wooClient');
const { duzenlemeLinki } = require('./wooHelpers');

/** Ürün listesini (arama/kategori/sayfa ile) WooCommerce'den çeker. */
async function urunleriListele({ ara, kategori, sayfa = 1, sayfaBasi = 30 } = {}) {
  const { data, headers } = await client().get('/products', {
    params: {
      search: ara || undefined,
      category: kategori || undefined,
      page: sayfa,
      per_page: sayfaBasi,
      orderby: 'title',
      order: 'asc',
      status: 'publish',
    },
  });

  const toplamUrun = parseInt(headers['x-wp-total'], 10) || data.length;
  const toplamSayfa = parseInt(headers['x-wp-totalpages'], 10) || 1;

  const urunler = data
    .filter(p => p.type === 'simple' || p.type === 'variable')
    .map(p => ({
      id: p.id,
      ad: p.name,
      tur: p.type,
      resim: p.images?.[0]?.src || null,
      // Değişken ürünlerde üst ürünün kendi regular_price alanı çoğu zaman boş
      // kalır (fiyat varyasyonlardan gelir) - bu yüzden mevcut fiyatı ürünün
      // kendi "price" alanından (WooCommerce'in hesapladığı görünen fiyat)
      // okuyoruz, "regular_price" boşsa ona düşüyoruz.
      fiyat: p.regular_price || p.price || '',
      indirim_fiyat: p.sale_price || '',
      duzenleme_linki: duzenlemeLinki(p.id),
    }));

  return { urunler, toplamUrun, toplamSayfa, sayfa };
}

/** Filtre için kategori listesini çeker (ürün sayısı > 0 olanlar öne). */
async function kategorileriListele() {
  const tumu = [];
  let sayfa = 1;
  for (;;) {
    const { data } = await client().get('/products/categories', {
      params: { per_page: 100, page: sayfa, orderby: 'name', order: 'asc' },
    });
    tumu.push(...data);
    if (data.length < 100) break;
    sayfa++;
    if (sayfa > 10) break; // güvenlik
  }
  return tumu
    .filter(k => k.count > 0)
    .map(k => ({ id: k.id, ad: k.name, sayi: k.count }));
}

/** Bir ürünün TÜM varyasyon ID'lerini toplar (fiyatı hepsine aynı anda yazmak için). */
async function tumVaryasyonIdleriGetir(urunId) {
  const idler = [];
  let sayfa = 1;
  for (;;) {
    const { data } = await client().get(`/products/${urunId}/variations`, {
      params: { per_page: 100, page: sayfa },
    });
    idler.push(...data.map(v => v.id));
    if (data.length < 100) break;
    sayfa++;
    if (sayfa > 20) break; // güvenlik
  }
  return idler;
}

/**
 * Bir ürünün fiyatını günceller. "tur" değişken ise önce üst ürünün kendisini,
 * sonra TÜM varyasyonlarını tek bir toplu (batch) istekle aynı fiyata çeker -
 * böylece bedene özel bir fiyat farkı hiç oluşmaz.
 */
async function urunFiyatGuncelle(urunId, tur, { fiyat, indirim_fiyat }) {
  const gövde = {
    regular_price: fiyat === '' || fiyat === undefined || fiyat === null ? '' : String(fiyat),
    sale_price: indirim_fiyat === '' || indirim_fiyat === undefined || indirim_fiyat === null ? '' : String(indirim_fiyat),
  };

  await client().put(`/products/${urunId}`, gövde);

  if (tur === 'variable') {
    const varyasyonIdler = await tumVaryasyonIdleriGetir(urunId);
    if (varyasyonIdler.length) {
      await client().post(`/products/${urunId}/variations/batch`, {
        update: varyasyonIdler.map(id => ({ id, ...gövde })),
      });
    }
  }

  return { fiyat: gövde.regular_price, indirim_fiyat: gövde.sale_price };
}

module.exports = {
  urunleriListele,
  kategorileriListele,
  urunFiyatGuncelle,
  hataMetni,
};
