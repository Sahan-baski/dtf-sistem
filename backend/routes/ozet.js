const express = require('express');
const router = express.Router();
const { Siparis } = require('../models');
router.get('/', async (req,res) => {
  try {
    const bugun = new Date(); bugun.setHours(0,0,0,0);
    const hafta = new Date(bugun); hafta.setDate(hafta.getDate()+7);
    const bugunStr = bugun.toISOString().split('T')[0];
    const hepsi = await Siparis.find();
    const aktif = hepsi.filter(s=>s.durum!=='teslim_edildi');
    const buAy = new Date(); buAy.setDate(1); buAy.setHours(0,0,0,0);
    const buAyGelir = hepsi.filter(s=>s.odeme?.odendi&&new Date(s.updatedAt)>=buAy).reduce((t,s)=>t+(s.odeme?.tutar||0),0);
    res.json({
      aktifSiparis: aktif.length,
      bugunTeslim: aktif.filter(s=>s.teslim_tarihi===bugunStr).length,
      gecikmis: aktif.filter(s=>s.teslim_tarihi&&new Date(s.teslim_tarihi+'T00:00:00')<bugun).length,
      buHafta: aktif.filter(s=>{ if(!s.teslim_tarihi)return false; const t=new Date(s.teslim_tarihi+'T00:00:00'); return t>=bugun&&t<=hafta; }).length,
      hazirBekliyor: aktif.filter(s=>s.durum==='hazir').length,
      odemeBekleyen: aktif.filter(s=>!s.odeme?.odendi&&s.odeme?.tutar>0).length,
      bekleyenTahsilat: aktif.filter(s=>!s.odeme?.odendi).reduce((t,s)=>t+(s.odeme?.tutar||0),0),
      buAyGelir,
    });
  } catch(e){res.status(500).json({hata:e.message});}
});
module.exports = router;
