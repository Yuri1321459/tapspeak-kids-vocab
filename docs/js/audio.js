// TapSpeak Kids Vocab
// Version: v2025-01b

let volume = 0.9;

const sounds = {
  correct: new Audio("./assets/sounds/ui/correct.mp3"),
  wrong: new Audio("./assets/sounds/ui/wrong.mp3"),
  point: new Audio("./assets/sounds/ui/point.mp3"),
  speak_start: new Audio("./assets/sounds/ui/speak_start.mp3"),
};

export function setVolume(v){
  volume = Math.max(0, Math.min(1, Number(v)));
  Object.values(sounds).forEach(a => a.volume = volume);
}

export function getVolume(){
  return volume;
}

export function playSfx(name){
  const a = sounds[name];
  if(!a) return;
  try{
    a.pause();
    a.currentTime = 0;
    a.volume = volume;
    a.play();
  }catch{}
}

/** iOSで日本語声になりがち問題を避ける：en-US系Voiceを優先 */
function pickEnglishUSVoice(){
  try{
    const voices = speechSynthesis.getVoices?.() || [];
    if (!voices.length) return null;

    // 1) en-US 優先
    let v = voices.find(x => (x.lang || "").toLowerCase() === "en-us");
    if (v) return v;

    // 2) en- の中でUSっぽい名前優先
    const en = voices.filter(x => (x.lang || "").toLowerCase().startsWith("en"));
    v = en.find(x => /us|america|siri/i.test(x.name || ""));
    if (v) return v;

    // 3) en があればそれ
    return en[0] || null;
  }catch{
    return null;
  }
}

export function speakTTS(text){
  if(!text) return;

  try{
    // voice一覧が遅れて来る端末対策
    const doSpeak = () => {
      try{
        speechSynthesis.cancel();
      }catch{}

      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-US";
      u.rate = 0.95;
      u.pitch = 1.0;

      const v = pickEnglishUSVoice();
      if (v) u.voice = v;

      speechSynthesis.speak(u);
    };

    const voices = speechSynthesis.getVoices?.() || [];
    if (voices.length) {
      doSpeak();
    } else {
      // voicesがまだなら、イベントを待ってから再実行
      speechSynthesis.onvoiceschanged = () => {
        doSpeak();
        speechSynthesis.onvoiceschanged = null;
      };
      // 念のためすぐも試す
      setTimeout(doSpeak, 0);
    }
  }catch{}
}
