/**
 * Rol bazlı erişim kısıtlaması - authMiddleware'den SONRA kullanılır (o zaten
 * req.kullanici'yi JWT'den doldurmuş olur). Bir rota, sadece belirli
 * rollerdeki kullanıcılara açılmak isteniyorsa bu middleware'lerden biri
 * eklenir; eklenmezse (eskisi gibi) sadece "giriş yapmış olmak" yeterli olur.
 *
 * NEDEN EKLENDİ: güvenlik incelemesinde, "giriş yapmış olmak" ile "yetkili
 * olmak" birbirine karıştırılmış birçok rota bulundu - ör. bir müşteri hesabı
 * kendi rolünü "admin" yapabiliyor, başka bir müşterinin siparişini
 * "ödendi" işaretleyebiliyor ya da tüm veritabanını sıfırlayabiliyordu. Bu
 * dosya o rotalara tek satırlık bir düzeltme ekleme imkanı veriyor.
 */
function sadece(...izinliRoller) {
  return (req, res, next) => {
    if (!req.kullanici || !izinliRoller.includes(req.kullanici.rol)) {
      return res.status(403).json({ hata: 'Bu işlem için yetkin yok.' });
    }
    next();
  };
}

module.exports = {
  sadeceAdmin: sadece('admin'),
  sadeceEkip: sadece('admin', 'calisan'), // müşteri hesapları hariç, ekip (admin + çalışan)
};
