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
