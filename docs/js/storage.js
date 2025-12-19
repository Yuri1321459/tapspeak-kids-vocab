const KEY = "tapspeak_state_v1";

function defaultState() {
  return {
    currentUserId: null,
    users: {
      riona: { id: "riona", label: "りおな", points: 0 },
      soma: { id: "soma", label: "そうま", points: 0 },
    },
    progressByUser: {},          // progressByUser[userId][wordId] = { stage, due }
    wrongTodayByUser: {},        // wrongTodayByUser[userId] = { date, map: { [wordId]: true } }
    reviewStatsByUser: {},       // reviewStatsByUser[userId] = { correctSincePoint: number }
    avatarsByUser: {},           // avatarsByUser[userId] = dataURL
    pin: "",
    sfxVolume: 0.8,              // 0.0 - 1.0
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

/* ===== Avatar ===== */
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

/* ===== PIN ===== */
export function setPin(pin) {
  const st = getState();
  st.pin = (pin || "").trim();
  setState(st);
}

export function getPin() {
  const st = getState();
  return (st.pin || "").trim();
}

/* ===== SE音量 ===== */
export function getSfxVolume() {
  const st = getState();
  const v = Number(st.sfxVolume);
  if (Number.isFinite(v)) return Math.max(0, Math.min(1, v));
  return 0.8;
}

export function setSfxVolume(v01) {
  const st = getState();
  const v = Number(v01);
  st.sfxVolume = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.8;
  setState(st);
}

/* ===== Progress ===== */
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

/* ===== Wrong today flags ===== */
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

/* ===== Points (review only) =====
   return true if point gained this time
*/
export function addReviewCorrect(userId) {
  const st = getState();
  ensureUser(userId);
  st.reviewStatsByUser = st.reviewStatsByUser || {};
  const rs = st.reviewStatsByUser[userId] || { correctSincePoint: 0 };

  rs.correctSincePoint += 1;

  let gained = false;
  if (rs.correctSincePoint >= 10) {
    rs.correctSincePoint = 0;
    st.users[userId].points = (st.users[userId].points || 0) + 1;
    gained = true;
  }

  st.reviewStatsByUser[userId] = rs;
  setState(st);
  return gained;
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
  st.users[userId].points = 0;
  setState(st);
}

/* ===== Backup ===== */
export function exportBackupJson() {
  const st = getState();
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
    sfxVolume: st.sfxVolume ?? 0.8,
  };
  return JSON.stringify(payload, null, 2);
}

export function importBackupJson(text) {
  const obj = JSON.parse(text);
  if (!obj || typeof obj !== "object") throw new Error("bad");

  const st = defaultState();
  st.currentUserId = obj.currentUserId ?? null;
  st.users = obj.users ?? st.users;
  st.progressByUser = obj.progressByUser ?? {};
  st.wrongTodayByUser = obj.wrongTodayByUser ?? {};
  st.reviewStatsByUser = obj.reviewStatsByUser ?? {};
  st.avatarsByUser = obj.avatarsByUser ?? {};
  st.pin = obj.pin ?? "";
  st.sfxVolume = obj.sfxVolume ?? 0.8;

  setState(st);
}
