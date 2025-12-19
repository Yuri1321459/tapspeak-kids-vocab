/* R-2-7: ふくしゅうモード */
(() => {
  const STAGE_LABELS = [
    { key: "ぜんだんかい", label: "ぜんだんかい" },
    { key: "まだ", label: "まだ" },
    { key: "すこし", label: "すこし" },
    { key: "だいたい", label: "だいたい" },
    { key: "あんてい", label: "あんてい" },
    { key: "かなり", label: "かなり" },
    { key: "ていちゃく", label: "ていちゃく" }
  ];

  // R-5-1: stage間隔
  const STAGE_DAYS = [0, 1, 3, 7, 14, 30, 365];

  function addDaysYYYYMMDD(today, days) {
    const [y, m, d] = today.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + Number(days || 0));
    const yy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
  }

  function imgPath(w) {
    return `./assets/games/${w.game}/${w.category_id}/${w.image_file}`;
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

    document.addEventListener("click", (e) => {
      if (!dd.contains(e.target)) dd.classList.remove("open");
    });

    dd.append(btn, panel);
    return dd;
  }

  function buildCategoryList(words) {
    const map = new Map();
    for (const w of words) {
      if (!w || w.enabled !== true) continue;
      const id = w.category_id || "";
      if (!id) continue;
      if (!map.has(id)) {
        const ja = w.category_label_ja || id;
        const kana = w.category_label_kana || "";
        map.set(id, { id, ja, kana });
      }
    }
    return [...map.values()].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  }

  function stageGroupOf(stage) {
    if (stage <= 1) return "まだ";
    if (stage === 2) return "すこし";
    if (stage === 3) return "だいたい";
    if (stage === 4) return "あんてい";
    if (stage === 5) return "かなり";
    return "ていちゃく";
  }

  function makeReviewScreen({ mount, userId, onGoHome, onGoWords }) {
    const root = document.createElement("div");
    root.className = "screen center dark";

    const header = document.createElement("div");
    header.className = "header";

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

    const r2 = document.createElement("div");
    r2.className = "headerRow";

    const left2 = document.createElement("div");
    left2.className = "headerLeft";

    const btnWords = document.createElement("button");
    btnWords.className = "pill";
    btnWords.type = "button";
    btnWords.textContent = "たんご";
    btnWords.addEventListener("click", () => onGoWords());

    const btnReview = document.createElement("button");
    btnReview.className = "pill active";
    btnReview.type = "button";
    btnReview.textContent = "ふくしゅう";

    left2.append(btnWords, btnReview);

    const filters = document.createElement("div");
    filters.className = "filters";

    r2.append(left2, filters);

    header.append(r1, r2);
    root.append(header);

    const count = document.createElement("div");
    count.className = "reviewCount";
    count.textContent = "いま やる ことば 0こ";
    root.append(count);

    const list = document.createElement("div");
    list.className = "list";
    root.append(list);

    // popup/sparkle
    const popup = document.createElement("div");
    popup.className = "popup";
    popup.textContent = "☆1ポイントゲット！！";
    const sparkle = document.createElement("div");
    sparkle.className = "sparkle";
    sparkle.textContent = "✨✨✨";
    root.append(popup, sparkle);

    mount.innerHTML = "";
    mount.append(root);

    const catSel = new Set(["ぜんかてごり"]);
    const stageSel = new Set(["ぜんだんかい"]);

    let allWords = [];
    let categories = [];
    let wordById = new Map();

    function setPointsUI() {
      const el = root.querySelector("#pointsPill");
      if (el) el.textContent = `⭐ ${window.AppStorage.getPoints(userId)}`;
    }

    function showPointFx() {
      // R-6-2: point.mp3 + キラキラ + 0.5秒ポップアップ
      window.AppAudio.playSE("point");
      sparkle.classList.add("show");
      popup.classList.add("show");
      setTimeout(() => {
        sparkle.classList.remove("show");
        popup.classList.remove("show");
      }, 500);
    }

    function applyFiltersDue(today) {
      // R-9-2: enrolled && (due<=today OR wrong_today today) AND filters
      const dueIds = window.AppStorage.listEnrolledDueWordIds(userId, today);

      const catAll = catSel.has("ぜんかてごり") || catSel.size === 0;
      const stageAll = stageSel.has("ぜんだんかい") || stageSel.size === 0;

      const out = [];
      const prog = window.AppStorage.getProgress(userId);

      for (const wid of dueIds) {
        const w = wordById.get(wid);
        if (!w) continue;
        if (w.enabled !== true) continue;

        if (!catAll && !catSel.has(w.category_id)) continue;

        const pr = prog[wid];
        if (!pr) continue;

        if (!stageAll) {
          const grp = stageGroupOf(Number(pr.stage || 0));
          if (!stageSel.has(grp)) continue;
        }

        out.push(wid);
      }

      // 安定並び（words側の並び順）
      out.sort((a, b) => {
        const wa = wordById.get(a);
        const wb = wordById.get(b);
        const c = String(wa.category_id).localeCompare(String(wb.category_id));
        if (c) return c;
        return (Number(wa.sort_order) || 0) - (Number(wb.sort_order) || 0);
      });

      return out;
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
        items: STAGE_LABELS,
        selected: stageSel,
        onChange: (key, checked) => {
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

    function renderCards(dueWordIds, today) {
      list.innerHTML = "";

      const progAll = window.AppStorage.getProgress(userId);

      for (const wid of dueWordIds) {
        const w = wordById.get(wid);
        if (!w) continue;

        const pr = progAll[wid];
        if (!pr) continue;

        const card = document.createElement("div");
        card.className = "card";

        const imgBox = document.createElement("div");
        imgBox.className = "imgBox";

        const img = document.createElement("img");
        img.alt = w.word || "";
        img.src = imgPath(w);
        img.onerror = () => {
          img.style.display = "none";
          const ph = document.createElement("div");
          ph.className = "subtle";
          ph.textContent = w.word || "";
          imgBox.append(ph);
        };

        // R-7-4: 画像タップで単語表示置換（復習でも共通）
        const overlay = document.createElement("div");
        overlay.className = "wordOverlay";
        overlay.style.display = "none";
        overlay.textContent = w.word || "";

        imgBox.addEventListener("click", () => {
          overlay.style.display = overlay.style.display === "none" ? "flex" : "none";
        });

        imgBox.append(img, overlay);

        const descRow = document.createElement("div");
        descRow.className = "descRow";

        const sp = document.createElement("button");
        sp.className = "spkr";
        sp.type = "button";
        sp.textContent = "🔊";
        // R-10-2: 説明TTSは仕様にない（復習は「せいかいをきく」で単語のみ）
        sp.style.visibility = "hidden";

        const desc = document.createElement("p");
        desc.className = "desc";
        desc.textContent = w.desc_lv2 || "";
        descRow.append(sp, desc);

        const actions = document.createElement("div");
        actions.className = "actions";

        // R-9-3: 初期は「いってみて」だけ
        const btnTry = document.createElement("button");
        btnTry.type = "button";
        btnTry.textContent = "いってみて";

        const btnHear = document.createElement("button");
        btnHear.type = "button";
        btnHear.textContent = "せいかいをきく";
        btnHear.style.display = "none";

        const btnO = document.createElement("button");
        btnO.type = "button";
        btnO.textContent = "○";
        btnO.style.display = "none";

        const btnX = document.createElement("button");
        btnX.type = "button";
        btnX.textContent = "×";
        btnX.style.display = "none";

        function setDisabledAll(disabled) {
          btnTry.disabled = disabled;
          btnHear.disabled = disabled;
          btnO.disabled = disabled;
          btnX.disabled = disabled;
        }

        btnTry.addEventListener("click", async (e) => {
          e.stopPropagation();
          if (window.AppAudio.isLocked()) return;

          // R-10-1: speak_start.mp3（重ね再生禁止）
          window.AppAudio.playSE("speak_start");
          setDisabledAll(true);
          // R-9-3: 1秒待機 → 置換
          setTimeout(() => {
            btnTry.style.display = "none";
            btnHear.style.display = "block";
            setDisabledAll(false);
          }, 1000);
        });

        btnHear.addEventListener("click", async (e) => {
          e.stopPropagation();
          if (window.AppAudio.isLocked()) return;

          // R-9-3: 再生中は他操作不可
          window.AppAudio.lockTTS(true);
          setDisabledAll(true);
          try {
            await window.AppAudio.speak(w.word || "");
          } finally {
            window.AppAudio.lockTTS(false);
          }
          // R-9-3: 終了後に ○/×
          btnO.style.display = "block";
          btnX.style.display = "block";
          setDisabledAll(false);
        });

        btnO.addEventListener("click", (e) => {
          e.stopPropagation();
          // R-9-3: 判定前変更禁止（ここから変更）
          const cur = window.AppStorage.getWordProgress(userId, wid);
          if (!cur) return;

          // R-5-2: ○ stage+1（上限6） stage6でも上下あり
          const nextStage = Math.min(6, Number(cur.stage || 0) + 1);
          const nextDue = addDaysYYYYMMDD(today, STAGE_DAYS[nextStage]);

          cur.stage = nextStage;
          cur.due = nextDue;
          cur.wrong_today = false;
          cur.wrong_today_date = "";

          window.AppStorage.setWordProgress(userId, wid, cur);
          window.AppAudio.playSE("correct");

          // R-6-1: 10問○ごとに1ポイント（復習のみ）
          const { gained } = window.AppStorage.incrementCorrectAndMaybePoint(userId);
          setPointsUI();
          if (gained) showPointFx();

          refresh();
        });

        btnX.addEventListener("click", (e) => {
          e.stopPropagation();
          const cur = window.AppStorage.getWordProgress(userId, wid);
          if (!cur) return;

          // R-5-2: × stage-1（下限0）
          const nextStage = Math.max(0, Number(cur.stage || 0) - 1);
          cur.stage = nextStage;

          // R-9-4: 当日中は○になるまで何度でも出題（フラグ化）
          cur.wrong_today = true;
          cur.wrong_today_date = today;
          // due<=todayを確実化
          cur.due = today;

          window.AppStorage.setWordProgress(userId, wid, cur);
          window.AppAudio.playSE("wrong");
          refresh();
        });

        actions.append(btnTry, btnHear, btnO, btnX);

        card.append(imgBox, descRow, actions);
        list.append(card);
      }
    }

    function refresh() {
      const today = window.AppStorage.getTodayLocal();
      const dueFiltered = applyFiltersDue(today);

      // R-8-4: 「いま やる ことば ◯こ」(フィルタ適用後)
      count.textContent = `いま やる ことば ${dueFiltered.length}こ`;

      renderCards(dueFiltered, today);
    }

    (async () => {
      allWords = await window.AppWords.loadWords();
      categories = buildCategoryList(allWords);

      wordById = new Map();
      for (const w of allWords) {
        if (!w || w.enabled !== true) continue;
        const wid = window.AppStorage.makeWordId(w.game, w.word_key);
        wordById.set(wid, w);
      }

      buildFilters();
      refresh();
    })();

    return { refresh, updatePoints: setPointsUI };
  }

  window.AppReview = {
    makeReviewScreen
  };
})();
