import {
  ensureUser, getState, getProgress, setProgress, getTodayStr,
  addCorrect
} from "./storage.js";
import { playSfx, speakTTS, lockWhileSpeaking } from "./audio.js";
import { STAGE_GROUPS_EXPORT, makeMultiDropExport, wordIdExport } from "./words.js";

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function addDays(yyyyMMdd, days) {
  const [y,m,d] = yyyyMMdd.split("-").map(Number);
  const dt = new Date(y, m-1, d);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth()+1).padStart(2,"0");
  const dd = String(dt.getDate()).padStart(2,"0");
  return `${yy}-${mm}-${dd}`;
}

function nextIntervalDays(stage) {
  // stage 0..6
  switch(stage){
    case 0: return 0;
    case 1: return 1;
    case 2: return 3;
    case 3: return 7;
    case 4: return 14;
    case 5: return 30;
    case 6: return 365;
    default: return 0;
  }
}

function calcNextDue(today, newStage) {
  const days = nextIntervalDays(newStage);
  return addDays(today, days);
}

function isDue(progress, today) {
  return progress && progress.due && progress.due <= today;
}

export function renderReviewScreen({ words, categoryIndex, headerHost, onGoHome, onGoWords }) {
  const st = getState();
  const userId = st.currentUserId;
  if (!userId) return el(`<div></div>`);
  ensureUser(userId);

  const root = el(`<div class="screen">
    <div class="row between" style="margin:6px 0 2px">
      <div class="pill"><span>いま やる ことば</span><small id="dueCount">0こ</small></div>
      <div></div>
    </div>
    <div id="list" class="list"></div>
  </div>`);

  const listEl = root.querySelector("#list");
  const dueCountEl = root.querySelector("#dueCount");

  // Filters in header 2nd row
  const catOptions = categoryIndex.cats.map(c => ({
    key: c.id,
    label: `${c.label_ja}（${c.label_kana || ""}）`.replace("（）",""),
  }));

  const catDrop = makeMultiDropExport({
    title: "ぶんるい",
    allLabel: "ぜんかてごり",
    options: catOptions,
    defaultAllSelected: true,
    twoCols: true,
  });

  // ★復習にも「だんかい」フィルタを出す（仕様変更反映）
  const stageDrop = makeMultiDropExport({
    title: "だんかい",
    allLabel: "ぜんだんかい",
    options: STAGE_GROUPS_EXPORT.map(g => ({ key: g.key, label: g.label })),
    defaultAllSelected: false,
    twoCols: true,
  });
  stageDrop.setSelected(STAGE_GROUPS_EXPORT.map(g => g.key)); // 全選択

  headerHost.setSecondRow({
    mode: "review",
    catDropEl: catDrop.el,
    stageDropEl: stageDrop.el,
    onGoHome,
    onGoWords,
  });

  const today = getTodayStr();
  let locked = false;

  function setLocked(v){
    locked = v;
    root.querySelectorAll("button").forEach(b => {
      if (b.classList.contains("iconBtn") || b.classList.contains("tabBtn")) return;
      if (v) b.classList.add("disabled");
      else b.classList.remove("disabled");
    });
  }

  function getStageById(wordId){
    const p = getProgress(userId, wordId);
    return p ? (Number.isFinite(p.stage) ? p.stage : 0) : 0;
  }

  function stageOkByStage(stage){
    const sState = stageDrop.getState();
    const selected = sState.selected;
    if (selected.size === STAGE_GROUPS_EXPORT.length) return true;
    for (const g of STAGE_GROUPS_EXPORT) {
      if (!selected.has(g.key)) continue;
      if (g.test(stage)) return true;
    }
    return false;
  }

  function catOk(w){
    const cState = catDrop.getState();
    if (cState.all) return true;
    return cState.selected.has(w.category_id);
  }

  function buildDueList() {
    const items = [];
    for (const w of words) {
      if (!w.enabled) continue;
      if (!catOk(w)) continue;
      const id = wordIdExport(w);
      const p = getProgress(userId, id);
      if (!p) continue; // enrolledのみ
      const stage = getStageById(id);
      if (!stageOkByStage(stage)) continue; // ★だんかいフィルタ
      if (!isDue(p, today)) continue;       // dueのみ

      // ×を押したら「今日中は常に出題対象」
      // → wrongToday が true の場合も当然 due 扱いで出す（due条件は満たしている前提）
      items.push({ w, id, p, stage });
    }
    // 並び：カテゴリ昇順→sort_order
    items.sort((a,b) => {
      const c = String(a.w.category_id).localeCompare(String(b.w.category_id));
      if (c !== 0) return c;
      return (a.w.sort_order ?? 0) - (b.w.sort_order ?? 0);
    });
    return items;
  }

  function render() {
    const items = buildDueList();
    dueCountEl.textContent = `${items.length}こ`;
    listEl.innerHTML = "";

    for (const item of items) {
      const w = item.w;
      const id = item.id;
      const pNow = getProgress(userId, id);
      if (!pNow) continue;

      // 状態：1)いってみて 2)せいかいをきく 3)○×
      let phase = "try"; // try | listen | judge
      let showWord = false;

      const card = el(`
        <div class="card">
          <div class="wordGrid">
            <div class="thumbWrap" data-thumb="1"></div>
            <div>
              <p class="desc">${escapeHtml(w.desc_lv2 || "")}</p>
              <p class="notice">※ 段階番号は表示しません。</p>
            </div>
          </div>

          <div class="actions" data-actions="1"></div>
        </div>
      `);

      const wrap = card.querySelector('[data-thumb="1"]');
      function setThumb() {
        wrap.innerHTML = "";
        if (!showWord) {
          const img = document.createElement("img");
          img.className = "thumb";
          img.alt = "";
          img.src = `./assets/games/${w.game}/${w.category_id}/${w.image_file}`;
          wrap.appendChild(img);
        } else {
          const div = document.createElement("div");
          div.className = "wordInThumb";
          div.textContent = w.word || "";
          wrap.appendChild(div);
        }
      }
      setThumb();

      // 復習でも画像タップは「表示切替のみ」（発語はボタン仕様でやる）
      wrap.addEventListener("click", () => {
        showWord = !showWord;
        setThumb();
      });

      const act = card.querySelector('[data-actions="1"]');

      function renderActions() {
        act.innerHTML = "";

        if (phase === "try") {
          const b = el(`<button class="btn primary" type="button">いってみて</button>`);
          b.addEventListener("click", async () => {
            if (locked) return;
            playSfx("speak_start");
            await new Promise(r => setTimeout(r, 1000));
            phase = "listen";
            renderActions();
          });
          act.appendChild(b);
          return;
        }

        if (phase === "listen") {
          const b = el(`<button class="btn review" type="button">せいかいをきく</button>`);
          b.addEventListener("click", () => {
            if (locked) return;
            setLocked(true);
            speakTTS(w.word || "");
            lockWhileSpeaking((v) => setLocked(v));
            // speaking終了後に○×表示（簡易：少し待ってから判定に移す）
            const wait = setInterval(() => {
              try{
                if (!speechSynthesis.speaking) {
                  clearInterval(wait);
                  phase = "judge";
                  renderActions();
                }
              }catch{
                clearInterval(wait);
                phase = "judge";
                renderActions();
              }
            }, 120);
          });
          act.appendChild(b);
          return;
        }

        // judge
        const ok = el(`<button class="btn ok" type="button">○</button>`);
        const ng = el(`<button class="btn ng" type="button">×</button>`);

        ok.addEventListener("click", () => {
          const now = getProgress(userId, id);
          if (!now) return;

          const newStage = Math.min(6, (now.stage ?? 0) + 1);
          const due = calcNextDue(today, newStage);
          setProgress(userId, id, { stage: newStage, due, wrongToday: false });

          playSfx("correct"); // ★○＝correct

          const { gained } = addCorrect(userId);
          if (gained) {
            // ポイント演出 + SE（両方）
            playSfx("point");
            showPointSparkle("+1");
          }

          render(); // 一覧更新
        });

        ng.addEventListener("click", () => {
          const now = getProgress(userId, id);
          if (!now) return;

          const newStage = Math.max(0, (now.stage ?? 0) - 1);
          // ×：今日中は常に出題対象（wrongToday true）
          // stageは下げる、dueは「今日」に戻す
          setProgress(userId, id, { stage: newStage, due: today, wrongToday: true });

          playSfx("wrong");
          render();
        });

        act.appendChild(ok);
        act.appendChild(ng);
      }

      renderActions();
      listEl.appendChild(card);
    }
  }

  // ★フィルタ変更で確実に再描画
  catDrop.el.addEventListener("filterchange", render);
  stageDrop.el.addEventListener("filterchange", render);

  render();
  return root;
}

function showPointSparkle(text) {
  const w = document.createElement("div");
  w.className = "sparkleWrap";
  w.innerHTML = `<div class="sparkle">ポイント ${text}</div>`;
  document.body.appendChild(w);
  setTimeout(() => { w.remove(); }, 900);
}
