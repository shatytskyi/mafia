const STORAGE_KEY_GAME = 'mafia.game.v1';
const STORAGE_KEY_THEME = 'mafia.theme';
const SAVE_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * @param {Storage} [storage]
 */
function safeStorage(storage) {
  const s = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  return {
    get(key) {
      try { return s ? s.getItem(key) : null; } catch (e) { return null; }
    },
    set(key, val) {
      try { if (s) s.setItem(key, val); } catch (e) { /* quota/private mode */ }
    },
    remove(key) {
      try { if (s) s.removeItem(key); } catch (e) { /* noop */ }
    }
  };
}

export function createPersistence(storage) {
  const st = safeStorage(storage);

  return {
    saveTheme(theme) { st.set(STORAGE_KEY_THEME, theme); },

    loadTheme() {
      const t = st.get(STORAGE_KEY_THEME);
      return (t === 'dark' || t === 'light') ? t : null;
    },

    saveSnapshot(snapshot) {
      try { st.set(STORAGE_KEY_GAME, JSON.stringify(snapshot)); }
      catch (e) { /* ignore */ }
    },

    loadSnapshot() {
      const raw = st.get(STORAGE_KEY_GAME);
      if (!raw) return null;
      try {
        const data = JSON.parse(raw);
        if (!data || !data.ts) return null;
        if (Date.now() - data.ts > SAVE_TTL_MS) {
          st.remove(STORAGE_KEY_GAME);
          return null;
        }
        return data;
      } catch (e) {
        st.remove(STORAGE_KEY_GAME);
        return null;
      }
    },

    clearSnapshot() { st.remove(STORAGE_KEY_GAME); },

    SAVE_TTL_MS
  };
}

/**
 * Builds the snapshot payload to persist. Callers pass the live state.
 */
export function buildSnapshot(state) {
  return {
    ts: Date.now(),
    playerCount: state.playerCount,
    optionalRoles: state.optionalRoles,
    gameOptions: state.gameOptions,
    players: state.players,
    day: state.day,
    phase: state.phase,
    stepIndex: state.stepIndex,
    night: state.night,
    doctorHistory: state.doctorHistory,
    doctorSelfUsed: state.doctorSelfUsed,
    whoreHistory: state.whoreHistory,
    dayVoteKilled: state.dayVoteKilled,
    winner: state.winner || null
  };
}

export function applySnapshotToState(state, data) {
  state.playerCount = data.playerCount;
  state.optionalRoles = data.optionalRoles;
  if (data.gameOptions) {
    state.gameOptions = Object.assign({}, state.gameOptions, data.gameOptions);
  }
  state.players = data.players;
  state.day = data.day;
  state.phase = data.phase;
  state.stepIndex = data.stepIndex;
  state.night = data.night || {
    mafiaTarget: null, donCheck: null, whoreTarget: null,
    doctorTarget: null, sheriffCheck: null, maniacTarget: null,
    resolved: null, applied: false
  };
  state.doctorHistory = data.doctorHistory || [];
  state.doctorSelfUsed = !!data.doctorSelfUsed;
  state.whoreHistory = data.whoreHistory || [];
  state.dayVoteKilled = data.dayVoteKilled != null ? data.dayVoteKilled : null;
  state.winner = data.winner || null;
  state.screen = state.winner ? 'gameover' : 'host';
}

export function formatSavedAgo(ts) {
  const diff = Math.max(0, Date.now() - ts);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'только что';
  if (mins < 60) return `${mins} мин назад`;
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  return `${hours} ч ${rest} мин назад`;
}

export function savedGameDescription(data) {
  const alive = data.players.filter(p => p.alive).length;
  const phase = { night: 'Ночь', day: 'День', vote: 'Голосование' }[data.phase] || '';
  return `${phase} · День ${data.day} · Живых ${alive}/${data.players.length}`;
}
