import { useState, useEffect, useCallback } from 'react';
import { authApiEk } from '../api';
import { useToast } from '../context/ToastContext';
export default function KullaniciYonetimiPage() {
  const toast = useToast();
  const [liste, setListe] = useState([]);
  const yukle = useCallback(async()=>{ try{setListe((await authApiEk.kullanicilar()).data);}catch{} },[]);
  useEffect(()=>{yukle();},[yukle]);
  const onayla = async (id) => { try{await authApiEk.kullaniciGuncelle(id,{onay_bekliyor:false,aktif:true});toast('Onaylandı ✓');yukle();}catch{toast('Hata','error');} };
  const toggleAktif = async (id,aktif) => { try{await authApiEk.kullaniciGuncelle(id,{aktif:!aktif});yukle();}catch{toast('Hata','error');} };
  const sil = async (id) => { if(!confirm('Silinsin mi?'))return; try{await authApiEk.kullaniciSil(id);toast('Silindi');yukle();}catch{toast('Hata','error');} };
  const onayBekleyen = liste.filter(u=>u.onay_bekliyor);
  const aktif = liste.filter(u=>!u.onay_bekliyor&&u.aktif&&u.rol!=='admin');
  const pasif = liste.filter(u=>!u.onay_bekliyor&&!u.aktif);
  const Kart = ({u}) => (
    <div className="card" style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',marginBottom:8}}>
      <div style={{width:36,height:36,borderRadius:10,background:'var(--g-indigo)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,color:'white',flexShrink:0}}>{(u.ad||u.kullanici_adi||'?')[0].toUpperCase()}</div>
      <div style={{flex:1}}>
        <div style={{fontWeight:600,fontSize:13}}>{u.ad} {u.soyad} <span style={{color:'var(--text3)',fontWeight:400}}>@{u.kullanici_adi}</span></div>
        <div style={{fontSize:11,color:'var(--text2)'}}>{u.firma_adi||u.rol}</div>
      </div>
      <div style={{display:'flex',gap:6}}>
        {u.onay_bekliyor && <button className="btn btn-primary btn-sm" onClick={()=>onayla(u._id)}><i className="ti ti-check"/>Onayla</button>}
        {!u.onay_bekliyor && u.rol!=='admin' && <button className="btn btn-secondary btn-sm" onClick={()=>toggleAktif(u._id,u.aktif)}>{u.aktif?'Pasif et':'Aktive et'}</button>}
        {u.rol!=='admin' && <button className="btn-icon" onClick={()=>sil(u._id)}><i className="ti ti-trash" style={{fontSize:14}}/></button>}
      </div>
    </div>
  );
  return (
    <div>
      <div className="page-header"><div><div className="page-title">👤 Kullanıcılar</div></div></div>
      {onayBekleyen.length>0 && <><div className="section-divider">Onay Bekleyen ({onayBekleyen.length})</div>{onayBekleyen.map(u=><Kart key={u._id} u={u}/>)}</>}
      <div className="section-divider">Aktif ({aktif.length})</div>{aktif.map(u=><Kart key={u._id} u={u}/>)}
      {pasif.length>0 && <><div className="section-divider">Pasif ({pasif.length})</div>{pasif.map(u=><Kart key={u._id} u={u}/>)}</>}
    </div>
  );
}
