import express from 'express';
import {createServer} from 'http';
import {WebSocketServer} from 'ws';
import crypto from 'crypto';
import webpush from 'web-push';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const app=express(); const server=createServer(app); const wss=new WebSocketServer({server,path:'/ws'});
app.use(express.json({limit:'8mb'})); app.use(express.static(path.join(__dirname,'public')));
const DB=path.join(__dirname,'db.json');
const DIRECT_DB=path.join(__dirname,'direct-messages.json');
const empty={users:[],schools:[],messages:[],classTalks:[],talks:[],friends:[],friendRequests:[],posts:[],events:[],tasks:[],taskCompletions:[],schedules:[],scheduleChanges:[],elections:[],notifications:[],calls:[]};
const SCHOOL_STARTER=['早稲田大学高等学院','早稲田実業学校高等部','慶應義塾高等学校','開成高等学校','筑波大学附属高等学校','東京学芸大学附属高等学校','日比谷高等学校','浦和高等学校','浦和第一女子高等学校','川越高等学校','川越女子高等学校','川越東高等学校','熊谷高等学校','山村学園高等学校','山村国際高等学校','大宮高等学校','所沢高等学校','春日部高等学校','越谷北高等学校','栄東高等学校','淑徳与野高等学校','明治大学付属明治高等学校','青山学院高等部','中央大学附属高等学校','立教新座高等学校'];
function load(){if(!fs.existsSync(DB)) fs.writeFileSync(DB,JSON.stringify(empty,null,2)); const db=JSON.parse(fs.readFileSync(DB,'utf8')); for(const k of Object.keys(empty)) if(!Array.isArray(db[k])) db[k]=[]; return db;}
function save(db){fs.writeFileSync(DB,JSON.stringify(db,null,2));}
let directMessagesCache=null;
function loadDirectMessages(){
  if(Array.isArray(directMessagesCache))return directMessagesCache;
  if(!fs.existsSync(DIRECT_DB)) fs.writeFileSync(DIRECT_DB,'[]');
  try{const rows=JSON.parse(fs.readFileSync(DIRECT_DB,'utf8'));directMessagesCache=Array.isArray(rows)?rows:[]}catch{directMessagesCache=[]}
  return directMessagesCache;
}
function saveDirectMessages(rows){directMessagesCache=Array.isArray(rows)?rows:[];fs.writeFileSync(DIRECT_DB,JSON.stringify(directMessagesCache,null,2));}
function migrateDirectMessages(){
  const rows=loadDirectMessages();
  const db=load();
  const existing=new Set(rows.map(x=>String(x.id)));
  const direct=(db.messages||[]).filter(x=>x&&x.type==='direct'&&!existing.has(String(x.id)));
  if(direct.length){directMessagesCache=rows.concat(direct);saveDirectMessages(directMessagesCache)}
  return loadDirectMessages();
}

let dbWriteQueue=Promise.resolve();
async function withDbWrite(mutator){const run=dbWriteQueue.then(async()=>{const db=load();const result=await mutator(db);save(db);return result});dbWriteQueue=run.catch(()=>{});return run}
function id(){return crypto.randomBytes(12).toString('hex')}
function hash(p,s=crypto.randomBytes(16).toString('hex')){return `${s}:${crypto.scryptSync(p,s,64).toString('hex')}`}
function verify(p,h){const [s,x]=h.split(':'); return crypto.timingSafeEqual(Buffer.from(x,'hex'),crypto.scryptSync(p,s,64))}
function token(u){const raw=JSON.stringify({id:u.id,exp:Date.now()+1000*60*60*24*30}); const b=Buffer.from(raw).toString('base64url'); const sig=crypto.createHmac('sha256',process.env.NOVA_SECRET||'nova-dev-secret-change-me').update(b).digest('base64url'); return b+'.'+sig}
function auth(req,res,next){
  const t=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim();
  try{
    const [b,s]=t.split('.');
    if(!b||!s)throw 0;
    const expected=crypto.createHmac('sha256',process.env.NOVA_SECRET||'nova-dev-secret-change-me').update(b).digest('base64url');
    if(s.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(s),Buffer.from(expected)))throw 0;
    const p=JSON.parse(Buffer.from(b,'base64url').toString('utf8'));
    if(!p.id||!p.exp||p.exp<Date.now())throw 0;
    const db=load();
    req.user=db.users.find(x=>x.id===p.id);
    if(!req.user||req.user.banned)throw 0;
    ensureUserSchoolIdentity(db,req.user);
    next();
  }catch{res.status(401).json({error:'認証が必要です'})}
}
function pub(u){const {passwordHash,...x}=u; x.adminRoles=Array.isArray(u.adminRoles)?u.adminRoles:[]; return x}
function hasRole(u,role){return u?.role===role||Array.isArray(u?.adminRoles)&&u.adminRoles.includes(role)}
function pushConfigured(){return !!(process.env.NOVA_VAPID_PUBLIC_KEY&&process.env.NOVA_VAPID_PRIVATE_KEY)}
function configureWebPush(){if(!pushConfigured())return false;try{webpush.setVapidDetails(process.env.NOVA_VAPID_SUBJECT||'mailto:admin@example.com',process.env.NOVA_VAPID_PUBLIC_KEY,process.env.NOVA_VAPID_PRIVATE_KEY);return true}catch(e){console.error('WEB_PUSH_CONFIG_ERROR',e);return false}}
const webPushReady=configureWebPush();
async function sendPushNotification(userId,payload){
  if(!webPushReady)throw new Error('プッシュ通知のサーバー設定が未完了です');
  const db=load(),u=db.users.find(x=>String(x.id)===String(userId));
  if(!u)throw new Error('通知先ユーザーが見つかりません');
  if(u?.settings?.notifications===false)throw new Error('プッシュ通知がOFFです');
  if(payload?.data?.type==='call'&&u?.settings?.callSound===false)throw new Error('通話着信通知がOFFです');
  const subs=Array.isArray(u?.pushSubscriptions)?u.pushSubscriptions:[];
  if(!subs.length)throw new Error('この端末のプッシュ購読が登録されていません。通知設定を一度OFF→ONにしてください');
  const errors=[];
  for(const sub of subs){
    try{
      await webpush.sendNotification(sub,JSON.stringify(payload));
    }catch(e){
      console.error('WEB_PUSH_SEND_ERROR',e?.statusCode,e?.body||e?.message);
      if(e?.statusCode===404||e?.statusCode===410){
        u.pushSubscriptions=subs.filter(x=>x.endpoint!==sub.endpoint);save(db);
      }
      errors.push(e);
    }
  }
  if(errors.length===subs.length)throw new Error('プッシュ通知の送信に失敗しました。ブラウザの通知購読を作り直してください');
  return {sent:subs.length-errors.length,failed:errors.length};
}
function notify(db,userId,type,title,body,meta={}){
  const n={id:id(),userId,type,title,body,...meta,read:false,createdAt:Date.now()};
  db.notifications.unshift(n);
  setImmediate(()=>sendPushNotification(userId,{title,body,data:{type,...meta}}));
  return n;
}
function sameGroup(a,b){return a.schoolId===b.schoolId&&a.grade===b.grade&&a.className===b.className}
function ensureUserSchoolIdentity(db,u){if(!u)return null;const name=String(u.schoolName||'').trim();if(!name)return u;let school=db.schools.find(x=>String(x.name||'').trim()===name);if(!school){school={id:id(),masterId:null,name,grades:[]};db.schools.push(school)}if(u.schoolId!==school.id)u.schoolId=school.id;u.schoolName=school.name;return u}


app.get('/api/health',(q,r)=>r.json({ok:true,name:'Nova'}));
const schoolCache={};
async function searchSchoolMaster(keyword){
  const q=String(keyword||'').trim();
  if(!q)return [];
  const url='https://school.teraren.com/schools.json?s='+encodeURIComponent(q);
  const r=await fetch(url,{headers:{accept:'application/json'},signal:AbortSignal.timeout(10000)});
  if(!r.ok)throw new Error('学校データ取得失敗');
  const raw=await r.json();
  if(!Array.isArray(raw))throw new Error('学校データ形式不正');
  return raw.map(x=>{
    const code=String(x.code||x.school_code||x.id||'');
    const type=String(x.school_type||x.type||'');
    const name=String(x.name||x.school_name||'').trim();
    return {
      id:code,
      name,
      schoolType:type || (code.startsWith('C')?'中学校':code.startsWith('D')?'高等学校':''),
      location:String(x.location||x.prefecture||x.address||'').trim()
    };
  }).filter(x=>x.id&&x.name&&(
    x.id.startsWith('C')||x.id.startsWith('D')||
    /中学校|中学|高等学校|高校|中等教育学校|義務教育学校/.test(x.name)||
    /中学校|高等学校|中等教育学校|義務教育学校/.test(x.schoolType)
  )).slice(0,50);
}
app.get('/api/schools',async(req,res)=>{
  const keyword=String(req.query.q||'').trim();
  if(!keyword)return res.json([]);
  const db=load();
  const local=[
    ...SCHOOL_STARTER.map((name,i)=>({id:'starter-'+i,name,location:'',schoolType:/中学校/.test(name)?'中学校':'高等学校',source:'starter'})),
    ...db.schools.map(x=>({id:x.masterId||x.id,name:x.name,location:x.location||'',schoolType:x.schoolType||'',source:'registered'}))
  ];
  const localMatches=local.filter(x=>x.name.includes(keyword));
  const seen=new Set();
  const uniqueLocal=localMatches.filter(x=>x.name&&!seen.has(x.name)&&(seen.add(x.name))).slice(0,50);
  if(uniqueLocal.length)return res.json(uniqueLocal);
  try{
    const external=await Promise.race([
      searchSchoolMaster(keyword),
      new Promise((_,reject)=>setTimeout(()=>reject(new Error('timeout')),2500))
    ]);
    return res.json(external.filter(x=>x.name&&!seen.has(x.name)&&(seen.add(x.name))).slice(0,50));
  }catch{
    return res.json([]);
  }
});
app.post('/api/register',(req,res)=>{
  try{
    const db=load();
    const {schoolId,schoolName,grade,className,attendanceNo,lastName,firstName,password,icon,legalConsent,legalVersion}=req.body;
    const displayName=[lastName,firstName].filter(Boolean).join(' ').trim();
    if(!schoolName||!grade||!className||!attendanceNo||!lastName||!firstName||!password)return res.status(400).json({error:'必須項目をすべて入力してください'});
    if(!legalConsent)return res.status(400).json({error:'利用規約・プライバシーポリシーへの同意が必要です'});
    if(!['1','2','3'].includes(String(grade)))return res.status(400).json({error:'学年は1〜3から選択してください'});
    if(!/^\d+$/.test(String(attendanceNo))||Number(attendanceNo)<1)return res.status(400).json({error:'出席番号は1以上の数字で入力してください'});
    if(password.length<6)return res.status(400).json({error:'パスワードは6文字以上にしてください'});
    if(!/^[^<>]{1,40}$/.test(lastName)||!/^[^<>]{1,40}$/.test(firstName))return res.status(400).json({error:'氏名を正しく入力してください'});
    if(icon&&icon.length>6*1024*1024)return res.status(400).json({error:'写真のサイズが大きすぎます'});
    const requestedSchoolId=String(schoolId||'').trim();
    let school=db.schools.find(x=>(requestedSchoolId&&(x.masterId===requestedSchoolId||x.id===requestedSchoolId))||x.name===schoolName);
    if(!school){
      school={id:id(),masterId:requestedSchoolId||null,name:String(schoolName).trim(),grades:[]};
      db.schools.push(school);
    }
    const normalizedClass=String(className).trim();
    const exists=db.users.find(u=>u.schoolId===school.id&&u.grade===String(grade)&&u.className===normalizedClass&&String(u.attendanceNo)===String(attendanceNo));
    if(exists)return res.status(409).json({error:'この学校・学年・クラス・出席番号はすでに登録されています'});
    const ownerMatch=normalizeAdminIdentity(school.name).includes('山村学園')&&normalizeAdminIdentity(lastName)==='谷利'&&normalizeAdminIdentity(firstName)==='優樹';
    const u={id:id(),schoolId:school.id,schoolName:school.name,grade:String(grade),className:normalizedClass,attendanceNo:String(attendanceNo),lastName:String(lastName).trim(),firstName:String(firstName).trim(),displayName,icon:icon||'',passwordHash:hash(password),role:ownerMatch?'SUPER_ADMIN':'STUDENT',createdAt:Date.now(),settings:{notifications:false,callSound:false},legalConsentAt:Date.now(),legalVersion:String(legalVersion||'1.0')};
    db.users.push(u);
    if(!Array.isArray(db.classTalks))db.classTalks=[];
    let talk=db.classTalks.find(x=>x.schoolId===school.id&&x.grade===String(grade)&&x.className===normalizedClass);
    if(!talk){
      talk={id:id(),schoolId:school.id,schoolName:school.name,grade:String(grade),className:normalizedClass,name:String(grade)+'年'+normalizedClass+'組 クラストーク',createdAt:Date.now(),memberIds:[]};
      db.classTalks.push(talk);
    }
    if(!talk.memberIds.includes(u.id))talk.memberIds.push(u.id);
    ensureYamamura1Class5Schedule(db);
    save(db);
    res.json({token:token(u),user:pub(u)});
  }catch(e){
    console.error('REGISTER_ERROR',e);
    res.status(500).json({error:'登録処理に失敗しました'});
  }
});
function normalizeLoginText(value){
  return String(value||'').replace(/\u3000/g,' ').trim().replace(/\s+/g,' ');
}
function safeVerify(password,passwordHash){
  try{
    if(!passwordHash||typeof passwordHash!=='string'||!passwordHash.includes(':'))return false;
    return verify(String(password||''),passwordHash);
  }catch{return false}
}
function ensureAdminTalkMembership(u,db){
  if(!Array.isArray(db.talks))db.talks=[];
  const ensure=(room,grade,className,allowed)=>{
    let t=db.talks.find(x=>x.room===room&&x.schoolId===u.schoolId&&(grade==null||x.grade===grade)&&(className==null||x.className===className));
    if(!t){t={id:id(),room,schoolId:u.schoolId,grade:grade||null,className:className||null,name:room==='classadmin'?'CLASS ADMIN トーク':room==='gradeadmin'?(String(grade)+'年 GRADE ADMIN トーク'):room,memberIds:[],createdAt:Date.now()};db.talks.push(t)}
    t.memberIds=Array.isArray(t.memberIds)?t.memberIds:[];
    if(allowed){t.memberIds=t.memberIds.filter(x=>allowed.includes(x));allowed.forEach(x=>{if(!t.memberIds.includes(x))t.memberIds.push(x)})}
    return t;
  };
  // SUPER_ADMIN is a global management account and must never be a member of
  // CLASS ADMIN / GRADE ADMIN talks, even if stale adminRoles contain those roles.
  const classAllowed=db.users.filter(x=>!hasRole(x,'SUPER_ADMIN')&&sameGroup(x,u)&&(hasRole(x,'CLASS_ADMIN')||hasRole(x,'GRADE_ADMIN')||hasRole(x,'SCHOOL_ADMIN'))).map(x=>x.id);
  const gradeAllowed=db.users.filter(x=>!hasRole(x,'SUPER_ADMIN')&&x.schoolId===u.schoolId&&(hasRole(x,'GRADE_ADMIN')||hasRole(x,'SCHOOL_ADMIN'))).map(x=>x.id);
  ensure('classadmin',u.grade,u.className,classAllowed);
  ensure('gradeadmin',null,null,gradeAllowed);
}
function syncAdminTalks(db){
  for(const u of db.users)ensureAdminTalkMembership(u,db);
}
function ensureSuperAdminOwner(u,db){
  if(!u)return false;
  const school=normalizeAdminIdentity(u.schoolName);
  const last=normalizeAdminIdentity(u.lastName);
  const first=normalizeAdminIdentity(u.firstName);
  const display=normalizeAdminIdentity(u.displayName);
  const isOwner=(school.includes('山村学園')&&((last==='谷利'&&first==='優樹')||display==='谷利 優樹'));
  if(isOwner&&u.role!=='SUPER_ADMIN'){u.role='SUPER_ADMIN';console.log('SUPER_ADMIN_OWNER_PROMOTED_ON_AUTH',u.id)}
  ensureAdminTalkMembership(u,db);save(db);return isOwner;
}
app.post('/api/login',(req,res)=>{
  try{
    const db=load();
    const schoolName=normalizeLoginText(req.body.schoolName);
    const lastName=normalizeLoginText(req.body.lastName);
    const firstName=normalizeLoginText(req.body.firstName);
    const inputDisplayName=normalizeLoginText([lastName,firstName].filter(Boolean).join(' '));
    if(!schoolName||!lastName||!firstName||!String(req.body.password||''))return res.status(400).json({error:'学校名・姓・名・パスワードを入力してください'});
    const u=db.users.find(x=>{
      if(normalizeLoginText(x.schoolName)!==schoolName)return false;
      const xLast=normalizeLoginText(x.lastName);
      const xFirst=normalizeLoginText(x.firstName);
      const xDisplay=normalizeLoginText(x.displayName);
      return (xLast===lastName&&xFirst===firstName)||xDisplay===inputDisplayName;
    });
    if(!u)return res.status(401).json({error:'学校名・氏名・パスワードを確認してください'});
    ensureUserSchoolIdentity(db,u);
    ensureSuperAdminOwner(u,db);
    if(u.banned)return res.status(401).json({error:'このアカウントは利用停止中です'});
    if(!safeVerify(req.body.password,u.passwordHash))return res.status(401).json({error:'学校名・氏名・パスワードを確認してください'});
    res.json({token:token(u),user:pub(u)});
  }catch(e){
    console.error('LOGIN_ERROR',e);
    res.status(500).json({error:'ログイン処理に失敗しました'});
  }
});
app.get('/api/me',auth,(req,res)=>{const db=load(),u=db.users.find(x=>x.id===req.user.id)||req.user;ensureUserSchoolIdentity(db,u);ensureSuperAdminOwner(u,db);save(db);res.json(pub(u));});
app.patch('/api/me',auth,(req,res)=>{
  try{
    const db=load(),u=db.users.find(x=>x.id===req.user.id);
    const nextSchool=String(req.body.schoolName||u.schoolName).trim();
    const nextGrade=String(req.body.grade||u.grade);
    const nextClass=String(req.body.className||u.className).trim();
    const nextLast=String(req.body.lastName||u.lastName).trim();
    const nextFirst=String(req.body.firstName||u.firstName).trim();
    if(!nextSchool||!['1','2','3'].includes(nextGrade)||!nextClass||!nextLast||!nextFirst)return res.status(400).json({error:'学校・学年・クラス・氏名を正しく入力してください'});
    if(req.body.newPassword){
      if(!req.body.currentPassword||!safeVerify(req.body.currentPassword,u.passwordHash))return res.status(401).json({error:'現在のパスワードが正しくありません'});
      if(String(req.body.newPassword).length<6)return res.status(400).json({error:'パスワードは6文字以上にしてください'});
      u.passwordHash=hash(String(req.body.newPassword));
    }
    Object.assign(u,{schoolName:nextSchool,grade:nextGrade,className:nextClass,lastName:nextLast,firstName:nextFirst,displayName:`${nextLast} ${nextFirst}`,icon:req.body.icon||u.icon,settings:{...u.settings,...(req.body.settings||{})}});
    let school=db.schools.find(x=>String(x.name||'').trim()===nextSchool);
    if(!school){school={id:id(),masterId:null,name:nextSchool,grades:[]};db.schools.push(school)}
    u.schoolId=school.id;
    save(db);res.json(pub(u));
  }catch(e){console.error('ME_UPDATE_ERROR',e);res.status(500).json({error:'設定の保存に失敗しました'})}
});

app.get('/api/users/search',auth,(req,res)=>{
  const db=load(),meId=String(req.user.id),q=String(req.query.q||'').trim().toLowerCase();
  const normalize=v=>String(v??'').toLowerCase().replace(/\\u3000/g,' ');
  const list=db.users.filter(u=>{
    if(String(u.id)===meId)return false;
    if(!q)return true;
    const hay=[
      u.displayName,u.lastName,u.firstName,u.schoolName,u.grade,u.className,u.attendanceNo
    ].map(normalize).join(' ');
    return hay.includes(q);
  }).slice(0,30).map(pub);
  res.json(list);
});
app.post('/api/friends/:id',auth,(req,res)=>{const db=load();db.friends=Array.isArray(db.friends)?db.friends:[];db.friendRequests=Array.isArray(db.friendRequests)?db.friendRequests:[];db.notifications=Array.isArray(db.notifications)?db.notifications:[];const target=String(req.params.id);const meId=String(req.user.id);if(target===meId)return res.status(400).json({error:'自分には申請できません'});const targetUser=db.users.find(u=>String(u.id)===target);if(!targetUser)return res.status(404).json({error:'ユーザーが見つかりません'});if(db.friends.some(f=>(String(f.a)===meId&&String(f.b)===target)||(String(f.a)===target&&String(f.b)===meId)))return res.status(409).json({error:'すでに友達です'});const reverse=db.friendRequests.find(x=>String(x.from)===target&&String(x.to)===meId);if(reverse){db.friends.push({a:meId,b:target,createdAt:Date.now()});db.friendRequests=db.friendRequests.filter(x=>x.id!==reverse.id);const accepter=db.users.find(u=>String(u.id)===meId)||req.user;notify(db,targetUser.id,'friend_accepted','フレンド申請を承認',accepter.displayName+'がフレンド申請を承認しました',{fromId:accepter.id,chatType:'friend_accepted'});save(db);const targetWs=wsUsers?.get(String(targetUser.id));if(targetWs?.readyState===1)targetWs.send(JSON.stringify({type:'friend_accepted',user:{id:accepter.id,displayName:accepter.displayName,icon:accepter.icon||''}}));return res.json({ok:true,accepted:true})}if(db.friendRequests.some(x=>String(x.from)===meId&&String(x.to)===target))return res.status(409).json({error:'フレンド申請済みです'});const request={id:id(),from:meId,to:target,createdAt:Date.now()};db.friendRequests.push(request);const sender=db.users.find(u=>String(u.id)===meId)||req.user;notify(db,target,'friend_request','フレンド申請',sender.displayName+'からフレンド申請が届きました',{requestId:request.id,fromId:sender.id,chatType:'friend_request'});save(db);const targetWs=wsUsers?.get(target);if(targetWs?.readyState===1)targetWs.send(JSON.stringify({type:'friend_request',request:{...request,fromName:sender.displayName,fromIcon:sender.icon||''}}));return res.json({ok:true,pending:true})});
app.get('/api/friends',auth,(req,res)=>{
  const db=load(),meId=String(req.user.id);
  const ids=(db.friends||[]).filter(f=>String(f.a)===meId||String(f.b)===meId).map(f=>String(f.a)===meId?String(f.b):String(f.a));
  res.json(db.users.filter(u=>ids.includes(String(u.id))).map(pub));
});
app.get('/api/friend-requests',auth,(req,res)=>{
  const db=load(),meId=String(req.user.id);
  const incoming=(db.friendRequests||[]).filter(x=>String(x.to)===meId).map(x=>({...x,user:pub(db.users.find(u=>String(u.id)===String(x.from)))}));
  const outgoing=(db.friendRequests||[]).filter(x=>String(x.from)===meId).map(x=>({...x,user:pub(db.users.find(u=>String(u.id)===String(x.to)))}));
  res.json({incoming,outgoing});
});
app.post('/api/friend-requests/:id/accept',auth,(req,res)=>{
  const db=load(),meId=String(req.user.id);
  db.friends=Array.isArray(db.friends)?db.friends:[];
  db.friendRequests=Array.isArray(db.friendRequests)?db.friendRequests:[];
  db.notifications=Array.isArray(db.notifications)?db.notifications:[];
  const x=db.friendRequests.find(x=>String(x.id)===String(req.params.id)&&String(x.to)===meId);
  if(!x)return res.status(404).json({error:'申請が見つかりません'});
  if(!db.friends.some(f=>(String(f.a)===String(x.from)&&String(f.b)===String(x.to))||(String(f.a)===String(x.to)&&String(f.b)===String(x.from))))db.friends.push({a:x.from,b:x.to,createdAt:Date.now()});
  db.friendRequests=db.friendRequests.filter(y=>String(y.id)!==String(x.id));
  const accepter=db.users.find(u=>String(u.id)===meId)||req.user;
  const sender=db.users.find(u=>String(u.id)===String(x.from));
  if(sender){
    notify(db,sender.id,'friend_accepted','フレンド申請を承認',accepter.displayName+'がフレンド申請を承認しました',{fromId:accepter.id,chatType:'friend_accepted'});
  }
  save(db);
  const senderWs=sender&&wsUsers?.get(String(sender.id));
  if(senderWs?.readyState===1)senderWs.send(JSON.stringify({type:'friend_accepted',user:{id:accepter.id,displayName:accepter.displayName,icon:accepter.icon||''}}));
  res.json({ok:true});
});
app.post('/api/friend-requests/:id/reject',auth,(req,res)=>{
  const db=load(),meId=String(req.user.id);
  db.friendRequests=Array.isArray(db.friendRequests)?db.friendRequests:[];
  const x=db.friendRequests.find(x=>String(x.id)===String(req.params.id)&&String(x.to)===meId);
  if(!x)return res.status(404).json({error:'申請が見つかりません'});
  db.friendRequests=db.friendRequests.filter(y=>String(y.id)!==String(x.id));
  save(db);
  res.json({ok:true});
});
app.get('/api/chats/inbox',auth,(req,res)=>{try{
  const db=load(),meId=String(req.user.id);
  const rows=[...(db.messages||[]),...migrateDirectMessages()];
  const unique=new Map();
  for(const m of rows){
    if(!m||m.deleted||m.type!=='direct'||String(m.to)!==meId)continue;
    unique.set(String(m.id),m);
  }
  const list=[...unique.values()]
    .sort((a,b)=>(Number(a.createdAt)||0)-(Number(b.createdAt)||0))
    .slice(-200)
    .map(m=>messagePublic(db,m));
  res.json({messages:list});
}catch(e){res.status(500).json({error:'受信メッセージを取得できません'});}});
app.get('/api/chats/:otherId',auth,(req,res)=>{try{
  const db=load(),meId=String(req.user.id),otherId=String(req.params.otherId);
  if(!db.users.some(u=>String(u.id)===otherId))return res.status(404).json({error:'相手が見つかりません'});
  // 個人トークは専用ストアを正本にする。画面遷移やDB保存キューの影響を受けない。
  const rows=migrateDirectMessages();
  const unique=new Map();
  for(const m of rows){
    if(!m||m.deleted||m.type!=='direct')continue;
    if(!((String(m.from)===meId&&String(m.to)===otherId)||(String(m.from)===otherId&&String(m.to)===meId)))continue;
    unique.set(String(m.id),m);
  }
  const list=[...unique.values()]
    .sort((a,b)=>(Number(a.createdAt)||0)-(Number(b.createdAt)||0))
    .slice(-200)
    .map(m=>messagePublic(db,m));
  res.json({messages:list});
}catch(e){res.status(500).json({error:'トーク履歴を取得できません'});}});
function buildMessage(req,from,to,talkId,type){
  const text=String(req.body.text||'').trim(),image=String(req.body.image||''),sticker=String(req.body.sticker||'');
  if(!text&&!image&&!sticker)throw new Error('メッセージが空です');
  if(image&&(!image.startsWith('data:image/')||image.length>6*1024*1024))throw new Error('画像を送信できません');
  return {id:id(),type,from,to:to||null,talkId:talkId||null,text,image,sticker,replyTo:req.body.replyTo||null,createdAt:Date.now(),readBy:[]};
}
function messagePublic(db,m){
  const from=db.users.find(u=>String(u.id)===String(m.from));
  const to=m.to?db.users.find(u=>String(u.id)===String(m.to)):null;
  const readBy=Array.isArray(m.readBy)?m.readBy:[];
  let readTotal=0;
  if(m.to) readTotal=1;
  else if(m.talkId){
    const talk=(db.talks||[]).find(t=>t.id===m.talkId);
    readTotal=Math.max(0,(talk?.memberIds||[]).filter(id=>id!==m.from).length);
  }
  const readCount=readTotal?readBy.filter(id=>id!==m.from&&(m.to?String(id)===String(m.to):true)).length:0;
  return {...m,fromName:from?.displayName||'メンバー',fromIcon:from?.icon||'',toName:to?.displayName||'メンバー',toIcon:to?.icon||'',readCount,readTotal};
}
app.post('/api/chats/:otherId',auth,async(req,res)=>{try{
  const targetId=String(req.params.otherId);
  const m=await withDbWrite(db=>{
    const sender=db.users.find(u=>String(u.id)===String(req.user.id));
    if(!sender)throw Object.assign(new Error('送信者が見つかりません'),{status:401});
    const target=db.users.find(u=>String(u.id)===targetId);
    if(!target)throw Object.assign(new Error('相手が見つかりません'),{status:404});
    const msg=buildMessage(req,sender.id,target.id,null,'direct');
    const directRows=loadDirectMessages();
    directRows.push(msg);
    saveDirectMessages(directRows);
    notify(db,target.id,'message','新しいメッセージ',sender.displayName+'からメッセージが届きました',{messageId:msg.id,fromId:sender.id,toId:target.id,chatType:'direct'});
    return msg;
  });
  const persisted=loadDirectMessages().some(x=>String(x.id)===String(m.id)&&!x.deleted);
  if(!persisted)throw Object.assign(new Error('メッセージの保存を確認できませんでした'),{status:500});
  const payload=messagePublic(load(),m);
  wss.clients.forEach(c=>{if(c.readyState===1)c.send(JSON.stringify({type:'message',message:payload}))});
  res.json(payload);
}catch(e){res.status(e.status||400).json({error:e.message||'メッセージを送信できません'})}});
app.post('/api/chats/:otherId/read',auth,async(req,res)=>{try{
  const rows=loadDirectMessages();
  let changed=false;
  const mark=(m)=>{
    if(String(m.from)===String(req.params.otherId)&&String(m.to)===String(req.user.id)){
      m.readBy=Array.isArray(m.readBy)?m.readBy:[];
      if(!m.readBy.some(x=>String(x)===String(req.user.id))){m.readBy.push(req.user.id);changed=true}
    }
  };
  rows.forEach(mark);
  (db.messages||[]).forEach(m=>{if(m.type==='direct')mark(m)});
  if(changed)saveDirectMessages(rows);
  res.json({ok:true});
}catch(e){res.status(500).json({error:'既読更新に失敗しました'})}});
app.post('/api/messages/:id/delete',auth,(req,res)=>{const db=load();const m=db.messages.find(x=>x.id===req.params.id)||loadDirectMessages().find(x=>x.id===req.params.id);if(!m)return res.status(404).json({error:'メッセージが見つかりません'});if(String(m.from)!==String(req.user.id))return res.status(403).json({error:'自分のメッセージのみ送信取り消しできます'});if(m.type==='direct'){const rows=loadDirectMessages().filter(x=>x.id!==m.id);saveDirectMessages(rows)}else{db.messages=db.messages.filter(x=>x.id!==m.id);save(db)}wss.clients.forEach(c=>{if(c.readyState===1)c.send(JSON.stringify({type:'message_deleted',messageId:m.id}))});res.json({ok:true});});
app.post('/api/talks/:room/read',auth,async(req,res)=>{const room=String(req.params.room);if(!['class','classadmin','gradeadmin'].includes(room))return res.status(400).json({error:'トーク種別が不正です'});try{await withDbWrite(db=>{const talk=ensureTalk(db,req.user,room);if(!talk.memberIds.includes(req.user.id))throw Object.assign(new Error('このトークのメンバーではありません'),{status:403});const ids=db.talks.filter(t=>t.room===room&&String(t.schoolId)===String(req.user.schoolId)&&(room==='gradeadmin'||String(t.grade||'')===String(req.user.grade))&&(room==='gradeadmin'||String(t.className||'')===String(req.user.className))).map(t=>t.id);if(!ids.includes(talk.id))ids.push(talk.id);db.messages.filter(m=>!m.deleted&&ids.includes(m.talkId)&&m.from!==req.user.id).forEach(m=>{m.readBy=Array.isArray(m.readBy)?m.readBy:[];if(!m.readBy.includes(req.user.id))m.readBy.push(req.user.id)})});res.json({ok:true})}catch(e){res.status(e.status||500).json({error:e.message||'既読更新に失敗しました'})}});
app.post('/api/groups/:id/read',auth,async(req,res)=>{try{await withDbWrite(db=>{const talk=(db.talks||[]).find(t=>t.id===req.params.id&&t.room==='group');if(!talk||!talk.memberIds.includes(req.user.id))throw Object.assign(new Error('このグループのメンバーではありません'),{status:403});db.messages.filter(m=>!m.deleted&&m.talkId===talk.id&&m.from!==req.user.id).forEach(m=>{m.readBy=Array.isArray(m.readBy)?m.readBy:[];if(!m.readBy.includes(req.user.id))m.readBy.push(req.user.id)})});res.json({ok:true})}catch(e){res.status(e.status||500).json({error:e.message||'既読更新に失敗しました'})}});
app.get('/api/push/status',auth,(req,res)=>res.json({available:webPushReady,subscribed:Array.isArray(req.user.pushSubscriptions)&&req.user.pushSubscriptions.length>0}));
app.get('/api/push/vapid-public-key',auth,(req,res)=>{
  if(!webPushReady)return res.status(503).json({error:'プッシュ通知のサーバー設定が未完了です'});
  res.json({publicKey:process.env.NOVA_VAPID_PUBLIC_KEY});
});
app.post('/api/push/subscribe',auth,(req,res)=>{
  if(!webPushReady)return res.status(503).json({error:'プッシュ通知のサーバー設定が未完了です'});
  const sub=req.body?.subscription;
  if(!sub?.endpoint||!sub?.keys?.p256dh||!sub?.keys?.auth)return res.status(400).json({error:'通知購読情報が不正です'});
  const db=load(),u=db.users.find(x=>x.id===req.user.id);
  u.pushSubscriptions=Array.isArray(u.pushSubscriptions)?u.pushSubscriptions:[];
  u.pushSubscriptions=u.pushSubscriptions.filter(x=>x.endpoint!==sub.endpoint);
  u.pushSubscriptions.push({endpoint:String(sub.endpoint),expirationTime:sub.expirationTime||null,keys:{p256dh:String(sub.keys.p256dh),auth:String(sub.keys.auth)}});
  save(db);res.json({ok:true});
});
app.post('/api/push/unsubscribe',auth,(req,res)=>{
  const endpoint=String(req.body?.endpoint||'');const db=load(),u=db.users.find(x=>x.id===req.user.id);
  u.pushSubscriptions=Array.isArray(u.pushSubscriptions)?u.pushSubscriptions.filter(x=>x.endpoint!==endpoint):[];
  save(db);res.json({ok:true});
});
app.post('/api/push/test',auth,async(req,res)=>{
  if(!webPushReady)return res.status(503).json({error:'プッシュ通知のサーバー設定が未完了です'});
  try{
    const result=await sendPushNotification(req.user.id,{title:'Novaテスト通知',body:'プッシュ通知が正常に届いています',data:{type:'test',chatType:'test'}});
    res.json({ok:true,...result});
  }catch(e){
    console.error('WEB_PUSH_TEST_ERROR',e?.message);
    res.status(500).json({error:e?.message||'テスト通知の送信に失敗しました'});
  }
});
app.get('/api/notifications',auth,(req,res)=>{const db=load();res.json(db.notifications.filter(n=>n.userId===req.user.id).slice(0,100))});
app.post('/api/notifications/read',auth,(req,res)=>{const db=load();db.notifications.filter(n=>n.userId===req.user.id).forEach(n=>n.read=true);save(db);res.json({ok:true})});
function ensureInitialClassElection(db,user){const hasClassAdmin=db.users.some(u=>sameGroup(u,user)&&hasRole(u,'CLASS_ADMIN'));if(hasClassAdmin)return null;const scope=electionScope('CLASS_ADMIN',user);const open=db.elections.find(e=>e.status==='OPEN'&&e.type==='CLASS_ADMIN'&&e.schoolId===scope.schoolId&&e.grade===scope.grade&&e.className===scope.className);if(open)return open;const voters=electionVoters(db,{type:'CLASS_ADMIN',...scope});if(!voters.length)return null;const e={id:id(),type:'CLASS_ADMIN',...scope,candidates:[],voted:[],eligibleVoterIds:voters.map(u=>u.id),createdAt:Date.now(),endsAt:Date.now()+604800000,status:'OPEN',reelectionRequests:[],initialElection:true};db.elections.push(e);return e}
function ensureTalk(db,user,room){
  if(!Array.isArray(db.talks))db.talks=[];
  ensureUserSchoolIdentity(db,user);
  const sameSchool=x=>String(x.schoolId||'')===String(user.schoolId||'');
  const sameScope=x=>sameSchool(x)&&(room==='gradeadmin' ? true : (String(x.grade||'')===String(user.grade||'')&&String(x.className||'')===String(user.className||'')));
  if(room==='class'){
    db.talks.filter(x=>x.room==='class'&&!sameScope(x)).forEach(x=>{
      x.memberIds=Array.isArray(x.memberIds)?x.memberIds.filter(uid=>String(uid)!==String(user.id)):[];
    });
  }
  let matches=db.talks.filter(x=>x.room===room&&sameScope(x));
  let talk=matches[0];
  if(!talk){
    talk={id:id(),room,schoolId:user.schoolId,schoolName:user.schoolName,grade:room==='gradeadmin'?null:user.grade,className:room==='classadmin'?user.className:null,name:room==='class'?String(user.grade)+'年'+String(user.className)+'組 クラストーク':room==='school'?'学校トーク':room==='classadmin'?'CLASS ADMIN トーク':'GRADE ADMIN トーク',memberIds:[],createdAt:Date.now()};
    db.talks.push(talk);
  } if(room==='class')ensureInitialClassElection(db,user);
  for(const duplicate of matches.slice(1)){
    const ids=new Set([...(talk.memberIds||[]),...(duplicate.memberIds||[])]);
    talk.memberIds=[...ids];
    for(const m of (db.messages||[]))if(m.talkId===duplicate.id)m.talkId=talk.id;
    db.talks=db.talks.filter(x=>x.id!==duplicate.id);
  }
  talk.schoolId=user.schoolId;
  talk.schoolName=user.schoolName;
  if(room==='school')db.users.filter(x=>sameSchool(x)).forEach(x=>{if(!talk.memberIds.includes(x.id))talk.memberIds.push(x.id)});
  if(room==='class'){
    if(!Array.isArray(talk.removedMemberIds))talk.removedMemberIds=[];
    db.users.filter(x=>sameGroup(x,user)&&!talk.removedMemberIds.includes(x.id)).forEach(x=>{
      if(!talk.memberIds.includes(x.id))talk.memberIds.push(x.id);
    });
    talk.memberIds=talk.memberIds.filter(uid=>db.users.some(x=>String(x.id)===String(uid)&&sameGroup(x,user)&&!talk.removedMemberIds.includes(x.id)));
  }
  if(room==='classadmin'){
    const allowed=db.users.filter(x=>sameGroup(x,user)&&(hasRole(x,'CLASS_ADMIN')||hasRole(x,'GRADE_ADMIN')||hasRole(x,'SCHOOL_ADMIN'))).map(x=>x.id);
    talk.memberIds=talk.memberIds.filter(x=>allowed.includes(x));
    allowed.forEach(x=>{if(!talk.memberIds.includes(x))talk.memberIds.push(x)});
  }
  if(room==='gradeadmin'){
    const allowed=db.users.filter(x=>x.schoolId===user.schoolId&&(hasRole(x,'GRADE_ADMIN')||hasRole(x,'SCHOOL_ADMIN'))).map(x=>x.id);
    talk.memberIds=talk.memberIds.filter(x=>allowed.includes(x));
    allowed.forEach(x=>{if(!talk.memberIds.includes(x))talk.memberIds.push(x)});
  }
  return talk;
}
app.post('/api/talks/:room/members',auth,(req,res)=>{
  try{
    const room=String(req.params.room);
    if(room!=='class')return res.status(400).json({error:'このトークのメンバーは変更できません'});
    const db=load(),talk=ensureTalk(db,req.user,'class');
    if(!hasRole(req.user,'CLASS_ADMIN')||!sameGroup(req.user,talk))return res.status(403).json({error:'CLASS ADMIN権限が必要です'});
    const uid=String(req.body.userId||'');
    const target=db.users.find(u=>String(u.id)===uid);
    if(!target)return res.status(404).json({error:'ユーザーが見つかりません'});
    if(!sameGroup(target,req.user))return res.status(400).json({error:'同じクラスのユーザーだけ追加できます'});
    talk.removedMemberIds=Array.isArray(talk.removedMemberIds)?talk.removedMemberIds.filter(x=>String(x)!==uid):[];
    if(!talk.memberIds.includes(target.id))talk.memberIds.push(target.id);
    save(db);res.json({ok:true});
  }catch(e){res.status(400).json({error:e.message||'メンバーを追加できません'})}
});
app.delete('/api/talks/:room/members/:userId',auth,(req,res)=>{
  try{
    const room=String(req.params.room);
    if(room!=='class')return res.status(400).json({error:'このトークのメンバーは変更できません'});
    const db=load(),talk=ensureTalk(db,req.user,'class');
    if(!hasRole(req.user,'CLASS_ADMIN')||!sameGroup(req.user,talk))return res.status(403).json({error:'CLASS ADMIN権限が必要です'});
    const uid=String(req.params.userId);
    if(uid===String(req.user.id))return res.status(400).json({error:'自分自身は退会させられません'});
    const target=db.users.find(u=>String(u.id)===uid);
    if(!target||!sameGroup(target,req.user))return res.status(404).json({error:'このクラスのメンバーが見つかりません'});
    talk.memberIds=Array.isArray(talk.memberIds)?talk.memberIds.filter(x=>String(x)!==uid):[];
    talk.removedMemberIds=Array.isArray(talk.removedMemberIds)?talk.removedMemberIds:[]; 
    if(!talk.removedMemberIds.includes(target.id))talk.removedMemberIds.push(target.id);
    save(db);res.json({ok:true});
  }catch(e){res.status(400).json({error:e.message||'メンバーを退会させられません'})}
});
app.get('/api/talks/:room/members',auth,(req,res)=>{
  try{
    const room=String(req.params.room);
    if(!['class','classadmin','gradeadmin'].includes(room))return res.status(400).json({error:'トーク種別が不正です'});
    const db=load(),talk=ensureTalk(db,req.user,room);
    if(!talk.memberIds.includes(req.user.id))return res.status(403).json({error:'このトークのメンバーではありません'});
    res.json({members:talk.memberIds.map(id=>db.users.find(u=>u.id===id)).filter(Boolean).map(pub)});
  }catch(e){res.status(500).json({error:e.message||'所属メンバーを取得できません'})}
});
app.get('/api/groups/:id/members',auth,(req,res)=>{
  try{
    const db=load(),talk=(db.talks||[]).find(t=>t.room==='group'&&t.id===String(req.params.id));
    if(!talk||!talk.memberIds.includes(req.user.id))return res.status(403).json({error:'このグループのメンバーではありません'});
    res.json({members:talk.memberIds.map(id=>db.users.find(u=>u.id===id)).filter(Boolean).map(pub)});
  }catch(e){res.status(500).json({error:e.message||'所属メンバーを取得できません'})}
});
app.get('/api/call/participants',auth,(req,res)=>{try{const db=load();const scopeType=String(req.query.scope||'friend');let ids=[];if(scopeType==='school'){ids=db.users.filter(u=>u.schoolId===req.user.schoolId).map(u=>u.id)}else if(scopeType==='group'){const g=(db.talks||[]).find(t=>t.room==='group'&&t.id===String(req.query.groupId||'')&&Array.isArray(t.memberIds)&&t.memberIds.includes(req.user.id));if(!g)return res.status(403).json({error:'このグループのメンバーではありません'});ids=g.memberIds}else if(['class','classadmin','gradeadmin'].includes(scopeType)){const t=ensureTalk(db,req.user,scopeType);ids=t.memberIds}else{return res.status(400).json({error:'通話対象が不正です'})}ids=[...new Set(ids.filter(id=>id!==req.user.id))];res.json({participants:ids.map(id=>{const u=db.users.find(x=>x.id===id);return u?pub(u):null}).filter(Boolean)});}catch(e){res.status(400).json({error:e.message||'通話参加者を取得できません'})}});
app.get('/api/groups',auth,(req,res)=>{const db=load();const groups=(db.talks||[]).filter(t=>t.room==='group'&&Array.isArray(t.memberIds)&&t.memberIds.includes(req.user.id)).map(t=>({id:t.id,name:t.name,memberIds:t.memberIds,createdBy:t.createdBy,createdAt:t.createdAt}));res.json(groups)});
app.post('/api/groups',auth,(req,res)=>{try{const db=load();const name=String(req.body.name||'').trim();if(!name)return res.status(400).json({error:'グループ名を入力してください'});if(name.length>40)return res.status(400).json({error:'グループ名は40文字以内です'});const ids=Array.isArray(req.body.memberIds)?req.body.memberIds.map(String):[];const unique=[req.user.id,...ids.filter(x=>x!==req.user.id)];const valid=unique.filter(uid=>db.users.some(u=>u.id===uid));if(valid.length<2)return res.status(400).json({error:'友達を1人以上選択してください'});const friendIds=new Set(db.friends.filter(f=>f.a===req.user.id||f.b===req.user.id).map(f=>f.a===req.user.id?f.b:f.a));if(valid.slice(1).some(uid=>!friendIds.has(uid)))return res.status(403).json({error:'友達として追加した相手だけグループに追加できます'});const talk={id:id(),room:'group',schoolId:req.user.schoolId,grade:req.user.grade,className:req.user.className,name,memberIds:valid,createdBy:req.user.id,createdAt:Date.now()};if(!Array.isArray(db.talks))db.talks=[];db.talks.push(talk);valid.filter(x=>x!==req.user.id).forEach(uid=>notify(db,uid,'group_message',name,req.user.displayName+'がグループを作成しました'));save(db);res.json({id:talk.id,name:talk.name,memberIds:talk.memberIds})}catch(e){res.status(400).json({error:e.message||'グループを作成できません'})}});
app.post('/api/groups/:id/members',auth,async(req,res)=>{try{const result=await withDbWrite(db=>{const talk=(db.talks||[]).find(t=>t.room==='group'&&t.id===String(req.params.id));if(!talk)return Object.assign(new Error('グループが見つかりません'),{status:404});if(!talk.memberIds.includes(req.user.id))throw Object.assign(new Error('このグループのメンバーではありません'),{status:403});if(!hasRole(req.user,'SUPER_ADMIN')&&!hasRole(req.user,'SCHOOL_ADMIN')&&!hasRole(req.user,'GRADE_ADMIN')&&!hasRole(req.user,'CLASS_ADMIN'))throw Object.assign(new Error('管理者権限が必要です'),{status:403});const ids=Array.isArray(req.body.userIds)?req.body.userIds.map(String):[String(req.body.userId||'')];const added=[];for(const uid of [...new Set(ids)]){if(!uid||uid===String(req.user.id)||talk.memberIds.includes(uid))continue;const u=db.users.find(x=>String(x.id)===uid);if(!u)continue;talk.memberIds.push(uid);added.push(u);notify(db,uid,'group_message',talk.name,req.user.displayName+'がグループに追加しました',{groupId:talk.id,room:'group',chatType:'talk'})}return {talk,added}});save(load());res.json({ok:true,members:result.talk.memberIds.map(id=>load().users.find(u=>u.id===id)).filter(Boolean).map(pub)})}catch(e){res.status(e.status||400).json({error:e.message||'メンバーを追加できません'})}});
app.delete('/api/groups/:id/members/:userId',auth,async(req,res)=>{try{const result=await withDbWrite(db=>{const talk=(db.talks||[]).find(t=>t.room==='group'&&t.id===String(req.params.id));if(!talk)return Object.assign(new Error('グループが見つかりません'),{status:404});if(!talk.memberIds.includes(req.user.id))throw Object.assign(new Error('このグループのメンバーではありません'),{status:403});if(!hasRole(req.user,'SUPER_ADMIN')&&!hasRole(req.user,'SCHOOL_ADMIN')&&!hasRole(req.user,'GRADE_ADMIN')&&!hasRole(req.user,'CLASS_ADMIN'))throw Object.assign(new Error('管理者権限が必要です'),{status:403});const uid=String(req.params.userId);if(uid===String(req.user.id))throw Object.assign(new Error('自分自身は管理者操作で退会させられません'),{status:400});if(!talk.memberIds.includes(uid))throw Object.assign(new Error('そのユーザーはメンバーではありません'),{status:404});talk.memberIds=talk.memberIds.filter(x=>String(x)!==uid);const u=db.users.find(x=>String(x.id)===uid);if(u)notify(db,uid,'group_message',talk.name,'グループから退会しました',{groupId:talk.id,room:'group',chatType:'talk'});return talk});res.json({ok:true,members:result.memberIds.map(id=>load().users.find(u=>u.id===id)).filter(Boolean).map(pub)})}catch(e){res.status(e.status||400).json({error:e.message||'メンバーを退会させられません'})}});
app.get('/api/groups/:id',auth,(req,res)=>{const db=load(),talk=(db.talks||[]).find(t=>t.id===req.params.id&&t.room==='group');if(!talk||!talk.memberIds.includes(req.user.id))return res.status(403).json({error:'このグループのメンバーではありません'});const messages=db.messages.filter(m=>!m.deleted&&m.type==='group'&&m.talkId===talk.id).slice(-200).map(m=>messagePublic(db,m));res.json({talk,messages})});
app.post('/api/groups/:id/messages',auth,async(req,res)=>{try{const m=await withDbWrite(db=>{const talk=(db.talks||[]).find(t=>t.id===req.params.id&&t.room==='group');if(!talk||!talk.memberIds.includes(req.user.id))throw Object.assign(new Error('このグループのメンバーではありません'),{status:403});const text=String(req.body.text||'').trim();if(!text)throw Object.assign(new Error('メッセージを入力してください'),{status:400});const sender=db.users.find(u=>u.id===req.user.id)||req.user;const msg=buildMessage(req,sender.id,null,talk.id,'group');db.messages.push(msg);talk.memberIds.filter(x=>x!==req.user.id).forEach(uid=>notify(db,uid,'group_message',talk.name,sender.displayName+'からメッセージが届きました',{messageId:msg.id,talkId:talk.id,room:'group',chatType:'talk'}));return msg});const payload=messagePublic(load(),m);wss.clients.forEach(c=>{if(c.readyState===1)c.send(JSON.stringify({type:'group_message',message:payload,talkId:m.talkId}))});res.json(payload)}catch(e){res.status(e.status||400).json({error:e.message})}});
app.get('/api/talks',auth,(req,res)=>{
  try{
    const room=String(req.query.room||'class');
    if(!['class','classadmin','gradeadmin'].includes(room))return res.status(400).json({error:'トーク種別が不正です'});
    const db=load(),talk=ensureTalk(db,req.user,room);
    const messages=db.messages.filter(m=>!m.deleted&&m.type==='group'&&m.talkId===talk.id).slice(-200).map(m=>messagePublic(db,m));
    res.json({talk,messages});
  }catch(e){res.status(500).json({error:e.message||'トークを取得できません'});}
});
app.get('/api/talks/:room',auth,(req,res)=>{
  const room=String(req.params.room);
  if(!['school','class','classadmin','gradeadmin'].includes(room))return res.status(400).end();
  const db=load();
  const dbUser=db.users.find(x=>String(x.id)===String(req.user.id));
  if(!dbUser)return res.status(401).json({error:'アカウントを確認できません'});
  ensureUserSchoolIdentity(db,dbUser);
  const talk=ensureTalk(db,dbUser,room);
  // 過去に同じ学校・学年・クラスで重複作成されたトークがあっても、
  // それらの履歴をまとめて現在のクラストークに表示する。
  const matchingTalkIds=db.talks
    .filter(t=>t.room===room&&String(t.schoolId)===String(dbUser.schoolId)
      &&(room==='gradeadmin'||String(t.grade||'')===String(dbUser.grade))
      &&(room==='gradeadmin'||String(t.className||'')===String(dbUser.className)))
    .map(t=>t.id);
  if(!matchingTalkIds.includes(talk.id))matchingTalkIds.push(talk.id);
  const messages=db.messages
    .filter(m=>!m.deleted&&(m.type==='group'||m.type==='class')&&matchingTalkIds.includes(m.talkId))
    .sort((a,b)=>(a.createdAt||0)-(b.createdAt||0))
    .slice(-200)
    .map(m=>messagePublic(db,m));
  res.json({talk,messages});
});
app.post('/api/talks/:room/messages',auth,async(req,res)=>{
  const room=String(req.params.room);
  if(!['school','class','classadmin','gradeadmin'].includes(room))return res.status(400).json({error:'トーク種別が不正です'});
  try{
    const m=await withDbWrite(db=>{
      const dbUser=db.users.find(x=>String(x.id)===String(req.user.id));
      if(!dbUser)throw Object.assign(new Error('アカウントを確認できません'),{status:401});
      ensureUserSchoolIdentity(db,dbUser);
      const talk=ensureTalk(db,dbUser,room);
      if(!talk.memberIds.includes(dbUser.id))throw Object.assign(new Error('このトークのメンバーではありません'),{status:403});
      const text=String(req.body.text||'').trim();
      if(!text&&!req.body.image&&!req.body.sticker)throw Object.assign(new Error('メッセージを入力してください'),{status:400});
      const msg=buildMessage(req,dbUser.id,null,talk.id,'group');
      db.messages.push(msg);
      talk.memberIds.filter(x=>x!==dbUser.id).forEach(uid=>notify(db,uid,'group_message',talk.name,dbUser.displayName+'からメッセージが届きました',{messageId:msg.id,talkId:talk.id,room:talk.room,chatType:'talk'}));
      return msg;
    });
    const payload=messagePublic(load(),m);
    wss.clients.forEach(c=>{if(c.readyState===1)c.send(JSON.stringify({type:room==='class'?'class_message':'group_message',message:payload,talkId:m.talkId}))});
    res.json(payload);
  }catch(e){res.status(e.status||400).json({error:e.message||'メッセージを送信できません'});}
});
function scope(req){return {schoolId:req.user.schoolId,grade:req.user.grade,className:req.user.className}}
app.get('/api/class',auth,(req,res)=>{
  const db=load();
  if(!Array.isArray(db.classTalks))db.classTalks=[];
  let talk=db.classTalks.find(x=>x.schoolId===req.user.schoolId&&x.grade===req.user.grade&&x.className===req.user.className);
  if(!talk){
    talk={id:id(),schoolId:req.user.schoolId,schoolName:req.user.schoolName,grade:req.user.grade,className:req.user.className,name:`${req.user.grade}年${req.user.className}組 クラストーク`,createdAt:Date.now(),memberIds:[]};
    db.classTalks.push(talk);
  }
  if(!talk.memberIds.includes(req.user.id)){talk.memberIds.push(req.user.id);save(db);}
  const messages=(db.messages||[]).filter(m=>!m.deleted&&(m.type==='class'||m.type==='group')&&m.talkId===talk.id).slice(-200).map(m=>messagePublic(db,m));
  const members=db.users.filter(u=>talk.memberIds.includes(u.id)).map(pub);
  res.json({talk,messages,members});
});
app.post('/api/class/messages',auth,async(req,res)=>{try{
  const m=await withDbWrite(db=>{
    if(!Array.isArray(db.classTalks))db.classTalks=[];
    const dbUser=db.users.find(x=>String(x.id)===String(req.user.id))||req.user;
    let talk=db.classTalks.find(x=>x.schoolId===dbUser.schoolId&&x.grade===dbUser.grade&&x.className===dbUser.className);
    if(!talk){talk={id:id(),schoolId:dbUser.schoolId,schoolName:dbUser.schoolName,grade:dbUser.grade,className:dbUser.className,name:dbUser.grade+'年'+dbUser.className+'組 クラストーク',createdAt:Date.now(),memberIds:[]};db.classTalks.push(talk);}
    if(!talk.memberIds.includes(dbUser.id))talk.memberIds.push(dbUser.id);
    const text=String(req.body.text||'').trim();
    if(!text&&!req.body.image&&!req.body.sticker)throw Object.assign(new Error('メッセージを入力してください'),{status:400});
    const msg=buildMessage(req,dbUser.id,null,talk.id,'class');
    db.messages.push(msg);
    talk.memberIds.filter(x=>x!==dbUser.id).forEach(userId=>notify(db,userId,'class_message',talk.name,dbUser.displayName+'からメッセージが届きました',{messageId:msg.id,talkId:talk.id,room:'class',chatType:'talk'}));
    return msg;
  });
  const payload=messagePublic(load(),m);
  wss.clients.forEach(c=>{if(c.readyState===1)c.send(JSON.stringify({type:'class_message',message:payload,talkId:m.talkId}))});
  res.json(payload);
}catch(e){res.status(e.status||400).json({error:e.message||'メッセージを送信できません'});}});
app.post('/api/class/read',auth,async(req,res)=>{try{
  await withDbWrite(db=>{
    const talk=(db.classTalks||[]).find(x=>x.schoolId===req.user.schoolId&&x.grade===req.user.grade&&x.className===req.user.className);
    if(talk)db.messages.filter(m=>!m.deleted&&m.talkId===talk.id&&m.from!==req.user.id).forEach(m=>{m.readBy=Array.isArray(m.readBy)?m.readBy:[];if(!m.readBy.includes(req.user.id))m.readBy.push(req.user.id)});
  });
  res.json({ok:true});
}catch(e){res.status(500).json({error:'既読更新に失敗しました'});}});
app.get('/api/posts',auth,(req,res)=>{const db=load(),s=scope(req),kind=req.query.kind||'class';res.json(db.posts.filter(p=>p.kind===kind&&p.schoolId===s.schoolId&&(kind==='school'||p.grade===s.grade)&&(kind!=='class'||p.className===s.className)).slice(0,100))});
app.post('/api/posts',auth,(req,res)=>{const db=load(),s=scope(req),kind=req.body.kind||'class'; if(!canManage(req.user,kind))return res.status(403).json({error:'権限がありません'});const p={id:id(),...s,kind,title:req.body.title||'',body:req.body.body||'',authorId:req.user.id,createdAt:Date.now()};db.posts.unshift(p);save(db);res.json(p)});
function canManage(u,kind){
  const isAdmin=hasRole(u,'SUPER_ADMIN')||hasRole(u,'SCHOOL_ADMIN')||hasRole(u,'GRADE_ADMIN')||hasRole(u,'CLASS_ADMIN');
  if(kind==='school'||kind==='grade')return isAdmin;
  if(kind==='class')return hasRole(u,'CLASS_ADMIN')||hasRole(u,'GRADE_ADMIN')||hasRole(u,'SCHOOL_ADMIN')||hasRole(u,'SUPER_ADMIN');
  return false;
}
app.delete('/api/posts/:id',auth,(req,res)=>{const db=load(),p=db.posts.find(x=>String(x.id)===String(req.params.id));if(!p)return res.status(404).json({error:'投稿が見つかりません'});const sameSchool=String(p.schoolId)===String(req.user.schoolId);const isAuthor=String(p.authorId)===String(req.user.id);const isAdmin=hasRole(req.user,'SUPER_ADMIN')||hasRole(req.user,'SCHOOL_ADMIN')||hasRole(req.user,'GRADE_ADMIN')||hasRole(req.user,'CLASS_ADMIN');if(!sameSchool||(!isAuthor&&!isAdmin))return res.status(403).json({error:'この投稿を削除する権限がありません'});db.posts=db.posts.filter(x=>String(x.id)!==String(p.id));save(db);res.json({ok:true})});
app.get('/api/events',auth,(req,res)=>{const db=load(),s=scope(req);res.json(db.events.filter(e=>e.schoolId===s.schoolId&&(e.grade==null||e.grade===s.grade)).sort((a,b)=>a.date.localeCompare(b.date)))});
app.post('/api/events',auth,(req,res)=>{if(!(hasRole(req.user,'SUPER_ADMIN')||hasRole(req.user,'SCHOOL_ADMIN')))return res.status(403).end();const db=load(),s=scope(req);const e={id:id(),...s,title:req.body.title,date:req.body.date,place:req.body.place||'',body:req.body.body||''};db.events.push(e);db.users.filter(u=>u.schoolId===s.schoolId&&(e.grade==null||u.grade===e.grade)).forEach(u=>notify(db,u.id,'event','学校行事',e.title));save(db);res.json(e)});
app.get('/api/tasks',auth,(req,res)=>{const db=load(),s=scope(req);if(!Array.isArray(db.taskCompletions))db.taskCompletions=[];res.json(db.tasks.filter(t=>t.schoolId===s.schoolId&&t.grade===s.grade&&t.className===s.className).sort((a,b)=>(a.dueAt||Infinity)-(b.dueAt||Infinity)).map(t=>({...t,completed:db.taskCompletions.some(x=>x.taskId===t.id&&x.userId===req.user.id)})))});
app.post('/api/tasks/:id/complete',auth,(req,res)=>{const db=load();if(!Array.isArray(db.taskCompletions))db.taskCompletions=[];const t=db.tasks.find(x=>x.id===req.params.id);if(!t)return res.status(404).json({error:'課題が見つかりません'});if(!sameGroup(t,req.user))return res.status(403).json({error:'この課題を操作できません'});const i=db.taskCompletions.findIndex(x=>x.taskId===t.id&&x.userId===req.user.id);if(i>=0)db.taskCompletions.splice(i,1);else db.taskCompletions.push({id:id(),taskId:t.id,userId:req.user.id,completedAt:Date.now()});save(db);res.json({completed:i<0})});
app.post('/api/tasks',auth,(req,res)=>{if(!(hasRole(req.user,'SUPER_ADMIN')||hasRole(req.user,'SCHOOL_ADMIN')||hasRole(req.user,'GRADE_ADMIN')||hasRole(req.user,'CLASS_ADMIN')))return res.status(403).end();const db=load(),s=scope(req);const t={id:id(),...s,subject:req.body.subject,title:req.body.title,detail:req.body.detail||'',dueAt:req.body.dueAt||null,method:req.body.method||'',createdAt:Date.now()};db.tasks.push(t);db.users.filter(u=>sameGroup(u,req.user)).forEach(u=>notify(db,u.id,'task','課題が追加されました',t.title));save(db);res.json(t)});
app.get('/api/schedule',auth,(req,res)=>{
  const db=load(),s=scope(req);
  const base=db.schedules.filter(x=>x.schoolId===s.schoolId&&x.grade===s.grade&&x.className===s.className);
  if(!Array.isArray(db.scheduleChanges))db.scheduleChanges=[];
  const changes=db.scheduleChanges.filter(x=>x.schoolId===s.schoolId&&x.grade===s.grade&&x.className===s.className);
  res.json(base.map(x=>({...x,changes:changes.filter(c=>c.scheduleId===x.id)})));
});
app.get('/api/schedule/changes',auth,(req,res)=>{
  const db=load(),s=scope(req);
  if(!Array.isArray(db.scheduleChanges))db.scheduleChanges=[];
  res.json(db.scheduleChanges.filter(x=>x.schoolId===s.schoolId&&x.grade===s.grade&&x.className===s.className));
});
function canManageScheduleGroup(user,x){
  if(hasRole(user,'SUPER_ADMIN'))return true;
  if(hasRole(user,'SCHOOL_ADMIN')&&x.schoolId===user.schoolId)return true;
  if(hasRole(user,'GRADE_ADMIN')&&x.schoolId===user.schoolId&&x.grade===user.grade)return true;
  if(hasRole(user,'CLASS_ADMIN')&&sameGroup(x,user))return true;
  return false;
}
app.post('/api/schedule/changes',auth,(req,res)=>{
  const db=load(),s=scope(req);
  if(!(hasRole(req.user,'SUPER_ADMIN')||hasRole(req.user,'SCHOOL_ADMIN')||hasRole(req.user,'GRADE_ADMIN')||hasRole(req.user,'CLASS_ADMIN')))return res.status(403).json({error:'権限がありません'});
  const date=String(req.body.date||'').trim(),type=String(req.body.type||'').trim();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return res.status(400).json({error:'日付が正しくありません'});
  if(!['cancel','subject','period','room','temporary'].includes(type))return res.status(400).json({error:'変更種別が正しくありません'});
  const target={schoolId:s.schoolId,grade:s.grade,className:s.className};
  if(type!=='temporary'){
    const base=db.schedules.find(x=>x.id===req.body.scheduleId);
    if(!base||!canManageScheduleGroup(req.user,base))return res.status(403).json({error:'この時間割を変更できません'});
    target.scheduleId=base.id;
  }else target.scheduleId=null;
  const x={id:id(),...target,date,type,subject:String(req.body.subject||''),period:String(req.body.period||''),room:String(req.body.room||''),note:String(req.body.note||''),createdAt:Date.now(),createdBy:req.user.id};
  db.scheduleChanges=db.scheduleChanges.filter(y=>!(y.date===date&&y.scheduleId===x.scheduleId&&y.className===x.className&&y.grade===x.grade&&y.schoolId===x.schoolId));
  db.scheduleChanges.push(x);save(db);res.json(x);
});
app.delete('/api/schedule/changes/:id',auth,(req,res)=>{
  const db=load(),i=(db.scheduleChanges||[]).findIndex(x=>x.id===req.params.id);
  if(i<0)return res.status(404).json({error:'授業変更が見つかりません'});
  if(!canManageScheduleGroup(req.user,db.scheduleChanges[i]))return res.status(403).json({error:'権限がありません'});
  db.scheduleChanges.splice(i,1);save(db);res.json({ok:true});
});
app.post('/api/schedule',auth,(req,res)=>{if(!(hasRole(req.user,'SUPER_ADMIN')||hasRole(req.user,'SCHOOL_ADMIN')||hasRole(req.user,'GRADE_ADMIN')||hasRole(req.user,'CLASS_ADMIN')))return res.status(403).end();const db=load(),s=scope(req);const x={id:id(),...s,day:req.body.day,period:req.body.period,subject:req.body.subject,room:req.body.room||'',note:req.body.note||''};db.schedules.push(x);save(db);res.json(x)});
app.patch('/api/schedule/:id',auth,(req,res)=>{const db=load(),x=db.schedules.find(x=>x.id===req.params.id);if(!x)return res.status(404).json({error:'時間割が見つかりません'});if(!(hasRole(req.user,'SUPER_ADMIN')||hasRole(req.user,'SCHOOL_ADMIN')||hasRole(req.user,'GRADE_ADMIN')||hasRole(req.user,'CLASS_ADMIN'))||!sameGroup(x,req.user))return res.status(403).json({error:'権限がありません'});Object.assign(x,{day:String(req.body.day||x.day),period:String(req.body.period||x.period),subject:String(req.body.subject||x.subject),room:String(req.body.room||(x.room||'')),note:String(req.body.note||(x.note||''))});save(db);res.json(x)});
app.delete('/api/schedule/:id',auth,(req,res)=>{const db=load(),i=db.schedules.findIndex(x=>x.id===req.params.id);if(i<0)return res.status(404).json({error:'時間割が見つかりません'});if(!(hasRole(req.user,'SUPER_ADMIN')||hasRole(req.user,'SCHOOL_ADMIN')||hasRole(req.user,'GRADE_ADMIN')||hasRole(req.user,'CLASS_ADMIN'))||!sameGroup(db.schedules[i],req.user))return res.status(403).json({error:'権限がありません'});db.schedules.splice(i,1);save(db);res.json({ok:true})});
app.patch('/api/tasks/:id',auth,(req,res)=>{const db=load(),t=db.tasks.find(x=>x.id===req.params.id);if(!t)return res.status(404).json({error:'課題が見つかりません'});if(!(hasRole(req.user,'SUPER_ADMIN')||hasRole(req.user,'SCHOOL_ADMIN')||hasRole(req.user,'GRADE_ADMIN')||hasRole(req.user,'CLASS_ADMIN'))||!sameGroup(t,req.user))return res.status(403).json({error:'権限がありません'});Object.assign(t,{subject:String(req.body.subject||t.subject),title:String(req.body.title||t.title),detail:String(req.body.detail||(t.detail||'')),dueAt:req.body.dueAt||t.dueAt,method:String(req.body.method||(t.method||''))});save(db);res.json(t)});
app.delete('/api/tasks/:id',auth,(req,res)=>{const db=load(),i=db.tasks.findIndex(x=>x.id===req.params.id);if(i<0)return res.status(404).json({error:'課題が見つかりません'});if(!(hasRole(req.user,'SUPER_ADMIN')||hasRole(req.user,'SCHOOL_ADMIN')||hasRole(req.user,'GRADE_ADMIN')||hasRole(req.user,'CLASS_ADMIN'))||!sameGroup(db.tasks[i],req.user))return res.status(403).json({error:'権限がありません'});db.tasks.splice(i,1);db.taskCompletions=(db.taskCompletions||[]).filter(x=>x.taskId!==req.params.id);save(db);res.json({ok:true})});
app.post('/api/posts/:id/delete',auth,(req,res)=>{const db=load(),i=db.posts.findIndex(x=>x.id===req.params.id);if(i<0)return res.status(404).json({error:'投稿が見つかりません'});const p=db.posts[i];if(!(hasRole(req.user,'SUPER_ADMIN')||hasRole(req.user,'SCHOOL_ADMIN')||(p.kind==='grade'&&hasRole(req.user,'GRADE_ADMIN'))||(p.kind==='class'&&(hasRole(req.user,'CLASS_ADMIN')||hasRole(req.user,'GRADE_ADMIN'))))||p.schoolId!==req.user.schoolId)return res.status(403).json({error:'権限がありません'});db.posts.splice(i,1);save(db);res.json({ok:true})});
function electionScope(type,user){if(type==='CLASS_ADMIN')return {schoolId:user.schoolId,grade:user.grade,className:user.className};if(type==='GRADE_ADMIN')return {schoolId:user.schoolId,grade:user.grade,className:null};return {schoolId:user.schoolId,grade:null,className:null}}
function electionVoters(db,e){if(e.type==='CLASS_ADMIN')return db.users.filter(u=>sameGroup(u,{schoolId:e.schoolId,grade:e.grade,className:e.className})&&u.role==='STUDENT');if(e.type==='GRADE_ADMIN')return db.users.filter(u=>u.schoolId===e.schoolId&&u.grade===e.grade&&hasRole(u,'CLASS_ADMIN'));return db.users.filter(u=>u.schoolId===e.schoolId&&hasRole(u,'GRADE_ADMIN'))}
function finalizeElection(db,e){if(!e||e.status!=='OPEN')return false;e.status='CLOSED';e.closedAt=Date.now();const voters=electionVoters(db,e),total=voters.length,ranked=(e.candidates||[]).map(c=>({...c,votes:Number(c.votes||0)})).sort((a,b)=>b.votes-a.votes);if(!ranked.length)return true;const half=total>0&&ranked.some(c=>c.votes*2>=total),max=ranked[0].votes,winners=half?ranked.filter(c=>c.votes*2>=total):ranked.filter(c=>c.votes===max);e.winners=winners.map(c=>c.userId);for(const uid of e.candidates.map(c=>c.userId)){const u=db.users.find(x=>x.id===uid);if(!u)continue;if(u.role===e.type)u.role='STUDENT';u.adminRoles=Array.isArray(u.adminRoles)?u.adminRoles.filter(x=>x!==e.type):[]}for(const uid of e.winners){const u=db.users.find(x=>x.id===uid);if(!u)continue;u.adminRoles=Array.isArray(u.adminRoles)?u.adminRoles:[];if(u.role==='STUDENT')u.role=e.type;else if(u.role!==e.type&&!u.adminRoles.includes(e.type))u.adminRoles.push(e.type);notify(db,u.id,'admin_promotion','管理者に選出されました',e.type+'として選出されました。')}syncAdminTalks(db);return true}
function finalizeExpiredElections(db){let changed=false;for(const e of db.elections||[]){if(e.status==='OPEN'&&e.endsAt<=Date.now()){finalizeElection(db,e);changed=true}}return changed}
function canStartElection(user,type){if(type==='CLASS_ADMIN'||type==='GRADE_ADMIN'||type==='SCHOOL_ADMIN')return hasRole(user,'SCHOOL_ADMIN')||hasRole(user,'SUPER_ADMIN');return false}
function triggerReelectionForRole(db,role,user){
  const type=role; if(!['CLASS_ADMIN','GRADE_ADMIN','SCHOOL_ADMIN'].includes(type))return;
  const scope=electionScope(type,user);
  const existing=db.elections.find(e=>e.status==='OPEN'&&e.type===type&&e.schoolId===scope.schoolId&&(e.grade==null||e.grade===scope.grade)&&(e.className==null||e.className===scope.className));
  if(existing)return;
  let candidates=[];
  if(type==='CLASS_ADMIN')candidates=db.users.filter(u=>sameGroup(u,user)&&u.role==='STUDENT');
  else if(type==='GRADE_ADMIN')candidates=db.users.filter(u=>u.schoolId===user.schoolId&&u.grade===user.grade&&hasRole(u,'CLASS_ADMIN'));
  else candidates=db.users.filter(u=>u.schoolId===user.schoolId&&hasRole(u,'GRADE_ADMIN'));
  if(candidates.length){const e=startElection(db,user,type,candidates.map(u=>u.id));e.autoReelection=true;}
}
function startElection(db,user,type,candidateIds){const s=electionScope(type,user);if(db.elections.some(e=>e.status==='OPEN'&&e.type===type&&e.schoolId===s.schoolId&&(e.grade==null||e.grade===s.grade)&&(e.className==null||e.className===s.className)))throw new Error('この範囲では既に選挙が行われています');const candidates=[...new Set((candidateIds||[]).map(String))].map(uid=>db.users.find(u=>u.id===uid)).filter(Boolean);const valid=candidates.filter(u=>type==='CLASS_ADMIN'?sameGroup(u,user):type==='GRADE_ADMIN'?u.schoolId===user.schoolId&&u.grade===user.grade:u.schoolId===user.schoolId);if(!valid.length)throw new Error('候補者がいません');const e={id:id(),type,...s,candidates:valid.map(u=>({id:id(),userId:u.id,votes:0})),voted:[],eligibleVoterIds:electionVoters(db,{type,...s}).map(u=>u.id),createdAt:Date.now(),endsAt:Date.now()+604800000,status:'OPEN',reelectionRequests:[]};db.elections.push(e);return e}
app.get('/api/school/users',auth,(req,res)=>{if(!(hasRole(req.user,'SCHOOL_ADMIN')||hasRole(req.user,'SUPER_ADMIN')))return res.status(403).json({error:'権限がありません'});const db=load();res.json(db.users.filter(u=>u.schoolId===req.user.schoolId).map(pub))});
app.patch('/api/school/users/:id',auth,(req,res)=>{if(!(hasRole(req.user,'SCHOOL_ADMIN')||hasRole(req.user,'SUPER_ADMIN')))return res.status(403).json({error:'権限がありません'});const db=load(),u=db.users.find(x=>x.id===req.params.id);if(!u||u.schoolId!==req.user.schoolId)return res.status(404).json({error:'生徒が見つかりません'});if(req.body.grade!=null)u.grade=String(req.body.grade);if(req.body.className!=null)u.className=String(req.body.className).trim();if(req.body.attendanceNo!=null)u.attendanceNo=String(req.body.attendanceNo);syncAdminTalks(db);save(db);res.json(pub(u))});
app.get('/api/super/users/:id/profile',auth,(req,res)=>{
  if(!hasRole(req.user,'SUPER_ADMIN'))return res.status(403).json({error:'権限がありません'});
  const db=load(),u=db.users.find(x=>String(x.id)===String(req.params.id));
  if(!u)return res.status(404).json({error:'ユーザーが見つかりません'});
  res.json({...pub(u),passwordConfigured:!!u.passwordHash});
});
app.patch('/api/super/users/:id/profile',auth,(req,res)=>{
  if(!hasRole(req.user,'SUPER_ADMIN'))return res.status(403).json({error:'権限がありません'});
  const db=load(),u=db.users.find(x=>String(x.id)===String(req.params.id));
  if(!u)return res.status(404).json({error:'ユーザーが見つかりません'});
  if(req.body.lastName!=null)u.lastName=String(req.body.lastName).trim();
  if(req.body.firstName!=null)u.firstName=String(req.body.firstName).trim();
  if(req.body.grade!=null)u.grade=String(req.body.grade).trim();
  if(req.body.className!=null)u.className=String(req.body.className).trim();
  if(req.body.attendanceNo!=null)u.attendanceNo=String(req.body.attendanceNo).trim();
  u.displayName=[u.lastName,u.firstName].filter(Boolean).join(' ');
  if(req.body.password!=null){
    const p=String(req.body.password);
    if(p.length<1)return res.status(400).json({error:'パスワードを入力してください'});
    u.passwordHash=hash(p);
  }
  syncAdminTalks(db);save(db);res.json({...pub(u),passwordConfigured:!!u.passwordHash});
});
app.post('/api/super/users/:id/roles',auth,(req,res)=>{if(!hasRole(req.user,'SUPER_ADMIN'))return res.status(403).json({error:'権限がありません'});const db=load(),u=db.users.find(x=>x.id===req.params.id);if(!u)return res.status(404).json({error:'ユーザーが見つかりません'});const roles=Array.isArray(req.body.roles)?[...new Set(req.body.roles.map(String))]:[];const allowed=['CLASS_ADMIN','GRADE_ADMIN','SCHOOL_ADMIN','SUPER_ADMIN'];if(roles.some(r=>!allowed.includes(r)))return res.status(400).json({error:'不正な権限です'});if(u.id===req.user.id&&!roles.includes('SUPER_ADMIN'))return res.status(400).json({error:'自分のSUPER ADMIN権限は剥奪できません'});const old=[u.role,...(Array.isArray(u.adminRoles)?u.adminRoles:[])].filter(r=>r&&r!=='STUDENT');u.role=roles.includes('SUPER_ADMIN')?'SUPER_ADMIN':roles[0]||'STUDENT';u.adminRoles=roles.filter(r=>r!==u.role);for(const r of old.filter(r=>!roles.includes(r)))triggerReelectionForRole(db,r,u);syncAdminTalks(db);save(db);res.json({ok:true,user:pub(u)})});
app.post('/api/super/users/:id/revoke-role',auth,(req,res)=>{if(!hasRole(req.user,'SUPER_ADMIN'))return res.status(403).json({error:'権限がありません'});const db=load(),u=db.users.find(x=>x.id===req.params.id);if(!u)return res.status(404).json({error:'ユーザーが見つかりません'});const role=String(req.body.role||'');if(role==='SUPER_ADMIN'&&u.id===req.user.id)return res.status(400).json({error:'自分のSUPER ADMIN権限は剥奪できません'});u.adminRoles=Array.isArray(u.adminRoles)?u.adminRoles.filter(x=>x!==role):[];if(u.role===role)u.role='STUDENT';syncAdminTalks(db);save(db);res.json({ok:true,user:pub(u)})});

app.get('/api/elections/candidates',auth,(req,res)=>{const db=load();const changed=finalizeExpiredElections(db);const type=String(req.query.type||'CLASS_ADMIN');let list=[];if(type==='CLASS_ADMIN')list=db.users.filter(u=>sameGroup(u,req.user)&&u.role==='STUDENT');else if(type==='GRADE_ADMIN')list=db.users.filter(u=>u.schoolId===req.user.schoolId&&u.grade===req.user.grade&&hasRole(u,'CLASS_ADMIN'));else if(type==='SCHOOL_ADMIN')list=db.users.filter(u=>u.schoolId===req.user.schoolId&&hasRole(u,'GRADE_ADMIN'));else return res.status(400).json({error:'選挙種別が不正です'});if(changed)save(db);res.json(list.map(pub))});
app.get('/api/elections',auth,(req,res)=>{const db=load();const changed=finalizeExpiredElections(db);const s=scope(req);const out=db.elections.filter(e=>e.schoolId===s.schoolId&&(e.grade==null||e.grade===s.grade)&&(e.className==null||e.className===s.className)).map(e=>({...e,voted:(e.voted||[]).includes(req.user.id),eligible:electionVoters(db,e).some(u=>String(u.id)===String(req.user.id)),candidates:(e.candidates||[]).map(c=>({id:c.id,userId:c.userId,name:(db.users.find(u=>u.id===c.userId)?.displayName)||'不明',votes:c.votes||0}))}));if(changed)save(db);res.json(out)});
app.post('/api/elections',auth,(req,res)=>{try{const type=String(req.body.type||'');if(!canStartElection(req.user,type))return res.status(403).json({error:'この選挙を開始する権限がありません'});const db=load();finalizeExpiredElections(db);const e=startElection(db,req.user,type,req.body.candidateIds||[]);save(db);res.json(e)}catch(e){res.status(400).json({error:e.message})}});
app.post('/api/elections/:id/candidate',auth,(req,res)=>{try{const db=load(),e=db.elections.find(x=>x.id===req.params.id);if(!e)return res.status(404).json({error:'選挙が見つかりません'});if(e.status==='OPEN'&&e.endsAt<=Date.now()){finalizeElection(db,e);save(db);return res.status(400).json({error:'立候補期間が終了しました'})}if(e.status!=='OPEN')return res.status(400).json({error:'立候補期間が終了しました'});const eligible=electionVoters(db,e).some(u=>String(u.id)===String(req.user.id));if(!eligible)return res.status(403).json({error:'この選挙に立候補する資格がありません'});const already=e.candidates.some(c=>String(c.userId)===String(req.user.id));if(already)return res.status(400).json({error:'すでに立候補しています'});e.candidates.push({id:id(),userId:req.user.id,votes:0});e.eligibleVoterIds=[...new Set([...(e.eligibleVoterIds||[]),req.user.id])];save(db);res.json({ok:true})}catch(e){res.status(400).json({error:e.message})}});
app.post('/api/elections/:id/vote',auth,(req,res)=>{try{const db=load(),e=db.elections.find(x=>x.id===req.params.id);if(!e)return res.status(404).json({error:'選挙が見つかりません'});if(e.status==='OPEN'&&e.endsAt<=Date.now()){finalizeElection(db,e);save(db);return res.status(400).json({error:'投票期間が終了しました'})}if(e.status!=='OPEN')return res.status(400).json({error:'投票期間が終了しました'});if(!electionVoters(db,e).some(u=>String(u.id)===String(req.user.id)))return res.status(403).json({error:'この選挙の投票資格がありません'});if(e.voted.includes(req.user.id))return res.status(400).json({error:'すでに投票しています'});const c=e.candidates.find(c=>c.id===req.body.candidateId);if(!c)return res.status(400).json({error:'候補者が不正です'});if(c.userId===req.user.id)return res.status(400).json({error:'自分には投票できません'});c.votes++;e.voted.push(req.user.id);save(db);res.json({ok:true})}catch(e){res.status(400).json({error:e.message})}});
app.post('/api/elections/:id/reelection-request',auth,(req,res)=>{const db=load(),e=db.elections.find(x=>x.id===req.params.id);if(!e)return res.status(404).json({error:'選挙が見つかりません'});e.reelectionRequests=Array.isArray(e.reelectionRequests)?e.reelectionRequests:[];const isSchoolOrSuper=hasRole(req.user,'SCHOOL_ADMIN')||hasRole(req.user,'SUPER_ADMIN');if(!isSchoolOrSuper){const students=db.users.filter(u=>u.role==='STUDENT'&&u.schoolId===e.schoolId&&(e.grade==null||u.grade===e.grade)&&(e.className==null||u.className===e.className));if(!students.some(u=>String(u.id)===String(req.user.id)))return res.status(403).json({error:'生徒本人のみ変更要望を送信できます'});if(!e.reelectionRequests.includes(req.user.id))e.reelectionRequests.push(req.user.id);const threshold=Math.floor(students.length/2)+1;if(e.reelectionRequests.length<threshold){save(db);return res.json({ok:true,started:false,requests:e.reelectionRequests.length,threshold})}}try{startElection(db,req.user,e.type,e.candidates.map(c=>c.userId));e.autoReelection=true;e.reelectionRequests=[];save(db);return res.json({ok:true,started:true,requests:0,threshold:0})}catch(err){save(db);return res.status(400).json({error:err.message})}});
app.post('/api/me/leave-admin',auth,(req,res)=>{const db=load(),u=db.users.find(x=>x.id===req.user.id);const role=String(req.body.role||'');if(!['CLASS_ADMIN','GRADE_ADMIN','SCHOOL_ADMIN'].includes(role)||!hasRole(u,role))return res.status(400).json({error:'その管理者権限はありません'});u.adminRoles=Array.isArray(u.adminRoles)?u.adminRoles.filter(x=>x!==role):[];if(u.role===role)u.role='STUDENT';triggerReelectionForRole(db,role,u);syncAdminTalks(db);save(db);res.json({ok:true,user:pub(u)});});
function loadStudyEntries(id,file){
  const p=path.join(__dirname,'data',file);
  if(!fs.existsSync(p))return [];
  const lines=fs.readFileSync(p,'utf8').replace(/^\\uFEFF/,'').split(/\\r?\\n/).map(x=>x.trim()).filter(Boolean);
  if(id==='irohani'){
    const out=[];
    for(let i=0;i<lines.length;i++){
      const word=lines[i];
      if(word.startsWith('【'))continue;
      const meanings=[];
      for(let j=i+1;j<Math.min(i+15,lines.length);j++){
        const line=lines[j];
        if(line.startsWith('【KEY】'))break;
        if(line.startsWith('【'))break;
        if(/^[①-⑳]/.test(line))meanings.push(line);
        else if(meanings.length)meanings.push(line);
      }
      if(meanings.length)out.push({no:out.length+1,q:word,a:meanings.join('；'),type:'jp'});
    }
    return out;
  }
  const out=[];
  for(const line of lines){
    if(/^(英単語|No\\.?)(?:\\s|$)/.test(line))continue;
    let m=line.match(/^(\\d+)\\s+(.+?)\\s{2,}(.+)$/);
    if(!m)m=line.match(/^(\\d+)\\t(.+?)\\t(.+)$/);
    if(!m)m=line.match(/^(\\d+)\\s+([^\\s]+)\\s+(.+)$/);
    if(m)out.push({no:Number(m[1]),q:m[2].trim(),a:m[3].trim(),type:'en'});
  }
  return out;
}
app.get('/api/study/books',auth,(req,res)=>{
  const defs=[
    {id:'target1200',name:'ターゲット1200',file:'target1200.txt'},
    {id:'target1900',name:'ターゲット1900',file:'target1900.txt'},
    {id:'tekkyoku',name:'鉄壁',file:'tekkyoku.txt'},
    {id:'irohani',name:'いろはにほへと古文単語',file:'irohani.txt'}
  ];
  res.json(defs.map(b=>({...b,path:'/data/'+b.file,entries:loadStudyEntries(b.id,b.file)})));
});
app.get('/data/:file', (req,res)=>{const base=path.join(__dirname,'data'); const file=path.basename(req.params.file); const allowed=new Set(['target1200.txt','target1900.txt','tekkyoku.txt','irohani.txt']); if(!allowed.has(file))return res.status(404).end(); const p=path.join(base,file); if(!fs.existsSync(p))return res.status(404).json({error:'単語帳データが見つかりません'}); res.sendFile(p)});
app.get('/api/admins',auth,(req,res)=>{const db=load();res.json(db.users.filter(u=>u.schoolId===req.user.schoolId&&(hasRole(u,'CLASS_ADMIN')||hasRole(u,'GRADE_ADMIN')||hasRole(u,'SCHOOL_ADMIN')||hasRole(u,'SUPER_ADMIN'))).map(pub))});
app.get('/api/debug/state',auth,(req,res)=>{if(!hasRole(req.user,'SUPER_ADMIN'))return res.status(403).end();const db=load();res.json({...db,users:db.users.map(pub)});});
app.post('/api/super/users/:id/role',auth,(req,res)=>{if(!hasRole(req.user,'SUPER_ADMIN'))return res.status(403).json({error:'権限がありません'});const db=load(),u=db.users.find(x=>String(x.id)===String(req.params.id));if(!u)return res.status(404).json({error:'ユーザーが見つかりません'});const role=String(req.body.role||'STUDENT');const oldRoles=[u.role,...(Array.isArray(u.adminRoles)?u.adminRoles:[])];const allowed=['STUDENT','CLASS_ADMIN','GRADE_ADMIN','SCHOOL_ADMIN','SUPER_ADMIN'];if(!allowed.includes(role))return res.status(400).json({error:'不正な権限です'});if(u.id===req.user.id&&role!=='SUPER_ADMIN')return res.status(400).json({error:'自分のSUPER ADMIN権限は剥奪できません'});u.adminRoles=Array.isArray(u.adminRoles)?u.adminRoles:[];if(role==='STUDENT'){u.role='STUDENT';u.adminRoles=[]}else if(u.role==='STUDENT')u.role=role;else if(u.role!==role&&!u.adminRoles.includes(role))u.adminRoles.push(role);for(const r of oldRoles.filter(r=>r!=='STUDENT'&&!([role].includes(r))))triggerReelectionForRole(db,r,u);syncAdminTalks(db);save(db);res.json({ok:true,user:pub(u)})});
app.post('/api/super/users/:id/ban',auth,(req,res)=>{
  if(!hasRole(req.user,'SUPER_ADMIN'))return res.status(403).json({error:'権限がありません'});
  const db=load(),u=db.users.find(x=>String(x.id)===String(req.params.id));
  if(!u)return res.status(404).json({error:'ユーザーが見つかりません'});
  if(hasRole(u,'SUPER_ADMIN'))return res.status(400).json({error:'SUPER ADMINはBANできません'});
  u.banned=true;u.bannedAt=Date.now();u.banReason=String(req.body.reason||'SUPER ADMINによる利用停止');
  save(db);
  const targetWs=wsUsers.get(String(u.id));
  if(targetWs?.readyState===1){
    try{targetWs.send(JSON.stringify({type:'account_banned',reason:u.banReason}));}catch{}
    setTimeout(()=>{try{targetWs.close(4003,'banned')}catch{}},100);
  }
  res.json({ok:true,user:pub(u)});
});
app.post('/api/super/users/:id/unban',auth,(req,res)=>{
  if(!hasRole(req.user,'SUPER_ADMIN'))return res.status(403).json({error:'権限がありません'});
  const db=load(),u=db.users.find(x=>x.id===req.params.id);
  if(!u)return res.status(404).json({error:'ユーザーが見つかりません'});
  u.banned=false;delete u.bannedAt;delete u.banReason;save(db);res.json({ok:true,user:pub(u)});
});


function normalizeAdminIdentity(value){
  return String(value||'').replace(/\u3000/g,' ').trim().replace(/\s+/g,' ');
}
function ensureYamamura1Class5Schedule(db){
  if(!db||!Array.isArray(db.schedules))return false;
  const school=db.schools.find(x=>normalizeAdminIdentity(x.name)==='山村学園高等学校'||normalizeAdminIdentity(x.name)==='山村学園高校'||normalizeAdminIdentity(x.name).includes('山村学園'));
  if(!school)return false;
  const group=db.users.filter(u=>String(u.schoolId)===String(school.id)&&String(u.grade)==='1'&&String(u.className)==='5');
  if(!group.length)return false;
  const exists=db.schedules.some(x=>String(x.schoolId)===String(school.id)&&String(x.grade)==='1'&&String(x.className)==='5');
  if(exists)return false;
  const preset=[
    ['月',1,'公共','薮上先生',''],['月',2,'数学A','雨宮先生',''],['月',3,'生物基礎','後藤先生',''],['月',4,'芸術I','音楽：勝田先生 / 美術：間々田先生 / 書道：真篠先生',''],['月',5,'数学I','渡辺先生',''],['月',6,'物理基礎','岩田先生',''],
    ['火',1,'物理基礎','岩田先生',''],['火',2,'現代の国語','松波先生',''],['火',3,'言語文化','松波先生',''],['火',4,'化学基礎','宮岡先生',''],['火',5,'情報I','田倉先生','情報処理室 I'],['火',6,'芸術I','音楽：勝田先生 / 美術：間々田先生 / 書道：真篠先生',''],['火',7,'公共','数上先生',''],
    ['水',1,'英コミュI','松浦先生',''],['水',2,'歴史総合','畠山先生',''],['水',3,'生物基礎','後藤先生',''],['水',4,'情報I','田倉先生','情報処理室 I'],['水',5,'英コミュI','松浦先生',''],['水',6,'言語文化','松波先生',''],['水',7,'数学I','渡辺先生',''],
    ['木',1,'数学I','渡辺先生',''],['木',2,'論理表現I','柳川先生',''],['木',3,'体育','小宮先生 / 鈴木先生 / 岡野先生',''],['木',4,'英コミュI','松浦先生',''],['木',5,'総合探究','渡辺先生',''],['木',6,'LHR','渡辺先生',''],
    ['金',1,'体育','小宮先生 / 鈴木先生 / 岡野先生',''],['金',2,'言語文化','松波先生',''],['金',3,'現代の国語','松波先生',''],['金',4,'数学A','雨宮先生',''],['金',5,'地理総合','竹貫先生',''],['金',6,'化学基礎','宮岡先生',''],['金',7,'英コミュI','松浦先生',''],
    ['土',1,'地理総合','竹貫先生',''],['土',2,'論理表現I','柳川先生',''],['土',3,'歴史総合','畠山先生',''],['土',4,'数学A','雨宮先生','']
  ];
  for(const [day,period,subject,teacher,room] of preset){
    db.schedules.push({id:id(),schoolId:school.id,schoolName:school.name,grade:'1',className:'5',day,period,subject,room,note:teacher});
  }
  return true;
}

function promoteOwnerToSuperAdmin(){
  try{
    const db=load();
    const schoolNames=['山村学園高校','山村学園高等学校'];
    const targetLast='谷利';
    const targetFirst='優樹';
    const u=db.users.find(x=>{
      const school=normalizeAdminIdentity(x.schoolName);
      const last=normalizeAdminIdentity(x.lastName);
      const first=normalizeAdminIdentity(x.firstName);
      const display=normalizeAdminIdentity(x.displayName);
      const schoolMatch=schoolNames.includes(school)||school.includes('山村学園');
      const nameMatch=(last===targetLast&&first===targetFirst)||display===targetLast+' '+targetFirst;
      return schoolMatch&&nameMatch;
    });
    if(!u){
      console.log('SUPER_ADMIN_OWNER_NOT_FOUND');
      return;
    }
    if(u.role!=='SUPER_ADMIN'){
      u.role='SUPER_ADMIN';
      save(db);
      console.log('SUPER_ADMIN_OWNER_PROMOTED',u.id);
    }else{
      console.log('SUPER_ADMIN_OWNER_ALREADY_SET',u.id);
    }
  }catch(e){
    console.error('SUPER_ADMIN_OWNER_PROMOTE_ERROR',e);
  }
}
promoteOwnerToSuperAdmin();
try{const db=load();if(ensureYamamura1Class5Schedule(db))save(db)}catch(e){console.error('YAMAMURA_1_5_SCHEDULE_PRESET_ERROR',e)}
const wsUsers=new Map();
const pendingCallSignals=new Map();
function queueCallSignal(userId,payload){const key=String(userId);const now=Date.now();const rows=(pendingCallSignals.get(key)||[]).filter(x=>now-x.at<120000);rows.push({at:now,payload});pendingCallSignals.set(key,rows.slice(-30));}
function deliverPendingCallSignals(userId,ws){const key=String(userId),rows=pendingCallSignals.get(key)||[];pendingCallSignals.delete(key);rows.filter(x=>Date.now()-x.at<120000).forEach(x=>{if(ws.readyState===1)ws.send(JSON.stringify(x.payload))})}
function userFromWsToken(raw){
  try{
    const [b,s]=String(raw||'').split('.');
    if(!b||!s)return null;
    const secret=process.env.NOVA_SECRET||'nova-dev-secret-change-me';
    const expected=crypto.createHmac('sha256',secret).update(b).digest('base64url');
    if(s.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(s),Buffer.from(expected)))return null;
    const p=JSON.parse(Buffer.from(b,'base64url').toString('utf8'));
    if(!p.id||!p.exp||p.exp<Date.now())return null;
    const db=load(),u=db.users.find(x=>x.id===p.id);
    return u&&!u.banned?u:null;
  }catch{return null}
}
wss.on('connection',(ws,req)=>{
  const q=new URL(req.url,'http://localhost').searchParams;
  const u=userFromWsToken(q.get('token'));
  if(!u){ws.close(1008,'auth');return}
  ws.userId=String(u.id);wsUsers.set(String(u.id),ws);deliverPendingCallSignals(u.id,ws);
  ws.on('message',raw=>{
    try{
      const m=JSON.parse(String(raw));
      if(m.type==='call_signal'&&m.toUserId){
        const payload={...m,fromUserId:u.id,fromName:u.displayName,fromIcon:u.icon||''};
        const target=wsUsers.get(String(m.toUserId));
        if(target?.readyState===1)target.send(JSON.stringify(payload));
        else{
          queueCallSignal(m.toUserId,payload);
          if(m.action==='offer'){const db=load();notify(db,m.toUserId,'call','着信',u.displayName+'から'+(m.mode==='video'?'ビデオ通話':'音声通話')+'の着信があります',{fromId:u.id,callId:m.callId,mode:m.mode,chatType:'call'});save(db)}
        }
      }else if(m.type==='call_signal'&&Array.isArray(m.toUserIds)){
        const payload={...m,fromUserId:u.id,fromName:u.displayName,fromIcon:u.icon||''};
        [...new Set(m.toUserIds.map(String).filter(id=>id!==String(u.id)))].forEach(id=>{
          const target=wsUsers.get(id);
          if(target?.readyState===1)target.send(JSON.stringify(payload));
          else{
            queueCallSignal(id,payload);
            if(m.action==='offer'){const db=load();notify(db,id,'call','着信',u.displayName+'から'+(m.mode==='video'?'ビデオ通話':'音声通話')+'の着信があります',{fromId:u.id,callId:m.callId,mode:m.mode,chatType:'call'});save(db)}
          }
        });
      }
    }catch{}
  });
  ws.on('close',()=>{if(wsUsers.get(String(u.id))===ws)wsUsers.delete(String(u.id))});
});
app.use((req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
server.listen(process.env.PORT||3000,()=>console.log('Nova running on http://localhost:'+(process.env.PORT||3000)));
