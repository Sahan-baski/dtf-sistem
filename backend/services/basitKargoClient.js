/**
 * Basit Kargo REST API istemcisi (https://basitkargo.com/api). "Üretim
 * Talimatı" panelinden tek tıkla gerçek bir kargo kodu/barkodu üretmek için
 * kullanılır. WooCommerce/WordPress kimlik bilgilerinden TAMAMEN AYRI bir
 * token gerekir (Basit Kargo hesabı → API/MCP token'ları).
 *
 * Gerekli ortam değişkeni (.env / Render → Environment):
 *   BASIT_KARGO_TOKEN
 */
const axios = require('axios');

let _client = null;

function client() {
  if (_client) return _client;
  const token = process.env.BASIT_KARGO_TOKEN || '';
  if (!token) {
    throw new Error('Basit Kargo bağlantı bilgisi eksik: BASIT_KARGO_TOKEN ortam değişkenini ayarlayın.');
  }
  _client = axios.create({
    baseURL: 'https://basitkargo.com/api',
    headers: { Authorization: `Bearer ${token}` },
    timeout: 20000,
  });
  return _client;
}

/** axios hatasını okunabilir bir metne çevirir. */
function hataMetni(e) {
  const mesaj = e.response?.data?.message || e.response?.data?.error;
  if (mesaj) return `Basit Kargo: ${mesaj}`;
  if (e.code === 'ECONNABORTED') return 'Basit Kargo isteği zaman aşımına uğradı.';
  if (e.response) {
    // Basit Kargo hata gövdesinde açıklayıcı bir "message"/"error" alanı
    // yoksa (ör. 500'de düz metin/HTML dönebiliyor), sebebi teşhis etmeye
    // yardımcı olsun diye gövdenin başını kısaca ekle.
    let govde = '';
    try {
      const ham = typeof e.response.data === 'string' ? e.response.data : JSON.stringify(e.response.data || '');
      govde = ham ? ham.replace(/\s+/g, ' ').trim().slice(0, 200) : '';
    } catch { /* yok say */ }
    return `Basit Kargo HTTP ${e.response.status} hatası.${govde ? ' ' + govde : ''}`;
  }
  return e.message || 'Bilinmeyen Basit Kargo hatası.';
}

/** Hesaba tanımlı kargo firmalarını listeler (dropdown için). */
async function firmalariListele() {
  const { data } = await client().get('/handlers');
  const liste = Array.isArray(data) ? data : (data.data || data.handlers || []);
  return liste.map(h => ({ kod: h.code || h.handlerCode, ad: h.name || h.code }));
}

/**
 * Tek istekte hem Basit Kargo siparişini hem de kargo kodunu/barkodunu
 * oluşturur (Basit Kargo API dokümantasyonundaki "Seçenek B").
 * Not: Bu GERÇEK bir kargo gönderisi oluşturur - geri alınamaz, bu yüzden
 * sadece kullanıcı panelden elle onaylayıp tıkladığında çağrılmalı.
 */
async function siparisVeKoduOlustur({ handlerCode, siparisNo, urunler, paket, alici }) {
  const govde = {
    handlerCode,
    type: 'OUTGOING',
    content: {
      name: `Sipariş #${siparisNo}`,
      code: `#${siparisNo}`,
      items: (urunler || []).map(u => ({ name: u.ad, code: String(u.kod || ''), quantity: String(u.adet) })),
      packages: [{
        height: Number(paket.yukseklik) || 0,
        width: Number(paket.genislik) || 0,
        depth: Number(paket.derinlik) || 0,
        weight: Number(paket.agirlik) || 0,
      }],
    },
    client: {
      name: alici.ad_soyad,
      phone: alici.telefon || '',
      email: alici.email || '',
      city: alici.il || '',
      town: alici.ilce || '',
      address: alici.adres || '',
    },
  };

  const { data } = await client().post('/v2/order/barcode', govde);
  return {
    basitKargoId: data.id,
    kargoNo: data.barcode,
    firmaAdi: data.shipmentInfo?.handler?.name || '',
    firmaKodu: data.shipmentInfo?.handler?.code || handlerCode,
  };
}

/**
 * Basit Kargo'nun panelindeki "Kargo Barkodu" ile aynı, hazır tasarlanmış
 * gönderici/alıcı/barkod etiketini SVG olarak getirir - kendi barkod
 * görselimizi çizmek yerine doğrudan bunu yazdırma alanına gömüyoruz.
 */
async function etiketSvgGetir(basitKargoId) {
  const { data } = await client().get(`/label/svg/${basitKargoId}`, { responseType: 'arraybuffer' });
  return Buffer.from(data).toString('utf8');
}

module.exports = { firmalariListele, siparisVeKoduOlustur, etiketSvgGetir, hataMetni };
