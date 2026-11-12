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
        <label><span>範囲</span><input id="studyRange" class="input" value="1-50" placeholder="例：1-50,101-200" inputmode="text"></label>
        <label><span>問題数</span><input id="studyCount" class="input" type="number" min="1" max="${max}" value="20"></label>
        <label><span>出題方向</span><select id="studyDirection" class="input"><option value="en-ja">英語 → 日本語</option><option value="ja-en">日本語 → 英語</option><option value="random">ランダム</option><option value="both">両方向</option></select></label>
        <label><span>順番</span><select id="studyOrder" class="input"><option value="number">番号順</option><option value="random">ランダム</option><option value="wrong">間違えたものを優先</option><option value="unseen">未出題を優先</option></select></label>
        <label><span>問題形式</span><select id="studyMode" class="input"><option value="choice">4択</option><option value="choice-hard">4択（紛らわしい選択肢）</option><option value="input">入力</option><option value="flash">フラッシュカード</option><option value="listening">リスニング</option><option value="dictation">書き取り</option></select></label>
        <label class="study-check"><input id="studySpeak" type="checkbox" checked> 読み上げる</label>
      </div>
      <div class="study-range-help">全${max}語。複数範囲は「1-50,101-200」のように入力できます。</div>
      <button class="btn primary-btn study-start" onclick="startStudy('${esc(id2)}')">この設定で学習開始</button>
    </section>
  </div>`
}
function parseStudyRanges(raw,max){
  const out=[];
  const text=String(raw||'').trim();
  if(!text)return out;
  const normalized=text.replace(/[〜～−–—]/g,'-').replace(/[，、]/g,',');