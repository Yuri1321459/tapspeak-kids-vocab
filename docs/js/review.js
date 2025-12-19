import {
  ensureUser,
  getState,
  getProgress,
  setProgress,
  getWrongTodaySet,
  markWrongToday,
  clearWrongToday,
  addReviewCorrect
} from "./storage.js";
import { playSfx, speakTTSWait } from "./audio.js";

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

function sortByCategoryThenOrder(a, b) {
  const c = String(a.category_id).localeCompare(String(b.category_id));
  if (c !== 0) return c;
  const so = (a.sort_order ?? 0) - (b.sort_order ?? 0);
  if (so !== 0) return so;
  return String(a.word || "").localeCompare(String(b.word || ""));
}

function makeMultiDrop({ title, allLabel, options }) {
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

  const state = { all: true, selected: new Set() };

  function setAll() {
    state.all = true;
    state.selected.clear();
    syncUI();
  }

  function syncMini() {
    const mini = btn.querySelector("[data-mini]");
    if (state.all) mini.textContent = allLabel;
    else mini.textContent = `${state.selected.size}選択`;
  }

  function syncUI() {
    panel.querySelectorAll('input[type="checkbox"][data-key]').forEach((cb) => {
      const key = cb.dataset.key;
      cb.checked = state.all ? false : state.selected.has(key);
    });
    const allCb = panel.querySelector('input[type="checkbox"][data-all="1"]');
    if (allCb) allCb.checked = state.all;
    syncMini();
  }

  function close() { panel.classList.add("hidden"); }
  function toggle() { panel.classList.toggle("hidden"); }

  panel.appendChild(el(`
    <div class="dropItem" data-click="all">
      <input type="checkbox" data-all="1" />
      <span>${allLabel}</span>
      <small>初期</small>
    </div>
  `));

  for (const opt of options) {
    const item = el(`
      <div class="dropItem" data-click="one">
        <input type="checkbox" data-key="${opt.key}" />
        <span>${opt.label}</span>
        <small></small>
      </div>
    `);
    panel.appendChild(item);
  }

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

    if (state.all) {
      state.all = false;
      state.selected.clear();
    }

    if (state.selected.has(key)) state.selected.delete(key);
    else state.selected.add(key);

    if (state.selected.size === 0) {
      setAll();
      return;
    }

    syncUI();
  });

  document.addEventListener("click", () => close());
  setAll();

  return {
    el: wrap,
    getState: () => ({ all: state.all, selected: new Set(state.selected) }),
    setAll,
    close,
  };
}

export function renderReviewScreen({
  words,
  categoryIndex,
  onGoHome,
  onGoWords,
  topBarHtml,
  onUserSwitch,
  todayStr,
  onPointGained,
}) {
  const st = getState();
  const userId = st.currentUserId;
  if (!userId) return el(`<div></div>`);
  ensureUser(userId);

  // 単語モードからも効果音を鳴らせるようにする（仕様上の最小手段）
  window.__tapspeak_playSfx = playSfx;

  const today = todayStr();

  const node = el(`
    <div>
      ${topBarHtml}
      <div class="screen">
        <div class="tabrow">
          <button class="tabbtn" id="tabWords" type="button">たんご</button>
          <button class="tabbtn active" id="tabReview" type="button">ふくしゅう</button>
        </div>

        <div class="hr"></div>

        <div class="row" style="justify-content:space-between;align-items:center">
          <div class="row" id="leftFilters" style="gap:10px;align-items:center"></div>
          <button class="iconbtn" id="btnHome" type="button">ほーむ</button>
        </div>

        <div class="hr"></div>

        <div class="sectiontitle" id="titleNow">いま やる ことば 0こ</div>
        <div class="list" id="list"></div>

        <div class="hr"></div>
        <div class="sectiontitle">復習</div>
        <div class="note">※ ×押下後当日中は○まで再出題</div>
      </div>
    </div>
  `);

  const btnSwitch = node.querySelector("#btnUserSwitch");
  if (btnSwitch) btnSwitch.addEventListener("click", onUserSwitch);

  node.querySelector("#btnHome").addEventListener("click", onGoHome);
  node.querySelector("#tabWords").addEventListener("click", onGoWords);

  // ===== カテゴリフィルタ（複数・初期は全カテゴリ）=====
  const catOptions = categoryIndex.cats.map(c => ({
    key: c.id,
    label: `${c.label_ja}（${c.label_kana || ""}）`.replace("（）",""),
  }));
  const catDrop = makeMultiDrop({
    title: "分類",
    allLabel: "全分類",
    options: catOptions,
  });

  const left = node.querySelector("#leftFilters");
  left.appendChild(catDrop.el);

  const listEl = node.querySelector("#list");
  const titleNow = node.querySelector("#titleNow");

  function buildDueList() {
    const st2 = getState();
    const prog = st2.progressByUser?.[userId] || {};
    const wrong = getWrongTodaySet(userId, today);

    const catState = catDrop.getState();
    const catOk = (w) => {
      if (catState.all) return true;
      return catState.selected.has(w.category_id);
    };

    const dueWords = [];
    for (const w of words) {
      const id = wordId(w);
      const p = prog[id];
      if (!p) continue;

      const isDue = (p.due || "") <= today;
      const isWrongToday = !!wrong[id];
      if (!isDue && !isWrongToday) continue;

      // AND方式：期限が来た単語のみ（wrongTodayも当日対象として許容） + カテゴリ一致
      if (!catOk(w)) continue;

      dueWords.push({ w, p, id, isWrongToday });
    }

    dueWords.sort((a,b) => sortByCategoryThenOrder(a.w, b.w));
    return dueWords;
  }

  function renderList() {
    const items = buildDueList();
    titleNow.textContent = `いま やる ことば ${items.length}こ`;
    listEl.innerHTML = "";

    if (!items.length) {
      listEl.appendChild(el(`
        <div class="card">
          <div class="subtle">いま やる ことば は ないよ</div>
        </div>
      `));
      return;
    }

    for (const { w, p, id } of items) {
      // 復習カード状態:
      // 0: いってみて
      // 1: せいかいをきく
      // 2: ○ / ×
      let phase = 0;
      let busy = false;

      const card = el(`
        <div class="card">
          <div class="wordgrid">
            <div class="thumbWrap" data-thumb="1">
              <img class="thumb" alt="" src="${imgSrc(w)}" />
            </div>
            <div>
              <p class="wdesc">${escapeHtml(w.desc_lv2 || "")}</p>
            </div>
          </div>

          <div class="actions" data-actions="1"></div>
        </div>
      `);

      // 画像タップ: 画像枠の中を「単語」に置換
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

      const actions = card.querySelector('[data-actions="1"]');

      function setActions(html) {
        actions.innerHTML = html;
      }

      function lock(v) {
        busy = v;
        actions.querySelectorAll("button").forEach(b => b.disabled = v);
      }

      async function onSpeakStart() {
        if (busy) return;
        playSfx("speak_start"); // 重ねない（audio.js側で制御）
        phase = 1;
        // 1秒待機してボタン置換
        lock(true);
        await wait(1000);
        lock(false);
        renderPhase();
      }

      async function onHearAnswer() {
        if (busy) return;
        phase = 2;
        lock(true);
        await speakTTSWait(w.word || "");
        lock(false);
        renderPhase();
      }

      function onOk() {
        if (busy) return;
        const newStage = clampStage((p.stage ?? 0) + 1);
        const newDue = calcNextDue(today, newStage);

        setProgress(userId, id, { stage: newStage, due: newDue });
        clearWrongToday(userId, id, today);

        const gained = addReviewCorrect(userId);
        playSfx("correct");

        if (gained) {
          playSfx("point");
          if (typeof onPointGained === "function") onPointGained();
        }

        renderList();
      }

      function onNg() {
        if (busy) return;
        const newStage = clampStage((p.stage ?? 0) - 1);
        const newDue = calcNextDue(today, newStage);

        setProgress(userId, id, { stage: newStage, due: newDue });
        markWrongToday(userId, id, today);

        playSfx("wrong");
        renderList();
      }

      function renderPhase() {
        if (phase === 0) {
          setActions(`<button class="btn blue" data-act="speak" type="button">いってみて</button>`);
          actions.querySelector('[data-act="speak"]').addEventListener("click", onSpeakStart);
          return;
        }
        if (phase === 1) {
          setActions(`<button class="btn blue" data-act="hear" type="button">せいかいをきく</button>`);
          actions.querySelector('[data-act="hear"]').addEventListener("click", onHearAnswer);
          return;
        }
        setActions(`
          <button class="btn ok" data-act="ok" type="button">○</button>
          <button class="btn ng" data-act="ng" type="button">×</button>
        `);
        actions.querySelector('[data-act="ok"]').addEventListener("click", onOk);
        actions.querySelector('[data-act="ng"]').addEventListener("click", onNg);
      }

      renderPhase();
      listEl.appendChild(card);
    }
  }

  catDrop.el.addEventListener("click", () => setTimeout(renderList, 0));
  renderList();

  return node;
}

function clampStage(n) {
  if (n < 0) return 0;
  if (n > 6) return 6;
  return n;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function wait(ms) {
  return new Promise(res => setTimeout(res, ms));
}

