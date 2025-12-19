const SFX_BASE = "./assets/sounds/ui/";

const SFX = {
  speak_start: "speak_start.mp3",
  correct: "correct.mp3",
  wrong: "wrong.mp3",
  point: "point.mp3",
};

let currentSfxAudio = null;

export function stopAllAudio() {
  // 効果音（重ね再生禁止）
  if (currentSfxAudio) {
    try {
      currentSfxAudio.pause();
      currentSfxAudio.currentTime = 0;
    } catch {}
    currentSfxAudio = null;
  }
  // TTS
  try {
    window.speechSynthesis?.cancel();
  } catch {}
}

export function playSfx(name) {
  const file = SFX[name];
  if (!file) return;

  // 重ね再生禁止：常に止めてから鳴らす
  if (currentSfxAudio) {
    try {
      currentSfxAudio.pause();
      currentSfxAudio.currentTime = 0;
    } catch {}
    currentSfxAudio = null;
  }

  const a = new Audio(SFX_BASE + file);
  currentSfxAudio = a;
  a.addEventListener("ended", () => {
    if (currentSfxAudio === a) currentSfxAudio = null;
  });
  a.play().catch(() => {
    // iOSはユーザー操作なしの再生が制限される。ここでは黙る。
  });
}

export function speakTTS(text) {
  const t = (text || "").trim();
  if (!t) return;

  try {
    window.speechSynthesis.cancel();
  } catch {}

  const u = new SpeechSynthesisUtterance(t);
  u.lang = "en-US";
  u.rate = 0.95;
  u.pitch = 1.0;

  try {
    window.speechSynthesis.speak(u);
  } catch {
    // だめなら黙る
  }
}
