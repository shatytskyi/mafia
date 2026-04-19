import { t } from '../i18n/index.js';
import { emptyNight } from './state.js';

const STORAGE_KEY_GAME = 'mafia.game.v1';
const STORAGE_KEY_THEME = 'mafia.theme';
const STORAGE_KEY_LOCALE = 'mafia.locale';
const SAVE_TTL_MS = 24 * 60 * 60 * 1000;

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
      const v = st.get(STORAGE_KEY_THEME);
      return (v === 'dark' || v === 'light') ? v : null;
    },

    saveLocale(locale) { st.set(STORAGE_KEY_LOCALE, locale); },

    loadLocale() {
      const v = st.get(STORAGE_KEY_LOCALE);
      return (v === 'ru' || v === 'uk' || v === 'en') ? v : null;
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
    screen: state.screen,
    playerCount: state.playerCount,
    optionalRoles: state.optionalRoles,
    gameOptions: state.gameOptions,
    players: state.players,
    dealIndex: state.dealIndex,
    dealPhase: state.dealPhase,
    day: state.day,
    phase: state.phase,
    stepIndex: state.stepIndex,
    night: state.night,
    doctorHistory: state.doctorHistory,
    doctorSelfUsed: state.doctorSelfUsed,
    whoreHistory: state.whoreHistory,
    veteranHealUsed: !!state.veteranHealUsed,
    veteranKillUsed: !!state.veteranKillUsed,
    nightLog: state.nightLog,
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
  state.dealIndex = data.dealIndex != null ? data.dealIndex : 0;
  state.dealPhase = data.dealPhase || 'await';
  state.day = data.day;
  state.phase = data.phase;
  state.stepIndex = data.stepIndex;
  state.night = data.night || emptyNight();
  state.doctorHistory = data.doctorHistory || [];
  state.doctorSelfUsed = !!data.doctorSelfUsed;
  state.whoreHistory = data.whoreHistory || [];
  state.veteranHealUsed = !!data.veteranHealUsed;
  state.veteranKillUsed = !!data.veteranKillUsed;
  state.nightLog = data.nightLog || [];
  state.dayVoteKilled = data.dayVoteKilled != null ? data.dayVoteKilled : null;
  state.winner = data.winner || null;
  if (state.winner) {
    state.screen = 'gameover';
  } else if (data.screen === 'deal') {
    state.screen = 'deal';
  } else {
    state.screen = 'host';
  }
}

export function formatSavedAgo(ts) {
  const diff = Math.max(0, Date.now() - ts);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('resume.justNow');
  if (mins < 60) return t('resume.minAgo', { n: mins });
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  return t('resume.hourMinAgo', { h: hours, m: rest });
}

export function savedGameDescription(data) {
  if (data.screen === 'deal') {
    return t('resume.descriptionDeal', {
      current: (data.dealIndex || 0) + 1,
      total: data.players.length
    });
  }
  const alive = data.players.filter(p => p.alive).length;
  const phase = t(`phases.${data.phase}`) || '';
  return t('resume.description', { phase, day: data.day, alive, total: data.players.length });
}
