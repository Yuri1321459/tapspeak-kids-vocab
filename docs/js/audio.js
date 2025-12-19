import { getUISettings } from "./storage.js";

const SFX = {
  speak_start: "./assets/sounds/ui/speak_start.mp3",
  correct: "./assets/sounds/ui/correct.mp3",
  wrong: "./assets/sounds/ui/wrong.mp3",
  point: "./assets/sounds/ui/point.mp3",
};

let currentAudio = null;

export function playSfx(name) {
  const src = SFX[name];
  if (!src) return;

  const { seVolume } = getUISettings();

  try {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }
    const a = new Audio(src);
    a.volume = Math.max(0, Math.min(1, Number(seVolume ?? 0.8)));
    currentAudio = a;
    a.play().catch(()=>{});
  } catch {}
}

export function speakTTS(text) {
  if (!text) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.95;
    u.pitch = 1.0;
    window.speechSynthesis.speak(u);
  } catch {}
}

export function lockWhileSpeaking(onLocked) {
  // Safariで完璧な検知は難しいので最小限
  try {
    if (!("speechSynthesis" in window)) return;
    onLocked(true);
    const check = setInterval(() => {
      if (!speechSynthesis.speaking) {
        clearInterval(check);
        onLocked(false);
      }
    }, 120);
  } catch {
    onLocked(false);
  }
}
