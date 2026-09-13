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
    beden: bedenBul(k),
    adet: k.quantity,
    gorsel: k.image?.src || null,
  }));

  const musteri = s.shipping && (s.shipping.address_1 || s.shipping.first_name) ? s.shipping : s.billing;

  return {
    id: s.id,
    numara: s.number,
    tarih: s.date_created,
    durum: s.status,
    musteri_adi: adSoyad(s.billing) || adSoyad(s.shipping) || '—',
    alici: {
      ad_soyad: adSoyad(musteri),
      adres: adresMetni(musteri),
      telefon: s.billing?.phone || '',
    },
    kutular,
  };
}

module.exports = { siparisleriListele, siparisGetir, hataMetni };
