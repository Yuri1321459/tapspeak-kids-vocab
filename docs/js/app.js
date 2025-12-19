/* R-2-3: 画面遷移・共通ヘッダ・テーマ・親管理ver0.02 */
(() => {
    const app = document.getElementById("app");

    const USERS = [
        { id: "riona", label: "りおな", fallback: "R" },
        { id: "soma", label: "そうま", fallback: "S" }
    ];
    const DEV = { id: "dev", label: "開発者", fallback: "D" };

    function downloadJSON(filename, obj) {
        const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    function readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const fr = new FileReader();
            fr.onload = () => resolve(String(fr.result || ""));
            fr.onerror = () => reject(new Error("read error"));
            fr.readAsText(file);
        });
    }

    function renderUserSelect() {
        // R-8-1: ユーザー選択（ユーザーを選ぶだけ）
        app.className = "";
        const screen = document.createElement("div");
        screen.className = "screen center";

        const title = document.createElement("div");
        title.className = "title";
        title.textContent = "えいたんごをおぼえよう！";

        const box = document.createElement("div");
        box.className = "bigBtns";

        function userBtn(u, isDev = false) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = isDev ? "devBtn" : "userBtn";

            const avatarBox = document.createElement("div");
            avatarBox.className = "avatar";
            const av = window.AppStorage.getAvatar(u.id);
            if (av) {
                const img = document.createElement("img");
                img.src = av;
                img.alt = u.label;
                avatarBox.append(img);
            } else {
                avatarBox.textContent = u.fallback;
            }

            if (!isDev) {
                const left = document.createElement("div");
                left.style.display = "flex";
                left.style.alignItems = "center";
                left.style.gap = "12px";
                const name = document.createElement("div");
                name.textContent = u.label;
                left.append(avatarBox, name);

                const arrow = document.createElement("div");
                arrow.textContent = "›";
                arrow.style.fontSize = "26px";
                arrow.style.color = "#777";

                btn.innerHTML = "";
                btn.append(left, arrow);
            } else {
                btn.textContent = u.label;
            }

            btn.addEventListener("click", () => {
                window.AppStorage.setCurrentUser(u.id);
                renderHome();
            });

            return btn;
        }

        for (const u of USERS) box.append(userBtn(u, false));

        const devWrap = document.createElement("div");
        devWrap.className = "footerDev";
        devWrap.append(userBtn(DEV, true));

        screen.append(title, box, devWrap);
        app.innerHTML = "";
        app.append(screen);
    }

    function renderHome() {
        // R-8-2: 個人ホーム
        app.className = "";
        const userId = window.AppStorage.getCurrentUserId();
        if (!userId) return renderUserSelect();

        const screen = document.createElement("div");
        screen.className = "screen center";

        const top = document.createElement("div");
        top.className = "homeTop";

        const points = document.createElement("div");
        points.className = "pill";
        points.textContent = `⭐ ${window.AppStorage.getPoints(userId)}`;

        const switchBtn = document.createElement("button");
        switchBtn.className = "iconBtn";
        switchBtn.type = "button";
        switchBtn.textContent = "👤";
        // R-8-2: 右上ユーザー切替 → ユーザー選択
        switchBtn.addEventListener("click", () => renderUserSelect());

        top.append(points, switchBtn);

        // due count（フィルタ無関係・全体数）
        const today = window.AppStorage.getTodayLocal();
        const dueCount = window.AppStorage.listEnrolledDueWordIds(userId, today).length;

        const mid = document.createElement("div");
        mid.className = "homeMid";

        const btnWords = document.createElement("button");
        btnWords.type = "button";
        btnWords.className = "homeCard";
        btnWords.textContent = "たんご";
        btnWords.addEventListener("click", () => renderWords());

        const btnReview = document.createElement("button");
        btnReview.type = "button";
        btnReview.className = "homeCard";
        btnReview.textContent = `ふくしゅう：${dueCount}こ`;
        btnReview.addEventListener("click", () => renderReview());

        mid.append(btnWords, btnReview);

        const bottom = document.createElement("div");
        bottom.className = "homeSmall";

        const settingsBtn = document.createElement("button");
        settingsBtn.type = "button";
        // R-8-2/R-8-5: ホーム下部の「設定（漢字）」
        settingsBtn.textContent = "設定";
        settingsBtn.addEventListener("click", () => renderSettings());

        bottom.append(settingsBtn);

        screen.append(top, mid, bottom);
        app.innerHTML = "";
        app.append(screen);
    }

    function renderWords() {
        // R-8-3: ライト固定
        app.className = "";
        const userId = window.AppStorage.getCurrentUserId();
        if (!userId) return renderUserSelect();

        window.AppWords.makeWordsScreen({
            mount: app,
            userId,
            onGoHome: () => renderHome(),
            onGoReview: () => renderReview()
        });
    }

    function renderReview() {
        // R-8-4: この画面だけダーク（戻るとライトに戻る）
        app.className = "";
        const userId = window.AppStorage.getCurrentUserId();
        if (!userId) return renderUserSelect();

        window.AppReview.makeReviewScreen({
            mount: app,
            userId,
            onGoHome: () => renderHome(),
            onGoWords: () => renderWords()
        });
    }

    function renderSettings() {
        // R-8-5: 親向け・漢字100%
        app.className = "";
        const userId = window.AppStorage.getCurrentUserId();
        if (!userId) return renderUserSelect();

        const screen = document.createElement("div");
        screen.className = "screen center";

        const top = document.createElement("div");
        top.className = "homeTop";

        const back = document.createElement("button");
        back.className = "iconBtn";
        back.type = "button";
        back.textContent = "←";
        back.addEventListener("click", () => renderHome());

        const title = document.createElement("div");
        title.className = "pill";
        title.textContent = "設定";

        top.append(back, title);

        const card = document.createElement("div");
        card.className = "card";

        const s = window.AppStorage.getSettings(userId);

        function row(labelText, controlEl) {
            const wrap = document.createElement("div");
            wrap.style.display = "grid";
            wrap.style.gridTemplateColumns = "160px 1fr";
            wrap.style.gap = "12px";
            wrap.style.alignItems = "center";
            wrap.style.padding = "10px 0";
            wrap.style.borderBottom = "1px solid var(--line)";

            const lab = document.createElement("div");
            lab.style.fontWeight = "900";
            lab.textContent = labelText;

            wrap.append(lab, controlEl);
            return wrap;
        }

        // 効果音量（即鳴る）
        const seWrap = document.createElement("div");
        const se = document.createElement("input");
        se.type = "range";
        se.min = "0";
        se.max = "1";
        se.step = "0.05";
        se.value = String(s.seVolume ?? 0.7);
        se.style.width = "100%";
        se.addEventListener("input", () => {
            window.AppStorage.setSettings(userId, { seVolume: Number(se.value) });
            window.AppAudio.playSE("correct"); // R-11-1: 動かしたら即鳴る
        });
        seWrap.append(se);

        // 音読スピード
        const rateWrap = document.createElement("div");
        const rate = document.createElement("input");
        rate.type = "range";
        rate.min = "0.6";
        rate.max = "1.4";
        rate.step = "0.05";
        rate.value = String(s.ttsRate ?? 1.0);
        rate.style.width = "100%";
        rate.addEventListener("input", () => {
            window.AppStorage.setSettings(userId, { ttsRate: Number(rate.value) });
        });
        rateWrap.append(rate);

        // TTS音声選択
        const voiceSel = document.createElement("select");
        voiceSel.style.width = "100%";
        voiceSel.style.fontSize = "16px";
        voiceSel.style.padding = "10px";
        voiceSel.style.borderRadius = "12px";

        function loadVoices() {
            const voices = window.AppAudio.getEnglishVoices();
            voiceSel.innerHTML = "";
            const opt0 = document.createElement("option");
            opt0.value = "";
            opt0.textContent = "自動（推奨）";
            voiceSel.append(opt0);

            for (const v of voices) {
                const opt = document.createElement("option");
                opt.value = v.voiceURI;
                opt.textContent = `${v.name} (${v.lang})`;
                voiceSel.append(opt);
            }
            voiceSel.value = String(window.AppStorage.getSettings(userId).voiceURI || "");
        }

        loadVoices();
        setTimeout(loadVoices, 800);

        voiceSel.addEventListener("change", async () => {
            window.AppStorage.setSettings(userId, { voiceURI: String(voiceSel.value || "") });
            await window.AppAudio.speak("Hello", { voiceURI: String(voiceSel.value || "") });
        });

        // ユーザーアイコン変更（PIN不要）
        const avWrap = document.createElement("div");
        avWrap.style.display = "flex";
        avWrap.style.gap = "10px";
        avWrap.style.alignItems = "center";

        const avPreview = document.createElement("div");
        avPreview.className = "avatar";
        const curAv = window.AppStorage.getAvatar(userId);
        if (curAv) {
            const img = document.createElement("img");
            img.src = curAv;
            img.alt = "avatar";
            avPreview.append(img);
        } else {
            avPreview.textContent = " ";
        }

        const avInput = document.createElement("input");
        avInput.type = "file";
        avInput.accept = "image/*";
        avInput.addEventListener("change", async () => {
            const file = avInput.files?.[0];
            if (!file) return;
            const fr = new FileReader();
            fr.onload = () => {
                const dataUrl = String(fr.result || "");
                window.AppStorage.setAvatar(userId, dataUrl);
                avPreview.innerHTML = "";
                const img = document.createElement("img");
                img.src = dataUrl;
                img.alt = "avatar";
                avPreview.append(img);
            };
            fr.readAsDataURL(file);
        });

        avWrap.append(avPreview, avInput);

        // バックアップ作成（現在ユーザーのみ）
        const backupBtn = document.createElement("button");
        backupBtn.type = "button";
        backupBtn.textContent = "バックアップ作成";
        backupBtn.addEventListener("click", () => {
            const obj = window.AppStorage.exportCurrentUserBackup(userId);
            downloadJSON(`backup_${userId}.json`, obj);
        });

        // バックアップ読込（上書き・アバター保持）
        const importWrap = document.createElement("div");
        importWrap.style.display = "flex";
        importWrap.style.gap = "10px";
        importWrap.style.alignItems = "center";

        const importInput = document.createElement("input");
        importInput.type = "file";
        importInput.accept = "application/json,.json";
        const importBtn = document.createElement("button");
        importBtn.type = "button";
        importBtn.textContent = "バックアップ読込";

        importBtn.addEventListener("click", async () => {
            const file = importInput.files?.[0];
            if (!file) return;
            try {
                const txt = await readFileAsText(file);
                const obj = JSON.parse(txt);
                window.AppStorage.importCurrentUserBackup(userId, obj);
                renderSettings();
            } catch { }
        });

        importWrap.append(importInput, importBtn);

        // PIN変更
        const pinWrap = document.createElement("div");
        pinWrap.style.display = "flex";
        pinWrap.style.gap = "10px";

        const pinInput = document.createElement("input");
        pinInput.type = "password";
        pinInput.inputMode = "numeric";
        pinInput.placeholder = "新しいPIN（4桁）";
        pinInput.maxLength = 4;
        pinInput.style.flex = "1";
        pinInput.style.fontSize = "16px";
        pinInput.style.padding = "10px";
        pinInput.style.borderRadius = "12px";
        pinInput.style.border = "1px solid var(--line)";

        const pinBtn = document.createElement("button");
        pinBtn.type = "button";
        pinBtn.textContent = "PIN変更";
        pinBtn.addEventListener("click", () => {
            const v = String(pinInput.value || "");
            if (!/^\d{4}$/.test(v)) return;
            window.AppStorage.setSettings(userId, { pin: v });
            pinInput.value = "";
        });

        pinWrap.append(pinInput, pinBtn);

        function requirePin() {
            const cur = window.AppStorage.getSettings(userId).pin || "1234";
            const v = prompt("PINを入力してください");
            if (v == null) return false;
            return String(v) === String(cur);
        }

        // ポイントリセット（PIN要）
        const resetPointsBtn = document.createElement("button");
        resetPointsBtn.type = "button";
        resetPointsBtn.textContent = "ポイントリセット";
        resetPointsBtn.addEventListener("click", () => {
            if (!requirePin()) return;
            window.AppStorage.resetPoints(userId);
            renderSettings();
        });

        // 学習全リセット（PIN要・アバター保持）
        const resetAllBtn = document.createElement("button");
        resetAllBtn.type = "button";
        resetAllBtn.textContent = "学習全リセット";
        resetAllBtn.addEventListener("click", () => {
            if (!requirePin()) return;
            window.AppStorage.resetLearningKeepAvatar(userId);
            renderSettings();
        });

        const buttonsWrap = document.createElement("div");
        buttonsWrap.style.display = "grid";
        buttonsWrap.style.gridTemplateColumns = "1fr 1fr";
        buttonsWrap.style.gap = "10px";
        buttonsWrap.append(backupBtn, resetPointsBtn, resetAllBtn);

        card.append(
            row("効果音量", seWrap),
            row("音読スピード", rateWrap),
            row("音声（Voice）", voiceSel),
            row("ユーザーアイコン", avWrap),
            row("バックアップ作成", backupBtn),
            row("バックアップ読込", importWrap),
            row("PIN", pinWrap),
            buttonsWrap
        );

        screen.append(top, card);
        app.innerHTML = "";
        app.append(screen);
    }

    // 起動
    (() => {
        // R-4-1: ユーザーID riona/soma/dev
        for (const u of [...USERS, DEV]) window.AppStorage.ensureUser(u.id);

        // R-8-1-4: 起動直後は必ずユーザー選択画面（自動復元しない）
        renderUserSelect();
    })();


    window.AppNav = {
        userSelect: renderUserSelect,
        home: renderHome,
        words: renderWords,
        review: renderReview,
        settings: renderSettings
    };
})();

