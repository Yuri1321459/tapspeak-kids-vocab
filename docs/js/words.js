/* R-2-6: たんごモード */
(() => {
  let wordsCache = null;

  const STAGE_OPTIONS = [
    { key: "ぜんだんかい", label: "ぜんだんかい" },
    { key: "みとうろく", label: "みとうろく" },
    { key: "まだ", label: "まだ" },       // stage 0-1
    { key: "すこし", label: "すこし" },   // 2
    { key: "だいたい", label: "だいたい" }, // 3
    { key: "あんてい", label: "あんてい" }, // 4
    { key: "かなり", label: "かなり" },   // 5
    { key: "ていちゃく", label: "ていちゃく" } // 6
  ];

  function stageGroupOf(stage) {
    if (stage == null) return "みとうろく";
    if (stage <= 1) return "まだ";
    if (stage === 2) return "すこし";
    if (stage === 3) return "だいたい";
    if (stage === 4) return "あんてい";
    if (stage === 5) return "かなり";
    return "ていちゃく";
  }

  function imgPath(w) {
    // R-3-3: assets/games/{game}/{category_id}/{image_file}
    return `./assets/games/${w.game}/${w.category_id}/${w.image_file}`;
  }

  async function loadWords() {
    if (wordsCache) return wordsCache;
    const res = await fetch("./data/words.json", { cache: "no-store" });
    const data = await res.json();
    wordsCache = Array.isArray(data) ? data : (Array.isArray(data.words) ? data.words : []);
    return wordsCache;
  }

  function buildCategoryList(words) {
    const map = new Map();
    for (const w of words) {
      if (!w || w.enabled !== true) continue; // R-3-5
      const id = w.category_id || "";
      if (!id) continue;
      if (!map.has(id)) {
        const ja = w.category_label_ja || id;
        const kana = w.category_label_kana || "";
        map.set(id, { id, ja, kana });
      }
    }
    // R-3-4: category_id昇順
    return [...map.values()].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  }

  function applyFilters(words, { catSel, stageSel, progressById, userId }) {
    // R-3-4: sort (category_id asc -> sort_order asc)
    const sorted = words
      .filter(w => w && w.enabled === true)
      .slice()
      .sort((a, b) => {
        const c = String(a.category_id).localeCompare(String(b.category_id));
        if (c) return c;
        return (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0);
      });

    const catAll = catSel.has("ぜんかてごり") || catSel.size === 0;
    const stageAll = stageSel.has("ぜんだんかい") || stageSel.size === 0;

    return sorted.filter(w => {
      if (!w) return false;

      // category
      if (!catAll) {
        if (!catSel.has(w.category_id)) return false;
      }

      // stage
      if (!stageAll) {
        const wordId = window.AppStorage.makeWordId(w.game, w.word_key);
        const pr = progressById[wordId] || null;

        const isUnenrolled = !pr;
        if (stageSel.has("みとうろく")) {
          if (!isUnenrolled) {
            // みとうろく選択中でも他の条件ORなので、他の段階一致なら通す
          } else {
            return true; // みとうろく一致
          }
        }
        if (isUnenrolled) {
          // みとうろく未選択なら通さない（他段階一致不能）
          return false;
        }
        const grp = stageGroupOf(Number(pr.stage));
        if (!stageSel.has(grp)) return false;
      }

      return true;
    });
  }

  function renderFilterDropdown({ label, items, selected, onChange, grid2 = false }) {
    const dd = document.createElement("div");
    dd.className = "dd";

    const btn = document.createElement("button");
    btn.className = "ddBtn";
    btn.type = "button";
    btn.textContent = label;
    btn.addEventListener("click", () => {
      dd.classList.toggle("open");
    });

    const panel = document.createElement("div");
    panel.className = "ddPanel";

    const wrap = document.createElement("div");
    wrap.className = grid2 ? "grid2" : "";
    for (const it of items) {
      const row = document.createElement("label");
      row.className = "chk";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = selected.has(it.key);
      cb.addEventListener("change", () => onChange(it.key, cb.checked));

      const span = document.createElement("span");
      span.textContent = it.label;

      row.append(cb, span);
      wrap.append(row);
    }
    panel.append(wrap);

    // 外側クリックで閉じる
    document.addEventListener("click", (e) => {
      if (!dd.contains(e.target)) dd.classList.remove("open");
    });

    dd.append(btn, panel);
    return dd;
  }

  function makeWordsScreen({ mount, userId, onGoHome, onGoReview }) {
    const screen = document.createElement("div");
    screen.className = "screen center";

    const header = document.createElement("div");
    header.className = "header";

    // row1
    const r1 = document.createElement("div");
    r1.className = "headerRow";

    const left1 = document.createElement("div");
    left1.className = "headerLeft";

    const homeBtn = document.createElement("button");
    homeBtn.className = "iconBtn";
    homeBtn.type = "button";
    homeBtn.textContent = "🏠";
    homeBtn.addEventListener("click", () => onGoHome());

    left1.append(homeBtn);

    const right1 = document.createElement("div");
    right1.className = "headerRight";

    const points = document.createElement("div");
    points.className = "pill";
    points.id = "pointsPill";
    points.textContent = `⭐ ${window.AppStorage.getPoints(userId)}`;

    right1.append(points);
    r1.append(left1, right1);

    // row2
    const r2 = document.createElement("div");
    r2.className = "headerRow";

    const left2 = document.createElement("div");
    left2.className = "headerLeft";

    const btnWords = document.createElement("button");
    btnWords.className = "pill active";
    btnWords.type = "button";
    btnWords.textContent = "たんご";

    const btnReview = document.createElement("button");
    btnReview.className = "pill";
    btnReview.type = "button";
    btnReview.textContent = "ふくしゅう";
    btnReview.addEventListener("click", () => onGoReview());

    left2.append(btnWords, btnReview);

    const filters = document.createElement("div");
    filters.className = "filters";

    r2.append(left2, filters);

    header.append(r1, r2);
    screen.append(header);

    const list = document.createElement("div");
    list.className = "list";
    screen.append(list);

    mount.innerHTML = "";
    mount.append(screen);

    // selections
    const catSel = new Set(["ぜんかてごり"]); // R-9-1: 初期ぜんかてごり
    const stageSel = new Set(["ぜんだんかい"]); // R-9-1: デフォルト全選択扱い（ぜんだんかい）

    function setPointsUI() {
      const el = screen.querySelector("#pointsPill");
      if (el) el.textContent = `⭐ ${window.AppStorage.getPoints(userId)}`;
    }

    function renderCards(words) {
      const prog = window.AppStorage.getProgress(userId);
      list.innerHTML = "";
      for (const w of words) {
        const wordId = window.AppStorage.makeWordId(w.game, w.word_key);
        const pr = prog[wordId] || null;

        const card = document.createElement("div");
        card.className = "card";

        const imgBox = document.createElement("div");
        imgBox.className = "imgBox";

        const img = document.createElement("img");
        img.alt = w.word || "";
        img.src = imgPath(w);
        img.onerror = () => {
          // R-3-3: 404でも落ちない（プレースホルダは最小）
          img.style.display = "none";
          const ph = document.createElement("div");
          ph.className = "subtle";
          ph.textContent = w.word || "";
          imgBox.append(ph);
        };

        const overlay = document.createElement("div");
        overlay.className = "wordOverlay";
        overlay.style.display = "none";
        overlay.textContent = w.word || "";

        // R-7-4/R-10-2: 画像タップで単語表示置換 + 単語TTS
        imgBox.addEventListener("click", async () => {
          if (window.AppAudio.isLocked()) return;
          overlay.style.display = overlay.style.display === "none" ? "flex" : "none";
          window.AppAudio.lockTTS(true);
          try { await window.AppAudio.speak(w.word || ""); } finally { window.AppAudio.lockTTS(false); }
        });

        imgBox.append(img, overlay);

        const descRow = document.createElement("div");
        descRow.className = "descRow";

        const sp = document.createElement("button");
        sp.className = "spkr";
        sp.type = "button";
        sp.textContent = "🔊";
        // R-10-2: 説明TTS
        sp.addEventListener("click", async (e) => {
          e.stopPropagation();
          if (window.AppAudio.isLocked()) return;
          window.AppAudio.lockTTS(true);
          try { await window.AppAudio.speak(w.desc_lv2 || ""); } finally { window.AppAudio.lockTTS(false); }
        });

        const desc = document.createElement("p");
        desc.className = "desc";
        desc.textContent = w.desc_lv2 || "";

        descRow.append(sp, desc);

        const actions = document.createElement("div");
        actions.className = "actions";

        const btn = document.createElement("button");
        btn.type = "button";

        if (!pr) {
          // R-9-1: 未Enroll -> おぼえた
          btn.textContent = "おぼえた";
          btn.addEventListener("click", (e) => {
            e.stopPropagation();
            window.AppStorage.enrollWord(userId, wordId);
            window.AppAudio.playSE("correct"); // R-10-1
            setPointsUI();
            refresh(); // ボタン切替のため
          });
        } else {
          // R-9-1: Enroll済 -> わすれた（解除）
          btn.textContent = "わすれた";
          btn.addEventListener("click", (e) => {
            e.stopPropagation();
            window.AppStorage.unenrollWord(userId, wordId);
            window.AppAudio.playSE("wrong"); // R-10-1
            setPointsUI();
            refresh();
          });
        }
        actions.append(btn);

        card.append(imgBox, descRow, actions);
        list.append(card);
      }
    }

    let allWords = [];
    let categories = [];

    function refresh() {
      const prog = window.AppStorage.getProgress(userId);
      const filtered = applyFilters(allWords, { catSel, stageSel, progressById: prog, userId });
      renderCards(filtered);
    }

    function buildFilters() {
      filters.innerHTML = "";

      const catItems = [
        { key: "ぜんかてごり", label: "ぜんかてごり" },
        ...categories.map(c => ({
          key: c.id,
          label: c.kana ? `${c.ja}（${c.kana}）` : c.ja
        }))
      ];

      const ddCat = renderFilterDropdown({
        label: "ぶんるい",
        items: catItems,
        selected: catSel,
        grid2: true,
        onChange: (key, checked) => {
          // R-9-1: ぜんかてごり特別扱い（単独）
          if (key === "ぜんかてごり" && checked) {
            catSel.clear();
            catSel.add("ぜんかてごり");
          } else {
            if (checked) {
              catSel.delete("ぜんかてごり");
              catSel.add(key);
            } else {
              catSel.delete(key);
              if (catSel.size === 0) catSel.add("ぜんかてごり");
            }
          }
          refresh();
        }
      });

      const ddStage = renderFilterDropdown({
        label: "だんかい",
        items: STAGE_OPTIONS.map(o => ({ key: o.key, label: o.label })),
        selected: stageSel,
        onChange: (key, checked) => {
          // R-9-1: ぜんだんかいは特別扱い（単独）
          if (key === "ぜんだんかい" && checked) {
            stageSel.clear();
            stageSel.add("ぜんだんかい");
          } else {
            if (checked) {
              stageSel.delete("ぜんだんかい");
              stageSel.add(key);
            } else {
              stageSel.delete(key);
              if (stageSel.size === 0) stageSel.add("ぜんだんかい");
            }
          }
          refresh();
        }
      });

      filters.append(ddCat, ddStage);
    }

    (async () => {
      allWords = await loadWords();
      categories = buildCategoryList(allWords);
      buildFilters();
      refresh();
    })();

    return {
      updatePoints: setPointsUI
    };
  }

  window.AppWords = {
    loadWords,
    makeWordsScreen,
    stageGroupOf
  };
})();
