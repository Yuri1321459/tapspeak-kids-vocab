/* TapSpeak Kids Vocab
 * Version: v2025-01b
 */

:root{
  --bg-light:#f7f8fb;
  --card:#ffffff;
  --txt:#1b1f24;

  --bg-dark:#1f2328;
  --card-dark:#2a2f36;
  --txt-dark:#f2f4f7;

  --blue:#4aa3ff;
  --green:#40b36b;
  --red:#e05555;

  --muted:#7a8696;
}

*{box-sizing:border-box}
body{
  margin:0;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  background:var(--bg-light);
  color:var(--txt);
}

button{
  font-size:16px;
  padding:8px 14px;
  border-radius:10px;
  border:none;
  cursor:pointer;
}
button:disabled{opacity:.5}

header{
  position:sticky;
  top:0;
  z-index:10;
  background:var(--bg-light);
  padding:8px 10px;
  border-bottom:1px solid #ddd;
}
.header-row{
  display:flex;
  align-items:center;
  justify-content:space-between;
}
.header-row + .header-row{ margin-top:6px; }

.iconbtn{
  background:none;
  font-size:22px;
  padding:4px 10px;
}

.tabs{ display:flex; gap:14px; }
.tabbtn{
  background:none;
  font-weight:600;
  color:#667085;
  padding:6px 4px;
  border-bottom:3px solid transparent;
}
.tabbtn.active{
  color:#111827;
  font-weight:900;
  border-bottom-color: var(--blue);
}

.filters{ display:flex; gap:10px; flex-wrap:wrap; justify-content:flex-end; }

.drop{ position:relative; }
.dropBtn{
  background:#eef2f7;
  color:#111827;
  border-radius:8px;
  font-weight:800;
}
.dropPanel{
  position:absolute;
  top:44px;
  left:0;
  background:#fff;
  border:1px solid #cfd6df;
  border-radius:12px;
  padding:10px;
  min-width:240px;
  z-index:20;
  box-shadow:0 12px 32px rgba(0,0,0,.12);
}
.dropPanel.hidden{display:none}
.dropGrid{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:6px 12px;
}
.dropItem{
  display:flex;
  gap:8px;
  align-items:center;
  font-size:14px;
  padding:6px 6px;
  border-radius:10px;
}
.dropItem:hover{ background:#f3f5f8; }

.screen{ padding:12px; }

.card{
  background:var(--card);
  border-radius:16px;
  padding:12px;
  margin-bottom:14px;
  box-shadow:0 8px 22px rgba(0,0,0,.06);
}

.wordgrid{
  display:grid;
  grid-template-columns:140px 1fr;
  gap:10px;
}
.thumbWrap{
  width:140px;
  height:140px;
  border-radius:14px;
  background:#eef2f7;
  display:flex;
  align-items:center;
  justify-content:center;
  overflow:hidden;
}
.thumbWrap img{ width:100%; height:100%; object-fit:contain; }
.wordInThumb{
  padding:8px;
  text-align:center;
  font-size:22px;
  font-weight:900;
  word-break:break-word;
  line-height:1.1;
}

.descRow{
  display:flex;
  gap:8px;
  align-items:flex-start;
}
.spkbtn{
  font-size:20px;
  background:none;
  padding:4px 10px;
}
.desc{ margin:0; line-height:1.4; }

.actions{
  margin-top:10px;
  display:flex;
  gap:10px;
}

.btn.ok{background:var(--green);color:#fff;font-weight:900}
.btn.ng{background:var(--red);color:#fff;font-weight:900}
.btn.blue{background:var(--blue);color:#06243b;font-weight:900}

/* home */
.home-select{
  display:flex;
  flex-direction:column;
  align-items:center;
  gap:18px;
  padding:50px 12px 60px;
}
.home-title{
  font-size:22px;
  font-weight:1000;
  margin:0 0 6px;
  text-align:center;
}
.userbtn{
  width:240px;
  padding:14px 16px;
  font-size:22px;
  border-radius:16px;
  background:#eef2f7;
  font-weight:900;
  display:flex;
  align-items:center;
  justify-content:flex-start;
  gap:12px;
}
.usericon{
  width:48px;
  height:48px;
  border-radius:14px;
  background:#cfd6df;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  font-weight:1000;
  overflow:hidden;
}
.usericon img{ width:100%; height:100%; object-fit:cover; display:block; }

.homerow{
  display:flex;
  gap:14px;
  justify-content:center;
  margin-top:12px;
}
.bigbtn{
  width:160px;
  padding:16px 14px;
  border-radius:16px;
  font-size:20px;
  font-weight:1000;
}
.bigbtn.words{ background:#e8f0ff; }
.bigbtn.review{ background:#e8f7ef; }

/* review dark theme */
.review{
  background:var(--bg-dark);
  color:var(--txt-dark);
  min-height:100vh;
}
.review header{
  background:var(--bg-dark);
  border-bottom:1px solid rgba(255,255,255,.12);
}
.review .card{
  background:var(--card-dark);
  box-shadow:none;
}
.review .dropBtn{
  background:#3a414b;
  color:#fff;
}
.review .dropPanel{
  background:#2a2f36;
  border-color:rgba(255,255,255,.12);
}
.review .dropItem:hover{ background:rgba(255,255,255,.06); }
.review .tabbtn{ color:#b8c0cc; }
.review .tabbtn.active{
  color:#fff;
  border-bottom-color:#fff;
}
.review .thumbWrap{ background:#3a414b; }
.review .btn.blue{ background:#2b7bd6; color:#fff; }
.review .btn.ok{ background:#2f9e63; color:#fff; }
.review .btn.ng{ background:#cc4444; color:#fff; }

/* popup */
.popup{
  position:fixed;
  top:18%;
  left:50%;
  transform:translateX(-50%);
  background:rgba(0,0,0,.88);
  color:#fff;
  padding:14px 22px;
  border-radius:14px;
  font-size:20px;
  z-index:50;
  opacity:.95;
  font-weight:1000;
}

/* settings */
.settingsTitle{
  font-size:20px;
  font-weight:1000;
  margin:0 0 10px;
}
.field{
  display:flex;
  flex-direction:column;
  gap:6px;
  margin-top:10px;
}
label{ font-weight:900; }
input[type="range"]{ width:100%; }
.small{ color:var(--muted); font-size:12px; margin:6px 0 0; }
