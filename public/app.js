const $=s=>document.querySelector(s), api=async(path,opt={})=>{opt.headers={...(opt.headers||{}),'Content-Type':'application/json',...(localStorage.novaToken?{Authorization:'Bearer '+localStorage.novaToken}:{})};const r=await fetch(path,opt);const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'エラー');return j};
let me=JSON.parse(localStorage.novaUser||'null'), view='home', friends=[], currentChat=null, books=[];
function persistUser(u){try{const compact={...u};delete compact.icon;localStorage.removeItem('novaUser');localStorage.setItem('novaUser',JSON.stringify(compact))}catch(e){console.warn('Nova user cache could not be saved',e)}}
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
function toast(x){const d=document.createElement('div');d.className='toast';d.textContent=x;document.body.append(d);setTimeout(()=>d.remove(),2600)}
function setSession(x){me=x.user;persistUser(me);localStorage.novaToken=x.token}
function logout(){localStorage.removeItem('novaUser');localStorage.removeItem('novaToken');me=null;render()}
async function render(skipAuthRefresh=false){if(!me)return renderAuth();if(!skipAuthRefresh){try{me=await api('/api/me');persistUser(me)}catch(e){if(me?.role==='SUPER_ADMIN')return renderSuperAdmin();return logout()}}if(view==='superadmin'&&me.role==='SUPER_ADMIN')return renderSuperAdmin();document.body.innerHTML=`<div class="app-shell role-${String(me.role||"STUDENT").toLowerCase()}"><aside class="sidebar glass"><div class="logo"><span>N</span><div><strong>NOVA</strong><small>School Life</small></div></div><div class="side-school">${esc(me.schoolName)}</div><div class="role-badge"><span>権限レベル</span><strong>${({STUDENT:"一般ユーザー",CLASS_ADMIN:"クラス管理者",GRADE_ADMIN:"学年管理者",SCHOOL_ADMIN:"学校管理者",SUPER_ADMIN:"SUPER ADMIN"})[me.role]||me.role}</strong></div><nav>${[['home','⌂','ホーム'],['chat','◌','トーク'],['study','◇','学習'],['schedule','◷','予定'],['settings','⋯','その他'],...(me.role==='SUPER_ADMIN'?[['superadmin','♜','管理']]:[])].map(x=>`<button class="${view===x[0]?'active':''}" onclick="go('${x[0]}')"><b>${x[1]}</b><span>${x[2]}</span></button>`).join('')}</nav><div class="side-bottom"><button class="side-logout" onclick="logout()">↪　ログアウト</button></div></aside><main class="main"><header class="topbar"><div><small>NOVA / SCHOOL LIFE</small><h1>${({home:'ホーム',chat:'トーク',study:'学習',schedule:'予定',settings:'その他'})[view]}</h1></div><div class="top-actions"><div class="avatar">${me.icon?'<img class="avatar" src="'+esc(me.icon)+'">':'N'}</div></div></header><div id="main"></div></main></div><nav class="mobile-nav glass">${[['home','⌂','ホーム'],['chat','◌','トーク'],['study','◇','学習'],['schedule','◷','予定'],['settings','⋯','その他']].map(x=>`<button onclick="go('${x[0]}')"><b>${x[1]}</b><span>${x[2]}</span></button>`).join('')}</nav>`;await route()}
async function renderSuperAdmin(){
  let state={users:[],schools:[],messages:[],friends:[],posts:[],events:[],tasks:[],schedules:[],elections:[],notifications:[],calls:[]};
  try{state=await api('/api/debug/state')}catch(x){document.body.innerHTML=`<div class="auth premium-auth"><div class="authbox glass"><div class="auth-logo"><span>N</span><div>NOVA<small>SYSTEM ADMIN</small></div></div><div class="auth-hero"><small>SUPER ADMIN</small><h1>管理画面を開けませんでした</h1><p>${esc(x.message||'認証セッションを確認してください')}</p><button class="btn alt" onclick="logout()">通常ログインへ</button></div></div></div>`;return}
  const users=state.users||[], schools=state.schools||[];
  const roleCount=r=>users.filter(u=>u.role===r).length;
  const recent=[...users].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).slice(0,8);
  document.body.innerHTML=`
    <div class="super-admin-shell">
      <aside class="super-sidebar glass">
        <div class="super-brand"><span>N</span><div><strong>NOVA</strong><small>SYSTEM ADMIN</small></div></div>
        <div class="super-account"><div class="super-avatar">N</div><div><b>SUPER ADMIN</b><small>Nova System</small></div></div>
        <nav>
          <button class="super-nav active" onclick="superSection('overview',this)">◈ <span>概要</span></button>
          <button class="super-nav" onclick="superSection('users',this)">♙ <span>ユーザー</span></button>
          <button class="super-nav" onclick="superSection('schools',this)">▦ <span>学校</span></button>
          <button class="super-nav" onclick="superSection('admins',this)">♜ <span>管理者</span></button>
          <button class="super-nav" onclick="superSection('system',this)">⚙ <span>システム</span></button>
        </nav>
        <div class="super-side-bottom"><button onclick="go('home')">← Novaへ戻る</button><button onclick="logout()">↪ ログアウト</button></div>
      </aside>
      <main class="super-main">
        <header class="super-top">
          <div><div class="super-eyebrow">NOVA / SYSTEM CONTROL</div><h1 id="superTitle">管理者ダッシュボード</h1></div>
          <div class="super-top-actions"><span class="live-dot"></span><span>SUPER ADMIN</span><button class="icon-btn" onclick="renderSuperAdmin()">↻</button></div>
        </header>
        <section id="superContent"></section>
      </main>
    </div>`;
  window.NOVA_SUPER_STATE=state;
  superSection('overview');
}
async function superBan(id){
  const reason=prompt('BAN理由を入力してください（任意）','Novaの利用規約違反');
  if(reason===null)return;
  if(!confirm('このアカウントを利用停止にしますか？'))return;
  try{await api('/api/super/users/'+id+'/ban',{method:'POST',body:JSON.stringify({reason})});toast('アカウントをBANしました');return renderSuperAdmin()}catch(x){toast(x.message)}
}
function superRolePrompt(id){const role=prompt('権限を入力: STUDENT / CLASS_ADMIN / GRADE_ADMIN / SCHOOL_ADMIN / SUPER_ADMIN');if(!role)return;superSetRole(id,role.trim().toUpperCase())}
async function superUnban(id){
  if(!confirm('このアカウントのBANを解除しますか？'))return;
  try{await api('/api/super/users/'+id+'/unban',{method:'POST'});toast('BANを解除しました');return renderSuperAdmin()}catch(x){toast(x.message)}
}
function superSection(section,btn){
  document.querySelectorAll('.super-nav').forEach(x=>x.classList.remove('active'));
  if(btn)btn.classList.add('active');
  const state=window.NOVA_SUPER_STATE||{};
  const users=state.users||[],schools=state.schools||[];
  const titles={overview:'管理者ダッシュボード',users:'ユーザー管理',schools:'学校管理',admins:'管理者管理',system:'システム'};
  const title=$('#superTitle');if(title)title.textContent=titles[section]||titles.overview;
  const c=$('#superContent');if(!c)return;
  if(section==='overview'){
    c.innerHTML=`
      <div class="super-welcome glass"><div><span class="super-kicker">NOVA SYSTEM</span><h2>Nova全体を管理します。</h2><p>学校・ユーザー・管理者・サービスデータを一元管理するSUPER ADMIN専用画面です。</p></div><div class="system-badge"><i></i> SYSTEM ONLINE</div></div>
      <div class="super-stats">
        <div class="super-stat glass"><small>USERS</small><strong>${users.length}</strong><span>登録ユーザー</span></div>
        <div class="super-stat glass"><small>SCHOOLS</small><strong>${schools.length}</strong><span>登録学校</span></div>
        <div class="super-stat glass"><small>ADMINS</small><strong>${users.filter(u=>u.role&&u.role!=='STUDENT').length}</strong><span>管理者</span></div>
        <div class="super-stat glass"><small>MESSAGES</small><strong>${(state.messages||[]).length}</strong><span>メッセージ</span></div>
      </div>
      <div class="super-grid">
        <section class="glass super-card span2"><div class="super-card-head"><div><small>ADMIN HIERARCHY</small><h3>管理者構成</h3></div></div>
          <div class="role-row"><b>SUPER ADMIN</b><span>${roleCount('SUPER_ADMIN')}</span></div>
          <div class="role-row"><b>SCHOOL ADMIN</b><span>${roleCount('SCHOOL_ADMIN')}</span></div>
          <div class="role-row"><b>GRADE ADMIN</b><span>${roleCount('GRADE_ADMIN')}</span></div>
          <div class="role-row"><b>CLASS ADMIN</b><span>${roleCount('CLASS_ADMIN')}</span></div>
        </section>
        <section class="glass super-card span2"><div class="super-card-head"><div><small>RECENT REGISTRATIONS</small><h3>最近の登録</h3></div><button class="super-link" onclick="superSection('users')">すべて見る →</button></div>
          ${recent.map(u=>`<div class="super-user-row"><div class="super-mini-avatar">${u.icon?'<img src="'+esc(u.icon)+'">':'N'}</div><div><b>${esc(u.displayName)}</b><small>${esc(u.schoolName)} · ${esc(u.grade)}年 ${esc(u.className)}組</small></div><em>${esc(u.role)}</em></div>`).join('')||'<div class="super-empty">登録ユーザーはありません</div>'}
        </section>
        <section class="glass super-card span4"><div class="super-card-head"><div><small>SERVICE DATA</small><h3>サービス状況</h3></div></div>
          <div class="data-grid">
            <div><b>${(state.posts||[]).length}</b><span>掲示板投稿</span></div>
            <div><b>${(state.events||[]).length}</b><span>行事</span></div>
            <div><b>${(state.tasks||[]).length}</b><span>課題</span></div>
            <div><b>${(state.elections||[]).length}</b><span>選挙</span></div>
            <div><b>${(state.friends||[]).length}</b><span>友達関係</span></div>
            <div><b>${(state.notifications||[]).length}</b><span>通知</span></div>
          </div>
        </section>
      </div>`;
  }else if(section==='users'){
    c.innerHTML=`<section class="glass super-card"><div class="super-card-head"><div><small>USER DIRECTORY</small><h3>全ユーザー</h3></div><span class="super-count">${users.length} USERS</span></div><div class="super-table-wrap"><table class="super-table"><thead><tr><th>ユーザー</th><th>学校</th><th>所属</th><th>権限</th><th>状態</th><th>操作</th></tr></thead><tbody>${users.map(u=>`<tr><td><div class="table-user"><div class="super-mini-avatar">${u.icon?'<img src="'+esc(u.icon)+'">':'N'}</div><b>${esc(u.displayName)}</b></div></td><td>${esc(u.schoolName)}</td><td>${esc(u.grade)}年 ${esc(u.className)}組 / ${esc(u.attendanceNo)}</td><td><span class="role-pill ${esc(String(u.role||'STUDENT').toLowerCase())}">${esc(u.role||'STUDENT')}</span></td><td><span class="status-pill ${u.banned?'banned':'active'}">${u.banned?'BAN':'ACTIVE'}</span></td><td><button class="ban-btn" onclick="superRolePrompt(${JSON.stringify(u.id)})">権限変更</button> ${u.role==='SUPER_ADMIN'?'<span class="protected-label">保護</span>':u.banned?`<button class="ban-btn unban" onclick="superUnban(${JSON.stringify(u.id)})">BAN解除</button>`:`<button class="ban-btn" onclick="superBan(${JSON.stringify(u.id)})">アカウントBAN</button>`}</td></tr>`).join('')}</tbody></table></div></section>`;
  }else if(section==='schools'){
    c.innerHTML=`<section class="glass super-card"><div class="super-card-head"><div><small>SCHOOL DIRECTORY</small><h3>登録学校</h3></div><span class="super-count">${schools.length} SCHOOLS</span></div><div class="school-admin-grid">${schools.map(s=>{const n=users.filter(u=>u.schoolId===s.id).length;return `<div class="school-admin-card"><div class="school-mark">N</div><div><b>${esc(s.name)}</b><span>${n} users</span></div><i>›</i></div>`}).join('')||'<div class="super-empty">登録学校はありません</div>'}</div></section>`;
  }else if(section==='admins'){
    const admins=users.filter(u=>u.role&&u.role!=='STUDENT');
    c.innerHTML=`<div class="super-grid"><section class="glass super-card span2"><div class="super-card-head"><div><small>ADMINISTRATORS</small><h3>現在の管理者</h3></div></div>${admins.map(u=>`<div class="super-user-row admin-row"><div class="super-mini-avatar">${u.icon?'<img src="'+esc(u.icon)+'">':'N'}</div><div><b>${esc(u.displayName)}</b><small>${esc(u.schoolName)} · ${esc(u.grade)}年 ${esc(u.className)}組</small></div><em>${esc(u.role)}</em></div>`).join('')||'<div class="super-empty">管理者はいません</div>'}</section><section class="glass super-card span2"><div class="super-card-head"><div><small>CONTROL</small><h3>SUPER ADMIN権限</h3></div></div><div class="permission-note"><b>Nova全体</b><p>学校・ユーザー・管理者・学習・掲示板・行事など、システム全体を監督できます。</p></div><div class="permission-note"><b>選挙</b><p>各学校・学年・クラスの管理者選出状況を確認し、必要に応じて再選挙を開始できます。</p></div></section></div>`;
  }else{
    c.innerHTML=`<div class="super-grid"><section class="glass super-card span2"><div class="super-card-head"><div><small>SYSTEM</small><h3>システム情報</h3></div></div><div class="system-line"><span>サービス</span><b>Nova</b></div><div class="system-line"><span>権限</span><b>SUPER_ADMIN</b></div><div class="system-line"><span>認証</span><b>管理パスワード</b></div><div class="system-line"><span>データベース</span><b>JSON</b></div></section><section class="glass super-card span2"><div class="super-card-head"><div><small>SAFETY</small><h3>重要事項</h3></div></div><p class="system-copy">SUPER ADMINの操作はNova全体に影響します。ユーザーのプライベートな1対1チャットを通常の管理対象として閲覧する設計にはしません。</p><p class="system-copy">管理パスワードはGitHubへ保存せず、サーバー環境変数で管理します。</p></section></div>`;
  }
}
function renderAuth(){document.body.innerHTML=`<div class="auth premium-auth"><div class="auth-orb a1"></div><div class="auth-orb a2"></div><div class="authbox glass"><div class="auth-logo"><span>N</span><div>NOVA<small>SCHOOL LIFE PLATFORM</small></div></div><div class="auth-hero"><small>WELCOME TO NOVA</small><h1>学校生活を、<em>ひとつに。</em></h1><p>学校・学年・クラス・学習を、ひとつの上質な空間へ。</p></div><div class="tabs"><button id="regtab" class="on" onclick="authMode('reg')">初期登録</button><button id="logtab" onclick="authMode('login')">ログイン</button></div><div id="authform"></div></div></div>`;authMode('reg')}
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
      box.innerHTML=a.slice(0,8).map(x=>`<button type="button" class="school-option" data-school-name="${esc(x.name)}"><b>${esc(x.name)}</b>${x.location?`<small>${esc(x.location)}</small>`:''}</button>`).join('')||'<div class="school-noresult">候補が見つかりません</div>';
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
      box.innerHTML=a.slice(0,8).map(x=>`<button type="button" class="school-option" data-school-id="${esc(x.id)}" data-school-name="${esc(x.name)}"><b>${esc(x.name)}</b>${x.location?`<small>${esc(x.location)}</small>`:''}</button>`).join('')||'<div class="school-noresult">候補が見つかりません</div>';
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
    await render(true);
    toast('登録が完了しました。所属クラスに参加しました');
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
    await render(true);
    toast('ログインしました');
  }catch(x){toast(x.message)}
}
async function go(v){view=v;await render(true)}
async function route(){const m=$('#main');if(view==='home')return home(m);if(view==='chat')return chat(m);if(view==='study')return study(m);if(view==='schedule')return scheduleView(m);if(view==='settings')return settings(m);return home(m)}
let homeSelectedDate=new Date();
let homeClockTimer=null;
function homeDay(delta){
  homeSelectedDate=new Date(homeSelectedDate.getFullYear(),homeSelectedDate.getMonth(),homeSelectedDate.getDate()+delta);
  home($('#main'));
}
function homeResetDay(){
  homeSelectedDate=new Date();
  home($('#main'));
}
function homeDayKey(d){
  return ['日','月','火','水','木','金','土'][d.getDay()];
}
function scheduleMatchesDay(item,d){
  const raw=String(item.day??'').trim();
  const key=homeDayKey(d);
  if(!raw)return false;
  if(raw===key||raw===key+'曜'||raw===key+'曜日')return true;
  if(/^\\d$/.test(raw)&&Number(raw)===d.getDay())return true;
  const map={'0':'日','1':'月','2':'火','3':'水','4':'木','5':'金','6':'土'};
  return map[raw]===key;
}
function homeFormatTaskDate(t){
  if(!t.dueAt)return '期限未設定';
  return new Date(t.dueAt).toLocaleDateString('ja-JP',{month:'numeric',day:'numeric'});
}
function homeNotificationItems(notes){
  return notes.filter(n=>!n.read);
}
async function home(m){
  const [tasks,notes,schedule]=await Promise.all([api('/api/tasks'),api('/api/notifications'),api('/api/schedule')]);
  const now=new Date();
  const selected=new Date(homeSelectedDate);
  const isToday=selected.toDateString()===now.toDateString();
  const dateText=selected.toLocaleDateString('ja-JP',{month:'long',day:'numeric'});
  const weekday=selected.toLocaleDateString('ja-JP',{weekday:'long'});
  const unfinished=tasks.filter(t=>!t.completed).slice(0,4);
  const unreadChats=homeNotificationItems(notes).filter(n=>['message','class_message','group_message','reply'].includes(n.type)).slice(0,4);
  const notices=homeNotificationItems(notes).filter(n=>!['message','class_message','group_message','reply'].includes(n.type)).slice(0,4);
  const daySchedule=schedule.filter(x=>scheduleMatchesDay(x,selected)).sort((a,b)=>Number(a.period||0)-Number(b.period||0));
  const scheduleHtml=daySchedule.map(x=>`<div class="home-schedule-row"><span class="period">${esc(x.period)}限</span><div><b>${esc(x.subject||'授業')}</b><small>${esc(x.room||'')}</small></div></div>`).join('')||'<div class="home-empty">この日の時間割は未登録です</div>';
  const taskHtml=unfinished.map(t=>`<button class="home-task-row" onclick="go('school')"><span class="task-dot"></span><div><b>${esc(t.title||'課題')}</b><small>${esc(t.subject||'課題')} · ${homeFormatTaskDate(t)}</small></div><span>›</span></button>`).join('')||'<div class="home-empty">未完了の課題はありません</div>';
  const chatHtml=unreadChats.map(n=>`<button class="home-unread-row" onclick="go('chat')"><span class="unread-dot"></span><div><b>${esc(n.title||'新しいメッセージ')}</b><small>${esc(n.body||'未読のメッセージがあります')}</small></div><span>›</span></button>`).join('')||'<div class="home-empty">未読のチャットはありません</div>';
  const noticeHtml=notices.map(n=>`<div class="home-notice-row"><span class="notice-mark">•</span><div><b>${esc(n.title||'お知らせ')}</b><small>${esc(n.body||'')}</small></div></div>`).join('')||'<div class="home-empty">新しいお知らせはありません</div>';
  m.innerHTML=`<div class="nova-home nova-home-compact">
    <section class="home-head glass">
      <div><div class="eyebrow">NOVA · SCHOOL LIFE</div><div class="home-date-line"><strong>${dateText}</strong><span>${weekday}</span></div><div id="homeClock" class="home-clock"></div></div>
      <div class="home-head-profile"><div class="avatar">${me.icon?'<img src="'+esc(me.icon)+'">':'N'}</div><div><b>${esc(me.lastName||'')} ${esc(me.firstName||'')}</b><small>${esc(me.grade)}年 · ${esc(me.className)}組</small></div></div>
    </section>
    <section class="home-card glass home-schedule-card">
      <div class="compact-card-head">
        <div><span class="card-icon">◷</span><div><b>時間割</b><small>${isToday?'今日':'選択中の日付'} · ${weekday}</small></div></div>
        <div class="day-controls"><button onclick="homeDay(-1)" aria-label="前の日">‹</button><button class="today-btn" onclick="homeResetDay()">今日</button><button onclick="homeDay(1)" aria-label="次の日">›</button></div>
      </div>
      <div class="home-schedule-list">${scheduleHtml}</div>
    </section>
    <div class="home-two-col">
      <section class="home-card glass">
        <div class="compact-card-head"><div><span class="card-icon">□</span><div><b>終わってない課題</b><small>${unfinished.length}件</small></div></div><button class="mini-link" onclick="go('school')">一覧 ›</button></div>
        <div class="home-list">${taskHtml}</div>
      </section>
      <section class="home-card glass">
        <div class="compact-card-head"><div><span class="card-icon">◌</span><div><b>未読のチャット</b><small>${unreadChats.length}件</small></div></div><button class="mini-link" onclick="go('chat')">チャット ›</button></div>
        <div class="home-list">${chatHtml}</div>
      </section>
    </div>
    <section class="home-card glass home-notice-card">
      <div class="compact-card-head"><div><span class="card-icon">♧</span><div><b>お知らせ</b><small>${notices.length}件の未読</small></div></div><button class="mini-link" onclick="api('/api/notifications/read',{method:'POST'}).then(()=>home($('#main'))).catch(x=>toast(x.message))">すべて既読</button></div>
      <div class="home-notice-list">${noticeHtml}</div>
    </section>
  </div>`;
  if(homeClockTimer)clearInterval(homeClockTimer);
  const updateClock=()=>{const el=$('#homeClock');if(el)el.textContent=new Date().toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit',second:'2-digit'});};
  updateClock();
  homeClockTimer=setInterval(updateClock,1000);
}
let chatRoom='class';
let chatTarget=null;
async function chat(m){
  wsConnect();
  const rooms=[{id:'class',title:me.grade+'年'+me.className+'組',sub:'クラス全員',icon:'C'}];
  if(['CLASS_ADMIN','GRADE_ADMIN','SCHOOL_ADMIN'].includes(me.role))rooms.push({id:'classadmin',title:'CLASS ADMIN',sub:'管理者トーク',icon:'A'});
  if(['GRADE_ADMIN','SCHOOL_ADMIN'].includes(me.role))rooms.push({id:'gradeadmin',title:me.grade+'年 GRADE ADMIN',sub:'学年管理者',icon:'G'});
  if(!friends.length)friends=await api('/api/friends');
  const groups=await api('/api/groups');
  if(!rooms.some(r=>r.id===chatRoom)&&!chatRoom.startsWith('group:')&&chatRoom!=='friend')chatRoom='class';
  const selectedFriend=chatRoom==='friend'&&chatTarget?friends.find(x=>x.id===chatTarget):null;
  const selectedGroup=chatRoom.startsWith('group:')?groups.find(x=>x.id===chatRoom.slice(6)):null;
  const room=rooms.find(r=>r.id===chatRoom);
  const title=selectedFriend?.displayName||selectedGroup?.name||room?.title||'トーク';
  const sub=selectedFriend?'個人トーク':selectedGroup?(selectedGroup.memberIds.length+'人のグループ'):room?.sub||'';
  const boxHtml=chatRoom==='friend'&&chatTarget?await chatHtml(chatTarget):await groupChatHtml(chatRoom);
  const canCompose=!!(chatRoom==='friend'&&chatTarget)||rooms.some(r=>r.id===chatRoom)||!!selectedGroup;
  const roomButton=r=>'<button class="line-room '+(chatRoom===r.id?'on':'')+'" onclick="selectChatRoom(\''+r.id+'\')"><span class="line-avatar">'+r.icon+'</span><span class="line-room-copy"><b>'+esc(r.title)+'</b><small>'+esc(r.sub)+'</small></span></button>';
  const groupButton=g=>'<button class="line-room '+(chatRoom==='group:'+g.id?'on':'')+'" onclick="selectChatRoom(\'group:'+g.id+'\')"><span class="line-avatar">G</span><span class="line-room-copy"><b>'+esc(g.name)+'</b><small>'+g.memberIds.length+'人</small></span></button>';
  const friendButton=f=>'<button class="line-room '+(chatRoom==='friend'&&chatTarget===f.id?'on':'')+'" onclick="openChat(\''+f.id+'\')">'+avatarHtml(f)+'<span class="line-room-copy"><b>'+esc(f.displayName)+'</b><small>個人チャット</small></span></button>';
  m.innerHTML='<div class="line-chat"><aside class="line-chat-list glass '+(selectedFriend?'mobile-hide':'')+'"><div class="line-list-head"><div><div class="eyebrow">NOVA</div><h2>トーク</h2></div><button class="line-new" onclick="createGroup()">＋</button></div><div class="line-search"><input class="input" placeholder="トーク・友達を検索" oninput="filterChatList(this.value)"></div><div id="lineRoomList"><div class="line-label">学校</div>'+rooms.map(roomButton).join('')+'<div class="line-label">グループ</div>'+(groups.map(groupButton).join('')||'<div class="line-empty">グループはありません</div>')+'<div class="line-label">友達</div>'+(friends.map(friendButton).join('')||'<div class="line-empty">友達を追加するとここに表示されます</div>')+'</div></aside><section class="line-chat-main glass '+(selectedFriend?'mobile-show':'')+'"><header class="line-header"><button class="line-back" onclick="selectChatRoom(\'class\')">‹</button><div class="line-header-avatar">'+(selectedFriend?avatarHtml(selectedFriend):'<span class="line-avatar">'+(selectedGroup?'G':room?.icon||'C')+'</span>')+'</div><div class="line-header-name"><b>'+esc(title)+'</b><small>'+esc(sub)+'</small></div>'+'<div class="line-call">'+((selectedFriend||selectedGroup||room)?'<button class="line-call-btn" title="音声通話" onclick="startCall(\'audio\')">☎</button><button class="line-call-btn video" title="ビデオ通話" onclick="startCall(\'video\')">▣</button>':'')+'</div>'+'</header><div id="chatbox" class="line-messages">'+boxHtml+'</div>'+(canCompose?'<div id="replyPreview" class="chat-reply-preview hidden"></div><form class="line-compose" onsubmit="sendCurrentChat(event)"><label class="line-attach">＋<input type="file" accept="image/*" hidden onchange="sendImageFile(event)"></label><input id="chatText" class="line-input" name="text" placeholder="メッセージ" autocomplete="off"><button class="line-send" type="submit">➤</button></form>':'<div class="line-readonly">このトークにはメッセージを送信できません。</div>')+'</section></div>';
}
function filterChatList(q){const s=String(q||'').trim().toLowerCase();document.querySelectorAll('#lineRoomList .line-room').forEach(b=>{b.style.display=!s||b.textContent.toLowerCase().includes(s)?'flex':'none'})}async function createGroup(){
  if(!friends.length)friends=await api('/api/friends');
  if(!friends.length)return toast('先に友達を追加してください');
  const name=prompt('グループ名を入力してください');
  if(!name?.trim())return;
  const choices=friends.map((f,i)=>(i+1)+': '+f.displayName).join('\n');
  const raw=prompt('参加させる友達の番号をカンマ区切りで入力してください。\n\n'+choices);
  if(!raw?.trim())return;
  const indexes=raw.split(',').map(x=>Number(x.trim())-1).filter(x=>Number.isInteger(x)&&x>=0&&x<friends.length);
  const ids=[...new Set(indexes.map(i=>friends[i].id))];
  if(!ids.length)return toast('友達を1人以上選択してください');
  try{const g=await api('/api/groups',{method:'POST',body:JSON.stringify({name:name.trim(),memberIds:ids})});chatRoom='group:'+g.id;chatTarget=null;await render(true);toast('グループを作成しました')}catch(x){toast(x.message)}
}
async function selectChatRoom(room){chatRoom=room;chatTarget=null;await render(true)}
async function groupChatHtml(room){
  const data=room==='class'?await api('/api/class'):room.startsWith('group:')?await api('/api/groups/'+encodeURIComponent(room.slice(6))):await api('/api/talks/'+encodeURIComponent(room));
  return (data.messages||[]).map(x=>messageBubble(x)).join('')||'<div class="chat-empty-state"><span>○</span><b>まだメッセージはありません</b><small>最初のメッセージを送ってみましょう。</small></div>';
}
async function openChat(id2){chatRoom='friend';chatTarget=id2;await render(true)}
function messageBubble(x){
  const reply=x.replyTo?'<div class="message-reply"><span>返信</span>'+esc(x.replyTo.text||'メッセージ')+'</div>':'';
  const image=x.image?'<img class="chat-image" src="'+esc(x.image)+'" onclick="openImage('+JSON.stringify(x.image)+')">':'';
  const sticker='';
  const text=x.text?'<div class="bubble-text">'+esc(x.text)+'</div>':'';
  return '<div class="bubble-row '+(x.from===me.id?'mine':'')+'"><div class="bubble '+(x.from===me.id?'mine':'')+'"><div class="message-meta"><b>'+(x.from===me.id?'あなた':esc(x.fromName||'メンバー'))+'</b><span>'+new Date(x.createdAt).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'})+'</span></div>'+reply+image+text+'<div class="message-actions"><button type="button" onclick="replyMessage('+JSON.stringify(JSON.stringify({id:x.id,text:x.text||x.sticker||'画像'}))+')">↩ 返信</button></div></div></div>';
}
function replyMessage(raw){try{window.novaReply=JSON.parse(raw)}catch{window.novaReply=null}const p=$('#replyPreview');if(p){p.textContent=window.novaReply?'返信: '+window.novaReply.text:'';p.classList.toggle('hidden',!window.novaReply)}}
function sendImageFile(e){const f=e.target.files?.[0];e.target.value='';if(!f)return;if(!f.type.startsWith('image/'))return toast('画像を選択してください');if(f.size>4*1024*1024)return toast('画像は4MB以下です');const r=new FileReader();r.onload=()=>sendCurrentChat(null,{image:r.result});r.readAsDataURL(f)}
function wsConnect(){if(!me||window.novaWs?.readyState===WebSocket.OPEN)return;try{const p=location.protocol==='https:'?'wss':'ws';window.novaWs=new WebSocket(p+'://'+location.host+'/ws?token='+encodeURIComponent(localStorage.novaToken||''));window.novaWs.onmessage=e=>{try{const x=JSON.parse(e.data);if((x.type==='message'||x.type==='group_message')&&view==='chat')chat($('#main'));if(x.type==='call_signal')handleCallSignal(x)}catch{}};window.novaWs.onclose=()=>{window.novaWs=null;setTimeout(()=>me&&wsConnect(),2000)}}catch{}}
function sendSignal(x){if(window.novaWs?.readyState===WebSocket.OPEN)window.novaWs.send(JSON.stringify(x))}
let novaPeers={},novaStream=null,novaTargets=[],novaMode=null,novaRoomKey=null,novaCallId=null;
function callScope(){
  if(chatRoom==='friend')return {scope:'friend',ids:chatTarget?[chatTarget]:[]};
  if(chatRoom==='class'||chatRoom==='classadmin'||chatRoom==='gradeadmin')return {scope:chatRoom,ids:[]};
  if(chatRoom.startsWith('group:'))return {scope:'group',groupId:chatRoom.slice(6),ids:[]};
  return null;
}
async function getCallParticipants(){
  const c=callScope();if(!c)return [];
  if(c.scope==='friend')return friends.filter(x=>c.ids.includes(x.id));
  const q=new URLSearchParams({scope:c.scope});if(c.groupId)q.set('groupId',c.groupId);
  const r=await api('/api/call/participants?'+q.toString());return r.participants||[];
}
function peerKey(id){return String(id)}
function sendCallSignal(toUserId,payload){sendSignal({type:'call_signal',toUserId,...payload})}
function createCallPeer(userId,initiator){
  const key=peerKey(userId);if(novaPeers[key])return novaPeers[key];
  const pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});
  novaPeers[key]=pc;
  if(novaStream)novaStream.getTracks().forEach(t=>pc.addTrack(t,novaStream));
  pc.onicecandidate=e=>{if(e.candidate)sendCallSignal(userId,{action:'ice',callId:novaCallId,candidate:e.candidate})};
  pc.ontrack=e=>attachRemoteStream(userId,e.streams[0]);
  pc.onconnectionstatechange=()=>{if(['failed','closed','disconnected'].includes(pc.connectionState))removeRemoteStream(userId)};
  if(initiator)pc.createOffer().then(o=>pc.setLocalDescription(o)).then(()=>sendCallSignal(userId,{action:'offer',callId:novaCallId,mode:novaMode,offer:pc.localDescription})).catch(()=>{});
  return pc;
}
function attachRemoteStream(userId,stream){
  let stage=$('#callStage');if(!stage)return;
  let v=document.getElementById('remote_'+userId);
  if(!v){v=document.createElement('video');v.id='remote_'+userId;v.autoplay=true;v.playsInline=true;v.className='remote-peer-video';v.dataset.userId=userId;stage.appendChild(v)}
  v.srcObject=stream;
}
function removeRemoteStream(userId){document.getElementById('remote_'+userId)?.remove()}
async function startCall(mode){
  const c=callScope();if(!c)return toast('このトークでは通話できません');
  try{
    const participants=await getCallParticipants();
    if(c.scope!=='friend'&&participants.length>7)return toast('通話は同時に8人までです');
    novaMode=mode;novaRoomKey=chatRoom;novaCallId=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);
    novaTargets=participants.map(x=>x.id);
    novaStream=await navigator.mediaDevices.getUserMedia({audio:true,video:mode==='video'});
    showCall(mode,novaStream);
    if(!participants.length)return toast('通話相手がオンラインではありません');
    for(const p of participants)createCallPeer(p.id,true);
  }catch{endCall(false);toast('通話を開始できませんでした')}
}
function showCall(mode,stream){
  let b=$('#callWindow');
  if(!b){b=document.createElement('div');b.id='callWindow';b.className='call-window glass';document.body.append(b)}
  b.innerHTML='<div class="call-head"><b>'+(mode==='video'?'ビデオ通話':'音声通話')+'</b><button onclick="endCall()">×</button></div><div id="callStage" class="call-stage">'+(mode==='video'?'<video id="localVideo" autoplay muted playsinline></video>':'<div class="call-avatar">☎</div>')+'<audio id="remoteAudio" autoplay></audio></div><div class="call-controls"><button class="call-end" onclick="endCall()">通話を終了</button></div>';
  if(mode==='video'&&stream&&$('#localVideo'))$('#localVideo').srcObject=stream;
}
async function handleCallSignal(x){
  if(x.action==='offer'){
    if(novaCallId&&novaCallId!==x.callId)return;
    if(!confirm('着信があります。通話に出ますか？')){sendCallSignal(x.fromUserId,{action:'reject',callId:x.callId});return}
    try{
      novaCallId=x.callId;novaMode=x.mode;novaTarget=x.fromUserId;
      novaStream=await navigator.mediaDevices.getUserMedia({audio:true,video:x.mode==='video'});
      showCall(x.mode,novaStream);
      const pc=createCallPeer(x.fromUserId,false);
      await pc.setRemoteDescription(x.offer);
      const ans=await pc.createAnswer();await pc.setLocalDescription(ans);
      sendCallSignal(x.fromUserId,{action:'answer',callId:x.callId,answer:pc.localDescription});
      if(!novaTargets.includes(x.fromUserId))novaTargets.push(x.fromUserId);
    }catch{endCall(false)}
  }else if(x.action==='answer'){
    if(x.callId!==novaCallId)return;
    const pc=novaPeers[peerKey(x.fromUserId)];if(pc)await pc.setRemoteDescription(x.answer);
  }else if(x.action==='ice'){
    if(x.callId!==novaCallId)return;
    const pc=novaPeers[peerKey(x.fromUserId)];if(pc)pc.addIceCandidate(x.candidate).catch(()=>{});
  }else if(x.action==='reject'){toast('相手が応答しませんでした')}
  else if(x.action==='hangup'){removeRemoteStream(x.fromUserId);if(Object.keys(novaPeers).length<=1)endCall(false)}
}
function endCall(notify=true){
  if(notify&&novaTargets.length)novaTargets.forEach(id=>sendCallSignal(id,{action:'hangup',callId:novaCallId}));
  Object.values(novaPeers).forEach(pc=>pc.close());
  novaPeers={};novaStream?.getTracks().forEach(t=>t.stop());novaStream=null;novaTargets=[];novaCallId=null;novaMode=null;novaRoomKey=null;$('#callWindow')?.remove()
}
async function sendCurrentChat(e,extra={}){
  if(e)e.preventDefault();
  const text=String($('#chatText')?.value||e?.target?.text?.value||'').trim();
  if(!text&&!extra.image&&!extra.sticker)return;
  const body={text,...extra,replyTo:window.novaReply||null};
  try{
    if(chatRoom==='friend')await api('/api/chats/'+encodeURIComponent(chatTarget),{method:'POST',body:JSON.stringify(body)});
    else if(chatRoom==='class')await api('/api/class/messages',{method:'POST',body:JSON.stringify(body)});
    else if(chatRoom.startsWith('group:'))await api('/api/groups/'+encodeURIComponent(chatRoom.slice(6))+'/messages',{method:'POST',body:JSON.stringify(body)});
    else await api('/api/talks/'+encodeURIComponent(chatRoom)+'/messages',{method:'POST',body:JSON.stringify(body)});
    if($('#chatText'))$('#chatText').value='';
    window.novaReply=null;
    await chat($('#main'));
  }catch(x){toast(x.message)}
}
async function chatHtml(id2){const ms=await api('/api/chats/'+id2);return ms.map(x=>messageBubble(x)).join('')||'<p class="sub">まだメッセージはありません。</p>'}
async function school(m){
  const [cls,events,tasks,schedule,elections]=await Promise.all([api('/api/class'),api('/api/events'),api('/api/tasks'),api('/api/schedule'),api('/api/elections')]);
  const posts=await api('/api/posts?kind=class');
m.innerHTML=`<div class="tabs"><button class="on">クラストーク</button><button onclick="schoolGrade()">学年</button><button onclick="schoolSchool()">学校</button><button onclick="adminPanel()">管理</button></div>
<div class="grid">
<section class="glass card span8 class-talk-card">
  <div class="class-talk-head"><div><div class="h">${esc(cls.talk.name)}</div><div class="sub">${cls.members.length}人 · クラス全員のトーク</div></div></div>
  <div id="classChatBox" class="chat class-chat-box">${classChatHtml(cls.messages)}</div>
  <form class="row" onsubmit="sendClassMsg(event)"><input class="input" name="text" placeholder="クラスにメッセージを送る" autocomplete="off"><button class="btn">送信</button></form>
</section>
<section class="glass card span4"><div class="h">CLASS BOARD</div>${posts.map(p=>`<div class="item"><b>${esc(p.title)}</b><p>${esc(p.body)}</p><div class="sub">${new Date(p.createdAt).toLocaleString('ja-JP')}</div></div>`).join('')||'<p class="sub">投稿はありません</p>'}</section>
<section class="glass card span4"><div class="h">SCHEDULE</div>${schedule.slice(0,8).map(x=>`<div class="item"><b>${esc(x.day)} ${esc(x.period)}限</b><div>${esc(x.subject)}</div><div class="sub">${esc(x.room)}</div></div>`).join('')||'<p class="sub">時間割は未登録</p>'}</section>
<section class="glass card span12"><div class="h">ELECTIONS</div>${elections.map(e=>`<div class="item"><b>${esc(e.type)}</b> <span class="sub">${e.status}</span><div class="row">${e.candidates.map(c=>`<button class="btn alt" onclick="vote('${e.id}','${c.id}')">${esc(c.name)} (${c.votes})</button>`).join('')}</div></div>`).join('')||'<p class="sub">進行中の投票はありません</p>'}</section></div>`;
}
function classChatHtml(messages){
  return (messages||[]).map(x=>`<div class="bubble ${x.from===me.id?'mine':''}"><div class="sub">${x.from===me.id?'あなた':esc(x.fromName||'クラスメンバー')}</div>${esc(x.text)}<div class="sub">${new Date(x.createdAt).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'})}</div></div>`).join('')||'<p class="sub">まだメッセージはありません。最初のメッセージを送ってみましょう。</p>';
}
async function sendClassMsg(e){
  e.preventDefault();
  const f=new FormData(e.target);
  const text=String(f.get('text')||'').trim();
  if(!text)return;
  try{await api('/api/class/messages',{method:'POST',body:JSON.stringify({text})});e.target.reset();school($('#main'));}catch(x){toast(x.message)}
}
async function schoolGrade(){view='school';const m=$('#main');const p=await api('/api/posts?kind=grade');m.innerHTML=`<div class="glass card"><div class="h">GRADE BOARD</div>${p.map(x=>`<div class="item"><b>${esc(x.title)}</b><p>${esc(x.body)}</p></div>`).join('')||'<p class="sub">投稿はありません</p>'}</div>`}async function schoolSchool(){const p=await api('/api/posts?kind=school');$('#main').innerHTML=`<div class="glass card"><div class="h">SCHOOL BOARD</div>${p.map(x=>`<div class="item"><b>${esc(x.title)}</b><p>${esc(x.body)}</p></div>`).join('')||'<p class="sub">投稿はありません</p>'}</div>`}
async function vote(e,c){try{await api('/api/elections/'+e+'/vote',{method:'POST',body:JSON.stringify({candidateId:c})});toast('投票しました');school($('#main'))}catch(x){toast(x.message)}}
async function adminPanel(){const admins=await api('/api/admins');$('#main').innerHTML=`<div class="grid"><section class="glass card span6"><div class="h">ADMINISTRATORS</div>${admins.map(a=>`<div class="item row"><div class="avatar">${esc(a.icon)}</div><div><b>${esc(a.displayName)}</b><div class="sub">${esc(a.role)}</div></div></div>`).join('')||'<p class="sub">管理者はいません</p>'}</section><section class="glass card span6"><div class="h">ELECTION START</div><p class="sub">候補者を選んで管理者選挙を開始します。</p><button class="btn alt" onclick="startElection('CLASS_ADMIN')">CLASS_ADMIN選挙</button><button class="btn alt" onclick="startElection('GRADE_ADMIN')">GRADE_ADMIN選挙</button><button class="btn alt" onclick="startElection('SCHOOL_ADMIN')">SCHOOL_ADMIN選挙</button></section></div>`}async function startElection(type){const us=await api('/api/users/search?q=');const ids=us.slice(0,5).map(x=>x.id);try{await api('/api/elections',{method:'POST',body:JSON.stringify({type,candidateIds:ids})});toast('選挙を開始しました');school($('#main'))}catch(x){toast(x.message)}}
async function people(m){const f=await api('/api/friends');m.innerHTML=`<div class="glass card"><div class="row"><input id="uq" class="input" placeholder="友達を検索" oninput="searchUsers()"></div><div id="users" class="list">${f.map(x=>userRow(x,false)).join('')}</div></div>`}function userRow(u,friend=true){return `<div class="item row"><div class="avatar">${esc(u.icon)}</div><div style="flex:1"><b>${esc(u.displayName)}</b><div class="sub">${esc(u.schoolName)} / ${esc(u.grade)}年${esc(u.className)}</div></div>${friend?'':'<button class="btn alt" onclick="addFriend(\''+u.id+'\')">追加</button>'}</div>`}async function searchUsers(){const q=$('#uq').value;const us=await api('/api/users/search?q='+encodeURIComponent(q));$('#users').innerHTML=us.map(x=>userRow(x,false)).join('')||'<p class="sub">見つかりません</p>'}async function addFriend(id2){await api('/api/friends/'+id2,{method:'POST'});toast('友達に追加しました');people($('#main'))}
async function study(m){
  books=await api('/api/study/books');
  m.innerHTML=`<div class="study-page">
    <section class="study-hero glass">
      <div><div class="eyebrow">NOVA STUDY</div><h2>自分に合わせて単語学習</h2><p>単語帳・範囲・出題方向・順番・問題形式・読み上げを自由に設定できます。</p></div>
    </section>
    <div class="study-book-grid">${books.map(b=>`<button class="study-book-card glass" onclick="openStudySetup('${esc(b.id)}','${esc(b.name)}','${esc(b.path)}')"><span class="study-book-mark">N</span><div><b>${esc(b.name)}</b><small>範囲・出題形式を設定して開始</small></div><span class="study-arrow">›</span></button>`).join('')}</div>
  </div>`
}
async function openStudySetup(id2,name,pth){
  let entries=window.NOVA_BOOKS?.[id2];
  if(!entries){
    const r=await fetch(pth); const text=await r.text(); entries=parseBook(id2,text);
    window.NOVA_BOOKS=window.NOVA_BOOKS||{}; window.NOVA_BOOKS[id2]=entries;
  }
  if(!entries.length)return toast('単語データを読み込めませんでした');
  const max=entries.length;
  $('#main').innerHTML=`<div class="study-setup">
    <section class="glass card">
      <div class="study-setup-head"><div><div class="eyebrow">STUDY SETTINGS</div><h2>${esc(name)}</h2></div><button class="btn alt" onclick="study($('#main'))">戻る</button></div>
      <div class="study-form-grid">
        <label><span>範囲</span><input id="studyRange" class="input" value="1～${Math.min(50,max)}" placeholder="例：1～50、101～200"></label>
        <label><span>問題数</span><input id="studyCount" class="input" type="number" min="1" max="${max}" value="20"></label>
        <label><span>出題方向</span><select id="studyDirection" class="input"><option value="en-ja">英語 → 日本語</option><option value="ja-en">日本語 → 英語</option><option value="random">ランダム</option><option value="both">両方向</option></select></label>
        <label><span>順番</span><select id="studyOrder" class="input"><option value="number">番号順</option><option value="random">ランダム</option><option value="wrong">間違えたものを優先</option><option value="unseen">未出題を優先</option></select></label>
        <label><span>問題形式</span><select id="studyMode" class="input"><option value="choice">4択</option><option value="choice-hard">4択（紛らわしい選択肢）</option><option value="input">入力</option><option value="flash">フラッシュカード</option><option value="listening">リスニング</option><option value="dictation">書き取り</option></select></label>
        <label class="study-check"><input id="studySpeak" type="checkbox" checked> 読み上げる</label>
      </div>
      <div class="study-range-help">全${max}語。複数範囲は「1～50、101～200」のように入力できます。</div>
      <button class="btn primary-btn study-start" onclick="startStudy('${esc(id2)}')">この設定で学習開始</button>
    </section>
  </div>`
}
function parseStudyRanges(raw,max){
  const out=[];
  for(const part of String(raw||'').split(/[、,\\s]+/)){
    if(!part)continue;
    const m=part.match(/^(\\d+)\\s*[～~\\-]\\s*(\\d+)$/);
    if(m){let a=Number(m[1]),b=Number(m[2]);if(a>b)[a,b]=[b,a];a=Math.max(1,a);b=Math.min(max,b);if(a<=b)for(let n=a;n<=b;n++)out.push(n-1)}
    else if(/^\\d+$/.test(part)){const n=Math.min(max,Math.max(1,Number(part)));out.push(n-1)}
  }
  return [...new Set(out)];
}
function parseBook(id2,t){
  const lines=t.split(/\\r?\\n/).map(x=>x.trim()).filter(Boolean);
  if(id2==='irohani'){
    const out=[];
    for(let i=0;i<lines.length;i++){
      if(lines[i].startsWith('【')||/^\\d+/.test(lines[i]))continue;
      let a='';
      for(let j=i+1;j<Math.min(i+6,lines.length);j++)if(lines[j].startsWith('【KEY】')){a=lines[j].replace('【KEY】','').trim();break}
      if(a)out.push({no:out.length+1,q:lines[i],a,type:'jp'});
    }
    return out;
  }
  const out=[];
  for(const l of lines){
    const m=l.match(/^(\d+)[\t ]+(.+?)[\t ]{2,}(.+)$/);
    if(m)out.push({no:Number(m[1]),q:m[2].trim(),a:m[3].trim(),type:'en'});
    else {const m2=l.match(/^(\d+)[\t ]+([^\t ]+)[\t ]+(.+)$/);if(m2)out.push({no:Number(m2[1]),q:m2[2].trim(),a:m2[3].trim(),type:'en'})}
  }
  return out;
}
function studyShuffle(a){return [...a].sort(()=>Math.random()-.5)}
function studyWrongKey(id2){return 'novaStudyWrong_'+id2}
function studyGetWrong(id2){try{return JSON.parse(localStorage.getItem(studyWrongKey(id2))||'[]')}catch{return[]}}
function studySaveWrong(id2,no){
  const a=studyGetWrong(id2);if(!a.includes(no))a.push(no);localStorage.setItem(studyWrongKey(id2),JSON.stringify(a));
}
function studySpeak(text,lang){
  if(!window.speechSynthesis)return;
  window.speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(text);u.lang=lang||'en-US';u.rate=.9;window.speechSynthesis.speak(u);
}
function startStudy(id2){
  const a=window.NOVA_BOOKS?.[id2]||[];
  const range=parseStudyRanges($('#studyRange')?.value,a.length);
  if(!range.length)return toast('範囲を正しく入力してください');
  let pool=range.map(i=>a[i]).filter(Boolean);
  const order=$('#studyOrder').value;
  if(order==='random')pool=studyShuffle(pool);
  if(order==='wrong'){const w=new Set(studyGetWrong(id2));pool=[...pool.filter(x=>w.has(x.no)),...pool.filter(x=>!w.has(x.no))]}
  if(order==='unseen'){const seen=new Set(JSON.parse(localStorage.getItem('novaStudySeen_'+id2)||'[]'));pool=[...pool.filter(x=>!seen.has(x.no)),...pool.filter(x=>seen.has(x.no))]}
  let count=Math.min(Math.max(1,Number($('#studyCount').value)||20),pool.length);
  pool=pool.slice(0,count);
  const direction=$('#studyDirection').value,mode=$('#studyMode').value,speak=$('#studySpeak').checked;
  if(mode==='flash')return runFlashStudy(id2,pool,direction,speak);
  window.studySession={id:id2,pool,i:0,correct:0,wrong:[],direction,mode,speak};
  runStudyQuestion();
}
function studyQuestionPair(x,direction){
  const dir=direction==='random'?(Math.random()<.5?'en-ja':'ja-en'):direction;
  if(dir==='both')return Math.random()<.5?{q:x.q,a:x.a,lang:'en'}:{q:x.a,a:x.q,lang:'ja-JP'};
  return dir==='ja-en'?{q:x.a,a:x.q,lang:'ja-JP'}:{q:x.q,a:x.a,lang:'en-US'};
}
function runStudyQuestion(){
  const s=window.studySession;if(!s||s.i>=s.pool.length)return finishStudy();
  const x=s.pool[s.i],p=studyQuestionPair(x,s.direction);
  const distractors=studyShuffle(s.pool.filter(y=>y!==x).map(y=>y.a)).slice(0,3);
  let choices=studyShuffle([x.a,...distractors]);
  if(s.mode==='choice'||s.mode==='choice-hard'){
    $('#main').innerHTML=`<section class="glass card study-question"><div class="study-progress">${s.i+1} / ${s.pool.length}</div><div class="study-question-type">${p.lang==='en'?'ENGLISH':'JAPANESE'}</div><div class="study-prompt">${esc(p.q)}</div><div class="study-actions">${s.speak?'<button class="btn alt" onclick="studySpeak('+JSON.stringify(p.q)+','+JSON.stringify(p.lang)+')">🔊 読み上げ</button>':''}</div><div class="study-choices">${choices.map(o=>`<button class="study-choice" onclick="answerStudy(${JSON.stringify(o)}===${JSON.stringify(p.a)})">${esc(o)}</button>`).join('')}</div></section>`;
  }else if(s.mode==='input'||s.mode==='dictation'){
    $('#main').innerHTML=`<section class="glass card study-question"><div class="study-progress">${s.i+1} / ${s.pool.length}</div><div class="study-question-type">${s.mode==='dictation'?'WRITE':'INPUT'}</div><div class="study-prompt">${esc(p.q)}</div>${s.speak?'<button class="btn alt" onclick="studySpeak('+JSON.stringify(p.q)+','+JSON.stringify(p.lang)+')">🔊 読み上げ</button>':''}<input id="studyAnswer" class="input study-answer" autocomplete="off" placeholder="${p.lang==='en'?'答えを入力':'英語を入力'}" onkeydown="if(event.key==='Enter')answerStudyInput()"><button class="btn primary-btn" onclick="answerStudyInput()">答え合わせ</button></section>`;
    if(s.mode==='dictation'&&s.speak)setTimeout(()=>studySpeak(p.q,p.lang),250);
  }else if(s.mode==='listening'){
    $('#main').innerHTML=`<section class="glass card study-question"><div class="study-progress">${s.i+1} / ${s.pool.length}</div><div class="study-question-type">LISTENING</div><button class="study-listen" onclick="studySpeak(${JSON.stringify(p.q)},${JSON.stringify(p.lang)})">▶ 音声を再生</button><div class="study-prompt listening-prompt">音声を聞いて答えを選択</div><div class="study-choices">${choices.map(o=>`<button class="study-choice" onclick="answerStudy(${JSON.stringify(o)}===${JSON.stringify(p.a)})">${esc(o)}</button>`).join('')}</div></section>`;if(s.speak)setTimeout(()=>studySpeak(p.q,p.lang),250)}
}
function answerStudy(ok){
  const s=window.studySession,x=s.pool[s.i];
  const seenKey='novaStudySeen_'+s.id,seen=new Set(JSON.parse(localStorage.getItem(seenKey)||'[]'));seen.add(x.no);localStorage.setItem(seenKey,JSON.stringify([...seen]));
  if(ok)s.correct++;else{studySaveWrong(s.id,x.no);s.wrong.push(x)}
  s.i++;toast(ok?'正解！':'不正解');setTimeout(runStudyQuestion,350);
}
function answerStudyInput(){
  const s=window.studySession,x=s.pool[s.i],p=studyQuestionPair(x,s.direction);
  const raw=String($('#studyAnswer')?.value||'').trim().toLowerCase();
  const target=String(p.a||'').trim().toLowerCase();
  const ok=raw===target||target.split(/[，,、]/)[0].trim().toLowerCase()===raw;
  answerStudy(ok);
}
function runFlashStudy(id2,pool,direction,speak){
  window.flashStudy={id:id2,pool,i:0,direction,speak,show:false};
  renderFlashStudy();
}
function renderFlashStudy(){
  const s=window.flashStudy;if(!s||s.i>=s.pool.length)return finishStudyFlash();
  const x=s.pool[s.i],p=studyQuestionPair(x,s.direction);
  $('#main').innerHTML=`<section class="glass card study-question flash-study"><div class="study-progress">${s.i+1} / ${s.pool.length}</div><div class="study-flash-card" onclick="flashStudyReveal()"><span>${s.show?'答え':'問題'}</span><strong>${esc(s.show?p.a:p.q)}</strong><small>${s.show?'タップで次へ':'タップして答えを見る'}</small></div>${s.speak?'<button class="btn alt" onclick="studySpeak('+JSON.stringify(p.q)+','+JSON.stringify(p.lang)+')">🔊 読み上げ</button>':''}</section>`;
  if(s.speak&&!s.show)setTimeout(()=>studySpeak(p.q,p.lang),250);
}
function flashStudyReveal(){const s=window.flashStudy;if(!s)return;if(!s.show){s.show=true;renderFlashStudy()}else{s.i++;renderFlashStudy()}}
function finishStudy(){
  const s=window.studySession;if(!s)return;
  const acc=Math.round(s.correct/s.pool.length*100);
  $('#main').innerHTML=`<section class="glass card study-result"><div class="eyebrow">STUDY COMPLETE</div><h2>学習終了</h2><div class="study-score"><strong>${s.correct}</strong><span>/ ${s.pool.length}</span></div><p>正答率 ${acc}%</p><div class="study-result-actions"><button class="btn primary-btn" onclick="study($('#main'))">もう一度設定</button><button class="btn alt" onclick="startRetryStudy()">間違えたものをもう一度</button></div><div class="list">${s.wrong.map(x=>`<div class="item"><b>${esc(x.q)}</b><div class="sub">${esc(x.a)}</div></div>`).join('')||'<div class="home-empty">今回の間違いはありません。</div>'}</div></section>`;
}
function startRetryStudy(){const s=window.studySession;if(!s?.wrong.length)return toast('間違えた問題はありません');s.pool=[...s.wrong];s.i=0;s.correct=0;s.wrong=[];runStudyQuestion()}
function finishStudyFlash(){const s=window.flashStudy;$('#main').innerHTML=`<section class="glass card study-result"><div class="eyebrow">FLASHCARD COMPLETE</div><h2>フラッシュカード終了</h2><p>${s.pool.length}語を確認しました。</p><button class="btn primary-btn" onclick="study($('#main'))">もう一度設定</button></section>`}
async function scheduleView(m){
  const schedule=await api('/api/schedule');
  const days=['月','火','水','木','金'];
  m.innerHTML='<div class="schedule-page"><section class="glass card"><div class="eyebrow">NOVA SCHEDULE</div><h2>予定・時間割</h2><p class="sub">基本時間割と登録された臨時変更を確認できます。</p><div class="schedule-week">'+days.map(d=>'<div class="schedule-day"><b>'+d+'曜日</b>'+schedule.filter(x=>String(x.day).replace('曜日','')===d).sort((a,b)=>Number(a.period||0)-Number(b.period||0)).map(x=>'<div class="schedule-item"><span>'+esc(x.period)+'限</span><strong>'+esc(x.subject||'授業')+'</strong><small>'+esc(x.room||'')+'</small></div>').join('')||'<div class="home-empty">未登録</div>'+'</div>').join('')+'</div></section></div>';
}
async function settings(m){
  m.innerHTML=`<div class="settings-page">
    <div class="settings-header"><div class="eyebrow">ACCOUNT SETTINGS</div><h1>設定</h1><p>Novaのアカウント情報を変更できます。</p></div>
    <form class="settings-form" onsubmit="saveProfile(event)">
      <section class="glass card settings-card">
        <div class="settings-card-title"><b>アカウント</b><span>基本情報</span></div>
        <div class="settings-avatar-row">
          <div class="avatar settings-avatar">${me.icon?'<img src="'+esc(me.icon)+'">':'N'}</div>
          <label class="btn alt photo-btn">アイコン写真を変更<input id="settingsIconFile" type="file" accept="image/*" hidden onchange="settingsPhoto(event)"></label>
        </div>
        <div class="settings-grid">
          <label><span>所属学校</span><input class="input" name="schoolName" value="${esc(me.schoolName||'')}" required></label>
          <label><span>学年</span><select class="input" name="grade"><option value="1" ${me.grade==='1'?'selected':''}>1年</option><option value="2" ${me.grade==='2'?'selected':''}>2年</option><option value="3" ${me.grade==='3'?'selected':''}>3年</option></select></label>
          <label><span>クラス</span><input class="input" name="className" value="${esc(me.className||'')}" required></label>
          <label><span>姓</span><input class="input" name="lastName" value="${esc(me.lastName||'')}" required></label>
          <label><span>名</span><input class="input" name="firstName" value="${esc(me.firstName||'')}" required></label>
        </div>
      </section>
      <section class="glass card settings-card">
        <div class="settings-card-title"><b>パスワード</b><span>変更する場合のみ入力</span></div>
        <div class="settings-grid">
          <label><span>現在のパスワード</span><input class="input" type="password" name="currentPassword" autocomplete="current-password"></label>
          <label><span>新しいパスワード</span><input class="input" type="password" name="newPassword" minlength="6" autocomplete="new-password"></label>
          <label><span>新しいパスワード（確認）</span><input class="input" type="password" name="newPassword2" minlength="6" autocomplete="new-password"></label>
        </div>
      </section>
      <section class="glass card settings-card">
        <div class="settings-card-title"><b>通知・通話</b><span>端末通知とは別にNova側で設定</span></div>
        <label class="setting-check"><input id="notif" type="checkbox" ${me.settings?.notifications?'checked':''}> プッシュ通知</label>
        <label class="setting-check"><input id="call" type="checkbox" ${me.settings?.callSound?'checked':''}> 通話着信音</label>
      </section>
      <div class="settings-actions"><button class="btn primary-btn" type="submit">変更を保存</button></div>
    </form>
  </div>`
}
function settingsPhoto(e){
  const f=e.target.files?.[0];if(!f)return;
  if(!f.type.startsWith('image/'))return toast('画像ファイルを選択してください');
  if(f.size>4*1024*1024)return toast('写真は4MB以下にしてください');
  const r=new FileReader();r.onload=()=>{window._settingsIcon=r.result;settings($('#main'))};r.readAsDataURL(f);
}
async function saveProfile(e){
  e.preventDefault();
  const f=new FormData(e.target);
  const newPassword=String(f.get('newPassword')||''),newPassword2=String(f.get('newPassword2')||'');
  if(newPassword!==newPassword2)return toast('新しいパスワードが一致しません');
  if(newPassword&&newPassword.length<6)return toast('パスワードは6文字以上にしてください');
  if(newPassword&&!String(f.get('currentPassword')||''))return toast('現在のパスワードを入力してください');
  try{
    me=await api('/api/me',{method:'PATCH',body:JSON.stringify({
      schoolName:String(f.get('schoolName')||'').trim(),
      grade:String(f.get('grade')||''),
      className:String(f.get('className')||'').trim(),
      lastName:String(f.get('lastName')||'').trim(),
      firstName:String(f.get('firstName')||'').trim(),
      icon:window._settingsIcon??me.icon,
      currentPassword:String(f.get('currentPassword')||''),
      newPassword
      ,settings:{notifications:$('#notif')?.checked??true,callSound:$('#call')?.checked??true}
    })});
    window._settingsIcon=undefined;
    persistUser(me);
    toast('設定を保存しました');
    render(true);
  }catch(x){toast(x.message)}
}

document.addEventListener('click',e=>{
  const b=e.target.closest?.('.school-option');
  if(!b)return;
  e.preventDefault();
  e.stopPropagation();
  const name=b.dataset.schoolName||b.textContent.trim();
  if(b.dataset.schoolId!==undefined)pickSchool(b.dataset.schoolId,name);
  else pickLoginSchool(name);
},true);
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});render();
