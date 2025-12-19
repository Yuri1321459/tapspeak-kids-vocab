// TapSpeak Kids Vocab
// Version: v2025-01

import { getState,setCurrentUser,getPoints } from "./storage.js";
import { renderWords } from "./words.js";
import { renderReview } from "./review.js";

const root = document.getElementById("app");

function headerHTML(mode){
  const pts = getPoints(getState().currentUserId);
  return `
<header>
  <div class="header-row">
    <button class="iconbtn" id="btnHome">🏠</button>
    <div>⭐${pts}</div>
  </div>
  <div class="header-row">
    <div class="tabs">
      <button class="tabbtn ${mode==="words"?"active":""}" id="tabWords">たんご</button>
      <button class="tabbtn ${mode==="review"?"active":""}" id="tabReview">ふくしゅう</button>
    </div>
  </div>
</header>`;
}

function showHome(){
  root.innerHTML = `
<div class="home-select">
  <h2>えいたんごをおぼえよう！</h2>
  <button class="userbtn" data-u="riona"><span class="usericon">R</span>りおな</button>
  <button class="userbtn" data-u="soma"><span class="usericon">S</span>そうま</button>
  <button class="userbtn" data-u="dev"><span class="usericon">開</span>開発者</button>
</div>`;
  root.querySelectorAll(".userbtn").forEach(b=>{
    b.onclick=()=>{
      setCurrentUser(b.dataset.u);
      showWords();
    };
  });
}

function showWords(){
  root.innerHTML = headerHTML("words");
  root.querySelector("#btnHome").onclick=showHome;
  root.querySelector("#tabReview").onclick=showReview;
  renderWords(root);
}

function showReview(){
  root.className="review";
  root.innerHTML = headerHTML("review");
  root.querySelector("#btnHome").onclick=showHome;
  root.querySelector("#tabWords").onclick=showWords;
  renderReview(root);
}

showHome();
