// BuddyBay - frontend ostrova.
// Vice buddy: kazdy ma svuj mazlicek (spritesheet), poskytovatele modelu a stav.
// Aktivni buddy jsou v liste na liste; zprava jde vybranemu buddy.

// --- Mazlicci ---------------------------------------------------------------
// Spritesheet v Codex/ChatGPT formatu: 8 sloupcu x 11 radku, bunka 192 x 208 px.
const CELL_W = 192;
const CELL_H = 208;
const FRAME_MS = 140;

const PET_STATES = {
  "idle":            { row: 0,  frames: 6 },
  "running-right":   { row: 1,  frames: 8 },
  "running-left":    { row: 2,  frames: 8 },
  "waving":          { row: 3,  frames: 4 },
  "jumping":         { row: 4,  frames: 5 },
  "failed":          { row: 5,  frames: 8 },
  "waiting":         { row: 6,  frames: 6 },
  "running":         { row: 7,  frames: 6 },
  "review":          { row: 8,  frames: 6 },
  "look-000-157":    { row: 9,  frames: 8 },
  "look-180-337":    { row: 10, frames: 8 },
};

// Dalsi mazlicci se pridaji sem (sprite + stavy). Zatim je jen Servo-skull.
const PETS = {
  "servo-skull": {
    name: "Servo-skull",
    sheet: "assets/pets/servo-skull/spritesheet.png",
    states: PET_STATES,
  },
};

const DEFAULT_PET = "servo-skull";

// --- Skiny a poskytovatele ---------------------------------------------------
const SKINS = ["brass-radio", "glass-dock", "terminal-pet"];
const SKIN_KEY = "buddybay.skin";
const PROVIDERS = ["ollama", "anthropic"];
const PROVIDER_LABELS = { ollama: "Lokální (Ollama)", anthropic: "Cloud (Claude)" };
const BUDDIES_KEY = "buddybay.buddies";

// --- Ulozene nastaveni (jen per-viewer, zatim v localStorage) ----------------
function storageGet(key) {
  try { return localStorage.getItem(key); } catch (_) { return null; }
}
function storageSet(key, value) {
  try { localStorage.setItem(key, value); } catch (_) { /* soukromy rezim */ }
}

// --- Buddy -------------------------------------------------------------------
let nextBuddyNumber = 1;

function makeBuddy(name) {
  nextBuddyNumber += 1;
  return {
    id: `b${Date.now().toString(36)}${nextBuddyNumber}`,
    petId: DEFAULT_PET,
    name: name || `Buddy ${nextBuddyNumber}`,
    provider: "ollama",
    active: true,
  };
}

function defaultBuddies() {
  return [{ id: "b1", petId: DEFAULT_PET, name: "Servo", provider: "ollama", active: true }];
}

function loadBuddies() {
  try {
    const parsed = JSON.parse(storageGet(BUDDIES_KEY) ?? "null");
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((b) => ({
        id: String(b.id),
        petId: PETS[b.petId] ? b.petId : DEFAULT_PET,
        name: String(b.name || "Buddy").slice(0, 24),
        provider: PROVIDERS.includes(b.provider) ? b.provider : "ollama",
        active: b.active !== false,
      }));
    }
  } catch (_) { /* spatne ulozena data -> vychozi */ }
  return defaultBuddies();
}

let buddies = loadBuddies();
let selectedId = (buddies.find((b) => b.active) ?? buddies[0]).id;

function saveBuddies() {
  storageSet(BUDDIES_KEY, JSON.stringify(buddies));
}

function findBuddy(id) {
  return buddies.find((b) => b.id === id) ?? null;
}

function activeBuddies() {
  return buddies.filter((b) => b.active);
}

// --- Obrazky mazlicku a stav kazdeho buddy -----------------------------------
const petImages = {};
for (const [id, pet] of Object.entries(PETS)) {
  const img = new Image();
  img.addEventListener("load", () => drawAll());
  img.src = pet.sheet;
  petImages[id] = img;
}

// runtime[buddyId] = { canvas, ctx, state, frame, lastTick }
const runtime = new Map();

function ensureRuntime(buddy) {
  let rt = runtime.get(buddy.id);
  if (!rt) {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 72;
    canvas.title = buddy.name;
    rt = { canvas, ctx: canvas.getContext("2d"), state: "idle", frame: 0, lastTick: 0 };
    canvas.addEventListener("click", () => selectBuddy(buddy.id));
    runtime.set(buddy.id, rt);
  }
  return rt;
}

function drawBuddy(buddy, rt) {
  const pet = PETS[buddy.petId];
  const img = petImages[buddy.petId];
  const def = pet.states[rt.state] ?? pet.states.idle;
  rt.ctx.clearRect(0, 0, rt.canvas.width, rt.canvas.height);
  if (!img || !img.complete || img.naturalWidth === 0) return;
  rt.ctx.drawImage(
    img,
    rt.frame * CELL_W, def.row * CELL_H, CELL_W, CELL_H,
    0, 0, rt.canvas.width, rt.canvas.height,
  );
}

function drawAll() {
  for (const buddy of activeBuddies()) {
    drawBuddy(buddy, ensureRuntime(buddy));
  }
}

function tick(ts) {
  for (const buddy of activeBuddies()) {
    const rt = ensureRuntime(buddy);
    if (ts - rt.lastTick >= FRAME_MS) {
      const def = PETS[buddy.petId].states[rt.state] ?? PETS[buddy.petId].states.idle;
      rt.frame = (rt.frame + 1) % def.frames;
      rt.lastTick = ts;
      drawBuddy(buddy, rt);
    }
  }
  requestAnimationFrame(tick);
}

/** Nastavi stav konkretniho buddy (vychozi: vybrany). */
function setPetState(next, id = selectedId) {
  const buddy = findBuddy(id);
  if (!buddy) return;
  const rt = ensureRuntime(buddy);
  rt.state = PETS[buddy.petId].states[next] ? next : "idle";
  rt.frame = 0;
  drawBuddy(buddy, rt);
}

// --- Lista buddy na liste ----------------------------------------------------
const buddiesEl = document.getElementById("buddies");

function renderBar() {
  buddiesEl.replaceChildren();
  for (const buddy of activeBuddies()) {
    const rt = ensureRuntime(buddy);
    rt.canvas.classList.toggle("selected", buddy.id === selectedId);
    buddiesEl.appendChild(rt.canvas);
    drawBuddy(buddy, rt);
  }
}

function selectBuddy(id) {
  const buddy = findBuddy(id);
  if (!buddy || !buddy.active) return;
  selectedId = id;
  renderBar();
  input.placeholder = `Zadej úkol pro ${buddy.name}…`;
}

// --- Bublina ------------------------------------------------------------------
const bubble = document.getElementById("bubble");
let bubbleTimer = null;
function say(text, ms = 4000) {
  bubble.textContent = text;
  bubble.hidden = false;
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => { bubble.hidden = true; }, ms);
}

// --- Vstup a volani agenta ---------------------------------------------------
const form = document.getElementById("prompt");
const input = document.getElementById("prompt-input");
const invoke = window.__TAURI__?.core?.invoke ?? null;

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  const buddy = findBuddy(selectedId);
  if (!text || !buddy) return;
  input.value = "";

  if (!invoke) {
    setPetState("failed", buddy.id);
    say("Bez Tauri runtime nelze volat agenta.", 6000);
    return;
  }

  setPetState("running", buddy.id);
  say(`${buddy.name}: přemýšlím…`, 60000);
  try {
    const reply = await invoke("ask_agent", { prompt: text, provider: buddy.provider });
    setPetState("waving", buddy.id);
    say(`${buddy.name}: ${reply}`, 15000);
  } catch (err) {
    setPetState("failed", buddy.id);
    say(`${buddy.name}: ${err}`, 8000);
  }
  setTimeout(() => setPetState("idle", buddy.id), 3000);
});

// --- Skiny -------------------------------------------------------------------
function setSkin(name) {
  const skin = SKINS.includes(name) ? name : SKINS[0];
  document.documentElement.dataset.skin = skin;
  storageSet(SKIN_KEY, skin);
  return skin;
}

function currentSkin() {
  return document.documentElement.dataset.skin || SKINS[0];
}

function cycleSkin() {
  const i = SKINS.indexOf(currentSkin());
  return setSkin(SKINS[(i + 1) % SKINS.length]);
}

const savedSkin = storageGet(SKIN_KEY);
if (savedSkin) setSkin(savedSkin);

// --- Poskytovatel vybraneho buddy --------------------------------------------
function setProvider(buddyId, name) {
  const buddy = findBuddy(buddyId);
  if (!buddy) return null;
  buddy.provider = PROVIDERS.includes(name) ? name : PROVIDERS[0];
  saveBuddies();
  say(`${buddy.name}: ${PROVIDER_LABELS[buddy.provider]}`, 2500);
  return buddy.provider;
}

// --- Nastaveni (panel) -------------------------------------------------------
const settingsBtn = document.getElementById("settings-btn");
const settingsEl = document.getElementById("settings");
let settingsOpen = false;

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === "text") node.textContent = value;
    else if (key === "on") for (const [ev, fn] of Object.entries(value)) node.addEventListener(ev, fn);
    else if (key in node) node[key] = value;
    else node.setAttribute(key, value);
  }
  for (const child of children) node.appendChild(child);
  return node;
}

function renderSettings() {
  const skinSelect = el("select", {
    on: { change: (e) => setSkin(e.target.value) },
  }, SKINS.map((s) => el("option", { value: s, text: s, selected: s === currentSkin() })));

  const selected = findBuddy(selectedId);
  const providerSelect = el("select", {
    disabled: !selected,
    on: { change: (e) => setProvider(selectedId, e.target.value) },
  }, PROVIDERS.map((p) => el("option", {
    value: p, text: PROVIDER_LABELS[p], selected: selected?.provider === p,
  })));

  const rows = buddies.map((b) => {
    const nameInput = el("input", {
      type: "text", value: b.name, maxLength: 24, "aria-label": "Jméno buddy",
      on: { change: (e) => { b.name = e.target.value.trim().slice(0, 24) || b.name; saveBuddies(); renderBar(); renderSettings(); } },
    });
    const petSelect = el("select", {
      "aria-label": "Mazlíček",
      on: { change: (e) => { b.petId = e.target.value; saveBuddies(); renderBar(); } },
    }, Object.entries(PETS).map(([id, p]) => el("option", { value: id, text: p.name, selected: b.petId === id })));
    const activeBox = el("input", {
      type: "checkbox", checked: b.active, "aria-label": "Aktivní",
      on: { change: (e) => {
        b.active = e.target.checked;
        if (!b.active && selectedId === b.id) selectedId = activeBuddies()[0]?.id ?? null;
        if (!selectedId && activeBuddies().length) selectedId = activeBuddies()[0].id;
        saveBuddies(); renderBar(); renderSettings();
      } },
    });
    const removeBtn = el("button", {
      type: "button", text: "Smazat", disabled: buddies.length <= 1,
      on: { click: () => {
        buddies = buddies.filter((x) => x.id !== b.id);
        runtime.delete(b.id);
        if (selectedId === b.id) selectedId = activeBuddies()[0]?.id ?? null;
        saveBuddies(); renderBar(); renderSettings();
      } },
    });
    return el("div", { className: "settings-row" }, [activeBox, nameInput, petSelect, removeBtn]);
  });

  const addBtn = el("button", {
    type: "button", text: "+ Přidat buddy",
    on: { click: () => {
      const b = makeBuddy();
      buddies.push(b);
      if (!selectedId) selectedId = b.id;
      saveBuddies(); renderBar(); renderSettings();
    } },
  });

  settingsEl.replaceChildren(
    el("div", { className: "settings-section" }, [el("label", { text: "Skin" }), skinSelect]),
    el("div", { className: "settings-section" }, [
      el("label", { text: selected ? `Model pro ${selected.name}` : "Model (vyber buddy)" }),
      providerSelect,
    ]),
    el("div", { className: "settings-section" }, [
      el("label", { text: "Buddy (zaškrtni aktivní)" }),
      ...rows,
      addBtn,
    ]),
  );
}

function applySize() {
  if (!appWindow || !LogicalSizeCtor) return;
  const h = settingsOpen ? SETTINGS_H : (collapsed ? COLLAPSED_H : EXPANDED_H);
  appWindow.setSize(new LogicalSizeCtor(WINDOW_W, h)).catch(() => {});
}

function toggleSettings() {
  settingsOpen = !settingsOpen;
  settingsEl.hidden = !settingsOpen;
  if (settingsOpen) {
    setCollapsed(false);
    renderSettings();
  }
  applySize();
}

settingsBtn.addEventListener("click", toggleSettings);

// --- Schovavani na okraj -----------------------------------------------------
// Okno se meni pres capability core:window:allow-set-size.
const WINDOW_W = 460;
const EXPANDED_H = 120;
const SETTINGS_H = 300;
const COLLAPSED_H = 24;
const COLLAPSE_DELAY_MS = 1500;

const island = document.getElementById("island");
const appWindow = window.__TAURI__?.window?.getCurrentWindow?.() ?? null;
const LogicalSizeCtor = window.__TAURI__?.window?.LogicalSize ?? null;
let collapsed = false;
let collapseTimer = null;

function setCollapsed(next) {
  if (collapsed === next) return;
  collapsed = next;
  island.classList.toggle("collapsed", next);
  applySize();
}

island.addEventListener("mouseenter", () => {
  clearTimeout(collapseTimer);
  setCollapsed(false);
});

island.addEventListener("mouseleave", () => {
  clearTimeout(collapseTimer);
  collapseTimer = setTimeout(() => {
    // Nesbalovat, dokud uzivatel pise nebo ma otevrene nastaveni.
    if (document.activeElement === input || settingsOpen) return;
    setCollapsed(true);
  }, COLLAPSE_DELAY_MS);
});

input.addEventListener("blur", () => {
  if (!island.matches(":hover") && !settingsOpen) setCollapsed(true);
});

// --- Zkratky -----------------------------------------------------------------
window.addEventListener("keydown", (e) => {
  if (!(e.ctrlKey && e.shiftKey)) return;
  const key = e.key.toLowerCase();
  if (key === "s") { e.preventDefault(); cycleSkin(); }
  if (key === "p" && selectedId) {
    e.preventDefault();
    const buddy = findBuddy(selectedId);
    const i = PROVIDERS.indexOf(buddy.provider);
    setProvider(selectedId, PROVIDERS[(i + 1) % PROVIDERS.length]);
  }
});

// --- Start -------------------------------------------------------------------
renderBar();
requestAnimationFrame(tick);

// Expose pro pozdejsi napojeni (Tauri invoke / event listener).
window.buddy = {
  setPetState, say, setSkin, cycleSkin, currentSkin, selectBuddy,
  SKINS, PETS, PROVIDERS, get buddies() { return buddies; },
};
