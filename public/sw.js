const CACHE='nova-v26';
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(
  caches.keys().then(keys=>Promise.all(keys.map(k=>k===CACHE?Promise.resolve():caches.delete(k)))).then(()=>self.clients.claim())
));
self.addEventListener('push',event=>{
  let data={};try{data=event.data?event.data.json():{}}catch{data={title:'Nova',body:'新しい通知があります'}};
  const title=data.title||data.notification?.title||'Nova';
  const body=data.body||data.notification?.body||'新しい通知があります';
  const options={
    body,
    icon:'/icon.svg?v=10',
    badge:'/icon.svg?v=10',
    tag:data.data?.type||'nova',
    renotify:true,
    data:data.data||{}
  };
  event.waitUntil((async()=>{
    try{const clientsList=await self.clients.matchAll({type:'window',includeUncontrolled:true});if(clientsList.length&&data.data?.type!=='call')return;}catch{}
    await self.registration.showNotification(title,options);
  })());
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const data=event.notification?.data||{};
  const url=new URL('/',self.location.origin);
  url.searchParams.set('push','1');
  if(data.type)url.searchParams.set('type',data.type);
  if(data.fromId)url.searchParams.set('fromId',data.fromId);
  if(data.callId)url.searchParams.set('callId',data.callId);
  if(data.mode)url.searchParams.set('mode',data.mode);
  event.waitUntil((async()=>{
    const list=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const c of list){if('focus' in c){try{await c.focus();if('navigate' in c)await c.navigate(url.href);return}catch{}}}
    if(self.clients.openWindow)await self.clients.openWindow(url.href);
  })());
});
self.addEventListener('fetch',event=>{
  const u=new URL(event.request.url);
  if(u.origin!==location.origin||event.request.method!=='GET')return;
  if(u.pathname.startsWith('/api/')||/\.(js|css|html)$/i.test(u.pathname)||u.pathname==='/'||u.pathname==='/manifest.json'){
    event.respondWith(fetch(event.request,{cache:'no-store'}));return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(r=>{
    if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(event.request,copy)).catch(()=>{});}
    return r;
  })));
});