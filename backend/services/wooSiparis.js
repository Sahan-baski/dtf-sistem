/**
 * "Üretim Talimatı" paneli için WooCommerce SİPARİŞLERİNİ (mirasgiyim.com'a
 * müşterilerin verdiği gerçek siparişleri) okuma. Stok Senkron/Fiyat
 * Güncelle/Ürünler modüllerinden bağımsız, sadece OKUMA yapar - hiçbir
 * WooCommerce verisini değiştirmez.
 */
const { client, hataMetni } = require('./wooClient');

function bedenBul(kalem) {
  const meta = kalem.meta_data || [];
  const eslesen = meta.find(m => /beden|size/i.test(m.display_key || m.key || ''));
  if (eslesen) return eslesen.display_value || eslesen.value || '';
  return '';
}

function adSoyad(kisi) {
  if (!kisi) return '';
  return [kisi.first_name, kisi.last_name].filter(Boolean).join(' ').trim();
}

function adresMetni(kisi) {
  if (!kisi) return '';
  const satir1 = [kisi.address_1, kisi.address_2].filter(Boolean).join(' ');
  const satir2 = [kisi.state, kisi.city].filter(Boolean).join(' / ');
  return [satir1, satir2, kisi.postcode].filter(Boolean).join(', ');
}

/** Sipariş listesi - üretime/kargoya hazırlanacak siparişleri bulmak için arama + durum filtresiyle. */
async function siparisleriListele({ ara, durum, sayfa = 1, sayfaBasi = 20 } = {}) {
  const { data, headers } = await client().get('/orders', {
    params: {
      search: ara || undefined,
      status: durum || undefined,
      page: sayfa,
      per_page: sayfaBasi,
      orderby: 'date',
      order: 'desc',
    },
  });

  const toplamSiparis = parseInt(headers['x-wp-total'], 10) || data.length;
  const toplamSayfa = parseInt(headers['x-wp-totalpages'], 10) || 1;

  const siparisler = data.map(s => ({
    id: s.id,
    numara: s.number,
    tarih: s.date_created,
    durum: s.status,
    musteri_adi: adSoyad(s.billing) || adSoyad(s.shipping) || '—',
    kalem_sayisi: (s.line_items || []).length,
    kalem_toplam_adet: (s.line_items || []).reduce((t, k) => t + (k.quantity || 0), 0),
    toplam: s.total,
  }));

  return { siparisler, toplamSiparis, toplamSayfa, sayfa };
}

/** Tek bir siparişin üretim talimatı için gereken tüm detayını çıkarır (her varyasyon = bir kutu). */
async function siparisGetir(id) {
  const { data: s } = await client().get(`/orders/${id}`);

  const kutular = (s.line_items || []).map(k => ({
    kalem_id: k.id,
    ad: k.name,
    kod: k.sku || '',
    beden: bedenBul(k),
    adet: k.quantity,
    gorsel: k.image?.src || null,
  }));

  const musteri = s.shipping && (s.shipping.address_1 || s.shipping.first_name) ? s.shipping : s.billing;
  const sokakAdresi = [musteri?.address_1, musteri?.address_2].filter(Boolean).join(' ');

  return {
    id: s.id,
    numara: s.number,
    tarih: s.date_created,
    durum: s.status,
    musteri_adi: adSoyad(s.billing) || adSoyad(s.shipping) || '—',
    alici: {
      ad_soyad: adSoyad(musteri),
      // Yazdırma alanındaki etikette gösterilen tam, çok satırlı adres metni.
      adres: adresMetni(musteri),
      // Basit Kargo API'sine gönderilecek ayrıştırılmış alanlar - kullanıcı
      // "kod oluştur" onay panelinde göndermeden önce bunları düzeltebilir.
      adres_satir: sokakAdresi,
      il: musteri?.state || '',
      ilce: musteri?.city || '',
      posta_kodu: musteri?.postcode || '',
      telefon: s.billing?.phone || '',
      email: s.billing?.email || '',
    },
    kutular,
  };
}

/**
 * Yerel Siparis koleksiyonuna hiç bakmadan, doğrudan WooCommerce'in kendi
 * sipariş geçmişini tarayıp hangi üründen ("tasarım" - bir ürün genelde tek
 * bir baskı/tasarıma karşılık geliyor, bedenleri aynı ürün altında toplanıyor)
 * toplam kaç adet ve kaç TL satılmış olduğunu hesaplar. Sayfa sayfa (100'er
 * sipariş) TÜM geçmişi tarar - normal bir mağaza ölçeğinde birkaç saniyeyi
 * geçmez, aşırı büyük bir mağazada sonsuz döngüye girmesin diye MAX_SAYFA
 * güvenlik sınırı var.
 */
async function tasarimBazliSatislar({ durum = 'completed,processing', baslangic, bitis } = {}) {
  const MAX_SAYFA = 50; // 100/sayfa * 50 = en fazla 5000 sipariş taranır
  const urunMap = new Map(); // product_id -> { id, ad, adet, gelir }
  let toplamSiparis = 0;
  let toplamGelir = 0;
  let sayfa = 1;
  let taramaEksikKaldi = false;

  while (sayfa <= MAX_SAYFA) {
    const { data, headers } = await client().get('/orders', {
      params: {
        status: durum || undefined,
        after: baslangic ? new Date(`${baslangic}T00:00:00`).toISOString() : undefined,
        before: bitis ? new Date(`${bitis}T23:59:59`).toISOString() : undefined,
        page: sayfa,
        per_page: 100,
        orderby: 'date',
        order: 'desc',
      },
    });

    for (const siparis of data) {
      toplamSiparis++;
      for (const kalem of (siparis.line_items || [])) {
        const id = kalem.product_id;
        if (!id) continue; // ürün silinmiş/artık yok - yine de sayıya dahil olamıyor
        const adet = kalem.quantity || 0;
        const gelir = parseFloat(kalem.total) || 0;
        toplamGelir += gelir;
        const mevcut = urunMap.get(id) || { id, ad: kalem.parent_name || kalem.name || `Ürün #${id}`, adet: 0, gelir: 0 };
        mevcut.adet += adet;
        mevcut.gelir += gelir;
        urunMap.set(id, mevcut);
      }
    }

    const toplamSayfa = parseInt(headers['x-wp-totalpages'], 10) || 1;
    if (sayfa >= toplamSayfa) break;
    if (sayfa === MAX_SAYFA) taramaEksikKaldi = true;
    sayfa++;
  }

  const toplamAdet = Array.from(urunMap.values()).reduce((t, u) => t + u.adet, 0);
  const tasarimlar = Array.from(urunMap.values())
    .map(u => ({
      id: u.id,
      ad: u.ad,
      adet: u.adet,
      gelir: Math.round(u.gelir * 100) / 100,
      oran_adet: toplamAdet > 0 ? Math.round((u.adet / toplamAdet) * 1000) / 10 : 0,
      oran_gelir: toplamGelir > 0 ? Math.round((u.gelir / toplamGelir) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.adet - a.adet);

  return {
    tasarimlar,
    toplam_adet: toplamAdet,
    toplam_gelir: Math.round(toplamGelir * 100) / 100,
    toplam_siparis: toplamSiparis,
    tarama_eksik_kaldi: taramaEksikKaldi, // true ise MAX_SAYFA sınırına takıldı, en eski siparişler sayılmamış olabilir
  };
}

module.exports = { siparisleriListele, siparisGetir, tasarimBazliSatislar, hataMetni };
