# Veteran Role — Design Spec

Status: approved, ready for implementation
Date: 2026-04-19
Target version: 1.6.0

## 1. Summary

The Veteran is a new optional **light-side** role. A lone retired operative who
once served in law enforcement / the military and now delivers justice on his
own. Mechanically he has two one-off abilities with a hard cap of one per game:

- **Save** — once per game, at night, cancel any night-kill on a target
  (including himself).
- **Kill** — once per game, at night, kill any other player. Cannot target
  himself.

He may use at most **one** of these actions per night. Skipping is always an
option. The role is considered civilian for every purpose (Sheriff reads him
as non-mafia, Don reads him as non-sheriff, win conditions treat him as
civilian).

## 2. Naming (i18n)

| Locale | `roles.veteran.name` |
|--------|----------------------|
| ru     | Ветеран              |
| en     | Veteran              |
| uk     | Ветеран              |

## 3. Visual

- **Emblem:** `⛨` (U+26E8 BLACK CROSS ON SHIELD). Forced to text variant with
  `\uFE0E` to prevent color-emoji rendering on iOS, mirroring the Maniac's
  skull glyph.
- **Brand color:** `#5a7aa0` (mid steel-blue). Contrasts on both the parchment
  light background and the dark theme; does not collide with existing role
  colors (blood red, gold, green, purple, pink).

## 4. Enable gate and balancer

- `canEnableRole('veteran', n) ⇔ n ≥ 6`.
- New balancer stripping order (highest-to-lowest priority, last to survive):
  `whore → maniac → veteran → doctor → don → mafia (down to 1)`.
  Rationale: Doctor is the civilian team's workhorse — preserved over the
  flashier-but-niche Veteran.
- `validateOptionalRoles` clears `veteran` when `playerCount < 6`.

## 5. Game-state additions

### `state.optionalRoles`

Add a new boolean `veteran`.

### `state.night` (per-night selections)

| Field             | Type                        | Meaning                                              |
|-------------------|-----------------------------|------------------------------------------------------|
| `veteranTarget`   | `number \| null`            | Target index, or `-1` for skip.                      |
| `veteranAction`   | `'save' \| 'kill' \| null`  | Ability picked this night. `null` until chosen.      |

Resetting `state.night` via `emptyNight()` zeroes both fields.

### Root state (per-game latches)

| Field              | Type      | Meaning                                 |
|--------------------|-----------|-----------------------------------------|
| `veteranHealUsed`  | `boolean` | Save-ability consumed (successful OR burned by Whore). |
| `veteranKillUsed`  | `boolean` | Kill-ability consumed (successful OR burned by Whore). |

### Persistence (snapshot)

`buildSnapshot` and `applySnapshotToState` must carry the new state fields with
sane fallbacks (`false`, `null`, etc.) so older saves keep loading.

## 6. Night-order integration

New order in `getNightSteps`:

1. "Город засыпает"
2. *(n1 only, mafia alive)* "Мафия знакомится"
3. *(Whore alive)* "Путана"
4. *(n2+, mafia alive)* "Мафия просыпается"
5. *(Don alive)* "Дон ищет Шерифа"
6. *(Doctor alive)* "Доктор"
7. *(Sheriff alive)* "Шериф"
8. **(Veteran alive) "Ветеран" — NEW**
9. *(Maniac alive)* "Маньяк"
10. "Рассвет"

Veteran sits between Sheriff and Maniac so his kill can pre-empt the Maniac's
action (see §8.4).

## 7. UI for the Veteran step

Introduces a new step action type `pickVeteran` (handled in
`src/ui/screens/actions.js`).

Host screen renders three rows in this order:

1. **Mode picker** — three buttons: "Спасти" / "Убить" / "Пропустить".
   - `Спасти` is disabled when `veteranHealUsed` is already `true`.
   - `Убить` is disabled when `veteranKillUsed` is already `true`.
   - Picking "Пропустить" sets `veteranAction = null, veteranTarget = -1`.
   - Picking "Спасти" sets `veteranAction = 'save'` and clears
     `veteranTarget`.
   - Picking "Убить" sets `veteranAction = 'kill'` and clears
     `veteranTarget`.

2. **Target grid** — visible only when `veteranAction ∈ {save, kill}`.
   - For `kill`, excludes the Veteran himself.
   - For `save`, includes the Veteran himself.

3. **Warning row** — when a validation fails (e.g., self-kill attempted),
   surfaces the reason. `isNextDisabled` blocks "Далее" until the selection is
   valid.

When the Whore has blocked the Veteran (`getWhoreBlocks` returns
`{ veteran: true }`), the step renders as a `blockedAction` (same pattern as
Sheriff/Doctor under Whore). The host presses "Подтвердить"; the attempt
still burns the chosen-ability latch.

## 8. Night resolver (`resolveNight`) — behaviour

### 8.1 Inputs consumed

`state.night.veteranAction`, `state.night.veteranTarget`, plus the Whore
blocks computed from `state.night.whoreTarget`.

### 8.2 Whore blocks

`getWhoreBlocks` now also returns `{ veteran: true }` when the Whore is
visiting the Veteran. If blocked:
- `result.blocked.veteran = true`.
- The save/kill does **not** fire this night.
- The ability latch **is** consumed (user decision #4 — attempt burns).

### 8.3 Save

If `veteranAction === 'save' && !blocked.veteran && veteranTarget != null`:
- The target index is added to a local `veteranSaved` variable.
- In the kill-assembly phase, `veteranSaved` acts exactly like `savedByDoctor`
  — it cancels any incoming night-kill on that index from Mafia, Maniac, or
  Veteran itself. The existing `savedByDoctor` is still the single
  "save-of-record" reported in the resolve card; if Doctor and Veteran both
  save the same person, that's fine.
- `veteranHealUsed` is set to `true` in `applyNightResolution`.

### 8.4 Kill + Maniac pre-empt

If `veteranAction === 'kill' && !blocked.veteran && veteranTarget != null`:
- `veteranKill = veteranTarget`.
- **Maniac pre-empt rule:** if `veteranKill` points at an alive Maniac,
  `blocked.maniac = true` is set — Maniac's action is nullified regardless of
  what `state.night.maniacTarget` contains. This matches the night-order
  intuition: Veteran's attack lands before the Maniac wakes.
- In the kill-assembly phase, `veteranKill` is added to the kill set unless
  some save (Doctor or Veteran-save) cancels it. If Doctor heals the Maniac
  the Veteran tried to pre-empt, the Maniac lives *and still didn't act* this
  night — the block latched the moment the kill was declared.
- `veteranKillUsed` is set to `true` in `applyNightResolution`.

### 8.5 Validator: `canVeteranAct`

Returns `{ok, reason}` against the candidate target. Rules:
- `veteranAction === 'save'` and `veteranHealUsed` → not ok
  (`validation.veteranHealUsed`).
- `veteranAction === 'kill'` and `veteranKillUsed` → not ok
  (`validation.veteranKillUsed`).
- `veteranAction === 'kill'` and target is the Veteran himself → not ok
  (`validation.veteranSelfKill`).
- Target missing → not ok.
- Otherwise ok.

`isNextDisabled` consults `canVeteranAct` for `pickVeteran` actions, same as
the existing `canDoctorHeal` / `canWhoreGo` pattern.

### 8.6 Result object

`NightResult` gains optional fields:
- `blocked.veteran?: boolean`
- `veteranSaved?: number | null` — target index when save was attempted and
  not blocked.
- `veteranKill?: number | null` — target index when kill was attempted and
  not blocked.

The resolve card surfaces these in a compact line each (see i18n §10.2).

### 8.7 Idempotency

`applyNightResolution` continues to be idempotent via `night.applied`. The two
new latches are only flipped on the first application.

## 9. Night-log entry

`appendNightLog` adds a `veteran` slot to each log entry when the Veteran
acted (or tried to). Shape:

```js
veteran: {
  action: 'save' | 'kill' | 'skip',
  target: number | null,   // -1 when skipped
  blocked: boolean,        // true if Whore burned the attempt
  effective: boolean,      // action landed (save cancelled a kill, or kill landed)
}
```

The gameover history renders a line:
- Save:  `⛨ Ветеран прикрыл {name}`
- Kill:  `⛨ Ветеран ликвидировал {name}`
- Skip:  nothing (line suppressed)
- Blocked:  `⛨ Ветерана заблокировала Путана`
- Preempt: `⛨ Ветеран пресёк Маньяка`

## 10. i18n additions (parity across ru/en/uk)

### 10.1 Role

- `roles.veteran.name` — Ветеран / Veteran / Ветеран.
- `roles.veteran.desc` — single-paragraph description:
  > Бывший сотрудник силовых структур, давно ушедший со службы — но прошлое
  > его не отпускает. Считает своим долгом вершить правосудие в одиночку.
  > За всю игру может один раз ночью спасти любого игрока от смерти и один
  > раз — ликвидировать кого угодно. Считается мирным: Шериф видит его как
  > своего.

### 10.2 Steps

Under `steps.veteran.*`:

| Key                 | Purpose                                                 |
|---------------------|---------------------------------------------------------|
| `title`             | "Ветеран" (card title)                                  |
| `say`               | Moderator script to wake Veteran                        |
| `sayBlocked`        | Moderator script when Whore blocked                     |
| `hint`              | Host hint (ability-count + "close eyes")                |
| `hintBlocked`       | Host hint when blocked                                  |
| `modeSave`          | "Спасти"                                                |
| `modeKill`          | "Убить"                                                 |
| `modeSkip`          | "Пропустить"                                            |
| `modeLabel`         | "Что делает Ветеран"                                    |
| `labelSave`         | "Кого защищает"                                         |
| `labelKill`         | "Кого ликвидирует"                                      |
| `blockedLabel`      | "Ветеран не действует этой ночью"                       |
| `blockedConfirm`    | "Ветеран пропускает ход"                                |

### 10.3 Validation

Under `validation.*`:

- `veteranHealUsed` — "Спасение уже использовано за эту игру"
- `veteranKillUsed` — "Удар уже использован за эту игру"
- `veteranSelfKill` — "Ветеран не может ликвидировать сам себя"

### 10.4 Home screen

- `home.roleDesc.veteran` — "Один раз спасает, один раз убивает. Минимум 6 игроков."

### 10.5 Resolve card

Under `actions.*`:

- `resolveVeteranSave` — "⛨ Ветеран прикрыл: <strong>{name}</strong>"
- `resolveVeteranKill` — "⛨ Ветеран ликвидировал: <strong>{name}</strong>"
- `resolveVeteranPreempt` — "⛨ Ветеран пресёк Маньяка"

### 10.6 Night log (gameover)

Under `gameover.history.*`:

- `veteranSave` — "⛨ Ветеран прикрыл: {name}"
- `veteranKill` — "⛨ Ветеран ликвидировал: {name}"
- `veteranPreempt` — "⛨ Ветеран пресёк Маньяка"
- `veteranBlocked` — "⛨ Ветерана заблокировала Путана"

Ukrainian and English mirror these strings.

## 11. CSS

- `.role-icon.veteran { color: #5a7aa0; }`
- `.step-card.veteran-action { border-left-color: #5a7aa0; }`
- Dark theme inherits the same color via the existing single-color-per-role
  pattern (no `data-theme` override needed — the tone is mid enough).

## 12. Test plan (unit)

`tests/distribution.test.js`

- `canEnableRole('veteran', 5) === false`; `canEnableRole('veteran', 6) === true`.
- 10-player spread with `{veteran:true}` includes exactly one Veteran.
- 6-player spread with `don + doctor + veteran`: balancer squeezes Veteran (not
  Doctor), `dist.veteran === 0`, `dist.doctor === 1`.
- 10-player spread with `don + doctor + veteran + whore + maniac`: balancer
  squeezes in the documented order.
- `dealRoles` assigns one `veteran` when the role is enabled.

`tests/night.test.js`

- Veteran save of the mafia's target cancels the kill.
- Veteran save of the maniac's target cancels the kill.
- Veteran save of self blocks mafia kill on self.
- Veteran kill of a plain civilian lands.
- Veteran kill of Maniac nullifies Maniac (`blocked.maniac`) and target the
  Maniac had picked lives.
- Veteran kill of Maniac + Doctor heals Maniac: Maniac lives but still didn't
  act (preempt still latches).
- Veteran kill + Doctor heals the Veteran's target: target lives.
- Whore visits Veteran: attempt burns (`veteranHealUsed` / `veteranKillUsed`
  flip), no save/kill lands.
- `canVeteranAct`: self-kill rejected; used-save/used-kill rejected.
- `applyNightResolution` is still idempotent with Veteran fields.

`tests/steps.test.js`

- Veteran step appears between Sheriff and Maniac when
  `optionalRoles.veteran && veteran alive`.
- Dead Veteran ⇒ no step.
- Whore blocking Veteran ⇒ step is `blockedAction`, no timer.

`tests/win.test.js`

- Veteran counts as civilian in the alive roster (no dedicated test added
  since the existing function already uses "not mafia/don/maniac"; a regression
  check reinforces it).

`tests/i18n-parity.test.js`

- Existing parity assertions remain green after adding the new keys.

## 13. Versioning & deploy

- Bump `src/ui/version.js` → `1.6.0`.
- Bump `package.json` → `1.6.0`.
- Per the deploy workflow, this version bump auto-publishes to GitHub Pages on
  merge to `main`.

## 14. Out of scope

- Manual-test plan updates (`docs/manual-test-plan.md`) — covered by a
  follow-up once the feature lands.
- `docs/game-rules.md` refresh — update in the same PR as the feature so the
  rules stay in sync.
- Visual polish of the mode-picker buttons — initial pass uses the existing
  `target-chip`/`seg-btn` classes; iterate later if it feels cramped.
