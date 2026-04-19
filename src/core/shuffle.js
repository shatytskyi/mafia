/**
 * Fisher-Yates shuffle. Pure; does not mutate input.
 * @template T
 * @param {T[]} arr
 * @param {() => number} [rng] - RNG returning [0, 1). Defaults to Math.random.
 * @returns {T[]}
 */
export function shuffle(arr, rng = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
