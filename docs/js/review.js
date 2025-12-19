// TapSpeak Kids Vocab
// Version: v2025-01b

import { getState,getProgress,setProgress,addPoint, ensureUser } from "./storage.js";
import { playSfx,speakTTS } from "./audio.js";

function todayLocalYYYYMMDD(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}

function addDays(yyyyMMdd, days){
  const [y,m,d] = yyyyMMdd.split("-").map(Number);
  const dt = new Date(y, m-1, d);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth()+1).padStart(2,"0");
  const dd = String(dt.getDate()).padStart(2,"0");
  return `${yy}-${mm}-${dd}`;
}

function nextIntervalDays(stage){
  switch(stage){
    case 0: return 0;
    case 1: return 1;
    case 2: return 3;
    case 3: return 7;
    case 4: return 14;
    case 5: return 30;
    case 6: return 365;
    default: return 0;
  }
}

export async function renderReview(root, { onPointGained } = {}){
  const uid = getState().currentUserId;
  ensureUser(uid);

  const res = await fetch("./data/words.json");
  const data = await res.json();
  const words = Array.isArray(data)?data:(data.words||[]);
  const enabled = words.filter(w => w && w.enabled === true);

  const today = todayLocalYYYYMMDD();

  const screen = document.createElement("div");
  screen.className="screen";
  root.appendChild(screen);

  const dueWords = enabled.filter(w=>{
    const p = getProgress(uid,`${w.game}:${w.word_key}`);
    return p && p.due && p.due <= today;
  });

  dueWords.forEach(w=>{
    const id=`${w.game}:${w.word_key}`;
    const card=document.createElement("div");
    card.className="card";
    card.innerHTML=`
<div class="wordgrid">
  <div class="thumbWrap"><img alt="" src="./assets/games/${w.game}/${w.category_id}/${w.image_file}"></div>
  <div><p class="desc"></p></div>
</div>
<div class="actions">
  <button class="btn blue" type="button">いってみて</button>
</div>
`;
    card.querySelector(".desc").textContent = w.desc_lv2 || "";

    const act=card.querySelector(".actions");
    const btnTry = act.querySelector("button");

    btnTry.onclick=()=>{
      playSfx("speak_start");
      setTimeout(()=>{
        act.innerHTML=`<button class="btn blue" type="button">せいかいをきく</button>`;
        act.querySelector("button").onclick=()=>{
          speakTTS(w.word || "");
          // TTS完了を厳密に待つのはiOSで難しいので短い待機後に○×
          setTimeout(()=>{
            act.innerHTML=`
<button class="btn ok" type="button">○</button>
<button class="btn ng" type="button">×</button>`;
            const [ok,ng]=act.querySelectorAll("button");

            ok.onclick=()=>{
              const p=getProgress(uid,id);
              const stage = Math.min(6, (p?.stage ?? 0) + 1);
              const due = addDays(today, nextIntervalDays(stage));
              setProgress(uid,id,{stage, due, wrongToday:false});

              playSfx("correct");

              // 10問◯→1pt の本実装は後で統合する前提だったが、今は即時加算にしている
              // 要望「即時に☆増」対応のためここで反映
              addPoint(uid);
              playSfx("point");
              onPointGained?.();

              card.remove();
            };

            ng.onclick=()=>{
              const p=getProgress(uid,id);
              const stage = Math.max(0, (p?.stage ?? 0) - 1);
              setProgress(uid,id,{stage, due: today, wrongToday:true});
              playSfx("wrong");
              // ×はその日中再出題対象：ここではカード削除せず残す
              // ただし「何度でも出る」は次の一覧更新で担保する想定
            };
          }, 250);
        };
      }, 1000);
    };

    screen.appendChild(card);
  });
}
