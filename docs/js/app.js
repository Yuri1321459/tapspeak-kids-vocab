import { loadWords, buildCategoryIndex, renderWordsScreen } from "./words.js";
import { renderReviewScreen } from "./review.js";
import {
  getDB, getState, setCurrentUser, getUser, listUsers,
  getTodayStr, resetWrongToday, setUserIconDataUrl, getUISettings, setSeVolume
} from "./storage.js";

const app = document.getElementById("app");

let WORDS = [];
let CATIDX = null;

function el(html){
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function clearApp(){
  app.innerHTML = "";
}

function mount(node){
  clearApp();
  app.appendChild(node);
}

function headerFixed({ onHome, onUserSwitch }) {
  const h = el(`
    <div class="headerFixed">
      <div class="headerInner">
        <div class="row between" id="row1"></div>
        <div class="row between" id="row2" style="margin-top:8px"></div>
      </div>
    </div>
  `);

  const row1 = h.querySelector("#row1");
  const row2 = h.querySelector("#row2");

  const left = el(`<button class="iconBtn" type="button" aria-label="home">🏠</button>`);
  left.addEventListener("click", onHome);

  const points = el(`<div class="pill"><span>⭐</span><span id="pointsNum">0</span></div>`);
  const userChip = el(`<button class="userChip" type="button" id="userChip"></button>`);
  userChip.addEventListener("click", onUserSwitch);

  row1.appendChild(el(`<div class="row" style="gap:10px"></div>`));
  row1.firstElementChild.appendChild(left);
  row1.firstElementChild.appendChild(points);
  row1.appendChild(userChip);

  function updateUserChip(){
    const st = getState();
    const u = getUser(st.currentUserId);
    if (!u) { userChip.textContent = ""; return; }
    userChip.textContent = u.name;
    points.querySelector("#pointsNum").textContent = String(u.points ?? 0);
  }

  function setSecondRow({ mode, catDropEl, stageDropEl, onGoHome, onGoReview, onGoWords }) {
    row2.innerHTML = "";

    // 2行目：たんご/ふくしゅう ちょっと離す
    const tabs = el(`<div class="row" style="gap:14px"></div>`);
    const tWords = el(`<button class="tabBtn ${mode==="words"?"active":""}" type="button">たんご</button>`);
    const tReview = el(`<button class="tabBtn ${mode==="review"?"active review":"review"}" type="button">ふくしゅう</button>`);

    tWords.addEventListener("click", () => {
      if (mode === "words") return;
      onGoWords?.();
    });
    tReview.addEventListener("click", () => {
      if (mode === "review") return;
      onGoReview?.();
    });

    tabs.appendChild(tWords);
    tabs.appendChild(tReview);

    // フィルタ列
    const filters = el(`<div class="rowWrap" style="justify-content:flex-end"></div>`);
    if (catDropEl) filters.appendChild(catDropEl);
    if (stageDropEl) filters.appendChild(stageDropEl);

    row2.appendChild(tabs);
    row2.appendChild(filters);
  }

  return { el: h, updateUserChip, setSecondRow };
}

/* ===== 画面 ===== */
function showUserSelect(){
  const users = listUsers().filter(u => ["riona","soma","dev"].includes(u.id));
  const root = el(`
    <div class="userSelect">
      <div class="userGrid" id="grid"></div>
      <div class="devLink"><button type="button" id="devLink">開発者用</button></div>
    </div>
  `);

  const grid = root.querySelector("#grid");

  function makeAvatar(u){
    const av = document.createElement("div");
    av.className = "userAvatar";
    if (u.iconDataUrl) {
      const img = document.createElement("img");
      img.src = u.iconDataUrl;
      img.alt = "";
      av.appendChild(img);
    } else {
      av.textContent = u.initial || "U";
    }
    return av;
  }

  for (const u of users.filter(x => x.id !== "dev")) {
    const b = el(`<button class="userBtn" type="button"></button>`);
    b.appendChild(makeAvatar(u));
    b.appendChild(el(`<div class="userName">${u.name}</div>`));
    b.addEventListener("click", () => {
      setCurrentUser(u.id);
      resetWrongToday(u.id); // 翌日リセット想定（軽く保険）
      showHome();
    });
    grid.appendChild(b);
  }

  // 開発者
  root.querySelector("#devLink").addEventListener("click", () => {
    setCurrentUser("dev");
    showHome();
  });

  mount(root);
}

function showHome(){
  const st = getState();
  const u = getUser(st.currentUserId);
  if (!u) return showUserSelect();

  const header = headerFixed({
    onHome: () => showHome(),
    onUserSwitch: () => showUserSelect(),
  });

  const root = el(`
    <div>
      <div id="headerHost"></div>
      <div class="screen">
        <div class="card">
          <div class="homeBtns">
            <button class="bigBtn blue" id="btnWords" type="button">たんご</button>
            <button class="bigBtn green" id="btnReview" type="button">ふくしゅう：<span id="dueN">0</span>こ</button>
          </div>
          <div style="margin-top:10px;text-align:center">
            <button class="iconBtn" id="btnSettings" type="button">設定</button>
          </div>
        </div>
      </div>
    </div>
  `);

  root.querySelector("#headerHost").appendChild(header.el);
  header.updateUserChip();

  // 2行目はホームでは不要（空）
  header.setSecondRow({ mode:"home" });

  // due数計算
  const today = getTodayStr();
  let dueCount = 0;
  const prog = u.progress || {};
  for (const id of Object.keys(prog)) {
    if (prog[id]?.due && prog[id].due <= today) dueCount++;
  }
  root.querySelector("#dueN").textContent = String(dueCount);

  root.querySelector("#btnWords").addEventListener("click", () => showWords());
  root.querySelector("#btnReview").addEventListener("click", () => showReview());
  root.querySelector("#btnSettings").addEventListener("click", () => showSettings());

  mount(root);
}

function showWords(){
  const st = getState();
  if (!st.currentUserId) return showUserSelect();

  const header = headerFixed({
    onHome: () => showHome(),
    onUserSwitch: () => showUserSelect(),
  });

  const wrapper = el(`<div><div id="headerHost"></div></div>`);
  wrapper.querySelector("#headerHost").appendChild(header.el);
  header.updateUserChip();

  const screen = renderWordsScreen({
    words: WORDS,
    categoryIndex: CATIDX,
    headerHost: header,
    onGoHome: () => showHome(),
    onGoReview: () => showReview(),
  });

  wrapper.appendChild(screen);
  mount(wrapper);
  header.updateUserChip();
}

function showReview(){
  const st = getState();
  if (!st.currentUserId) return showUserSelect();

  const header = headerFixed({
    onHome: () => showHome(),
    onUserSwitch: () => showUserSelect(),
  });

  const wrapper = el(`<div><div id="headerHost"></div></div>`);
  wrapper.querySelector("#headerHost").appendChild(header.el);
  header.updateUserChip();

  const screen = renderReviewScreen({
    words: WORDS,
    categoryIndex: CATIDX,
    headerHost: header,
    onGoHome: () => showHome(),
    onGoWords: () => showWords(),
  });

  wrapper.appendChild(screen);
  mount(wrapper);
  header.updateUserChip();
}

function showSettings(){
  const st = getState();
  const uid = st.currentUserId;
  if (!uid) return showUserSelect();

  const header = headerFixed({
    onHome: () => showHome(),
    onUserSwitch: () => showUserSelect(),
  });

  const u = getUser(uid);
  const ui = getUISettings();

  const root = el(`
    <div>
      <div id="headerHost"></div>
      <div class="screen">
        <div class="card settingsGrid">
          <div class="field">
            <label>効果音音量</label>
            <input type="range" id="seVol" min="0" max="1" step="0.05" value="${ui.seVolume}">
          </div>

          <div class="field">
            <label>ユーザーアイコン変更</label>
            <input type="file" id="iconFile" accept="image/*">
            <p class="notice">※ 端末から選んだ画像を保存します。</p>
          </div>
        </div>
      </div>
    </div>
  `);

  root.querySelector("#headerHost").appendChild(header.el);
  header.updateUserChip();
  header.setSecondRow({ mode:"settings" });

  root.querySelector("#seVol").addEventListener("input", (e) => {
    setSeVolume(e.target.value);
  });

  root.querySelector("#iconFile").addEventListener("change", async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const dataUrl = await fileToDataURL(f);
    setUserIconDataUrl(uid, dataUrl);
    showHome();
  });

  mount(root);
}

async function fileToDataURL(file){
  return new Promise((resolve,reject)=>{
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/* ===== 起動 ===== */
async function boot(){
  getDB(); // init
  WORDS = await loadWords("./data/words.json");
  CATIDX = buildCategoryIndex(WORDS);

  const st = getState();
  if (!st.currentUserId) showUserSelect();
  else showHome();
}

boot().catch(() => {
  mount(el(`<div class="screen"><div class="card">よみこみ に しっぱい しました</div></div>`));
});
