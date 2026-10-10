/**
 * "Varyasyon Görsel Denetimi" - müşterilerden gelen "ürünü sepete eklerken
 * görseli değişiyor" şikayetlerinin kök nedenini bulmak için yazıldı.
 *
 * Kök neden: WooCommerce'de "değişken" (varyasyonlu) bir ürünün her bedeninin
 * (varyasyonunun) KENDİ görseli olabilir - eğer bir varyasyona yanlışlıkla
 * BAŞKA bir ürüne ait bir görsel atanmışsa, müşteri o bedeni seçtiği an
 * (sepete eklemeden hemen önce, çünkü buton bir beden seçilmeden tıklanamıyor)
 * ekrandaki fotoğraf o yanlış/alakasız görsele aniden değişiyor. Tarayıcıda
 * canlı test edilerek doğrulandı: beden seçilmeden önce doğru görsel
 * gösteriliyor, "Seçenekleri temizle" ile de doğru görsele geri dönülüyor -
 * yani sorun sadece o varyasyona yanlış atanmış görselde, ürünün kendi
 * galerisinde değil.
 *
 * Bu modül TÜM değişken ürünleri tarar, her varyasyonun kendi görselinin
 * ürünün KENDİ galerisinde olup olmadığını kontrol eder - galeride yoksa bu,
 * tanım gereği o ürüne ait olmayan (başka bir üründen sızmış) bir görseldir
 * ve güvenle kaldırılabilir (kaldırıldığında WooCommerce otomatik olarak
 * ürünün kendi ana görselini gösterir - "düzeltme" tam olarak bu).
 */
const { client } = require('./wooClient');

/** Tüm "değişken" (varyasyonlu), yayınlanmış ürünleri sayfalayarak çeker. */
async function tumDegiskenUrunleriGetir() {
  const urunler = [];
  let sayfa = 1;
  for (;;) {
    const { data } = await client().get('/products', {
      params: { type: 'variable', status: 'publish', per_page: 50, page: sayfa },
    });
    urunler.push(...data);
    if (data.length < 50) break;
    sayfa++;
    if (sayfa > 100) break; // güvenlik: 5000 üründen fazlasını tarama
  }
  return urunler;
}

/** Bir ürünün tüm varyasyonlarını sayfalayarak çeker. */
async function urunVaryasyonlariGetir(urunId) {
  const varyasyonlar = [];
  let sayfa = 1;
  for (;;) {
    const { data } = await client().get(`/products/${urunId}/variations`, {
      params: { per_page: 100, page: sayfa },
    });
    varyasyonlar.push(...data);
    if (data.length < 100) break;
    sayfa++;
    if (sayfa > 20) break;
  }
  return varyasyonlar;
}

/**
 * Tüm katalogu tarar, ürünün kendi galerisinde OLMAYAN bir görsele sahip her
 * varyasyonu "sorunlu" olarak listeler. İlerleme bildirmek için opsiyonel
 * ilerleme(i, toplam) callback'i alır (uzun sürebilir - yüzlerce ürün olabilir).
 */
async function taraYanlisVaryasyonGorselleri(ilerleme) {
  const urunler = await tumDegiskenUrunleriGetir();
  const sorunlu = [];
  let i = 0;
  for (const urun of urunler) {
    i++;
    if (typeof ilerleme === 'function') ilerleme(i, urunler.length);
    const anaResimIdSet = new Set((urun.images || []).map(g => g.id));
    let varyasyonlar;
    try {
      varyasyonlar = await urunVaryasyonlariGetir(urun.id);
    } catch (e) {
      continue; // bir ürün okunamazsa taramanın tamamını durdurma
    }
    for (const v of varyasyonlar) {
      if (v.image && v.image.id && !anaResimIdSet.has(v.image.id)) {
        sorunlu.push({
          urun_id: urun.id,
          urun_adi: urun.name,
          urun_ana_gorsel: urun.images?.[0]?.src || null,
          urun_duzenleme_linki: `${(process.env.WC_SITE_URL || '').replace(/\/+$/, '')}/wp-admin/post.php?post=${urun.id}&action=edit`,
          varyasyon_id: v.id,
          beden: (v.attributes || []).map(a => a.option).filter(Boolean).join(' / ') || '(beden yok)',
          yanlis_gorsel: v.image.src,
          yanlis_gorsel_id: v.image.id,
        });
      }
    }
  }
  return sorunlu;
}

/**
 * Bir varyasyonun yanlış atanmış görselini kaldırır (image: null) - bundan
 * sonra WooCommerce o varyasyon için otomatik olarak ürünün kendi ana
 * görselini gösterir. Ürünün galerisine HİÇ dokunmaz.
 */
async function varyasyonGorseliniKaldir(urunId, varyasyonId) {
  await client().put(`/products/${urunId}/variations/${varyasyonId}`, { image: null });
}

/**
 * "Tümünü Düzelt" - katalogda çok sayıda ürün/kombinasyon olduğunda tek tek
 * tıklamak yerine, taramanın bulduğu TÜM sorunlu varyasyonları sırayla
 * düzeltir. Biri başarısız olursa diğerlerini durdurmaz, hepsini dener ve
 * hangilerinin başarısız olduğunu hatalar[] içinde döner.
 */
async function coguluDuzelt(ogeler) {
  let basarili = 0;
  const hatalar = [];
  for (const oge of ogeler) {
    try {
      await varyasyonGorseliniKaldir(oge.urun_id, oge.varyasyon_id);
      basarili++;
    } catch (e) {
      hatalar.push({ urun_id: oge.urun_id, varyasyon_id: oge.varyasyon_id, hata: e.response?.data?.message || e.message });
    }
  }
  return { toplam: ogeler.length, basarili, hatalar };
}

module.exports = {
  taraYanlisVaryasyonGorselleri,
  varyasyonGorseliniKaldir,
  coguluDuzelt,
};
