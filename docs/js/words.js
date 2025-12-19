// TapSpeak Kids Vocab
// Version: v2025-01

import { getState,getProgress,setProgress,deleteProgress } from "./storage.js";
import { speakTTS,playSfx } from "./audio.js";

export async function renderWords(root){
  const res = await fetch("./data/words.json");
  const data = await res.json();
  const words = Array.isArray(data)?data:data.words;
  const uid = getState().currentUserId;

  const screen = document.createElement("div");
  screen.className="screen";
  root.appendChild(screen);

  words.forEach(w=>{
    const id = `${w.game}:${w.word_key}`;
    const p = getProgress(uid,id);
    const enrolled = !!p;

    const card = document.createElement("div");
    card.className="card";
    card.innerHTML=`
<div class="wordgrid">
  <div class="thumbWrap"></div>
  <div>
    <div class="descRow">
      <button class="spkbtn">🔊</button>
      <p>${w.desc_lv2}</p>
    </div>
  </div>
</div>
<div class="actions"></div>
`;
    const thumb = card.querySelector(".thumbWrap");
    let showWord=false;
    function draw(){
      thumb.innerHTML="";
      if(showWord){
        const d=document.createElement("div");
        d.className="wordInThumb";
        d.textContent=w.word;
        thumb.appendChild(d);
      }else{
        const i=document.createElement("img");
        i.src=`./assets/games/${w.game}/${w.category_id}/${w.image_file}`;
        thumb.appendChild(i);
      }
    }
    draw();
    thumb.onclick=()=>{
      showWord=!showWord;
      draw();
      speakTTS(w.word);
    };

    card.querySelector(".spkbtn").onclick=()=>speakTTS(w.desc_lv2);

    const act = card.querySelector(".actions");
    if(enrolled){
      const b=document.createElement("button");
      b.className="btn ng";
      b.textContent="わすれた";
      b.onclick=()=>{
        deleteProgress(uid,id);
        playSfx("wrong");
        card.remove();
      };
      act.appendChild(b);
    }else{
      const b=document.createElement("button");
      b.className="btn ok";
      b.textContent="おぼえた";
      b.onclick=()=>{
        setProgress(uid,id,{stage:0,due:new Date().toISOString().slice(0,10)});
        playSfx("correct");
        card.remove();
      };
      act.appendChild(b);
    }

    screen.appendChild(card);
  });
}
