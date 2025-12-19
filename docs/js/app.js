// TapSpeak Kids Vocab
// Version: v2025-01b

import {
  getState,setCurrentUser,getPoints, ensureUser,
  getSeVolume,setSeVolume,setUserIcon,
  exportCurrentUser, importCurrentUser,
  getPin,setPin, resetPointsCurrent, resetLearningCurrentKeepAvatar
} from "./storage.js";
import { renderWords } from "./words.js";
import { renderReview } from "./review.js";
import { setVolume, playSfx } from "./audio.js";

const root = document.getElementById("app");

function clearRootTheme(){
  root.className = "";
  document.body.className = "";
}

function setReviewTheme(){
  root.className = "review";
  document.body.className = "review";
}

function headerHTML(mode){
  const uid = getState().currentUserId;
  const pts = uid ? getPoints(uid) : 0;

  // mode: words | review | settings
  return `
<header>
  <div class="header-row">
    <button class="iconbtn" id="btnHome" type="button">🏠</button>
    <div id="pointsBox">⭐${pts}</div>
  </div>
  <div class="header-row">
    <div class="tabs">
      <button class="tabbtn ${mode==="words"?"active":""}" id="tabWords" type="button">たんご</button>
      <button class="tabbtn ${mode==="review"?"active":""}" id="tabReview" type="button">ふくしゅう</button>
      <button class="tabbtn ${mode==="settings"?"active":""}" id="tabSettings" type="button">設定</button>
    </div>
    <div class="filters" id="filters"></div>
  </div>
</header>`;
}

function userButtonHTML(id, label, initial){
  const st = getState();
  const u = st.users?.[id];
  const icon = u?.icon;

  const iconHtml = icon
    ? `<span class="usericon"><img src="${icon}" alt=""></span>`
    : `<span class="usericon">${initial}</span>`;

  return `<button class="userbtn" data-u="${id}" type="button">${iconHtml}${label}</button>`;
}

function showHome(){
  clearRootTheme();
  const st = getState();

  root.innerHTML = `
<div class="home-select">
  <h2 class="home-title">えいたんごをおぼえよう！</h2>
  ${userButtonHTML("riona","りおな","R")}
  ${userButtonHTML("soma","そうま","S")}
  ${userButtonHTML("dev","開発者","開")}
  <div class="homerow">
    <button class="bigbtn words" id="goWords" type="button">たんご</button>
    <button class="bigbtn review" id="goReview" type="button">ふくしゅう</button>
  </div>
</div>`;

  root.querySelectorAll(".userbtn").forEach(b=>{
    b.onclick=()=>{
      setCurrentUser(b.dataset.u);
      ensureUser(b.dataset.u);
      showWords();
    };
  });

  root.querySelector("#goWords").onclick = () => {
    if (!st.currentUserId) setCurrentUser("riona");
    showWords();
  };
  root.querySelector("#goReview").onclick = () => {
    if (!st.currentUserId) setCurrentUser("riona");
    showReview();
  };
}

function mountHeader(mode){
  root.innerHTML = headerHTML(mode);
  root.querySelector("#btnHome").onclick = showHome;
  root.querySelector("#tabWords").onclick = showWords;
  root.querySelector("#tabReview").onclick = showReview;
  root.querySelector("#tabSettings").onclick = showSettings;
}

function showWords(){
  clearRootTheme();
  const st = getState();
  if(!st.currentUserId){ showHome(); return; }

  mountHeader("words");

  const screenHost = document.createElement("div");
  root.appendChild(screenHost);

  renderWords(root).catch(()=>{
    screenHost.innerHTML = `<div class="screen"><div class="card">よみこみ に しっぱい しました</div></div>`;
  });
}

function showReview(){
  const st = getState();
  if(!st.currentUserId){ showHome(); return; }

  setReviewTheme();
  mountHeader("review");

  const screenHost = document.createElement("div");
  root.appendChild(screenHost);

  renderReview(root, {
    onPointGained: () => {
      // 左上ポイント即時更新
      const uid = getState().currentUserId;
      const pts = getPoints(uid);
      const box = root.querySelector("#pointsBox");
      if (box) box.textContent = `⭐${pts}`;

      // 0.5秒ポップアップ
      popup("☆1ポイントゲット！！", 500);
    }
  }).catch(()=>{
    screenHost.innerHTML = `<div class="screen"><div class="card">よみこみ に しっぱい しました</div></div>`;
  });
}

function showSettings(){
  clearRootTheme();
  const st = getState();
  if(!st.currentUserId){ showHome(); return; }

  mountHeader("settings");

  // 音量の反映
  setVolume(getSeVolume());

  const screen = document.createElement("div");
  screen.className = "screen";
  screen.innerHTML = `
<div class="card">
  <div class="settingsTitle">設定</div>

  <div class="field">
    <label>効果音音量</label>
    <input id="seVol" type="range" min="0" max="1" step="0.05" value="${getSeVolume()}">
    <div class="small">※ 動かすとすぐ鳴ります。</div>
  </div>

  <div class="field">
    <label>ユーザーアイコン変更</label>
    <input id="iconFile" type="file" accept="image/*">
    <div class="small">※ 端末から選んだ画像を保存します。</div>
  </div>

  <div class="field">
    <label>バックアップ作成（現在ユーザー）</label>
    <button class="btn blue" id="btnBackup" type="button">バックアップを作る</button>
  </div>

  <div class="field">
    <label>バックアップ読込（上書き）</label>
    <input id="restoreFile" type="file" accept="application/json">
  </div>

  <div class="field">
    <label>PIN変更（4桁）</label>
    <input id="pinBox" inputmode="numeric" maxlength="4" placeholder="1234" value="${getPin()}">
    <div class="small">※ ポイントリセット／学習全リセットで使います。</div>
  </div>

  <div class="field">
    <label>ポイントリセット（PIN要）</label>
    <button class="btn ng" id="btnResetPoints" type="button">ポイントをリセット</button>
  </div>

  <div class="field">
    <label>学習全リセット（PIN要・アバター保持）</label>
    <button class="btn ng" id="btnResetAll" type="button">学習をリセット</button>
  </div>
</div>
`;
  root.appendChild(screen);

  // ①音量：動かしたら即鳴る
  const seVol = screen.querySelector("#seVol");
  seVol.oninput = () => {
    const v = Number(seVol.value);
    setSeVolume(v);
    setVolume(v);
    playSfx("speak_start"); // すぐ確認できる音
  };

  // ②アイコン変更
  screen.querySelector("#iconFile").onchange = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const dataUrl = await fileToDataURL(f);
    setUserIcon(getState().currentUserId, dataUrl);
    showHome();
  };

  // ③バックアップ作成
  screen.querySelector("#btnBackup").onclick = () => {
    const obj = exportCurrentUser();
    if (!obj) return;
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type:"application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tapspeak_backup_${obj.user_id}_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ④バックアップ読込（上書き）
  screen.querySelector("#restoreFile").onchange = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    try{
      const obj = JSON.parse(text);
      importCurrentUser(obj);
      popup("よみこみ しました", 600);
    }catch{
      popup("よみこみ に しっぱい しました", 900);
    }
  };

  // ⑤PIN変更
  const pinBox = screen.querySelector("#pinBox");
  pinBox.oninput = () => {
    const v = String(pinBox.value || "").replace(/\D/g,"").slice(0,4);
    pinBox.value = v;
    if (v.length === 4) setPin(v);
  };

  // ⑥ポイントリセット
  screen.querySelector("#btnResetPoints").onclick = () => {
    if (!checkPin()) return;
    resetPointsCurrent();
    popup("ポイント を 0 に しました", 700);
  };

  // ⑦学習全リセット
  screen.querySelector("#btnResetAll").onclick = () => {
    if (!checkPin()) return;
    resetLearningCurrentKeepAvatar();
    popup("がくしゅう を りせっと しました", 700);
  };
}

function checkPin(){
  const pin = prompt("PINを入力（4桁）");
  if (pin === null) return false;
  return String(pin) === getPin();
}

function popup(text, ms){
  const d=document.createElement("div");
  d.className="popup";
  d.textContent=text;
  document.body.appendChild(d);
  setTimeout(()=>d.remove(), ms || 500);
}

async function fileToDataURL(file){
  return new Promise((resolve,reject)=>{
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// 起動
showHome();
