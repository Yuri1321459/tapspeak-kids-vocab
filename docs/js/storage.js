// TapSpeak Kids Vocab
// Version: v2025-01b

const KEY = "tapspeak_state_v2025_01b";

function defaultState(){
  return {
    users:{},
    currentUserId:null,
    settings:{
      seVolume: 0.9,
      pin: "1234"
    }
  };
}

export function getState(){
  const raw = localStorage.getItem(KEY);
  if(!raw) return defaultState();
  try{
    const st = JSON.parse(raw);
    st.users ||= {};
    st.settings ||= { seVolume:0.9, pin:"1234" };
    if (typeof st.settings.seVolume !== "number") st.settings.seVolume = 0.9;
    if (!st.settings.pin) st.settings.pin = "1234";
    return st;
  }catch{
    return defaultState();
  }
}
export function saveState(st){
  localStorage.setItem(KEY, JSON.stringify(st));
}

export function ensureUser(id){
  const st = getState();
  if(!st.users[id]){
    st.users[id] = {
      progress:{},
      points:0,
      icon:null
    };
    saveState(st);
  }
}

export function setCurrentUser(id){
  const st = getState();
  st.currentUserId = id;
  ensureUser(id);
  saveState(st);
}

export function getUser(uid){
  const st = getState();
  return st.users[uid] || null;
}

export function getProgress(uid,wid){
  const st = getState();
  return st.users[uid]?.progress[wid] || null;
}

export function setProgress(uid,wid,data){
  const st = getState();
  st.users[uid].progress[wid] = { ...st.users[uid].progress[wid], ...data };
  saveState(st);
}

export function deleteProgress(uid,wid){
  const st = getState();
  delete st.users[uid].progress[wid];
  saveState(st);
}

export function addPoint(uid){
  const st = getState();
  st.users[uid].points = (st.users[uid].points || 0) + 1;
  saveState(st);
  return st.users[uid].points;
}

export function getPoints(uid){
  return getState().users[uid]?.points || 0;
}

/* settings */
export function getSeVolume(){
  return getState().settings.seVolume ?? 0.9;
}
export function setSeVolume(v){
  const st = getState();
  st.settings.seVolume = Math.max(0, Math.min(1, Number(v)));
  saveState(st);
}

export function getPin(){
  return String(getState().settings.pin || "1234");
}
export function setPin(pin4){
  const st = getState();
  st.settings.pin = String(pin4 || "").slice(0,4);
  saveState(st);
}

/* backup/restore current user only */
export function exportCurrentUser(){
  const st = getState();
  const uid = st.currentUserId;
  if(!uid) return null;
  return {
    version: "v2025-01b",
    exported_at: new Date().toISOString(),
    user_id: uid,
    user: st.users[uid],
    settings: { seVolume: st.settings.seVolume }
  };
}

export function importCurrentUser(obj){
  const st = getState();
  const uid = st.currentUserId;
  if(!uid) return;
  if(!obj || !obj.user) return;

  // 上書き（ただしアバター保持は要件なので、iconだけは残す）
  const keepIcon = st.users[uid]?.icon ?? null;
  st.users[uid] = obj.user;
  st.users[uid].icon = keepIcon;

  // 音量だけは受け取る（任意）
  if (obj.settings && typeof obj.settings.seVolume === "number") {
    st.settings.seVolume = obj.settings.seVolume;
  }

  saveState(st);
}

export function setUserIcon(uid, dataUrl){
  const st = getState();
  st.users[uid].icon = dataUrl || null;
  saveState(st);
}

export function resetPointsCurrent(){
  const st = getState();
  const uid = st.currentUserId;
  if(!uid) return;
  st.users[uid].points = 0;
  saveState(st);
}

export function resetLearningCurrentKeepAvatar(){
  const st = getState();
  const uid = st.currentUserId;
  if(!uid) return;
  const keepIcon = st.users[uid]?.icon ?? null;
  st.users[uid] = { progress:{}, points:0, icon: keepIcon };
  saveState(st);
}
