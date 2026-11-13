// BuddyBay - frontend ostrova.
// Animace peta se cte ze spritesheetu v Codex/ChatGPT formatu:
// 8 sloupcu x 11 radku, bunka 192 x 208 px, radky = stavy.

const CELL_W = 192;
const CELL_H = 208;

// Stav -> radek ve spritesheetu a pocet snimku v radku.
const PET_STATES = {
  "idle":           { row: 0,  frames: 6 },
  "running-right":  { row: 1,  frames: 8 },
  "running-left":   { row: 2,  frames: 8 },
  "waving":         { row: 3,  frames: 4 },
  "jumping":        { row: 4,  frames: 5 },
  "failed":         { row: 5,  frames: 8 },
  "waiting":        { row: 6,  frames: 6 },
  "running":        { row: 7,  frames: 6 },
  "review":         { row: 8,  frames: 6 },
  "look-000-157":   { row: 9,  frames: 8 },
  "look-180-337":   { row: 10, frames: 8 },
};

const FRAME_MS = 140;

const canvas = document.getElementById("pet");
const ctx = canvas.getContext("2d");
const bubble = document.getElementById("bubble");
const input = document.getElementById("prompt-input");
const form = document.getElementById("prompt");

const sheet = new Image();
sheet.src = "assets/pets/servo-skull/spritesheet.png";

let state = "idle";
let frame = 0;
let lastTick = 0;

function drawFrame() {
  const def = PET_STATES[state] ?? PET_STATES.idle;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!sheet.complete || sheet.naturalWidth === 0) return;
  const sx = frame * CELL_W;
  const sy = def.row * CELL_H;
  ctx.drawImage(sheet, sx, sy, CELL_W, CELL_H, 0, 0, canvas.width, canvas.height);
}

function loop(ts) {
  if (ts - lastTick >= FRAME_MS) {
    const def = PET_STATES[state] ?? PET_STATES.idle;
    frame = (frame + 1) % def.frames;
    lastTick = ts;
    drawFrame();
  }
  requestAnimationFrame(loop);
}

/** Nastavi stav peta (napr. z agenta). Neznamy stav spadne na idle. */
function setPetState(next) {
  state = PET_STATES[next] ? next : "idle";
  frame = 0;
  drawFrame();
}

/** Zobrazi bublinu s textem; po case zmizi. */
let bubbleTimer = null;
function say(text, ms = 4000) {
  bubble.textContent = text;
  bubble.hidden = false;
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => { bubble.hidden = true; }, ms);
}

// Zatim jen lokalni demo. Pozdeji sem prijde napojeni na agenty (MCP / API / Ollama).
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  setPetState("review");
  say(`Přijato: ${text}`);
  input.value = "";
  setTimeout(() => setPetState("idle"), 2500);
});

sheet.addEventListener("load", drawFrame);
requestAnimationFrame(loop);

// --- Skiny -----------------------------------------------------------------
// Skin meni jen vzhled (data-skin na <html>); funkce a API zustavaji stejne.
const SKINS = ["brass-radio", "glass-dock", "terminal-pet"];
const SKIN_KEY = "buddybay.skin";

function setSkin(name) {
  const skin = SKINS.includes(name) ? name : SKINS[0];
  document.documentElement.dataset.skin = skin;
  try { localStorage.setItem(SKIN_KEY, skin); } catch (_) { /* soukromy rezim / zakazane ulozeni */ }
  return skin;
}

function currentSkin() {
  return document.documentElement.dataset.skin || SKINS[0];
}

function cycleSkin() {
  const i = SKINS.indexOf(currentSkin());
  return setSkin(SKINS[(i + 1) % SKINS.length]);
}

// Obnoveni posledni volby; pri chybe zustane vychozi skin z HTML.
try {
  const saved = localStorage.getItem(SKIN_KEY);
  if (saved) setSkin(saved);
} catch (_) { /* ignorovat */ }

// Zkratka Ctrl+Shift+S prepne skin (zatim jediny ovladaci prvek).
window.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "s") {
    e.preventDefault();
    cycleSkin();
  }
});

// Expose pro pozdejsi napojeni (Tauri invoke / event listener).
window.buddy = { setPetState, say, setSkin, cycleSkin, currentSkin, SKINS, PET_STATES };
