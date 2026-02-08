const app = document.getElementById("app");

const CHAPTER_FILES = ["chapter1", "chapter2", "chapter3", "chapter4", "chapter5", "chapter6", "chapter7", "chapter8", "chapter9", "chapter10", "chapter11", "chapter12", "chapter13", "chapter14", "chapter15", "chapter16", "chapter17", "chapter18", "chapter19", "chapter20", "chapter21", "chapter22", "chapter23", "chapter24", "chapter25", "chapter26", "chapter27", "chapter28", "chapter29", "chapter30", "chapter31", "chapter32", "chapter33", "chapter34", "chapter35", "chapter36", "chapter37", "chapter38", "chapter39", "chapter40"]; // add more later
const MAX_NEW_PER_DAY = 10;

let state = {
  nickname: localStorage.getItem("nickname"),
  activeChapters: JSON.parse(localStorage.getItem("activeChapters") || "[]"),
  progress: JSON.parse(localStorage.getItem("progress") || "{}"),
  todayNewCount: 0,
  stats: { correct: 0, wrong: 0, new: 0, review: 0 }
};

let vocab = [];
let queue = [];
let current = null;
let direction = null;

function save() {
  localStorage.setItem("nickname", state.nickname);
  localStorage.setItem("activeChapters", JSON.stringify(state.activeChapters));
  localStorage.setItem("progress", JSON.stringify(state.progress));
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function resetDailyCountIfNeeded() {
  const last = localStorage.getItem("lastStudyDate");
  const today = todayString();
  if (last !== today) {
    state.todayNewCount = 0;
    localStorage.setItem("lastStudyDate", today);
  } else {
    state.todayNewCount = parseInt(localStorage.getItem("todayNewCount") || "0");
  }
}

function saveDailyCount() {
  localStorage.setItem("todayNewCount", state.todayNewCount);
}

function showNicknameScreen() {
  app.innerHTML = `
    <h2>Enter your nickname</h2>
    <input id="nickInput">
    <button onclick="setNickname()">Start</button>
  `;
}

function setNickname() {
  const val = document.getElementById("nickInput").value.trim();
  if (!val) return;
  state.nickname = val;
  save();
  showChapterScreen();
}

async function loadVocab() {
  vocab = [];
  for (let ch of state.activeChapters) {
    const res = await fetch("data/" + ch + ".json");
    const data = await res.json();
    vocab = vocab.concat(data);
  }
}

function showChapterScreen() {
  let html = `<h2>Select chapters</h2>`;
  html += `<div class="chapter-grid">`;

  CHAPTER_FILES.forEach((ch, i) => {
    const num = i + 1;
    const selected = state.activeChapters.includes(ch) ? "selected" : "";
    html += `<div class="chapter-tile ${selected}" onclick="toggleChapter('${ch}', this)">${num}</div>`;
  });

  html += `</div>`;
  html += `<button onclick="startStudy()">Save & Start Study</button>`;
  app.innerHTML = html;
}



function toggleChapter(ch, el) {
  if (state.activeChapters.includes(ch)) {
    state.activeChapters = state.activeChapters.filter(c => c !== ch);
    el.classList.remove("selected");
  } else {
    state.activeChapters.push(ch);
    el.classList.add("selected");
  }
  save();
}


async function startStudy() {
  if (state.activeChapters.length === 0) return alert("Select at least one chapter.");

  resetDailyCountIfNeeded();
  await loadVocab();
  buildQueue();
  nextQuestion();
}

function buildQueue() {
  queue = [];
  const now = Date.now();

  for (let item of vocab) {
    const p = state.progress[item.id];
    if (!p) {
      if (state.todayNewCount < MAX_NEW_PER_DAY) {
        queue.push({ item, type: "new" });
      }
    } else {
      if (now >= p.nextReview) {
        queue.push({ item, type: "review" });
      }
    }
  }

  shuffle(queue);
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function nextQuestion() {
  if (queue.length === 0) return showResults();
  const q = queue.shift();
  current = q.item;
  direction = Math.random() < 0.5 ? "en-jp" : "jp-en";

  const prompt = direction === "en-jp" ? current.en : current.jp;
  const label = direction === "en-jp" ? "日本語でタイプ:" : "Type the English word:";

  app.innerHTML = `
    <div class="word">${prompt}</div>
    <div>${label}</div>
    <input id="answer">
    <button onclick="submitAnswer()">Submit</button>
  `;
}

function normalizeJP(str) {
  return str.replace(/[\u30a1-\u30f6]/g, ch =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );
}

function submitAnswer() {
  const input = document.getElementById("answer").value.trim();
  let correct = false;

  if (direction === "en-jp") {
    const a = normalizeJP(input);
    const jp = normalizeJP(current.jp);
    const kana = normalizeJP(current.kana);
    correct = (a === jp || a === kana);
  } else {
    correct = input.toLowerCase() === current.en.toLowerCase();
  }

  if (!state.progress[current.id]) {
    state.progress[current.id] = { interval: 1, nextReview: Date.now() };
    state.todayNewCount++;
    state.stats.new++;
  } else {
    state.stats.review++;
  }

  if (correct) {
    state.stats.correct++;
    state.progress[current.id].interval *= 2;
  } else {
    state.stats.wrong++;
    state.progress[current.id].interval = 1;
  }

  state.progress[current.id].nextReview =
    Date.now() + state.progress[current.id].interval * 86400000;

  save();
  saveDailyCount();
  showFeedback(correct, input);
}

function showFeedback(correct, input) {
  app.innerHTML = `
    <h3>${correct ? "✔ Correct!" : "✘ Incorrect"}</h3>
    <div>${current.en} = ${current.jp}</div>
    <div>${current.kana}</div>
    <div class="example">${current.example}</div>
    <button onclick="nextQuestion()">Next</button>
  `;
}

function showResults() {
  const now = new Date();

  // Convert ["chapter1","chapter5","chapter7"] → "1, 5, 7"
  const chapterNumbers = state.activeChapters
    .map(ch => ch.replace("chapter", ""))
    .join(", ");

  app.innerHTML = `
    <h2>Junior High Geography SRS</h2>
    <p>Nickname: ${state.nickname}</p>
    <p>Date: ${now.toLocaleDateString()}</p>
    <p>Time: ${now.toLocaleTimeString()}</p>
    <p>Chapters studied: ${chapterNumbers}</p>
    <p>New words: ${state.stats.new}</p>
    <p>Review words: ${state.stats.review}</p>
    <p>Correct: ${state.stats.correct}</p>
    <p>Incorrect: ${state.stats.wrong}</p>
    <p>Accuracy: ${Math.round(state.stats.correct / (state.stats.correct + state.stats.wrong) * 100) || 0}%</p>
    <p><strong>Screenshot this screen and send it to your teacher.</strong></p>
  `;
}

if (!state.nickname) {
  showNicknameScreen();
} else {
  showChapterScreen();
}