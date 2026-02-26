const app = document.getElementById("app");
const SUBJECT = "geography"; // change to "geometry" or "civics" in other copies
const SUBJECT_LABEL = SUBJECT.charAt(0).toUpperCase() + SUBJECT.slice(1);

const CHAPTER_FILES = [
 "chapter1","chapter2","chapter3","chapter4","chapter5","chapter6","chapter7","chapter8","chapter9","chapter10",
 "chapter11","chapter12","chapter13","chapter14","chapter15","chapter16","chapter17","chapter18","chapter19","chapter20",
 "chapter21","chapter22","chapter23","chapter24","chapter25","chapter26","chapter27","chapter28","chapter29","chapter30",
 "chapter31","chapter32","chapter33","chapter34","chapter35","chapter36","chapter37","chapter38","chapter39","chapter40"
];

const MAX_NEW_PER_DAY = 10;
const MAX_ITEMS_PER_SESSION = 20;
const REQUIRED_STREAK = 5;
const MASTERY_INTERVAL = 30; // days
const RARE_REVIEW_INTERVAL = 60; // days

let sessionCount = 0;
let failedThisSession = new Set();
let sessionStartTime = null;


let state = {
  nickname: localStorage.getItem("nickname"),
  activeChapters: JSON.parse(localStorage.getItem(SUBJECT + "_activeChapters") || "[]"),
progress: JSON.parse(localStorage.getItem(SUBJECT + "_progress") || "{}"),
todayNewCount: Number(localStorage.getItem(SUBJECT + "_todayNewCount") || 0),

  stats: { correct: 0, wrong: 0, new: 0, review: 0 }
};

let vocab = [];
let newQueue = [];
let learningQueue = [];
let reviewQueue = [];
let current = null;
let direction = null;

/* ================= STORAGE ================= */

function save() {
  localStorage.setItem("nickname", state.nickname);
  localStorage.setItem(SUBJECT + "_activeChapters", JSON.stringify(state.activeChapters));
localStorage.setItem(SUBJECT + "_progress", JSON.stringify(state.progress));
localStorage.setItem(SUBJECT + "_todayNewCount", state.todayNewCount);
}

function todayString() {
  return new Date().toISOString().slice(0,10);
}

function resetDailyCountIfNeeded() {
  const last = localStorage.getItem(SUBJECT + "_lastStudyDate");
  const today = todayString();

  if (last !== today) {
    state.todayNewCount = 0;
    localStorage.setItem(SUBJECT + "_lastStudyDate", today);
  }
}

/* ================= UI ================= */

function showNicknameScreen() {
  app.innerHTML = `
    <div class="center">
      <div class="card">
        <h1 class="heading">Smart Review</h1>
        <p>Enter your name to begin:</p>
        <input id="nickInput" placeholder="Nickname">
        <br><br>
        <button onclick="setNickname()">Continue</button>
      </div>
    </div>
  `;
}


function setNickname() {
  const val = document.getElementById("nickInput").value.trim();
  if (!val) return;
  state.nickname = val;
  save();
  showChapterScreen();
}

function showChapterScreen() {
  let html = `
    <div class="center">
      <div class="card">
        <h2 class="heading">Welcome to Smart Review, ${state.nickname}</h2>
        <h2 class="heading">Public Studies</h2>   
        <p style="margin:5px 0;">Select chapters</p>

        

        <div class="chapter-grid">
  `;

  CHAPTER_FILES.forEach((ch,i)=>{
    const selected = state.activeChapters.includes(ch) ? "selected":"";
    html += `<div class="chapter-tile ${selected}" onclick="toggleChapter('${ch}',this)">${i+1}</div>`;
  });

  html += `
        </div>
        <button onclick="startStudy()">Start Study</button>
      </div>
    </div>
  `;

  app.innerHTML = html;
}


function selectAllChapters() {
  state.activeChapters = [...CHAPTER_FILES];
  save();
  showChapterScreen();
}

function clearAllChapters() {
  state.activeChapters = [];
  save();
  showChapterScreen();
}
 

function toggleChapter(ch, el) {
  if (state.activeChapters.includes(ch)) {
    state.activeChapters = state.activeChapters.filter(c=>c!==ch);
    el.classList.remove("selected");
  } else {
    state.activeChapters.push(ch);
    el.classList.add("selected");
  }
  save();
}

/* ================= LOAD ================= */


function handleEnterContinue() {
  document.addEventListener("keydown", function(e) {
    if (e.key !== "Enter") return;

    const input = document.querySelector(".answer-input");
    if (!input) return; // only during answer screen

    const submitBtn = document.querySelector("#submitBtn");
    if (submitBtn) submitBtn.click();
  });
}



async function loadVocab() {
  vocab = [];
  for (let ch of state.activeChapters) {
    try {
      const res = await fetch("data/" + ch + ".json");
      if (!res.ok) throw new Error("Missing " + ch);
      const data = await res.json();
      vocab = vocab.concat(data);
    } catch (e) {
      console.error("Failed to load:", ch, e);
      alert("Could not load " + ch + ".json");
    }
  }
}


/* ================= SRS CORE ================= */

async function startStudy() {
  if (state.activeChapters.length===0) return alert("Select at least one chapter.");
  resetDailyCountIfNeeded();
  sessionStartTime = Date.now();
  sessionCount = 0;
  failedThisSession = new Set();
  state.stats = { correct: 0, wrong: 0, new: 0, review: 0 };
  await loadVocab();
  buildQueues();
  nextQuestion();
}

function buildQueues() {
  newQueue = [];
  learningQueue = [];
  reviewQueue = [];
  const now = Date.now();

  for (let item of vocab) {
    let p = state.progress[item.id];

    if (!p && state.todayNewCount < MAX_NEW_PER_DAY) {
      newQueue.push(item);
    } 
    else if (p && now >= p.nextReview) {
  if (p.status === "learning") {
    learningQueue.push(item);
  } else if (p.status === "mastered") {
    reviewQueue.push(item); // rare reviews only
  } else {
    reviewQueue.push(item);
  }
}

  }

  shuffle(newQueue);
  shuffle(learningQueue);
  shuffle(reviewQueue);
}



 function renderProgress() {
  const remaining =
    newQueue.length + learningQueue.length + reviewQueue.length + 1;

  const currentNum = sessionCount + 1;

  const maxTotal = Math.min(
    currentNum + remaining - 1,
    MAX_ITEMS_PER_SESSION
  );

  const percent = Math.round((currentNum / maxTotal) * 100);

  return `
    <div class="progress-text">
      Word ${currentNum} / ${maxTotal}
    </div>
    <div class="progress-bar">
      <div class="progress-fill" style="width:${percent}%"></div>
    </div>
  `;
}


function getChapterNumber(item) {
  // id looks like "ch3_earth" → extract the 3
  const match = item.id.match(/^ch(\d+)_/);
  return match ? match[1] : "?";
}		
		
		
		

function nextQuestion() {
  if (sessionCount >= MAX_ITEMS_PER_SESSION) return showResults();
  if (!reviewQueue.length && !learningQueue.length && !newQueue.length) return showResults();

  if (learningQueue.length) current = learningQueue.shift();
  else if (reviewQueue.length) current = reviewQueue.shift();
  else current = newQueue.shift();

  direction = Math.random()<0.5?"en-jp":"jp-en";

  const prompt = direction==="en-jp"?current.en:current.jp;

  const chapterNum = getChapterNumber(current);
  const label = direction==="en-jp"?"日本語でタイプ:":"Type the English word:";

  app.innerHTML = `
  <div class="center">
    <div class="card study-card">

    ${renderProgress()}

      <div style="font-size:0.9em; color:#6b7280; margin-bottom:6px;">
        Chapter ${chapterNum}
      </div>

      <div class="word">${prompt}</div>
      <div class="prompt-label center">${label}</div>

      <input id="answer" class="answer-input">
            
      <div class="center" style="margin-top:15px;">
        <button id="submitBtn" onclick="submitAnswer()">Submit</button>
      </div>

    </div>
  </div>
`;

// force focus (mobile friendly)
setTimeout(() => {
  const input = document.getElementById("answer");
  if (input) input.focus();
}, 50);




}

/* ================= CHECKING ================= */

function normalizeJP(str) {
  return str.replace(/[\u30a1-\u30f6]/g, ch =>
    String.fromCharCode(ch.charCodeAt(0)-0x60)
  );
}

function levenshtein(a,b){
  const dp=Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));
  for(let i=0;i<=a.length;i++)dp[i][0]=i;
  for(let j=0;j<=b.length;j++)dp[0][j]=j;
  for(let i=1;i<=a.length;i++){
    for(let j=1;j<=b.length;j++){
      dp[i][j]=Math.min(
        dp[i-1][j]+1,
        dp[i][j-1]+1,
        dp[i-1][j-1]+(a[i-1]==b[j-1]?0:1)
      );
    }
  }
  return dp[a.length][b.length];
}

function submitAnswer() {
  const input = document.getElementById("answer").value.trim();
  let result = "wrong";

  if (direction === "en-jp") {
    const a = normalizeJP(input);
    if (
      a === normalizeJP(current.jp) ||
      (current.kana && a === normalizeJP(current.kana))
    ) {
      result = "correct";
    }
  } else {
    const dist = levenshtein(
      input.toLowerCase(),
      current.en.toLowerCase()
    );
    if (dist === 0) result = "correct";
    else if (dist <= 1) result = "partial";
  }

  sessionCount++;

 if (result === "wrong") {
  state.stats.wrong++;

  // automatically apply "again"
  updateProgress("again");

  // show simple feedback (no grading buttons)
  app.innerHTML = `
    <div class="center">
      <div class="card">

       <h3 class="feedback-title incorrect">✘ Incorrect</h3>


        <div class="feedback-word">
          <strong>${current.en}</strong> = ${current.jp}
        </div>

        <div>${current.kana || ""}</div>
        ${current.example ? `<div class="example">${current.example}</div>` : ""}

        <p>We’ll try this again later.</p>

        <button onclick="nextQuestion()">Continue</button>

      </div>
    </div>
  `;
  return;
}



// count successful recall here
state.stats.correct++;
showFeedback(result);

}




function gradeAnswer(grade) {
  updateProgress(grade);
  nextQuestion();
}




function updateProgress(grade) {
  let p = state.progress[current.id];

  if (!p) {
    p = {
      status:"learning",
      interval:1,
      ease:2.3,
      streak:0,
      mastered:false,
      nextReview:Date.now(),
      totalCorrect: 0,
      masteredInterval: RARE_REVIEW_INTERVAL,
      lapses: 0 

    };
    state.progress[current.id]=p;
    state.stats.new++;
    state.todayNewCount++;
  } else {
    state.stats.review++;
  }

 if (grade === "again") {
  p.lapses = (p.lapses || 0) + 1;

  p.streak = 0;
  p.interval = 1;
  p.status = "learning";

  if (p.mastered) {
    p.mastered = false;
    p.masteredInterval = RARE_REVIEW_INTERVAL;
  }

  // stronger ease penalty based on lapse history
  p.ease = Math.max(1.3, p.ease - 0.2 - (p.lapses * 0.05));

  

  if (!failedThisSession.has(current.id)) {
    failedThisSession.add(current.id);
    learningQueue.push(current);
  }

  save();
  return;
}




  if (grade === "hard") {
    p.streak = Math.max(0, p.streak - 1);
    p.interval = Math.max(1, Math.round(p.interval * 0.8));
    p.ease = Math.max(1.5, p.ease - 0.15);
    
  }

  if (grade === "good") {
    p.streak++;
    p.totalCorrect++;
    p.interval = Math.round(p.interval * p.ease);
    p.ease = Math.min(p.ease + 0.1, 3);
    
  }

  if (grade === "easy") {
    p.streak += 2;
    p.totalCorrect++;
    p.interval = Math.round(p.interval * p.ease * 1.3);
    p.ease = Math.min(p.ease + 0.15, 3);
    
  }

  if (p.streak >= REQUIRED_STREAK && p.interval >= MASTERY_INTERVAL) {
    p.mastered = true;
    p.status = "mastered";
  } else if (p.interval >= 3) {
    p.status = "review";
  } else {
    p.status = "learning";
  }

  if (p.mastered) {
    p.masteredInterval = Math.min(
      Math.round(p.masteredInterval * 1.4),
      365
    );
    p.nextReview = Date.now() + p.masteredInterval * 86400000;
  } else {
    p.nextReview = Date.now() + p.interval * 86400000;
  }

  save();
}


/* ================= MASTERY BAR ================= */


function masterySegments(p) {
  const total = REQUIRED_STREAK;

  // cap bar until actually mastered
  const filled = p.mastered
    ? total
    : Math.min(p.streak, total - 1);

  let html = "";
  for (let i = 0; i < total; i++) {
    if (i < filled) {
      html += `<span class="mastery-seg filled"></span>`;
    } else {
      html += `<span class="mastery-seg"></span>`;
    }
  }
  return html;
}




/* ================= FEEDBACK ================= */

function showFeedback(result) {
  let msg =
    result === "correct" ? "✔ Correct!" :
    result === "partial" ? "⚠ Almost correct" :
    "✘ Incorrect";

  let p = state.progress[current.id] || { streak: 0, mastered: false };
  let bars = masterySegments(p);

  app.innerHTML = `
    <div class="center">
      <div class="card study-card">

       <h3 class="feedback-title ${
  result === "correct" ? "correct" :
  result === "partial" ? "partial" : "incorrect"
}">

          ${msg}
        </h3>

        <div class="feedback-word">
          <strong>${current.en}</strong> = ${current.jp}
        </div>

        <div>${current.kana || ""}</div>

        <div style="margin:10px 0;">
          <div>Mastery:</div>
          <div>
            ${bars} ${p.mastered ? "⭐ Mastered!" : ""}
          </div>
        </div>

        ${current.example ? `<div class="example">${current.example}</div>` : ""}

        <!-- instruction -->
        <div style="margin-top:20px; font-size:0.95em; color:#374151;">
          Now choose how well you remembered it:<br>
          <span style="font-size:0.9em; color:#6b7280;">
            （どれくらい覚えていたか選びましょう）
          </span>
        </div>

        <!-- buttons -->
        <div style="margin-top:15px;">
          <button onclick="gradeAnswer('hard')">
            Hard<br><span style="font-size:0.75em;">（むずかしかった）</span>
          </button>
          <button onclick="gradeAnswer('good')">
            Good<br><span style="font-size:0.75em;">（だいたい覚えていた）</span>
          </button>
          <button onclick="gradeAnswer('easy')">
            Easy<br><span style="font-size:0.75em;">（かんたんだった）</span>
          </button>
        </div>

      </div>
    </div>
  `;
}



/* ================= RESULTS ================= */

function showResults() {
  const now = new Date();
  const chapters = state.activeChapters.map(ch=>ch.replace("chapter","")).join(", ");

const elapsed = sessionStartTime ? Date.now() - sessionStartTime : 0;
const totalSeconds = Math.floor(elapsed / 1000);
const minutes = Math.floor(totalSeconds / 60);
const seconds = totalSeconds % 60;


  app.innerHTML = `
    <div class="center">
      <div class="card">

        <h2>Smart Review – Public Studies</h2>
        
        <!-- student name stays centered -->
        <h3 style="text-align:center;">${state.nickname}</h3>

        <!-- results aligned left -->
        <div style="text-align:left; margin-top:15px;">
          <p>Date: ${now.toLocaleDateString()}</p>
          <p>Chapters studied: ${chapters}</p>

          <p>Total study time: ${minutes} min ${seconds} sec</p>

          <p>New: ${state.stats.new}</p>
          <p>Review: ${state.stats.review}</p>
          <p>Correct: ${state.stats.correct}</p>
          <p>Incorrect: ${state.stats.wrong}</p>

          <p>Accuracy: ${Math.round(state.stats.correct/(state.stats.correct+state.stats.wrong)*100)||0}%</p>
        </div>

        <p style="margin-top:15px;"><strong>Great work today!</strong></p>

      </div>
    </div>
  `;
}



/* ================= UTILS ================= */

function shuffle(arr){
  for(let i=arr.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
}

/* ================= START ================= */

handleEnterContinue();

if (!state.nickname) showNicknameScreen();
else showChapterScreen();
