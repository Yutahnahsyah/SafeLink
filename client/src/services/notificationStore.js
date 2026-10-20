const newest = items => [...items].sort((a,b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0) || String(b.id).localeCompare(String(a.id)));

// One store per authenticated session; no notification data is persisted in browser storage.
export function createNotificationStore({ api, now = Date.now }) {
  let state = { data:[], unread:0, status:'idle', error:null, refreshError:null, actionError:null, message:'', refreshing:false, mutating:false, hasMore:false };
  let disposed=false, revision=0, controller, pending, nextPage=1, lastFetched=-Infinity, invalidated=false, readAllRevision=0;
  const listeners=new Set();
  const confirmedReads=new Set();
  const applyConfirmed=item=>confirmedReads.has(item.id)?{...item,unread:false,read:true}:item;
  const update=changes=>{if(disposed)return;state={...state,...changes};listeners.forEach(fn=>fn());};
  const cancel=()=>{revision++;controller?.abort();pending=null;};
  async function load({ more=false, force=false, preserve=false }={}) {
    if(disposed||state.mutating)return;
    if(pending)return pending;
    if(!more&&!force&&now()-lastFetched<30000)return;
    const version=++revision, page=more?nextPage:1;
    controller=new AbortController();const activeController=controller;
    update({status:state.data.length?'success':'loading',refreshing:true,error:null,refreshError:null});
    const timer=setTimeout(()=>activeController.abort(),15000);
    pending=(async()=>{
      try {
        const result=await api.list({page,limit:20,sort:'newest'},{signal:activeController.signal});
        if(disposed||version!==revision)return;
        const merged=new Map(((more||preserve)?state.data:[]).map(item=>[item.id,item]));
        result.data.forEach(item=>{merged.set(item.id,item);if(item.read===true||item.unread===false)confirmedReads.delete(item.id);});
        nextPage=more?page+1:preserve?Math.max(nextPage,2):2;lastFetched=now();
        update({data:newest(merged.values()).map(item=>result.unread===0?{...item,unread:false,read:true}:applyConfirmed(item)),unread:result.unread,status:'success',refreshing:false,hasMore:nextPage<=(result.pagination?.totalPages||1)});
      } catch(error) {
        if(disposed||version!==revision)return;
        const failure=error.name==='AbortError'?new Error('Notifications took too long to load. Please retry.'):error;
        update(state.data.length?{status:'success',refreshError:failure,refreshing:false}:{status:'error',error:failure,refreshing:false});
      } finally { clearTimeout(timer);if(version===revision){pending=null;if(invalidated)invalidate();} }
    })();
    return pending;
  }
  function invalidate() {
    if(disposed)return; invalidated=true;
    if(pending||state.mutating)return;
    invalidated=false; void load({force:true,preserve:true});
  }
  function applyRead(id) {
    if(disposed)return;
    if(pending)cancel();
    const rows=state.data.filter(item=>!id||item.id===id);
    const decrement=rows.some(item=>item.unread);
    if(id)confirmedReads.add(id);else {readAllRevision++;rows.forEach(item=>confirmedReads.add(item.id));}
    while(confirmedReads.size>2000)confirmedReads.delete(confirmedReads.values().next().value);
    update({data:state.data.map(applyConfirmed),unread:!id?0:Math.max(0,state.unread-(decrement?1:0)),refreshing:false});
  }
  async function mutate(id) {
    if(disposed||state.mutating)return false;
    if(id&&!state.data.some(item=>item.id===id&&item.unread))return true;
    const previous={data:state.data,unread:state.unread,readAllRevision};
    cancel();update({mutating:true,actionError:null,message:'',data:state.data.map(item=>!id||item.id===id?{...item,unread:false,read:true}:item),unread:id?Math.max(0,state.unread-1):0});
    try {
      if(id)await api.markRead(id);else await api.markAllRead();
      if(disposed)return false;
      applyRead(id);
      update({message:id?'Notification marked as read.':'All notifications marked as read.'});
      return true;
    } catch(error) { const data=previous.data.map(applyConfirmed);update({data,unread:readAllRevision>previous.readAllRevision?0:Math.max(0,previous.unread-previous.data.filter(item=>item.unread&&confirmedReads.has(item.id)).length),actionError:error});return false; }
    finally { if(!disposed){update({mutating:false});invalidate();} }
  }
  return { subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},getSnapshot:()=>state,load,invalidate,applyRead,
    markRead:id=>mutate(id),markAllRead:()=>mutate(),
    activate(){disposed=false;},dispose(){disposed=true;cancel();invalidated=false;confirmedReads.clear();listeners.clear();lastFetched=-Infinity;nextPage=1;state={...state,data:[],unread:0,status:'idle',error:null,refreshError:null,actionError:null,message:'',mutating:false,refreshing:false,hasMore:false};} };
}

export function notificationDestination(item, role) {
  const id=item.incidentId;
  if(/^[a-f\d]{24}$/i.test(id||'')) {
    return {citizen:`/citizen/reports/${encodeURIComponent(id)}`,lgu_personnel:`/lgu/incidents/${encodeURIComponent(id)}`,barangay_personnel:`/barangay/incidents/${encodeURIComponent(id)}`,police_personnel:'/police/dashboard'}[role]||null;
  }
  if(/account|security|password|auth/.test(item.type||''))return {citizen:'/citizen/settings',lgu_personnel:'/lgu/settings',barangay_personnel:'/barangay/settings',police_personnel:'/police/settings'}[role]||null;
  return null;
}
