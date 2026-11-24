# Hlášení od agentů (inbox)

Agent nebo skript zapíše soubor `*.json` do složky:

```
%APPDATA%\BuddyBay\inbox
```

BuddyBay složku každé 2 s zkontroluje. Platný soubor se zobrazí jako bublina u buddyho,
uloží se do jeho historie a soubor se smaže. Neplatný soubor se přesune do podsložky `failed`.

## Formát

```json
{
  "id": "ukol-2026-11-24-migrace",
  "buddy": "Servo",
  "text": "Úkol dokončen: migrace databáze je hotová.",
  "mood": "happy",
  "ts": 1795600000000
}
```

| Pole | Povinné | Význam |
|---|---|---|
| `text` | ano | Text hlášení, nejvýš 2000 znaků. Zobrazuje se jako prostý text. |
| `buddy` | ne | Jméno buddyho (bez rozlišení velikosti písmen). Když chybí nebo neexistuje, použije se první aktivní buddy. |
| `id` | ne | Identifikátor pro deduplikaci, nejvýš 80 znaků. Když chybí, použije se název souboru. |
| `mood` | ne | Pozice buddyho: `happy`, `waving`, `jumping`, `thinking`, `failed` a další stavy daného petu. Výchozí je `waving`. |
| `ts` | ne | Čas v milisekundách od epochy (`Date.now()`). Když chybí, použije se čas změny souboru. |

## Pravidla

- Soubor je větší než 64 KB → `failed`.
- Soubor je mladší než 1 s → přeskočí se, dokud se nedopíše.
- Nejvýš 50 souborů za jedno čtení.
- Stejné `id` se zobrazí jen jednou.
- Zapisuj do dočasného souboru a teprve pak ho přejmenuj na `*.json`, aby se nečetl rozepsaný.
