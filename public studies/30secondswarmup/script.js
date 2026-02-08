// =====================
// GAME STATE
// =====================
let wordPool = {};
let unusedWords = [];

let currentRound = 1;
let roundScore = 0;

let timer = null;
let timeLeft = 30;
let roundActive = false;
let selectedChapters = [];

const MAX_WORDS_PER_ROUND = 5;

// =====================
// DOM ELEMENTS
// =====================
const startScreen = document.getElementById("start-screen");
const setupForm = document.getElementById("setup-form");
const chapterSelection = document.getElementById("chapter-selection");

const gameScreen = document.getElementById("game-screen");
const readyScreen = document.getElementById("ready-screen");
const readyText = document.getElementById("ready-text");

const startRoundBtn = document.getElementById("start-round-btn");

const timerContainer = document.getElementById("timer-container");
const timerDisplay = document.getElementById("time-left");

const wordDisplayContainer = document.getElementById("word-display-container");

const reviewScreen = document.getElementById("review-screen");
const reviewScore = document.getElementById("review-score");
const reviewOkBtn = document.getElementById("review-ok-btn");

const finalReview = document.getElementById("final-review");

// =====================
// LOAD CHAPTERS
// =====================
async function loadChapters() {
  const response = await fetch("chapters.json");
  const data = await response.json();
  wordPool = data;

  chapterSelection.innerHTML = `<div class="chapter-grid"></div>`;
  const grid = chapterSelection.querySelector(".chapter-grid");

  const chapters = Object.keys(data);

  chapters.forEach((chapter, i) => {
    const tile = document.createElement("div");
    tile.className = "chapter-tile";
    tile.textContent = i + 1;

    tile.onclick = () => toggleChapter(chapter, tile);

    grid.appendChild(tile);
  });
}

// =====================
// SETUP
// =====================
setupForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const chosen = selectedChapters.map(ch => wordPool[ch]);

  if (chosen.length === 0) {

    alert("Please select at least one chapter.");
    return;
  }

  // unique + fresh word list
  unusedWords = [...new Set(chosen.flat())];

  shuffleArray(unusedWords);

  currentRound = 1;

  startScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");

  showReadyScreen();
});

// =====================
// READY SCREEN
// =====================
function showReadyScreen() {
  wordDisplayContainer.innerHTML = "";
  reviewScreen.classList.add("hidden");
  timerContainer.classList.add("hidden");

  readyText.textContent =
    currentRound === 1 ? "Ready Player 1" : "Ready Player 2";

  readyScreen.classList.remove("hidden");
}

function toggleChapter(chapter, tile) {
  if (selectedChapters.includes(chapter)) {
    selectedChapters = selectedChapters.filter(c => c !== chapter);
    tile.classList.remove("selected");
  } else {
    selectedChapters.push(chapter);
    tile.classList.add("selected");
  }
}



// =====================
// START ROUND
// =====================
startRoundBtn.addEventListener("click", () => {
  readyScreen.classList.add("hidden");
  startRound();
});

function startRound() {
  roundScore = 0;
  roundActive = true;

  timeLeft = 30;
  timerDisplay.textContent = timeLeft;
  timerContainer.classList.remove("hidden");

  // pull words WITHOUT replacement
  const roundWords = unusedWords.splice(0, MAX_WORDS_PER_ROUND);

  wordDisplayContainer.innerHTML = "";

  roundWords.forEach(word => {
    const row = document.createElement("div");
    row.className = "word-row";

    const text = document.createElement("span");
    text.textContent = word;

    const btn = document.createElement("button");
    btn.textContent = "Correct";

    btn.onclick = () => {
      if (!roundActive || btn.disabled) return;
      btn.disabled = true;
      roundScore++;
    };

    row.appendChild(text);
    row.appendChild(btn);
    wordDisplayContainer.appendChild(row);
  });

  timer = setInterval(() => {
    timeLeft--;
    timerDisplay.textContent = timeLeft;

    if (timeLeft <= 0) {
      clearInterval(timer);
      endRound();
    }
  }, 1000);
}

// =====================
// END ROUND
// =====================
function endRound() {
  roundActive = false;
  timerContainer.classList.add("hidden");

  // disable all buttons immediately
  document
    .querySelectorAll(".word-row button")
    .forEach(btn => (btn.disabled = true));

  reviewScore.textContent = roundScore;
  reviewScreen.classList.remove("hidden");
}

// =====================
// REVIEW OK
// =====================
reviewOkBtn.addEventListener("click", () => {
  reviewScreen.classList.add("hidden");

  if (currentRound === 1) {
    currentRound = 2;
    showReadyScreen();
  } else {
    showFinalReview();
  }
});

// =====================
// FINAL REVIEW
// =====================
function showFinalReview() {
  finalReview.classList.remove("hidden");
}

// =====================
// UTIL
// =====================
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

loadChapters();