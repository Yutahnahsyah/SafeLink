import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { useRouter } from '../routing';
import { notificationApi } from './safelinkApi';
import { createNotificationStore } from './notificationStore';
import { API_BASE_URL, getAccessToken, clearSession } from './apiClient';
import { startLiveSession } from './liveSession';

const Context=createContext(null);
const supported=['citizen','barangay_personnel','lgu_personnel','police_personnel'];
function NotificationSession({user,children}) {
  const [store]=useState(()=>createNotificationStore({api:notificationApi}));
  const snapshot=useSyncExternalStore(store.subscribe,store.getSnapshot,store.getSnapshot);
  const [open,setOpen]=useState(false);
  const [connectionStatus,setConnectionStatus]=useState('connecting');
  const {pathname,search,navigate}=useRouter();
  const enabled=Boolean(user?.id&&!user.isDevelopmentPreview&&supported.includes(user.role));
  useEffect(()=>{store.activate();return()=>store.dispose();},[store]);
  useEffect(()=>{
    if(!enabled)return undefined;
    const token=getAccessToken(); let disposed=false,stop;
    let retryImport;
    const start=()=>import('socket.io-client').then(({io})=>{
      if(disposed)return;
      const api=new URL(API_BASE_URL,window.location.href);
      stop=startLiveSession({connect:()=>io(api.origin,{path:`${api.pathname.replace(/\/$/,'')}/realtime/socket.io`,auth:{token},autoConnect:false,reconnectionDelayMax:10000,timeout:10000}),
        onStatus:setConnectionStatus,
        onRead:store.applyRead,
        onDomains:domains=>{if(domains.includes('notifications'))store.invalidate();window.dispatchEvent(new CustomEvent('safelink:resources-changed',{detail:{domains}}));},
        onExpired:()=>{if(getAccessToken()===token){clearSession();window.dispatchEvent(new CustomEvent('safelink:session-expired'));}},
      });
    }).catch(()=>{if(!disposed){setConnectionStatus('unavailable');retryImport=setTimeout(start,10000);}});
    void start();
    return()=>{disposed=true;clearTimeout(retryImport);stop?.();};
  },[enabled,store]);
  useEffect(()=>{setOpen(false);if(enabled)void store.load();},[pathname,enabled,store]);
  useEffect(()=>{
    if(!enabled)return undefined;
    const refresh=()=>{if(document.visibilityState!=='hidden')void store.load();};
    window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
    return()=>{window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};
  },[enabled,store]);
  useEffect(()=>{
    if(!enabled||!open)return;
    void store.load({force:true});
  },[open,enabled,store]);
  useEffect(()=>{
    const params=new URLSearchParams(search);
    if(enabled&&params.get('notifications')==='1') {
      setOpen(true);params.delete('notifications');
      navigate(`${pathname}${params.size?`?${params}`:''}`,{replace:true});
    }
  },[pathname,search,enabled,navigate]);
  return <Context.Provider value={{...snapshot,available:enabled,open,setOpen,connectionStatus,
    retry:()=>store.load({force:true,preserve:true}),loadMore:()=>store.load({more:true}),markRead:store.markRead,markAllRead:store.markAllRead}}>{children}</Context.Provider>;
}
export function NotificationProvider({user,children}) {
  return <NotificationSession key={user?.id||'anonymous'} user={user}>{children}</NotificationSession>;
}
export function useNotificationFeed() {
  const value=useContext(Context);
  if(!value)throw new Error('NotificationProvider is required.');
  return value;
}
