// TapSpeak Kids Vocab
// Version: v2025-01

const KEY = "tapspeak_state_v2025_01";

export function getState(){
  const raw = localStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : { users:{}, currentUserId:null };
}
export function saveState(st){
  localStorage.setItem(KEY, JSON.stringify(st));
}

export function ensureUser(id){
  const st = getState();
  if(!st.users[id]){
    st.users[id] = { progress:{}, points:0, icon:null };
    saveState(st);
  }
}

export function setCurrentUser(id){
  const st = getState();
  st.currentUserId = id;
  saveState(st);
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
  st.users[uid].points += 1;
  saveState(st);
}

export function getPoints(uid){
  return getState().users[uid]?.points || 0;
}
