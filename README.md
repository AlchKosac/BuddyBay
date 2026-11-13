<p align="center">
  <img src="assets/logo.png" alt="BuddyBay logo" width="160" />
</p>

<h1 align="center">BuddyBay</h1>

<p align="center">
  A floating, always-on-top island for Windows that shows what your AI agents are doing.
</p>

## What it is

BuddyBay sits at the top of your screen like a small car-radio bar. Animated buddies (pets) react to the state of your agents, and you can talk to them from the bar. Each buddy has its own model connection: local Ollama, Anthropic (Claude) or any OpenAI-compatible server such as LM Studio or llama.cpp.

- Multiple buddies, each with its own pet, size and model
- Skins: Brass Radio, Glass Dock, Terminal Pet and Windows (follows your system accent and light/dark mode)
- Auto-hide with a small grip, adjustable island size
- Start with Windows, Start menu and desktop shortcuts
- Auto-update from GitHub releases (signed installer)

## Screenshots

Four skins (Brass Radio, Glass Dock, Terminal Pet, Windows):

| Brass Radio | Glass Dock |
|---|---|
| ![Brass Radio](assets/screenshots/bar-brass-radio.png) | ![Glass Dock](assets/screenshots/bar-glass-dock.png) |
| **Terminal Pet** | **Windows** |
| ![Terminal Pet](assets/screenshots/bar-terminal-pet.png) | ![Windows](assets/screenshots/bar-windows.png) |

Settings panel (English, Glass Dock):

![Settings](assets/screenshots/settings-en.png)

Czech UI is available in Settings > Language.

## Download

- **Installer (recommended):** [BuddyBay_0.1.1_x64-setup.exe](https://github.com/AlchKosac/BuddyBay/releases/download/v0.1.1/BuddyBay_0.1.1_x64-setup.exe)
- **ZIP (portable package with the installer and a short README):** [BuddyBay-0.1.1-windows.zip](https://github.com/AlchKosac/BuddyBay/releases/download/v0.1.1/BuddyBay-0.1.1-windows.zip)
- All releases: https://github.com/AlchKosac/BuddyBay/releases

Windows may show an "unknown publisher" warning, because the installer is not code-signed yet.

## Build from source

Requires Rust and WebView2 (included in Windows 11).

```bash
cargo run --manifest-path src-tauri/Cargo.toml
```

---

# BuddyBay

Plovoucí ostrůvek pro Windows a SteamOS: lišta nahoře uprostřed monitoru, vždy nad okny, schovávací, s mazlíčkem, který zobrazuje stav AI agentů.

## Stav

Rané kostra (v0.1):

- Tauri 2 okno bez rámečku, průhledné, always-on-top, bez ikony v hlavním panelu.
- Umístění nahoru doprostřed monitoru.
- Přehrávání spritesheetu peta (formát Codex/ChatGPT pets: 8×11 buněk po 192×208 px, řádky = stavy).
- Textové pole a bublina s odpovědí (zatím jen lokální demo).
- `cargo check` na backendu prochází.

## Plán

1. **Ostrov a chování okna** — schovávání na okraj, animace výjezdu, přepínání pozice/monitoru, zapamatování polohy.
2. **Mazlíci a animace** — více postav, přepínání, náhodné "blbůstky" (skok, mávání, rozhlížení), vlastní animace a mapování stavů.
3. **Agenti** — registr agentů, každý s vlastním stavem (idle / working / waiting / review / failed); vstup z textového pole jde na zvoleného agenta.
4. **Napojení** — MCP klienti, HTTP API, lokální modely přes Ollamu (dostupné: `qwen2.5vl:7b`, `llama3.1:8b`).
5. **Běh na pozadí** — autostart při přihlášení Windows, tray ikona, běh po zavření panelu.
6. **Skiny a jazyky** — témata jako JSON/CSS balíčky, lokalizace (cs, en, …).
7. **Balíčky pro SteamOS** — AppImage / Flatpak, ověřit always-on-top pod Gamescope/KDE.
8. **Synchronizace nastavení** — jeden přenositelný profil (mazlíčci, skiny, jazyk, agenti bez tajemství) na všech zařízeních.
9. **Hlasové ovládání** — vstup řečí (lokální Whisper, čeština) a hlasová odpověď (Piper nebo hlas Windows). Hlas je jen vstup a výstup, model se volí zvlášť.
10. **Cloud modely** — volba poskytovatele (lokální Ollama / cloud API, např. Claude) pro každého agenta. Klíče jen v systémovém úložišti, ne v profilu ani v repozitáři.
11. **Android** — companion aplikace (Tauri 2 mobile): mazlíček, chat s agenty, stav, sync. Plovoucí ostrov jako na PC na Androidu omezený (overlay vyžaduje oprávnění SYSTEM_ALERT_WINDOW), proto je to samostatné rozhraní nad stejným profilem.

## Přenositelnost a synchronizace

- Nastavení je jeden **verzovaný JSON profil** (schéma s `schemaVersion`), nezávislý na platformě.
- Synchronizace přes **adaptér** (rozhraní `load` / `save` / `changedSince`). Možnosti:
  - složka v cloudu (OneDrive / Google Drive / Syncthing) — nejjednodušší, bez vlastního serveru (první krok),
  - vlastní malý server s přihlášením (až bude potřeba víc uživatelů nebo konflikty),
  - GitHub Gist / repozitář jako záloha.
- **Tajemství (API klíče, tokeny MCP) se nesynchronizují** v profilu. Ukládají se do systémového úložiště každého zařízení (Windows Credential Manager, Android Keystore) a na jiném zařízení se zadají znovu.
- Konflikty: sloučení po polích s časovým razítkem poslední změny (last-writer-wins na úrovni pole).

## Návrhy vzhledu

| Skin | Popis | Tón |
|------|-------|-----|
| **Brass Radio** | Tmavý panel ve stylu starého autorádia, mosazné knoflíky, LED displej pro stav agenta | retro, teplý |
| **Glass Dock** | Průhledné sklo s blurem, jemný okraj, minimalistické ikony | moderní, čistý |
| **Terminal Pet** | Černý panel, zelený monospace text, pixelový mazlíček | technický, hravý |

Všechny skiny budou mít stejnou strukturu (barevné tokeny, tvar, animace bubliny), takže přepínání bude jen výměna balíčku.

## Spuštění (vývoj)

Vyžaduje Rust (`cargo`) a WebView2 (na Windows 11 je součástí systému).

```bash
cargo run --manifest-path src-tauri/Cargo.toml
```

## Struktura

```
src/                 frontend (HTML/CSS/JS, bez build kroku)
  assets/pets/       spritesheety a záznamy mazlíčků
src-tauri/           Rust backend (Tauri 2)
```
