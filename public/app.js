const $=s=>document.querySelector(s), api=async(path,opt={})=>{opt.headers={...(opt.headers||{}),'Content-Type':'application/json',...(localStorage.novaToken?{Authorization:'Bearer '+localStorage.novaToken}:{})};const r=await fetch(path,opt);const j=await r.json().catch(()=>({}));if(!r.ok){const e=new Error(j.error||'エラー');e.status=r.status;throw e}return j};
let me=JSON.parse(localStorage.novaUser||'null'), view='home', friends=[], currentChat=null, books=[];
function hasClientRole(role){return me?.role===role||Array.isArray(me?.adminRoles)&&me.adminRoles.includes(role)}
function persistUser(u){try{const compact={...u};delete compact.icon;localStorage.removeItem('novaUser');localStorage.setItem('novaUser',JSON.stringify(compact))}catch(e){console.warn('Nova user cache could not be saved',e)}}
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
function toast(x){const d=document.createElement('div');d.className='toast';d.textContent=x;document.body.append(d);setTimeout(()=>d.remove(),2600)}
function setSession(x){me=x.user;persistUser(me);localStorage.novaToken=x.token}
function logout(){localStorage.removeItem('novaUser');localStorage.removeItem('novaToken');me=null;render()}
async function render(skipAuthRefresh=false){if(!me)return renderAuth();if(!skipAuthRefresh){try{me=await api('/api/me');persistUser(me)}catch(e){if(me?.role==='SUPER_ADMIN')return renderSuperAdmin();return logout()}}if(view==='superadmin'&&hasClientRole('SUPER_ADMIN'))return renderSuperAdmin();document.body.innerHTML=`<div class="app-shell role-${String(me.role||"STUDENT").toLowerCase()}"><aside class="sidebar glass"><div class="logo"><span>N</span><div><strong>NOVA</strong><small>School Life</small></div></div><div class="side-school">${esc(me.schoolName)}</div><div class="role-badge"><span>権限レベル</span><strong>${({STUDENT:"一般ユーザー",CLASS_ADMIN:"クラス管理者",GRADE_ADMIN:"学年管理者",SCHOOL_ADMIN:"学校管理者",SUPER_ADMIN:"SUPER ADMIN"})[me.role]||me.role}</strong></div><nav>${[['home','⌂','ホーム'],['chat','◌','トーク'],['study','◇','学習'],['schedule','◷','予定'],['settings','⋯','その他'],...(hasClientRole('SUPER_ADMIN')?[['superadmin','♜','管理']]:[])].map(x=>`<button class="${view===x[0]?'active':''}" onclick="go('${x[0]}')"><b>${x[1]}</b><span>${x[2]}</span></button>`).join('')}</nav><div class="side-bottom"><button class="side-logout" onclick="logout()">↪　ログアウト</button></div></aside><main class="main"><header class="topbar"><div><small>NOVA / SCHOOL LIFE</small><h1>${({home:'ホーム',chat:'トーク',study:'学習',schedule:'予定',settings:'その他'})[view]}</h1></div><div class="top-actions"><div class="avatar">${me.icon?'<img class="avatar" src="'+esc(me.icon)+'">':'N'}</div></div></header><div id="main"></div></main></div><nav class="mobile-nav glass">${[['home','⌂','ホーム'],['chat','◌','トーク'],['study','◇','学習'],['schedule','◷','予定'],['settings','⋯','その他']].map(x=>`<button onclick="go('${x[0]}')"><b>${x[1]}</b><span>${x[2]}</span></button>`).join('')}</nav>`;await route()}
async function renderSuperAdmin(){
  let state={users:[],schools:[],messages:[],friends:[],posts:[],events:[],tasks:[],schedules:[],elections:[],notifications:[],calls:[]};
  try{state=await api('/api/debug/state')}catch(x){document.body.innerHTML=`<div class="auth premium-auth"><div class="authbox glass"><div class="auth-logo"><span>N</span><div>NOVA<small>SYSTEM ADMIN</small></div></div><div class="auth-hero"><small>SUPER ADMIN</small><h1>管理画面を開けませんでした</h1><p>${esc(x.message||'認証セッションを確認してください')}</p><button class="btn alt" onclick="logout()">通常ログインへ</button></div></div></div>`;return}
  const users=state.users||[], schools=state.schools||[];
  const roleCount=r=>users.filter(u=>u.role===r||(Array.isArray(u.adminRoles)&&u.adminRoles.includes(r))).length;
  const recent=[...users].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).slice(0,8);
  document.body.innerHTML=`
    <div class="super-admin-shell">
      <aside class="super-sidebar glass">
        <div class="super-brand"><span>N</span><div><strong>NOVA</strong><small>SYSTEM ADMIN</small></div></div>
        <div class="super-account"><div class="super-avatar">N</div><div><b>SUPER ADMIN</b><small>Nova System</small></div></div>
        <nav>
          <button class="super-nav active" onclick="superSection('overview',this)">◈ <span>概要</span></button>
          <button class="super-nav" onclick="superSection('users',this)">♙ <span>ユーザー管理</span></button>
          <button class="super-nav" onclick="superSection('permissions',this)">♜ <span>権限管理</span></button>
          <button class="super-nav" onclick="superSection('elections',this)">◇ <span>管理者選出</span></button>
          <button class="super-nav" onclick="superSection('schools',this)">▦ <span>学校管理</span></button>
          <button class="super-nav" onclick="superSection('content',this)">▤ <span>コンテンツ管理</span></button>
          <button class="super-nav" onclick="superSection('safety',this)">⚠ <span>通報・安全管理</span></button>
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
function hasRoleForAdminUI(u,role){return u?.role===role||Array.isArray(u?.adminRoles)&&u.adminRoles.includes(role)}
async function superBan(id){
  const reason=prompt('BAN理由を入力してください（任意）','Novaの利用規約違反');
  if(reason===null)return;
  if(!confirm('このアカウントを利用停止にしますか？'))return;
  try{await api('/api/super/users/'+id+'/ban',{method:'POST',body:JSON.stringify({reason})});toast('アカウントをBANしました');return renderSuperAdmin()}catch(x){toast(x.message)}
}
async function superRolePrompt(id){
  const state=window.NOVA_SUPER_STATE||{}; const u=(state.users||[]).find(x=>x.id===id); if(!u)return;
  const current=[...(u.adminRoles||[]),u.role||'STUDENT']; const roles=['CLASS_ADMIN','GRADE_ADMIN','SCHOOL_ADMIN','SUPER_ADMIN'];
  const overlay=document.createElement('div'); overlay.className='nova-role-modal';
  overlay.innerHTML='<div class="nova-role-modal-bg"></div><div class="nova-role-modal-card glass"><div class="eyebrow">PERMISSION CONTROL</div><h3>権限を変更</h3><p>'+esc(u.displayName)+' の権限を選択してください。</p><div class="nova-role-options">'+roles.map(r=>'<label><input type="checkbox" value="'+r+'" '+(current.includes(r)?'checked':'')+'><span>'+r+'</span></label>').join('')+'</div><div class="nova-role-actions"><button class="btn alt" id="roleCancel">キャンセル</button><button class="btn primary-btn" id="roleSave">保存</button></div></div>';
  document.body.append(overlay); const close=()=>overlay.remove(); overlay.querySelector('.nova-role-modal-bg').onclick=close; overlay.querySelector('#roleCancel').onclick=close;
  overlay.querySelector('#roleSave').onclick=async()=>{const selected=[...overlay.querySelectorAll('input:checked')].map(x=>x.value); if(u.id===me?.id&&!selected.includes('SUPER_ADMIN'))return toast('自分のSUPER ADMIN権限は剥奪できません'); try{await api('/api/super/users/'+encodeURIComponent(id)+'/roles',{method:'POST',body:JSON.stringify({roles:selected})});close();toast('権限を更新しました');await renderSuperAdmin()}catch(x){toast(x.message)}};
}
async function superUnban(id){
  if(!confirm('このアカウントのBANを解除しますか？'))return;
  try{await api('/api/super/users/'+id+'/unban',{method:'POST'});toast('BANを解除しました');return renderSuperAdmin()}catch(x){toast(x.message)}
}
function superSection(section,btn){
  document.querySelectorAll('.super-nav').forEach(x=>x.classList.remove('active'));
  if(btn)btn.classList.add('active');
  const state=window.NOVA_SUPER_STATE||{};
  const users=state.users||[],schools=state.schools||[];
  const titles={overview:'管理者ダッシュボード',users:'ユーザー管理',permissions:'権限管理',elections:'管理者選出',schools:'学校管理',content:'コンテンツ管理',safety:'通報・安全管理',system:'システム'};
  const title=$('#superTitle');if(title)title.textContent=titles[section]||titles.overview;
  const c=$('#superContent');if(!c)return;
  if(section==='overview'){
    c.innerHTML=`
      <div class="super-welcome glass"><div><span class="super-kicker">NOVA SYSTEM</span><h2>Nova全体を管理します。</h2><p>学校・ユーザー・管理者・サービスデータを一元管理するSUPER ADMIN専用画面です。</p></div><div class="system-badge"><i></i> SYSTEM ONLINE</div></div>
      <div class="super-stats">
        <div class="super-stat glass"><small>USERS</small><strong>${users.length}</strong><span>登録ユーザー</span></div>
        <div class="super-stat glass"><small>SCHOOLS</small><strong>${schools.length}</strong><span>登録学校</span></div>
        <div class="super-stat glass"><small>ADMINS</small><strong>${users.filter(u=>(u.role&&u.role!=='STUDENT')||(Array.isArray(u.adminRoles)&&u.adminRoles.length)).length}</strong><span>管理者</span></div>
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
    c.innerHTML=`<section class="glass super-card"><div class="super-card-head"><div><small>USER DIRECTORY</small><h3>全ユーザー</h3></div><span class="super-count" id="superUserCount">${users.length} USERS</span></div><div class="super-user-tools"><input id="superUserSearch" class="input" placeholder="名前・学校名・学年・クラス・出席番号で検索" autocomplete="off"><select id="superUserStatus" class="input"><option value="all">すべて</option><option value="active">ACTIVE</option><option value="banned">BAN</option></select></div><div class="super-table-wrap"><table class="super-table"><thead><tr><th>ユーザー</th><th>学校</th><th>所属</th><th>権限</th><th>状態</th><th>操作</th></tr></thead><tbody id="superUserRows">${users.map(u=>`<tr data-user-search="${esc([u.displayName,u.schoolName,u.grade,u.className,u.attendanceNo,u.role,...(Array.isArray(u.adminRoles)?u.adminRoles:[])].join(' ')).toLowerCase()}" data-user-status="${u.banned?'banned':'active'}"><td><div class="table-user"><div class="super-mini-avatar">${u.icon?'<img src="'+esc(u.icon)+'">':'N'}</div><b>${esc(u.displayName)}</b></div></td><td>${esc(u.schoolName)}</td><td>${esc(u.grade)}年 ${esc(u.className)}組 / ${esc(u.attendanceNo)}</td><td><span class="role-pill ${esc(String(u.role||'STUDENT').toLowerCase())}">${esc([u.role||'STUDENT',...(Array.isArray(u.adminRoles)?u.adminRoles:[])].filter((v,i,a)=>a.indexOf(v)===i).join(' / '))}</span></td><td><span class="status-pill ${u.banned?'banned':'active'}">${u.banned?'BAN':'ACTIVE'}</span></td><td><button class="ban-btn" onclick="superRolePrompt(${JSON.stringify(u.id)})">権限変更</button> ${hasRoleForAdminUI(u,'SUPER_ADMIN')?'<span class="protected-label">保護</span>':u.banned?`<button class="ban-btn unban" onclick="superUnban(${JSON.stringify(u.id)})">BAN解除</button>`:`<button class="ban-btn" onclick="superBan(${JSON.stringify(u.id)})">アカウントBAN</button>`}</td></tr>`).join('')}</tbody></table></div></section>`;
    const applyUserFilter=()=>{const q=String($('#superUserSearch')?.value||'').trim().toLowerCase();const status=$('#superUserStatus')?.value||'all';let visible=0;document.querySelectorAll('#superUserRows tr').forEach(r=>{const ok=(!q||String(r.dataset.userSearch||'').includes(q))&&(status==='all'||r.dataset.userStatus===status);r.style.display=ok?'':'none';if(ok)visible++});const count=$('#superUserCount');if(count)count.textContent=visible+' / '+users.length+' USERS'};$('#superUserSearch')?.addEventListener('input',applyUserFilter);$('#superUserStatus')?.addEventListener('change',applyUserFilter);applyUserFilter();
  }else if(section==='permissions'){
    const admins=users.filter(u=>(u.role&&u.role!=='STUDENT')||(Array.isArray(u.adminRoles)&&u.adminRoles.length));
    const counts=['SUPER_ADMIN','SCHOOL_ADMIN','GRADE_ADMIN','CLASS_ADMIN'].map(r=>({r,n:admins.filter(u=>u.role===r||(Array.isArray(u.adminRoles)&&u.adminRoles.includes(r))).length}));
    c.innerHTML=`<div class="super-grid">
      <section class="glass super-card span4"><div class="super-card-head"><div><small>PERMISSION CONTROL</small><h3>権限管理</h3></div><span class="super-count">${admins.length} ADMINS</span></div>
        ${counts.map(x=>`<div class="role-row"><b>${x.r}</b><span>${x.n}</span></div>`).join('')}
        <p class="system-copy">ユーザーごとに複数の管理権限を設定できます。権限の付与・変更・剥奪はユーザー一覧から行います。</p>
      </section>
      <section class="glass super-card span4"><div class="super-card-head"><div><small>ADMIN SCOPE</small><h3>管理範囲</h3></div></div>
        <div class="permission-note"><b>CLASS_ADMIN</b><p>所属する学校・学年・クラスを管理。</p></div>
        <div class="permission-note"><b>GRADE_ADMIN</b><p>所属する学校・学年を管理。</p></div>
        <div class="permission-note"><b>SCHOOL_ADMIN</b><p>所属する学校全体を管理。</p></div>
        <div class="permission-note"><b>SUPER_ADMIN</b><p>Nova全体を管理。</p></div>
      </section>
    </div>`;
  }else if(section==='elections'){
    const elections=state.elections||[];
    c.innerHTML=`<div class="super-grid">
      <section class="glass super-card span4"><div class="super-card-head"><div><small>ELECTIONS</small><h3>管理者選出</h3></div><span class="super-count">${elections.length} RECORDS</span></div>
        <div class="permission-note"><b>CLASS_ADMIN</b><p>クラス内の生徒を対象に選出。</p></div>
        <div class="permission-note"><b>GRADE_ADMIN</b><p>学年内のCLASS_ADMINを対象に選出。</p></div>
        <div class="permission-note"><b>SCHOOL_ADMIN</b><p>学校内のGRADE_ADMINを対象に選出。</p></div>
        <p class="system-copy">投票は24時間。自分自身への投票は不可。過半数到達、または最多得票で決定し、同率1位は全員が選出されます。</p>
      </section>
      <section class="glass super-card span4"><div class="super-card-head"><div><small>REELECTION</small><h3>再選・欠員</h3></div></div>
        <div class="permission-note"><b>再選要求</b><p>一般ユーザーの30%以上の要求で再選を開始。</p></div>
        <div class="permission-note"><b>管理者離脱</b><p>管理者が離脱・権限剥奪された場合は必要な再選を自動開始。</p></div>
      </section>
    </div>`;
  }else if(section==='content'){
    c.innerHTML=`<div class="super-grid">
      <section class="glass super-card span4"><div class="super-card-head"><div><small>CONTENT</small><h3>コンテンツ管理</h3></div></div>
        <div class="data-grid">
          <div><b>${(state.posts||[]).length}</b><span>掲示板投稿</span></div>
          <div><b>${(state.events||[]).length}</b><span>行事</span></div>
          <div><b>${(state.tasks||[]).length}</b><span>課題</span></div>
          <div><b>${(state.schedules||[]).length}</b><span>時間割</span></div>
        </div>
        <p class="system-copy">実際の編集操作は、対象となるクラス・学年・学校の管理画面から行います。</p>
      </section>
      <section class="glass super-card span4"><div class="super-card-head"><div><small>LEARNING</small><h3>学習コンテンツ</h3></div></div>
        <div class="permission-note"><b>単語帳</b><p>ターゲット1200・ターゲット1900・鉄壁・いろはにほへと古文単語。</p></div>
        <div class="permission-note"><b>学習機能</b><p>4択・入力・フラッシュカード・リスニング・ディクテーションなど。</p></div>
      </section>
    </div>`;
  }else if(section==='safety'){
    const banned=users.filter(u=>u.banned);
    c.innerHTML=`<div class="super-grid">
      <section class="glass super-card span4"><div class="super-card-head"><div><small>SAFETY</small><h3>通報・安全管理</h3></div><span class="super-count">${banned.length} BANNED</span></div>
        <div class="permission-note"><b>アカウント停止</b><p>規約違反などが確認されたアカウントを停止・解除できます。</p></div>
        <div class="permission-note"><b>クラスからの退出</b><p>不正な所属や荒らしなど、クラス管理上の問題に対応します。</p></div>
        <div class="permission-note"><b>上位管理者への報告</b><p>CLASS_ADMINで対応できない問題はGRADE_ADMIN、SCHOOL_ADMINへエスカレーションします。</p></div>
      </section>
      <section class="glass super-card span4"><div class="super-card-head"><div><small>BANNED USERS</small><h3>利用停止中のユーザー</h3></div></div>
        ${banned.slice(0,20).map(u=>`<div class="super-user-row"><div class="super-mini-avatar">${u.icon?'<img src="'+esc(u.icon)+'">':'N'}</div><div><b>${esc(u.displayName)}</b><small>${esc(u.schoolName)} · ${esc(u.banReason||'理由未設定')}</small></div><button class="ban-btn unban" onclick="superUnban(${JSON.stringify(u.id)})">BAN解除</button></div>`).join('')||'<div class="super-empty">利用停止中のユーザーはいません</div>'}
      </section>
    </div>`;
  }else if(section==='schools'){
    c.innerHTML=`<section class="glass super-card"><div class="super-card-head"><div><small>SCHOOL DIRECTORY</small><h3>登録学校</h3></div><span class="super-count">${schools.length} SCHOOLS</span></div><div class="school-admin-grid">${schools.map(s=>{const n=users.filter(u=>u.schoolId===s.id).length;return `<div class="school-admin-card"><div class="school-mark">N</div><div><b>${esc(s.name)}</b><span>${n} users</span></div><i>›</i></div>`}).join('')||'<div class="super-empty">登録学校はありません</div>'}</div></section>`;
  }else if(section==='admins'){
    const admins=users.filter(u=>(u.role&&u.role!=='STUDENT')||(Array.isArray(u.adminRoles)&&u.adminRoles.length));
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
  const [tasks,notes,schedule,changes]=await Promise.all([api('/api/tasks').catch(()=>[]),api('/api/notifications').catch(()=>[]),api('/api/schedule').catch(()=>[]),api('/api/schedule/changes').catch(()=>[])]);
  const now=new Date();
  const selected=new Date(homeSelectedDate);
  const isToday=selected.toDateString()===now.toDateString();
  const dateText=selected.toLocaleDateString('ja-JP',{month:'long',day:'numeric'});
  const weekday=selected.toLocaleDateString('ja-JP',{weekday:'long'});
  const unfinished=tasks.filter(t=>!t.completed).slice(0,4);
  const unreadChats=homeNotificationItems(notes).filter(n=>['message','class_message','group_message','reply'].includes(n.type)).slice(0,4);
  const notices=homeNotificationItems(notes).filter(n=>!['message','class_message','group_message','reply'].includes(n.type)).slice(0,4);
  const dateKey=selected.getFullYear()+'-'+String(selected.getMonth()+1).padStart(2,'0')+'-'+String(selected.getDate()).padStart(2,'0');
  const daySchedule=[];
  for(const x of schedule){
    const ch=(changes||[]).find(c=>c.date===dateKey&&c.scheduleId===x.id);
    if(ch?.type==='cancel')continue;
    const item={...x};
    if(ch?.type==='subject')item.subject=ch.subject||item.subject;
    if(ch?.type==='period')item.period=ch.period||item.period;
    if(ch?.type==='room')item.room=ch.room||item.room;
    if(ch?.type==='temporary'){item.subject=ch.subject||item.subject;item.period=ch.period||item.period;item.room=ch.room||item.room;}
    if(scheduleMatchesDay(item,selected))daySchedule.push(item);
  }
  (changes||[]).filter(c=>c.date===dateKey&&c.type==='temporary'&&!c.scheduleId).forEach(c=>daySchedule.push({id:c.id,period:c.period||'',subject:c.subject||'臨時授業',room:c.room||'',day:homeDayKey(selected)}));
  daySchedule.sort((a,b)=>Number(a.period||0)-Number(b.period||0));
  const scheduleHtml=daySchedule.map(x=>`<div class="home-schedule-row"><span class="period">${esc(x.period)}限</span><div><b>${esc(x.subject||'授業')}</b><small>${esc(x.room||'')}</small></div></div>`).join('')||'<div class="home-empty">この日の時間割は未登録です</div>';
  const taskHtml=unfinished.map(t=>`<button class="home-task-row" onclick="go('schedule')"><span class="task-dot"></span><div><b>${esc(t.title||'課題')}</b><small>${esc(t.subject||'課題')} · ${homeFormatTaskDate(t)}</small></div><span>›</span></button>`).join('')||'<div class="home-empty">未完了の課題はありません</div>';
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
        <div class="compact-card-head"><div><span class="card-icon">□</span><div><b>終わってない課題</b><small>${unfinished.length}件</small></div></div><button class="mini-link" onclick="go('schedule')">一覧 ›</button></div>
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
  if(hasClientRole('CLASS_ADMIN')||hasClientRole('GRADE_ADMIN')||hasClientRole('SCHOOL_ADMIN'))rooms.push({id:'classadmin',title:'CLASS ADMIN',sub:'管理者トーク',icon:'A'});
  if(hasClientRole('GRADE_ADMIN')||hasClientRole('SCHOOL_ADMIN'))rooms.push({id:'gradeadmin',title:me.grade+'年 GRADE ADMIN',sub:'学年管理者',icon:'G'});
  if(!friends.length){try{friends=await api('/api/friends')}catch(e){friends=[];console.warn('friends load failed',e)}}
  let groups=[];try{groups=await api('/api/groups')}catch(e){groups=[];console.warn('groups load failed',e)}
  if(chatRoom==='school')chatRoom='class';
  if(!rooms.some(r=>r.id===chatRoom)&&!chatRoom.startsWith('group:')&&chatRoom!=='friend')chatRoom='class';
  const selectedFriend=chatRoom==='friend'&&chatTarget?friends.find(x=>x.id===chatTarget):null;
  const selectedGroup=chatRoom.startsWith('group:')?groups.find(x=>x.id===chatRoom.slice(6)):null;
  const room=rooms.find(r=>r.id===chatRoom);
  const mobileChatOpen=!!(selectedFriend||selectedGroup||room);
  const title=selectedFriend?.displayName||selectedGroup?.name||room?.title||'トーク';
  const sub=selectedFriend?'個人トーク':selectedGroup?(selectedGroup.memberIds.length+'人のグループ'):room?.sub||'';
  let boxHtml=''; try{boxHtml=chatRoom==='friend'&&chatTarget?await chatHtml(chatTarget):await groupChatHtml(chatRoom)}catch(e){boxHtml='<div class="chat-empty-state"><b>トークを読み込めませんでした</b><small>'+esc(e.message||'通信エラー')+'</small></div>'}
  const canCompose=!!(chatRoom==='friend'&&chatTarget)||rooms.some(r=>r.id===chatRoom)||!!selectedGroup;
  const roomButton=r=>'<button class="line-room '+(chatRoom===r.id?'on':'')+'" onclick="selectChatRoom(\''+r.id+'\')"><span class="line-avatar">'+r.icon+'</span><span class="line-room-copy"><b>'+esc(r.title)+'</b><small>'+esc(r.sub)+'</small></span></button>';
  const groupButton=g=>'<button class="line-room '+(chatRoom==='group:'+g.id?'on':'')+'" onclick="selectChatRoom(\'group:'+g.id+'\')"><span class="line-avatar">G</span><span class="line-room-copy"><b>'+esc(g.name)+'</b><small>'+g.memberIds.length+'人</small></span></button>';
  const friendButton=f=>'<button class="line-room '+(chatRoom==='friend'&&chatTarget===f.id?'on':'')+'" onclick="openChat(\''+f.id+'\')">'+avatarHtml(f)+'<span class="line-room-copy"><b>'+esc(f.displayName)+'</b><small>個人チャット</small></span></button>';
  m.innerHTML='<div class="line-chat"><aside class="line-chat-list glass '+(mobileChatOpen?'mobile-hide':'')+'"><div class="line-list-head"><div><div class="eyebrow">NOVA</div><h2>トーク</h2></div><button class="line-new" onclick="createGroup()">＋</button></div><div class="line-search"><input class="input" placeholder="トーク・友達を検索" oninput="filterChatList(this.value)"></div><div id="lineRoomList"><div class="line-label">学校</div>'+rooms.map(roomButton).join('')+'<div class="line-label">グループ</div>'+(groups.map(groupButton).join('')||'<div class="line-empty">グループはありません</div>')+'<div class="line-label">友達</div>'+(friends.map(friendButton).join('')||'<div class="line-empty">友達を追加するとここに表示されます</div>')+'</div></aside><section class="line-chat-main glass '+(mobileChatOpen?'mobile-show':'')+'"><header class="line-header"><button class="line-back" onclick="closeMobileChat()">‹</button><div class="line-header-avatar">'+(selectedFriend?avatarHtml(selectedFriend):'<span class="line-avatar">'+(selectedGroup?'G':room?.icon||'C')+'</span>')+'</div><div class="line-header-name"><b>'+esc(title)+'</b><small>'+esc(sub)+'</small></div>'+'<div class="line-call">'+((chatRoom==='classadmin'||chatRoom==='gradeadmin')?'<button class="line-call-btn" title="管理者選出" onclick="startElectionPrompt(\''+chatRoom+'\')">投票</button>':'')+((selectedFriend||selectedGroup||room)?'<button class="line-call-btn" title="音声通話" onclick="startCall(\'audio\')">☎</button><button class="line-call-btn video" title="ビデオ通話" onclick="startCall(\'video\')">▣</button>':'')+'</div>'+'</header><div id="chatbox" class="line-messages">'+boxHtml+'</div>'+(canCompose?'<div id="replyPreview" class="chat-reply-preview hidden"></div><form class="line-compose" onsubmit="sendCurrentChat(event)"><label class="line-attach">＋<input type="file" accept="image/*" hidden onchange="sendImageFile(event)"></label><input id="chatText" class="line-input" name="text" placeholder="メッセージ" autocomplete="off"><button class="line-send" type="submit">➤</button></form>':'<div class="line-readonly">このトークにはメッセージを送信できません。</div>')+'</section></div>';
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
async function startElectionPrompt(room){
  let type='';
  if(room==='classadmin'){
    type='CLASS_ADMIN';
  }else if(room==='gradeadmin'){
    if(!(hasClientRole('GRADE_ADMIN')||hasClientRole('SCHOOL_ADMIN')||hasClientRole('SUPER_ADMIN'))){
      toast('学年管理者権限が必要です');
      return;
    }
    const choice=prompt('開始する選挙を入力してください：GRADE_ADMIN / SCHOOL_ADMIN','GRADE_ADMIN');
    if(choice===null)return;
    type=choice.trim().toUpperCase();
    if(!['GRADE_ADMIN','SCHOOL_ADMIN'].includes(type)){
      toast('選挙種別が不正です');
      return;
    }
  }else{
    return;
  }
  let candidates=[];
  try{
    candidates=await api('/api/elections/candidates?type='+encodeURIComponent(type));
  }catch(e){
    toast(e.message);
    return;
  }
  if(!candidates.length){
    toast('候補者がいません');
    return;
  }
  const lines=candidates.map((u,i)=>(i+1)+': '+u.displayName).join('\\n');
  const raw=prompt((type==='CLASS_ADMIN'?'CLASS ADMIN':type==='GRADE_ADMIN'?'GRADE ADMIN':'SCHOOL ADMIN')+'候補者の番号をカンマ区切りで入力してください。\\n\\n'+lines);
  if(!raw?.trim())return;
  const ids=[...new Set(raw.split(',').map(x=>Number(x.trim())-1).filter(i=>Number.isInteger(i)&&i>=0&&i<candidates.length).map(i=>candidates[i].id))];
  if(!ids.length){
    toast('候補者を1人以上選択してください');
    return;
  }
  try{
    await api('/api/elections',{method:'POST',body:JSON.stringify({type,candidateIds:ids})});
    toast('投票を開始しました');
    await render(true);
  }catch(e){
    toast(e.message);
  }
}
async function selectChatRoom(room){chatRoom=room;chatTarget=null;await render(true)}
async function closeMobileChat(){chatTarget=null;chatRoom='';await render(true)}
async function groupChatHtml(room,fallbackMessage=null){
  let data;
  if(room==='class'){
    data=await api('/api/talks/class');
  }else if(room.startsWith('group:')){
    data=await api('/api/groups/'+encodeURIComponent(room.slice(6)));
  }else{
    data=await api('/api/talks/'+encodeURIComponent(room));
  }
  const messages=Array.isArray(data?.messages)?[...data.messages]:[];if(fallbackMessage&&fallbackMessage.id&&!messages.some(x=>x.id===fallbackMessage.id))messages.push(fallbackMessage);
  try{if(room==='friend'&&chatTarget)await api('/api/chats/'+encodeURIComponent(chatTarget)+'/read',{method:'POST'});else if(room==='class'||room==='classadmin'||room==='gradeadmin')await api('/api/talks/'+encodeURIComponent(room)+'/read',{method:'POST'});else if(room.startsWith('group:'))await api('/api/groups/'+encodeURIComponent(room.slice(6))+'/read',{method:'POST'})}catch{}
  let html=messages.map(x=>messageBubble(x)).join('')||'<div class="chat-empty-state"><span>○</span><b>まだメッセージはありません</b><small>最初のメッセージを送ってみましょう。</small></div>';
  if(room==='classadmin'||room==='gradeadmin'){
    try{
      const elections=await api('/api/elections');
      const active=elections.filter(e=>e.status==='OPEN'&&e.endsAt>Date.now());
      if(active.length){
        const panel=active.map(e=>{
          const title=e.type==='CLASS_ADMIN'?'CLASS ADMIN選挙':'GRADE ADMIN選挙';
          const buttons=(e.candidates||[]).map(c=>{
            const disabled=e.voted?'disabled':'';
            const label=esc(c.name)+(e.voted?'':'に投票');
            return '<button '+disabled+' onclick="voteElection('+JSON.stringify(e.id)+','+JSON.stringify(c.id)+')">'+label+'</button>';
          }).join('');
          return '<div class="election-card"><small>'+title+'</small><b>管理者を選出</b><div class="election-options">'+buttons+'</div><span>'+(e.voted?'投票済み':'投票受付中')+'</span></div>';
        }).join('');
        html='<div class="election-panel glass">'+panel+'</div>'+html;
      }
    }catch{}
  }
  return html;
}
async function voteElection(electionId,candidateId){try{await api('/api/elections/'+electionId+'/vote',{method:'POST',body:JSON.stringify({candidateId})});toast('投票しました');await render(true)}catch(e){toast(e.message)}}
async function openChat(id2){chatRoom='friend';chatTarget=id2;await render(true)}
function messageBubble(x){
  const mine=x.from===me.id;
  const read=mine&&Array.isArray(x.readBy)&&x.readBy.some(id=>id!==me.id);
  const reply=x.replyTo?'<div class="message-reply"><span>返信</span>'+esc(x.replyTo.text||'メッセージ')+'</div>':'';
  if(x.deleted)return '<div class="bubble-row '+(mine?'mine':'')+'"><div class="bubble '+(mine?'mine':'')+' deleted"><div class="message-meta"><b>'+ (mine?'あなた':esc(x.fromName||'メンバー')) +'</b><span>'+new Date(x.createdAt).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'})+'</span></div><div class="deleted-message">このメッセージは削除されました</div></div></div>';
  const image=x.image?'<img class="chat-image" src="'+esc(x.image)+'" onclick="openImage('+JSON.stringify(x.image)+')">':'';
  const text=x.text?'<div class="bubble-text">'+esc(x.text)+'</div>':'';
  const readLabel=mine?'<span class="read-status">'+(read?'既読':'未読')+'</span>':'';
  const deleteButton=mine?'<button type="button" onclick="deleteChatMessage('+JSON.stringify(x.id)+')">削除</button>':'';
  return '<div class="bubble-row '+(mine?'mine':'')+'" data-message-id="'+esc(String(x.id||''))+'"><div class="bubble '+(mine?'mine':'')+'"><div class="message-meta"><b>'+(mine?'あなた':esc(x.fromName||'メンバー'))+'</b><span>'+new Date(x.createdAt).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'})+'</span>'+readLabel+'</div>'+reply+image+text+'<div class="message-actions"><button type="button" onclick="replyMessage('+JSON.stringify(JSON.stringify({id:x.id,text:x.text||'画像'}))+')">↩ 返信</button>'+deleteButton+'</div></div></div>';
}
async function deleteChatMessage(id2){
  if(!confirm('このメッセージを削除しますか？'))return;
  try{
    await api('/api/messages/'+encodeURIComponent(id2)+'/delete',{method:'POST'});
    const box=$('#chatbox');
    if(box)box.innerHTML=chatRoom==='friend'&&chatTarget?await chatHtml(chatTarget):await groupChatHtml(chatRoom,sent);
  }catch(e){toast(e.message)}
}
function replyMessage(raw){try{window.novaReply=JSON.parse(raw)}catch{window.novaReply=null}const p=$('#replyPreview');if(p){p.textContent=window.novaReply?'返信: '+window.novaReply.text:'';p.classList.toggle('hidden',!window.novaReply)}}
function sendImageFile(e){const f=e.target.files?.[0];e.target.value='';if(!f)return;if(!f.type.startsWith('image/'))return toast('画像を選択してください');if(f.size>4*1024*1024)return toast('画像は4MB以下です');const r=new FileReader();r.onload=()=>sendCurrentChat(null,{image:r.result});r.readAsDataURL(f)}
function wsConnect(){if(!me||window.novaWs?.readyState===WebSocket.OPEN)return;try{const p=location.protocol==='https:'?'wss':'ws';window.novaWs=new WebSocket(p+'://'+location.host+'/ws?token='+encodeURIComponent(localStorage.novaToken||''));window.novaWs.onmessage=e=>{try{const x=JSON.parse(e.data);if(x.type==='call_signal'){handleCallSignal(x);return}if(view==='chat'&&(x.type==='message'||x.type==='group_message'||x.type==='class_message')){const box=$('#chatbox');if(box&&x.message&&!box.querySelector('[data-message-id="'+CSS.escape(String(x.message.id))+'"]')){const empty=box.querySelector('.chat-empty-state');if(empty)box.innerHTML=messageBubble(x.message);else if(!box.querySelector('[data-message-id="'+CSS.escape(String(x.message.id))+'"]'))box.insertAdjacentHTML('beforeend',messageBubble(x.message));box.scrollTop=box.scrollHeight}else{chat($('#main'))}}}catch{}};window.novaWs.onclose=()=>{window.novaWs=null;setTimeout(()=>me&&wsConnect(),2000)}}catch{}}
function sendSignal(x){if(window.novaWs?.readyState===WebSocket.OPEN)window.novaWs.send(JSON.stringify(x))}
let novaPeers={},novaStream=null,novaTargets=[],novaMode=null,novaRoomKey=null,novaCallId=null;
function callScope(){
  if(chatRoom==='friend')return {scope:'friend',ids:chatTarget?[chatTarget]:[]};
  if(chatRoom==='school'||chatRoom==='class'||chatRoom==='classadmin'||chatRoom==='gradeadmin')return {scope:chatRoom,ids:[]};
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
  const input=$('#chatText');
  const text=String(input?.value||((e?.target instanceof HTMLFormElement)?new FormData(e.target).get('text'):'')||'').trim();
  if(!text&&!extra.image&&!extra.sticker)return;
  const body={text,...extra,replyTo:window.novaReply||null};
  try{
    let sent;
    if(chatRoom==='friend'){
      if(!chatTarget)throw new Error('相手を選択してください');
      sent=await api('/api/chats/'+encodeURIComponent(chatTarget),{method:'POST',body:JSON.stringify(body)});
    }else if(chatRoom==='class'){
      sent=await api('/api/talks/class/messages',{method:'POST',body:JSON.stringify(body)});
    }else if(chatRoom.startsWith('group:')){
      sent=await api('/api/groups/'+encodeURIComponent(chatRoom.slice(6))+'/messages',{method:'POST',body:JSON.stringify(body)});
    }else{
      sent=await api('/api/talks/'+encodeURIComponent(chatRoom)+'/messages',{method:'POST',body:JSON.stringify(body)});
    }
    if(input)input.value='';
    window.novaReply=null;
    // サーバー保存後に必ず最新の履歴を再取得する。
    // これにより「送信したのに空のトークのまま」を防ぐ。
    const box=$('#chatbox');
    if(box){
      // 送信成功レスポンスを先に表示して、GET取得失敗でも自分の画面から消えないようにする。
      const sentHtml=messageBubble(sent);
      const empty=box.querySelector('.chat-empty-state');
      if(empty)box.innerHTML=sentHtml;
      else box.insertAdjacentHTML('beforeend',sentHtml);
      box.scrollTop=box.scrollHeight;
      try{
        const html=chatRoom==='friend'&&chatTarget
          ?await chatHtml(chatTarget)
          :await groupChatHtml(chatRoom,sent);
        box.innerHTML=html;
        box.scrollTop=box.scrollHeight;
      }catch(e){
        console.warn('chat refresh failed',e);
      }
    }else{
      await chat($('#main'));
    }
  }catch(x){toast(x?.message||'メッセージを送信できません')}
}
async function chatHtml(id2){
  const ms=await api('/api/chats/'+encodeURIComponent(id2));
  try{await api('/api/chats/'+encodeURIComponent(id2)+'/read',{method:'POST'})}catch{}
  return (Array.isArray(ms)?ms:[]).map(x=>messageBubble(x)).join('')||'<div class="chat-empty-state"><span>○</span><b>まだメッセージはありません</b><small>最初のメッセージを送ってみましょう。</small></div>';
}
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
async function adminPanel(){
  const admins=await api('/api/admins');
  const canSuper=hasClientRole('SUPER_ADMIN');
  const canSchool=hasClientRole('SCHOOL_ADMIN')||canSuper;
  const canManage=canSchool||hasClientRole('GRADE_ADMIN')||hasClientRole('CLASS_ADMIN');
  $('#main').innerHTML=`<div class="grid">
    <section class="glass card span12">
      <div class="h">ADMIN CONTROL</div>
      <p class="sub">現在の権限で実行できる管理機能です。</p>
      <div class="row">
        ${canManage?'<button class="btn alt" onclick="scheduleView(document.getElementById(&quot;main&quot;))">時間割・授業変更</button>':''}
        ${canManage?'<button class="btn alt" onclick="createTaskPrompt()">課題を追加</button>':''}
        ${canSchool?'<button class="btn alt" onclick="createEventPrompt()">学校行事を追加</button>':''}
        ${canSchool?'<button class="btn alt" onclick="settings(document.getElementById(&quot;main&quot;))">学校・生徒管理</button>':''}
        ${canSuper?'<button class="btn alt" onclick="go(\'superadmin\')">SUPER ADMIN画面</button>':''}
      </div>
    </section>
    <section class="glass card span6">
      <div class="h">ADMINISTRATORS</div>
      ${admins.map(a=>`<div class="item row"><div class="avatar">${a.icon?'<img class="avatar" src="'+esc(a.icon)+'">':'N'}</div><div><b>${esc(a.displayName)}</b><div class="sub">${esc([a.role||'STUDENT',...(Array.isArray(a.adminRoles)?a.adminRoles:[])].filter((v,i,x)=>x.indexOf(v)===i).join(' / '))}</div></div></div>`).join('')||'<p class="sub">管理者はいません</p>'}
    </section>
    <section class="glass card span6">
      <div class="h">ELECTION START</div>
      <p class="sub">管理者選挙を開始できます。</p>
      ${hasClientRole('CLASS_ADMIN')||canSchool||hasClientRole('GRADE_ADMIN')?'<button class="btn alt" onclick="startElection(\'CLASS_ADMIN\')">CLASS_ADMIN選挙</button>':''}
      ${hasClientRole('GRADE_ADMIN')||canSchool?'<button class="btn alt" onclick="startElection(\'GRADE_ADMIN\')">GRADE_ADMIN選挙</button>':''}
      ${hasClientRole('GRADE_ADMIN')||canSuper?'<button class="btn alt" onclick="startElection(\'SCHOOL_ADMIN\')">SCHOOL_ADMIN選挙</button>':''}
    </section>
  </div>`;
}
async function startElection(type){const us=await api('/api/users/search?q=');const ids=us.slice(0,5).map(x=>x.id);try{await api('/api/elections',{method:'POST',body:JSON.stringify({type,candidateIds:ids})});toast('選挙を開始しました');school($('#main'))}catch(x){toast(x.message)}}
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
    try{
      const r=await fetch(pth,{cache:'no-store'});
      if(!r.ok)throw new Error('HTTP '+r.status+' / '+pth);
      const text=await r.text();
      entries=parseBook(id2,text);
      if(!entries.length)throw new Error('データを解析できませんでした');
      window.NOVA_BOOKS=window.NOVA_BOOKS||{};
      window.NOVA_BOOKS[id2]=entries;
    }catch(e){
      return toast('単語データを読み込めませんでした: '+(e.message||'不明なエラー'));
    }
  }
  if(!entries.length)return toast('単語データが空です');
  const max=entries.length;
  const seenCount=studyGetSeen(id2).length;
  const wrongCount=studyGetWrong(id2).length;
  let totalStats={answered:0,correct:0};
  try{totalStats={...totalStats,...JSON.parse(localStorage.getItem(studyStatsKey(id2))||'{}')}}catch{}
  const totalAccuracy=totalStats.answered?Math.round(totalStats.correct/totalStats.answered*100):0;
  $('#main').innerHTML=`<div class="study-setup">
    <section class="glass card">
      <div class="study-setup-head"><div><div class="eyebrow">STUDY SETTINGS</div><h2>${esc(name)}</h2></div><button class="btn alt" onclick="study($('#main'))">戻る</button></div>
      <div class="study-book-stats"><div><b>${seenCount}</b><small>出題済み</small></div><div><b>${wrongCount}</b><small>間違い</small></div><div><b>${totalAccuracy}%</b><small>累計正答率</small></div></div>
      <div class="study-form-grid">
        <label><span>範囲</span><div class="study-range-inputs"><input id="studyRangeFrom" class="input" type="number" min="1" max="${max}" value="1"><span>〜</span><input id="studyRangeTo" class="input" type="number" min="1" max="${max}" value="${Math.min(50,max)}"></div></label>
        <label><span>問題数</span><input id="studyCount" class="input" type="number" min="1" max="${max}" value="20"></label>
        <label><span>出題方向</span><select id="studyDirection" class="input"><option value="en-ja">英語 → 日本語</option><option value="ja-en">日本語 → 英語</option><option value="random">ランダム</option><option value="both">両方向</option></select></label>
        <label><span>順番</span><select id="studyOrder" class="input"><option value="number">番号順</option><option value="random">ランダム</option><option value="wrong">間違えたものを優先</option><option value="unseen">未出題を優先</option></select></label>
        <label><span>問題形式</span><select id="studyMode" class="input"><option value="choice">4択</option><option value="choice-hard">4択（紛らわしい選択肢）</option><option value="input">入力</option><option value="flash">フラッシュカード</option><option value="listening">リスニング</option><option value="dictation">書き取り</option></select></label>
        <label class="study-check"><input id="studySpeak" type="checkbox" checked> 読み上げる</label>
      </div>
      <div class="study-range-help">全${max}語。数字の部分だけ変更できます。</div>
      <button class="btn primary-btn study-start" onclick="startStudy('${esc(id2)}')">この設定で学習開始</button>
    </section>
  </div>`
}
function parseStudyRanges(raw,max){
  const out=[];
  const text=String(raw||'').trim();
  if(!text)return out;
  const normalized=text.replace(/[〜～−–—]/g,'-').replace(/[，、]/g,',');
  for(const part of normalized.split(/[,\s]+/).map(x=>x.trim()).filter(Boolean)){
    const m=part.match(/^(\d+)\s*-\s*(\d+)$/);
    if(m){
      let a=Number(m[1]),b=Number(m[2]);
      if(a>b)[a,b]=[b,a];
      a=Math.max(1,a); b=Math.min(max,b);
      for(let n=a;n<=b;n++)out.push(n-1);
    }else if(/^\d+$/.test(part)){
      const n=Number(part);
      if(n>=1&&n<=max)out.push(n-1);
    }
  }
  return [...new Set(out)];
}
function parseBook(id2,t){
  const lines=String(t||'').replace(/^\uFEFF/,'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  if(id2==='irohani'){
    const out=[];
    for(let i=0;i<lines.length;i++){
      const head=lines[i];
      if(head.startsWith('【')||/^\d+/.test(head)||/^[①-⑳]/.test(head))continue;
      let answer='';
      for(let j=i+1;j<Math.min(i+8,lines.length);j++){
        if(lines[j].startsWith('【KEY】')){
          answer=lines[j].replace(/^【KEY】/,'').trim();
          break;
        }
        if(lines[j].startsWith('【')||(!/^[①-⑳]/.test(lines[j])&&j>i+1))break;
      }
      if(answer)out.push({no:out.length+1,q:head,a:answer,type:'jp'});
    }
    return out;
  }
  const out=[];
  for(const line of lines){
    if(/^(英単語|No\.?|\d+\/\d+)$/.test(line))continue;
    let m=line.match(/^(\d+)\s+(.+?)\s{2,}(.+)$/);
    if(!m)m=line.match(/^(\d+)\t(.+?)\t(.+)$/);
    if(!m)m=line.match(/^(\d+)\s+([^\s]+)\s+(.+)$/);
    if(m){
      const no=Number(m[1]);
      if(Number.isFinite(no))out.push({no,q:m[2].trim(),a:m[3].trim(),type:'en'});
    }
  }
  return out;
}
function studyShuffle(a){return [...a].sort(()=>Math.random()-.5)}
function studyWrongKey(id2){return 'novaStudyWrong_'+id2}
function studySeenKey(id2){return 'novaStudySeen_'+id2}
function studyStatsKey(id2){return 'novaStudyStats_'+id2}
function studyGetWrong(id2){try{return JSON.parse(localStorage.getItem(studyWrongKey(id2))||'[]')}catch{return[]}}
function studyGetSeen(id2){try{return JSON.parse(localStorage.getItem(studySeenKey(id2))||'[]')}catch{return[]}}
function studySaveWrong(id2,no){
  const a=studyGetWrong(id2);if(!a.includes(no))a.push(no);localStorage.setItem(studyWrongKey(id2),JSON.stringify(a));
}
function studySaveSeen(id2,no){
  const a=studyGetSeen(id2);if(!a.includes(no))a.push(no);localStorage.setItem(studySeenKey(id2),JSON.stringify(a));
}
function studySaveStat(id2,ok){
  let s={answered:0,correct:0};
  try{s={...s,...JSON.parse(localStorage.getItem(studyStatsKey(id2))||'{}')}}catch{}
  s.answered++;if(ok)s.correct++;
  localStorage.setItem(studyStatsKey(id2),JSON.stringify(s));
}
function studySpeak(text,lang){
  if(!window.speechSynthesis)return;
  window.speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(text);u.lang=lang||'en-US';u.rate=.9;window.speechSynthesis.speak(u);
}
function startStudy(id2){
  const a=window.NOVA_BOOKS?.[id2]||[];
  const from=Math.max(1,Number($('#studyRangeFrom')?.value)||1); const to=Math.min(a.length,Number($('#studyRangeTo')?.value)||from); const range=parseStudyRanges(from+'-'+to,a.length);
  if(!range.length)return toast('範囲を正しく入力してください');
  const byNo=new Map(a.map(x=>[Number(x.no),x]));
  let pool=range.map(i=>byNo.get(i+1)).filter(Boolean);
  if(!pool.length)return toast('指定した範囲の単語が見つかりません');
  const order=$('#studyOrder').value;
  const wrongSet=new Set(studyGetWrong(id2));
  const seenSet=new Set(studyGetSeen(id2));
  if(order==='random')pool=studyShuffle(pool);
  if(order==='wrong')pool=[...pool.filter(x=>wrongSet.has(x.no)),...pool.filter(x=>!wrongSet.has(x.no))];
  if(order==='unseen')pool=[...pool.filter(x=>!seenSet.has(x.no)),...pool.filter(x=>seenSet.has(x.no))];
  let count=Math.min(Math.max(1,Number($('#studyCount').value)||20),pool.length);
  pool=pool.slice(0,count);
  const direction=$('#studyDirection').value,mode=$('#studyMode').value,speak=$('#studySpeak').checked;
  if(mode==='flash')return runFlashStudy(id2,pool,direction,speak);
  window.studySession={id:id2,pool,i:0,correct:0,wrong:[],direction,mode,speak,currentPair:null,answered:false};
  runStudyQuestion();
}
function studyQuestionPair(x,direction,index=0){
  if(direction==='both'){
    return index%2===0?{q:x.q,a:x.a,lang:'en-US'}:{q:x.a,a:x.q,lang:'ja-JP'};
  }
  const dir=direction==='random'?(Math.random()<.5?'en-ja':'ja-en'):direction;
  return dir==='ja-en'?{q:x.a,a:x.q,lang:'ja-JP'}:{q:x.q,a:x.a,lang:'en-US'};
}
function renderStudyFeedback(ok){
  const s=window.studySession;if(!s||!s.currentPair)return;
  const x=s.pool[s.i],p=s.currentPair;
  studySaveSeen(s.id,x.no);studySaveStat(s.id,ok);
  if(ok)s.correct++;else{studySaveWrong(s.id,x.no);s.wrong.push(x)}
  s.answered=true;
  $('#main').innerHTML=`<section class="glass card study-question study-feedback">
    <div class="study-progress">${s.i+1} / ${s.pool.length}</div>
    <div class="study-question-type">${ok?'CORRECT':'INCORRECT'}</div>
    <div class="study-feedback-result ${ok?'correct':'incorrect'}">${ok?'正解！':'不正解'}</div>
    <div class="study-prompt">${esc(p.q)}</div>
    <div class="study-answer-label">正解</div>
    <div class="study-correct-answer">${esc(p.a)}</div>
    ${s.speak?'<button class="btn alt" onclick="studySpeak('+JSON.stringify(p.q)+','+JSON.stringify(p.lang)+')">🔊 もう一度読み上げ</button>':''}
    <button class="btn primary-btn" onclick="nextStudyQuestion()">次の問題</button>
  </section>`;
}
function nextStudyQuestion(){
  const s=window.studySession;if(!s||!s.answered)return;
  s.i++;s.currentPair=null;s.answered=false;runStudyQuestion();
}
function studyChoiceAnswer(value){
  const s=window.studySession;if(!s||s.answered||!s.currentPair)return;
  const ok=String(value)===String(s.currentPair.a);
  renderStudyFeedback(ok);
}
function runStudyQuestion(){
  const s=window.studySession;if(!s||s.i>=s.pool.length)return finishStudy();
  const x=s.pool[s.i],p=studyQuestionPair(x,s.direction,s.i);
  s.currentPair=p;s.answered=false;
  const others=s.pool.filter(y=>y!==x);
  const sameType=others.filter(y=>y.type===x.type);
  const source=(s.mode==='choice-hard'&&sameType.length>=3)?sameType:others;
  let distractors=studyShuffle(source.map(y=>studyQuestionPair(y,s.direction,s.i).a).filter(v=>String(v)!==String(p.a)));
  if(distractors.length<3)distractors=studyShuffle(others.map(y=>studyQuestionPair(y,s.direction,s.i).a).filter(v=>String(v)!==String(p.a)));
  const choices=studyShuffle([p.a,...distractors]).filter((v,i,a)=>a.findIndex(z=>String(z)===String(v))===i).slice(0,4);
  if(!choices.some(v=>String(v)===String(p.a))){
    choices.pop();choices.unshift(p.a);
  }
  if(s.mode==='choice'||s.mode==='choice-hard'){
    $('#main').innerHTML=`<section class="glass card study-question"><div class="study-progress">${s.i+1} / ${s.pool.length}</div><div class="study-question-type">${p.lang==='en-US'?'ENGLISH':'JAPANESE'}</div><div class="study-prompt">${esc(p.q)}</div><div class="study-actions">${s.speak?'<button class="btn alt" onclick="studySpeak('+JSON.stringify(p.q)+','+JSON.stringify(p.lang)+')">🔊 読み上げ</button>':''}</div><div class="study-choices">${choices.map(o=>`<button class="study-choice" onclick="studyChoiceAnswer(decodeURIComponent('${encodeURIComponent(String(o))}'))">${esc(o)}</button>`).join('')}</div></section>`;
    if(s.speak)setTimeout(()=>studySpeak(p.q,p.lang),250);
  }else if(s.mode==='input'||s.mode==='dictation'){
    $('#main').innerHTML=`<section class="glass card study-question"><div class="study-progress">${s.i+1} / ${s.pool.length}</div><div class="study-question-type">${s.mode==='dictation'?'WRITE':'INPUT'}</div><div class="study-prompt">${esc(p.q)}</div>${s.speak?'<button class="btn alt" onclick="studySpeak('+JSON.stringify(p.q)+','+JSON.stringify(p.lang)+')">🔊 読み上げ</button>':''}<input id="studyAnswer" class="input study-answer" autocomplete="off" placeholder="答えを入力" onkeydown="if(event.key==='Enter')answerStudyInput()"><button class="btn primary-btn" onclick="answerStudyInput()">答え合わせ</button></section>`;
    if(s.speak)setTimeout(()=>studySpeak(p.q,p.lang),250);
  }else if(s.mode==='listening'){
    $('#main').innerHTML=`<section class="glass card study-question"><div class="study-progress">${s.i+1} / ${s.pool.length}</div><button class="study-listen" onclick="studySpeak(${JSON.stringify(p.q)},${JSON.stringify(p.lang)})">▶ 音声を再生</button><div class="study-prompt listening-prompt">音声を聞いて答えを選択</div><div class="study-choices">${choices.map(o=>`<button class="study-choice" onclick="studyChoiceAnswer(${JSON.stringify(o)})">${esc(o)}</button>`).join('')}</div></section>`;
    if(s.speak)setTimeout(()=>studySpeak(p.q,p.lang),250);
  }
}
function answerStudyInput(){
  const s=window.studySession;if(!s||s.answered)return;
  const p=s.currentPair;if(!p)return;
  const raw=String($('#studyAnswer')?.value||'').trim().toLowerCase();
  const target=String(p.a||'').trim().toLowerCase();
  const ok=raw===target||target.split(/[，,、]/)[0].trim().toLowerCase()===raw;
  renderStudyFeedback(ok);
}
function runFlashStudy(id2,pool,direction,speak){
  window.flashStudy={id:id2,pool,i:0,direction,speak,show:false,currentPair:null};
  renderFlashStudy();
}
function renderFlashStudy(){
  const s=window.flashStudy;if(!s||s.i>=s.pool.length)return finishStudyFlash();
  const x=s.pool[s.i],p=studyQuestionPair(x,s.direction,s.i);s.currentPair=p;
  $('#main').innerHTML=`<section class="glass card study-question flash-study"><div class="study-progress">${s.i+1} / ${s.pool.length}</div><div class="study-flash-card" onclick="flashStudyReveal()"><span>${s.show?'答え':'問題'}</span><strong>${esc(s.show?p.a:p.q)}</strong><small>${s.show?'タップで次へ':'タップして答えを見る'}</small></div>${s.speak?'<button class="btn alt" onclick="studySpeak('+JSON.stringify(p.q)+','+JSON.stringify(p.lang)+')">🔊 もう一度読み上げ</button>':''}</section>`;
  if(s.speak&&!s.show)setTimeout(()=>studySpeak(p.q,p.lang),250);
}
function flashStudyReveal(){const s=window.flashStudy;if(!s)return;if(!s.show){s.show=true;renderFlashStudy()}else{s.i++;s.show=false;renderFlashStudy()}}
function finishStudy(){
  const s=window.studySession;if(!s)return;
  const acc=Math.round(s.correct/s.pool.length*100);
  $('#main').innerHTML=`<section class="glass card study-result"><div class="eyebrow">STUDY COMPLETE</div><h2>学習終了</h2><div class="study-score"><strong>${s.correct}</strong><span>/ ${s.pool.length}</span></div><p>正答率 ${acc}%</p><div class="study-result-actions"><button class="btn primary-btn" onclick="study($('#main'))">もう一度設定</button><button class="btn alt" onclick="startRetryStudy()">間違えたものをもう一度</button></div><div class="list">${s.wrong.map(x=>`<div class="item"><b>${esc(x.q)}</b><div class="sub">${esc(x.a)}</div></div>`).join('')||'<div class="home-empty">今回の間違いはありません。</div>'}</div></section>`;
}
function startRetryStudy(){const s=window.studySession;if(!s?.wrong.length)return toast('間違えた問題はありません');s.pool=[...s.wrong];s.i=0;s.correct=0;s.wrong=[];s.currentPair=null;s.answered=false;runStudyQuestion()}
function finishStudyFlash(){const s=window.flashStudy;$('#main').innerHTML=`<section class="glass card study-result"><div class="eyebrow">FLASHCARD COMPLETE</div><h2>フラッシュカード終了</h2><p>${s.pool.length}語を確認しました。</p><button class="btn primary-btn" onclick="study($('#main'))">もう一度設定</button></section>`}
async function scheduleView(m){
  const canManage=hasClientRole('SUPER_ADMIN')||hasClientRole('SCHOOL_ADMIN')||hasClientRole('GRADE_ADMIN')||hasClientRole('CLASS_ADMIN');
  const canSchool=hasClientRole('SUPER_ADMIN')||hasClientRole('SCHOOL_ADMIN');
  try{
    const [schedule,events,tasks,changes]=await Promise.all([api('/api/schedule'),api('/api/events'),api('/api/tasks'),api('/api/schedule/changes')]);
    const days=['月','火','水','木','金'];
    const scheduleHtml=days.map(d=>'<div class="schedule-day"><b>'+d+'曜日</b>'+schedule.filter(x=>String(x.day).replace('曜日','')===d).sort((a,b)=>Number(a.period||0)-Number(b.period||0)).map(x=>'<div class="schedule-item"><span>'+esc(x.period)+'限</span><strong>'+esc(x.subject||'授業')+'</strong><small>'+esc(x.room||'')+'</small>'+(canManage?'<div class="schedule-actions"><button onclick="editSchedule('+JSON.stringify(x)+')">編集</button><button onclick="deleteSchedule('+JSON.stringify(x.id)+')">削除</button></div>':'')+'</div>').join('')||'<div class="home-empty">未登録</div>'+'</div>').join('');
    const eventHtml=events.map(e=>'<div class="item"><b>'+esc(e.title)+'</b><div class="sub">'+esc(e.date||'')+(e.place?' · '+esc(e.place):'')+'</div><p>'+esc(e.body||'')+'</p>'+(canSchool?'<button class="ban-btn" onclick="editEvent('+JSON.stringify(e)+')">編集</button> <button class="ban-btn" onclick="deleteEvent('+JSON.stringify(e.id)+')">削除</button>':'')+'</div>').join('')||'<div class="home-empty">予定はありません</div>';
    const taskHtml=tasks.map(t=>'<div class="item"><label style="display:flex;gap:10px;align-items:center"><input type="checkbox" '+(t.completed?'checked':'')+' onchange="toggleTask('+JSON.stringify(t.id)+')"><div><b>'+esc(t.title||'課題')+'</b><div class="sub">'+esc(t.subject||'')+' · '+homeFormatTaskDate(t)+'</div></div></label>'+(canManage?'<div style="margin-top:8px"><button class="ban-btn" onclick="editTask('+JSON.stringify(t)+')">編集</button> <button class="ban-btn" onclick="deleteTask('+JSON.stringify(t.id)+')">削除</button></div>':'')+'</div>').join('')||'<div class="home-empty">課題はありません</div>';
    const changeHtml=(changes||[]).sort((a,b)=>String(a.date).localeCompare(String(b.date))).map(x=>'<div class="item"><b>'+esc(x.date)+' · '+({cancel:'休講',subject:'科目変更',period:'時限変更',room:'教室変更',temporary:'臨時授業'}[x.type]||'授業変更')+'</b><div class="sub">'+esc(x.subject||'')+(x.period?' · '+esc(x.period)+'限':'')+(x.room?' · '+esc(x.room):'')+'</div><p>'+esc(x.note||'')+'</p>'+(canManage?'<button class="ban-btn" onclick="deleteScheduleChange('+JSON.stringify(x.id)+')">取消</button>':'')+'</div>').join('')||'<div class="home-empty">授業変更はありません</div>';
    m.innerHTML='<div class="schedule-page"><section class="glass card"><div class="eyebrow">NOVA SCHEDULE</div><h2>予定・時間割</h2><p class="sub">時間割・学校行事・課題をまとめて確認できます。</p><div class="schedule-week">'+scheduleHtml+'</div></section>'+(canManage?'<section class="glass card schedule-editor"><div class="eyebrow">TEMPORARY CHANGE</div><h3>授業変更</h3><form onsubmit="addScheduleChange(event)" class="schedule-add-form"><input class="input" name="date" type="date" required><select class="input" name="type"><option value="cancel">休講</option><option value="subject">科目変更</option><option value="period">時限変更</option><option value="room">教室変更</option><option value="temporary">臨時授業</option></select><select class="input" name="scheduleId"><option value="">対象の通常授業（臨時授業は空欄）</option>'+schedule.map(x=>'<option value="'+x.id+'">'+esc(x.day)+' '+esc(x.period)+'限 '+esc(x.subject)+'</option>').join('')+'</select><input class="input" name="subject" placeholder="変更後の科目"><input class="input" name="period" placeholder="変更後の時限"><input class="input" name="room" placeholder="変更後の教室"><input class="input" name="note" placeholder="メモ"><button class="btn primary-btn">変更を登録</button></form></section>':'')+'<section class="glass card"><div class="compact-card-head"><b>授業変更一覧</b></div><div class="list">'+changeHtml+'</div></section></div><div class="home-two-col"><section class="glass card"><div class="compact-card-head"><div><b>学校行事</b></div>'+(canSchool?'<button class="mini-link" onclick="createEventPrompt()">＋追加</button>':'')+'</div><div class="list">'+eventHtml+'</div></section><section class="glass card"><div class="compact-card-head"><div><b>課題</b></div>'+(canManage?'<button class="mini-link" onclick="createTaskPrompt()">＋追加</button>':'')+'</div><div class="list">'+taskHtml+'</div></section></div>'+(canManage?'<section class="glass card schedule-editor"><div class="eyebrow">MANAGEMENT</div><h3>時間割を追加</h3><form class="schedule-add-form" onsubmit="addSchedule(event)"><select class="input" name="day"><option>月</option><option>火</option><option>水</option><option>木</option><option>金</option></select><input class="input" name="period" type="number" min="1" max="10" placeholder="限" required><input class="input" name="subject" placeholder="科目" required><input class="input" name="room" placeholder="教室（任意）"><input class="input" name="note" placeholder="メモ（任意）"><button class="btn primary-btn">追加</button></form></section>':'')+'</div>';
  }catch(e){m.innerHTML='<div class="glass card"><h2>予定を読み込めませんでした</h2><p class="sub">'+esc(e.message)+'</p></div>'}
}
async function addScheduleChange(e){e.preventDefault();const f=new FormData(e.target);try{await api('/api/schedule/changes',{method:'POST',body:JSON.stringify({date:f.get('date'),type:f.get('type'),scheduleId:f.get('scheduleId')||null,subject:f.get('subject')||'',period:f.get('period')||'',room:f.get('room')||'',note:f.get('note')||''})});toast('授業変更を登録しました');scheduleView($('#main'))}catch(x){toast(x.message)}}
async function deleteScheduleChange(id2){if(!confirm('この授業変更を取り消しますか？'))return;try{await api('/api/schedule/changes/'+id2,{method:'DELETE'});scheduleView($('#main'))}catch(x){toast(x.message)}}
async function addSchedule(e){e.preventDefault();const f=new FormData(e.target);try{await api('/api/schedule',{method:'POST',body:JSON.stringify({day:f.get('day'),period:f.get('period'),subject:f.get('subject'),room:f.get('room')||'',note:f.get('note')||''})});toast('時間割を追加しました');scheduleView($('#main'))}catch(x){toast(x.message)}}
async function editSchedule(x){const subject=prompt('科目',x.subject||'');if(subject===null)return;const room=prompt('教室',x.room||'');if(room===null)return;const day=prompt('曜日（例：月）',x.day||'月');if(day===null)return;const period=prompt('時限',x.period||'1');if(period===null)return;try{await api('/api/schedule/'+x.id,{method:'PATCH',body:JSON.stringify({day,period,subject,room})});scheduleView($('#main'))}catch(e){toast(e.message)}}
async function deleteSchedule(id2){if(!confirm('この時間割を削除しますか？'))return;try{await api('/api/schedule/'+id2,{method:'DELETE'});scheduleView($('#main'))}catch(e){toast(e.message)}}
async function createEventPrompt(){const title=prompt('行事名');if(!title?.trim())return;const date=prompt('日付（YYYY-MM-DD）');if(!date?.trim())return;const place=prompt('場所（任意）')||'';const body=prompt('内容（任意）')||'';try{await api('/api/events',{method:'POST',body:JSON.stringify({title,date,place,body})});toast('行事を追加しました');scheduleView($('#main'))}catch(e){toast(e.message)}}
async function editEvent(e){const title=prompt('行事名',e.title||'');if(title===null)return;const date=prompt('日付',e.date||'');if(date===null)return;const place=prompt('場所',e.place||'');if(place===null)return;const body=prompt('内容',e.body||'');if(body===null)return;try{await api('/api/events/'+e.id,{method:'PATCH',body:JSON.stringify({title,date,place,body})});scheduleView($('#main'))}catch(x){toast(x.message)}}
async function deleteEvent(id2){if(!confirm('この行事を削除しますか？'))return;try{await api('/api/events/'+id2,{method:'DELETE'});scheduleView($('#main'))}catch(e){toast(e.message)}}
async function createTaskPrompt(){const title=prompt('課題名');if(!title?.trim())return;const subject=prompt('教科（任意）')||'';const dueAt=prompt('期限（YYYY-MM-DD、任意）')||'';const detail=prompt('内容（任意）')||'';try{await api('/api/tasks',{method:'POST',body:JSON.stringify({title,subject,dueAt:dueAt?new Date(dueAt).getTime():null,detail})});toast('課題を追加しました');scheduleView($('#main'))}catch(e){toast(e.message)}}
async function editTask(t){const title=prompt('課題名',t.title||'');if(title===null)return;const subject=prompt('教科',t.subject||'');if(subject===null)return;const due=prompt('期限（YYYY-MM-DD、空欄で解除）',t.dueAt?new Date(t.dueAt).toISOString().slice(0,10):'');if(due===null)return;try{await api('/api/tasks/'+t.id,{method:'PATCH',body:JSON.stringify({title,subject,dueAt:due?new Date(due).getTime():null})});scheduleView($('#main'))}catch(e){toast(e.message)}}
async function deleteTask(id2){if(!confirm('この課題を削除しますか？'))return;try{await api('/api/tasks/'+id2,{method:'DELETE'});scheduleView($('#main'))}catch(e){toast(e.message)}}
async function toggleTask(id2){try{await api('/api/tasks/'+id2+'/complete',{method:'POST'});scheduleView($('#main'))}catch(e){toast(e.message)}}
async function settings(m){
  let schoolUsers=[];
  const canSchool=hasClientRole('SCHOOL_ADMIN')||hasClientRole('SUPER_ADMIN');
  if(canSchool){try{schoolUsers=await api('/api/school/users')}catch{}}
  const schoolManage=canSchool?'<section class="glass card settings-card"><div class="settings-card-title"><b>学校管理</b><span>生徒情報・クラス移動</span></div><div class="list">'+(schoolUsers.length?schoolUsers.map(u=>'<div class="item" style="display:flex;align-items:center;justify-content:space-between;gap:12px"><div><b>'+esc(u.displayName)+'</b><div class="sub">'+esc(u.grade)+'年 '+esc(u.className)+'組 / 出席番号 '+esc(u.attendanceNo)+'</div></div><button class="ban-btn" onclick="moveSchoolUserPrompt('+JSON.stringify(u.id)+')">クラス移動</button></div>').join(''):'<div class="home-empty">生徒はいません</div>')+'</div></section>':'';
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
    ${schoolManage}
  </div>`
}
async function moveSchoolUserPrompt(id){
  const grade=prompt('移動先の学年（1〜3）');if(grade===null)return;
  if(!['1','2','3'].includes(String(grade)))return toast('学年は1〜3です');
  const className=prompt('移動先のクラス');if(className===null)return;
  const attendanceNo=prompt('出席番号（変更しない場合は空欄）');
  try{await api('/api/school/users/'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify({grade,className,attendanceNo:attendanceNo||undefined})});toast('所属を変更しました');settings($('#main'))}catch(x){toast(x.message)}
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
