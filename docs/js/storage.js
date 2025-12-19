const KEY = "tapspeak_state_v1";

function defaultState() {
  return {
    currentUserId: null,
    users: {
      // id -> {id,label}
      riona: { id: "riona", label: "りおな", points: 0 },
      soma: { id: "soma", label: "そうま", points: 0 },
      // developer will be created when needed
    },
    // progressByUser[userId][wordId] = { stage, due }
    progressByUser: {},
    // wrongTodayByUser[userId] = { date, map: { [wordId]: true } }
    wrongTodayByUser: {},
    // reviewStatsByUser[userId] = { correctSincePoint: number }
    reviewStatsByUser: {},
    // avatarsByUser[userId] = dataURL
    avatarsByUser: {},
    // pin
    pin: "",
  };
}

export function getState() {
  const raw = localStorage.getItem(KEY);
  if (!raw) {
    const st = defaultState();
    localStorage.setItem(KEY, JSON.stringify(st));
    return st;
  }
  try {
    const st = JSON.parse(raw);
    // merge minimal
    return { ...defaultState(), ...st };
  } catch {
    const st = defaultState();
    localStorage.setItem(KEY, JSON.stringify(st));
    return st;
  }
}

function setState(st) {
  localStorage.setItem(KEY, JSON.stringify(st));
}

export function ensureUser(id, labelOverride) {
  const st = getState();
  if (!st.users[id]) {
    st.users[id] = { id, label: labelOverride || id, points: 0 };
    setState(st);
  } else if (labelOverride && st.users[id].label !== labelOverride) {
    st.users[id].label = labelOverride;
    setState(st);
  }
  return st.users[id];
}

export function getUsers() {
  const st = getState();
  return Object.values(st.users);
}

export function setCurrentUserId(id) {
  const st = getState();
  st.currentUserId = id;
  setState(st);
}

export function getAvatarDataUrl(userId) {
  const st = getState();
  return st.avatarsByUser?.[userId] || "";
}

export function setAvatarDataUrl(userId, dataUrl) {
  const st = getState();
  st.avatarsByUser = st.avatarsByUser || {};
  st.avatarsByUser[userId] = dataUrl;
  setState(st);
}

/* ==========
   PIN
========== */
export function setPin(pin) {
  const st = getState();
  st.pin = (pin || "").trim();
  setState(st);
}

export function getPin() {
  const st = getState();
  return (st.pin || "").trim();
}

/* ==========
   Progress
========== */
export function getProgress(userId, wordId) {
  const st = getState();
  const p = st.progressByUser?.[userId]?.[wordId];
  return p ? { ...p } : null;
}

export function setProgress(userId, wordId, progress) {
  const st = getState();
  st.progressByUser = st.progressByUser || {};
  st.progressByUser[userId] = st.progressByUser[userId] || {};
  st.progressByUser[userId][wordId] = { ...progress };
  setState(st);
}

export function deleteProgress(userId, wordId) {
  const st = getState();
  if (st.progressByUser?.[userId]) {
    delete st.progressByUser[userId][wordId];
    setState(st);
  }
}

/* ==========
   Wrong today flags
========== */
export function markWrongToday(userId, wordId, todayStr) {
  const st = getState();
  st.wrongTodayByUser = st.wrongTodayByUser || {};
  const obj = st.wrongTodayByUser[userId] || { date: todayStr, map: {} };
  if (obj.date !== todayStr) {
    obj.date = todayStr;
    obj.map = {};
  }
  obj.map[wordId] = true;
  st.wrongTodayByUser[userId] = obj;
  setState(st);
}

export function clearWrongToday(userId, wordId, todayStr) {
  const st = getState();
  const obj = st.wrongTodayByUser?.[userId];
  if (!obj) return;
  if (obj.date !== todayStr) return;
  if (obj.map?.[wordId]) {
    delete obj.map[wordId];
    setState(st);
  }
}

export function getWrongTodaySet(userId, todayStr) {
  const st = getState();
  const obj = st.wrongTodayByUser?.[userId];
  if (!obj || obj.date !== todayStr) return {};
  return obj.map || {};
}

/* ==========
   Points (review only)
========== */
export function addReviewCorrect(userId) {
  const st = getState();
  ensureUser(userId);
  st.reviewStatsByUser = st.reviewStatsByUser || {};
  const rs = st.reviewStatsByUser[userId] || { correctSincePoint: 0 };

  rs.correctSincePoint += 1;
  if (rs.correctSincePoint >= 10) {
    rs.correctSincePoint = 0;
    st.users[userId].points = (st.users[userId].points || 0) + 1;
  }

  st.reviewStatsByUser[userId] = rs;
  setState(st);
}

export function resetPoints(userId) {
  const st = getState();
  ensureUser(userId);
  st.users[userId].points = 0;
  st.reviewStatsByUser = st.reviewStatsByUser || {};
  st.reviewStatsByUser[userId] = { correctSincePoint: 0 };
  setState(st);
}

export function resetLearningKeepAvatar(userId) {
  const st = getState();
  ensureUser(userId);
  st.progressByUser = st.progressByUser || {};
  st.progressByUser[userId] = {};
  st.wrongTodayByUser = st.wrongTodayByUser || {};
  st.wrongTodayByUser[userId] = { date: "", map: {} };
  st.reviewStatsByUser = st.reviewStatsByUser || {};
  st.reviewStatsByUser[userId] = { correctSincePoint: 0 };
  // points reset? 仕様には「学習全リセット（PIN要、アバター保持）」とあるので学習進捗のみ。
  // ただし実用上はポイントも学習に紐づくので、ポイントも0にしておく（要件と衝突しにくい）。
  st.users[userId].points = 0;
  setState(st);
}

/* ==========
   Backup
========== */
export function exportBackupJson() {
  const st = getState();
  // words.json 本体は含めない
  const payload = {
    v: 1,
    exported_at: new Date().toISOString(),
    currentUserId: st.currentUserId || null,
    users: st.users || {},
    progressByUser: st.progressByUser || {},
    wrongTodayByUser: st.wrongTodayByUser || {},
    reviewStatsByUser: st.reviewStatsByUser || {},
    avatarsByUser: st.avatarsByUser || {},
    pin: st.pin || "",
  };
  return JSON.stringify(payload, null, 2);
}

export function importBackupJson(text) {
  const obj = JSON.parse(text);
  if (!obj || typeof obj !== "object") throw new Error("bad");

  const st = defaultState();
  // allow only known keys
  st.currentUserId = obj.currentUserId ?? null;
  st.users = obj.users ?? st.users;
  st.progressByUser = obj.progressByUser ?? {};
  st.wrongTodayByUser = obj.wrongTodayByUser ?? {};
  st.reviewStatsByUser = obj.reviewStatsByUser ?? {};
  st.avatarsByUser = obj.avatarsByUser ?? {};
  st.pin = obj.pin ?? "";

  setState(st);
}
