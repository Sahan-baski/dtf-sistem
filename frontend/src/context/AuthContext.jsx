import { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [kullanici, setKullanici] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  useEffect(() => {
    const token = localStorage.getItem('dtf_token');
    if (!token) { setYukleniyor(false); return; }
    authApi.ben().then(r => setKullanici(r.data)).catch(() => { localStorage.removeItem('dtf_token'); localStorage.removeItem('dtf_user'); }).finally(() => setYukleniyor(false));
  }, []);
  const girisYap = (token, user) => { localStorage.setItem('dtf_token',token); localStorage.setItem('dtf_user',JSON.stringify(user)); setKullanici(user); };
  const cikisYap = () => { localStorage.removeItem('dtf_token'); localStorage.removeItem('dtf_user'); setKullanici(null); };
  return <AuthContext.Provider value={{kullanici,yukleniyor,girisYap,cikisYap}}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
