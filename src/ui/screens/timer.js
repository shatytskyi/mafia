import { state } from '../../state/state.js';
import { t } from '../../i18n/index.js';

let lastTimerStepKey = null;
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { return null; }
  }
  return audioCtx;
}

function playTick(isFinal) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  if (isFinal) {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.6);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.8);
  } else {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
  }
}

function updateTimerDisplay() {
  const el = document.querySelector('.timer-display');
  if (!el) return;
  const s = state.timer.seconds;
  el.textContent = `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  el.classList.toggle('warning', s > 0 && s <= 5);
  el.classList.toggle('caution', s > 5 && s <= 10);
}

function updateTimerToggleBtn() {
  const btn = document.getElementById('timerToggle');
  if (btn) btn.textContent = state.timer.running ? t('timer.pause') : t('timer.start');
}

function formatTime(s) {
  return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
}

export function startTimer() {
  if (state.timer.running) return;
  if (state.timer.seconds === 0) state.timer.seconds = state.timer.preset || 60;
  state.timer.running = true;
  state.timer.interval = setInterval(() => {
    if (state.timer.seconds > 0) {
      state.timer.seconds--;
      updateTimerDisplay();
      if (state.timer.seconds > 0 && state.timer.seconds <= 5) playTick(false);
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

export function stopTimer() {
  state.timer.running = false;
  if (state.timer.interval) {
    clearInterval(state.timer.interval);
    state.timer.interval = null;
  }
}

export function adjustTimer(delta) {
  state.timer.seconds = Math.max(0, Math.min(600, state.timer.seconds + delta));
  updateTimerDisplay();
}

/**
 * Returns the HTML for the timer card. Call `bindTimerHandlers` after inserting.
 */
export function renderTimer(presetSeconds, presetLabel) {
  const stepKey = `${state.phase}:${state.day}:${state.stepIndex}`;
  if (lastTimerStepKey !== stepKey) {
    lastTimerStepKey = stepKey;
    stopTimer();
    state.timer.seconds = presetSeconds;
    state.timer.preset = presetSeconds;
  }

  const s = state.timer.seconds;
  const cls = s > 0 && s <= 5 ? 'warning' : (s > 5 && s <= 10 ? 'caution' : '');
  const preset = state.timer.preset || presetSeconds;

  return `
    <div class="step-card timer-card" style="border-left-color: var(--gold);">
      <div class="step-title">${presetLabel || t('timer.label')}</div>
      <div class="timer-display ${cls}">${formatTime(s)}</div>
      <div class="timer-controls">
        <button class="nav-btn" id="timerMinus">${t('timer.minus10')}</button>
        <button class="nav-btn primary" id="timerToggle">${state.timer.running ? t('timer.pause') : t('timer.start')}</button>
        <button class="nav-btn" id="timerPlus">${t('timer.plus10')}</button>
      </div>
      <div style="height: 8px;"></div>
      <button class="btn-ghost" id="timerReset" style="width: 100%;">${t('timer.resetTo', { time: formatTime(preset) })}</button>
    </div>
  `;
}

export function bindTimerHandlers() {
  const minus = document.getElementById('timerMinus');
  const plus = document.getElementById('timerPlus');
  const reset = document.getElementById('timerReset');
  const toggle = document.getElementById('timerToggle');
  const preset = state.timer.preset || 60;

  if (minus) minus.onclick = () => adjustTimer(-10);
  if (plus) plus.onclick = () => adjustTimer(+10);
  if (reset) reset.onclick = () => {
    stopTimer();
    state.timer.seconds = preset;
    updateTimerDisplay();
    updateTimerToggleBtn();
  };
  if (toggle) toggle.onclick = () => {
    getAudioCtx();
    if (state.timer.running) stopTimer(); else startTimer();
    updateTimerToggleBtn();
  };
}
