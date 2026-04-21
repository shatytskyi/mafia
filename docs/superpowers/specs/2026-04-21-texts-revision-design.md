# Host Script & Hint Revision — Design Spec

Status: approved, ready for implementation
Date: 2026-04-21
Target version: 1.22.0

## 1. Summary

A focused revision of the host-facing copy (`say`, hints, dawn announcements,
host tips) motivated by five issues surfaced during a `ru.js` audit:

1. **Whore-block leakage** — every `*.sayBlocked` announces the block aloud,
   which deanonymises the Whore and reveals her target. Roles deduce they are
   being blocked on the very first visit.
2. **Hint overload** — the `hint` field mixes three concerns (host script,
   role constraints, situational advice) in a single paragraph, making it
   hard for the host to parse under pressure.
3. **Dawn tonality drift** — the first night is dramatic («Страшная новость…»),
   later nights are terse («День N. Этой ночью погиб X»), and the same line
   repeats every time.
4. **Voting-phase copy inaccuracies** — `voteSay` says "raise your hand for who
   you think is mafia", but the town votes for execution, not a verdict; the
   last-word hints include an unfounded «no hinting at the killer» rule.
5. **Weak `hostTips`** — generic advice («drama is good», «watch their eyes»)
   that doesn't address the top host-skill concerns (rhythm, masking, sheriff
   signal discipline).

Scope:

- Extend the `Step` shape with `rules` and `tips` fields alongside `hint`.
- Unify `say`/`sayBlocked` for every role whose block currently leaks.
- Randomise dawn announcements deterministically per `day` (3 variants each).
- Reword voting copy; drop unfounded last-word restrictions.
- Rewrite `rules.hostTips` to focus on rhythm and masking.
- Maintain Russian / Ukrainian / English i18n parity.

Out of scope: role mechanics, balancer, `resolveNight`, win conditions, save
format, home / deal / gameover screens.

## 2. `Step` schema — three text fields

### 2.1 JSDoc change (`src/types.js` is unaffected; `src/core/steps.js` has
the typedef)

```js
/**
 * @typedef {object} Step
 * @property {string} title
 * @property {string} say
 * @property {string} [hint]     // host script: what to say off-record / cue gestures
 * @property {string} [rules]    // short role constraints (1–2 lines)
 * @property {string} [tips]     // situational advice (only when worth noting)
 * @property {string} [cls]
 * @property {StepAction} [action]
 * @property {number|null} [timerSeconds]
 * @property {string} [timerLabel]
 * @property {string} [summary]
 */
```

### 2.2 Render (`host.js` / `stepCardHtml`)

Three sibling blocks appear under `.step-say` when their field is non-empty.
All three reuse the existing left-bar-with-kicker style, varying only the
kicker label:

| Field | CSS class     | Kicker      |
|-------|---------------|-------------|
| hint  | `.step-hint`  | `СКРИПТ`    |
| rules | `.step-rules` | `ПРАВИЛО`   |
| tips  | `.step-tips`  | `СОВЕТ`     |

Empty fields render nothing — no empty-block placeholders. Existing
`.step-hint` CSS is kept; its `::before` kicker text flips from `СОВЕТ` to
`СКРИПТ`. `.step-rules` and `.step-tips` are added in `styles.css` by
extending the same rule set.

### 2.3 Content migration rule

Every current `hint` string is rewritten into up to three pieces:

- **Script** (host cue, «После выбора — «Доктор, закрой глаза».») → `hint`.
- **Hard rules** («Нельзя лечить одного игрока две ночи подряд», «К себе нельзя») → `rules`.
- **Situational advice** («Доктор лечит и от удара Ветерана.», «Маньяк действует и в первую ночь.») → `tips`.

Trim anything that doesn't cleanly fit — rules are already enforced by
`canDoctorHeal` / `canWhoreGo`, so `rules` is only kept where the host needs
a verbal-correction reminder (e.g. the Whore can't skip).

## 3. Whore-block masking

### 3.1 Identity principle

For every role whose action step has a blocked variant, **`sayBlocked === say`**.
The host greets the role with the usual prompt, receives its gesture, and
silently discards it. Only the `hint` differs:

| Role         | Common `say`                                      | Blocked `hint`                                                                                                                 |
|--------------|---------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------|
| Mafia (kill) | «Мафия, просыпайся. Жестами выберите жертву.»     | «Путана заблокировала мафию. Прими их жест, выдержи обычную паузу, убийства не будет. {closing}»                              |
| Don          | «Дон, просыпайся. Укажи, кого проверяешь.»        | «Путана заблокировала Дона. Прими жест, НЕ передавай ответ. {closing}»                                                         |
| Doctor       | «Доктор, просыпайся. Кого лечишь этой ночью?»     | «Путана заблокировала Доктора. Прими жест, лечения не будет. После — «Доктор, закрой глаза».»                                  |
| Sheriff      | «Шериф, просыпайся. Кого проверяешь?»             | «Путана заблокировала Шерифа. Прими жест, НЕ передавай ответ. После — «Шериф, закрой глаза».»                                  |
| Maniac       | «Маньяк, открой глаза. Кого убиваешь?»            | «Путана заблокировала Маньяка. Прими жест, убийства не будет. После — «Маньяк, закрой глаза».»                                 |
| Veteran      | «Ветеран, открой глаза. Что делаешь этой ночью?»  | «Путана заблокировала Ветерана — попытка сгорает. Прими жест, реакции нет. После — «Ветеран, закрой глаза».»                   |

The app-side `steps.js` still branches on `blocks.*` — the branch carries a
different `action` (`blockedAction` vs `pickTarget`) and different `hint`, but
reuses the same `say` string. The existing `*.sayBlocked` i18n keys are
removed and the blocked branch just reads `*.say`.

### 3.2 Host learns via roster panel

The host sees the private resolve card and the roster panel — those already
make block state visible. Nothing changes there.

### 3.3 Exception: first-night meet-and-greet

The `mafiaMeet` step is never blocked (first night, no kill) — stays as-is.

## 4. Randomised dawn announcements

### 4.1 Storage shape

Arrays of 3 strings per outcome under `i18n.*.steps.dawn.*`:

```js
steps: {
  dawn: {
    title: 'Рассвет',
    say: 'Город просыпается. Открывайте глаза.',
    hint: /* existing script-hint */,
    peacefulFirst: [
      'Доброе утро, город. Все целы — кажется, семья ещё принюхивается.',
      'Доброе утро, город. Первая ночь прошла без крови. Пора знакомиться.',
      'Доброе утро, город. Чудо: все живы. Воспользуйтесь этим шансом.',
    ],
    peacefulLater: [/* 3 variants, using {day} */],
    deathFirstOne: [/* 3, using {names} */],
    deathFirstMany: [/* 3, using {names} */],
    deathLaterOne: [/* 3, using {day} + {names} */],
    deathLaterMany: [/* 3, using {day} + {names} */],
  },
  // outside dawn: day-phase last-word already has its own keys
  victimsLastWordOne: [/* 3 variants with {names} */],
  victimsLastWordMany: [/* 3 variants with {names} */],
}
```

The previous `victimsPeacefulFirst` / `victimsDeathFirstOne` / etc. keys at
`steps.*` level are removed (they were the old dawn-announcement source) —
`buildDawnSay` switches to the new nested keys.

### 4.2 Selection

New helper in `src/core/steps.js`:

```js
/**
 * Deterministic variant pick — same {day} yields the same text, so navigating
 * back to the dawn step shows the same copy.
 */
export function pickDawnVariant(variants, day) {
  if (!Array.isArray(variants) || variants.length === 0) return '';
  const idx = (Math.max(1, day) - 1) % variants.length;
  return variants[idx];
}
```

`buildDawnSay` and the last-word step builder in `getDaySteps` both call this
helper. The helper is exported so a unit test can pin its behaviour.

### 4.3 i18n engine integration

`src/i18n/index.js` already exposes `tRaw(key)`, which returns the raw value
(array included). No changes needed there — `steps.js` calls `tRaw('steps.dawn.peacefulFirst')`
to get the array, picks a variant, then passes it through `t(...)` only when
interpolation is needed (or interpolates locally). Simpler: steps.js uses
`tRaw` + `pickDawnVariant` + a small local interpolation helper (same regex
as `interpolate` in i18n/index.js) — or exports `interpolate` publicly.

Plan of record: export a new helper `tList(key, params, day)` from
`src/i18n/index.js` that wraps `tRaw` + `pickDawnVariant` + interpolation.
Keeps the dictionary-lookup logic in one place.

```js
/**
 * Pick a deterministic variant from an array-valued i18n key and interpolate.
 * Same day → same string.
 */
export function tList(key, params, day) {
  let list = resolve(DICTS[currentLocale], key);
  if (!Array.isArray(list)) list = resolve(DICTS[DEFAULT_LOCALE], key);
  if (!Array.isArray(list) || list.length === 0) return key;
  const d = Math.max(1, Number(day) || 1);
  const picked = list[(d - 1) % list.length];
  return interpolate(picked, params);
}
```

### 4.4 Test

`tests/steps.test.js` (or a new `tests/dawn-variants.test.js`): confirm that
(a) a given day yields a fixed variant, (b) cycling through 3+ days touches
each variant at least once.

## 5. Voting & last-word (Q4: B/A/A)

| Key                         | Before                                                                                  | After                                                                                                                                   |
|-----------------------------|------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------|
| `steps.voteSay`             | «Голосуем. Поднимите руку за того, кого считаете мафией.»                                | «Голосование. Поднимайте руку за того, кого подозреваете.»                                                                               |
| `steps.voteHint`            | Keeps «не за себя» default; unchanged otherwise                                          | Same (unchanged).                                                                                                                        |
| `steps.victimsHint`         | «По классике — погибший может открыть свою роль, но НЕ намекать на убийцу. Дай 30 секунд…» | «Дай 30 секунд на последнее слово — погибший может открыть свою роль.»                                                                    |
| `steps.voteLastWordHint`    | «Казнённый может открыть роль, но не должен напрямую указывать на убийцу. Следующий шаг — ночь.» | «У казнённого 30 секунд — можно открыть роль. Следующий шаг — ночь.»                                                                       |
| `rules.voteEdge`            | «Последнее слово: … можно открыть роль, но нельзя напрямую намекать на убийцу и на игроков, которые ещё не успели походить.» | «Последнее слово: казнённому 30 секунд, можно открыть роль.»                                                                              |

## 6. `rules.hostTips` rewrite

New body (HTML list, Russian; `en` and `uk` translated to match):

```html
<ul>
  <li>Держи одинаковый ритм и интонацию на всех ночных шагах — любое отклонение выдаст блокировку Путаной или результат проверки Шерифа.</li>
  <li>Передавая жест Шерифу или Дону — не задерживайся и не ускоряйся: отклик на «мафия» и «не мафия» должен быть визуально одинаков.</li>
  <li>Драматизируй объявления рассвета — ты голос города, это работает на атмосферу и держит внимание стола.</li>
  <li>Проговори настройку «Путана у мафии» до раздачи — игроки должны понимать риск заранее, иначе жалобы после ночи.</li>
  <li>Игрок случайно выдал роль — решай по ситуации: обычно игра продолжается, в тяжёлых случаях — пересдача.</li>
</ul>
```

## 7. i18n impact

Per-locale delta (approximate; exact counts after implementation):

- **Removed keys (~12):** `steps.mafiaKill.sayBlocked`, `steps.don.sayBlocked`,
  `steps.doctor.sayBlocked`, `steps.sheriff.sayBlocked`, `steps.maniac.sayBlocked`,
  `steps.veteran.sayBlocked`, plus the old flat
  `steps.victimsPeacefulFirst`, `steps.victimsPeacefulLater`,
  `steps.victimsDeathFirstOne`, `steps.victimsDeathFirstMany`,
  `steps.victimsDeathLaterOne`, `steps.victimsDeathLaterMany`.
- **Added keys (~8 arrays):** `steps.dawn.peacefulFirst`, `steps.dawn.peacefulLater`,
  `steps.dawn.deathFirstOne`, `steps.dawn.deathFirstMany`, `steps.dawn.deathLaterOne`,
  `steps.dawn.deathLaterMany`, `steps.victimsLastWordOne`, `steps.victimsLastWordMany`
  (the last two become arrays; old scalar keys overwritten with arrays).
- **Added keys:** `rules`/`tips` on night-action steps where needed
  (~8–12 entries total across night roles).
- **Edited:** `steps.voteSay`, `steps.victimsHint`, `steps.voteLastWordHint`,
  `steps.victimsLastWordOne`, `steps.victimsLastWordMany`,
  `rules.sections.voteEdge.body`, `rules.sections.hostTips.body`,
  and every night-role `hint` (split into `hint` + optional `rules`/`tips`).

`tests/i18n-parity.test.js` already tolerates arrays (it treats them as leaves
in `collectPaths` because of the `!Array.isArray(value)` guard), so parity
will hold as long as all three locales expose the same key paths.

## 8. Version & migration

- `src/ui/version.js` `APP_VERSION` → `1.22.0`.
- `package.json` `version` → `1.22.0`.
- `mafia.game.v1` storage key unchanged — texts aren't serialised.
- GitHub Pages workflow gates on `package.json` version bump → triggers deploy.

## 9. Testing plan

### 9.1 Unit (automated)

- `tests/dawn-variants.test.js` (new): `pickDawnVariant` determinism + cycle coverage.
- `tests/steps.test.js`: no new behavioural assertions, but update any asserts
  that reference the removed `*.sayBlocked` keys (search: none expected —
  tests assert structure, not copy).
- `tests/i18n-parity.test.js`: should still pass out of the box.

### 9.2 Manual (host-side sanity)

- Start a game with Whore + all optional roles; verify every `*.say` is
  identical in blocked and unblocked variants.
- Navigate back and forth across the dawn step; confirm the announcement text
  is stable for the same day.
- Cycle days 1–4 with forced peaceful/kill alternation; observe three
  distinct dawn variants for each outcome.

## 10. Risks & mitigations

- **Host muscle memory** — veterans of the current copy will notice blocked
  steps "feel the same". That is the point; documented in release notes so
  they lean on the `hint` change.
- **Array keys in i18n-parity** — already safe (leaf-level equality), but if
  anyone later changes `collectPaths` to recurse into arrays, the test must
  continue to enforce equal array lengths. Noted for future maintainers.
- **Dawn variant drift across locales** — each locale maintains its own
  3-variant array; parity test guarantees the key is present but not the
  array length. If a future edit adds a 4th variant in `ru` but not in `uk`,
  nothing breaks (modulo wraps), but determinism diverges across languages.
  Acceptable given the low edit frequency; future work could add a length
  equality check.
