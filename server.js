import express from 'express';
import {createServer} from 'http';
import {WebSocketServer} from 'ws';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const app=express(); const server=createServer(app); const wss=new WebSocketServer({server,path:'/ws'});
app.use(express.json({limit:'8mb'})); app.use(express.static(path.join(__dirname,'public')));
const DB=path.join(__dirname,'db.json');
const empty={users:[],schools:[],messages:[],classTalks:[],talks:[],friends:[],posts:[],events:[],tasks:[],taskCompletions:[],schedules:[],elections:[],notifications:[],calls:[]};
const SCHOOL_STARTER=['早稲田大学高等学院','早稲田実業学校高等部','慶應義塾高等学校','開成高等学校','筑波大学附属高等学校','東京学芸大学附属高等学校','日比谷高等学校','浦和高等学校','浦和第一女子高等学校','川越高等学校','川越女子高等学校','川越東高等学校','熊谷高等学校','山村学園高等学校','山村国際高等学校','大宮高等学校','所沢高等学校','春日部高等学校','越谷北高等学校','栄東高等学校','淑徳与野高等学校','明治大学付属明治高等学校','青山学院高等部','中央大学附属高等学校','立教新座高等学校'];
function load(){if(!fs.existsSync(DB)) fs.writeFileSync(DB,JSON.stringify(empty,null,2)); return JSON.parse(fs.readFileSync(DB,'utf8'));}
function save(db){fs.writeFileSync(DB,JSON.stringify(db,null,2));}
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
    next();
  }catch{res.status(401).json({error:'認証が必要です'})}
}
function pub(u){const {passwordHash,...x}=u;return x}
function notify(db,userId,type,title,body){db.notifications.unshift({id:id(),userId,type,title,body,read:false,createdAt:Date.now()});}
function sameGroup(a,b){return a.schoolId===b.schoolId&&a.grade===b.grade&&a.className===b.className}

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
    const {schoolId,schoolName,grade,className,attendanceNo,lastName,firstName,password,icon}=req.body;
    const displayName=[lastName,firstName].filter(Boolean).join(' ').trim();
    if(!schoolName||!grade||!className||!attendanceNo||!lastName||!firstName||!password)return res.status(400).json({error:'必須項目をすべて入力してください'});
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
    const u={id:id(),schoolId:school.id,schoolName:school.name,grade:String(grade),className:normalizedClass,attendanceNo:String(attendanceNo),lastName:String(lastName).trim(),firstName:String(firstName).trim(),displayName,icon:icon||'',passwordHash:hash(password),role:'STUDENT',createdAt:Date.now(),settings:{notifications:true,callSound:true}};
    db.users.push(u);
    if(!Array.isArray(db.classTalks))db.classTalks=[];
    let talk=db.classTalks.find(x=>x.schoolId===school.id&&x.grade===String(grade)&&x.className===normalizedClass);
    if(!talk){
      talk={id:id(),schoolId:school.id,schoolName:school.name,grade:String(grade),className:normalizedClass,name:String(grade)+'年'+normalizedClass+'組 クラストーク',createdAt:Date.now(),memberIds:[]};
      db.classTalks.push(talk);
    }
    if(!talk.memberIds.includes(u.id))talk.memberIds.push(u.id);
    save(db);
    res.json({token:token(u),user:pub(u)});
  }catch(e){
    console.error('REGISTER_ERROR',e);
    res.status(500).json({error:'登録処理に失敗しました'});
  }
});
function normalizeLoginText(value){
  return String(value??'').replace(/\u3000/g,' ').trim().replace(/\s+/g,' ');
}
function safeVerify(password,passwordHash){
  try{
    if(!passwordHash||typeof passwordHash!=='string'||!passwordHash.includes(':'))return false;
    return verify(String(password??''),passwordHash);
  }catch{return false}
}
function ensureSuperAdminOwner(u,db){
  if(!u)return false;
  const school=normalizeAdminIdentity(u.schoolName);
  const last=normalizeAdminIdentity(u.lastName);
  const first=normalizeAdminIdentity(u.firstName);
  const display=normalizeAdminIdentity(u.displayName);
  const isOwner=(school.includes('山村学園')&&((last==='谷利'&&first==='優樹')||display==='谷利 優樹'));
  if(isOwner&&u.role!=='SUPER_ADMIN'){u.role='SUPER_ADMIN';save(db);console.log('SUPER_ADMIN_OWNER_PROMOTED_ON_AUTH',u.id);return true}
  return isOwner;
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
    ensureSuperAdminOwner(u,db);
    if(u.banned)return res.status(401).json({error:'このアカウントは利用停止中です'});
    if(!safeVerify(req.body.password,u.passwordHash))return res.status(401).json({error:'学校名・氏名・パスワードを確認してください'});
    res.json({token:token(u),user:pub(u)});
  }catch(e){
    console.error('LOGIN_ERROR',e);
    res.status(500).json({error:'ログイン処理に失敗しました'});
  }
});
app.get('/api/me',auth,(req,res)=>res.json(pub(req.user)));
app.patch('/api/me',auth,(req,res)=>{
  try{
    const db=load(),u=db.users.find(x=>x.id===req.user.id);
    const nextSchool=String(req.body.schoolName??u.schoolName).trim();
    const nextGrade=String(req.body.grade??u.grade);
    const nextClass=String(req.body.className??u.className).trim();
    const nextLast=String(req.body.lastName??u.lastName).trim();
    const nextFirst=String(req.body.firstName??u.firstName).trim();
    if(!nextSchool||!['1','2','3'].includes(nextGrade)||!nextClass||!nextLast||!nextFirst)return res.status(400).json({error:'学校・学年・クラス・氏名を正しく入力してください'});
    if(req.body.newPassword){
      if(!req.body.currentPassword||!safeVerify(req.body.currentPassword,u.passwordHash))return res.status(401).json({error:'現在のパスワードが正しくありません'});
      if(String(req.body.newPassword).length<6)return res.status(400).json({error:'パスワードは6文字以上にしてください'});
      u.passwordHash=hash(String(req.body.newPassword));
    }
    Object.assign(u,{schoolName:nextSchool,grade:nextGrade,className:nextClass,lastName:nextLast,firstName:nextFirst,displayName:`${nextLast} ${nextFirst}`,icon:req.body.icon??u.icon,settings:{...u.settings,...(req.body.settings||{})}});
    const school=db.schools.find(x=>x.id===u.schoolId||x.name===nextSchool);
    if(school)u.schoolId=school.id;
    else{const ns={id:id(),masterId:null,name:nextSchool,grades:[]};db.schools.push(ns);u.schoolId=ns.id;}
    save(db);res.json(pub(u));
  }catch(e){console.error('ME_UPDATE_ERROR',e);res.status(500).json({error:'設定の保存に失敗しました'})}
});

app.get('/api/users/search',auth,(req,res)=>{const db=load(),q=(req.query.q||'').toLowerCase();res.json(db.users.filter(u=>u.id!==req.user.id&&(!q||u.displayName.toLowerCase().includes(q))).slice(0,30).map(pub))});
app.post('/api/friends/:id',auth,(req,res)=>{const db=load(); if(!db.users.some(u=>u.id===req.params.id))return res.status(404).end(); if(!db.friends.some(f=>f.a===req.user.id&&f.b===req.params.id)){db.friends.push({a:req.user.id,b:req.params.id,createdAt:Date.now()});save(db)} res.json({ok:true})});
app.get('/api/friends',auth,(req,res)=>{const db=load();const ids=db.friends.filter(f=>f.a===req.user.id||f.b===req.user.id).map(f=>f.a===req.user.id?f.b:f.a);res.json(db.users.filter(u=>ids.includes(u.id)).map(pub))});
app.get('/api/chats/:otherId',auth,(req,res)=>{const db=load();res.json(db.messages.filter(m=>(m.from===req.user.id&&m.to===req.params.otherId)||(m.from===req.params.otherId&&m.to===req.user.id)).slice(-200))});
function buildMessage(req,from,to,talkId,type){
  const text=String(req.body.text||'').trim(),image=String(req.body.image||''),sticker=String(req.body.sticker||'');
  if(!text&&!image&&!sticker)throw new Error('メッセージが空です');
  if(image&&(!image.startsWith('data:image/')||image.length>6*1024*1024))throw new Error('画像を送信できません');
  return {id:id(),type,from,to:to||null,talkId:talkId||null,text,image,sticker,replyTo:req.body.replyTo||null,createdAt:Date.now(),readBy:[]};
}
app.post('/api/chats/:otherId',auth,(req,res)=>{try{const db=load();if(!db.users.some(u=>u.id===req.params.otherId))return res.status(404).json({error:'相手が見つかりません'});const m=buildMessage(req,req.user.id,req.params.otherId,null,'direct');db.messages.push(m);notify(db,m.to,'message','新しいメッセージ',req.user.displayName+'からメッセージが届きました');save(db);wss.clients.forEach(c=>{if(c.readyState===1)c.send(JSON.stringify({type:'message',message:m}))});res.json(m)}catch(e){res.status(400).json({error:e.message})}});
app.post('/api/chats/:otherId/read',auth,(req,res)=>{const db=load();db.messages.filter(m=>m.from===req.params.otherId&&m.to===req.user.id).forEach(m=>{m.readBy=Array.isArray(m.readBy)?m.readBy:[];if(!m.readBy.includes(req.user.id))m.readBy.push(req.user.id)});save(db);res.json({ok:true})});
app.get('/api/notifications',auth,(req,res)=>{const db=load();res.json(db.notifications.filter(n=>n.userId===req.user.id).slice(0,100))});
app.post('/api/notifications/read',auth,(req,res)=>{const db=load();db.notifications.filter(n=>n.userId===req.user.id).forEach(n=>n.read=true);save(db);res.json({ok:true})});
function ensureTalk(db,user,room){
  if(!Array.isArray(db.talks))db.talks=[];
  let talk=db.talks.find(x=>x.room===room&&x.schoolId===user.schoolId&&(room==='gradeadmin'?x.grade===user.grade:true));
  if(!talk){
    talk={id:id(),room,schoolId:user.schoolId,grade:room==='gradeadmin'?user.grade:user.grade,className:room==='classadmin'?user.className:null,name:room==='class'?`${user.grade}年${user.className}組 クラストーク`:room==='classadmin'?'CLASS ADMIN トーク':`${user.grade}年 GRADE ADMIN トーク`,memberIds:[],createdAt:Date.now()};
    db.talks.push(talk);
  }
  if(room==='class')db.users.filter(x=>sameGroup(x,user)).forEach(x=>{if(!talk.memberIds.includes(x.id))talk.memberIds.push(x.id)});
  if(room==='classadmin')db.users.filter(x=>sameGroup(x,user)&&['CLASS_ADMIN','GRADE_ADMIN','SCHOOL_ADMIN','SUPER_ADMIN'].includes(x.role)).forEach(x=>{if(!talk.memberIds.includes(x.id))talk.memberIds.push(x.id)});
  if(room==='gradeadmin')db.users.filter(x=>x.schoolId===user.schoolId&&x.grade===user.grade&&['GRADE_ADMIN','SCHOOL_ADMIN','SUPER_ADMIN'].includes(x.role)).forEach(x=>{if(!talk.memberIds.includes(x.id))talk.memberIds.push(x.id)});
  return talk;
}
app.get('/api/talks/:room',auth,(req,res)=>{
  const room=String(req.params.room);
  if(!['class','classadmin','gradeadmin'].includes(room))return res.status(400).end();
  const db=load(),talk=ensureTalk(db,req.user,room);
  const messages=db.messages.filter(m=>m.type==='group'&&m.talkId===talk.id).slice(-200).map(m=>({...m,fromName:db.users.find(u=>u.id===m.from)?.displayName||'メンバー'}));
  save(db);res.json({talk,messages});
});
app.post('/api/talks/:room/messages',auth,(req,res)=>{
  const room=String(req.params.room);if(!['class','classadmin','gradeadmin'].includes(room))return res.status(400).end();
  const db=load(),talk=ensureTalk(db,req.user,room);
  if(!talk.memberIds.includes(req.user.id))return res.status(403).json({error:'このトークのメンバーではありません'});
  const text=String(req.body.text||'').trim();if(!text)return res.status(400).json({error:'メッセージを入力してください'});
  const m=buildMessage(req,req.user.id,null,talk.id,'group');
  db.messages.push(m);talk.memberIds.filter(x=>x!==req.user.id).forEach(uid=>notify(db,uid,'group_message',talk.name,`${req.user.displayName}からメッセージが届きました`));
  save(db);wss.clients.forEach(c=>{if(c.readyState===1)c.send(JSON.stringify({type:'group_message',message:m,talkId:talk.id}))});res.json(m);
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
  const messages=(db.messages||[]).filter(m=>m.type==='class'&&m.talkId===talk.id).slice(-200).map(m=>({...m,fromName:db.users.find(u=>u.id===m.from)?.displayName||'クラスメンバー'}));
  const members=db.users.filter(u=>talk.memberIds.includes(u.id)).map(pub);
  res.json({talk,messages,members});
});
app.post('/api/class/messages',auth,(req,res)=>{
  const db=load();
  if(!Array.isArray(db.classTalks))db.classTalks=[];
  let talk=db.classTalks.find(x=>x.schoolId===req.user.schoolId&&x.grade===req.user.grade&&x.className===req.user.className);
  if(!talk){talk={id:id(),schoolId:req.user.schoolId,schoolName:req.user.schoolName,grade:req.user.grade,className:req.user.className,name:`${req.user.grade}年${req.user.className}組 クラストーク`,createdAt:Date.now(),memberIds:[]};db.classTalks.push(talk);}
  if(!talk.memberIds.includes(req.user.id))talk.memberIds.push(req.user.id);
  const text=String(req.body.text||'').trim();
  const m=buildMessage(req,req.user.id,null,talk.id,'class');
  db.messages.push(m);
  talk.memberIds.filter(x=>x!==req.user.id).forEach(userId=>notify(db,userId,'class_message',talk.name,`${req.user.displayName}からメッセージが届きました`));
  save(db);
  wss.clients.forEach(c=>{if(c.readyState===1)c.send(JSON.stringify({type:'class_message',message:m,talkId:talk.id}))});
  res.json(m);
});
app.post('/api/class/read',auth,(req,res)=>{const db=load();const talk=db.classTalks.find(x=>x.schoolId===req.user.schoolId&&x.grade===req.user.grade&&x.className===req.user.className);if(talk)db.messages.filter(m=>m.talkId===talk.id&&m.from!==req.user.id).forEach(m=>{m.readBy=Array.isArray(m.readBy)?m.readBy:[];if(!m.readBy.includes(req.user.id))m.readBy.push(req.user.id)});save(db);res.json({ok:true})});
app.post('/api/talks/:room/read',auth,(req,res)=>{const db=load();const talk=ensureTalk(db,req.user,String(req.params.room));db.messages.filter(m=>m.talkId===talk.id&&m.from!==req.user.id).forEach(m=>{m.readBy=Array.isArray(m.readBy)?m.readBy:[];if(!m.readBy.includes(req.user.id))m.readBy.push(req.user.id)});save(db);res.json({ok:true})});
app.get('/api/posts',auth,(req,res)=>{const db=load(),s=scope(req),kind=req.query.kind||'class';res.json(db.posts.filter(p=>p.kind===kind&&p.schoolId===s.schoolId&&(kind==='school'||p.grade===s.grade)&&(kind!=='class'||p.className===s.className)).slice(0,100))});
app.post('/api/posts',auth,(req,res)=>{const db=load(),s=scope(req),kind=req.body.kind||'class'; if(!canManage(req.user,kind))return res.status(403).json({error:'権限がありません'});const p={id:id(),...s,kind,title:req.body.title||'',body:req.body.body||'',authorId:req.user.id,createdAt:Date.now()};db.posts.unshift(p);save(db);res.json(p)});
function canManage(u,kind){if(u.role==='SUPER_ADMIN'||u.role==='SCHOOL_ADMIN')return true;if(kind==='grade')return ['GRADE_ADMIN'].includes(u.role);if(kind==='class')return ['CLASS_ADMIN','GRADE_ADMIN'].includes(u.role);return false}
app.get('/api/events',auth,(req,res)=>{const db=load(),s=scope(req);res.json(db.events.filter(e=>e.schoolId===s.schoolId&&(e.grade==null||e.grade===s.grade)).sort((a,b)=>a.date.localeCompare(b.date)))});
app.post('/api/events',auth,(req,res)=>{if(!['SUPER_ADMIN','SCHOOL_ADMIN'].includes(req.user.role))return res.status(403).end();const db=load(),s=scope(req);const e={id:id(),...s,title:req.body.title,date:req.body.date,place:req.body.place||'',body:req.body.body||''};db.events.push(e);db.users.filter(u=>u.schoolId===s.schoolId&&(e.grade==null||u.grade===e.grade)).forEach(u=>notify(db,u.id,'event','学校行事',e.title));save(db);res.json(e)});
app.get('/api/tasks',auth,(req,res)=>{const db=load(),s=scope(req);if(!Array.isArray(db.taskCompletions))db.taskCompletions=[];res.json(db.tasks.filter(t=>t.schoolId===s.schoolId&&t.grade===s.grade&&t.className===s.className).sort((a,b)=>(a.dueAt||Infinity)-(b.dueAt||Infinity)).map(t=>({...t,completed:db.taskCompletions.some(x=>x.taskId===t.id&&x.userId===req.user.id)})))});
app.post('/api/tasks/:id/complete',auth,(req,res)=>{const db=load();if(!Array.isArray(db.taskCompletions))db.taskCompletions=[];const t=db.tasks.find(x=>x.id===req.params.id);if(!t)return res.status(404).json({error:'課題が見つかりません'});if(!sameGroup(t,req.user))return res.status(403).json({error:'この課題を操作できません'});const i=db.taskCompletions.findIndex(x=>x.taskId===t.id&&x.userId===req.user.id);if(i>=0)db.taskCompletions.splice(i,1);else db.taskCompletions.push({id:id(),taskId:t.id,userId:req.user.id,completedAt:Date.now()});save(db);res.json({completed:i<0})});
app.post('/api/tasks',auth,(req,res)=>{if(!['SUPER_ADMIN','SCHOOL_ADMIN','GRADE_ADMIN','CLASS_ADMIN'].includes(req.user.role))return res.status(403).end();const db=load(),s=scope(req);const t={id:id(),...s,subject:req.body.subject,title:req.body.title,detail:req.body.detail||'',dueAt:req.body.dueAt||null,method:req.body.method||'',createdAt:Date.now()};db.tasks.push(t);db.users.filter(u=>sameGroup(u,req.user)).forEach(u=>notify(db,u.id,'task','課題が追加されました',t.title));save(db);res.json(t)});
app.get('/api/schedule',auth,(req,res)=>{const db=load(),s=scope(req);res.json(db.schedules.filter(x=>x.schoolId===s.schoolId&&x.grade===s.grade&&x.className===s.className))});
app.post('/api/schedule',auth,(req,res)=>{if(!['SUPER_ADMIN','SCHOOL_ADMIN','GRADE_ADMIN','CLASS_ADMIN'].includes(req.user.role))return res.status(403).end();const db=load(),s=scope(req);const x={id:id(),...s,day:req.body.day,period:req.body.period,subject:req.body.subject,room:req.body.room||'',note:req.body.note||''};db.schedules.push(x);save(db);res.json(x)});
app.get('/api/elections',auth,(req,res)=>{const db=load(),s=scope(req); const out=db.elections.filter(e=>e.schoolId===s.schoolId&&(e.grade==null||e.grade===s.grade)&&(e.className==null||e.className===s.className)).map(e=>({...e,candidates:e.candidates.map(c=>({id:c.id,name:(db.users.find(u=>u.id===c.userId)?.displayName)||'不明',votes:c.votes||0}))})); res.json(out);});
app.post('/api/elections',auth,(req,res)=>{const type=req.body.type;const ok=(type==='CLASS_ADMIN'&&['CLASS_ADMIN','GRADE_ADMIN','SCHOOL_ADMIN','SUPER_ADMIN'].includes(req.user.role))||(type==='GRADE_ADMIN'&&['GRADE_ADMIN','SCHOOL_ADMIN','SUPER_ADMIN'].includes(req.user.role))||(type==='SCHOOL_ADMIN'&&['GRADE_ADMIN','SCHOOL_ADMIN','SUPER_ADMIN'].includes(req.user.role));if(!ok)return res.status(403).json({error:'選挙を開始できません'});const db=load(),s=scope(req);const ids=(req.body.candidateIds||[]).filter(x=>db.users.some(u=>u.id===x));const e={id:id(),type,...s,grade:type==='CLASS_ADMIN'?s.grade:s.grade,className:type==='CLASS_ADMIN'?s.className:null,candidates:ids.map(userId=>({id:id(),userId,votes:0})),voted:[],createdAt:Date.now(),endsAt:Date.now()+86400000,status:'OPEN'};db.elections.push(e);save(db);res.json(e)});
app.post('/api/elections/:id/vote',auth,(req,res)=>{const db=load(),e=db.elections.find(x=>x.id===req.params.id);if(!e||e.status!=='OPEN'||e.voted.includes(req.user.id)||e.endsAt<Date.now())return res.status(400).json({error:'投票できません'});const c=e.candidates.find(c=>c.id===req.body.candidateId);if(!c)return res.status(400).end();c.votes++;e.voted.push(req.user.id);save(db);res.json({ok:true})});
app.get('/api/study/books',auth,(req,res)=>res.json([{id:'target1200',name:'ターゲット1200',path:'/data/target1200.txt'},{id:'target1900',name:'ターゲット1900',path:'/data/target1900.txt'},{id:'tekkyoku',name:'鉄壁',path:'/data/鉄壁.txt'},{id:'irohani',name:'いろはにほへと古文単語',path:'/data/irohani.txt'}]));
app.get('/data/:file', (req,res)=>{const base=path.join(__dirname,'data'); const file=path.basename(req.params.file); const allowed=new Set(['target1200.txt','target1900.txt','鉄壁.txt','irohani.txt']); if(!allowed.has(file))return res.status(404).end(); const p=path.join(base,file); if(!fs.existsSync(p))return res.status(404).json({error:'単語帳データが見つかりません'}); res.sendFile(p)});
app.get('/api/admins',auth,(req,res)=>{const db=load();res.json(db.users.filter(u=>u.schoolId===req.user.schoolId&&u.role!=='STUDENT').map(pub))});
app.get('/api/debug/state',auth,(req,res)=>{if(req.user.role!=='SUPER_ADMIN')return res.status(403).end();const db=load();res.json({...db,users:db.users.map(pub)});});
app.post('/api/super/users/:id/role',auth,(req,res)=>{
  if(req.user.role!=='SUPER_ADMIN')return res.status(403).json({error:'権限がありません'});
  const allowed=['STUDENT','CLASS_ADMIN','GRADE_ADMIN','SCHOOL_ADMIN','SUPER_ADMIN'];
  const role=String(req.body.role||'STUDENT');
  if(!allowed.includes(role))return res.status(400).json({error:'不正な権限です'});
  const db=load(),u=db.users.find(x=>x.id===req.params.id);
  if(!u)return res.status(404).json({error:'ユーザーが見つかりません'});
  if(u.id===req.user.id&&role!=='SUPER_ADMIN')return res.status(400).json({error:'SUPER ADMIN本人はSUPER ADMINのまま利用してください'});
  u.role=role;save(db);res.json({ok:true,user:pub(u)});
});
app.post('/api/super/users/:id/ban',auth,(req,res)=>{
  if(req.user.role!=='SUPER_ADMIN')return res.status(403).json({error:'権限がありません'});
  const db=load(),u=db.users.find(x=>x.id===req.params.id);
  if(!u)return res.status(404).json({error:'ユーザーが見つかりません'});
  if(u.role==='SUPER_ADMIN')return res.status(400).json({error:'SUPER ADMINはBANできません'});
  u.banned=true;u.bannedAt=Date.now();u.banReason=String(req.body.reason||'SUPER ADMINによる利用停止');
  save(db);res.json({ok:true,user:pub(u)});
});
app.post('/api/super/users/:id/unban',auth,(req,res)=>{
  if(req.user.role!=='SUPER_ADMIN')return res.status(403).json({error:'権限がありません'});
  const db=load(),u=db.users.find(x=>x.id===req.params.id);
  if(!u)return res.status(404).json({error:'ユーザーが見つかりません'});
  u.banned=false;delete u.bannedAt;delete u.banReason;save(db);res.json({ok:true,user:pub(u)});
});


function normalizeAdminIdentity(value){
  return String(value??'').replace(/\u3000/g,' ').trim().replace(/\s+/g,' ');
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
const wsUsers=new Map();
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
  ws.userId=u.id;wsUsers.set(u.id,ws);
  ws.on('message',raw=>{
    try{
      const m=JSON.parse(String(raw));
      if(m.type==='call_signal'&&m.toUserId){
        const target=wsUsers.get(m.toUserId);
        if(target?.readyState===1)target.send(JSON.stringify({...m,fromUserId:u.id}));
      }
    }catch{}
  });
  ws.on('close',()=>{if(wsUsers.get(u.id)===ws)wsUsers.delete(u.id)});
});
app.use((req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
server.listen(process.env.PORT||3000,()=>console.log('Nova running on http://localhost:'+(process.env.PORT||3000)));
