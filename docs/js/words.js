import { ensureUser, getState, getProgress, setProgress, deleteProgress } from "./storage.js";
import { playSfx, speakTTS } from "./review_deps_tmp.js"; // (※下で差し替え。importを使わない運用)

export async function loadWords(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("words load fail");
  const data = await res.json();

  // 受け入れる形式：
  // A) [ {...}, {...} ]
  // B) { words: [ {...}, {...} ], version, generated_at }
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

function sortWordsForList(words) {
  return [...words].sort((a,b) => {
    const c = String(a.category_id).localeCompare(String(b.category_id));
    if (c !== 0) return c;
    const so = (a.sort_order ?? 0) - (b.sort_order ?? 0);
    if (so !== 0) return so;
    return String(a.word || "").localeCompare(String(b.word || ""));
  });
}

function nextDueFromStage(todayStr, stage) {
  const days = [0, 1, 3, 7, 14, 30, 365][stage] ?? 0;
  const d = new Date(todayStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}

/* ===== フィルタ: ステージ表示用（UIは数値出さない） =====
   まだ: stage 0-1（未Enrollも0扱い）
*/
const STAGE_GROUPS = [
  { key: "mada", label: "まだ", test: (s) => s === 0 || s === 1 },
  { key: "sukoshi", label: "すこし", test: (s) => s === 2 },
  { key: "daitai", label: "だいたい", test: (s) => s === 3 },
  { key: "antei", label: "あんてい", test: (s) => s === 4 },
  { key: "kanari", label: "かなり", test: (s) => s === 5 },
  { key: "teichaku", label: "ていちゃく", test: (s) => s === 6 },
];

function makeMultiDrop({ title, allLabel, options, defaultAllSelected = true }) {
  // options: [{key,label, sub?}]
  const wrap = document.createElement("div");
  wrap.className = "drop";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "dropBtn";
  btn.innerHTML = `<span>${title}</span><span class="mini" data-mini=""></span>`;
  wrap.appendChild(btn);

  const panel = document.createElement("div");
  panel.className = "dropPanel hidden";
  wrap.appendChild(panel);

  const state = {
    all: true,
    selected: new Set(), // option keys
  };

  function setAll() {
    state.all = true;
    state.selected.clear();
    syncUI();
  }

  function setSelected(keys) {
    state.all = false;
    state.selected = new Set(keys);
    if (state.selected.size === 0 && defaultAllSelected) {
      // fallback to all
      setAll();
      return;
    }
    syncUI();
  }

  function syncMini() {
    const mini = btn.querySelector("[data-mini]");
    if (state.all) {
      mini.textContent = allLabel;
    } else {
      mini.textContent = `${state.selected.size}選択`;
    }
  }

  function syncUI() {
    // checkboxes
    panel.querySelectorAll('input[type="checkbox"][data-key]').forEach((cb) => {
      const key = cb.dataset.key;
      cb.checked = state.all ? false : state.selected.has(key);
    });
    const allCb = panel.querySelector('input[type="checkbox"][data-all="1"]');
    if (allCb) allCb.checked = state.all;
    syncMini();
  }

  function close() {
    panel.classList.add("hidden");
  }
  function toggle() {
    panel.classList.toggle("hidden");
  }

  // build panel
  panel.appendChild(el(`
    <div class="dropItem" data-click="all">
      <input type="checkbox" data-all="1" />
      <span>${allLabel}</span>
      <small>初期</small>
    </div>
  `));

  for (const opt of options) {
    const sub = opt.sub ? `<small>${opt.sub}</small>` : `<small></small>`;
    const item = el(`
      <div class="dropItem" data-click="one">
        <input type="checkbox" data-key="${opt.key}" />
        <span>${opt.label}</span>
        ${sub}
      </div>
    `);
    panel.appendChild(item);
  }

  // interactions
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggle();
  });

  panel.addEventListener("click", (e) => {
    e.stopPropagation();

    const item = e.target.closest(".dropItem");
    if (!item) return;

    const allCb = item.querySelector('input[data-all="1"]');
    if (allCb) {
      setAll();
      return;
    }

    const cb = item.querySelector('input[data-key]');
    if (!cb) return;

    const key = cb.dataset.key;

    // 複数選択: toggle
    if (state.all) {
      state.all = false;
      state.selected.clear();
    }

    if (state.selected.has(key)) state.selected.delete(key);
    else state.selected.add(key);

    // ぜんかてごりは特別扱い（all）
    if (state.selected.size === 0 && defaultAllSelected) {
      setAll();
      return;
    }

    syncUI();
  });

  // close on outside
  document.addEventListener("click", () => close());

  // initial
  if (defaultAllSelected) setAll();
  else syncUI();

  return {
    el: wrap,
    getState: () => ({ all: state.all, selected: new Set(state.selected) }),
    setAll,
    setSelected,
    close,
  };
}

export function renderWordsScreen({
  words,
  categoryIndex,
  onGoHome,
  onGoReview,
  topBarHtml,
  onUserSwitch,
  todayStr,
}) {
  const st = getState();
  const userId = st.currentUserId;
  if (!userId) return el(`<div></div>`);
  ensureUser(userId);

  const node = el(`
    <div class="words-theme">
      ${topBarHtml}
      <div class="screen">
        <div class="tabrow">
          <button class="tabbtn active" id="tabWords" type="button">たんご</button>
          <button class="tabbtn" id="tabReview" type="button">ふくしゅう</button>
        </div>

        <div class="hr"></div>

        <div class="row" id="filtersRow" style="justify-content:space-between;align-items:center"></div>

        <div class="list" id="list"></div>
      </div>
    </div>
  `);

  const btnSwitch = node.querySelector("#btnUserSwitch");
  if (btnSwitch) btnSwitch.addEventListener("click", onUserSwitch);

  node.querySelector("#tabReview").addEventListener("click", onGoReview);

  const filtersRow = node.querySelector("#filtersRow");

  // ===== カテゴリフィルタ（共通・複数）=====
  const catOptions = categoryIndex.cats.map(c => ({
    key: c.id,
    label: `${c.label_ja}（${c.label_kana || ""}）`.replace("（）",""),
  }));

  const catDrop = makeMultiDrop({
    title: "分類",
    allLabel: "全分類",
    options: catOptions,
    defaultAllSelected: true, // 初期: ぜんかてごり
  });

  // ===== ステージフィルタ（単語モード専用）=====
  const stageDrop = makeMultiDrop({
    title: "段階",
    allLabel: "全段階",
    options: STAGE_GROUPS.map(g => ({ key: g.key, label: g.label })),
    defaultAllSelected: false,
  });
  // デフォルト: 全選択（=フィルタなし）
  stageDrop.setSelected(STAGE_GROUPS.map(g => g.key));

  const right = el(`<button class="iconbtn" id="btnHome" type="button">ほーむ</button>`);
  right.addEventListener("click", onGoHome);

  // 配置
  const leftPack = document.createElement("div");
  leftPack.className = "row";
  leftPack.appendChild(catDrop.el);
  leftPack.appendChild(stageDrop.el);

  filtersRow.appendChild(leftPack);
  filtersRow.appendChild(right);

  const listEl = node.querySelector("#list");

  function getStageForFilter(word) {
    const id = wordId(word);
    const p = getProgress(userId, id);
    if (!p) return 0; // 未Enrollはstage=0扱い
    return Number.isFinite(p.stage) ? p.stage : 0;
  }

  function stageGroupMatch(stage, groupKeySet) {
    // OR条件（いずれかに該当）
    for (const g of STAGE_GROUPS) {
      if (!groupKeySet.has(g.key)) continue;
      if (g.test(stage)) return true;
    }
    return false;
  }

  function filterWords() {
    const catState = catDrop.getState();
    const stageState = stageDrop.getState();

    const catOk = (w) => {
      if (catState.all) return true;
      return catState.selected.has(w.category_id);
    };

    const stageOk = (w) => {
      // 全選択=フィルタなし扱い
      const selected = stageState.selected;
      if (selected.size === STAGE_GROUPS.length) return true;
      const s = getStageForFilter(w);
      return stageGroupMatch(s, selected);
    };

    return sortWordsForList(words.filter(w => w.enabled && catOk(w) && stageOk(w)));
  }

  function renderList() {
    const items = filterWords();
    listEl.innerHTML = "";

    for (const w of items) {
      const id = wordId(w);
      const p = getProgress(userId, id);
      const enrolled = !!p;

      const card = el(`
        <div class="card">
          <div class="wordgrid">
            <div class="thumbWrap" data-thumb="1">
              <img class="thumb" alt="" src="${imgSrc(w)}" />
            </div>
            <div>
              <div class="descRow">
                <button class="spkbtn" type="button" data-act="descSpeak" aria-label="speak">🔊</button>
                <p class="wdesc">${escapeHtml(w.desc_lv2 || "")}</p>
              </div>
            </div>
          </div>

          <div class="actions" data-actions="1">
            ${enrolled
              ? `<button class="btn ng" data-act="forget" type="button">わすれた</button>`
              : `<button class="btn ok" data-act="remember" type="button">おぼえた</button>`
            }
          </div>
        </div>
      `);

      // 画像タップ: 画像枠の中を「単語」に置換（オンオフ）
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
      });

      // 説明文読み上げ（スピーカーアイコン）
      card.querySelector('[data-act="descSpeak"]').addEventListener("click", () => {
        speakTTS(w.desc_lv2 || "");
      });

      // Enroll / Unenroll
      const t = todayStr();
      const rememberBtn = card.querySelector('[data-act="remember"]');
      if (rememberBtn) {
        rememberBtn.addEventListener("click", () => {
          setProgress(userId, id, { stage: 0, due: t });
          renderList(); // フィルタ即時反映（ただし仕様上 stageは0扱いなので変わりにくい）
        });
      }

      const forgetBtn = card.querySelector('[data-act="forget"]');
      if (forgetBtn) {
        forgetBtn.addEventListener("click", () => {
          deleteProgress(userId, id); // 復習から外す
          // 効果音: wrong
          // ※ words.js単体で音を鳴らせないので、review_deps_tmp.jsを使う代替はしない
          // → 音はaudio.jsで鳴らすため、app.jsから渡す設計にしたいが、今回は最小改修で review.js からグローバルに置く
          try { window.__tapspeak_playSfx?.("wrong"); } catch {}
          renderList();
        });
      }

      listEl.appendChild(card);
    }
  }

  // フィルタ変更で即時更新
  catDrop.el.addEventListener("change", renderList, true);
  stageDrop.el.addEventListener("change", renderList, true);
  // dropPanelクリックでも更新させる
  catDrop.el.addEventListener("click", () => setTimeout(renderList, 0));
  stageDrop.el.addEventListener("click", () => setTimeout(renderList, 0));

  renderList();
  return node;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function calcNextDue(todayStr, stage) {
  return nextDueFromStage(todayStr, stage);
}
