<div align="center">

<img src="./favicon.svg" width="96" height="96" alt="Mafia Game-Master" />

# Mafia — Game Master

**An elegant, offline-first helper for hosting the party game *Mafia*.**
Hand the phone around the table during role deal, then run the night / day / vote loop with zero setup, zero accounts, zero ads.

[![Version](https://img.shields.io/github/package-json/v/shatytskyi/mafia?color=8b1a1a&label=version&style=flat-square)](./package.json)
[![Play](https://img.shields.io/badge/play-live-8a6a1f?style=flat-square)](https://shatytskyi.github.io/mafia/)
[![PWA](https://img.shields.io/badge/PWA-installable-5a9b8e?style=flat-square)](#install-as-a-pwa)

[**▸ Open the app**](https://shatytskyi.github.io/mafia/)

</div>

---

## What it does

A human moderator runs the game — the app keeps the rules honest and the pace tight. It distributes roles, walks the host through every step of every night, resolves attacks against checks and saves, tracks votes during the day, and announces the winner when the conditions line up.

Everything lives in the browser. No server, no database, no sign-in. Close the tab mid-game and the state is restored the next time you open it.

## Features

- **Role dealing via pass-the-phone** — each player sees only their own role, with a handoff screen so the last player can pass the device back to the moderator without revealing the table.
- **Seven roles plus civilians** — Mafia, Don, Sheriff, Doctor, Maniac, Whore, Veteran, with automatic distribution tuned to player count (4–20). The in-app rules page covers every role, every win condition, and every edge case.
- **Guided night resolution** — the app walks the host through each role's action in order, resolves Doctor saves, handles the Whore's blocking of night abilities, tracks the Veteran's one-shot save and strike, and produces a human-readable summary.
- **Day & vote phases** — built-in timer and vote tracker.
- **Three languages** — Russian, Ukrainian, English; auto-detected, switchable from the header.
- **Light & dark themes** — a cream-paper noir palette and its nocturnal counterpart.
- **Installable as a native-feeling app** (PWA) — works offline, launches without a browser chrome.
- **Auto-saved games** — resume in-progress sessions after a refresh or a day later.

## Install as a PWA

Because the game lives on the host's phone for hours at a time, installing it feels right.

- **Android / Chrome / Edge** — a banner slides in from the top on first visit. Tap **Install**.
- **iOS Safari** — tap the Share icon, then **Add to Home Screen**.
- **Desktop Chrome / Edge** — click the install icon in the address bar.

Once installed, the app launches in its own window, starts offline, and keeps all saves locally.

## Local development

No toolchain — it's vanilla JavaScript with ES modules.

```bash
# Serve over HTTP (native modules won't load from file://)
python3 -m http.server 8000
# then open http://localhost:8000/

# Run the unit-test suite
npm test
```

Deployment is a single `git push` — GitHub Pages builds from the `main` branch root.

## Project layout

```
src/
  main.js                Bootstrap: theme, persistence, PWA, screen registration.
  core/                  Pure, DOM-free game logic (unit-tested).
    roles.js             Role table + helpers.
    shuffle.js           Fisher–Yates with injectable RNG.
    distribution.js      Role counts for a given player count.
    night.js             Resolve night actions into deaths, saves, and info.
    win.js               Win-condition evaluator.
    steps.js             Night/day/vote step descriptors.
  state/
    state.js             Single source of mutable state.
    persistence.js       Auto-save / resume via localStorage.
  ui/
    render.js            Screen dispatcher.
    theme.js, locale.js, fullscreen.js, pwa.js, version.js
    html.js              Safe HTML templating (escapes untrusted strings).
    screens/             One file per screen.
  i18n/                  ru / uk / en dictionaries.
sw.js                    Service worker (offline shell + cache).
manifest.webmanifest     PWA manifest.
docs/
  game-rules.md          Exhaustive behavioural contract.
tests/                   node:test unit tests.
```

## Tech

Vanilla JavaScript, ES modules, no bundler, no runtime dependencies. Fonts are loaded from Google Fonts at runtime (Oswald, Cormorant Garamond, JetBrains Mono). Tests run on the Node built-in `node:test` runner.

## Further reading

- [`docs/game-rules.md`](./docs/game-rules.md) — the full behavioural spec, including every edge case in role interactions.
- [`CLAUDE.md`](./CLAUDE.md) — architectural conventions for contributors.

---

<div align="center">
<sub>Made for late nights around the table.</sub>
</div>
