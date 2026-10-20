import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../auth';
import { useRouter } from '../routing';
import { useNotificationFeed } from '../services/NotificationProvider';
import { notificationDestination } from '../services/notificationStore';
import Icon from './Icon';
import './NotificationBell.css';

function notificationIcon(item) {
  const type=`${item.type||''} ${item.incident?.status||''}`.toLowerCase();
  if(/resolved|closed|closure_confirmed/.test(type))return 'check';
  if(/reject|priority_alert|severity/.test(type))return 'priority';
  if(/assign/.test(type))return 'users';
  if(/account|security|password|auth/.test(type))return 'shield';
  if(/evidence/.test(type))return 'camera';
  if(/route|escalat|refer/.test(type))return 'layers';
  return 'bell';
}

export function OpenNotificationsButton({children='View notifications',className=''}) {
  const feed=useNotificationFeed();
  return <button type="button" className={`notification-open-link ${className}`} disabled={!feed.available} onClick={()=>feed.setOpen(true)}>{children}</button>;
}

export default function NotificationBell() {
  const feed=useNotificationFeed();
  const {user}=useAuth();const {navigate}=useRouter();
  const trigger=useRef(null),panel=useRef(null),heading=useRef(null);
  const [position,setPosition]=useState({top:70,left:12,width:380});
  const close=(restore=false)=>{feed.setOpen(false);if(restore)trigger.current?.focus();};
  useLayoutEffect(()=>{
    if(!feed.open)return undefined;
    const place=()=>{
      const rect=trigger.current?.getBoundingClientRect();if(!rect)return;
      const viewport=document.documentElement.clientWidth,width=Math.min(380,viewport-24);
      setPosition({top:rect.bottom+10,left:Math.max(12,Math.min(rect.right-width,viewport-width-12)),width});
    };
    place();window.addEventListener('resize',place);
    window.visualViewport?.addEventListener('resize',place);
    return()=>{window.removeEventListener('resize',place);window.visualViewport?.removeEventListener('resize',place);};
  },[feed.open]);
  useEffect(()=>{
    if(!feed.open)return undefined;
    heading.current?.focus();
    const outside=event=>{if(!trigger.current?.contains(event.target)&&!panel.current?.contains(event.target))close();};
    const escape=event=>{if(event.key==='Escape'){event.preventDefault();close(true);}};
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);document.addEventListener('focusin',outside);
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);document.removeEventListener('focusin',outside);};
  },[feed.open]);
  if(!feed.available)return null;
  const openItem=async item=>{
    if(item.unread&&!await feed.markRead(item.id))return;
    const destination=notificationDestination(item,user.role);
    if(destination){close();navigate(destination);}
  };
  const failure=feed.error||feed.refreshError;
  return <>
    <button type="button" className="top-notification notification-bell" ref={trigger} aria-label={`Notifications${feed.unread?` (${feed.unread} unread)`:''}`} aria-expanded={feed.open} aria-haspopup="dialog" aria-controls={feed.open?'safelink-notification-panel':undefined} onClick={()=>feed.open?close(true):feed.setOpen(true)}>
      <Icon name="bell" />{feed.unread>0&&<span key={feed.unread} className="notification-bell-badge" aria-hidden="true">{feed.unread>99?'99+':feed.unread}</span>}
    </button>
    {feed.open&&createPortal(<section id="safelink-notification-panel" className="notification-panel" ref={panel} role="dialog" aria-label="Notifications" aria-modal="false" style={{top:position.top,left:position.left,width:position.width,'--notification-top':`${position.top}px`}}>
      <header><div><h2 tabIndex={-1} ref={heading}>Notifications</h2><span>{feed.unread} unread</span></div><button type="button" className="notification-close" onClick={()=>close(true)} aria-label="Close notifications"><Icon name="close" size={18}/></button></header>
      <div className="notification-panel-toolbar"><button type="button" disabled={!feed.unread||feed.mutating||feed.status==='loading'} onClick={feed.markAllRead}>Mark all as read</button>{feed.refreshing&&feed.status==='success'&&<span role="status">Updating…</span>}</div>
      {feed.connectionStatus&&feed.connectionStatus!=='connected'&&<p className="notification-connection-status" role="status">{feed.connectionStatus==='connecting'?'Connecting live updates…':'Live updates are reconnecting. Saved notifications remain available.'}</p>}
      {feed.actionError&&<p className="notification-panel-error" role="alert">{feed.actionError.message||'Could not update notifications. Please try again.'}</p>}
      {feed.message&&<p className="notification-panel-success" role="status">{feed.message}</p>}
      {failure&&<p className="notification-panel-error" role="alert">Could not load notifications. <button type="button" onClick={feed.retry}>Retry</button></p>}
      <div className="notification-panel-list" aria-busy={feed.status==='loading'||feed.refreshing}>
        {feed.status==='loading'&&<div className="notification-panel-state" role="status">Loading your notifications…</div>}
        {feed.status==='success'&&!feed.data.length&&<div className="notification-panel-state"><Icon name="check" size={26}/><strong>You’re all caught up</strong><p>Your report and account updates will appear here.</p></div>}
        {feed.data.length>0&&<ul>{feed.data.map(item=><li key={item.id} className={item.unread?'is-unread':''}>
          <span className="notification-type-icon"><Icon name={notificationIcon(item)} size={18}/></span>
          <div className="notification-item-copy"><button type="button" className="notification-item-open" disabled={feed.mutating} onClick={()=>openItem(item)}><strong>{item.title}</strong><span>{item.body||item.message}</span><time dateTime={item.createdAt}>{item.timestamp||'Date unavailable'}</time></button>
            {item.unread&&<button type="button" className="notification-mark-read" disabled={feed.mutating} onClick={()=>feed.markRead(item.id)} aria-label={`Mark as read: ${item.title}`}>Mark as read</button>}
          </div>{item.unread&&<span className="notification-unread-dot" aria-label="Unread"/>}
        </li>)}</ul>}
        {feed.hasMore&&<button type="button" className="notification-load-more" disabled={feed.refreshing||feed.mutating} onClick={feed.loadMore}>Load more notifications</button>}
      </div>
    </section>,document.body)}
  </>;
}
