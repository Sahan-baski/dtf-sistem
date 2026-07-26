import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

// Her isteğe token ekle
api.interceptors.request.use(config => {
  const token = localStorage.getItem('dtf_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 401 gelince çıkış yap
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('dtf_token');
      localStorage.removeItem('dtf_user');
      window.location.reload();
    }
    return Promise.reject(err);
  }
);

export const authApi = {
  giris: (d) => api.post('/auth/giris', d),
  ben: () => api.get('/auth/ben'),
  kullanicilar: () => api.get('/auth/kullanicilar'),
  kullaniciEkle: (d) => api.post('/auth/kullanicilar', d),
  kullaniciSil: (id) => api.delete(`/auth/kullanicilar/${id}`),
  sifreDegistir: (d) => api.patch('/auth/sifre', d),
};

export const siparisApi = {
  getAll: () => api.get('/siparisler'),
  create: (d) => api.post('/siparisler', d),
  update: (id, d) => api.put(`/siparisler/${id}`, d),
  updateDurum: (id, durum) => api.patch(`/siparisler/${id}/durum`, { durum }),
  updateOdeme: (id, d) => api.patch(`/siparisler/${id}/odeme`, d),
  updateKargo: (id, d) => api.patch(`/siparisler/${id}/kargo`, d),
  delete: (id) => api.delete(`/siparisler/${id}`),
};

export const gorevApi = {
  getAll: () => api.get('/gorevler'),
  create: (d) => api.post('/gorevler', d),
  toggleTamamla: (id) => api.patch(`/gorevler/${id}/tamamla`),
  delete: (id) => api.delete(`/gorevler/${id}`),
};

export const shopierApi = {
  cek: () => api.post('/shopier/cek'),
  getAyarlar: () => api.get('/shopier/ayarlar'),
  saveAyarlar: (d) => api.post('/shopier/ayarlar', d),
};

export const musteriApi = {
  getAll: () => api.get('/musteriler'),
  ara: (q) => api.get('/musteriler/ara', { params: { q } }),
};

export const dosyaApi = {
  getAll: (siparisId) => api.get(`/dosyalar/${siparisId}`),
  yukle: (siparisId, fd) => api.post(`/dosyalar/yukle/${siparisId}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
  sil: (id) => api.delete(`/dosyalar/${id}`),
  indirUrl: (dosyaAdi) => `/api/dosyalar/indir/${dosyaAdi}`,
};

export const ozetApi = { get: () => api.get('/ozet') };

// Ek auth endpointleri
export const authApiEk = {
  kayit: (d) => api.post('/auth/kayit', d),
  kullanicilar: () => api.get('/auth/kullanicilar'),
  kullaniciEkle: (d) => api.post('/auth/kullanicilar', d),
  kullaniciGuncelle: (id, d) => api.patch(`/auth/kullanicilar/${id}`, d),
  kullaniciSil: (id) => api.delete(`/auth/kullanicilar/${id}`),
};

export const urunApi = {
  getAll: (kategori) => api.get('/urunler', { params: kategori ? { kategori } : {} }),
  create: (d) => api.post('/urunler', d),
  update: (id, d) => api.put(`/urunler/${id}`, d),
  toggle: (id) => api.patch(`/urunler/${id}/toggle`),
  delete: (id) => api.delete(`/urunler/${id}`),
};

export const ayarlarApi = {
  get: () => api.get('/ayarlar'),
  save: (d) => api.post('/ayarlar', d),
  hesaplaTeslimTarihi: (press_sayisi) => api.get('/ayarlar/teslim-tarihi', { params: { press_sayisi } }),
};
