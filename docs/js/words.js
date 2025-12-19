import { ensureUser, getState, getProgress, setProgress, deleteProgress } from "./storage.js";

export async function loadWords(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("words load fail");
  const data = await res.json();

  // 受け入れる形式：
  // A) [ {...}, {...} ]
  // B) { words: [ {...}, {...} ], version, generated_at }
  let arr = null;
  if (Array.isArray(data)) {
    arr = data;
  } else if (data && Array.isArray(data.words)) {
    arr = data.words;
  } else {
    throw new Error("words.json format invalid");
  }

  // enabled true only
  return arr.filter(x => x && x.enabled === true);
}

export function buildCategoryIndex(words) {
  const map = new Map(); // category_id -> {id, label_ja, label_kana}
  for (const w of words) {
    if (!map.has(w.category_id)) {
      map.set(w.category_id, {
        id: w.category_id,
        label_ja: w.category_label_ja || w.category_id,
        label_kana: w.category_label_kana || "",
      });
    }
  }
  // sort by category_id asc
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

function sortWordsInCategory(words) {
  // category_id asc already filtered; within category: sort_order asc then word asc
  return [...words].sort((a,b) => {
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

export function renderWordsScreen({
  words,
  categoryIndex,
  onGoHome,
  onGoReview,
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

  const cats = categoryIndex.cats;
  const defaultCat = cats[0]?.id || "";
  const userStateKey = `words_selectedCat_${userId}`;
  let selectedCat = localStorage.getItem(userStateKey) || defaultCat;

  const node = el(`
    <div class="words-theme">
      ${topBarHtml}
      <div class="screen">
        <div class="tabrow">
          <button class="tabbtn active" id="tabWords" type="button">たんご</button>
          <button class="tabbtn" id="tabReview" type="button">ふくしゅう</button>
        </div>

        <div class="hr"></div>

        <div class="row" style="justify-content:space-between">
          <div class="selectwrap">
            <select class="select" id="catSelect" aria-label="category"></select>
          </div>
          <button class="iconbtn" id="btnHome" type="button">ほーむ</button>
        </div>

        <div class="list" id="list"></div>
      </div>
    </div>
  `);

  const btnSwitch = node.querySelector("#btnUserSwitch");
  if (btnSwitch) btnSwitch.addEventListener("click", onUserSwitch);

  node.querySelector("#btnHome").addEventListener("click", onGoHome);
  node.querySelector("#tabReview").addEventListener("click", onGoReview);

  // category select
  const sel = node.querySelector("#catSelect");
  for (const c of cats) {
    const opt = document.createElement("option");
    opt.value = c.id;
    const kana = c.label_kana ? `（${c.label_kana}）` : "";
    opt.textContent = `${c.label_ja}${kana}`;
    sel.appendChild(opt);
  }
  if (cats.some(c => c.id === selectedCat)) sel.value = selectedCat;
  else sel.value = defaultCat;

  const listEl = node.querySelector("#list");

  function renderList() {
    selectedCat = sel.value;
    localStorage.setItem(userStateKey, selectedCat);

    const items = sortWordsInCategory(words.filter(w => w.category_id === selectedCat));
    listEl.innerHTML = "";

    for (const w of items) {
      const id = wordId(w);
      const p = getProgress(userId, id);
      const enrolled = !!p;

      const card = el(`
        <div class="card">
          <div class="wordgrid">
            <img class="thumb" alt="" src="${imgSrc(w)}" />
            <div>
              <div class="wtitle hidden" data-hidden="1">（たっぷ してね）</div>
              <p class="wdesc">${escapeHtml(w.desc_lv2 || "")}</p>
            </div>
          </div>

          <div class="actions">
            <button class="btn blue" data-act="speak" type="button">いってみて</button>
            <button class="btn ok" data-act="remember" type="button">おぼえた</button>
            <button class="btn ng" data-act="forget" type="button">わすれた</button>
          </div>

          <div class="note" style="margin-top:8px">
            ${enrolled ? "※ ふくしゅう に はいってるよ" : "※ まだ ふくしゅう に ないよ"}
          </div>
        </div>
      `);

      const titleEl = card.querySelector(".wtitle");
      let revealed = false;

      card.querySelector(".thumb").addEventListener("click", () => {
        revealed = !revealed;
        if (revealed) {
          titleEl.classList.remove("hidden");
          titleEl.dataset.hidden = "0";
          titleEl.textContent = w.word;
          speakTTS(w.word);
        } else {
          titleEl.classList.add("hidden");
          titleEl.dataset.hidden = "1";
          titleEl.textContent = "（たっぷ してね）";
        }
      });

      card.querySelector('[data-act="speak"]').addEventListener("click", () => {
        playSfx("speak_start");
        speakTTS(w.word);
      });

      card.querySelector('[data-act="remember"]').addEventListener("click", () => {
        const t = todayStr();
        const newP = { stage: 0, due: t };
        setProgress(userId, id, newP);
        playSfx("point");
        renderList();
      });

      card.querySelector('[data-act="forget"]').addEventListener("click", () => {
        deleteProgress(userId, id);
        playSfx("point");
        renderList();
      });

      listEl.appendChild(card);
    }
  }

  sel.addEventListener("change", renderList);
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
