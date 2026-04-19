# Mafia Game-Master — Game Rules & Edge Cases

Exhaustive reference of the behaviours encoded in `src/` as of the 2026-04-19 refactor.
Do not let the code and this doc drift apart.

## 1. Player count & role distribution

- Player count is bounded `[4, 20]` (home counter `+`/`−` buttons).
- Base rule: `totalMafiaSide = max(1, floor(n / 3))`.
- Override: `n ≤ 5` ⇒ `totalMafiaSide = 1` (even though `floor(5/3) = 1` anyway; the rule matters mostly as documentation of intent and stays for `n = 4`).
- **Don** occupies one of the mafia slots (not added on top). Enabled only when user opts in **and** `totalMafiaSide ≥ 2` — otherwise silently dropped.
- **Sheriff** is always 1.
- **Doctor** is 1 iff user opts in.
- **Maniac** is 1 iff user opts in **and** `n ≥ 8`.
- **Whore (Путана)** is 1 iff user opts in **and** `n ≥ 8`.
- **Veteran** is 1 iff user opts in **and** `n ≥ 6`.
- Civilians fill the remainder, guaranteed `≥ MIN_CIVILIANS = 2` — the balancer strips optional roles in this priority until satisfied: **whore → maniac → veteran → doctor → don → mafia down to 1**. (Doctor outranks Veteran because the Doctor acts every night while the Veteran only twice.)

### Toggle validation
- `canEnableRole('don') ⇔ n ≥ 6`
- `canEnableRole('maniac') ⇔ n ≥ 8`
- `canEnableRole('whore') ⇔ n ≥ 8`
- `canEnableRole('veteran') ⇔ n ≥ 6`
- `canEnableRole('doctor') ⇔ true` (always)
- `validateRoles()` runs on every player-count change and clears flags for roles whose gate failed.
- `isRoleEffective(roleId)` — the role is toggled on but the civilian-floor balancer ate it. UI shows a "⚠ Не поместится" warning.

### Dealing
- `dealRoles()` builds an array of role strings respecting distribution counts and shuffles Fisher-Yates (`Math.random()`, unseeded).
- Players keep the order they were entered on the names screen.

## 2. Screens & navigation

`state.screen ∈ {home, rules, names, deal, host, gameover}`.

- `home`: counter, role distribution card, optional-role toggles, sub-options for maniac/whore, "Resume saved game" panel if applicable.
- `names`: text inputs (max 20 chars, no sanitisation), empty names auto-fill `Игрок N` on submit.
- `deal`: per-player reveal. Sub-phases `state.dealPhase ∈ {await, shown, handoff}`.
  - `await`: big player name + pulse button; transition on tap.
  - `shown`: role card with emblem/side/desc. For mafia/don, also shows other mafia names (filtered to exclude self).
  - Last player's confirm button says "Запомнил, передаю ведущему →" and advances to `handoff`.
  - `handoff`: transition screen shown to the whole table — the last player hands the phone to the moderator so they don't see the host-screen roster. Confirming moves to `host`.
- `host`: main game loop — see §3.
- `gameover`: winner verdict + full roster with roles + "Новая партия" button.
- `rules`: static HTML overview.

### Screen transitions
- `home → rules` (two-way).
- `home → names → deal → host → gameover → home`.
- `host` can also "Завершить игру" (confirm dialog) → `home`.
- Back button on deal screen: not available; user must complete.
- Back button on host screen within a step: if not on the first-night first step, `state.stepIndex--`; at the first step of a phase, jumps to the *last* step of the previous phase (`vote → day → night`).
- There is no cross-day back — once night resolved, you cannot walk back to the previous day.

## 3. Host loop (day/phase/step state machine)

`state.day` (1-based), `state.phase ∈ {night, day, vote}`, `state.stepIndex`.

Steps are computed on every render via `getCurrentSteps()` → `getNightSteps` / `getDaySteps` / `getVoteSteps`.

### Night steps (compacted 2026-04-19)

Standalone "`<role>` засыпает" steps have been removed — every role-action step
carries the closing script (e.g., "После выбора — «Доктор, закрой глаза»") in
its hint. "Итог ночи" + "Город просыпается" were merged into one step
("Рассвет").

Order within a night:

1. "Город засыпает" (always).
2. **First night only** and mafia alive: "Мафия знакомится" — no kill; hint
   reminds the host to say «Мафия, закрой глаза» at the end.
3. Whore alive: "Путана" (pickTarget). Goes *before* everyone else so blocks
   resolve correctly.
4. **Not first night** and mafia alive: "Мафия просыпается" — pickTarget or
   blockedAction if whore blocks mafia. Mafia closes eyes here *only if* Don
   is not active; otherwise the Don step carries the closing.
5. Don alive: "Дон ищет Шерифа" — pickTarget with live result
   (`✓ Шериф` / `✗ Не Шериф`) or blockedAction. Closes all mafia on non-first
   nights; closes Don alone on first night.
6. Doctor alive: pickTarget or blockedAction.
7. Sheriff alive: pickTarget or blockedAction. Sheriff result uses the
   `sheriffSeesManiac` option (see §4). The Veteran is always seen as
   `notMafia`.
8. Veteran alive and at least one latch unused: `veteranAction` step
   (`save` / `kill` / `skip`), followed by a pickTarget or blockedAction.
   Positioned between Sheriff and Maniac so a `kill` on the Maniac
   preempts the Maniac step.
9. Maniac alive: pickTarget or blockedAction. **Maniac acts on the first
   night too** — confirmed by every external source (see
   `docs/external-rules/README.md`) and implemented in `resolveNight`
   (no `isFirstNight` gate).
10. "Рассвет" — merged resolve + city-wake. Renders the summary card, runs
   `resolveNight` at render-time (if not cached), applies kills on `#nextStep`
   via `applyNightResolution`.

### Day steps (`getDaySteps`, 3 steps)

1. "Утро первого дня" (day 1 + peaceful night) or "Объявление жертв"
   (otherwise) — shows the actual resolved kills. A 30s last-word timer is
   attached whenever someone died, including day 1 after a maniac kill.
2. "Обсуждение" — 60s timer "Минута на игрока".
3. "Выдвижение и оправдания" — 30s timer per candidate. Host restarts the
   timer for each new candidate.

### Vote steps (`getVoteSteps`, 1 step)

1. "Голосование и казнь" — pickKilled action + 30s last-word timer for the
   executed player. Tie handling is narrative (host decides "no one leaves"
   or "all tied candidates leave" per club convention); there is no
   dedicated re-vote timer.

### "Next" gate
`isNextDisabled` allows advancing only when:
- `pickTarget`: `state.night[field]` is not `null` (so `-1` / skip is OK).
- `blockedAction`: `state.night[field] === -1` (host clicked "Подтвердить").
- `pickKilled`, `resolveNight`: never blocked.

### Phase transitions
- On last step of `night` → `phase = 'day'`, `stepIndex = 0`.
- On last step of `day` → `phase = 'vote'`, `stepIndex = 0`.
- On last step of `vote` → new night, `day++`, `resetNightSelections()`, or `gameover` if `checkWinCondition` triggers.

### Mid-step side effects
- `resolveNight` step: pre-computes `state.night.resolved` at render time. On "Next", `applyNightResolution()` (idempotent via `state.night.applied`) kills players and updates `doctorHistory` / `whoreHistory`.
- `pickKilled` step: on "Next" with `dayVoteKilled >= 0`, marks the player dead. Win check runs immediately.

## 4. Night resolution (`resolveNight`)

Pure function — takes `state.night`, `state.players`, `state.gameOptions` and returns
```
{ killed: [idx], savedByDoctor: idx|null, blocked: {mafia?, maniac?, doctor?, sheriff?},
  sheriffResult: 'mafia'|'notMafia'|null, donResult: 'sheriff'|'notSheriff'|null,
  whoreDied: bool, whoreSavedByDoctor?: bool, whoreAtMafia?: bool }
```

### Whore blocks (`getWhoreBlocks`)
Whore's target drives blocks. Edge cases baked in:

- **Visiting mafia (common mafioso or Don)**:
  - **Hard rule** (`whoreDiesAtMafia = true`): blocks **entire mafia team** *and* Don's personal check.
  - **Soft rule** (`whoreDiesAtMafia = false`): team mafia is blocked **only if whore visited the sole living mafioso**. Otherwise the remaining mafia still kill. Don's personal check is always blocked when whore visits Don himself.
- **Visiting maniac**: blocks maniac.
- **Visiting doctor**: blocks doctor.
- **Visiting sheriff**: blocks sheriff.

### Whore death
- Whore visiting any mafioso + `whoreDiesAtMafia = true` ⇒ `result.whoreDied = true`.
- Whore visiting any mafioso + soft rule ⇒ `result.whoreAtMafia = true` (informational; she stays alive, but her daytime vote "не в счёт" — currently only surfaced in the resolve summary, not enforced mechanically).
- On the first night, mafia does not act, so `whoreDied` is forced back to `false` even if hard rule would trigger.
- If Doctor heals the visited whore, she lives and `whoreSavedByDoctor = true` (but `whoreDied` stays `true` for UI phrasing).

### Sheriff check
- Mafia/Don visible as `'mafia'`.
- Maniac visibility governed by `state.gameOptions.sheriffSeesManiac`:
  - `'never'` — always `notMafia`.
  - `'afterMafia'` (default) — `mafia` only when the entire mafia team is dead.
  - `'always'` — always `mafia`.
- Veteran always reads as `'notMafia'` (light-side role).
- If whore blocked sheriff, no result.

### Don check
- Target is `'sheriff'` or `'notSheriff'`. Blocked by whore (when whore visits Don).

### Mafia kill
- `mafiaTarget` used only if `!isFirstNight && !mafiaBlocked`.
- If doctor healed the same index ⇒ `savedByDoctor`, not added to `killed`.

### Maniac kill
- `maniacTarget` used if `!maniacBlocked`. **No first-night gate.**
- If doctor heals the same index, saved. Doctor saves from maniac too.
- If mafia AND maniac target the same alive player and doctor heals ⇒ one save, the player lives.
- If they target different players, both can die in the same night.

### Veteran action
- `state.night.veteranAction ∈ {null, 'save', 'kill', 'skip'}` with an optional
  `veteranTarget` index. `skip` means the host deliberately passed — neither
  latch burns.
- `canVeteranAct` blocks `save` if `state.veteranHealUsed` is already set,
  and `kill` if `state.veteranKillUsed` is already set or the target is the
  Veteran himself.
- If whore visits the Veteran, `veteranBlocked` is set — the action does not
  resolve, but the chosen latch (`save` or `kill`) still burns on
  `applyNightResolution`. `skip` never burns.
- A successful `kill` on an alive Maniac sets `maniacBlocked` for the night.
  This pre-empt latches even if the Doctor later heals the Maniac.
- Doctor heals stack with Veteran save: either one keeps the target alive.
  If both apply to the same index, `savedByDoctor` is the one reported.

### Applying
`applyNightResolution` writes kills, pushes `doctorTarget` and `whoreTarget` to their histories (indexes or `null` if skipped), sets `doctorSelfUsed` once the doctor heals himself, and sets `veteranHealUsed` / `veteranKillUsed` when the Veteran's action latch fires (including when whore blocks the attempt).

## 5. Per-role nightly constraints

> **As of the 2026-04-19 refactor:** `isNextDisabled` consults the validator for `pickTarget` actions. If `canDoctorHeal` or `canWhoreGo` returns `{ok:false}`, the "Далее" button is disabled until the host picks a valid target or skips. Previously the warning was advisory.

### Doctor (`canDoctorHeal(targetIdx)`)
- Cannot heal the same player two nights in a row (check against `doctorHistory[-1]`).
- Can heal self only **once per game** (`doctorSelfUsed` latch).
- Returns `{ok, reason}`. UI shows a warning below the target grid when invalid and the "Далее" button is disabled until the host picks a valid target or skips.

### Whore (`canWhoreGo`)
- Cannot visit herself.
- Cannot visit the same player two nights in a row (check against `whoreHistory[-1]`).
- Returns `{ok, reason}`. UI shows a warning and the "Далее" button is disabled until the host picks a valid target or skips.

### Maniac
- No historical constraints.

### Veteran (`canVeteranAct`)
- Two game-long latches: `state.veteranHealUsed`, `state.veteranKillUsed`.
- `save` requires `!veteranHealUsed`; `kill` requires `!veteranKillUsed`.
- `kill` cannot target the Veteran himself; `save` on self is allowed.
- Targets have no night-to-night history (each latch fires at most once).
- `skip` is always valid and does not burn a latch.

### Don / Sheriff
- No constraints, can repeat targets; checks happen nightly.

## 6. Win conditions (`checkWinCondition`)

Teams:
- **Mafia** = `role ∈ {mafia, don}`.
- **Civilians** = `role ∉ {mafia, don, maniac}` (includes sheriff, doctor, whore, veteran).
- **Maniac** = `role === 'maniac'`.

Rules, evaluated in order:
1. All dead ⇒ `'draw'`.
2. `mafia = 0 && maniac = 0` ⇒ `'city'`.
3. `mafia = 0 && maniac > 0 && civilians ≤ 1` ⇒ `'maniac'`.
4. `maniac = 0 && mafia ≥ civilians` ⇒ `'mafia'`.
5. `mafia > 0 && maniac > 0 && civilians = 0` ⇒ `'mafia'` (simplification: mafia is assumed to take out the lone maniac).
6. Otherwise `null` — game continues.

Check is called:
- Before every host render.
- After `applyNightResolution`.
- After `pickKilled` → `player.alive = false`.
- At the end of `vote` phase.

Transitions to `state.screen = 'gameover'` with `state.winner` set.

## 7. Persistence

Storage keys:
- `mafia.game.v1` — host-phase snapshot, TTL `SAVE_TTL_MS = 6h`, debounced 300ms.
- `mafia.theme` — `'light' | 'dark'`.

Snapshot fields: `ts, playerCount, optionalRoles, gameOptions, players, day, phase, stepIndex, night, doctorHistory, doctorSelfUsed, whoreHistory, veteranHealUsed, veteranKillUsed, nightLog, dayVoteKilled, winner`.

Restore:
- `gameOptions` merged onto defaults (older saves may lack them).
- If `winner` is set, land on `gameover`; else `host`.
- `state.night.applied` is restored from the snapshot's `night.applied` (set by `applyNightResolution` before each save).

Write conditions:
- `saveGame` is a no-op unless `state.screen === 'host'`.
- `clearSavedGame` runs only on explicit intents: «Удалить» on home, «Завершить игру» on host, «Новая партия» on gameover. Reaching home via refresh does NOT wipe the save — that was the old behaviour and broke the «Продолжить» button.

Safari private-mode guard: `storageGet/Set/Remove` wrap in try/catch.

Resume card on home shows: age ("только что" / "N мин назад" / "N ч M мин назад") and description `${phase} · День N · Живых K/total`.

## 8. Timer

- `state.timer = { seconds, running, interval, preset }`.
- `renderTimer(preset, label)` resets `seconds = preset` when entering a new step (tracked by `lastTimerStepKey = '${phase}:${day}:${stepIndex}'`).
- Controls: `−10s`, `▶/⏸`, `+10s`, `Сброс на MM:SS`.
- Bounds: `[0, 600]` seconds.
- Tick audio (WebAudio) on last 5 seconds; final gong + `navigator.vibrate([200, 100, 200])` at 0.
- `AudioContext` is lazy; iOS `suspended` state resumed on first button tap.

## 9. Theme

- `state.theme ∈ {light, dark}`, default `light`.
- Applied via `data-theme="dark"` on `<html>`.
- Preloaded from storage before first render to avoid flash.
- Toggle button (gear-style) is outside `#app` so it survives the innerHTML wipes.

## 10. Known edge cases & rough spots

These are the ones I noted while reading — not bugs in the strict sense, but things to preserve or explicitly choose during the refactor.

- **Back navigation past `resolveNight`**: `state.night.applied` + stored `resolved` means going back to the resolve step shows the same summary. But the host *cannot* undo a night's kills or change selections retroactively — "Назад" on the "Город просыпается" step returns to the resolve display, not to the action steps, because indexing walks backwards within the current phase only. If the host goes back from day-step 1 to the last night step (resolve), they see the already-applied result.
- **"Завершить игру"** from host resets `screen` to `home` without clearing `players`, `day`, `phase` — so the saved game on disk is cleared by entering `home` but in-memory state could still be poked by unusual flows. The main re-entry point (`names` screen) rewrites `state.players` when `playerCount` doesn't match, so this is mostly harmless.
- **Maniac on night 1**: unlike mafia, maniac's first-night kill is live. This is an intentional asymmetry but worth noting.
- **"Whore soft block" informational flag (`whoreAtMafia`)** is shown in the resolve summary but *not* enforced anywhere — the mafia still kills normally unless whore visited the *sole* living mafioso. Re-read the soft-rule text before touching this.
- **`confirm()` / `alert()`** are used for "Завершить игру?" and "Удалить сохранённую партию?". Modal would be nicer but this is out of scope for a behavioural rewrite.
- **Wake Lock API not used** — the host's phone can sleep mid-game.
- **Full `app.innerHTML` re-render on every state change** — cheap because the DOM is small, but inputs lose focus mid-typing (names screen relies on `oninput` writing through). Timer has a bespoke `updateTimerDisplay` to avoid this.

## 11. Role metadata (from `ROLES`)

| id | Name | Side | Emblem | One-line |
|----|------|------|--------|----------|
| `mafia` | Мафия | Тёмная | 🔪 | Kill at night with the family, lie by day. |
| `civilian` | Мирный | Светлая | ☗ | No power, just logic and rhetoric. |
| `sheriff` | Шериф | Светлая | ✦ | Checks one player per night. |
| `doctor` | Доктор | Светлая | ✚ | Heals one per night; self only once. |
| `don` | Дон Мафии | Тёмная | ♛ | Mafia leader; also looks for the sheriff. |
| `maniac` | Маньяк | Одиночка | ☠ | Solo killer; wins when only one civilian remains. |
| `whore` | Путана | Светлая | ❀ | Blocks a target's night action; caught at the mafia risks dying. |
| `veteran` | Ветеран | Светлая | ⛨ | One save and one kill across the whole game; pre-empts Maniac if killed before his turn. |
