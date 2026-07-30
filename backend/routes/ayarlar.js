const express = require('express');
const router = express.Router();
const { Ayar, Siparis } = require('../models');
const VARSAYILAN = { gunluk_press_kapasitesi:180, min_teslim_gun:2, baski_hazirlama_gun:1 };
router.get('/', async (req,res) => { try { const list=await Ayar.find(); const s={...VARSAYILAN}; list.forEach(a=>s[a.anahtar]=a.deger); res.json(s); } catch(e){res.status(500).json({hata:e.message});} });
router.post('/', async (req,res) => { try { for(const [k,v] of Object.entries(req.body)) await Ayar.findOneAndUpdate({anahtar:k},{deger:v},{upsert:true}); res.json({mesaj:'Kaydedildi'}); } catch(e){res.status(500).json({hata:e.message});} });
router.get('/teslim-tarihi', async (req,res) => {
  try {
    const ps=parseInt(req.query.press_sayisi)||0;
    const kapAyar=await Ayar.findOne({anahtar:'gunluk_press_kapasitesi'});
    const kapasite=kapAyar?kapAyar.deger:180;
    const aktif=await Siparis.find({durum:{$ne:'teslim_edildi'}}).select('teslim_tarihi press_sayisi');
    const gunYuk={};
    aktif.forEach(s=>{if(s.teslim_tarihi&&s.press_sayisi>0)gunYuk[s.teslim_tarihi]=(gunYuk[s.teslim_tarihi]||0)+s.press_sayisi;});
    const bugun=new Date(); bugun.setHours(0,0,0,0);
    let teslim=null;
    for(let g=2;g<=60;g++){const d=new Date(bugun);d.setDate(d.getDate()+g);const t=d.toISOString().split('T')[0];if((gunYuk[t]||0)+ps<=kapasite){teslim=t;break;}}
    if(!teslim){const d=new Date();d.setDate(d.getDate()+2);teslim=d.toISOString().split('T')[0];}
    res.json({teslim_tarihi:teslim,kapasite,gunYuk});
  } catch(e){res.status(500).json({hata:e.message});}
});
module.exports = router;
