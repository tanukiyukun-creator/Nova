const $=s=>document.querySelector(s), api=async(path,opt={})=>{opt.headers={...(opt.headers||{}),'Content-Type':'application/json',...(localStorage.novaToken?{Authorization:'Bearer '+localStorage.novaToken}:{})};const r=await fetch(path,opt);const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'エラー');return j};
let me=JSON.parse(localStorage.novaUser||'null'), view='home', friends=[], currentChat=null, books=[];
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
function toast(x){const d=document.createElement('div');d.className='toast';d.textContent=x;document.body.append(d);setTimeout(()=>d.remove(),2600)}
function setSession(x){me=x.user;localStorage.novaUser=JSON.stringify(me);localStorage.novaToken=x.token}
function logout(){localStorage.removeItem('novaUser');localStorage.removeItem('novaToken');me=null;render()}
function superLogin(){const d=document.createElement('div');d.className='modal';d.innerHTML='<div class="glass super-modal"><div class="modal-mark">N</div><div class="eyebrow">NOVA SYSTEM</div><h2>SUPER ADMIN</h2><p>Nova全体を管理する管理者専用入口です。</p><input id="superCodeInput" class="input" placeholder="管理コード"><input id="superPassInput" class="input" type="password" placeholder="管理パスワード"><div class="row"><button class="btn alt" onclick="this.closest(\'.modal\').remove()">キャンセル</button><button class="btn" onclick="submitSuperLogin()">管理画面へ →</button></div></div>';document.body.append(d)}async function submitSuperLogin(){const code=$('#superCodeInput').value,password=$('#superPassInput').value;try{setSession(await api('/api/super/login',{method:'POST',body:JSON.stringify({code,password})}));document.querySelector('.modal')?.remove();render()}catch(x){toast(x.message)}}async function render(){if(!me)return renderAuth();try{me=await api('/api/me');localStorage.novaUser=JSON.stringify(me)}catch{return logout()}document.body.innerHTML=`<div class="app-shell"><aside class="sidebar glass"><div class="logo"><span>N</span><div><strong>NOVA</strong><small>School Life</small></div></div><div class="side-school">${esc(me.schoolName)}</div><nav>${[['home','⌂','ホーム'],['chat','◌','チャット'],['school','▦','学校'],['study','◇','学習'],['people','♧','友達'],['settings','⚙','設定']].map(x=>`<button class="${view===x[0]?'active':''}" onclick="go('${x[0]}')"><b>${x[1]}</b><span>${x[2]}</span></button>`).join('')}</nav><div class="side-bottom"><button onclick="go('settings')">⚙　設定</button><button onclick="logout()">↪　ログアウト</button></div></aside><main class="main"><header class="topbar"><div><small>NOVA / SCHOOL LIFE</small><h1>${({home:'ホーム',chat:'チャット',school:'学校',study:'学習',people:'友達',settings:'設定'})[view]}</h1></div><div class="top-actions"><button class="icon-btn" onclick="go('people')">⌕</button><button class="icon-btn">♧</button><div class="avatar">${me.icon?'<img class="avatar" src="'+esc(me.icon)+'">':'N'}</div></div></header><div id="main"></div></main></div><nav class="mobile-nav glass">${[['home','⌂','ホーム'],['chat','◌','チャット'],['study','◇','学習'],['school','▦','学校'],['people','♧','友達']].map(x=>`<button onclick="go('${x[0]}')"><b>${x[1]}</b><span>${x[2]}</span></button>`).join('')}</nav>`;await route()}
function renderAuth(){document.body.innerHTML=`<div class="auth premium-auth"><button class="super-entry" onclick="superLogin()">SUPER ADMIN <span>↗</span></button><div class="auth-orb a1"></div><div class="auth-orb a2"></div><div class="authbox glass"><div class="auth-logo"><span>N</span><div>NOVA<small>SCHOOL LIFE PLATFORM</small></div></div><div class="auth-hero"><small>WELCOME TO NOVA</small><h1>学校生活を、<em>ひとつに。</em></h1><p>学校・学年・クラス・学習を、ひとつの上質な空間へ。</p></div><div class="tabs"><button id="regtab" class="on" onclick="authMode('reg')">初期登録</button><button id="logtab" onclick="authMode('login')">ログイン</button></div><div id="authform"></div></div></div>`;authMode('reg')}
function authMode(mode){$('#regtab')?.classList.toggle('on',mode==='reg');$('#logtab')?.classList.toggle('on',mode==='login');$('#authform').innerHTML=mode==='reg'?`<form class="stack" onsubmit="register(event)"><div class="school-autocomplete"><input id="schoolInput" class="input" name="schoolName" placeholder="学校名を入力（例：山村学園）" autocomplete="off" required oninput="schoolSuggest()" ><div id="schoolSuggestions"></div></div><select class="input" name="grade" required><option value="">学年を選択</option><option value="1">1年</option><option value="2">2年</option><option value="3">3年</option></select><select class="input" name="classPreset" id="classPreset" onchange="classMode(this.value)" required><option value="">組を選択</option><option value="1">1組</option><option value="2">2組</option><option value="3">3組</option><option value="4">4組</option><option value="5">5組</option><option value="6">6組</option><option value="7">7組</option><option value="8">8組</option><option value="9">9組</option><option value="10">10組</option><option value="11">11組</option><option value="12">12組</option><option value="13">13組</option><option value="14">14組</option><option value="15">15組</option><option value="16">16組</option><option value="17">17組</option><option value="18">18組</option><option value="19">19組</option><option value="20">20組</option><option value="custom">その他・英字</option></select><input id="customClass" class="input hidden" name="classNameCustom" placeholder="A / EL / 特進など"><input class="input" name="attendanceNo" type="number" min="1" step="1" placeholder="出席番号" required><div class="two"><input class="input" name="lastName" placeholder="姓" required><input class="input" name="firstName" placeholder="名" required></div><label class="photo-upload">プロフィール写真<input class="input" name="icon" type="file" accept="image/*" onchange="previewPhoto(event)"></label><input type="hidden" id="iconData" name="iconData"><input class="input" name="password" type="password" placeholder="パスワード（6文字以上）" required><input class="input" name="password2" type="password" placeholder="パスワード確認" required><label class="sub"><input type="checkbox" required> 利用規約・プライバシーに同意</label><button class="btn">Novaを始める</button></form>`:`<form class="stack" onsubmit="login(event)"><div class="school-autocomplete"><input id="loginSchoolInput" class="input" name="schoolName" placeholder="学校名を入力（例：山村学園）" autocomplete="off" required oninput="loginSchoolSuggest()" ><div id="loginSchoolSuggestions"></div></div><div class="two"><input class="input" name="lastName" placeholder="姓" required><input class="input" name="firstName" placeholder="名" required></div><input class="input" name="password" type="password" placeholder="パスワード" required><button class="btn">ログイン</button></form>`}
let loginSchoolTimer;
async function loginSchoolSuggest(){
  clearTimeout(loginSchoolTimer);
  const input=$('#loginSchoolInput');
  const box=$('#loginSchoolSuggestions');
  const q=input.value.trim();
  if(!q){box.innerHTML='';return}
  loginSchoolTimer=setTimeout(async()=>{
    try{
      const a=await api('/api/schools?q='+encodeURIComponent(q));
      box.innerHTML=a.slice(0,8).map(x=>`<button type="button" class="school-option" onpointerdown="event.preventDefault();pickLoginSchool(${JSON.stringify(x.name)})"><b>${esc(x.name)}</b>${x.location?`<small>${esc(x.location)}</small>`:''}</button>`).join('')||'<div class="school-noresult">候補が見つかりません</div>';
    }catch{box.innerHTML='<div class="school-noresult">学校候補を取得できません</div>'}
  },180);
}
function pickLoginSchool(name){
  const input=$('#loginSchoolInput');
  input.value=name;
  $('#loginSchoolSuggestions').innerHTML='';
  input.focus();
}

let schoolTimer;
async function schoolSuggest(){
  clearTimeout(schoolTimer);
  const input=$('#schoolInput');
  const box=$('#schoolSuggestions');
  const q=input.value.trim();
  input.dataset.schoolId='';
  if(!q){box.innerHTML='';return}
  schoolTimer=setTimeout(async()=>{
    try{
      const a=await api('/api/schools?q='+encodeURIComponent(q));
      box.innerHTML=a.slice(0,8).map(x=>`<button type="button" class="school-option" onpointerdown="event.preventDefault();pickSchool(${JSON.stringify(x.id)},${JSON.stringify(x.name)})"><b>${esc(x.name)}</b>${x.location?`<small>${esc(x.location)}</small>`:''}</button>`).join('')||'<div class="school-noresult">候補が見つかりません</div>';
    }catch{box.innerHTML='<div class="school-noresult">学校候補を取得できません</div>'}
  },180);
}
function pickSchool(id,name){
  const input=$('#schoolInput');
  input.value=name;
  input.dataset.schoolId=id;
  $('#schoolSuggestions').innerHTML='';
  input.focus();
}
function classMode(v){
  const el=$('#customClass');
  el.classList.toggle('hidden',v!=='custom');
  el.required=v==='custom';
  if(v!=='custom')el.value='';
}
function previewPhoto(e){
  const f=e.target.files?.[0];
  if(!f)return;
  if(!f.type.startsWith('image/'))return toast('画像ファイルを選択してください');
  if(f.size>4*1024*1024)return toast('写真は4MB以下にしてください');
  const r=new FileReader();
  r.onload=()=>$('#iconData').value=r.result;
  r.readAsDataURL(f);
}
async function register(e){
  e.preventDefault();
  const f=new FormData(e.target);
  const school=$('#schoolInput');
  if(!school.value.trim())return toast('学校名を入力してください');
  if(f.get('password')!==f.get('password2'))return toast('パスワードが一致しません');
  const className=f.get('classPreset')==='custom'?String(f.get('classNameCustom')||'').trim():f.get('classPreset');
  if(!className)return toast('クラスを選択または入力してください');
  const body={
    schoolId:school.dataset.schoolId||school.value.trim(),
    schoolName:school.value.trim(),
    grade:f.get('grade'),
    className,
    attendanceNo:String(f.get('attendanceNo')||'').trim(),
    lastName:String(f.get('lastName')||'').trim(),
    firstName:String(f.get('firstName')||'').trim(),
    icon:$('#iconData')?.value||'',
    password:f.get('password')
  };
  try{
    setSession(await api('/api/register',{method:'POST',body:JSON.stringify(body)}));
    view='home';
    await render();
    toast('登録が完了しました');
  }catch(x){toast(x.message)}
}
async function login(e){
  e.preventDefault();
  const f=new FormData(e.target);
  const body={
    schoolName:String(f.get('schoolName')||'').trim(),
    lastName:String(f.get('lastName')||'').trim(),
    firstName:String(f.get('firstName')||'').trim(),
    password:String(f.get('password')||'')
  };
  if(!body.schoolName||!body.lastName||!body.firstName||!body.password)return toast('学校名・姓・名・パスワードを入力してください');
  try{
    setSession(await api('/api/login',{method:'POST',body:JSON.stringify(body)}));
    view='home';
    await render();
    toast('ログインしました');
  }catch(x){toast(x.message)}
}
async function go(v){view=v;await render()}
async function route(){const m=$('#main');if(view==='home')return home(m);if(view==='chat')return chat(m);if(view==='school')return school(m);if(view==='study')return study(m);if(view==='people')return people(m);return settings(m)}
async function home(m){
  const [events,tasks,notes]=await Promise.all([api('/api/events'),api('/api/tasks'),api('/api/notifications')]);
  const now=new Date(), date=now.toLocaleDateString('ja-JP',{month:'long',day:'numeric',weekday:'long'});
  const unread=notes.filter(x=>!x.read).length;
  const avatar=me.icon?'<img class="hero-avatar" src="'+esc(me.icon)+'">':'<div class="hero-avatar fallback">N</div>';
  m.innerHTML='<div class="nova-home">'+
    '<section class="home-hero glass">'+
      '<div class="hero-backdrop"></div><div class="hero-content">'+
        '<div class="hero-top"><div><div class="eyebrow">NOVA · SCHOOL LIFE</div><div class="hero-date">'+date+'</div></div><div class="hero-profile">'+avatar+'<div><b>'+esc(me.lastName||'')+' '+esc(me.firstName||'')+'</b><span>'+esc(me.grade)+'年 · '+esc(me.className)+'組</span></div></div></div>'+
        '<div class="hero-main"><div><p class="hero-kicker">GOOD EVENING</p><h2>'+esc(me.firstName||me.displayName)+'<span> さん</span></h2><p>'+esc(me.schoolName)+'</p></div><div class="hero-actions"><button class="hero-action" onclick="go(\'chat\')"><span>チャット</span><b>→</b></button><button class="hero-action" onclick="go(\'study\')"><span>学習を始める</span><b>→</b></button></div></div>'+
      '</div></section>'+
    '<div class="home-grid">'+
      '<section class="glass home-card schedule-main"><div class="card-head"><div><span class="card-icon">◷</span><div><b>今日の予定</b><small>MY SCHEDULE</small></div></div><button class="text-link" onclick="go(\'school\')">すべて見る　›</button></div>'+
        '<div class="schedule-feature"><div class="period-badge">03<span>限目</span></div><div class="schedule-subject"><b>数学</b><span>通常授業</span></div><div class="schedule-time">09:50<br><small>教室</small></div></div>'+
        '<div class="schedule-list"><div><span>04</span><b>英語</b><small>4限目</small></div><div><span>放課後</span><b>自由時間</b><small>16:10〜</small></div></div>'+
      '</section>'+
      '<section class="glass home-card task-card"><div class="card-head"><div><span class="card-icon">□</span><div><b>課題</b><small>ASSIGNMENTS</small></div></div><button class="text-link" onclick="go(\'school\')">すべて見る　›</button></div>'+
        (tasks.slice(0,3).map(t=>'<div class="task-item"><div class="task-subject">'+esc(t.subject||'課題')+'</div><div class="task-info"><b>'+esc(t.title)+'</b><span>'+(t.dueAt?new Date(t.dueAt).toLocaleDateString('ja-JP',{month:'numeric',day:'numeric'}):'期限未設定')+'</span></div><i>›</i></div>').join('')||'<div class="empty-state">現在の課題はありません</div>')+
      '</section>'+
      '<section class="glass home-card chat-card"><div class="card-head"><div><span class="card-icon">◌</span><div><b>最近のチャット</b><small>RECENT TALKS</small></div></div><button class="text-link" onclick="go(\'chat\')">すべて見る　›</button></div>'+
        '<div class="recent-chat"><div class="mini-avatar">N</div><div><b>クラス全体</b><span>明日の持ち物を確認して...</span></div><small>12分前</small></div>'+
        '<div class="recent-chat"><div class="mini-avatar tone">1</div><div><b>'+esc(me.grade)+'年'+esc(me.className)+'組</b><span>了解です！</span></div><small>38分前</small></div>'+
        '<div class="recent-chat"><div class="mini-avatar">◎</div><div><b>学校からのお知らせ</b><span>今週の予定について</span></div><small>1時間前</small></div>'+
      '</section>'+
      '<section class="glass home-card study-card"><div class="card-head"><div><span class="card-icon">◇</span><div><b>学習をはじめる</b><small>STUDY</small></div></div><button class="gold-link" onclick="go(\'study\')">学習を始める　→</button></div>'+
        '<p class="study-copy">今日も少しずつ。あなたのペースで学ぶ。</p><div class="study-modes"><button onclick="go(\'study\')"><span>▤</span><b>単語帳</b><small>4 BOOKS</small></button><button onclick="go(\'study\')"><span>☑</span><b>4択問題</b><small>QUIZ</small></button><button onclick="go(\'study\')"><span>◉</span><b>リスニング</b><small>LISTENING</small></button><button onclick="go(\'study\')"><span>▱</span><b>フラッシュ</b><small>FLASHCARD</small></button><button onclick="go(\'study\')"><span>／</span><b>ライティング</b><small>WRITING</small></button></div>'+
      '</section>'+
      '<section class="glass home-card event-card"><div class="card-head"><div><span class="card-icon">▣</span><div><b>行事カレンダー</b><small>EVENTS</small></div></div><button class="text-link">すべて見る　›</button></div><div class="calendar-date"><strong>'+now.getDate()+'</strong><div><b>'+now.toLocaleDateString('ja-JP',{month:'long'})+'</b><span>'+now.toLocaleDateString('ja-JP',{weekday:'long'})+'</span></div></div><div class="event-list">'+(events.slice(0,3).map(e=>'<div><span>'+esc(e.date||'予定')+'</span><b>'+esc(e.title)+'</b></div>').join('')||'<div class="empty-state">行事予定はありません</div>')+'</div></section>'+
      '<section class="glass home-card notice-card"><div class="card-head"><div><span class="card-icon">♧</span><div><b>通知</b><small>NOTIFICATIONS</small></div></div></div><div class="notice-number">'+unread+'<span>未読のお知らせ</span></div><button class="notice-btn" onclick="api(\'/api/notifications/read\',{method:\'POST\'}).then(()=>render())">すべて既読にする</button></section>'+
    '</div></div>';
}
async function chat(m){if(!friends.length)friends=await api('/api/friends');m.innerHTML=`<div class="grid"><section class="glass card span4"><div class="h">FRIENDS</div>${friends.map(f=>`<div class="item row" onclick="openChat('${f.id}')"><div class="avatar">${esc(f.icon)}</div><div><b>${esc(f.displayName)}</b><div class="sub">タップしてチャット</div></div></div>`).join('')||'<p class="sub">友達がいません。「友達」から追加できます。</p>'}</section><section class="glass card span8"><div class="h">TALK</div><div id="chatbox" class="chat">${currentChat?await chatHtml(currentChat):'<p class="sub">友達を選択してください。</p>'}</div>${currentChat?`<form class="row" onsubmit="sendMsg(event)"><input class="input" name="text" placeholder="メッセージ"><button class="btn">送信</button></form>`:''}</section></div>`}
async function chatHtml(id2){const ms=await api('/api/chats/'+id2);return ms.map(x=>`<div class="bubble ${x.from===me.id?'mine':''}">${esc(x.text)}<div class="sub">${new Date(x.createdAt).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'})}</div></div>`).join('')||'<p class="sub">まだメッセージはありません。</p>'}async function openChat(id2){currentChat=id2;go('chat')}async function sendMsg(e){e.preventDefault();const f=new FormData(e.target);await api('/api/chats/'+currentChat,{method:'POST',body:JSON.stringify({text:f.get('text')})});e.target.reset();chat($('#main'))}
async function school(m){const [posts,events,tasks,schedule,elections]=await Promise.all([api('/api/posts?kind=class'),api('/api/events'),api('/api/tasks'),api('/api/schedule'),api('/api/elections')]);m.innerHTML=`<div class="tabs"><button class="on">クラストーク</button><button onclick="schoolGrade()">学年</button><button onclick="schoolSchool()">学校</button><button onclick="adminPanel()">管理</button></div><div class="grid"><section class="glass card span8"><div class="h">CLASS BOARD</div>${posts.map(p=>`<div class="item"><b>${esc(p.title)}</b><p>${esc(p.body)}</p><div class="sub">${new Date(p.createdAt).toLocaleString('ja-JP')}</div></div>`).join('')||'<p class="sub">投稿はありません</p>'}</section><section class="glass card span4"><div class="h">SCHEDULE</div>${schedule.slice(0,8).map(x=>`<div class="item"><b>${esc(x.day)} ${esc(x.period)}限</b><div>${esc(x.subject)}</div><div class="sub">${esc(x.room)}</div></div>`).join('')||'<p class="sub">時間割は未登録</p>'}</section><section class="glass card span12"><div class="h">ELECTIONS</div>${elections.map(e=>`<div class="item"><b>${esc(e.type)}</b> <span class="sub">${e.status}</span><div class="row">${e.candidates.map(c=>`<button class="btn alt" onclick="vote('${e.id}','${c.id}')">${esc(c.name)} (${c.votes})</button>`).join('')}</div></div>`).join('')||'<p class="sub">進行中の投票はありません</p>'}</section></div>`}
async function schoolGrade(){view='school';const m=$('#main');const p=await api('/api/posts?kind=grade');m.innerHTML=`<div class="glass card"><div class="h">GRADE BOARD</div>${p.map(x=>`<div class="item"><b>${esc(x.title)}</b><p>${esc(x.body)}</p></div>`).join('')||'<p class="sub">投稿はありません</p>'}</div>`}async function schoolSchool(){const p=await api('/api/posts?kind=school');$('#main').innerHTML=`<div class="glass card"><div class="h">SCHOOL BOARD</div>${p.map(x=>`<div class="item"><b>${esc(x.title)}</b><p>${esc(x.body)}</p></div>`).join('')||'<p class="sub">投稿はありません</p>'}</div>`}
async function vote(e,c){try{await api('/api/elections/'+e+'/vote',{method:'POST',body:JSON.stringify({candidateId:c})});toast('投票しました');school($('#main'))}catch(x){toast(x.message)}}
async function adminPanel(){const admins=await api('/api/admins');$('#main').innerHTML=`<div class="grid"><section class="glass card span6"><div class="h">ADMINISTRATORS</div>${admins.map(a=>`<div class="item row"><div class="avatar">${esc(a.icon)}</div><div><b>${esc(a.displayName)}</b><div class="sub">${esc(a.role)}</div></div></div>`).join('')||'<p class="sub">管理者はいません</p>'}</section><section class="glass card span6"><div class="h">ELECTION START</div><p class="sub">候補者を選んで管理者選挙を開始します。</p><button class="btn alt" onclick="startElection('CLASS_ADMIN')">CLASS_ADMIN選挙</button><button class="btn alt" onclick="startElection('GRADE_ADMIN')">GRADE_ADMIN選挙</button><button class="btn alt" onclick="startElection('SCHOOL_ADMIN')">SCHOOL_ADMIN選挙</button></section></div>`}async function startElection(type){const us=await api('/api/users/search?q=');const ids=us.slice(0,5).map(x=>x.id);try{await api('/api/elections',{method:'POST',body:JSON.stringify({type,candidateIds:ids})});toast('選挙を開始しました');school($('#main'))}catch(x){toast(x.message)}}
async function people(m){const f=await api('/api/friends');m.innerHTML=`<div class="glass card"><div class="row"><input id="uq" class="input" placeholder="友達を検索" oninput="searchUsers()"></div><div id="users" class="list">${f.map(x=>userRow(x,false)).join('')}</div></div>`}function userRow(u,friend=true){return `<div class="item row"><div class="avatar">${esc(u.icon)}</div><div style="flex:1"><b>${esc(u.displayName)}</b><div class="sub">${esc(u.schoolName)} / ${esc(u.grade)}年${esc(u.className)}</div></div>${friend?'':'<button class="btn alt" onclick="addFriend(\''+u.id+'\')">追加</button>'}</div>`}async function searchUsers(){const q=$('#uq').value;const us=await api('/api/users/search?q='+encodeURIComponent(q));$('#users').innerHTML=us.map(x=>userRow(x,false)).join('')||'<p class="sub">見つかりません</p>'}async function addFriend(id2){await api('/api/friends/'+id2,{method:'POST'});toast('友達に追加しました');people($('#main'))}
async function study(m){books=await api('/api/study/books');m.innerHTML=`<div class="grid"><section class="glass card span12"><div class="h">NOVA STUDY</div><div class="big">単語帳を選ぶ</div><p class="sub">提供された4つのデータを学習モードで使えます。</p></section>${books.map(b=>`<section class="glass card span6"><div class="h">VOCABULARY</div><div class="big">${esc(b.name)}</div><p class="sub">範囲選択・フラッシュカード・4択・英日・日英・スペル・リスニング・弱点復習</p><button class="btn" onclick="openBook('${b.id}','${esc(b.name)}','${b.path}')">学習開始</button></section>`).join('')}</div>`}
async function openBook(id2,name,pth){const r=await fetch(pth);const text=await r.text();const entries=parseBook(id2,text).slice(0,80);$('#main').innerHTML=`<div class="glass card"><div class="h">${name}</div><div class="row"><button class="btn" onclick="flash('${id2}')">フラッシュカード</button><button class="btn alt" onclick="quiz('${id2}')">4択</button><button class="btn alt" onclick="spelling('${id2}')">スペル</button></div><div class="list">${entries.slice(0,20).map((e,i)=>`<div class="item"><b>${i+1}. ${esc(e.q)}</b><div class="sub">${esc(e.a)}</div></div>`).join('')}</div></div>`;window.NOVA_BOOKS=window.NOVA_BOOKS||{};window.NOVA_BOOKS[id2]=entries}
function parseBook(id2,t){const lines=t.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);if(id2==='irohani'){let out=[];for(let i=0;i<lines.length;i++){if(!lines[i].startsWith('【')&&!/^\d+/.test(lines[i])&&i+1<lines.length&&!lines[i].includes('①')&&!lines[i].includes('②')){let a='';for(let j=i+1;j<Math.min(i+5,lines.length);j++){if(lines[j].startsWith('【KEY】')){a=lines[j].replace('【KEY】','');break}}if(a)out.push({q:lines[i],a})}}return out}let out=[];for(const l of lines){const m=l.match(/^\d+[\t ]+([^\t ]+)\s+(.+)$/);if(m)out.push({q:m[1],a:m[2]})}return out}
function flash(id2){const a=window.NOVA_BOOKS?.[id2]||[];let i=0;$('#main').innerHTML=`<div class="glass card" style="text-align:center"><div class="h">FLASHCARD</div><div id="fc" class="big" style="min-height:180px;display:grid;place-items:center">${esc(a[0]?.q||'')}</div><button class="btn" onclick="fcNext()">次へ</button><button class="btn alt" onclick="$('#fc').textContent='${esc(a[0]?.a||'').replace(/'/g,"\\'")}';">答えを見る</button></div>`;window.fc={a,i}}
function fcNext(){const x=window.fc;x.i=(x.i+1)%x.a.length;$('#fc').textContent=x.a[x.i].q}
function quiz(id2){const a=window.NOVA_BOOKS?.[id2]||[];let i=0;function q(){const x=a[i++%a.length];const opts=[x,...a.slice(i,i+3)].sort(()=>Math.random()-.5);$('#main').innerHTML=`<div class="glass card"><div class="h">4 CHOICE</div><div class="big">${esc(x.q)}</div><div class="stack">${opts.map(o=>`<button class="btn alt" onclick="toast(${JSON.stringify(o.a===x.a?'正解！':'不正解')});${o.a===x.a?'':'quiz(\''+id2+'\')'}">${esc(o.a)}</button>`).join('')}</div></div>`}q()}
function spelling(id2){const a=window.NOVA_BOOKS?.[id2]||[];let x=a[Math.floor(Math.random()*a.length)];$('#main').innerHTML=`<div class="glass card"><div class="h">SPELLING</div><div class="big">${esc(x.a)}</div><input id="ans" class="input" placeholder="英単語を入力"><button class="btn" onclick="toast($('#ans').value.trim().toLowerCase()===${JSON.stringify(x.q.toLowerCase())}?'正解！':'不正解')">答え合わせ</button></div>`}
async function settings(m){m.innerHTML=`<div class="grid"><section class="glass card span6"><div class="h">PROFILE</div><div class="row"><div class="avatar">${esc(me.icon)}</div><div><b>${esc(me.displayName)}</b><div class="sub">${esc(me.schoolName)} / ${esc(me.grade)}年 ${esc(me.className)}組</div></div></div><form class="stack" onsubmit="saveProfile(event)" style="margin-top:15px"><input class="input" name="displayName" value="${esc(me.displayName)}"><input class="input" name="icon" value="${esc(me.icon)}"><button class="btn">保存</button></form></section><section class="glass card span6"><div class="h">NOTIFICATION</div><label><input id="notif" type="checkbox" ${me.settings?.notifications?'checked':''}> プッシュ通知</label><br><label><input id="call" type="checkbox" ${me.settings?.callSound?'checked':''}> 通話着信音</label><p class="sub">ブラウザ/端末側の通知許可も必要です。</p></section></div>`}async function saveProfile(e){e.preventDefault();const f=new FormData(e.target);me=await api('/api/me',{method:'PATCH',body:JSON.stringify({displayName:f.get('displayName'),icon:f.get('icon'),settings:{notifications:$('#notif')?.checked??true,callSound:$('#call')?.checked??true}})});localStorage.novaUser=JSON.stringify(me);toast('保存しました');render()}
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});render();
