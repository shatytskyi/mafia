# External Mafia rule sources

Snapshots of public Mafia rulebooks collected on 2026-04-19 to inform design
decisions in this app. Each file is a near-verbatim extract (or faithful
summary) of the source as of that date — not a rewriting.

All sources are public pages. No account/paywall data.

## Files

| File | Source | Why kept |
|------|--------|----------|
| `wikipedia-ru.md` | https://ru.wikipedia.org/wiki/Мафия_(игра) | Canonical summary + sport-Mafia rules (FIIM). |
| `wikipedia-en.md` | https://en.wikipedia.org/wiki/Mafia_(party_game) | Original-Davidoff context; English-language role terminology. |
| `mafiasyndicate-ru.md` | https://www.mafiasyndicate.ru/pravila-igry-v-mafiyu | Most detailed **городская мафия** ruleset that matches our app's role set. |
| `polemicagame-roles.md` | https://polemicagame.com/role | Per-role page; useful for special-role variants (детектив, адвокат, камикадзе, …). |
| `lifehacker-ru.md` | https://lifehacker.ru/kak-igrat-v-mafiyu/ | Popular-audience ruleset; closest match to how most Russian players actually play at parties. |
| `mafiapiter-ru.md` | https://mafiapiter.net/mafia | Питерская мафия: extended role catalog. |
| `bunkermafia-ru.md` | https://bunkermafia.ru/pravila/ | Клуб «Бункер»: concise flow, explicit maniac ordering. |

## Resolved design questions

### Does the Maniac act on the first night?

**Yes, in every variant that includes the Maniac.**

- Lifehacker (ru): «Маньяк … просыпается последним, сам выбирает жертву». No
  first-night carve-out.
- mafiasyndicate: «Каждую ночь может «убить» одного игрока» — explicit «каждую
  ночь», no exclusion.
- Бункер: Maniac wakes *after* Sheriff and Doctor, «впервые просыпается» on
  night 1.
- Питерская: Maniac «просыпается ночью и выбирает, кого убить» — no exclusion.
- Сportivная Mafia (FIIM): no Maniac role at all.

Contrast with **Mafia**, which is universally silent on night 1 in these
sources (they all use the «мафия знакомится, но не стреляет» pattern).

→ Our app's `resolveNight` already does the right thing (Maniac not gated by
  `isFirstNight`). The bug is **only** in the day-1 narration that hardcoded
  "все живы".

### Sheriff-sees-Maniac rule (for reference)

- Lifehacker: «При проверке комиссаром показывается как мирный житель» — the
  Maniac reads as NOT mafia to the Sheriff.
- mafiasyndicate: ambiguous — default varies by club.
- Our app: the Sheriff/Don checks are host-verbal (no picker, no result
  banner). The host looks the role up in the roster and signals the answer
  by hand. Our canonical stance in the user-facing rules is "Maniac reads as
  NOT mafia" (Lifehacker-aligned); clubs that prefer another variant can
  simply signal differently — nothing in the app enforces the reading.

### Doctor heals from Maniac?

- Lifehacker: «Убитого [маньяком] не может вылечить доктор» — **no**.
- mafiasyndicate: «Доктор лечит только от выстрелов мафии, от маньяка
  вылечить … не удастся» — **no**.
- Our app: doctor DOES heal from maniac (`resolveNight` treats them
  symmetrically).

This is a conscious deviation; see `docs/game-rules.md` §4 for our chosen
semantics. Not changing here — just logged.

### Whore (Путана) visiting mafia: dies or survives?

- mafiasyndicate: not explicit (alibi-only).
- Lifehacker: no whore-death mention.
- Питерская: no equivalent role (uses Любовница with different semantics).

Our app exposes both as `gameOptions.whoreDiesAtMafia` (true/false). Default
is false (soft rule). Keep.

## How to use this folder

When a rule-design question comes up ("should X happen in situation Y?"),
read the relevant files here *before* guessing or relying on training data.
If a new source is found, save it as a new file and update this README.
