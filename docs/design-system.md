# Design System — "Theatrical Poster" (Style A)

The visual language introduced in v1.11.0. Mobile-first editorial noir — Abril Fatface display type, cream-paper ground, vermillion as a typographic weapon. Use this doc to stay consistent when adding or editing UI.

Source of truth for tokens lives in [`src/styles.css`](../src/styles.css) (`:root` + `[data-theme='dark']`). This file explains the *why* behind it.

---

## Principles

1. **Red is a weapon, not a wash.** Use `--red` only for CTAs, selection markers, a single accent letter, phase-badges, or the §-numeral. Never as a decorative gradient, hero background, or card fill.
2. **Typography carries the drama.** Abril Fatface display at 44–104 px is the hero. Everything else (UI/body) is Archivo 400/500/700/800. Mono (JetBrains Mono) is reserved for meta, section numbers (`§ 01`), step numbers (`№ 4 / 7`) and timing readouts.
3. **No color emoji.** Every glyph is a single-color typographic mark. Mafia fleur-de-lis (⚜), night (☾), day (☀), vote (⚖), sheriff (✦), doctor (✚), don (♛), maniac (☠), whore (❀), veteran (⛨), kill/target/check-on (✕), check-ok (✓).
4. **Touch targets ≥ 48 px. Body ≥ 15 px. Meta ≥ 11 px.** If text doesn't fit, shorten the copy — don't shrink the type.
5. **Sticky contract.** Each screen is three layers: sticky-top app bar (54 px, fixed), scrollable content, optional sticky-top-secondary (host nav) or inline CTA. Bottom of host screens uses `.nav-row-sticky` pinned under the bar.
6. **Motion is editorial, not playful.** Short ease-out arrivals, a single overshoot on card flips. All animations honor `prefers-reduced-motion`.

---

## Tokens

Declared on `:root` (light) and `:root[data-theme='dark']`.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#f4efe7` | `#0e0b0a` | Page / app bar background |
| `--paper` | `#faf6ed` | `#181513` | Card surfaces (resume, step-card, blocked, resolve) |
| `--ink` | `#0f0d0c` | `#f4efe7` | Primary text |
| `--ink-2` | `#2a2621` | `#d9d2c4` | Secondary text (descriptions, italic body) |
| `--dim` | `#6b6458` | `#9a9184` | Meta, captions, placeholders |
| `--red` | `#c8102e` | `#ef4b60` | CTA fill, accent letter, selected state, §-numeral |
| `--red-hot` | `#ff2e49` | `#ff7a8d` | Pulse peak on timer warning |
| `--red-ink` | `#8c0c20` | `#ff6b7e` | Red used as small text (warnings, `caution` timer) |
| `--line` | `rgba(15,13,12,.22)` | `rgba(244,239,231,.22)` | Hairline borders, section rules |
| `--line-soft` | `rgba(15,13,12,.10)` | `rgba(244,239,231,.10)` | Row dividers inside cards |
| `--overlay` | `rgba(15,13,12,.06)` | `rgba(244,239,231,.06)` | Selected-row tint on target lists |

**Font stacks**

```css
--font-display: 'Abril Fatface', Georgia, serif;
--font-sans:    'Archivo', 'Inter', -apple-system, system-ui, sans-serif;
--font-mono:    'JetBrains Mono', 'Noto Sans Symbols 2', ui-monospace, monospace;
--font-symbols: 'Noto Sans Symbols 2', 'Segoe UI Symbol', 'Apple Symbols';
```

Noto Sans Symbols 2 is the fallback for rare glyphs (⛨ ❀ ☠ ♛) that system fonts render inconsistently on Android/Windows.

---

## Type scale

| Role | Font | Size / leading / tracking | Used for |
|---|---|---|---|
| `hero`       | Abril Fatface | `clamp(64px, 22vw, 104px)` / `0.86` / `-0.025em` | Home title, verdict |
| `h1 (step)`  | Abril Fatface | 38 px / `0.98` / `-0.02em` | Host phase-title |
| `h2 (card)`  | Abril Fatface | 48 px / `0.9` / `-0.025em` | Role-card title |
| `display-italic` | Abril Fatface *italic* | 17–22 px / `1.3`–`1.45` | Host-says, role-desc, subtitles, hints |
| `list-display` | Abril Fatface | 19–24 px / `1.1` | Names in target/roster lists |
| `label`     | Archivo 700 | 11–14 px / 1 / `0.2em` uppercase | Buttons, section labels, roles on roster |
| `body`      | Archivo 400/500 | 13–15 px / `1.45`–`1.55` | Descriptions, hints, paragraphs in rules |
| `meta/mono` | JetBrains Mono 500 | 11–13 px / 1 / `0.22em` uppercase | Ornament, §, №, numeric meta, player-num |
| `numeric/timer` | Archivo 800 | 64 px / 1 / `-0.02em` tabular-nums | Timer display |

Always use `font-variant-numeric: tabular-nums` for timers and counters so digits don't wiggle.

---

## Iconography

| Glyph | Codepoint | Use |
|---|---|---|
| ⚜ | U+269C | Mafia / Don (consider inline SVG fallback on Android) |
| ☾ | U+263E | Night phase-badge |
| ☀ | U+2600 | Dawn / day phase-badge |
| ⚖ | U+2696 | Vote phase-badge |
| ◐ / ◑ | U+25D0/D1 | Theme toggle (inverse of current theme) |
| ✦ | U+2726 | Sheriff (check glyph in resolve/history) |
| ♛ | U+265B | Don (as role badge) |
| ✚ | U+271A | Doctor (save) |
| ❀ | U+2740 | Whore (block) |
| ⛨ | U+26E8 | Veteran (shield/strike) |
| ☠ | U+2620 | Maniac |
| ✕ / ✓ | U+2715 / U+2713 | Kill-target / selected-checkbox ON / affirmative |
| § / № | — | Section / step numbering |
| ← → ▶ ■ | — | Back / forward / timer controls |

**Rule:** single colour (`currentColor` or `var(--red)`), single weight, size through `font-size`. Never mix color emoji in.

---

## Layout

- **App bar:** fixed top, 54 px, `--bg` with `1px` bottom border. Wordmark on the left, language chips + theme on the right.
- **Screen container:** `max-width: 520px`, centered, padded `20px`. The phone is the primary target.
- **Host step header:** phase-badge + phase-title inside `.host-header`, separated from step-card by hairline.
- **Sticky nav:** `.nav-row-sticky` pins under the app bar (`top: var(--bar-h)`). Left half = Back (ghost), right 2/3 = Next (red, Abril).
- **Cards:** always `1px solid var(--line)` on `--paper`, no shadow. Card padding `14–18 px`.

---

## Component catalogue

### Buttons

- `.btn-primary` — red fill, white text, Abril 22 px left-aligned, red → arrow via `::after`. `min-height: 60px`. **Don't** put trailing arrows in copy — the pseudo-element adds it. When the button lives inside `.resume-card`, arrow is suppressed and the button becomes an inverted ink chip.
- `.btn-secondary` — outlined, Archivo 13 px `0.2em` uppercase. `min-height: 52px`.
- `.btn-ghost` — dim outlined, Archivo 12 px uppercase. For destructive / low-priority actions (end game, back to home).
- `.nav-btn.primary` — used in sticky nav rows; red, Abril 20 px, no auto arrow.

### Section head

```html
<div class="section-head">
  <span class="num">§ 01</span>
  <span class="label">ИГРОКОВ ЗА СТОЛОМ</span>
  <span class="line"></span>
</div>
```

### Step card

```html
<div class="step-card">
  <div class="step-num">ШАГ 1 / 6</div>
  <div class="step-title">ВЕДУЩИЙ ГОВОРИТ</div>
  <div class="step-say">Город засыпает. Все закрывают глаза.</div>
  <div class="step-hint">Дождись полной тишины.</div>
</div>
```

`::before` on `.step-say` injects a red 60 px «; `::before` on `.step-hint` injects the `СОВЕТ` kicker — **don't** write either into the HTML.

### Target list (rows, not chips)

```html
<div class="target-grid a-stagger">
  <button class="target-chip selected">
    <span class="chip-num">02</span>
    <span class="chip-name">Борис</span>
  </button>
  …
</div>
<button class="target-skip">Мафия не договорилась</button>
```

Selected row: soft overlay bg + red text, "`✕ ЦЕЛЬ`" injected via `::after`.

### Role card (deal screen)

Two-face flipper. Back face is `--ink` with red `?` centred. Front face is `--paper` with:
`kicker (mono red)` → `role-emblem (Abril 42, red)` → `role-title (Abril 48)` → red divider → `role-desc (Abril italic 16, --ink-2)` → optional team list.

### Phase badge

Border-outlined pill, mono 11 px `0.22em` red uppercase, glyph span on the left. Only one phase is active at a time.

### Resolve / private summary

Lines keyed by role glyph, Abril 17 body. Dead-by-mafia line is `--red`, saves are `--ink`, notes are italic `--ink-2`. The host reads only the top `.a-ink-sweep` paragraph aloud; the resolve card is host-only.

### Verdict (game over)

`.verdict` uses hero sizing (`clamp(60px, 18vw, 84px)`, leading `0.88`). For the two-line layout put a `<br>` and a red `<span>` after it — the second line goes red for `city-wins`, the whole block goes red for `mafia-wins`/`maniac-wins`.

---

## Motion library

All class names prefixed `a-`. Defined once in `styles.css`; apply with `className`.

| Class | Duration | Where |
|---|---|---|
| `a-fade-up` + `.d1`–`.d5` | 520 ms out | Default container entry, cascading delays 80→400 ms |
| `a-ink-sweep` | 680 ms | Hero titles, public "city wakes" paragraph |
| `a-scale-in` | 380 ms overshoot | Card-back mount |
| `a-flip-in` | 680 ms | Role-card reveal (unused in current deal — flipper uses `transform` transition) |
| `a-shake` | 460 ms | Blocked-confirm card |
| `a-pulse-red` | 1.1 s loop | Timer ≤ 5 s |
| `a-badge-blink` | 1.4 s loop | "Timer running" indicators |
| `a-stagger > *` | 460 ms, +50 ms each | Target lists, roster, name inputs |
| `a-strike-line` | 600 ms | Strike-through on killed name in dawn paragraph |

Respected by `@media (prefers-reduced-motion: reduce)` — all the above are disabled. Don't add new animations without adding them to the reduce block.

---

## Do / Don't

**Do**

- Use `§`, `№`, `·` as typographic punctuation — they set the "playbill" tone.
- Keep copy short enough that button text doesn't wrap. On primary CTAs the auto-arrow eats ~42 px of right space.
- Pair an Abril italic subtitle with every hero. Italic at 1.35 leading reads as "voice over".
- Tint an accent letter (usually «и», «и», «a») of a word red instead of colouring the whole word.

**Don't**

- Don't introduce a second accent colour. If something needs more emphasis, use weight or size.
- Don't put emoji in i18n strings. The typographic glyph table above is exhaustive.
- Don't write `💡` / `⟳` / trailing `→` into button copy — pseudo-elements already supply the arrow.
- Don't nest `.screen` inside `.screen`. Each registered screen is one top-level `.screen` element.
- Don't bump `mafia.game.v1` save format without a migration path.

---

## Handoff context

Original design bundle: `Mafia Redesign A.html` (Claude Design export, April 2026). The prototypes live outside the repo — this doc is the portable version of what was built. If you ever need to redraw the system, the spec summary is:

> Plakatnaya typography in cream-paper noir. Abril Fatface carries the drama, vermillion cuts like an editor's pencil, Archivo holds navigation. Mobile-first, min 15px body, 48px touch targets.
