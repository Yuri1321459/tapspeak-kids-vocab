// TapSpeak Kids Vocab
// Version: v2025-01

import { getState,getProgress,setProgress,addPoint } from "./storage.js";
import { playSfx,speakTTS } from "./audio.js";

export async function renderReview(root){
  const res = await fetch("./data/words.json");
  const data = await res.json();
  const words = Array.isArray(data)?data:data.words;
  const uid = getState().currentUserId;
  const today = new Date().toISOString().slice(0,10);

  const screen = document.createElement("div");
  screen.className="screen";
  root.appendChild(screen);

  const dueWords = words.filter(w=>{
    const p = getProgress(uid,`${w.game}:${w.word_key}`);
    return p && p.due<=today;
  });

  dueWords.forEach(w=>{
    const id=`${w.game}:${w.word_key}`;
    const card=document.createElement("div");
    card.className="card";
    card.innerHTML=`
<div class="wordgrid">
  <div class="thumbWrap"><img src="./assets/games/${w.game}/${w.category_id}/${w.image_file}"></div>
  <div><p>${w.desc_lv2}</p></div>
</div>
<div class="actions">
  <button class="btn blue">いってみて</button>
</div>
`;
    const act=card.querySelector(".actions");
    act.querySelector("button").onclick=()=>{
      playSfx("speak_start");
      setTimeout(()=>{
        act.innerHTML=`<button class="btn blue">せいかいをきく</button>`;
        act.querySelector("button").onclick=()=>{
          speakTTS(w.word);
          setTimeout(()=>{
            act.innerHTML=`
<button class="btn ok">○</button>
<button class="btn ng">×</button>`;
            const [ok,ng]=act.querySelectorAll("button");
            ok.onclick=()=>{
              const p=getProgress(uid,id);
              setProgress(uid,id,{stage:Math.min(6,p.stage+1),due:today});
              addPoint(uid);
              playSfx("correct");
              playSfx("point");
              popup("☆1ポイントゲット！！");
              card.remove();
            };
            ng.onclick=()=>{
              const p=getProgress(uid,id);
              setProgress(uid,id,{stage:Math.max(0,p.stage-1),due:today});
              playSfx("wrong");
              card.remove();
            };
          },300);
        };
      },1000);
    };
    screen.appendChild(card);
  });
}

function popup(text){
  const d=document.createElement("div");
  d.className="popup";
  d.textContent=text;
  document.body.appendChild(d);
  setTimeout(()=>d.remove(),500);
}
