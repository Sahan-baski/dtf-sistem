/**
 * WooCommerce REST API üzerinden ürün/varyasyon okuma-yazma yardımcıları.
 * Eski WordPress eklentisindeki mantığın aynısı (beden özniteliğini isme göre
 * bulma, varyasyon stoğu yazma) - sadece artık PHP/$wpdb yerine REST API.
 */
const { client, siteUrl, hataMetni } = require('./wooClient');
const wp = require('./wpClient');

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

/**
 * Bir ürünü, "Mağaza Görünümü" eklentisinin mağaza sayfasında aynı tasarımlı
 * ürünleri yan yana dizmek için kullandığı "Tasarım" etiketine atar (ad boş
 * gönderilirse etiket temizlenir). Eklenti REST isteğindeki "sbc_tasarim"
 * alanını yakalayıp kendi taksonomisine yazıyor - burada WooCommerce'in
 * standart ürün güncelleme uç noktasını (zaten fiyat/stok için kullandığımız
 * aynı istemci) kullanıyoruz, ayrı bir bağlantı/kimlik bilgisi gerekmiyor.
 * "En iyi çaba" niteliğinde: eklenti kurulu değilse ya da erişilemezse
 * WooCommerce muhtemelen bu alanı sessizce yok sayar - hata fırlatmıyoruz ki
 * asıl stok/bağlantı işlemi bundan etkilenmesin.
 */
async function tasarimEtiketiYaz(urunId, ad) {
  await client().put(`/products/${urunId}`, { sbc_tasarim: ad || '' });
}

/** Bir görseli WordPress medya kütüphanesine yükler, WooCommerce'de kullanılacak medya ID'sini ve URL'sini döner. */
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
 * "Ortak Görseller" (ör. beden tablosu, yakın çekim kumaş detayı) - bir
 * görseli bir ürünün galerisine EK fotoğraf olarak ekler, mevcut fotoğrafları
 * ve ana görseli KORUR. Aynı görsel (medya ID) zaten galeride varsa tekrar
 * eklenmez - aynı ürüne birden fazla kez güvenle uygulanabilir (bir havuza
 * yeni ürün eklendiğinde ya da "yeniden uygula" ile tekrar denendiğinde).
 */
async function galeriGorselEkle(urunId, { mediaId }) {
  const { data: urun } = await client().get(`/products/${urunId}`);
  const mevcutGorseller = urun.images || [];
  if (mevcutGorseller.some(g => g.id === mediaId)) return { degisti: false };
  const images = [
    ...mevcutGorseller.map(g => (g.id ? { id: g.id } : { src: g.src })),
    { id: mediaId },
  ];
  await client().put(`/products/${urunId}`, { images });
  return { degisti: true };
}

module.exports = {
  bedenNormallestir,
  bedeneGoreVaryasyonlariTespitEt,
  urunGetir,
  varyasyonGetir,
  varyasyonStokYaz,
  degiskenUrunAra,
  duzenlemeLinki,
  tasarimEtiketiYaz,
  resimYukle,
  galeriGorselEkle,
  hataMetni,
  wpHataMetni: wp.hataMetni,
};
