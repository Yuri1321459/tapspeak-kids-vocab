import { getSfxVolume } from "./storage.js";

const SFX_BASE = "./assets/sounds/ui/";

const SFX = {
  speak_start: "speak_start.mp3",
  correct: "correct.mp3",
  wrong: "wrong.mp3",
  point: "point.mp3",
};

let currentSfxAudio = null;

export function stopAllAudio() {
  if (currentSfxAudio) {
    try {
      currentSfxAudio.pause();
      currentSfxAudio.currentTime = 0;
    } catch {}
    currentSfxAudio = null;
  }
  try {
    window.speechSynthesis?.cancel();
  } catch {}
}

export function playSfx(name) {
  const file = SFX[name];
  if (!file) return;

  if (currentSfxAudio) {
    try {
      currentSfxAudio.pause();
      currentSfxAudio.currentTime = 0;
    } catch {}
    currentSfxAudio = null;
  }

  const a = new Audio(SFX_BASE + file);
  a.volume = getSfxVolume();
  currentSfxAudio = a;

  a.addEventListener("ended", () => {
    if (currentSfxAudio === a) currentSfxAudio = null;
  });

  a.play().catch(() => {
    // iOS制限などは黙る
  });
}

/* ===== TTS ===== */
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
  } catch {}
}

/* ===== TTS（完了待ち）: 復習モード用 ===== */
export function speakTTSWait(text) {
  const t = (text || "").trim();
  if (!t) return Promise.resolve();

  return new Promise((resolve) => {
    try {
      window.speechSynthesis.cancel();
    } catch {}

    const u = new SpeechSynthesisUtterance(t);
    u.lang = "en-US";
    u.rate = 0.95;
    u.pitch = 1.0;

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };

    u.onend = finish;
    u.onerror = finish;

    // iOSでonendが飛ばない保険（長すぎない）
    const fallbackMs = Math.min(5000, Math.max(1200, t.length * 70));
    const timer = setTimeout(finish, fallbackMs);

    const origFinish = finish;
    const finishWrap = () => {
      clearTimeout(timer);
      origFinish();
    };
    u.onend = finishWrap;
    u.onerror = finishWrap;

    try {
      window.speechSynthesis.speak(u);
    } catch {
      finishWrap();
    }
  });
}
