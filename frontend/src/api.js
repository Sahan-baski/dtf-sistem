import axios from 'axios';
const api = axios.create({baseURL:'/api'});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('dtf_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
api.interceptors.response.use(r=>r, err => {
  if (err.response?.status===401) { localStorage.removeItem('dtf_token'); localStorage.removeItem('dtf_user'); window.location.reload(); }
  return Promise.reject(err);
});

export const authApi = { giris:(d)=>api.post('/auth/giris',d), ben:()=>api.get('/auth/ben') };
export const authApiEk = {
  kayit:(d)=>api.post('/auth/kayit',d),
  kullanicilar:()=>api.get('/auth/kullanicilar'),
  kullaniciEkle:(d)=>api.post('/auth/kullanicilar',d),
  kullaniciGuncelle:(id,d)=>api.patch(`/auth/kullanicilar/${id}`,d),
  kullaniciSil:(id)=>api.delete(`/auth/kullanicilar/${id}`),
};
export const siparisApi = {
  getAll:()=>api.get('/siparisler'),
  getBenim:()=>api.get('/siparisler/benim'),
  create:(d)=>api.post('/siparisler',d),
  createMusteri:(d)=>api.post('/siparisler/musteri',d),
  update:(id,d)=>api.put(`/siparisler/${id}`,d),
  updateDurum:(id,durum)=>api.patch(`/siparisler/${id}/durum`,{durum}),
  updateOdeme:(id,d)=>api.patch(`/siparisler/${id}/odeme`,d),
  updateKargo:(id,d)=>api.patch(`/siparisler/${id}/kargo`,d),
  delete:(id)=>api.delete(`/siparisler/${id}`),
};
export const gorevApi = {
  getAll:()=>api.get('/gorevler'),
  create:(d)=>api.post('/gorevler',d),
  toggleTamamla:(id)=>api.patch(`/gorevler/${id}/tamamla`),
  delete:(id)=>api.delete(`/gorevler/${id}`),
};
export const shopierApi = { cek:()=>api.post('/shopier/cek') };
export const musteriApi = { getAll:()=>api.get('/musteriler') };
export const dosyaApi = {
  getAll:(sid)=>api.get(`/dosyalar/${sid}`),
  yukle:(sid,fd)=>api.post(`/dosyalar/yukle/${sid}`,fd,{headers:{'Content-Type':'multipart/form-data'}}),
  sil:(id)=>api.delete(`/dosyalar/${id}`),
  indirUrl:(ad)=>`/api/dosyalar/indir/${ad}`,
};
export const ozetApi = { get:()=>api.get('/ozet') };
export const urunApi = {
  getAll:(k)=>api.get('/urunler',{params:k?{kategori:k}:{}}),
  create:(d)=>api.post('/urunler',d),
  update:(id,d)=>api.put(`/urunler/${id}`,d),
  toggle:(id)=>api.patch(`/urunler/${id}/toggle`),
  delete:(id)=>api.delete(`/urunler/${id}`),
};
export const ayarlarApi = {
  get:()=>api.get('/ayarlar'),
  save:(d)=>api.post('/ayarlar',d),
  hesaplaTeslimTarihi:(p)=>api.get('/ayarlar/teslim-tarihi',{params:{press_sayisi:p}}),
};
export const kategoriApi = {
  getAll:()=>api.get('/kategoriler'),
  create:(d)=>api.post('/kategoriler',d),
  update:(id,d)=>api.put(`/kategoriler/${id}`,d),
  delete:(id)=>api.delete(`/kategoriler/${id}`),
};
export const istatistikApi = { get:()=>api.get('/istatistikler') };

export const yedekApi = {
  al: () => '/api/yedek/al',
  yukle: (veri, mod) => api.post('/yedek/yukle', { veri, mod }),
};
