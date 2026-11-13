// BuddyBay - frontend ostrova.
// Vice buddy: kazdy ma svuj mazlicek (spritesheet), model, velikost a stav.
// Aktivni buddy jsou na liste; zprava jde vybranemu buddy.
// Texty jsou v src/i18n/<jazyk>.json (vychozi en), prepinani v nastaveni.

// --- Jazyk -------------------------------------------------------------------
const LANG_KEY = "buddybay.lang";
const LANGS = ["en", "cs"];
const LANG_NAMES = { en: "English", cs: "Čeština" };

function storageGet(key) {
  try { return localStorage.getItem(key); } catch (_) { return null; }
}
function storageSet(key, value) {
  try { localStorage.setItem(key, value); } catch (_) { /* soukromy rezim */ }
}

let lang = LANGS.includes(storageGet(LANG_KEY)) ? storageGet(LANG_KEY) : "en";
let dict = {};
let fallbackDict = {};

async function loadDict(code) {
  const res = await fetch(`i18n/${code}.json`);
  if (!res.ok) throw new Error(`i18n ${code}: ${res.status}`);
  return res.json();
}

/** Nacte jazyk (anglictina je vzdy zaloha). */
async function loadLang(code) {
  try { fallbackDict = await loadDict("en"); } catch (_) { fallbackDict = {}; }
  try { dict = code === "en" ? fallbackDict : await loadDict(code); } catch (_) { dict = fallbackDict; }
  lang = code;
  document.documentElement.lang = code;
  storageSet(LANG_KEY, code);
}

/** Preklad klice s dosazenim {promennych}. */
function t(key, vars = {}) {
  let s = dict[key] ?? fallbackDict[key] ?? key;
  for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/** Preklada staticke prvky oznacene data-i18n-* v index.html. */
function applyStaticTexts() {
  document.querySelectorAll("[data-i18n]").forEach((n) => { n.textContent = t(n.dataset.i18n); });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((n) => { n.placeholder = t(n.dataset.i18nPlaceholder); });
  document.querySelectorAll("[data-i18n-title]").forEach((n) => { n.title = t(n.dataset.i18nTitle); });
  document.querySelectorAll("[data-i18n-aria]").forEach((n) => { n.setAttribute("aria-label", t(n.dataset.i18nAria)); });
}

// --- Mazlicci ---------------------------------------------------------------
// Servo-skull: spritesheet 8 sloupcu x 11 radku, bunka 192 x 208 px.
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

// Kazdy mazlicek ma vlastni velikost bunky, rozlozeni a rychlost (ms na snimek).
// Pac-Man: 256 px bunky, radky a pocty snimku odpovidaji src/assets/pets/pacman/states.json.
const PETS = {
  "servo-skull": {
    name: "Servo-skull",
    sheet: "assets/pets/servo-skull/spritesheet.png",
    cellW: 192,
    cellH: 208,
    states: PET_STATES,
  },
  "pacman": {
    name: "Pac-Man",
    sheet: "assets/pets/pacman/spritesheet.png",
    cellW: 256,
    cellH: 256,
    states: {
      "idle":       { row: 0,  frames: 12, ms: 90 },
      "happy":      { row: 1,  frames: 10, ms: 85 },
      "wink":       { row: 2,  frames: 8,  ms: 95 },
      "sleepy":     { row: 3,  frames: 8,  ms: 130 },
      "thinking":   { row: 4,  frames: 8,  ms: 120 },
      "chomp":      { row: 5,  frames: 8,  ms: 75 },
      "sad":        { row: 6,  frames: 8,  ms: 130 },
      "angry":      { row: 7,  frames: 8,  ms: 110 },
      "tear":       { row: 8,  frames: 8,  ms: 130 },
      "surprised":  { row: 9,  frames: 10, ms: 80 },
      "look-sweep": { row: 10, frames: 15, ms: 60 },
      "look-left":  { row: 11, frames: 8,  ms: 70 },
      "look-right": { row: 12, frames: 8,  ms: 70 },
      // Stavy agentu namapovane na vyrazy Pac-Mana.
      "running":    { row: 5,  frames: 8,  ms: 75 },
      "waiting":    { row: 3,  frames: 8,  ms: 130 },
      "review":     { row: 4,  frames: 8,  ms: 120 },
      "failed":     { row: 6,  frames: 8,  ms: 130 },
      "waving":     { row: 2,  frames: 8,  ms: 95 },
      "jumping":    { row: 9,  frames: 10, ms: 80 },
    },
  },
};

const DEFAULT_PET = "servo-skull";
const BUDDY_BASE_W = 54;          // sirka v CSS px pri velikosti 100 %
const BUDDY_SCALE_DEFAULT = 1.3;  // vychozi velikost buddy
const BUDDY_SCALE_MIN = 0.8;
const BUDDY_SCALE_MAX = 2;

// --- Skiny, poskytovatele, ulozeni -------------------------------------------
const SKINS = ["brass-radio", "glass-dock", "terminal-pet", "windows"];
const SKIN_KEY = "buddybay.skin";
const PROVIDERS = ["ollama", "anthropic", "openai"];

// Vychozi pripojeni pro kazdeho poskytovatele. Klic se do profilu neuklada,
// jen nazev promenne prostredi (apiKeyEnv), ze ktere ho Rust cte.
const PROVIDER_DEFAULTS = {
  ollama: { provider: "ollama", baseUrl: "http://localhost:11434", model: "llama3.1:8b", apiKeyEnv: "" },
  anthropic: { provider: "anthropic", baseUrl: "https://api.anthropic.com", model: "claude-sonnet-5-5", apiKeyEnv: "ANTHROPIC_API_KEY" },
  openai: { provider: "openai", baseUrl: "http://localhost:1234/v1", model: "", apiKeyEnv: "" },
};

function providerLabel(p) {
  return t(`provider.${p}`);
}

function defaultConnection(provider) {
  const base = PROVIDER_DEFAULTS[provider] ?? PROVIDER_DEFAULTS.ollama;
  return { ...base, temperature: 0.7, maxTokens: 512, timeoutSecs: 120, systemPrompt: "" };
}

function sanitizeConnection(c, legacyProvider) {
  const provider = PROVIDERS.includes(c?.provider) ? c.provider : (PROVIDERS.includes(legacyProvider) ? legacyProvider : "ollama");
  const d = defaultConnection(provider);
  const num = (v, min, max, fallback) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };
  return {
    provider,
    baseUrl: String(c?.baseUrl ?? d.baseUrl).slice(0, 200),
    model: String(c?.model ?? d.model).slice(0, 120),
    apiKeyEnv: String(c?.apiKeyEnv ?? d.apiKeyEnv).replace(/[^A-Za-z0-9_]/g, "").slice(0, 64),
    temperature: num(c?.temperature, 0, 1.5, d.temperature),
    maxTokens: Math.round(num(c?.maxTokens, 16, 4096, d.maxTokens)),
    timeoutSecs: Math.round(num(c?.timeoutSecs, 5, 600, d.timeoutSecs)),
    systemPrompt: String(c?.systemPrompt ?? "").slice(0, 1000),
  };
}

const BUDDIES_KEY = "buddybay.buddies";
const AUTO_HIDE_KEY = "buddybay.autoHide";
const UI_SCALE_KEY = "buddybay.uiScale";
const UI_SCALE_DEFAULT = 1;

// --- Buddy -------------------------------------------------------------------
let nextBuddyNumber = 1;

function clampScale(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(BUDDY_SCALE_MAX, Math.max(BUDDY_SCALE_MIN, n)) : BUDDY_SCALE_DEFAULT;
}

function makeBuddy(name) {
  nextBuddyNumber += 1;
  return {
    id: `b${Date.now().toString(36)}${nextBuddyNumber}`,
    petId: DEFAULT_PET,
    name: name || t("buddy.newName", { n: nextBuddyNumber }),
    connection: defaultConnection("ollama"),
    active: true,
    scale: BUDDY_SCALE_DEFAULT,
  };
}

function defaultBuddies() {
  return [
    { id: "b1", petId: "servo-skull", name: "Servo", connection: defaultConnection("ollama"), active: true, scale: BUDDY_SCALE_DEFAULT },
    { id: "b2", petId: "pacman", name: "Pac-Man", connection: defaultConnection("ollama"), active: true, scale: BUDDY_SCALE_DEFAULT },
  ];
}

function loadBuddies() {
  try {
    const parsed = JSON.parse(storageGet(BUDDIES_KEY) ?? "null");
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((b) => ({
        id: String(b.id),
        petId: PETS[b.petId] ? b.petId : DEFAULT_PET,
        name: String(b.name || "Buddy").slice(0, 24),
        connection: sanitizeConnection(b.connection, b.provider),
        active: b.active !== false,
        scale: clampScale(b.scale),
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
    canvas.title = buddy.name;
    rt = { canvas, ctx: canvas.getContext("2d"), state: "idle", frame: 0, lastTick: 0 };
    canvas.addEventListener("click", () => selectBuddy(buddy.id));
    runtime.set(buddy.id, rt);
  }
  return rt;
}

/** Nastavi vnitrni rozliseni a CSS rozmer podle pomeru stran mazlicka (bez roztahovani). */
function sizeCanvas(buddy, rt) {
  const pet = PETS[buddy.petId];
  const w = 128;                              // vnitrni sirka: ostre vykresleni
  const h = Math.round(w * pet.cellH / pet.cellW);
  if (rt.canvas.width !== w || rt.canvas.height !== h) {
    rt.canvas.width = w;
    rt.canvas.height = h;
  }
  const cssW = BUDDY_BASE_W * buddy.scale;
  rt.canvas.style.width = `${cssW}px`;
  rt.canvas.style.height = `${cssW * pet.cellH / pet.cellW}px`;
  rt.canvas.title = buddy.name;
}

function drawBuddy(buddy, rt) {
  const pet = PETS[buddy.petId];
  const img = petImages[buddy.petId];
  const def = pet.states[rt.state] ?? pet.states.idle;
  rt.ctx.clearRect(0, 0, rt.canvas.width, rt.canvas.height);
  if (!img || !img.complete || img.naturalWidth === 0) return;
  rt.ctx.imageSmoothingEnabled = true;
  rt.ctx.imageSmoothingQuality = "high";
  rt.ctx.drawImage(
    img,
    rt.frame * pet.cellW, def.row * pet.cellH, pet.cellW, pet.cellH,
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
    const def = PETS[buddy.petId].states[rt.state] ?? PETS[buddy.petId].states.idle;
    const interval = def.ms ?? FRAME_MS;
    if (ts - rt.lastTick >= interval) {
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
    sizeCanvas(buddy, rt);
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
  input.placeholder = t("placeholder.forBuddy", { name: buddy.name });
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
    say(t("chat.noRuntime"), 6000);
    return;
  }

  setPetState("running", buddy.id);
  say(t("chat.thinking", { name: buddy.name }), 60000);
  try {
    const raw = await invoke("ask_agent", { prompt: text, config: buddy.connection });
    // Model na konci vrati znacku nalady [nalada:X]; ta se vytahne a zbytek je text.
    const m = raw.match(/\[nalada:\s*([a-z]+)\s*\]\s*$/i);
    const reply = raw.replace(/\s*\[nalada:[^\]]*\]\s*$/i, "").trim();
    const mood = m ? m[1].toLowerCase() : null;
    const known = mood && PETS[buddy.petId].states[mood] ? mood : "waving";
    setPetState(known, buddy.id);
    say(t("chat.reply", { name: buddy.name, text: reply }), 15000);
    setTimeout(() => setPetState("idle", buddy.id), 6000);
    return;
  } catch (err) {
    setPetState("failed", buddy.id);
    say(t("chat.error", { name: buddy.name, error: err }), 8000);
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

// Motiv Windows (svetly/tmavy rezim a barva zvyrazneni) pro skin "windows".
async function applySystemTheme() {
  if (!invoke) return;
  try {
    const theme = await invoke("get_system_theme");
    const root = document.documentElement.style;
    root.setProperty("--sys-accent", theme.accent);
    root.setProperty("--sys-bg", theme.dark ? "rgba(32, 32, 32, 0.94)" : "rgba(243, 243, 243, 0.96)");
    root.setProperty("--sys-text", theme.dark ? "#ffffff" : "#1a1a1a");
    root.setProperty("--sys-muted", theme.dark ? "#a0a0a0" : "#5f5f5f");
    root.setProperty("--sys-border", theme.dark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)");
  } catch (_) { /* bez motivu zustane vychozi */ }
}

// --- Poskytovatel konkretniho buddy ------------------------------------------
function setProvider(buddyId, name) {
  const buddy = findBuddy(buddyId);
  if (!buddy) return null;
  const provider = PROVIDERS.includes(name) ? name : PROVIDERS[0];
  // Zmena poskytovatele nastavi jeho vychozi adresu a model; ostatni hodnoty zachova.
  buddy.connection = { ...buddy.connection, ...PROVIDER_DEFAULTS[provider], provider };
  saveBuddies();
  say(t("provider.changed", { name: buddy.name, provider: providerLabel(provider) }), 2500);
  return provider;
}

// --- Automaticke skryvani a velikost ostrovu ---------------------------------
function autoHide() {
  return storageGet(AUTO_HIDE_KEY) !== "0";
}

function uiScale() {
  const v = Number(storageGet(UI_SCALE_KEY));
  return Number.isFinite(v) && v >= 0.8 && v <= 1.4 ? v : UI_SCALE_DEFAULT;
}

function applyUiScale(v) {
  document.documentElement.style.setProperty("--ui-scale", String(v));
  storageSet(UI_SCALE_KEY, String(v));
  applySize();
}

// --- Demo animaci (kazdy buddy hraje svuj seznam stavu) ----------------------
const DEMO_STEP_MS = 2400;
let demoTimer = null;
let demoStepCount = 0;

function demoTick() {
  const active = activeBuddies();
  if (active.length === 0) return;
  const labels = [];
  for (const buddy of active) {
    const names = Object.keys(PETS[buddy.petId].states);
    const state = names[demoStepCount % names.length];
    setPetState(state, buddy.id);
    labels.push(t("demo.label", { name: buddy.name, state }));
  }
  demoStepCount += 1;
  say(t("demo.line", { labels: labels.join(" · ") }), DEMO_STEP_MS);
}

function toggleDemo() {
  if (demoTimer) {
    clearInterval(demoTimer);
    demoTimer = null;
    for (const buddy of activeBuddies()) setPetState("idle", buddy.id);
    say(t("demo.stopped"), 1500);
  } else {
    demoStepCount = 0;
    demoTick();
    demoTimer = setInterval(demoTick, DEMO_STEP_MS);
  }
  renderSettings();
}

// --- Ukonceni a spousteni s Windows ------------------------------------------
let autostartOn = false;
const shortcutOn = { desktop: false, startmenu: false };

async function refreshAutostart() {
  if (!invoke) return;
  try {
    autostartOn = await invoke("get_autostart");
    shortcutOn.desktop = await invoke("get_shortcut", { kind: "desktop" });
    shortcutOn.startmenu = await invoke("get_shortcut", { kind: "startmenu" });
    if (settingsOpen) renderSettings();
  } catch (_) { /* bez zapisu zustane vypnuto */ }
}

function quitApp() {
  if (invoke) {
    invoke("quit_app").catch(() => window.close());
  } else {
    window.close();
  }
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

function section(title, ...content) {
  return el("div", { className: "settings-section" }, [el("label", { text: title }), ...content]);
}

// Nactene seznamy modelu podle buddy (jen v pameti, neuklada se).
const modelCache = {};

function buddyCard(b) {
  const activeBox = el("input", {
    type: "checkbox", checked: b.active, title: t("buddy.active"), "aria-label": t("buddy.active"),
    on: { change: (e) => {
      b.active = e.target.checked;
      if (!b.active && selectedId === b.id) selectedId = activeBuddies()[0]?.id ?? null;
      if (!selectedId && activeBuddies().length) selectedId = activeBuddies()[0].id;
      saveBuddies(); renderBar(); renderSettings();
    } },
  });
  const nameInput = el("input", {
    type: "text", value: b.name, maxLength: 24, "aria-label": t("buddy.name"),
    on: { change: (e) => { b.name = e.target.value.trim().slice(0, 24) || b.name; saveBuddies(); renderBar(); renderSettings(); } },
  });
  const petSelect = el("select", {
    "aria-label": t("buddy.petAria"),
    on: { change: (e) => { b.petId = e.target.value; saveBuddies(); renderBar(); } },
  }, Object.entries(PETS).map(([id, p]) => el("option", { value: id, text: p.name, selected: b.petId === id })));
  const removeBtn = el("button", {
    type: "button", text: t("buddy.delete"), disabled: buddies.length <= 1,
    on: { click: () => {
      buddies = buddies.filter((x) => x.id !== b.id);
      runtime.delete(b.id);
      if (selectedId === b.id) selectedId = activeBuddies()[0]?.id ?? null;
      saveBuddies(); renderBar(); renderSettings();
    } },
  });

  const c = b.connection;
  const save = () => saveBuddies();
  const textField = (key, placeholder, extra = {}) => el("input", {
    type: "text", value: c[key], placeholder, ...extra,
    on: { change: (e) => { c[key] = e.target.value.trim(); save(); } },
  });
  const numField = (key, min, max, step = 1) => el("input", {
    type: "number", value: String(c[key]), min: String(min), max: String(max), step: String(step),
    on: { change: (e) => { c[key] = Number(e.target.value); buddyConnectionNormalize(b); save(); renderSettings(); } },
  });

  const providerSelect = el("select", {
    "aria-label": t("buddy.providerAria"),
    on: { change: (e) => { setProvider(b.id, e.target.value); renderSettings(); } },
  }, PROVIDERS.map((p) => el("option", { value: p, text: providerLabel(p), selected: c.provider === p })));

  const modelList = modelCache[b.id] ?? [];
  const datalistId = `models-${b.id}`;
  const modelInput = el("input", {
    type: "text", value: c.model, list: datalistId, "aria-label": t("buddy.modelAria"),
    on: { change: (e) => { c.model = e.target.value.trim(); save(); } },
  });
  const modelDatalist = el("datalist", { id: datalistId }, modelList.map((m) => el("option", { value: m })));
  const loadModelsBtn = el("button", {
    type: "button", text: t("buddy.loadModels"),
    on: { click: async () => {
      if (!invoke) { say(t("buddy.modelsNoRuntime"), 3000); return; }
      try {
        modelCache[b.id] = await invoke("list_models", { config: c });
        say(t("buddy.modelsFound", { name: b.name, count: modelCache[b.id].length }), 2500);
      } catch (err) {
        modelCache[b.id] = [];
        say(t("chat.error", { name: b.name, error: err }), 5000);
      }
      renderSettings();
    } },
  });

  const tempValue = el("span", { text: c.temperature.toFixed(2) });
  const tempSlider = el("input", {
    type: "range", min: "0", max: "1.5", step: "0.05", value: String(c.temperature), "aria-label": t("buddy.temperature"),
    on: { input: (e) => { c.temperature = Number(e.target.value); tempValue.textContent = c.temperature.toFixed(2); save(); } },
  });

  const connection = el("div", { className: "conn-grid" }, [
    el("div", { className: "conn-row" }, [el("span", { className: "row-label", text: t("buddy.provider") }), providerSelect]),
    el("div", { className: "conn-row" }, [el("span", { className: "row-label", text: t("buddy.address") }), textField("baseUrl", "http://localhost:11434")]),
    el("div", { className: "conn-row" }, [el("span", { className: "row-label", text: t("buddy.model") }), modelInput, modelDatalist, loadModelsBtn]),
    el("div", { className: "conn-row" }, [el("span", { className: "row-label", text: t("buddy.keyEnv") }),
      textField("apiKeyEnv", t("buddy.keyPlaceholder"))]),
    el("div", { className: "conn-row" }, [el("span", { className: "row-label", text: t("buddy.temperature") }), tempSlider, tempValue]),
    el("div", { className: "conn-row" }, [el("span", { className: "row-label", text: t("buddy.maxTokens") }), numField("maxTokens", 16, 4096, 16)]),
    el("div", { className: "conn-row" }, [el("span", { className: "row-label", text: t("buddy.timeout") }), numField("timeoutSecs", 5, 600, 5)]),
    el("div", { className: "conn-row conn-full" }, [
      el("span", { className: "row-label", text: t("buddy.extraPrompt") }),
      el("textarea", {
        rows: 2, maxLength: 1000, placeholder: t("buddy.extraPromptPlaceholder"),
        value: c.systemPrompt, "aria-label": t("buddy.extraPrompt"),
        on: { change: (e) => { c.systemPrompt = e.target.value; save(); } },
      }),
    ]),
  ]);

  const sizeValue = el("span", { text: `${Math.round(b.scale * 100)} %` });
  const sizeSlider = el("input", {
    type: "range", min: String(BUDDY_SCALE_MIN), max: String(BUDDY_SCALE_MAX), step: "0.05",
    value: String(b.scale), "aria-label": `${t("buddy.size")} ${b.name}`,
    on: { input: (e) => {
      b.scale = clampScale(e.target.value);
      sizeValue.textContent = `${Math.round(b.scale * 100)} %`;
      sizeCanvas(b, ensureRuntime(b));
      saveBuddies();
    } },
  });
  const resetBtn = el("button", {
    type: "button", text: t("island.reset"), title: t("buddy.sizeReset"),
    on: { click: () => { b.scale = BUDDY_SCALE_DEFAULT; saveBuddies(); renderBar(); renderSettings(); } },
  });

  return el("div", { className: "buddy-card" }, [
    el("div", { className: "settings-row" }, [activeBox, nameInput, petSelect, removeBtn]),
    el("div", { className: "settings-row-inline" }, [
      el("span", { className: "row-label", text: t("buddy.size") }), sizeSlider, sizeValue, resetBtn,
    ]),
    el("details", { className: "conn-details" }, [el("summary", { text: t("buddy.connection") }), connection]),
  ]);
}

/** Po cislenych zmenach dopocita hodnoty do rozsahu (napr. prazdne cislo). */
function buddyConnectionNormalize(b) {
  b.connection = sanitizeConnection(b.connection, b.connection.provider);
}

function renderSettings() {
  const languageSelect = el("select", {
    on: { change: (e) => setLanguage(e.target.value) },
  }, LANGS.map((code) => el("option", { value: code, text: LANG_NAMES[code], selected: code === lang })));

  const skinSelect = el("select", {
    on: { change: (e) => setSkin(e.target.value) },
  }, SKINS.map((s) => el("option", { value: s, text: t(`skin.${s}`), selected: s === currentSkin() })));

  const autoHideBox = el("input", {
    type: "checkbox", checked: autoHide(), "aria-label": t("island.autohide"),
    on: { change: (e) => {
      storageSet(AUTO_HIDE_KEY, e.target.checked ? "1" : "0");
      if (!e.target.checked) setCollapsed(false);
    } },
  });

  const scaleValue = uiScale();
  const scaleLabel = el("span", { text: `${Math.round(scaleValue * 100)} %` });
  const scaleSlider = el("input", {
    type: "range", min: "0.8", max: "1.4", step: "0.05", value: String(scaleValue),
    "aria-label": t("island.size"),
    on: { input: (e) => {
      const v = Number(e.target.value);
      scaleLabel.textContent = `${Math.round(v * 100)} %`;
      applyUiScale(v);
    } },
  });
  const uiResetBtn = el("button", {
    type: "button", text: t("island.reset"), title: t("island.resetTitle"),
    on: { click: () => { applyUiScale(UI_SCALE_DEFAULT); renderSettings(); } },
  });

  const demoBtn = el("button", {
    type: "button",
    text: demoTimer ? t("demo.stop") : t("demo.start"),
    on: { click: toggleDemo },
  });

  const addBtn = el("button", {
    type: "button", text: t("buddy.add"),
    on: { click: () => {
      const b = makeBuddy();
      buddies.push(b);
      if (!selectedId) selectedId = b.id;
      saveBuddies(); renderBar(); renderSettings();
    } },
  });

  const quitBtn = el("button", {
    type: "button", text: t("settings.quit"), className: "danger", title: t("settings.quitTitle"),
    on: { click: quitApp },
  });
  const topBar = el("div", { className: "settings-topbar" }, [
    el("span", { className: "settings-title", text: t("settings.title") }),
    quitBtn,
  ]);

  const autostartBox = el("input", {
    type: "checkbox", checked: autostartOn, "aria-label": t("startup.autostart"),
    on: { change: async (e) => {
      if (!invoke) { e.target.checked = false; say(t("startup.noRuntime"), 3000); return; }
      try {
        autostartOn = await invoke("set_autostart", { enabled: e.target.checked });
        say(autostartOn ? t("startup.autostartOn") : t("startup.autostartOff"), 2500);
      } catch (err) {
        e.target.checked = autostartOn;
        say(String(err), 4000);
      }
    } },
  });

  const shortcutBox = (kind, label) => el("input", {
    type: "checkbox", checked: shortcutOn[kind], "aria-label": label,
    on: { change: async (e) => {
      if (!invoke) { e.target.checked = false; say(t("startup.shortcutNoRuntime"), 3000); return; }
      try {
        shortcutOn[kind] = await invoke("set_shortcut", { kind, enabled: e.target.checked });
      } catch (err) {
        e.target.checked = shortcutOn[kind];
        say(String(err), 4000);
      }
    } },
  });

  settingsEl.replaceChildren(
    topBar,
    section(t("settings.language"), languageSelect),
    section(t("section.startup"),
      el("label", { className: "check" }, [autostartBox, el("span", { text: t("startup.autostart") })]),
      el("label", { className: "check" }, [shortcutBox("desktop", t("startup.desktop")), el("span", { text: t("startup.desktop") })]),
      el("label", { className: "check" }, [shortcutBox("startmenu", t("startup.startmenu")), el("span", { text: t("startup.startmenu") })]),
    ),
    section(t("section.update"),
      el("button", {
        type: "button", text: t("update.check"),
        on: { click: async () => {
          if (!invoke) { say(t("update.noRuntime"), 3000); return; }
          say(t("update.searching"), 20000);
          try {
            say(await invoke("check_update"), 6000);
          } catch (err) {
            say(t("update.failed", { error: err }), 8000);
          }
        } },
      }),
    ),
    section(t("section.skin"), skinSelect),
    section(t("section.island"),
      el("label", { className: "check" }, [autoHideBox, el("span", { text: t("island.autohide") })]),
      el("div", { className: "settings-row-inline" }, [scaleSlider, scaleLabel, uiResetBtn]),
    ),
    section(t("section.demo"), demoBtn),
    section(t("section.buddies"), ...buddies.map(buddyCard), addBtn),
  );
}

/** Prepne jazyk: nacte slovnik, preklada staticke texty i nastaveni a bublinu. */
async function setLanguage(code) {
  await loadLang(code);
  applyStaticTexts();
  renderBar();
  const selected = findBuddy(selectedId);
  if (selected) input.placeholder = t("placeholder.forBuddy", { name: selected.name });
  renderSettings();
}

// --- Okno: velikost a skryvani -----------------------------------------------
// Okno se meni pres capability core:window:allow-set-size.
const WINDOW_W = 460;
const EXPANDED_H = 200;
const SETTINGS_H = 480;
const COLLAPSED_H = 24;
const COLLAPSE_DELAY_MS = 1500;

const island = document.getElementById("island");
const appWindow = window.__TAURI__?.window?.getCurrentWindow?.() ?? null;
const LogicalSizeCtor = window.__TAURI__?.window?.LogicalSize ?? null;
let collapsed = false;
let collapseTimer = null;

function applySize() {
  if (!appWindow || !LogicalSizeCtor) return;
  const s = uiScale();
  const h = settingsOpen ? SETTINGS_H : (collapsed ? COLLAPSED_H : EXPANDED_H);
  appWindow.setSize(new LogicalSizeCtor(Math.round(WINDOW_W * s), Math.round(h * s))).catch(() => {});
}

function setCollapsed(next) {
  if (collapsed === next) return;
  collapsed = next;
  island.classList.toggle("collapsed", next);
  applySize();
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

const grip = document.getElementById("grip");

// Rozbaleni jen z male zony (uchytu), ne z celeho sbaleneho okna.
grip.addEventListener("mouseenter", () => {
  clearTimeout(collapseTimer);
  setCollapsed(false);
});
grip.addEventListener("click", () => setCollapsed(false));

// Kdyz je ostrov rozbaleny, kurzor uvnitr ho drzi otevreny.
island.addEventListener("mouseenter", () => {
  clearTimeout(collapseTimer);
});

island.addEventListener("mouseleave", () => {
  clearTimeout(collapseTimer);
  if (!autoHide()) return;
  collapseTimer = setTimeout(() => {
    // Nesbalovat, dokud uzivatel pise nebo ma otevrene nastaveni.
    if (document.activeElement === input || settingsOpen || !autoHide()) return;
    setCollapsed(true);
  }, COLLAPSE_DELAY_MS);
});

input.addEventListener("blur", () => {
  if (autoHide() && !island.matches(":hover") && !settingsOpen) setCollapsed(true);
});

// --- Zkratky -----------------------------------------------------------------
window.addEventListener("keydown", (e) => {
  if (!(e.ctrlKey && e.shiftKey)) return;
  const key = e.key.toLowerCase();
  if (key === "s") { e.preventDefault(); cycleSkin(); }
  if (key === "p" && selectedId) {
    e.preventDefault();
    const buddy = findBuddy(selectedId);
    const i = PROVIDERS.indexOf(buddy.connection.provider);
    setProvider(selectedId, PROVIDERS[(i + 1) % PROVIDERS.length]);
  }
});

// --- Start -------------------------------------------------------------------
function startApp() {
  applyStaticTexts();
  document.documentElement.style.setProperty("--ui-scale", String(uiScale()));
  applySystemTheme();
  refreshAutostart();
  renderBar();
  applySize();
  requestAnimationFrame(tick);
}

loadLang(lang).then(() => {
  startApp();
  // Volitelne parametry pro nahledy (screenshoty): ?skin=windows&settings=1&lang=en
  const q = new URLSearchParams(window.location.search);
  if (q.get("skin") && SKINS.includes(q.get("skin"))) setSkin(q.get("skin"));
  if (q.get("lang") && LANGS.includes(q.get("lang"))) setLanguage(q.get("lang"));
  if (q.get("settings") === "1") toggleSettings();
});

// Expose pro pozdejsi napojeni (Tauri invoke / event listener).
window.buddy = {
  setPetState, say, setSkin, cycleSkin, currentSkin, selectBuddy, setLanguage,
  SKINS, PETS, PROVIDERS, get buddies() { return buddies; },
};
