# Mafia — Manual Test Plan (Chrome DevTools MCP)

Test plan for an agent driving the Mafia game-master app via Chrome DevTools MCP.
Written after the 2026-04-19 architecture refactor. Covers game logic, UI, persistence, security.

Updated 2026-04-19 for the step-flow compaction: sleeping steps are gone,
resolve+wake-up is merged into a single "Рассвет" step, day has 3 steps, vote
has 1 ("Голосование и казнь"). See `src/core/steps.js` for the current shape.

## Setup

1. Start a local server from the repo root:
   ```bash
   cd /Users/serhiihatytskyi/WebProjects/Mafia
   python3 -m http.server 8000
   ```
2. Tests run against `http://localhost:8000/`.
3. Before each test suite, reset state:
   ```js
   localStorage.removeItem('mafia.game.v1');
   localStorage.removeItem('mafia.theme');
   location.reload();
   ```

## Useful selectors (IDs & data-attributes)

| Where | Selector |
|---|---|
| Home counter | `#minusBtn`, `#plusBtn` |
| Home CTAs | `#startBtn`, `#rulesBtn` |
| Role toggles | `#toggle-don`, `#toggle-doctor`, `#toggle-maniac`, `#toggle-whore` |
| Sub-options | `[data-opt-sheriff="never\|afterMafia\|always"]`, `[data-opt-whore="alive\|dies"]` |
| Resume panel | `#resumeBtn`, `#discardSavedBtn` |
| Names screen | `input[data-idx="N"]`, `#confirmNames`, `#backHome` |
| Deal screen | `#revealBtn`, `#doneBtn` |
| Host nav | `#prevStep`, `#nextStep`, `#endGame` |
| Target chips | `[data-target-idx="N"]`, `[data-skip]` (both carry `data-field`) |
| Vote chips | `[data-killed-idx="N"]`, `[data-killed-skip]` |
| Blocked confirm | `[data-blocked-confirm]` |
| Timer | `#timerMinus`, `#timerPlus`, `#timerToggle`, `#timerReset` |
| Theme | `#themeToggle`, `#themeIcon` |
| Mount | `#app` |
| Game-over | `#newGame` |

## Assertion helpers

Inspect state from the page:
```js
// Current screen, day, phase, step
JSON.stringify({
  screen: window.state?.screen,  // NOT exposed; use DOM instead
});

// Distribution via DOM
document.querySelectorAll('.role-dist .cell').length;

// Player names visible on host screen roster
[...document.querySelectorAll('.roster-name')].map(el => el.textContent);

// Alive count from header
document.querySelector('.label').textContent; // "Игроки · живых 6/8"
```

Note: `state` is NOT a global. Query the DOM or `localStorage.getItem('mafia.game.v1')` instead.

---

## §A — Smoke tests (must pass)

### A1. Home loads without console errors
1. Navigate to `http://localhost:8000/`.
2. `list_console_messages` → no errors.
3. Screenshot.
4. Assert: hero title "Мафия in famiglia" visible; counter shows `8`; role-dist panel populated; "Раздать роли →" button enabled.

### A2. Navigate to rules and back
1. Click `#rulesBtn`.
2. Assert: "Правила игры" heading visible; `#backFromRules` present.
3. Click `#backFromRules`.
4. Assert: back on home.

### A3. Full minimal game: 4 players, 1 mafia, city wins
1. Home: decrement to 4 players (`#minusBtn` × 4). Assert counter = `4`. Assert don/maniac/whore toggles are disabled (greyed, warning "Нужно минимум 6/8 игроков").
2. Click `#startBtn`. Names screen appears.
3. Leave inputs empty, click `#confirmNames`. Deal screen appears.
4. For each of 4 players: click `#revealBtn`, then `#doneBtn`. Last button label is "Начать игру →".
5. On host screen (night 1):
   - Step through via `#nextStep` until "Рассвет" (no pickTarget steps expected for civilians-only + mafia — only mafia meet, sheriff step).
   - Sheriff check: pick the player whose chip shows as mafia (or use `[data-skip]` if unclear).
6. Advance through day 1 (3 steps: объявление / обсуждение / выдвижение-и-оправдания), then vote (1 step: голосование-и-казнь). Click the chip of the mafia member, then `#nextStep`.
7. Assert: game-over screen shows "Город победил".
8. Click `#newGame` → back on home.

---

## §B — Role distribution (home screen)

### B1. n=8, all optionals on
1. Home: set count to 8. Enable all 4 optional toggles.
2. Assert role-dist cells show: Мафия ×1, Дон ×1, Шериф ×1, Доктор ×1, Маньяк ×1, Путана ×1, Мирные ×2 (7 unique role cells).

### B2. n=7, all optionals on — balancer drops maniac & whore
1. Decrement to 7.
2. Assert: Маньяк and Путана cells absent from role-dist; warning "⚠ Не поместится при текущем раскладе" appears on their toggle cards (toggles still visually ON but their sub-options reveal they're squeezed).

### B3. n=5, Don toggle silently ineffective
1. Set to 5, enable Don.
2. Assert: Don cell NOT in role-dist (totalMafiaSide=1, Don requires ≥2). Toggle shows warning "Нужно минимум 6 игроков" (disabled).

### B4. Sub-options survive re-render
1. Enable Maniac. In sub-options click `[data-opt-sheriff="always"]`.
2. Click counter −/+ to trigger re-render.
3. Assert: "Всегда" button still has `.active` class.
4. Enable Whore. Click `[data-opt-whore="dies"]`.
5. Re-render (counter).
6. Assert: "Погибает" has `.active`.

### B5. Auto-disable when count drops
1. n=8, enable Maniac and Whore.
2. Decrement to 7.
3. Assert: their `optionalRoles` entries are cleared — the role-dist reflects Maniac ×0 and Путана ×0 (no cells).

---

## §C — Deal screen

### C1. Await → shown reveal
1. Start 6-player game, confirm names.
2. On `await`: assert big player name is visible, `#revealBtn` present, no role emblem.
3. Click `#revealBtn`.
4. Assert: role card with emblem, name, side, description visible.
5. Click `#doneBtn` → next player, phase reset to `await`.

### C2. Mafia team reveal shows teammates
1. 8-player game, Don enabled → 2 mafia-side roles.
2. Deal each player. On any mafia/don player after reveal:
3. Assert: `.team-list` visible. `.team-names` contains the OTHER mafia-side player's name (not self).

### C3. Last-player transition
1. On last (Nth) player's deal screen after reveal, assert `#doneBtn` text is "Начать игру →".
2. Click it → host screen (day 1, night, step 1).

---

## §D — Night resolution (core logic)

For each test, use 8 players with specific role layout. Drive via `#nextStep` and target chips.

### D1. Mafia kill on night 2
1. Start 6 players (1 mafia, 1 sheriff, 4 civilians), no optionals.
2. Night 1: mafia meet → skip. Sheriff check any.
3. Day 1: 4 day steps, then vote, skip.
4. Night 2: mafia step now has `pickTarget`. Click any civilian chip.
5. Continue to "Итог ночи".
6. Assert: resolve card shows "✖ Погибли: <name>".
7. Next → day 2. Assert roster row for that player has `.dead` class.

### D2. Doctor saves mafia target
1. 8-player game with doctor. Night 2.
2. Mafia target player P (memorise index). Doctor target same P. Sheriff skip.
3. On "Рассвет" → resolve card shows "☾ Ночь прошла спокойно" + "✚ Доктор спас: <P>".
4. Assert roster P not `.dead`.

### D3. Whore soft-block sole mafioso
1. 8-player, Don disabled, Whore on, `whoreDiesAtMafia=false`.
2. Before night 2, mafia count is 1 (one mafioso).
3. Night 2: Whore visits the mafioso. Mafia picks a civilian.
4. Resolve: "❀ Путана у мафии…" + "❀ Путана заблокировала: Мафия". Killed list empty.

### D4. Whore soft rule with 2 mafia alive — kill still happens
1. 8-player, Don on, Whore on, soft rule. Total mafia side = 2.
2. Night 2: Whore visits one mafioso; mafia still kills a civilian.
3. Resolve: civilian killed, "❀ Путана у мафии…" shown but no mafia block.

### D5. Whore hard rule — dies with mafia blocked
1. 8-player, Whore on, `whoreDiesAtMafia=true` (click "Погибает").
2. Night 2: Whore visits mafioso. Mafia picks civilian.
3. Resolve: "✖ Погибли: <whore name>". "❀ Путана заблокировала: Мафия". Civilian lives.

### D6. Whore hard + doctor on whore → saved
1. Same as D5 but doctor targets whore.
2. Resolve: no deaths, "❀ Путана попала к мафии — но Доктор спас её".

### D7. Maniac kills on night 1
1. 8-player, Maniac on. Night 1.
2. Maniac target civilian. Advance to "Рассвет".
3. Assert: civilian dead. Mafia first-night skip (no kill from mafia).
4. Day 1 first step must be titled "Объявление жертв" (NOT "Утро первого дня") and contain the civilian's name in the summary. A 30s last-word timer must be present.

### D8. Mafia + Maniac on same target + doctor → one save
1. Night 2: mafia picks P, maniac picks P, doctor picks P.
2. Resolve: no deaths. "✚ Доктор спас: P".

### D9. Mafia + Maniac on different targets → both die
1. Night 2: mafia picks P1, maniac picks P2, no doctor.
2. Resolve: both in "Погибли".

### D10. Sheriff sees maniac — `afterMafia` mode (default)
1. 8-player, Maniac on, Sheriff sub-opt default.
2. Night 2: sheriff checks maniac.
3. Assert: action result under chip shows "🟢 НЕ МАФИЯ".
4. Kill all mafia (vote + night). Check sheriff on maniac again.
5. Assert: "🔴 МАФИЯ".

### D11. Sheriff sees maniac — `always` mode
1. Set `[data-opt-sheriff="always"]` on home before starting.
2. Sheriff checks maniac on night 1 when mafia still alive.
3. Assert: "🔴 МАФИЯ".

### D12. Sheriff sees maniac — `never` mode
1. Set `[data-opt-sheriff="never"]`.
2. Kill all mafia. Sheriff checks maniac.
3. Assert: "🟢 НЕ МАФИЯ".

### D13. Don check sheriff
1. 8-player, Don on. Night 1.
2. Don picks the sheriff's index.
3. Assert action result below chip: "✓ Это Шериф".
4. Pick a civilian → "✗ Не Шериф".

### D14. Whore blocks Don check
1. Night 2: Whore visits Don. Don picks sheriff.
2. Don step renders as blockedAction — chip grid absent, "Подтвердить" button required.
3. Click `[data-blocked-confirm]`. Advance.
4. Resolve: no Don result line.

---

## §E — Win conditions

### E1. City win by voting out last mafioso
Already covered in §A3.

### E2. Mafia parity win
1. 4 players: 1 mafia, 3 civilians (no optionals). Night 1 → day 1 (no kills). Skip vote.
2. Night 2: mafia kills civilian → 1 mafia, 2 civ, 1 sheriff (for 4 players: mafia 1, sheriff 1, civ 2. After 1 kill: mafia 1, civ 1, sheriff 1 = parity).
3. Actually for parity, need 2 kills. Set up 6-player instead: 2 mafia, 1 sheriff, 3 civ. Two nights of kills → 2 mafia, 1 sheriff, 1 civ = parity.
4. Assert: game-over "Мафия победила".

### E3. Maniac win
1. 8-player: 1 mafia, 1 sheriff, 1 maniac, 5 civ. Walk until: mafia dead (voted out), maniac + 1 civilian alive.
2. Easiest path: maniac kills each night, vote kills mafia day 1.
3. Assert: "Маньяк победил" verdict.

### E4. Draw
1. Hard to trigger live; simulate by editing localStorage save with all `alive=false` then resuming.
2. Assert: "Ничья" verdict.

### E5. Mafia + Maniac + no civilians
1. Keep playing until civilians=0, mafia+maniac alive.
2. Assert: "Мафия победила" (rule 5 — mafia assumed to finish maniac).

---

## §F — Persistence

### F1. Save on host, resume from home
1. Start any game, reach host screen step 2+.
2. `list_network_requests` irrelevant — we check localStorage:
   ```js
   JSON.parse(localStorage.getItem('mafia.game.v1'));
   ```
   Assert: has `ts`, `players`, `phase='night'`, `day=1`.
3. Reload page (`navigate_page` same URL).
4. Home screen must show `.resume-card` with description like "Ночь · День 1 · Живых 8/8" and age "только что".
5. Click `#resumeBtn`.
6. Assert: lands back on host screen at same step.

### F2. Discard save
1. As F1 but click `#discardSavedBtn`. Accept the `confirm()` dialog (MCP `handle_dialog`).
2. Assert: resume card gone; `localStorage.getItem('mafia.game.v1') === null`.

### F3. Explicit clears wipe save
1. Start game, reach host. Save exists.
2. Click `#endGame`. Accept confirm.
3. Assert: back on home; save cleared.
4. Start another game, win/lose. Click «Новая партия» on gameover.
5. Assert: save cleared.

### F3b. Refresh mid-game keeps save and resume works
1. Start game, reach host step 2+.
2. Reload the page (simulating mid-game refresh).
3. Home shows resume card. Click `#resumeBtn`.
4. Assert: lands on host screen at the saved step — save MUST NOT have been wiped on first home render.

### F4. Stale save (>6h) is ignored
1. Start game, reach host.
2. Run:
   ```js
   const key='mafia.game.v1';
   const d=JSON.parse(localStorage.getItem(key));
   d.ts = Date.now() - 7*60*60*1000;
   localStorage.setItem(key, JSON.stringify(d));
   location.reload();
   ```
3. Assert: no resume card on home; key removed.

### F5. gameOptions merge for old saves
1. Save a snapshot without `gameOptions` field:
   ```js
   localStorage.setItem('mafia.game.v1', JSON.stringify({
     ts: Date.now(),
     playerCount: 6, optionalRoles: {don:true, doctor:true, maniac:false, whore:false},
     players: [/* fill with 6 players with roles */],
     day: 1, phase: 'night', stepIndex: 0,
     night: {mafiaTarget:null, donCheck:null, whoreTarget:null, doctorTarget:null, sheriffCheck:null, maniacTarget:null, resolved:null, applied:false},
     doctorHistory: [], doctorSelfUsed: false, whoreHistory: [],
     dayVoteKilled: null, winner: null
   }));
   location.reload();
   ```
2. Resume. Assert: no crash; sheriff check action uses `afterMafia` default.

### F6. Theme persists across reload
1. Home. Current theme = light (icon `☾`).
2. Click `#themeToggle`. Assert `<html data-theme="dark">`; icon now `☀`.
3. Reload. Assert: dark theme still applied pre-render (no flash of light).

---

## §G — Timer

### G1. Timer renders and ticks
1. Any 6-player game, day 1 step "Обсуждение".
2. Assert `.timer-display` shows `01:00`, `#timerToggle` label "▶ Старт".
3. Click `#timerToggle`. Wait ~2s.
4. Assert: display decrements, button is now "⏸ Пауза".

### G2. −10 / +10 buttons
1. Click `#timerPlus`. Assert display +10s.
2. Click `#timerMinus`. Assert display -10s.
3. Repeat `#timerMinus` past 0 → stays at `00:00`.

### G3. Reset button
1. Adjust timer. Click `#timerReset`.
2. Assert: display reset to preset (e.g. `01:00`), timer stopped.

### G4. Final gong at 0
1. Set timer to 3s via `−10s`×several. Start.
2. Wait 4s.
3. Assert: display `00:00`, `.timer-display.warning` class in last 5s, `caution` class in 6–10s range (hard to snapshot precisely; just verify end state).

### G5. Next step resets timer
1. On a timer step, adjust seconds.
2. Click `#nextStep`. If next step also has timer, assert it starts fresh at its preset.

---

## §H — Theme

### H1. Toggle round-trip
1. Click `#themeToggle`. Assert `data-theme="dark"` on `<html>`, icon `☀`.
2. Click again. Assert `data-theme="light"`, icon `☾`.

### H2. Theme applies to all screens
1. Enable dark. Navigate home → names → deal → host → gameover (via a short game). Screenshot each.
2. Assert: dark palette applied consistently; no light-mode flash.

---

## §I — Security (XSS) — REGRESSION TESTS FOR THE REFACTOR FIX

**Before the 2026-04-19 refactor, player names were interpolated raw into `innerHTML`. These tests MUST pass.**

### I1. Name with `<script>` tag
1. Start 4-player game. On names screen, fill input 0 with:
   ```
   <script>window.__xss=true</script>
   ```
2. Click `#confirmNames`.
3. Evaluate `window.__xss` → must be `undefined`.
4. On deal screen, assert the literal text `<script>window.__xss=true</script>` is visible (not executed, not empty).

### I2. Name with `<img onerror>`
1. Fill an input with `<img src=x onerror="window.__xss2=true">`.
2. Confirm, walk to host screen.
3. Assert `.roster-name` contains literal `<img …>` as text.
4. Assert `window.__xss2` undefined.
5. Check `list_console_messages`: no "Refused to execute…" because nothing tried to execute.

### I3. XSS via quotes breaking out of attribute
1. Fill input with: `" onerror="window.__xss3=true`
2. Confirm. On names screen re-entry (click `#backHome` then re-enter), the input's `value=` attribute had to escape `"` → field should show the literal string.
3. Assert `window.__xss3` undefined.

### I4. XSS in resolve summary
1. Name all players with tags. Reach "Рассвет".
2. In resolve card, assert killed/saved names rendered as text, no JS fires.

### I5. XSS in mafia teammate reveal
1. 8-player, Don on. Name the Don player with `<b>BOLD</b>`.
2. Deal. On the mafia player's screen (not Don), team-list should show `<b>BOLD</b>` as text, NOT bolded.

---

## §J — Validator gating (new behaviour after refactor)

**Before 2026-04-19 these actions only warned. After refactor `#nextStep` must be `disabled`.**

### J1. Doctor heals same target two nights
1. 8-player with Doctor. Night 1: doctor heals P.
2. Night 2: doctor attempts to heal same P.
3. Assert: `.action-warn` visible saying "Этого игрока Доктор лечил прошлой ночью". `#nextStep` has `disabled` attribute.
4. Click different player. `disabled` removed.

### J2. Doctor heals self twice
1. 8-player with Doctor. Night 1: doctor clicks his own chip → heal self (`.action-warn` shouldn't appear yet — first self-heal is allowed).
2. Night 2: doctor clicks own chip.
3. Assert: warning "Себя можно лечить только один раз за игру". `#nextStep` disabled.

### J3. Whore visits self
1. 8-player with Whore. Night 1: whore picks own chip.
2. Assert: warning "К себе Путана не ходит". `#nextStep` disabled.

### J4. Whore visits same target two nights
1. Night 1: whore visits P. Night 2: same P.
2. Assert: warning + `#nextStep` disabled.

### J5. Skip is always allowed
1. On any doctor/whore step, click `[data-skip]` instead of a chip.
2. Assert: `#nextStep` enabled. Can advance.

---

## §K — Back navigation

### K1. Back within a phase
1. Host, day 1, step 3. Click `#prevStep` twice.
2. Assert: step index decremented.

### K2. Back across phase boundary
1. Host, vote phase (single step "Голосование и казнь"). Click `#prevStep`.
2. Assert: phase becomes `day`, step is last of day.

### K3. Back disabled at very first step
1. Host, night 1, step 1.
2. Assert: `#prevStep` has `disabled`.

### K4. Back after night applied shows resolved state
1. On "Рассвет", click `#nextStep` to apply kills and enter day. Click `#prevStep` back to "Рассвет".
2. Assert: resolve card still shows kills (applied state, idempotent).

---

## §L — Edge UI behaviour

### L1. Input focus preserved? (known quirk)
1. Names screen, focus input 0, type. Focus may be lost on re-render. Document current behaviour.
2. This is a known rough spot from game-rules.md §10 — NOT a regression if it still happens.

### L2. 20-char name limit
1. Type 25 chars into a name input. Assert value truncated to 20 (HTML `maxlength=20`).

### L3. Empty name auto-fills
1. Leave input blank. `#confirmNames`. On deal screen assert name is "Игрок N".

### L4. Counter bounds
1. Decrement to 4. Assert `#minusBtn` disabled.
2. Increment to 20. Assert `#plusBtn` disabled.

---

## Reporting

For each test:
- ✅ PASS (expected behaviour observed)
- ❌ FAIL (include screenshot, console messages, localStorage snapshot)
- ⚠ SKIP (note reason, e.g. "hard to trigger without time travel")

At the end output a summary table and a short paragraph on overall health.

## Priority for a time-boxed run

If a full pass is too long, start with these (critical regressions from the refactor):
1. §A (all smoke)
2. §I (all XSS)
3. §J (all validator gates)
4. §F1, §F3 (save/load)
5. §D2, §D3, §D5, §D10 (night resolver key paths)
6. §A3 (city win)
