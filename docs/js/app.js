import { loadWords, buildCategoryIndex } from "./words.js";
import { getState, setCurrentUserId, ensureUser, getUsers, getAvatarDataUrl } from "./storage.js";
import { renderWordsScreen } from "./words.js";
import { renderReviewScreen } from "./review.js";
import { stopAllAudio } from "./audio.js";

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

function userLetter(userId, userLabel) {
  if (userId === "riona") return "R";
  if (userId === "soma") return "S";
  if (userId === "developer") return "D";
  // fallback: first char
  return (userLabel || "?").slice(0, 1).toUpperCase();
}

function topBar({ showPoints, rightUserSwitch }) {
  const st = getState();
  const user = st.currentUserId ? ensureUser(st.currentUserId) : null;

  const left = showPoints
    ? `<div class="badge" id="badgePoints" aria-label="points"><span class="star">⭐</span><strong>${user?.points ?? 0}</strong></div>`
    : `<div></div>`;

  let right = `<div></div>`;
  if (rightUserSwitch && user) {
    const ava = getAvatarDataUrl(user.id);
    const letter = userLetter(user.id, user.label);
    right = `
      <button class="iconbtn" id="btnUserSwitch" type="button" aria-label="user">
        ${ava ? `<img class="avatarImg" alt="" src="${ava}" />` : `<span class="avatarCircle" aria-hidden="true">${letter}</span>`}
        <span>${user.label}</span>
      </button>
    `;
  }

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

  // 今日中に○まで出すフラグも対象
  const wrongToday = st.wrongTodayByUser?.[u.id];
  if (wrongToday?.date === t) {
    for (const id of Object.keys(wrongToday.map || {})) {
      const w = WORDS.find(x => `${x.game}:${x.word_key}` === id);
      if (!w || !w.enabled) continue;
      const p = prog[id];
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

  const riona = users.find(u => u.id === "riona") || ensureUser("riona", "りおな");
  const soma = users.find(u => u.id === "soma") || ensureUser("soma", "そうま");

  const node = el(`
    <div class="center">
      <div class="screen">
        <div class="h1">TapSpeak Vocab</div>
        <div class="hr"></div>

        <button class="bigbtn" id="btnRiona" type="button">
          <span class="avatarCircle" aria-hidden="true">R</span>
          <span>${riona.label}</span>
        </button>

        <button class="bigbtn" id="btnSoma" type="button">
          <span class="avatarCircle" aria-hidden="true">S</span>
          <span>${soma.label}</span>
        </button>

        <div class="footerlink">
          <button id="btnDev" type="button">開発者用</button>
        </div>
      </div>
    </div>
  `);

  node.querySelector("#btnRiona").addEventListener("click", () => {
    setCurrentUserId("riona");
    go("home");
  });

  node.querySelector("#btnSoma").addEventListener("click", () => {
    setCurrentUserId("soma");
    go("home");
  });

  node.querySelector("#btnDev").addEventListener("click", () => {
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
    todayStr,
    // ポイント演出をトップレベルで出す
    onPointGained: () => {
      showPointEffect();
      // 左上バッジもキラッ
      const badge = document.getElementById("badgePoints");
      if (badge) {
        badge.classList.remove("sparkle");
        // reflow
        void badge.offsetWidth;
        badge.classList.add("sparkle");
      }
    }
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
          </div>
          <button class="iconbtn" id="btnBack" type="button">戻る</button>
        </div>

        <div class="hr"></div>

        <div class="sectiontitle">利用者画像</div>
        <div class="row" style="align-items:center">
          <img id="avatarPreview" alt="" style="width:64px;height:64px;border-radius:999px;object-fit:cover;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06)" src="${getAvatarDataUrl(user.id) || ""}" onerror="this.style.display='none'"/>
          <div class="pill">
            <input id="avatarFile" type="file" accept="image/*" />
          </div>
        </div>
        <div class="note">※ 暗証番号不要</div>

        <div class="hr"></div>

        <div class="sectiontitle">効果音音量</div>
        <div class="field">
          <label>音量</label>
          <input class="input" id="sfxRange" type="range" min="0" max="100" step="1" />
          <div class="note">※ 効果音のみ</div>
        </div>

        <div class="hr"></div>

        <div class="sectiontitle">保存</div>
        <div class="actions">
          <button class="btn blue" id="btnExport" type="button">バックアップ作成</button>
          <button class="btn" id="btnImportPick" type="button">バックアップ読込</button>
          <input id="importFile" type="file" accept="application/json" style="display:none" />
        </div>
        <div class="note">※ 読込時上書</div>

        <div class="hr"></div>

        <div class="sectiontitle">暗証番号</div>
        <div class="field">
          <label>暗証番号</label>
          <input class="input" id="pinValue" type="password" inputmode="numeric" placeholder="数字 4桁 等" />
          <button class="btn" id="btnSetPin" type="button">暗証番号保存</button>
          <div class="note">※ リセット時必要</div>
        </div>

        <div class="hr"></div>

        <div class="sectiontitle">初期化</div>
        <div class="actions">
          <button class="btn ng" id="btnResetPoints" type="button">ポイント初期化</button>
          <button class="btn ng" id="btnResetAll" type="button">学習全初期化</button>
        </div>
        <div class="note">※ 画像保持</div>

      </div>
    </div>
  `);

  const btnSwitch = node.querySelector("#btnUserSwitch");
  if (btnSwitch) btnSwitch.addEventListener("click", () => go("select"));

  node.querySelector("#btnBack").addEventListener("click", () => go("home"));

  // SFX volume
  import("./storage.js").then(({ getSfxVolume, setSfxVolume }) => {
    const r = node.querySelector("#sfxRange");
    r.value = String(Math.round(getSfxVolume() * 100));
    r.addEventListener("input", () => {
      setSfxVolume(Number(r.value) / 100);
    });
  });

  // avatar
  const file = node.querySelector("#avatarFile");
  file.addEventListener("change", async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const dataUrl = await fileToDataUrl(f);
    const st2 = getState();
    const u = ensureUser(st2.currentUserId);
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
      go("home");
    } catch {
      alert("読込失敗");
    }
  });

  // pin set
  node.querySelector("#btnSetPin").addEventListener("click", async () => {
    const v = node.querySelector("#pinValue").value.trim();
    const { setPin } = await import("./storage.js");
    setPin(v);
  });

  // reset with pin
  node.querySelector("#btnResetPoints").addEventListener("click", async () => {
    const ok = await askPin();
    if (!ok) return;
    const { resetPoints } = await import("./storage.js");
    resetPoints(user.id);
    go("home");
  });

  node.querySelector("#btnResetAll").addEventListener("click", async () => {
    const ok = await askPin();
    if (!ok) return;
    const { resetLearningKeepAvatar } = await import("./storage.js");
    resetLearningKeepAvatar(user.id);
    go("home");
  });

  mount(node);
}

async function askPin() {
  const { getPin } = await import("./storage.js");
  const pin = getPin();
  if (!pin) {
    alert("暗証番号保存後実行");
    return false;
  }
  const input = prompt("暗証番号入力");
  if ((input || "").trim() !== pin) {
    alert("不一致");
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

/* ===== ポイント演出（即時） ===== */
function showPointEffect() {
  // 中央 +1
  const p = document.createElement("div");
  p.className = "popPoint";
  p.textContent = "＋1";
  document.body.appendChild(p);
  setTimeout(() => p.remove(), 1300);

  // キラキラ
  const layer = document.createElement("div");
  layer.className = "sparkLayer";
  document.body.appendChild(layer);

  const n = 18;
  for (let i = 0; i < n; i++) {
    const s = document.createElement("div");
    s.className = "spark";
    s.textContent = "✨";
    const x = 40 + Math.random() * 20; // center around 50%
    const y = 18 + Math.random() * 12; // around top 20-30%
    s.style.left = `${x}%`;
    s.style.top = `${y}%`;
    s.style.animationDelay = `${Math.random() * 120}ms`;
    layer.appendChild(s);
  }
  setTimeout(() => layer.remove(), 1100);
}

/* =========================
   起動
========================= */
async function main() {
  await ensureData();

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
