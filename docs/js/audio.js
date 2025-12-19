/* R-2-5: 音声は全部ここ（SE + TTS） */
(() => {
  const SE_BASE = "./assets/sounds/ui/"; // R-10-1
  const SE = {
    speak_start: "speak_start.mp3",
    correct: "correct.mp3",
    wrong: "wrong.mp3",
    point: "point.mp3"
  };

  let seAudio = null;
  let ttsLocked = false;
  let voiceList = [];
  let voiceReady = false;

  function _getUserId() {
    return window.AppStorage?.getCurrentUserId?.() || "";
  }
  function _getSettings() {
    const uid = _getUserId();
    return uid ? window.AppStorage.getSettings(uid) : { seVolume: 0.7, ttsRate: 1.0, voiceURI: "" };
  }

  function stopSE() {
    if (!seAudio) return;
    try {
      seAudio.pause();
      seAudio.currentTime = 0;
    } catch {}
  }

  function playSE(key) {
    // R-10-1: 重ね再生禁止
    const file = SE[key];
    if (!file) return;
    stopSE();
    const s = _getSettings();
    seAudio = new Audio(SE_BASE + file);
    seAudio.volume = Math.max(0, Math.min(1, Number(s.seVolume ?? 0.7)));
    seAudio.play().catch(() => {});
  }

  function _refreshVoices() {
    voiceList = window.speechSynthesis?.getVoices?.() || [];
    if (voiceList.length) voiceReady = true;
    return voiceList;
  }

  // iOS対策: voicesは遅れて来ることがある
  if ("speechSynthesis" in window) {
    window.speechSynthesis.onvoiceschanged = () => _refreshVoices();
    _refreshVoices();
    setTimeout(_refreshVoices, 250);
    setTimeout(_refreshVoices, 1200);
  }

  function getEnglishVoices() {
    _refreshVoices();
    const v = voiceList.slice();
    // R-10-3: en-US優先（並べ替え）
    v.sort((a, b) => {
      const aUS = (a.lang || "").toLowerCase().startsWith("en-us") ? 0 : 1;
      const bUS = (b.lang || "").toLowerCase().startsWith("en-us") ? 0 : 1;
      if (aUS !== bUS) return aUS - bUS;
      const aEN = (a.lang || "").toLowerCase().startsWith("en") ? 0 : 1;
      const bEN = (b.lang || "").toLowerCase().startsWith("en") ? 0 : 1;
      if (aEN !== bEN) return aEN - bEN;
      return (a.name || "").localeCompare(b.name || "");
    });
    // 端末に英語音声が無い場合もあるので全返し
    return v;
  }

  function speak(text, opts = {}) {
    // R-10-2/R-10-4: 対象読み上げ／速度／Voice
    if (!("speechSynthesis" in window)) return Promise.resolve();
    if (!text) return Promise.resolve();

    const uid = _getUserId();
    const s = uid ? window.AppStorage.getSettings(uid) : { ttsRate: 1.0, voiceURI: "" };
    const rate = Math.max(0.6, Math.min(1.4, Number(opts.rate ?? s.ttsRate ?? 1.0)));
    const voiceURI = String(opts.voiceURI ?? s.voiceURI ?? "");

    return new Promise((resolve) => {
      try {
        window.speechSynthesis.cancel();
      } catch {}

      const u = new SpeechSynthesisUtterance(String(text));
      u.rate = rate;
      u.pitch = 1.0;
      u.volume = 1.0;

      // en-US優先、指定があればそれを優先
      _refreshVoices();
      const voices = getEnglishVoices();
      let chosen = null;
      if (voiceURI) chosen = voices.find(v => v.voiceURI === voiceURI) || null;
      if (!chosen) chosen = voices.find(v => (v.lang || "").toLowerCase().startsWith("en-us")) || null;
      if (!chosen) chosen = voices.find(v => (v.lang || "").toLowerCase().startsWith("en")) || null;
      if (chosen) {
        u.voice = chosen;
        u.lang = chosen.lang || "en-US";
      } else {
        u.lang = "en-US";
      }

      u.onend = () => resolve();
      u.onerror = () => resolve();
      window.speechSynthesis.speak(u);
    });
  }

  function lockTTS(isLocked) {
    ttsLocked = !!isLocked;
  }
  function isLocked() {
    return !!ttsLocked;
  }

  window.AppAudio = {
    playSE,
    stopSE,
    speak,
    getEnglishVoices,
    lockTTS,
    isLocked,
    _voiceReady: () => voiceReady
  };
})();
