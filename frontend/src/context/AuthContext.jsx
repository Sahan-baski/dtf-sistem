import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [kullanici, setKullanici] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  useEffect(() => {
    try {
      const token = localStorage.getItem('dtf_token');
      const userData = localStorage.getItem('dtf_user');
      if (token && userData) setKullanici(JSON.parse(userData));
    } catch {}
    setYukleniyor(false);
  }, []);

  const girisYap = (token, user) => {
    localStorage.setItem('dtf_token', token);
    localStorage.setItem('dtf_user', JSON.stringify(user));
    setKullanici(user);
  };

  const cikisYap = () => {
    localStorage.removeItem('dtf_token');
    localStorage.removeItem('dtf_user');
    setKullanici(null);
  };

  return (
    <AuthContext.Provider value={{ kullanici, girisYap, cikisYap, yukleniyor }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
