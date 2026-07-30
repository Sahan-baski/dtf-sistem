import { createContext, useContext, useState } from 'react';
const ToastContext = createContext(null);
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const toast = (mesaj, tip='success') => {
    const id = Date.now();
    setToasts(t=>[...t,{id,mesaj,tip}]);
    setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),3000);
  };
  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-container">
        {toasts.map(t=><div key={t.id} className={`toast ${t.tip}`}>{t.mesaj}</div>)}
      </div>
    </ToastContext.Provider>
  );
}
export const useToast = () => useContext(ToastContext);
