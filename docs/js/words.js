import { ensureUser, getState, getProgress, setProgress, deleteProgress, getTodayStr } from "./storage.js";
import { playSfx, speakTTS } from "./audio.js";

export async function loadWords(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("words load fail");
  const data = await res.json();

  // A) [ {...}, {...} ]
  // B) { words:[...], version,... }
  let arr = null;
  if (Array.isArray(data)) arr = data;
  else if (data && Array.isArray(data.words)) arr = data.words;
  else throw new Error("words.json format invalid");

  return arr.filter(x => x && x.enabled === true);
}

export function buildCategoryIndex(words) {
  const map = new Map();
  for (const w of words) {
    if (!map.has(w.category_id)) {
      map.set(w.category_id, {
        id: w.category_id,
        label_ja: w.category_label_ja || w.category_id,
        label_kana: w.category_label_kana || "",
      });
    }
  }
  const cats = Array.from(map.values()).sort((a,b) => String(a.id).localeCompare(String(b.id)));
  return { cats };
}

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function wordId(w) {
  return `${w.game}:${w.word_key}`;
}

function imgSrc(w) {
  return `./assets/games/${w.game}/${w.category_id}/${w.image_file}`;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function sortWords(words) {
  return [...words].sort((a,b) => {
    const c = String(a.category_id).localeCompare(String(b.category_id));
    if (c !== 0) return c;
    const so = (a.sort_order ?? 0) - (b.sort_order ?? 0);
    if (so !== 0) return so;
    return String(a.word || "").localeCompare(String(b.word || ""));
  });
}

/* ===== ステージグループ（UIは数値出さない） ===== */
const STAGE_GROUPS = [
  { key: "mada", label: "まだ", test: (s) => s === 0 || s === 1 },
  { key: "sukoshi", label: "すこし", test: (s) => s === 2 },
  { key: "daitai", label: "だいたい", test: (s) => s === 3 },
  { key: "antei", label: "あんてい", test: (s) => s === 4 },
  { key: "kanari", label: "かなり", test: (s) => s === 5 },
  { key: "teichaku", label: "ていちゃく", test: (s) => s === 6 },
];

function makeMultiDrop({ title, allLabel, options, defaultAllSelected, twoCols }) {
  const wrap = document.createElement("div");
  wrap.className = "drop";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "dropBtn";
  btn.innerHTML = `<span class="title">${title}</span><span class="mini" data-mini=""></span>`;
  wrap.appendChild(btn);

  const panel = document.createElement("div");
  panel.className = "dropPanel hidden";
  wrap.appendChild(panel);

  const grid = document.createElement("div");
  grid.className = twoCols ? "dropGrid2" : "";
  panel.appendChild(grid);

  const state = { all: true, selected: new Set() };

  function syncMini() {
    const mini = btn.querySelector("[data-mini]");
    mini.textContent = state.all ? allLabel : `${state.selected.size}こ`;
  }

  function setAll() {
    state.all = true;
    state.selected.clear();
    syncUI();
  }

  function syncUI() {
    const allCb = panel.querySelector('input[data-all="1"]');
    if (allCb) allCb.checked = state.all;

    panel.querySelectorAll('input[data-key]').forEach(cb => {
      cb.checked = state.all ? false : state.selected.has(cb.dataset.key);
    });

    syncMini();
  }

  function open() { panel.classList.remove("hidden"); }
  function close() { panel.classList.add("hidden"); }
  function toggle() { panel.classList.toggle("hidden"); }

  // ALL
  const allItem = el(`
    <div class="dropItem" data-kind="all">
      <input type="checkbox" data-all="1" />
      <span>${allLabel}</span>
      <small>初期</small>
    </div>
  `);
  grid.appendChild(allItem);

  for (const opt of options) {
    const item = el(`
      <div class="dropItem" data-kind="one">
        <input type="checkbox" data-key="${opt.key}" />
        <span>${opt.label}</span>
        <small></small>
      </div>
    `);
    grid.appendChild(item);
  }

  btn.addEventListener("click", (e) => { e.stopPropagation(); toggle(); });

  function applyClick(item) {
    const allCb = item.querySelector('input[data-all="1"]');
    if (allCb) { setAll(); return; }

    const cb = item.querySelector('input[data-key]');
    if (!cb) return;
    const key = cb.dataset.key;

    if (state.all) { state.all = false; state.selected.clear(); }

    if (state.selected.has(key)) state.selected.delete(key);
    else state.selected.add(key);

    if (state.selected.size === 0 && defaultAllSelected) {
      setAll();
      return;
    }
    syncUI();
  }

  panel.addEventListener("click", (e) => {
    e.stopPropagation();
    const item = e.target.closest(".dropItem");
    if (!item) return;
    applyClick(item);
    // ★ここが重要：毎回、確実に変更が反映されるようイベントを投げる
    wrap.dispatchEvent(new CustomEvent("filterchange"));
  });

  document.addEventListener("click", () => close());

  if (defaultAllSelected) setAll();
  else syncUI();

  return {
    el: wrap,
    getState: () => ({ all: state.all, selected: new Set(state.selected) }),
    setAll,
    setSelected: (keys) => {
      state.all = false;
      state.selected = new Set(keys);
      if (state.selected.size === 0 && defaultAllSelected) setAll();
      else syncUI();
    },
    open,
    close,
  };
}

export function renderWordsScreen({ words, categoryIndex, headerHost, onGoHome, onGoReview }) {
  const st = getState();
  const userId = st.currentUserId;
  if (!userId) return el(`<div></div>`);
  ensureUser(userId);

  const root = el(`<div class="screen"><div id="list" class="list"></div></div>`);

  // Filters (2行目に載せるため headerHost に差し込み)
  const catOptions = categoryIndex.cats.map(c => ({
    key: c.id,
    label: `${c.label_ja}（${c.label_kana || ""}）`.replace("（）",""),
  }));

  const catDrop = makeMultiDrop({
    title: "ぶんるい",
    allLabel: "ぜんかてごり",
    options: catOptions,
    defaultAllSelected: true,
    twoCols: true, // ★分類2列
  });

  const stageDrop = makeMultiDrop({
    title: "だんかい",
    allLabel: "ぜんだんかい",
    options: STAGE_GROUPS.map(g => ({ key: g.key, label: g.label })),
    defaultAllSelected: false,
    twoCols: true,
  });
  // デフォルト全選択（フィルタなし）
  stageDrop.setSelected(STAGE_GROUPS.map(g => g.key));

  headerHost.setSecondRow({
    mode: "words",
    catDropEl: catDrop.el,
    stageDropEl: stageDrop.el,
    onGoHome,
    onGoReview,
  });

  const listEl = root.querySelector("#list");

  function getStage(word) {
    const id = wordId(word);
    const p = getProgress(userId, id);
    return p ? (Number.isFinite(p.stage) ? p.stage : 0) : 0; // 未Enrollは0
  }

  function stageOk(word) {
    const sState = stageDrop.getState();
    const selected = sState.selected;
    if (selected.size === STAGE_GROUPS.length) return true;
    const s = getStage(word);
    for (const g of STAGE_GROUPS) {
      if (!selected.has(g.key)) continue;
      if (g.test(s)) return true;
    }
    return false;
  }

  function catOk(word) {
    const cState = catDrop.getState();
    if (cState.all) return true;
    return cState.selected.has(word.category_id);
  }

  function filtered() {
    return sortWords(words.filter(w => w.enabled && catOk(w) && stageOk(w)));
  }

  function render() {
    listEl.innerHTML = "";
    const items = filtered();

    for (const w of items) {
      const id = wordId(w);
      const p = getProgress(userId, id);
      const enrolled = !!p;

      const card = el(`
        <div class="card">
          <div class="wordGrid">
            <div class="thumbWrap" data-thumb="1"></div>
            <div>
              <div class="descRow">
                <button class="spkBtn" type="button" data-act="descSpeak" aria-label="speak">🔊</button>
                <p class="desc">${escapeHtml(w.desc_lv2 || "")}</p>
              </div>
              <p class="notice">※ 画像を押すと単語を読み上げます。</p>
            </div>
          </div>

          <div class="actions">
            ${enrolled
              ? `<button class="btn ng" data-act="forget" type="button">わすれた</button>`
              : `<button class="btn ok" data-act="remember" type="button">おぼえた</button>`
            }
          </div>
        </div>
      `);

      // 画像タップ：画像枠を単語に置換 + 単語TTS
      const wrap = card.querySelector('[data-thumb="1"]');
      let showWord = false;

      function setThumb() {
        wrap.innerHTML = "";
        if (!showWord) {
          const img = document.createElement("img");
          img.className = "thumb";
          img.alt = "";
          img.src = imgSrc(w);
          wrap.appendChild(img);
        } else {
          const div = document.createElement("div");
          div.className = "wordInThumb";
          div.textContent = w.word || "";
          wrap.appendChild(div);
        }
      }
      setThumb();

      wrap.addEventListener("click", () => {
        showWord = !showWord;
        setThumb();
        speakTTS(w.word || "");
      });

      // 説明読み上げ
      card.querySelector('[data-act="descSpeak"]').addEventListener("click", () => {
        speakTTS(w.desc_lv2 || "");
      });

      // Enroll
      const rememberBtn = card.querySelector('[data-act="remember"]');
      if (rememberBtn) {
        rememberBtn.addEventListener("click", () => {
          setProgress(userId, id, { stage: 0, due: getTodayStr(), wrongToday: false });
          playSfx("correct"); // ★おぼえた＝correct
          render();
        });
      }

      // Unenroll（単語モードの「わすれた」＝Enroll解除）
      const forgetBtn = card.querySelector('[data-act="forget"]');
      if (forgetBtn) {
        forgetBtn.addEventListener("click", () => {
          deleteProgress(userId, id);
          playSfx("wrong");
          render();
        });
      }

      listEl.appendChild(card);
    }
  }

  // ★確実に効く：filterchange を拾って再描画
  catDrop.el.addEventListener("filterchange", render);
  stageDrop.el.addEventListener("filterchange", render);

  render();
  return root;
}

/* 復習画面でも同じグループを使うためexport */
export const STAGE_GROUPS_EXPORT = STAGE_GROUPS;
export const makeMultiDropExport = makeMultiDrop;
export const wordIdExport = (w) => wordId(w);
