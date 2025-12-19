import { loadWords, buildCategoryIndex } from "./words.js";
import { getState, setCurrentUserId, ensureUser, getUsers, getAvatarDataUrl } from "./storage.js";
import { renderWordsScreen } from "./words.js";
import { renderReviewScreen } from "./review.js";
import { playSfx, speakTTS, stopAllAudio } from "./audio.js";

const appEl = document.getElementById("app");

let WORDS = [];
let CAT = null;

const ROUTES = {
  select: renderUserSelect,
  home: renderHome,
  words: renderWords,
  review: renderReview,
  settings: renderSettings,
};

function routeFromHash() {
  const h = (location.hash || "#/select").replace("#", "");
  const parts = h.split("/").filter(Boolean);
  return { name: parts[0] || "select", args: parts.slice(1) };
}

function go(name, ...args) {
  location.hash = `#/${name}${args.length ? "/" + args.join("/") : ""}`;
}

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function topBar({ showPoints, rightUserSwitch }) {
  const st = getState();
  const user = st.currentUserId ? ensureUser(st.currentUserId) : null;

  const left = showPoints
    ? `<div class="badge" aria-label="points"><span class="star">⭐</span><strong>${user?.points ?? 0}</strong></div>`
    : `<div></div>`;

  const right = rightUserSwitch && user
    ? `<button class="iconbtn" id="btnUserSwitch" type="button" aria-label="user">
         <img alt="" src="${getAvatarDataUrl(user.id) || ""}" onerror="this.style.display='none'"/>
         <span>${user.label}</span>
       </button>`
    : `<div></div>`;

  return `<div class="topbar">${left}${right}</div>`;
}

function mount(node) {
  stopAllAudio();
  appEl.innerHTML = "";
  appEl.appendChild(node);
}

async function ensureData() {
  if (WORDS.length) return;

  WORDS = await loadWords("./data/words.json");
  CAT = buildCategoryIndex(WORDS);
}

function todayStr() {
  // 端末ローカル時刻で日付境界（0:00）
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dueCountForUser(userId) {
  const st = getState();
  const u = ensureUser(userId);
  const prog = st.progressByUser?.[u.id] || {};
  const t = todayStr();
  let n = 0;
  for (const w of WORDS) {
    if (!w.enabled) continue;
    const id = `${w.game}:${w.word_key}`;
    const p = prog[id];
    if (!p) continue;
    if ((p.due || "") <= t) n++;
  }
  // 「×で今日中に出す」フラグもカウントに含める（今日やる対象だから）
  const wrongToday = st.wrongTodayByUser?.[u.id];
  if (wrongToday?.date === t) {
    // 重複を避けて加算
    for (const key of Object.keys(wrongToday.map || {})) {
      const id = key;
      const w = WORDS.find(x => `${x.game}:${x.word_key}` === id);
      if (!w || !w.enabled) continue;
      const p = prog[id];
      // dueで既に含まれてる可能性があるので、判定で追加
      if (!p || (p.due || "") > t) n++;
    }
  }
  return n;
}

/* =========================
   画面：ユーザー選択
========================= */
function renderUserSelect() {
  const users = getUsers();

  // 表示は「りおな」「そうま」だけ。開発者用は画面最下部リンク。
  const riona = users.find(u => u.id === "riona") || ensureUser("riona");
  const soma = users.find(u => u.id === "soma") || ensureUser("soma");

  const node = el(`
    <div class="center">
      <div class="screen">
        <div class="h1">TapSpeak Vocab</div>
        <div class="subtle">ゆーざー を えらんでね</div>
        <div class="hr"></div>
        <button class="bigbtn" id="btnRiona" type="button">${riona.label}</button>
        <button class="bigbtn" id="btnSoma" type="button">${soma.label}</button>
        <div class="footerlink">
          <button id="btnDev" type="button">開発者用</button>
        </div>
      </div>
    </div>
  `);

  node.querySelector("#btnRiona").addEventListener("click", () => {
    setCurrentUserId("riona");
    playSfx("point"); // 軽いフィードバック（仕様外の音に見える？→ pointはUI用で許容。不要なら外します）
    go("home");
  });

  node.querySelector("#btnSoma").addEventListener("click", () => {
    setCurrentUserId("soma");
    playSfx("point");
    go("home");
  });

  node.querySelector("#btnDev").addEventListener("click", () => {
    // 「開発者」は単純にユーザーとして扱う
    ensureUser("developer", "開発者");
    setCurrentUserId("developer");
    go("home");
  });

  mount(node);
}

/* =========================
   画面：ホーム
========================= */
function renderHome() {
  const st = getState();
  if (!st.currentUserId) return go("select");

  const user = ensureUser(st.currentUserId);
  const due = dueCountForUser(user.id);

  const node = el(`
    <div class="center">
      ${topBar({ showPoints: true, rightUserSwitch: true })}
      <div class="screen">
        <div class="center" style="min-height:auto">
          <button class="bigbtn blue" id="btnWords" type="button">たんご</button>
          <button class="bigbtn gray" id="btnReview" type="button">ふくしゅう：${due}こ</button>
          <div class="smallbottom">
            <button id="btnSettings" type="button">設定</button>
          </div>
        </div>
      </div>
    </div>
  `);

  const btnSwitch = node.querySelector("#btnUserSwitch");
  if (btnSwitch) btnSwitch.addEventListener("click", () => go("select"));

  node.querySelector("#btnWords").addEventListener("click", () => go("words"));
  node.querySelector("#btnReview").addEventListener("click", () => go("review"));
  node.querySelector("#btnSettings").addEventListener("click", () => go("settings"));

  mount(node);
}

/* =========================
   画面：たんご
========================= */
function renderWords() {
  const st = getState();
  if (!st.currentUserId) return go("select");

  const node = renderWordsScreen({
    words: WORDS,
    categoryIndex: CAT,
    onGoHome: () => go("home"),
    onGoReview: () => go("review"),
    onGoSelect: () => go("select"),
    topBarHtml: topBar({ showPoints: true, rightUserSwitch: true }),
    onUserSwitch: () => go("select"),
    playSfx,
    speakTTS,
    todayStr,
  });

  mount(node);
}

/* =========================
   画面：ふくしゅう
========================= */
function renderReview() {
  const st = getState();
  if (!st.currentUserId) return go("select");

  const node = renderReviewScreen({
    words: WORDS,
    categoryIndex: CAT,
    onGoHome: () => go("home"),
    onGoWords: () => go("words"),
    onGoSelect: () => go("select"),
    topBarHtml: topBar({ showPoints: true, rightUserSwitch: true }),
    onUserSwitch: () => go("select"),
    playSfx,
    speakTTS,
    todayStr,
  });

  mount(node);
}

/* =========================
   画面：設定
========================= */
function renderSettings() {
  const st = getState();
  if (!st.currentUserId) return go("select");
  const user = ensureUser(st.currentUserId);

  const node = el(`
    <div>
      ${topBar({ showPoints: true, rightUserSwitch: true })}
      <div class="screen">
        <div class="row" style="justify-content:space-between;align-items:center">
          <div>
            <div class="h1" style="margin:0">設定</div>
            <div class="subtle">おとな よう</div>
          </div>
          <button class="iconbtn" id="btnBack" type="button">もどる</button>
        </div>

        <div class="hr"></div>

        <div class="sectiontitle">ゆーざー あいこん</div>
        <div class="row" style="align-items:center">
          <img id="avatarPreview" alt="" style="width:64px;height:64px;border-radius:999px;object-fit:cover;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06)" src="${getAvatarDataUrl(user.id) || ""}" onerror="this.style.display='none'"/>
          <div class="pill">
            <input id="avatarFile" type="file" accept="image/*" />
          </div>
        </div>
        <div class="note">※ ぴん は いりません</div>

        <div class="hr"></div>

        <div class="sectiontitle">ばっくあっぷ</div>
        <div class="actions">
          <button class="btn blue" id="btnExport" type="button">つくる</button>
          <button class="btn" id="btnImportPick" type="button">よみこむ</button>
          <input id="importFile" type="file" accept="application/json" style="display:none" />
        </div>
        <div class="note">※ よみこむ と うわがき します</div>

        <div class="hr"></div>

        <div class="sectiontitle">ぴん</div>
        <div class="field">
          <label>ぴん（あとで かえられます）</label>
          <input class="input" id="pinValue" type="password" inputmode="numeric" placeholder="すうじ 4けた など" />
          <button class="btn" id="btnSetPin" type="button">ぴん を ほぞん</button>
          <div class="note">※ りせっと に ひつよう</div>
        </div>

        <div class="hr"></div>

        <div class="sectiontitle">りせっと</div>
        <div class="actions">
          <button class="btn ng" id="btnResetPoints" type="button">ぽいんと りせっと</button>
          <button class="btn ng" id="btnResetAll" type="button">がくしゅう ぜんりせっと</button>
        </div>
        <div class="note">※ あいこん は のこります</div>

      </div>
    </div>
  `);

  const btnSwitch = node.querySelector("#btnUserSwitch");
  if (btnSwitch) btnSwitch.addEventListener("click", () => go("select"));

  node.querySelector("#btnBack").addEventListener("click", () => go("home"));

  // avatar
  const file = node.querySelector("#avatarFile");
  file.addEventListener("change", async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const dataUrl = await fileToDataUrl(f);
    const st2 = getState();
    const u = ensureUser(st2.currentUserId);
    // store
    const { setAvatarDataUrl } = await import("./storage.js");
    setAvatarDataUrl(u.id, dataUrl);
    const img = node.querySelector("#avatarPreview");
    img.style.display = "block";
    img.src = dataUrl;
  });

  // export
  node.querySelector("#btnExport").addEventListener("click", async () => {
    const { exportBackupJson } = await import("./storage.js");
    const json = exportBackupJson();
    downloadText(`tapspeak_backup_${todayStr()}.json`, json);
    playSfx("point");
  });

  // import
  const importPick = node.querySelector("#btnImportPick");
  const importInput = node.querySelector("#importFile");
  importPick.addEventListener("click", () => importInput.click());
  importInput.addEventListener("change", async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    const { importBackupJson } = await import("./storage.js");
    try {
      importBackupJson(text);
      playSfx("point");
      go("home");
    } catch (err) {
      alert("よみこみ に しっぱい しました");
    }
  });

  // pin set
  node.querySelector("#btnSetPin").addEventListener("click", async () => {
    const v = node.querySelector("#pinValue").value.trim();
    const { setPin } = await import("./storage.js");
    setPin(v);
    playSfx("point");
  });

  // reset with pin
  node.querySelector("#btnResetPoints").addEventListener("click", async () => {
    const ok = await askPin();
    if (!ok) return;
    const { resetPoints } = await import("./storage.js");
    resetPoints(user.id);
    playSfx("point");
    go("home");
  });

  node.querySelector("#btnResetAll").addEventListener("click", async () => {
    const ok = await askPin();
    if (!ok) return;
    const { resetLearningKeepAvatar } = await import("./storage.js");
    resetLearningKeepAvatar(user.id);
    playSfx("point");
    go("home");
  });

  mount(node);
}

async function askPin() {
  const { getPin } = await import("./storage.js");
  const pin = getPin();
  if (!pin) {
    alert("さきに ぴん を ほぞん してね");
    return false;
  }
  const input = prompt("ぴん を いれてね");
  if ((input || "").trim() !== pin) {
    alert("ちがうよ");
    return false;
  }
  return true;
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/* =========================
   起動
========================= */
async function main() {
  await ensureData();

  // 初期ユーザーを確保（表示用）
  ensureUser("riona", "りおな");
  ensureUser("soma", "そうま");

  const render = async () => {
    const { name } = routeFromHash();
    const fn = ROUTES[name] || ROUTES.select;
    await ensureData();
    fn();
  };

  window.addEventListener("hashchange", render);
  await render();
}

main().catch(() => {
  appEl.innerHTML = `<div class="screen"><div class="h1">えらー</div><div class="subtle">よみこみ に しっぱい しました</div></div>`;
});
