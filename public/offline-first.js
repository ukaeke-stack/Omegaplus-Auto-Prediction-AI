(()=> {
  "use strict";
  const DB_NAME="omega_auto_offline_v1",DB_VERSION=1,STORE="api_cache";
  const LOCAL_KEYS=["omegaplus_settings_v2","omegaplus_prediction_slip_v1:football","omegaplus_prediction_slip_v1:basketball"];
  let dbPromise;
  function openDb(){
    if(dbPromise)return dbPromise;
    dbPromise=new Promise((resolve,reject)=>{
      if(!("indexedDB" in window)){reject(new Error("IndexedDB unavailable"));return}
      const request=indexedDB.open(DB_NAME,DB_VERSION);
      request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:"key"})};
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error||new Error("Could not open offline database"));
    });
    return dbPromise;
  }
  async function cacheGet(key){
    try{const db=await openDb();return await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,"readonly"),r=tx.objectStore(STORE).get(key);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error)})}catch{return null}
  }
  async function cachePut(item){
    try{const db=await openDb();await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,"readwrite");tx.objectStore(STORE).put(item);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});await pruneCache(db)}catch{}
  }
  async function pruneCache(db){
    try{await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,"readwrite"),store=tx.objectStore(STORE),r=store.getAll();r.onsuccess=()=>{const rows=(r.result||[]).sort((a,b)=>b.savedAt-a.savedAt);rows.slice(150).forEach(x=>store.delete(x.key))};tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}catch{}
  }
  function cacheable(url,method){
    if(method!=="GET")return false;
    try{
      const u=new URL(url,location.href);
      if(u.origin!==location.origin||!u.pathname.startsWith("/api/"))return false;
      if(/^\/api\/(auth|admin|support|payments?|subscription|account|offline-sync)(\/|$)/i.test(u.pathname))return false;
      return true;
    }catch{return false}
  }
  const nativeFetch=window.fetch.bind(window);
  window.fetch=async function(input,init={}){
    const url=typeof input==="string"?input:(input?.url||String(input));
    const method=String(init.method||(typeof input!=="string"&&input?.method)||"GET").toUpperCase();
    const shouldCache=cacheable(url,method),key=new URL(url,location.href).href;
    try{
      const response=await nativeFetch(input,init);
      if(shouldCache&&response.ok&&/application\/json/i.test(response.headers.get("content-type")||"")){
        const clone=response.clone();clone.text().then(text=>cachePut({key,body:text,status:response.status,contentType:clone.headers.get("content-type")||"application/json",savedAt:Date.now()})).catch(()=>{});
      }
      return response;
    }catch(error){
      if(shouldCache){
        const saved=await cacheGet(key);
        if(saved&&Date.now()-saved.savedAt<7*24*60*60*1000){
          return new Response(saved.body,{status:200,headers:{"Content-Type":saved.contentType,"X-Omega-Offline-Cache":"hit","X-Omega-Cache-Time":new Date(saved.savedAt).toISOString()}});
        }
      }
      throw error;
    }
  };
  function metaKey(key){return "omega_offline_meta:"+key}
  function markLocalChange(key){
    try{localStorage.setItem(metaKey(key),String(Date.now()))}catch{}
    scheduleSync();
  }
  const originalSet=Storage.prototype.setItem;
  Storage.prototype.setItem=function(key,value){
    originalSet.call(this,key,value);
    if(this===localStorage&&LOCAL_KEYS.includes(String(key))&&!String(key).startsWith("omega_offline_meta:"))markLocalChange(String(key));
  };
  function recordKey(localKey){return localKey==="omegaplus_settings_v2"?"settings":localKey.replace("omegaplus_prediction_slip_v1:","slip:")}
  function localValue(localKey){
    try{return JSON.parse(localStorage.getItem(localKey)|| (localKey==="omegaplus_settings_v2"?"{}":"[]"))}catch{return localKey==="omegaplus_settings_v2"?{}:[]}
  }
  async function api(url,options={}){
    const response=await nativeFetch(url,{credentials:"same-origin",...options,headers:{"Content-Type":"application/json",...(options.headers||{})}});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||"Offline sync request failed");
    return data;
  }
  let syncing=false,timer;
  function scheduleSync(){clearTimeout(timer);timer=setTimeout(()=>sync().catch(()=>{}),1200)}
  async function sync(){
    if(syncing||!navigator.onLine)return false;
    syncing=true;
    try{
      const me=await api("/api/auth/me");
      if(!me?.user)return false;
      const server=await api("/api/offline-sync");
      const remote=new Map((server.records||[]).map(x=>[x.key,x]));
      const pending=[];
      for(const localKey of LOCAL_KEYS){
        const key=recordKey(localKey),meta=Number(localStorage.getItem(metaKey(key))||0),local=localValue(localKey),remoteRow=remote.get(key),remoteTime=remoteRow?Date.parse(remoteRow.clientUpdatedAt):0;
        if(remoteRow&&remoteTime>meta){
          localStorage.setItem(localKey,JSON.stringify(remoteRow.payload));
          localStorage.setItem(metaKey(key),String(remoteTime));
        }else if(localStorage.getItem(localKey)!==null){
          const stamp=Math.max(meta,Date.now());
          localStorage.setItem(metaKey(key),String(stamp));
          pending.push({key,payload:local,clientUpdatedAt:new Date(stamp).toISOString()});
        }
      }
      if(pending.length)await api("/api/offline-sync",{method:"PUT",body:JSON.stringify({records:pending})});
      document.dispatchEvent(new CustomEvent("omega:offline-sync",{detail:{ok:true,at:new Date().toISOString()}}));
      return true;
    }catch(error){
      document.dispatchEvent(new CustomEvent("omega:offline-sync",{detail:{ok:false,error:error.message}}));
      return false;
    }finally{syncing=false}
  }
  function updateStatus(){
    document.documentElement.dataset.connection=navigator.onLine?"online":"offline";
    let badge=document.getElementById("omegaOfflineStatus");
    if(!badge){
      badge=document.createElement("div");badge.id="omegaOfflineStatus";badge.setAttribute("role","status");
      badge.style.cssText="position:fixed;z-index:200;left:50%;bottom:calc(72px + env(safe-area-inset-bottom));transform:translateX(-50%);max-width:calc(100% - 24px);padding:8px 12px;border-radius:999px;background:#12271c;color:#d9fbe6;border:1px solid #2a6b48;font:600 12px/1.3 system-ui;box-shadow:0 4px 18px #0005;display:none;text-align:center";
      document.body.appendChild(badge);
    }
    badge.textContent=navigator.onLine?"Online · sync enabled":"Offline · showing saved data";
    badge.style.display=navigator.onLine?"none":"block";
  }
  window.omegaOfflineFirst={sync,cacheGet,cachePut};
  window.addEventListener("online",()=>{updateStatus();sync().catch(()=>{})});
  window.addEventListener("offline",updateStatus);
  document.addEventListener("DOMContentLoaded",()=>{
    updateStatus();
    if("serviceWorker" in navigator)navigator.serviceWorker.register("/sw.js").catch(()=>{});
    if(navigator.onLine)setTimeout(()=>sync().catch(()=>{}),1800);
  });
})();
