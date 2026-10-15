/**
 * Genel güvenlik katmanı (ek paket gerektirmez):
 *  - guvenlikBasliklari: tarayıcı güvenlik başlıkları (clickjacking, MIME koklama, HTTPS zorlama).
 *  - nosqlTemizle: istek gövdesi/sorgusundaki "$..." anahtarlarını atar - MongoDB
 *    operatör enjeksiyonunu ({"$ne": ""} gibi) her rotada tek yerden engeller.
 *  - hizSiniri: basit, bellek içi istek sınırlayıcı (giriş denemesi / kayıt spam'i için).
 */

function guvenlikBasliklari(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN'); // panel başka bir sitenin içine gömülüp tıklatılamasın
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (req.secure) res.setHeader('Strict-Transport-Security', 'max-age=15552000');
  next();
}

function temizle(deger, derinlik = 0) {
  if (derinlik > 20 || deger === null || typeof deger !== 'object') return deger;
  if (Array.isArray(deger)) return deger.map(v => temizle(v, derinlik + 1));
  const sonuc = {};
  for (const [k, v] of Object.entries(deger)) {
    if (k.startsWith('$')) continue; // MongoDB operatörü ($ne, $gt, $where...) - kullanıcıdan asla gelmemeli
    sonuc[k] = temizle(v, derinlik + 1);
  }
  return sonuc;
}

function nosqlTemizle(req, res, next) {
  if (req.body && typeof req.body === 'object') req.body = temizle(req.body);
  if (req.query && typeof req.query === 'object') {
    const t = temizle(req.query);
    try { req.query = t; } catch { Object.defineProperty(req, 'query', { value: t, writable: true }); }
  }
  if (req.params && typeof req.params === 'object') req.params = temizle(req.params);
  next();
}

/** anahtarFn(req) → sayaç anahtarı; pencere içinde `limit`'i aşan istekler 429 alır. */
function hizSiniri({ pencereMs, limit, mesaj, anahtarFn = (req) => req.ip }) {
  const sayac = new Map();
  setInterval(() => {
    const simdi = Date.now();
    for (const [k, v] of sayac) if (v.bitis < simdi) sayac.delete(k);
  }, 60 * 1000).unref();
  const fn = (req, res, next) => {
    const k = anahtarFn(req);
    const simdi = Date.now();
    let s = sayac.get(k);
    if (!s || s.bitis < simdi) { s = { adet: 0, bitis: simdi + pencereMs }; sayac.set(k, s); }
    s.adet++;
    if (s.adet > limit) {
      res.setHeader('Retry-After', Math.ceil((s.bitis - simdi) / 1000));
      return res.status(429).json({ hata: mesaj || 'Çok fazla deneme. Lütfen biraz sonra tekrar deneyin.' });
    }
    next();
  };
  fn.sifirla = (req) => sayac.delete(anahtarFn(req));
  return fn;
}

module.exports = { guvenlikBasliklari, nosqlTemizle, hizSiniri, temizle };
