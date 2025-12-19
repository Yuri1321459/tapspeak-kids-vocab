/* R-2-4: localStorage単一窓口 */
(() => {
  const NS = "TapSpeakVocab:v2025-01"; // R-12-1: 仕様外の拡張禁止（ここに集約）
  const DEFAULT_USER = () => ({
    points: 0,
    correct_mod10: 0,
    progress: {}, // wordId -> { enrolled_at, stage, due, wrong_today, wrong_today_date? }
    settings: {
      seVolume: 0.7,
      ttsRate: 1.0,
      voiceURI: "",
      pin: "1234",
      avatarDataUrl: ""
    }
  });

  function _loadRoot() {
    try {
      const raw = localStorage.getItem(NS);
      if (!raw) return { currentUserId: "", users: {} };
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== "object") return { currentUserId: "", users: {} };
      obj.users ||= {};
      obj.currentUserId ||= "";
      return obj;
    } catch {
      return { currentUserId: "", users: {} };
    }
  }

  function _saveRoot(root) {
    localStorage.setItem(NS, JSON.stringify(root));
  }

  function getTodayLocal() {
    // R-4-4/R-5-3: 端末ローカル YYYY-MM-DD（UTC禁止）
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function ensureUser(userId) {
    const root = _loadRoot();
    if (!root.users[userId]) root.users[userId] = DEFAULT_USER();
    _saveRoot(root);
  }

  function setCurrentUser(userId) {
    const root = _loadRoot();
    if (!root.users[userId]) root.users[userId] = DEFAULT_USER();
    root.currentUserId = userId;
    _saveRoot(root);
  }

  function getCurrentUserId() {
    return _loadRoot().currentUserId || "";
  }

  function getUser(userId) {
    const root = _loadRoot();
    if (!root.users[userId]) {
      root.users[userId] = DEFAULT_USER();
      _saveRoot(root);
    }
    return structuredClone(root.users[userId]);
  }

  function setUser(userId, userData) {
    const root = _loadRoot();
    root.users[userId] = userData;
    _saveRoot(root);
  }

  function getPoints(userId) {
    return getUser(userId).points || 0;
  }

  function addPoint(userId, delta) {
    const u = getUser(userId);
    u.points = Math.max(0, (u.points || 0) + delta);
    setUser(userId, u);
    return u.points;
  }

  function getAvatar(userId) {
    return getUser(userId).settings?.avatarDataUrl || "";
  }

  function setAvatar(userId, dataUrl) {
    const u = getUser(userId);
    u.settings ||= {};
    u.settings.avatarDataUrl = dataUrl || "";
    setUser(userId, u);
  }

  function getSettings(userId) {
    return getUser(userId).settings || DEFAULT_USER().settings;
  }

  function setSettings(userId, patch) {
    const u = getUser(userId);
    u.settings ||= {};
    Object.assign(u.settings, patch || {});
    setUser(userId, u);
    return u.settings;
  }

  function makeWordId(game, word_key) {
    // R-4-2: {game}:{word_key}
    return `${game}:${word_key}`;
  }

  function getProgress(userId) {
    return getUser(userId).progress || {};
  }

  function getWordProgress(userId, wordId) {
    const p = getProgress(userId)[wordId];
    if (!p) return null;
    // R-9-4: 翌日自然リセット（wrong_today_dateが今日でなければ解除扱い）
    const today = getTodayLocal();
    if (p.wrong_today && p.wrong_today_date && p.wrong_today_date !== today) {
      const u = getUser(userId);
      const np = u.progress?.[wordId];
      if (np) {
        np.wrong_today = false;
        np.wrong_today_date = "";
        u.progress[wordId] = np;
        setUser(userId, u);
        return structuredClone(np);
      }
    }
    return structuredClone(p);
  }

  function enrollWord(userId, wordId) {
    // R-5-3: Enroll時 stage=0 due=today enrolled_at=today
    const u = getUser(userId);
    u.progress ||= {};
    const today = getTodayLocal();
    u.progress[wordId] = {
      enrolled_at: today,
      stage: 0,
      due: today,
      wrong_today: false,
      wrong_today_date: ""
    };
    setUser(userId, u);
  }

  function unenrollWord(userId, wordId) {
    // R-5-3: progress削除
    const u = getUser(userId);
    if (u.progress && u.progress[wordId]) {
      delete u.progress[wordId];
      setUser(userId, u);
    }
  }

  function setWordProgress(userId, wordId, nextProgress) {
    const u = getUser(userId);
    u.progress ||= {};
    u.progress[wordId] = nextProgress;
    setUser(userId, u);
  }

  function listEnrolledDueWordIds(userId, today) {
    // R-9-2: due<=today && progressあり
    const u = getUser(userId);
    const p = u.progress || {};
    const out = [];
    for (const [wordId, pr] of Object.entries(p)) {
      const due = pr?.due || "9999-12-31";
      const wrong = !!pr?.wrong_today;
      const wrongDate = pr?.wrong_today_date || "";
      const dueOk = due <= today;
      const wrongOk = wrong && wrongDate === today;
      if (dueOk || wrongOk) out.push(wordId);
    }
    return out;
  }

  function incrementCorrectAndMaybePoint(userId) {
    // R-6-1: 10問○ごとに1ポイント（復習のみで呼ぶ）
    const u = getUser(userId);
    u.correct_mod10 = (u.correct_mod10 || 0) + 1;
    let gained = 0;
    if (u.correct_mod10 >= 10) {
      u.correct_mod10 = u.correct_mod10 % 10;
      u.points = (u.points || 0) + 1;
      gained = 1;
    }
    setUser(userId, u);
    return { points: u.points || 0, gained };
  }

  function resetPoints(userId) {
    const u = getUser(userId);
    u.points = 0;
    u.correct_mod10 = 0;
    setUser(userId, u);
  }

  function resetLearningKeepAvatar(userId) {
    const u = getUser(userId);
    const avatar = u.settings?.avatarDataUrl || "";
    const settings = u.settings || DEFAULT_USER().settings;
    u.progress = {};
    u.correct_mod10 = 0;
    u.points = 0;
    u.settings = { ...DEFAULT_USER().settings, ...settings, avatarDataUrl: avatar };
    setUser(userId, u);
  }

  function exportCurrentUserBackup(userId) {
    // R-11-2: 現在ユーザーのみJSON
    const u = getUser(userId);
    return {
      version: "v2025-01",
      userId,
      data: u
    };
  }

  function importCurrentUserBackup(userId, backupObj) {
    // R-11-2: 上書き（アバター保持）
    const current = getUser(userId);
    const keepAvatar = current.settings?.avatarDataUrl || "";
    const next = backupObj?.data && typeof backupObj.data === "object" ? backupObj.data : DEFAULT_USER();
    next.settings ||= DEFAULT_USER().settings;
    next.settings.avatarDataUrl = keepAvatar;
    setUser(userId, next);
  }

  window.AppStorage = {
    getTodayLocal,
    ensureUser,
    setCurrentUser,
    getCurrentUserId,
    getUser,
    setUser,
    getPoints,
    addPoint,
    getAvatar,
    setAvatar,
    getSettings,
    setSettings,
    makeWordId,
    getProgress,
    getWordProgress,
    enrollWord,
    unenrollWord,
    setWordProgress,
    listEnrolledDueWordIds,
    incrementCorrectAndMaybePoint,
    resetPoints,
    resetLearningKeepAvatar,
    exportCurrentUserBackup,
    importCurrentUserBackup
  };
})();
