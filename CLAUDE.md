# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Мафия — Игровой Мастер" — a static web helper for a human game master running the party game Mafia (in Russian). UI strings and comments are mixed English/Russian — existing Russian content stays; new comments are English per global policy.

## Stack & Commands

- **Vanilla JavaScript ES modules, no bundler.** Tests via `node --test`.
- **Run locally:** `python3 -m http.server 8000` (native modules need HTTP, not `file://`).
- **Run tests:** `npm test`.
- **Deploy:** static hosting — upload the repo root.
- **Dependencies:** none. Fonts are fetched from Google Fonts at runtime.

## Architecture

Single source of state in `src/state/state.js`; every screen reads and mutates it, then calls `render()` (dispatcher in `src/ui/render.js`).

```
src/
  main.js                  Bootstrap: theme, persistence wiring, screen registration.
  core/                    Pure game logic. DOM-free. Unit-tested.
    roles.js               ROLES table + role helpers.
    shuffle.js             Fisher-Yates with injectable RNG.
    distribution.js        calcRoleDistribution, canEnableRole, isRoleEffective, dealRoles.
    night.js               resolveNight (pure), applyNightResolution (idempotent).
    win.js                 checkWinCondition.
    steps.js               Step descriptors for night/day/vote phases.
  state/
    state.js               The global `state` object + resetNightSelections.
    persistence.js         localStorage wrapper + snapshot (de)serialisation.
  ui/
    render.js              Screen dispatcher.
    theme.js               Light/dark + header toggle binding.
    html.js                escapeHtml + `html` tagged template.
    screens/
      home.js, names.js, deal.js, host.js, actions.js, timer.js, gameover.js, rules.js
  types.js                 JSDoc typedefs.
tests/                     node:test-based unit tests for core modules.
docs/
  game-rules.md            Exhaustive behavioural contract.
  superpowers/             Design spec and implementation plan for the 2026-04-19 refactor.
```

Rules:
- **`src/core/` is DOM-free.** Never import `document` / `window` / DOM modules into `core/`. This is what makes tests possible.
- **State mutations always go through `render()`.** No direct DOM patching except the `#themeToggle` element (outside `#app`) and the timer's `updateTimerDisplay` (a perf optimisation).
- **User-controlled strings are always escaped** via `escapeHtml` / `html` before reaching `innerHTML`. Player names are the main input surface.
- **Save format is `mafia.game.v1`**. Do not bump the version without a migration.

## Conventions

- Write new comments in English; leave existing Russian comments as-is.
- User-facing copy stays Russian — this is a Russian-language product.
- One module = one responsibility. Screens return HTML strings and bind handlers after insertion (no `setTimeout(…, 0)` hacks).
- Touch-friendly mobile layout (max-width 520px, `user-select: none`).

## Further reading

- `docs/game-rules.md` for edge cases and role interactions.
- `docs/superpowers/specs/2026-04-19-architecture-refactor-design.md` for the refactor rationale.
