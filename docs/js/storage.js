const LS_KEY = "tapspeak_v1";

function loadAll() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveAll(obj) {
  localStorage.setItem(LS_KEY, JSON.stringify(obj));
}

function todayLocalYYYYMMDD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function initIfNeeded() {
  let db = loadAll();
  if (!db || typeof db !== "object") {
    db = {
      schema: 1,
      users: {
        riona: { name: "りおな", initial: "R", iconDataUrl: null, points: 0, correctCount: 0, progress: {} },
        soma:  { name: "そうま", initial: "S", iconDataUrl: null, points: 0, correctCount: 0, progress: {} },
        dev:   { name: "開発者", initial: "D", iconDataUrl: null, points: 0, correctCount: 0, progress: {} },
      },
      ui: { seVolume: 0.8 },
      state: { currentUserId: null },
    };
    saveAll(db);
  }
  // 進捗のキーが無い場合の保険
  for (const uid of Object.keys(db.users || {})) {
    db.users[uid].progress ||= {};
    db.users[uid].points ||= 0;
    db.users[uid].correctCount ||= 0;
    db.users[uid].initial ||= uid.slice(0,1).toUpperCase();
  }
  db.ui ||= { seVolume: 0.8 };
  if (typeof db.ui.seVolume !== "number") db.ui.seVolume = 0.8;
  db.state ||= { currentUserId: null };
  saveAll(db);
  return db;
}

export function getDB() {
  return initIfNeeded();
}

export function getUISettings() {
  return getDB().ui;
}

export function setSeVolume(v) {
  const db = getDB();
  db.ui.seVolume = Math.max(0, Math.min(1, Number(v)));
  saveAll(db);
}

export function getState() {
  return getDB().state;
}

export function setCurrentUser(userId) {
  const db = getDB();
  db.state.currentUserId = userId;
  saveAll(db);
}

export function getUser(userId) {
  const db = getDB();
  return db.users?.[userId] || null;
}

export function listUsers() {
  const db = getDB();
  return Object.entries(db.users).map(([id, u]) => ({ id, ...u }));
}

export function ensureUser(userId) {
  const u = getUser(userId);
  if (!u) throw new Error("user not found");
  return u;
}

/* progress record:
{
  stage: 0..6,
  due: "YYYY-MM-DD",
  wrongToday: true/false
}
*/
export function getProgress(userId, wordId) {
  const u = ensureUser(userId);
  return u.progress[wordId] || null;
}

export function setProgress(userId, wordId, rec) {
  const db = getDB();
  const u = db.users[userId];
  u.progress[wordId] = rec;
  saveAll(db);
}

export function deleteProgress(userId, wordId) {
  const db = getDB();
  const u = db.users[userId];
  delete u.progress[wordId];
  saveAll(db);
}

export function getTodayStr() {
  return todayLocalYYYYMMDD();
}

export function addCorrect(userId) {
  const db = getDB();
  const u = db.users[userId];
  u.correctCount = (u.correctCount || 0) + 1;
  let gained = false;
  if (u.correctCount >= 10) {
    u.correctCount = 0;
    u.points = (u.points || 0) + 1;
    gained = true;
  }
  saveAll(db);
  return { gained, points: u.points, correctCount: u.correctCount };
}

export function resetWrongToday(userId) {
  const db = getDB();
  const u = db.users[userId];
  for (const k of Object.keys(u.progress || {})) {
    if (u.progress[k]?.wrongToday) u.progress[k].wrongToday = false;
  }
  saveAll(db);
}

export function setUserIconDataUrl(userId, dataUrl) {
  const db = getDB();
  db.users[userId].iconDataUrl = dataUrl || null;
  saveAll(db);
}
