import { shuffle } from './core/shuffle.js';
import { ROLES, isMafiaRole, getRole, getMafiaNames } from './core/roles.js';
import { calcRoleDistribution, canEnableRole, isRoleEffective, dealRoles } from './core/distribution.js';
import { resolveNight, applyNightResolution, canDoctorHeal, canWhoreGo, getWhoreBlocks } from './core/night.js';
import { checkWinCondition } from './core/win.js';

// ============================================================
// STATE
// ============================================================
const state = {
  screen: 'home',
  playerCount: 8,
  optionalRoles: { don: true, doctor: true, maniac: false, whore: false },
  // Варианты правил, которые можно переключить (не сами роли, а их поведение).
  // Эти опции привязаны к конкретным ролям и показываются в их карточке
  // на главном экране, когда роль включена.
  gameOptions: {
    // Маньяк: когда Шериф видит его как «мафию»:
    //   'never'       — никогда; Шериф всегда видит Маньяка как «не мафию»
    //   'afterMafia'  — только после гибели всей мафии (классическая городская мафия)
    //   'always'      — Шериф всегда видит Маньяка как мафию (упрощённая версия)
    sheriffSeesManiac: 'afterMafia',
    // Путана: умирает ли, придя к мафии:
    //   true  — умирает (жёсткая классика)
    //   false — остаётся жива, но блокирует голос этого мафиози (мягкая версия)
    whoreDiesAtMafia: false
  },
  players: [],         // [{name, role, alive}]
  dealIndex: 0,        // current player getting role
  dealPhase: 'await',  // 'await' | 'shown'
  // host state
  day: 1,
  phase: 'night',      // 'night' | 'day' | 'vote'
  stepIndex: 0,
  timer: { seconds: 60, running: false, interval: null },
  theme: 'light',      // 'light' | 'dark'

  // ==== Выборы на ТЕКУЩЕЙ ночи ====
  // null — ещё не выбрано, -1 — «пропустить/никого», число — индекс игрока в state.players
  night: {
    mafiaTarget: null,
    donCheck: null,
    whoreTarget: null,
    doctorTarget: null,
    sheriffCheck: null,
    maniacTarget: null,
    // Результат резолва (заполняется на шаге «Итог ночи»)
    resolved: null
  },

  // ==== История для проверки ограничений ====
  doctorHistory: [],   // массив индексов целей доктора по ночам (для «не два раза подряд»)
  doctorSelfUsed: false, // уже лечил ли себя
  whoreHistory: [],    // история Путаны (для «не два раза подряд»)

  // ==== Результаты дня ====
  // Казнённый этим днём (для голосования). null — никто, число — индекс.
  dayVoteKilled: null
};

// Создаёт чистый объект ночи (вызывается при переходе на новую ночь).
function resetNightSelections() {
  state.night = {
    mafiaTarget: null,
    donCheck: null,
    whoreTarget: null,
    doctorTarget: null,
    sheriffCheck: null,
    maniacTarget: null,
    resolved: null,
    applied: false
  };
  state.dayVoteKilled = null;
}

// Применяет тему (CSS-атрибут на <html>).
function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme === 'dark' ? 'dark' : 'light');
}

function toggleTheme() {
  state.theme = state.theme === 'light' ? 'dark' : 'light';
  applyTheme();
  saveTheme();
  render();
}

// ============================================================
// PERSISTENCE (localStorage)
// ============================================================
const STORAGE_KEY_GAME = 'mafia.game.v1';
const STORAGE_KEY_THEME = 'mafia.theme';
// Сколько времени хранить сохранённую игру (дольше — не будит предлагать восстановление)
const SAVE_TTL_MS = 6 * 60 * 60 * 1000; // 6 часов

// Безопасный доступ к localStorage — в некоторых режимах (incognito Safari)
// localStorage может быть недоступен или кидать ошибку.
function storageGet(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}
function storageSet(key, val) {
  try { localStorage.setItem(key, val); } catch (e) { /* quota/private mode */ }
}
function storageRemove(key) {
  try { localStorage.removeItem(key); } catch (e) {}
}

// Сохраняем тему отдельно — её надо применить до загрузки игры.
function saveTheme() {
  storageSet(STORAGE_KEY_THEME, state.theme);
}
function loadTheme() {
  const t = storageGet(STORAGE_KEY_THEME);
  if (t === 'dark' || t === 'light') state.theme = t;
}

// Сохраняем игру (только host-фазу — раздачу восстанавливать не будем).
let _saveTimer = null;
function saveGame() {
  // Не сохраняем если игра не началась (на home/rules/names/deal/gameover)
  if (state.screen !== 'host') return;
  // Debounce — чтобы не писать на каждый чих
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(doSaveGame, 300);
}

function doSaveGame() {
  const snapshot = {
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
  try {
    storageSet(STORAGE_KEY_GAME, JSON.stringify(snapshot));
  } catch (e) { /* ignore */ }
}

// Возвращает сохранённую игру, если она есть и свежая. Иначе null.
function loadGame() {
  const raw = storageGet(STORAGE_KEY_GAME);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (!data || !data.ts) return null;
    if (Date.now() - data.ts > SAVE_TTL_MS) {
      storageRemove(STORAGE_KEY_GAME);
      return null;
    }
    return data;
  } catch (e) {
    storageRemove(STORAGE_KEY_GAME);
    return null;
  }
}

// Применяет сохранённую игру в state и открывает host-экран.
function restoreGame(data) {
  state.playerCount = data.playerCount;
  state.optionalRoles = data.optionalRoles;
  // gameOptions могут отсутствовать в старых сохранениях — используем дефолт
  if (data.gameOptions) {
    state.gameOptions = Object.assign({}, state.gameOptions, data.gameOptions);
  }
  state.players = data.players;
  state.day = data.day;
  state.phase = data.phase;
  state.stepIndex = data.stepIndex;
  state.night = data.night || { mafiaTarget: null, donCheck: null, whoreTarget: null, doctorTarget: null, sheriffCheck: null, maniacTarget: null, resolved: null, applied: false };
  state.doctorHistory = data.doctorHistory || [];
  state.doctorSelfUsed = !!data.doctorSelfUsed;
  state.whoreHistory = data.whoreHistory || [];
  state.dayVoteKilled = data.dayVoteKilled != null ? data.dayVoteKilled : null;
  state.winner = data.winner || null;
  state.screen = state.winner ? 'gameover' : 'host';
}

// Удаляет сохранённую игру.
function clearSavedGame() {
  storageRemove(STORAGE_KEY_GAME);
}

// Человеко-читаемое «когда сохранено»
function formatSavedAgo(ts) {
  const diff = Math.max(0, Date.now() - ts);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'только что';
  if (mins < 60) return `${mins} мин назад`;
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  return `${hours} ч ${rest} мин назад`;
}

// Краткое описание сохранённой игры для плашки "Продолжить"
function savedGameDescription(data) {
  const alive = data.players.filter(p => p.alive).length;
  const phase = { night: 'Ночь', day: 'День', vote: 'Голосование' }[data.phase] || '';
  return `${phase} · День ${data.day} · Живых ${alive}/${data.players.length}`;
}

// ============================================================
// HELPERS
// ============================================================


let _lastScreen = null;
let _lastDealKey = null;
function render() {
  const app = document.getElementById('app');
  const screenChanged = _lastScreen !== state.screen;
  // Для экрана раздачи ролей также анимируем смену игрока и фазы (await↔shown)
  const dealKey = state.screen === 'deal' ? `${state.dealIndex}:${state.dealPhase}` : null;
  const dealChanged = dealKey !== null && _lastDealKey !== dealKey;

  app.innerHTML = '';
  if (state.screen === 'home') renderHome();
  else if (state.screen === 'names') renderNames();
  else if (state.screen === 'deal') renderDeal();
  else if (state.screen === 'host') renderHost();
  else if (state.screen === 'gameover') renderGameOver();
  else if (state.screen === 'rules') renderRules();
  updateThemeIcon();

  // Анимация появления — при смене экрана, либо при смене игрока/фазы на экране раздачи.
  // Без этого весь host-экран мерцает на каждый шаг/тап.
  if (screenChanged || dealChanged) {
    _lastScreen = state.screen;
    _lastDealKey = dealKey;
    const firstChild = app.firstElementChild;
    if (firstChild) {
      firstChild.classList.add('screen-enter');
    }
    if (screenChanged) window.scrollTo(0, 0);
  }

  // Сохраняем состояние игры (debounced, только если на host-экране).
  saveGame();
  // Сохранённую игру чистим когда вышли на главную
  if (state.screen === 'home') clearSavedGame();
}

// Обновляет иконку переключателя темы.
function updateThemeIcon() {
  const icon = document.getElementById('themeIcon');
  if (icon) icon.textContent = state.theme === 'light' ? '☾' : '☀';
}

// ============================================================
// HOME SCREEN
// ============================================================
function renderHome() {
  const dist = calcRoleDistribution({ playerCount: state.playerCount, optionalRoles: state.optionalRoles });
  const app = document.getElementById('app');
  const saved = loadGame();

  const resumeBlock = saved ? `
    <div class="resume-card">
      <div class="resume-head">
        <span class="resume-kicker">⟳ Сохранённая партия</span>
        <span class="resume-time">${formatSavedAgo(saved.ts)}</span>
      </div>
      <div class="resume-desc">${savedGameDescription(saved)}</div>
      <div class="resume-btns">
        <button class="btn-primary" id="resumeBtn">Продолжить →</button>
        <button class="btn-ghost" id="discardSavedBtn">Удалить</button>
      </div>
    </div>
  ` : '';

  app.innerHTML = `
    <div class="screen">
      <div class="home-header">
        <div class="ornament"><span>C O S A · N O S T R A</span></div>
        <div class="hero-wrap">
          <div class="year">Est. 1986</div>
          <h1 class="hero">Мафия<em>in famiglia</em></h1>
        </div>
        <div class="tag">
          <p class="subtitle">Город засыпает —<br>просыпается мафия</p>
        </div>
      </div>

      ${resumeBlock}

      <div class="section">
        <div class="section-head">
          <span class="num">01 /</span>
          <span class="label">Игроков за столом</span>
          <span class="line"></span>
        </div>
        <div class="counter">
          <button class="counter-btn" id="minusBtn" ${state.playerCount <= 4 ? 'disabled' : ''}>−</button>
          <div>
            <div class="counter-num">${state.playerCount}</div>
            <div class="counter-label">человек</div>
          </div>
          <button class="counter-btn" id="plusBtn" ${state.playerCount >= 20 ? 'disabled' : ''}>+</button>
        </div>
      </div>

      <div class="section">
        <div class="section-head">
          <span class="num">02 /</span>
          <span class="label">Расклад ролей</span>
          <span class="line"></span>
        </div>
        <div class="role-dist">
          <div class="cell">
            <div class="dot mafia"></div>
            <div class="txt"><div class="role-name">Мафия</div></div>
            <div class="role-count">×${dist.mafia}</div>
          </div>
          ${dist.don ? `
          <div class="cell">
            <div class="dot don"></div>
            <div class="txt"><div class="role-name">Дон</div></div>
            <div class="role-count">×${dist.don}</div>
          </div>` : ''}
          <div class="cell">
            <div class="dot sheriff"></div>
            <div class="txt"><div class="role-name">Шериф</div></div>
            <div class="role-count">×${dist.sheriff}</div>
          </div>
          ${dist.doctor ? `
          <div class="cell">
            <div class="dot doctor"></div>
            <div class="txt"><div class="role-name">Доктор</div></div>
            <div class="role-count">×${dist.doctor}</div>
          </div>` : ''}
          ${dist.maniac ? `
          <div class="cell">
            <div class="dot maniac"></div>
            <div class="txt"><div class="role-name">Маньяк</div></div>
            <div class="role-count">×${dist.maniac}</div>
          </div>` : ''}
          ${dist.whore ? `
          <div class="cell">
            <div class="dot whore"></div>
            <div class="txt"><div class="role-name">Путана</div></div>
            <div class="role-count">×${dist.whore}</div>
          </div>` : ''}
          <div class="cell">
            <div class="dot civilian"></div>
            <div class="txt"><div class="role-name">Мирные</div></div>
            <div class="role-count">×${dist.civilian}</div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-head">
          <span class="num">03 /</span>
          <span class="label">Дополнительные роли</span>
          <span class="line"></span>
        </div>
        ${renderRoleToggle('don', '♛ Дон Мафии', 'Проверяет Шерифа ночью. Минимум 6 игроков.')}
        ${renderRoleToggle('doctor', '✚ Доктор', 'Лечит одного игрока за ночь.')}
        ${renderRoleToggle('maniac', '☠ Маньяк', 'Одиночка. Убивает сам за себя. Минимум 8 игроков.')}
        ${renderRoleToggle('whore', '❀ Путана', 'Блокирует ночные способности. Минимум 8 игроков.')}
      </div>

      <button class="btn-primary" id="startBtn">Раздать роли →</button>
      <div style="height: 12px;"></div>
      <button class="btn-secondary" id="rulesBtn">Правила игры</button>
    </div>
  `;

  document.getElementById('minusBtn').onclick = () => {
    if (state.playerCount > 4) { state.playerCount--; validateRoles(); render(); }
  };
  document.getElementById('plusBtn').onclick = () => {
    if (state.playerCount < 20) { state.playerCount++; validateRoles(); render(); }
  };
  document.getElementById('startBtn').onclick = () => {
    state.screen = 'names';
    render();
  };
  document.getElementById('rulesBtn').onclick = () => {
    state.screen = 'rules';
    render();
  };

  // Resume / Discard saved game
  const resumeBtn = document.getElementById('resumeBtn');
  if (resumeBtn) {
    resumeBtn.onclick = () => {
      const data = loadGame();
      if (!data) return;
      restoreGame(data);
      render();
    };
  }
  const discardBtn = document.getElementById('discardSavedBtn');
  if (discardBtn) {
    discardBtn.onclick = () => {
      if (confirm('Удалить сохранённую партию?')) {
        clearSavedGame();
        render();
      }
    };
  }

  ['don', 'doctor', 'maniac', 'whore'].forEach(id => {
    const el = document.getElementById(`toggle-${id}`);
    if (!el) return;
    // Клик по верхней части (чекбокс + описание) переключает роль.
    // Клики по подопциям (seg-btn) обрабатываются отдельно и не триггерят toggle.
    const head = el.querySelector('.role-toggle-head');
    if (head) {
      head.onclick = () => {
        if (!canEnableRole(id, state.playerCount)) return;
        state.optionalRoles[id] = !state.optionalRoles[id];
        render();
      };
    }
  });

  // Подопции Маньяка: сегментированный выбор «Шериф видит маньяка»
  document.querySelectorAll('[data-opt-sheriff]').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const mode = btn.dataset.optSheriff;
      if (!state.gameOptions) state.gameOptions = {};
      state.gameOptions.sheriffSeesManiac = mode;
      render();
    };
  });

  // Подопции Путаны: умирает / остаётся жива
  document.querySelectorAll('[data-opt-whore]').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const val = btn.dataset.optWhore;
      if (!state.gameOptions) state.gameOptions = {};
      state.gameOptions.whoreDiesAtMafia = val === 'dies';
      render();
    };
  });
}

function renderRoleToggle(id, name, desc) {
  const active = state.optionalRoles[id];
  const allowed = canEnableRole(id, state.playerCount);
  // Роль включена пользователем, но балансировщик её срезал (мало места для мирных)
  const squeezed = active && allowed && !isRoleEffective(id, { playerCount: state.playerCount, optionalRoles: state.optionalRoles });

  // Подопции для роли (показываются когда роль активна)
  let subOptions = '';
  if (active && allowed) {
    if (id === 'maniac') {
      const mode = (state.gameOptions && state.gameOptions.sheriffSeesManiac) || 'afterMafia';
      subOptions = `
        <div class="role-suboptions" data-role-opt="maniac">
          <div class="suboption-label">Шериф видит Маньяка как мафию</div>
          <div class="suboption-segmented">
            <button class="seg-btn ${mode === 'never' ? 'active' : ''}" data-opt-sheriff="never">Никогда</button>
            <button class="seg-btn ${mode === 'afterMafia' ? 'active' : ''}" data-opt-sheriff="afterMafia">После смерти мафии</button>
            <button class="seg-btn ${mode === 'always' ? 'active' : ''}" data-opt-sheriff="always">Всегда</button>
          </div>
        </div>
      `;
    } else if (id === 'whore') {
      const dies = !!(state.gameOptions && state.gameOptions.whoreDiesAtMafia);
      subOptions = `
        <div class="role-suboptions" data-role-opt="whore">
          <div class="suboption-label">Путана у мафии</div>
          <div class="suboption-segmented">
            <button class="seg-btn ${!dies ? 'active' : ''}" data-opt-whore="alive">Остаётся жива</button>
            <button class="seg-btn ${dies ? 'active' : ''}" data-opt-whore="dies">Погибает</button>
          </div>
        </div>
      `;
    }
  }

  return `
    <div class="role-toggle ${active ? 'active' : ''} ${!allowed ? 'disabled' : ''}" id="toggle-${id}">
      <div class="role-toggle-head">
        <div class="check"></div>
        <div class="info">
          <div class="name">${name}</div>
          <div class="desc">${desc}</div>
          ${!allowed ? `<div class="warn">Нужно минимум ${id === 'don' ? 6 : 8} игроков</div>` : ''}
          ${squeezed ? `<div class="warn">⚠ Не поместится при текущем раскладе — другая роль важнее</div>` : ''}
        </div>
      </div>
      ${subOptions}
    </div>
  `;
}

// Автоматически выключает роли, которые нельзя применить при текущем числе игроков.
function validateRoles() {
  if (!canEnableRole('don', state.playerCount)) state.optionalRoles.don = false;
  if (!canEnableRole('maniac', state.playerCount)) state.optionalRoles.maniac = false;
  if (!canEnableRole('whore', state.playerCount)) state.optionalRoles.whore = false;
}

// ============================================================
// NAMES INPUT
// ============================================================
function renderNames() {
  const app = document.getElementById('app');
  // Initialize players array if not set
  if (state.players.length !== state.playerCount) {
    state.players = Array.from({length: state.playerCount}, (_, i) => ({
      name: '', role: null, alive: true
    }));
  }

  let inputsHtml = '';
  for (let i = 0; i < state.playerCount; i++) {
    const num = String(i+1).padStart(2, '0');
    inputsHtml += `
      <div class="name-input-row">
        <div class="idx">${num}</div>
        <input type="text" data-idx="${i}" value="${state.players[i].name}" 
               placeholder="Игрок ${i+1}" maxlength="20" />
      </div>
    `;
  }

  app.innerHTML = `
    <div class="screen">
      <div class="home-header">
        <div class="ornament"><span>D R A M A T I S · P E R S O N A E</span></div>
        <div class="hero-wrap">
          <h1 class="hero" style="font-size: 48px;">Имена<em>за столом</em></h1>
        </div>
        <p class="subtitle t-center mt-16">Введи имена или оставь стандартные</p>
      </div>

      <div class="name-inputs">
        ${inputsHtml}
      </div>

      <button class="btn-primary" id="confirmNames">Раздать карты →</button>
      <div style="height: 12px;"></div>
      <button class="btn-ghost" id="backHome">← Назад</button>
    </div>
  `;

  document.querySelectorAll('input[data-idx]').forEach(inp => {
    inp.oninput = (e) => {
      const idx = parseInt(e.target.dataset.idx);
      state.players[idx].name = e.target.value;
    };
  });

  document.getElementById('confirmNames').onclick = () => {
    // Fill in empty names
    state.players.forEach((p, i) => {
      if (!p.name.trim()) p.name = `Игрок ${i+1}`;
    });
    state.players = dealRoles(state.players, {
      playerCount: state.playerCount,
      optionalRoles: state.optionalRoles
    });
    state.dealIndex = 0;
    state.dealPhase = 'await';
    state.screen = 'deal';
    render();
  };

  document.getElementById('backHome').onclick = () => {
    state.screen = 'home';
    render();
  };
}

// ============================================================
// ROLE DEAL SCREEN
// ============================================================
function renderDeal() {
  const app = document.getElementById('app');
  const player = state.players[state.dealIndex];
  const num = String(state.dealIndex + 1).padStart(2, '0');
  const total = String(state.playerCount).padStart(2, '0');

  if (state.dealPhase === 'await') {
    app.innerHTML = `
      <div class="deal-screen screen">
        <div class="player-num">Игрок · ${num} / ${total}</div>
        <div class="player-name-big">${player.name}</div>
        <div class="passing-hint">передай телефон этому игроку</div>

        <button class="reveal-btn" id="revealBtn">
          <span>Показать<br>роль</span>
        </button>

        <p class="instruction">
          Убедись, что никто<br>
          не подглядывает за&nbsp;твоим плечом
        </p>
      </div>
    `;

    document.getElementById('revealBtn').onclick = () => {
      state.dealPhase = 'shown';
      render();
    };
  } else {
    // Shown phase - display the role
    const role = ROLES[player.role];
    const isMafiaTeam = player.role === 'mafia' || player.role === 'don';
    const mafiaTeamHtml = isMafiaTeam && getMafiaNames(state.players).length > 1
      ? `
        <div class="team-list">
          <div class="t-label">Твои подельники</div>
          <div class="team-names">${getMafiaNames(state.players).filter(n => n !== player.name).join(' · ')}</div>
        </div>
      ` : '';

    app.innerHTML = `
      <div class="deal-screen screen">
        <div class="role-card">
          <div class="kicker">${player.name}</div>
          <div class="role-emblem">${role.emblem}</div>
          <div class="role-title">${role.name}</div>
          <div class="role-side">${role.side}</div>
          <div class="divider"></div>
          <div class="role-desc">${role.desc}</div>
          ${mafiaTeamHtml}
        </div>

        <button class="btn-primary" id="doneBtn" style="max-width: 380px;">
          ${state.dealIndex < state.playerCount - 1 ? 'Запомнил, передаю дальше →' : 'Начать игру →'}
        </button>
      </div>
    `;

    document.getElementById('doneBtn').onclick = () => {
      if (state.dealIndex < state.playerCount - 1) {
        state.dealIndex++;
        state.dealPhase = 'await';
        render();
      } else {
        // All dealt — go to host screen
        state.screen = 'host';
        state.day = 1;
        state.phase = 'night';
        state.stepIndex = 0;
        // Сбрасываем историю и ночные выборы
        state.doctorHistory = [];
        state.doctorSelfUsed = false;
        state.whoreHistory = [];
        resetNightSelections();
        render();
      }
    };
  }
}

// ============================================================
// HOST SCREEN
// ============================================================
function getNightSteps() {
  const steps = [];
  const hasAlive = (role) => state.players.some(p => p.role === role && p.alive);
  const hasMafia = hasAlive('mafia') || hasAlive('don');
  const isFirstNight = state.day === 1;

  steps.push({
    title: 'Город засыпает',
    say: 'Город засыпает. Все закрывают глаза. Прошу тишины.',
    hint: 'Дождись полной тишины. Попроси игроков закрыть глаза и положить руки на стол — ритмичное постукивание скроет шорохи от активных ролей.'
  });

  // Первая ночь: мафия знакомится (без убийства)
  if (isFirstNight && hasMafia) {
    steps.push({
      title: 'Мафия знакомится',
      cls: 'mafia-action',
      say: 'Мафия, просыпайся. Познакомьтесь друг с другом молча — взглядом и кивком.',
      hint: 'Дай мафиози 10–15 секунд узнать друг друга. В эту ночь мафия НЕ убивает — первого жителя убивают со второй ночи.'
    });
    steps.push({ title: 'Мафия засыпает', say: 'Мафия, закрой глаза.', hint: '' });
  }

  // Путана (ходит первой — блокирует способности)
  if (state.optionalRoles.whore && hasAlive('whore')) {
    steps.push({
      title: 'Путана просыпается',
      cls: 'whore-action',
      say: 'Путана, открой глаза. К кому идёшь этой ночью?',
      hint: 'Выбери цель ниже. Её ночная способность не сработает. Если к мафиози — Путана погибает вместе с ними. Нельзя ходить к одному игроку две ночи подряд.',
      action: {
        type: 'pickTarget',
        field: 'whoreTarget',
        role: 'whore',
        label: 'К кому идёт Путана',
        allowSkip: false,
        validate: (idx) => canWhoreGo(state.players, idx, state.whoreHistory)
      }
    });
    steps.push({ title: 'Путана засыпает', say: 'Путана, закрой глаза.', hint: '' });
  }

  // Мафия убивает (не на первой ночи)
  if (!isFirstNight && hasMafia) {
    const blocks = getWhoreBlocks(state.players, state.night, state.gameOptions);
    if (blocks.mafia) {
      // Всю мафию блокирует Путана — делаем шаг-пустышку, но не пропускаем,
      // чтобы Путана не вычислила по тишине, что она блокировала именно мафию.
      steps.push({
        title: 'Мафия просыпается',
        cls: 'mafia-action',
        say: 'Мафия, просыпайся. Ночью мафия никого не убивает.',
        hint: 'Путана заблокировала мафию — убийства не будет. Просто выдержи паузу, как будто мафия совещается, и нажми «Далее», чтобы никто ничего не заподозрил.',
        action: {
          type: 'blockedAction',
          field: 'mafiaTarget',
          label: 'Мафия не убивает этой ночью',
          confirmLabel: 'Мафия никого не убивает'
        }
      });
    } else {
      steps.push({
        title: 'Мафия просыпается',
        cls: 'mafia-action',
        say: 'Мафия, просыпайся. Жестами выберите жертву.',
        hint: 'Дождись единогласного решения. Если мафия не договорилась — нажми «Мафия не договорилась».',
        action: {
          type: 'pickTarget',
          field: 'mafiaTarget',
          role: 'mafia',
          label: 'Жертва мафии',
          allowSkip: true,
          skipLabel: 'Мафия не договорилась'
        }
      });
    }
  }

  // Дон ищет Шерифа (каждую ночь, включая первую)
  if (state.optionalRoles.don && hasAlive('don')) {
    const blocks = getWhoreBlocks(state.players, state.night, state.gameOptions);
    if (blocks.donCheck) {
      steps.push({
        title: 'Дон ищет Шерифа',
        cls: 'mafia-action',
        say: 'Дон, открой глаза. Этой ночью ты никого не проверяешь.',
        hint: 'Путана заблокировала Дона — его проверка не сработает. Выдержи паузу (как будто Дон думает), покажи любой жест и усыпи, чтобы Путана не догадалась.',
        action: {
          type: 'blockedAction',
          field: 'donCheck',
          label: 'Дон не проверяет этой ночью',
          confirmLabel: 'Дон никого не проверяет'
        }
      });
    } else {
      steps.push({
        title: 'Дон ищет Шерифа',
        cls: 'mafia-action',
        say: 'Дон, укажи, кого проверяешь.',
        hint: 'Выбери цель. Приложение покажет результат — Шериф или нет. Покажи Дону ответ жестом: кивок (да) / покачивание (нет).',
        action: {
          type: 'pickTarget',
          field: 'donCheck',
          role: 'don',
          label: 'Проверка Дона',
          allowSkip: true,
          skipLabel: 'Не проверять',
          showResult: (idx) => {
            const role = getRole(state.players, idx);
            return role === 'sheriff' ? '✓ Это Шериф' : '✗ Не Шериф';
          }
        }
      });
    }
  }

  if (!isFirstNight && hasMafia) {
    steps.push({ title: 'Мафия засыпает', say: 'Мафия, закрой глаза.', hint: '' });
  } else if (isFirstNight && state.optionalRoles.don && hasAlive('don')) {
    steps.push({ title: 'Дон засыпает', say: 'Дон, закрой глаза.', hint: '' });
  }

  // Доктор
  if (state.optionalRoles.doctor && hasAlive('doctor')) {
    const blocks = getWhoreBlocks(state.players, state.night, state.gameOptions);
    if (blocks.doctor) {
      steps.push({
        title: 'Доктор просыпается',
        cls: 'doctor-action',
        say: 'Доктор, просыпайся. Этой ночью ты никого не лечишь.',
        hint: 'Путана заблокировала Доктора — лечение не сработает. Выдержи паузу как обычно и усыпи, чтобы Путана не догадалась.',
        action: {
          type: 'blockedAction',
          field: 'doctorTarget',
          label: 'Доктор не лечит этой ночью',
          confirmLabel: 'Доктор никого не лечит'
        }
      });
    } else {
      steps.push({
        title: 'Доктор просыпается',
        cls: 'doctor-action',
        say: 'Доктор, просыпайся. Кого лечишь этой ночью?',
        hint: 'Ограничения: нельзя лечить одного игрока две ночи подряд; себя — только один раз за игру. Доктор лечит и от мафии, и от маньяка.',
        action: {
          type: 'pickTarget',
          field: 'doctorTarget',
          role: 'doctor',
          label: 'Кого лечит Доктор',
          allowSkip: true,
          skipLabel: 'Не лечить никого',
          validate: (idx) => canDoctorHeal(state.players, idx, state.doctorHistory, state.doctorSelfUsed)
        }
      });
    }
    steps.push({ title: 'Доктор засыпает', say: 'Доктор, закрой глаза.', hint: '' });
  }

  // Шериф
  if (hasAlive('sheriff')) {
    const blocks = getWhoreBlocks(state.players, state.night, state.gameOptions);
    if (blocks.sheriff) {
      steps.push({
        title: 'Шериф просыпается',
        cls: 'sheriff-action',
        say: 'Шериф, просыпайся. Этой ночью ты никого не проверяешь.',
        hint: 'Путана заблокировала Шерифа — его проверка не сработает. Выдержи паузу, покажи любой жест (или ничего) и усыпи. Играй ровно, чтобы Путана не догадалась.',
        action: {
          type: 'blockedAction',
          field: 'sheriffCheck',
          label: 'Шериф не проверяет этой ночью',
          confirmLabel: 'Шериф никого не проверяет'
        }
      });
    } else {
      steps.push({
        title: 'Шериф просыпается',
        cls: 'sheriff-action',
        say: 'Шериф, просыпайся. Кого проверяешь?',
        hint: 'Выбери цель. Приложение покажет результат. Покажи Шерифу жестом: палец вверх — НЕ мафия, вниз — мафия.',
        action: {
          type: 'pickTarget',
          field: 'sheriffCheck',
          role: 'sheriff',
          label: 'Проверка Шерифа',
          allowSkip: true,
          skipLabel: 'Не проверять',
          showResult: (idx) => {
            const role = getRole(state.players, idx);
            let looksLikeMafia = isMafiaRole(role);
            if (!looksLikeMafia && role === 'maniac') {
              const mode = (state.gameOptions && state.gameOptions.sheriffSeesManiac) || 'afterMafia';
              if (mode === 'always') {
                looksLikeMafia = true;
              } else if (mode === 'afterMafia') {
                const mafiaAlive = state.players.some(p => p.alive && isMafiaRole(p.role));
                if (!mafiaAlive) looksLikeMafia = true;
              }
            }
            return looksLikeMafia ? '🔴 МАФИЯ' : '🟢 НЕ МАФИЯ';
          }
        }
      });
    }
    steps.push({ title: 'Шериф засыпает', say: 'Шериф, закрой глаза.', hint: '' });
  }

  // Маньяк
  if (state.optionalRoles.maniac && hasAlive('maniac')) {
    const blocks = getWhoreBlocks(state.players, state.night, state.gameOptions);
    if (blocks.maniac) {
      steps.push({
        title: 'Маньяк просыпается',
        cls: 'maniac-action',
        say: 'Маньяк, открой глаза. Этой ночью ты никого не убиваешь.',
        hint: 'Путана заблокировала Маньяка — он не может убивать. Выдержи паузу и усыпи, чтобы Путана не догадалась.',
        action: {
          type: 'blockedAction',
          field: 'maniacTarget',
          label: 'Маньяк не убивает этой ночью',
          confirmLabel: 'Маньяк никого не убивает'
        }
      });
    } else {
      steps.push({
        title: 'Маньяк просыпается',
        cls: 'maniac-action',
        say: 'Маньяк, открой глаза. Кого убиваешь?',
        hint: 'Доктор лечит и от маньяка.',
        action: {
          type: 'pickTarget',
          field: 'maniacTarget',
          role: 'maniac',
          label: 'Жертва Маньяка',
          allowSkip: true,
          skipLabel: 'Маньяк не убивает'
        }
      });
    }
    steps.push({ title: 'Маньяк засыпает', say: 'Маньяк, закрой глаза.', hint: '' });
  }

  // КРИТИЧЕСКИЙ ШАГ: авторезолв
  steps.push({
    title: 'Итог ночи',
    say: '(про себя) Проверь результат.',
    hint: 'Приложение автоматически подсчитало результат с учётом всех блокировок, лечения и маньяка. Нажми «Далее», чтобы применить смерти и перейти к объявлению.',
    action: { type: 'resolveNight' }
  });

  steps.push({
    title: 'Город просыпается',
    say: 'Город просыпается. Открывайте глаза.',
    hint: 'Объявляй результаты драматично: «Этой ночью на углу улиц...». Если никто не умер — «эта ночь прошла спокойно».'
  });

  return steps;
}

function getDaySteps() {
  const isFirstDay = state.day === 1;
  const steps = [];
  const resolved = state.night.resolved;

  // Первый шаг — динамическая сводка о смертях
  let victimsText = '';
  let victimsSay = '';
  if (isFirstDay) {
    victimsSay = 'Доброе утро, город. Первый день — все живы. Пора знакомиться.';
    victimsText = 'Первый день — смертей нет. Все живы.';
  } else if (resolved && resolved.killed.length === 0) {
    victimsSay = `День ${state.day}. Этой ночью никто не погиб.`;
    victimsText = 'Эта ночь прошла спокойно. Все живы.';
  } else if (resolved && resolved.killed.length > 0) {
    const names = resolved.killed.map(idx => state.players[idx].name).join(', ');
    victimsSay = `День ${state.day}. Этой ночью погиб${resolved.killed.length > 1 ? 'ли' : ''}: ${names}.`;
    victimsText = `Погибшие: ${names}`;
    if (resolved.savedByDoctor != null) {
      const savedName = state.players[resolved.savedByDoctor].name;
      victimsText += `\n(Доктор спас ${savedName})`;
    }
  } else {
    victimsSay = `Наступает день ${state.day}.`;
    victimsText = 'Результаты ночи ещё не подведены.';
  }

  steps.push({
    title: isFirstDay ? 'Утро первого дня' : 'Объявление жертв',
    say: victimsSay,
    hint: isFirstDay
      ? 'Переходи к обсуждению.'
      : 'По классике — погибший может открыть свою роль, но НЕ намекать на убийцу. Дай 30 секунд на последнее слово.',
    timerSeconds: isFirstDay ? null : 30,
    timerLabel: 'Последнее слово погибшего',
    summary: victimsText
  });

  steps.push({
    title: 'Обсуждение',
    say: 'Время обсудить. У каждого минута, чтобы высказаться по кругу.',
    hint: isFirstDay
      ? 'Первый день обычно короткий — игроки почти ничего не знают. Начинайте с любого.'
      : 'Начни с игрока слева от первого умершего. Строго следи за таймингом. Никто не перебивает.',
    timerSeconds: 60,
    timerLabel: 'Минута на игрока'
  });

  steps.push({
    title: 'Выдвижение кандидатов',
    say: 'Кого вы подозреваете? Выдвигайте кандидатов.',
    hint: 'Один игрок выдвигает одного. Сам себя — нельзя. Если никто не выдвинут — голосования не будет, сразу к ночи.'
  });

  steps.push({
    title: 'Последнее слово кандидатов',
    say: 'Каждому кандидату — 30 секунд на оправдание.',
    hint: 'Выступают в порядке выдвижения.',
    timerSeconds: 30,
    timerLabel: '30 секунд на оправдание'
  });

  return steps;
}

function getVoteSteps() {
  return [
    {
      title: 'Голосование',
      say: 'Голосуем. Поднимите руку за того, кого считаете мафией.',
      hint: 'Называй кандидатов по очереди. Каждый голосует ровно один раз, не за себя. Считай голоса вслух.'
    },
    {
      title: 'Разрешение ничьи',
      say: '(если голоса равны) Объявляю переголосование.',
      hint: `Если голоса равны: переголосование между лидерами с последним словом 20 сек. Если снова равенство — никто не уходит ИЛИ все лидеры уходят (решите до игры).`,
      timerSeconds: 20,
      timerLabel: '20 секунд на повторное оправдание'
    },
    {
      title: 'Казнь',
      say: 'Город сделал свой выбор.',
      hint: 'Выбери казнённого ниже или нажми «Никто не уходит». Ему — 30 секунд последнего слова. По классике открывает роль.',
      timerSeconds: 30,
      timerLabel: 'Последнее слово казнённого',
      action: {
        type: 'pickKilled',
        label: 'Кого казнил город',
        allowSkip: true,
        skipLabel: 'Никто не уходит'
      }
    }
  ];
}

function getCurrentSteps() {
  if (state.phase === 'night') return getNightSteps();
  if (state.phase === 'day') return getDaySteps();
  if (state.phase === 'vote') return getVoteSteps();
  return [];
}

// Проверка условий победы.
// Логика:
// — «Мафия» (mafia + don) — одна команда.

function renderHost() {
  const app = document.getElementById('app');

  // Проверяем победу перед рендером.
  const winner = checkWinCondition(state);
  if (winner) {
    state.winner = winner;
    state.screen = 'gameover';
    stopTimer();
    render();
    return;
  }

  const steps = getCurrentSteps();
  if (state.stepIndex >= steps.length) state.stepIndex = steps.length - 1;
  if (state.stepIndex < 0) state.stepIndex = 0;
  const step = steps[state.stepIndex];
  const isLast = state.stepIndex === steps.length - 1;

  const phaseLabel = { night: 'Ночь', day: 'День', vote: 'Голосование' }[state.phase];
  const phaseCls = state.phase;
  const aliveCount = state.players.filter(p => p.alive).length;

  // --- Собираем разметку action/summary ---
  let actionHtml = '';
  let summaryHtml = '';

  if (step.summary) {
    summaryHtml = `
      <div class="step-card" style="border-left-color: var(--blood);">
        <div class="step-title">Результат</div>
        <div class="summary-text">${step.summary.replace(/\n/g, '<br>')}</div>
      </div>
    `;
  }

  if (step.action) {
    actionHtml = renderAction(step.action);
  }

  // Первый шаг игры — первая ночь, день 1
  const isVeryFirstStep = state.stepIndex === 0 && state.phase === 'night' && state.day === 1;

  app.innerHTML = `
    <div class="screen">
      <div class="host-header">
        <div class="phase-badge ${phaseCls}">
          ${state.phase === 'night' ? '🌙' : state.phase === 'day' ? '☀' : '⚖'}
          День ${state.day} · ${phaseLabel}
        </div>
        <div class="phase-title">${step.title}</div>
      </div>

      <div class="step-card ${step.cls || ''}">
        <div class="step-num">Шаг ${state.stepIndex + 1} / ${steps.length}</div>
        <div class="step-title">Ведущий говорит</div>
        <div class="step-say">${step.say}</div>
        ${step.hint ? `<div class="step-hint">💡 ${step.hint}</div>` : ''}
      </div>

      <div class="nav-row nav-row-sticky">
        <button class="nav-btn" id="prevStep" ${isVeryFirstStep ? 'disabled' : ''}>← Назад</button>
        <button class="nav-btn primary" id="nextStep" ${isNextDisabled(step) ? 'disabled' : ''}>
          ${isLast ? nextPhaseLabel() : 'Далее →'}
        </button>
      </div>

      ${summaryHtml}
      ${actionHtml}
      ${step.timerSeconds ? renderTimer(step.timerSeconds, step.timerLabel) : ''}

      <div class="section mt-24">
        <div class="section-head">
          <span class="num">✦</span>
          <span class="label">Игроки · живых ${aliveCount}/${state.playerCount}</span>
          <span class="line"></span>
        </div>
        <div class="roster">
          ${state.players.map((p, i) => {
            const role = ROLES[p.role];
            return `
              <div class="roster-row ${!p.alive ? 'dead' : ''}">
                <div class="roster-num">${String(i+1).padStart(2,'0')}</div>
                <div class="roster-name">${p.name}</div>
                <div class="roster-role">
                  <span class="roster-dot ${p.role}"></span>
                  ${role.name}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <div style="height: 16px;"></div>
      <button class="btn-ghost" id="endGame" style="width: 100%;">Завершить игру</button>
    </div>
  `;

  // Обработчики action (выбор цели / пропуск)
  bindActionHandlers(step);

  // Nav: Назад
  document.getElementById('prevStep').onclick = () => {
    if (state.stepIndex > 0) {
      state.stepIndex--;
    } else {
      if (state.phase === 'vote') { state.phase = 'day'; state.stepIndex = getDaySteps().length - 1; }
      else if (state.phase === 'day') { state.phase = 'night'; state.stepIndex = getNightSteps().length - 1; }
    }
    stopTimer();
    render();
  };

  // Nav: Далее
  document.getElementById('nextStep').onclick = () => {
    if (isNextDisabled(step)) return;

    // Если на этом шаге авторезолв ночи — применяем его.
    // Важно: state.night.resolved уже вычислен в renderResolveNight при рендере этого шага.
    if (step.action && step.action.type === 'resolveNight') {
      // На всякий случай пересчитываем, если resolved не проставлен
      if (!state.night.resolved) {
        state.night.resolved = resolveNight(state);
      }
      applyNightResolution(state);
      const w = checkWinCondition(state);
      if (w) {
        state.winner = w;
        state.screen = 'gameover';
        stopTimer();
        render();
        return;
      }
    }

    // Применяем казнь при переходе с шага казни
    if (step.action && step.action.type === 'pickKilled' && state.dayVoteKilled != null && state.dayVoteKilled >= 0) {
      state.players[state.dayVoteKilled].alive = false;
      const w = checkWinCondition(state);
      if (w) {
        state.winner = w;
        state.screen = 'gameover';
        stopTimer();
        render();
        return;
      }
    }

    // Переход на следующий шаг или следующую фазу
    if (state.stepIndex < steps.length - 1) {
      state.stepIndex++;
    } else {
      if (state.phase === 'night') {
        state.phase = 'day';
        state.stepIndex = 0;
      } else if (state.phase === 'day') {
        state.phase = 'vote';
        state.stepIndex = 0;
      } else if (state.phase === 'vote') {
        const w = checkWinCondition(state);
        if (w) {
          state.winner = w;
          state.screen = 'gameover';
        } else {
          // vote → новая ночь: очищаем ночные выборы (включая resolved).
          state.day++;
          state.phase = 'night';
          state.stepIndex = 0;
          resetNightSelections();
        }
      }
    }
    stopTimer();
    render();
  };

  document.getElementById('endGame').onclick = () => {
    if (confirm('Завершить игру и вернуться в меню?')) {
      stopTimer();
      state.screen = 'home';
      render();
    }
  };
}

// Проверяет, нужно ли заблокировать кнопку "Далее"
// (чтобы не пойти дальше пока не выбрана цель на шаге).
function isNextDisabled(step) {
  if (!step.action) return false;
  const a = step.action;
  if (a.type === 'pickTarget') {
    const val = state.night[a.field];
    return val === null; // -1 означает "пропустить" — это валидный выбор
  }
  if (a.type === 'blockedAction') {
    // Пока ведущий не нажал «Подтвердить» — поле null, идти нельзя.
    return state.night[a.field] !== -1;
  }
  // pickKilled и resolveNight — не блокируем
  return false;
}

// ============================================================
// ACTION RENDERING (выбор целей, резолв и т.п.)
// ============================================================
function renderAction(action) {
  if (action.type === 'pickTarget') return renderPickTarget(action);
  if (action.type === 'pickKilled') return renderPickKilled(action);
  if (action.type === 'resolveNight') return renderResolveNight();
  if (action.type === 'blockedAction') return renderBlockedAction(action);
  return '';
}

// Рендер «пустышечного» шага: роль заблокирована Путаной, у ведущего только
// кнопка подтверждения. После клика поле проставляется как -1 («пропустить»)
// и кнопка «Далее» разблокируется.
function renderBlockedAction(action) {
  const selected = state.night[action.field];
  const confirmed = selected === -1;
  return `
    <div class="step-card action-card blocked-card">
      <div class="step-title">${action.label}</div>
      <div class="blocked-note">❀ Действие этой ночью заблокировано Путаной</div>
      <button class="target-skip blocked-confirm ${confirmed ? 'selected' : ''}" data-blocked-confirm data-field="${action.field}">
        ${confirmed ? '✓ Подтверждено' : (action.confirmLabel || 'Подтвердить')}
      </button>
    </div>
  `;
}

// Рендер сетки выбора цели + кнопка "пропустить"
function renderPickTarget(action) {
  const selected = state.night[action.field];
  const alive = state.players.filter(p => p.alive);
  const validation = action.validate ? action.validate(selected) : { ok: true };

  // Результат проверки (для Шерифа и Дона) — показываем только после выбора
  let resultHtml = '';
  if (action.showResult && selected != null && selected >= 0) {
    resultHtml = `<div class="action-result">${action.showResult(selected)}</div>`;
  }

  // Предупреждение о невалидном выборе
  let warnHtml = '';
  if (!validation.ok && selected != null && selected >= 0) {
    warnHtml = `<div class="action-warn">⚠ ${validation.reason}</div>`;
  }

  return `
    <div class="step-card action-card">
      <div class="step-title">${action.label}</div>
      <div class="target-grid">
        ${state.players.map((p, i) => {
          if (!p.alive) return '';
          const isSelected = selected === i;
          return `
            <div class="target-chip ${isSelected ? 'selected' : ''}" data-target-idx="${i}" data-field="${action.field}">
              ${p.name}
            </div>
          `;
        }).join('')}
      </div>
      ${action.allowSkip ? `
        <button class="target-skip ${selected === -1 ? 'selected' : ''}" data-skip data-field="${action.field}">
          ${action.skipLabel || 'Пропустить'}
        </button>
      ` : ''}
      ${resultHtml}
      ${warnHtml}
    </div>
  `;
}

// Рендер выбора казнённого (переиспользует pickTarget, но пишет в state.dayVoteKilled)
function renderPickKilled(action) {
  const selected = state.dayVoteKilled;
  return `
    <div class="step-card action-card">
      <div class="step-title">${action.label}</div>
      <div class="target-grid">
        ${state.players.map((p, i) => {
          if (!p.alive) return '';
          const isSelected = selected === i;
          return `
            <div class="target-chip ${isSelected ? 'selected' : ''}" data-killed-idx="${i}">
              ${p.name}
            </div>
          `;
        }).join('')}
      </div>
      <button class="target-skip ${selected === -1 ? 'selected' : ''}" data-killed-skip>
        ${action.skipLabel || 'Никто не уходит'}
      </button>
    </div>
  `;
}

// Рендер итога ночи — вычисляет результат (или берёт уже посчитанный).
function renderResolveNight() {
  // Если ночь уже применена (например, пользователь вернулся назад) —
  // используем сохранённый результат, а не пересчитываем на мёртвых игроках.
  if (!state.night.applied || !state.night.resolved) {
    state.night.resolved = resolveNight(state);
  }
  const r = state.night.resolved;

  let html = '<div class="step-card action-card resolve-card"><div class="step-title">Автоматический итог</div>';

  if (r.killed.length === 0) {
    html += '<div class="resolve-line resolve-peaceful">☾ Ночь прошла спокойно</div>';
  } else {
    const names = r.killed.map(i => state.players[i].name).join(', ');
    html += `<div class="resolve-line resolve-death">✖ Погибли: <strong>${names}</strong></div>`;
  }

  if (r.savedByDoctor != null) {
    const name = state.players[r.savedByDoctor].name;
    html += `<div class="resolve-line resolve-saved">✚ Доктор спас: <strong>${name}</strong></div>`;
  }

  if (r.whoreDied) {
    if (r.whoreSavedByDoctor) {
      html += `<div class="resolve-line resolve-saved">❀ Путана попала к мафии — но Доктор спас её</div>`;
    } else {
      html += `<div class="resolve-line resolve-note">❀ Путана попала к мафии и погибла</div>`;
    }
  } else if (r.whoreAtMafia) {
    html += `<div class="resolve-line resolve-note">❀ Путана у мафии — её голос сегодня не в счёт</div>`;
  }

  // Показываем только ведущему: кто что проверял (уже объявлено игроку, но для контроля)
  if (r.sheriffResult) {
    const idx = state.night.sheriffCheck;
    const name = state.players[idx].name;
    html += `<div class="resolve-line resolve-info">✦ Шериф проверил ${name}: ${r.sheriffResult === 'mafia' ? '🔴 мафия' : '🟢 не мафия'}</div>`;
  }
  if (r.donResult) {
    const idx = state.night.donCheck;
    const name = state.players[idx].name;
    html += `<div class="resolve-line resolve-info">♛ Дон проверил ${name}: ${r.donResult === 'sheriff' ? '✓ Шериф' : '✗ не Шериф'}</div>`;
  }

  const blocked = [];
  if (r.blocked.mafia) blocked.push('Мафия');
  if (r.blocked.maniac) blocked.push('Маньяк');
  if (r.blocked.doctor) blocked.push('Доктор');
  if (r.blocked.sheriff) blocked.push('Шериф');
  if (blocked.length > 0) {
    html += `<div class="resolve-line resolve-note">❀ Путана заблокировала: ${blocked.join(', ')}</div>`;
  }

  html += '<div class="resolve-hint">Нажми «Далее», чтобы применить результат и перейти к объявлению.</div>';
  html += '</div>';
  return html;
}

// Подключает обработчики к элементам action после рендера
function bindActionHandlers(step) {
  if (!step.action) return;

  // Выбор цели (pickTarget)
  document.querySelectorAll('[data-target-idx]').forEach(el => {
    el.onclick = () => {
      const idx = parseInt(el.dataset.targetIdx);
      const field = el.dataset.field;
      state.night[field] = idx;
      render();
    };
  });
  document.querySelectorAll('[data-skip]').forEach(el => {
    el.onclick = () => {
      const field = el.dataset.field;
      state.night[field] = -1; // -1 = пропустить
      render();
    };
  });

  // Выбор казнённого (pickKilled)
  document.querySelectorAll('[data-killed-idx]').forEach(el => {
    el.onclick = () => {
      state.dayVoteKilled = parseInt(el.dataset.killedIdx);
      render();
    };
  });
  const skipKilled = document.querySelector('[data-killed-skip]');
  if (skipKilled) {
    skipKilled.onclick = () => {
      state.dayVoteKilled = -1;
      render();
    };
  }

  // Подтверждение заблокированного действия (blockedAction)
  document.querySelectorAll('[data-blocked-confirm]').forEach(el => {
    el.onclick = () => {
      const field = el.dataset.field;
      state.night[field] = -1;
      render();
    };
  });
}

function nextPhaseLabel() {
  if (state.phase === 'night') return 'К дню →';
  if (state.phase === 'day') return 'К голосованию →';
  if (state.phase === 'vote') return `Ночь ${state.day + 1} →`;
  return 'Далее →';
}

// ============================================================
// TIMER
// ============================================================

// Отслеживаем, на каком шаге был последний ресет, чтобы не ресетить повторно
// при обновлениях внутри того же шага.
let lastTimerStepKey = null;

// Web Audio API — тихий "тик" и финальный "гонг".
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch(e) { return null; }
  }
  return audioCtx;
}

function playTick(isFinal) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  // На iOS контекст может быть suspended — разбудим при первом тапе пользователя.
  if (ctx.state === 'suspended') ctx.resume();

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  if (isFinal) {
    // Финальный сигнал — две ноты, колокольный
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.6);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.8);
  } else {
    // Короткий тик
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
  }
}

// Обновляет только цифры в DOM (без полного render).
function updateTimerDisplay() {
  const el = document.querySelector('.timer-display');
  if (!el) return;
  const s = state.timer.seconds;
  el.textContent = `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  el.classList.toggle('warning', s > 0 && s <= 5);
  el.classList.toggle('caution', s > 5 && s <= 10);
}

// Обновляет только надпись на кнопке старт/пауза.
function updateTimerToggleBtn() {
  const btn = document.getElementById('timerToggle');
  if (btn) btn.textContent = state.timer.running ? '⏸ Пауза' : '▶ Старт';
}

function formatTime(s) {
  return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
}

// renderTimer теперь принимает preset (нужные секунды для текущего шага)
// и автоматически сбрасывает таймер на preset при смене шага.
function renderTimer(presetSeconds, presetLabel) {
  const stepKey = `${state.phase}:${state.day}:${state.stepIndex}`;
  // При смене шага — сбрасываем таймер на preset и останавливаем.
  if (lastTimerStepKey !== stepKey) {
    lastTimerStepKey = stepKey;
    stopTimer();
    state.timer.seconds = presetSeconds;
    state.timer.preset = presetSeconds;
  }

  const s = state.timer.seconds;
  const preset = state.timer.preset || presetSeconds;
  const cls = s > 0 && s <= 5 ? 'warning' : (s > 5 && s <= 10 ? 'caution' : '');

  // Подключаем обработчики после вставки в DOM.
  setTimeout(() => {
    const minus = document.getElementById('timerMinus');
    const plus = document.getElementById('timerPlus');
    const reset = document.getElementById('timerReset');
    const toggle = document.getElementById('timerToggle');
    if (minus) minus.onclick = () => adjustTimer(-10);
    if (plus) plus.onclick = () => adjustTimer(+10);
    if (reset) reset.onclick = () => {
      stopTimer();
      state.timer.seconds = preset;
      updateTimerDisplay();
      updateTimerToggleBtn();
    };
    if (toggle) toggle.onclick = () => {
      // Важно: первый тап разбудит аудиоконтекст на iOS
      getAudioCtx();
      if (state.timer.running) stopTimer(); else startTimer();
      updateTimerToggleBtn();
    };
  }, 0);

  return `
    <div class="step-card timer-card" style="border-left-color: var(--gold);">
      <div class="step-title">${presetLabel || 'Таймер'}</div>
      <div class="timer-display ${cls}">${formatTime(s)}</div>
      <div class="timer-controls">
        <button class="nav-btn" id="timerMinus">−10с</button>
        <button class="nav-btn primary" id="timerToggle">${state.timer.running ? '⏸ Пауза' : '▶ Старт'}</button>
        <button class="nav-btn" id="timerPlus">+10с</button>
      </div>
      <div style="height: 8px;"></div>
      <button class="btn-ghost" id="timerReset" style="width: 100%;">Сброс на ${formatTime(preset)}</button>
    </div>
  `;
}

function startTimer() {
  if (state.timer.running) return;
  // Если таймер на нуле — сбросим на preset
  if (state.timer.seconds === 0) state.timer.seconds = state.timer.preset || 60;
  state.timer.running = true;
  state.timer.interval = setInterval(() => {
    if (state.timer.seconds > 0) {
      state.timer.seconds--;
      updateTimerDisplay();
      // Тикаем на последних 5 секундах
      if (state.timer.seconds > 0 && state.timer.seconds <= 5) {
        playTick(false);
      }
      if (state.timer.seconds === 0) {
        stopTimer();
        playTick(true);
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        updateTimerDisplay();
        updateTimerToggleBtn();
      }
    }
  }, 1000);
}

function stopTimer() {
  state.timer.running = false;
  if (state.timer.interval) {
    clearInterval(state.timer.interval);
    state.timer.interval = null;
  }
}

function adjustTimer(delta) {
  state.timer.seconds = Math.max(0, Math.min(600, state.timer.seconds + delta));
  updateTimerDisplay();
}

// ============================================================
// GAME OVER
// ============================================================
function renderGameOver() {
  const app = document.getElementById('app');
  const winner = state.winner;

  const verdict = {
    city: { text: 'Город<br>победил', sub: 'Мафия вычищена из города. Справедливость восторжествовала.', cls: 'city-wins' },
    mafia: { text: 'Мафия<br>победила', sub: 'Город в руках семьи. Теперь здесь правят другие законы.', cls: 'mafia-wins' },
    maniac: { text: 'Маньяк<br>победил', sub: 'Последний, кто остался в живых. Все остальные — на кладбище.', cls: 'mafia-wins' },
    draw: { text: 'Ничья', sub: 'Никто не выжил, чтобы сказать об этом. Город опустел.', cls: '' }
  }[winner];

  app.innerHTML = `
    <div class="game-over screen">
      <div class="label mb-16">Финал</div>
      <div class="verdict ${verdict.cls}">${verdict.text}</div>
      <p class="verdict-sub">${verdict.sub}</p>

      <div class="section">
        <div class="section-head">
          <span class="num">✦</span>
          <span class="label">Все участники</span>
          <span class="line"></span>
        </div>
        <div class="final-list">
          ${state.players.map(p => `
            <div class="final-item ${!p.alive ? 'dead' : ''}">
              <div class="name-col">${p.name}</div>
              <div class="role-col">${ROLES[p.role].emblem} ${ROLES[p.role].name}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <button class="btn-primary" id="newGame">Новая партия</button>
    </div>
  `;

  document.getElementById('newGame').onclick = () => {
    state.screen = 'home';
    state.day = 1;
    state.phase = 'night';
    state.stepIndex = 0;
    state.winner = null;
    state.doctorHistory = [];
    state.doctorSelfUsed = false;
    state.whoreHistory = [];
    resetNightSelections();
    render();
  };
}

// ============================================================
// RULES
// ============================================================
function renderRules() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="screen">
      <div class="home-header">
        <div class="ornament"><span>R E G U L A · L U D I</span></div>
        <div class="hero-wrap">
          <h1 class="hero" style="font-size: 48px;">Правила<em>игры</em></h1>
        </div>
      </div>

      <div class="rules-content">
        <h3>Суть игры</h3>
        <p>Часть игроков — мафия, знают друг друга и ночью «убивают». Остальные — мирные, не знают никого и днём пытаются вычислить мафию голосованием.</p>

        <h3>Цикл игры</h3>
        <ul>
          <li><strong>Ночь:</strong> активные роли действуют по очереди (мафия выбирает жертву, шериф проверяет и т.д.)</li>
          <li><strong>День:</strong> объявление жертв, обсуждение, выдвижение кандидатов</li>
          <li><strong>Голосование:</strong> город голосованием выбирает, кого казнить</li>
        </ul>

        <h3>Условия победы</h3>
        <ul>
          <li><strong>Мирные:</strong> выгнать всех членов мафии (и маньяка, если он есть)</li>
          <li><strong>Мафия:</strong> когда их число сравняется с числом мирных или превысит</li>
          <li><strong>Маньяк:</strong> остался живым, мафии нет, мирных ≤ 1</li>
        </ul>

        <h3>Эдж-кейсы ночью</h3>
        <ul>
          <li><strong>Мафия не договорилась:</strong> ночь без убийства</li>
          <li><strong>Доктор лечит жертву мафии:</strong> жертва выживает</li>
          <li><strong>Путана блокирует мафию:</strong> жертвы мафии нет, Путана тоже умирает</li>
          <li><strong>Путана блокирует Доктора/Шерифа/Дона:</strong> их действие не сработало этой ночью</li>
          <li><strong>Маньяк + мафия на одну цель:</strong> если Доктор её лечит — спасается, иначе умирает (всё равно один раз)</li>
          <li><strong>Маньяк и Доктор:</strong> Доктор лечит и от маньяка (классика; обсудите до игры)</li>
          <li><strong>Шериф проверяет Дона:</strong> показывается как мафия</li>
          <li><strong>Шериф проверяет Маньяка:</strong> показывается как НЕ мафия</li>
        </ul>

        <h3>Эдж-кейсы голосования</h3>
        <ul>
          <li><strong>Никто не выдвинут:</strong> переходим сразу к ночи</li>
          <li><strong>Один кандидат:</strong> либо голосуем «за/против», либо казнь без голоса (договоритесь)</li>
          <li><strong>Равенство голосов:</strong> переголосование между лидерами; если снова равенство — никто не уходит ИЛИ все лидеры уходят (решите до игры)</li>
          <li><strong>Голосовать нельзя:</strong> за себя, мёртвым</li>
        </ul>

        <h3>Общие правила</h3>
        <ul>
          <li>Мёртвые игроки не подсказывают живым ни словом, ни жестом, ни мимикой</li>
          <li>Нельзя показывать свою карту/роль другим в течение игры</li>
          <li>Мафия знакомится в первую ночь (без убийства)</li>
          <li>Нельзя намекать на проверку/лечение жестом или интонацией</li>
          <li>Ведущий — высшая власть, его решения окончательны</li>
        </ul>

        <h3>Советы ведущему</h3>
        <ul>
          <li>Драматизируй рассказ — это создаёт атмосферу</li>
          <li>Следи за глазами: кто-то может подглядывать</li>
          <li>Используй таймер — обсуждения склонны затягиваться</li>
          <li>Если игрок случайно выдал роль — решай по ситуации (обычно игра продолжается)</li>
        </ul>
      </div>

      <div style="height: 32px;"></div>
      <button class="btn-primary" id="backFromRules">← Вернуться в меню</button>
    </div>
  `;

  document.getElementById('backFromRules').onclick = () => {
    state.screen = 'home';
    render();
  };
}

// ============================================================
// INIT
// ============================================================

// Загружаем тему до первого рендера, чтобы не было вспышки.
loadTheme();
applyTheme();

// Подключаем переключатель темы (он вне app, рендерится один раз в HTML).
const themeBtn = document.getElementById('themeToggle');
if (themeBtn) {
  themeBtn.onclick = toggleTheme;
}

render();
