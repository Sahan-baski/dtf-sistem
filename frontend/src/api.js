import axios from 'axios';
const api = axios.create({ baseURL: '/api' });

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
  yukle: (siparisId, formData) => api.post(`/dosyalar/yukle/${siparisId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  sil: (id) => api.delete(`/dosyalar/${id}`),
  indirUrl: (dosyaAdi) => `/api/dosyalar/indir/${dosyaAdi}`,
};

export const ozetApi = {
  get: () => api.get('/ozet'),
};
