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
import { calcNextDue } from "./words.js";

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

export function renderReviewScreen({
  words,
  categoryIndex,
  onGoHome,
  onGoWords,
  onGoSelect,
  topBarHtml,
  onUserSwitch,
  playSfx,
  speakTTS,
  todayStr,
}) {
  const st = getState();
  const userId = st.currentUserId;
  if (!userId) return el(`<div></div>`);
  ensureUser(userId);

  const today = todayStr();
  const wrongSet = getWrongTodaySet(userId, today);

  const node = el(`
    <div>
      ${topBarHtml}
      <div class="screen">
        <div class="tabrow">
          <button class="tabbtn" id="tabWords" type="button">たんご</button>
          <button class="tabbtn active" id="tabReview" type="button">ふくしゅう</button>
        </div>

        <div class="hr"></div>

        <div class="row" style="justify-content:space-between">
          <div class="row" style="gap:10px">
            <div class="selectwrap">
              <select class="select" id="catSelect"></select>
            </div>
            <div class="selectwrap">
              <select class="select" id="stageSelect"></select>
            </div>
          </div>
          <button class="iconbtn" id="btnHome" type="button">ほーむ</button>
        </div>

        <div class="hr"></div>

        <div class="sectiontitle">いま やる ことば</div>
        <div class="list" id="list"></div>

        <div class="hr"></div>
        <div class="sectiontitle">ふくしゅう する ことば</div>
        <div class="note">※ × を おす と きょう は ○ まで なんどでも でるよ</div>
      </div>
    </div>
  `);

  const btnSwitch = node.querySelector("#btnUserSwitch");
  if (btnSwitch) btnSwitch.addEventListener("click", onUserSwitch);

  node.querySelector("#btnHome").addEventListener("click", onGoHome);
  node.querySelector("#tabWords").addEventListener("click", onGoWords);

  // category options
  const cats = categoryIndex.cats;
  const catSel = node.querySelector("#catSelect");
  const stageSel = node.querySelector("#stageSelect");

  // all category
  catSel.appendChild(new Option("ぜんかてごり", "__all__"));
  for (const c of cats) {
    const kana = c.label_kana ? `（${c.label_kana}）` : "";
    catSel.appendChild(new Option(`${c.label_ja}${kana}`, c.id));
  }

  // stage options (UIに数値は出さない)
  stageSel.appendChild(new Option("ぜんすてーじ", "__all__"));
  stageSel.appendChild(new Option("0: きょう", "0"));
  stageSel.appendChild(new Option("1: あした", "1"));
  stageSel.appendChild(new Option("2: 3にち", "2"));
  stageSel.appendChild(new Option("3: 7にち", "3"));
  stageSel.appendChild(new Option("4: 14にち", "4"));
  stageSel.appendChild(new Option("5: 30にち", "5"));
  stageSel.appendChild(new Option("6: 1ねん", "6"));

  // remember filter values per user
  const keyCat = `review_cat_${userId}`;
  const keyStage = `review_stage_${userId}`;
  catSel.value = localStorage.getItem(keyCat) || "__all__";
  stageSel.value = localStorage.getItem(keyStage) || "__all__";

  const listEl = node.querySelector("#list");

  function buildDueList() {
    const st2 = getState();
    const prog = st2.progressByUser?.[userId] || {};
    const wrong = getWrongTodaySet(userId, today);

    const pickCat = catSel.value;
    const pickStage = stageSel.value;

    const dueWords = [];
    for (const w of words) {
      const id = wordId(w);
      const p = prog[id];
      if (!p) continue;

      // due OR wrongToday flag
      const isDue = (p.due || "") <= today;
      const isWrongToday = !!wrong[id];
      if (!isDue && !isWrongToday) continue;

      // AND filter: category × stage
      if (pickCat !== "__all__" && w.category_id !== pickCat) continue;
      if (pickStage !== "__all__" && String(p.stage) !== String(pickStage)) continue;

      dueWords.push({ w, p, id, isWrongToday });
    }

    dueWords.sort((a,b) => sortByCategoryThenOrder(a.w, b.w));
    return dueWords;
  }

  function renderList() {
    localStorage.setItem(keyCat, catSel.value);
    localStorage.setItem(keyStage, stageSel.value);

    const items = buildDueList();
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
      const card = el(`
        <div class="card">
          <div class="wordgrid">
            <img class="thumb" alt="" src="${imgSrc(w)}" />
            <div>
              <div class="wtitle hidden">（たっぷ してね）</div>
              <p class="wdesc">${escapeHtml(w.desc_lv2 || "")}</p>
            </div>
          </div>

          <div class="actions">
            <button class="btn blue" data-act="speak" type="button">いってみて</button>
            <button class="btn ok" data-act="ok" type="button">○</button>
            <button class="btn ng" data-act="ng" type="button">×</button>
          </div>
        </div>
      `);

      const titleEl = card.querySelector(".wtitle");
      let revealed = false;

      card.querySelector(".thumb").addEventListener("click", () => {
        revealed = !revealed;
        if (revealed) {
          titleEl.classList.remove("hidden");
          titleEl.textContent = w.word;
          speakTTS(w.word);
        } else {
          titleEl.classList.add("hidden");
          titleEl.textContent = "（たっぷ してね）";
        }
      });

      card.querySelector('[data-act="speak"]').addEventListener("click", () => {
        playSfx("speak_start");
        speakTTS(w.word);
      });

      // ○: stage +1 / due更新 / wrongToday解除 / ポイント判定（10で+1）
      card.querySelector('[data-act="ok"]').addEventListener("click", () => {
        const newStage = clampStage((p.stage ?? 0) + 1);
        const newDue = calcNextDue(today, newStage);

        setProgress(userId, id, { stage: newStage, due: newDue });
        clearWrongToday(userId, id, today);

        addReviewCorrect(userId);
        playSfx("correct");

        renderList();
      });

      // ×: stage -1 / due更新 / 今日中フラグ
      card.querySelector('[data-act="ng"]').addEventListener("click", () => {
        const newStage = clampStage((p.stage ?? 0) - 1);
        const newDue = calcNextDue(today, newStage);

        setProgress(userId, id, { stage: newStage, due: newDue });
        markWrongToday(userId, id, today);

        playSfx("wrong");
        renderList();
      });

      listEl.appendChild(card);
    }
  }

  catSel.addEventListener("change", renderList);
  stageSel.addEventListener("change", renderList);

  renderList();
  return node;
}

function clampStage(n) {
  if (n < 0) return 0;
  if (n > 6) return 6; // stageは0〜6固定
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
