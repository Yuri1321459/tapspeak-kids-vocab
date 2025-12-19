// TapSpeak Kids Vocab
// Version: v2025-01

let volume = 1;
const sounds = {
  correct:new Audio("./assets/sounds/ui/correct.mp3"),
  wrong:new Audio("./assets/sounds/ui/wrong.mp3"),
  point:new Audio("./assets/sounds/ui/point.mp3"),
  speak_start:new Audio("./assets/sounds/ui/speak_start.mp3"),
};

export function setVolume(v){
  volume = v;
  Object.values(sounds).forEach(a=>a.volume=v);
}

export function playSfx(name){
  const a = sounds[name];
  if(!a) return;
  a.currentTime = 0;
  a.volume = volume;
  a.play();
}

export function speakTTS(text){
  if(!text) return;
  const u = new SpeechSynthesisUtterance(text);
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}
