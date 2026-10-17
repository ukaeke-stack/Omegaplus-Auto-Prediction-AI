const CACHE_NAME="omega-auto-shell-v11";
const SHELL=["/","/index.html","/styles.css?v=1.6.10","/market-options.js?v=1.6.6","/app.js?v=1.7.4","/updates.js?v=1.6.0","/settings.js?v=1.6.0","/auth-ui.js?v=1.7.0","/intelligence.js?v=1.6.0","/support.js?v=1.0.0","/next-upgrades.js?v=1.1.0","/other-sports.js?v=1.2.0","/offline-first.js","/voice-assistant.js?v=1.0.4","/app-notifications.js?v=1.2.0","/ai-chat.js?v=1.1.0","/manifest.webmanifest","/icon.svg"];
self.addEventListener("install",event=>{event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith("omega-auto-shell-")&&key!==CACHE_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim()))});
self.addEventListener("notificationclick",event=>{event.notification.close();event.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(list=>{for(const client of list){if("focus" in client)return client.focus()}if(clients.openWindow)return clients.openWindow("/")}))});
self.addEventListener("fetch",event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=="GET"||url.origin!==self.location.origin||url.pathname.startsWith("/api/"))return;
  if(request.mode==="navigate"){
    event.respondWith(fetch(request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put("/",copy))}return response}).catch(async()=>await caches.match("/")||new Response("Omegaplus Auto Prediction AI is offline. Open the app again when a connection is available.",{status:503,headers:{"Content-Type":"text/plain; charset=utf-8"}})));
    return;
  }
  event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(request,copy))}return response})));
});
