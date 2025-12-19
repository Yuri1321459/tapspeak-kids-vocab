// TapSpeak Kids Vocab
// Version: v2025-01b

import { getState,getProgress,setProgress,deleteProgress, ensureUser } from "./storage.js";
import { speakTTS,playSfx } from "./audio.js";

function todayLocalYYYYMMDD(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}

export async function renderWords(root){
  const uid = getState().currentUserId;
  ensureUser(uid);

  const res = await fetch("./data/words.json");
  const data = await res.json();
  const words = Array.isArray(data)?data:(data.words||[]);
  const enabled = words.filter(w => w && w.enabled === true);

  const screen = document.createElement("div");
  screen.className="screen";
  root.appendChild(screen);

  enabled.forEach(w=>{
    const id = `${w.game}:${w.word_key}`;

    const card = document.createElement("div");
    card.className="card";
    card.innerHTML=`
<div class="wordgrid">
  <div class="thumbWrap"></div>
  <div>
    <div class="descRow">
      <button class="spkbtn" type="button" aria-label="desc">🔊</button>
      <p class="desc"></p>
    </div>
  </div>
</div>
<div class="actions"></div>
`;

    card.querySelector(".desc").textContent = w.desc_lv2 || "";

    const thumb = card.querySelector(".thumbWrap");
    let showWord=false;

    function drawThumb(){
      thumb.innerHTML="";
      if(showWord){
        const d=document.createElement("div");
        d.className="wordInThumb";
        d.textContent=w.word || "";
        thumb.appendChild(d);
      }else{
        const i=document.createElement("img");
        i.alt="";
        i.src=`./assets/games/${w.game}/${w.category_id}/${w.image_file}`;
        thumb.appendChild(i);
      }
    }
    drawThumb();

    // 画像タップ：画像枠置換 + 単語TTS
    thumb.onclick=()=>{
      showWord=!showWord;
      drawThumb();
      speakTTS(w.word || "");
    };

    // 説明はスピーカーのみ
    card.querySelector(".spkbtn").onclick=()=>{
      speakTTS(w.desc_lv2 || "");
    };

    const act = card.querySelector(".actions");

    function renderActions(){
      act.innerHTML = "";
      const p = getProgress(uid,id);
      const enrolled = !!p;

      if(enrolled){
        const b=document.createElement("button");
        b.className="btn ng";
        b.textContent="わすれた";
        b.onclick=()=>{
          // 単語モードの「わすれた」＝Enroll解除
          deleteProgress(uid,id);
          playSfx("wrong");
          renderActions();
        };
        act.appendChild(b);
      }else{
        const b=document.createElement("button");
        b.className="btn ok";
        b.textContent="おぼえた";
        b.onclick=()=>{
          // Enroll
          setProgress(uid,id,{stage:0,due:todayLocalYYYYMMDD(), wrongToday:false});
          playSfx("correct");
          renderActions();
        };
        act.appendChild(b);
      }
    }
    renderActions();

    screen.appendChild(card);
  });
}
