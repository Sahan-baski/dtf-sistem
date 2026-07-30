const express = require('express');
const router = express.Router();
const { Siparis } = require('../models');
router.get('/', async (req,res) => {
  try {
    const siparisler = await Siparis.find().sort({createdAt:1});
    const bugun = new Date(); bugun.setHours(0,0,0,0);
    const aylikMap = {};
    for(let i=11;i>=0;i--){const d=new Date(bugun);d.setDate(1);d.setMonth(d.getMonth()-i);const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;aylikMap[k]={ay:k,toplam:0,tahsil:0,siparis:0};}
    const kategoriMap={},musteriMap={};
    let toplamCiro=0,tahsilEdilen=0,perakende=0,toptan=0,bekleyenTahsilat=0;
    siparisler.forEach(s=>{
      const tutar=s.odeme?.tutar||0, odendi=s.odeme?.odendi||false;
      const tarih=new Date(s.createdAt);
      const ayKey=`${tarih.getFullYear()}-${String(tarih.getMonth()+1).padStart(2,'0')}`;
      if(aylikMap[ayKey]){aylikMap[ayKey].toplam+=tutar;aylikMap[ayKey].siparis+=1;if(odendi)aylikMap[ayKey].tahsil+=tutar;}
      toplamCiro+=tutar; if(odendi)tahsilEdilen+=tutar; else bekleyenTahsilat+=tutar;
      const kat=s.kategori||'diger'; if(!kategoriMap[kat])kategoriMap[kat]={kat,ciro:0,siparis:0}; kategoriMap[kat].ciro+=tutar; kategoriMap[kat].siparis+=1;
      const tel=s.musteri_telefon||'',ad=`${s.musteri_adi||''} ${s.musteri_soyadi||''}`.trim(),mKey=tel||ad;
      if(!musteriMap[mKey])musteriMap[mKey]={ad,telefon:tel,ciro:0,siparis:0}; musteriMap[mKey].ciro+=tutar; musteriMap[mKey].siparis+=1;
      if(s.satis_tipi==='perakende'||s.kaynak==='musteri_paneli'||s.kaynak==='shopier')perakende+=tutar;
      else if(s.satis_tipi==='toptan')toptan+=tutar;
    });
    const aylar=Object.values(aylikMap);
    const buAy=aylar[aylar.length-1],gecenAy=aylar[aylar.length-2];
    const buyume=gecenAy?.toplam>0?((buAy?.toplam-gecenAy?.toplam)/gecenAy?.toplam*100).toFixed(1):0;
    res.json({
      aylikCiro:aylar.map(a=>({...a,ay:new Date(a.ay+'-01').toLocaleDateString('tr-TR',{month:'short',year:'2-digit'})})),
      kategoriCiro:Object.values(kategoriMap).sort((a,b)=>b.ciro-a.ciro).slice(0,10),
      topMusteriler:Object.values(musteriMap).sort((a,b)=>b.ciro-a.ciro).slice(0,10),
      ozet:{toplamCiro,tahsilEdilen,bekleyenTahsilat,toplamSiparis:siparisler.length,ortalamaFiyat:siparisler.length>0?Math.round(toplamCiro/siparisler.length):0,perakende,toptan,buyume:parseFloat(buyume),buAyCiro:buAy?.toplam||0,gecenAyCiro:gecenAy?.toplam||0},
    });
  } catch(e){res.status(500).json({hata:e.message});}
});
module.exports = router;
