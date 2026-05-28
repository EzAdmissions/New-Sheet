import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useStore from './store';
import { chromeButton, getUiChrome } from './uiChrome';
import { getAffColor, getNegColor, useTheme } from './theme';

const TIMER_COLORS = {
  style: null,
  seaGlass: { speech: '#7aa7a3', aff: '#8eb89a', neg: '#c98f8f', panel: '#f4faf8', text: '#18322f' },
  lavender: { speech: '#9d91c7', aff: '#8fa7d6', neg: '#d5a0bd', panel: '#faf7ff', text: '#2f2942' },
  meadow: { speech: '#8ba67d', aff: '#7fa1b7', neg: '#d2a06d', panel: '#fbfaf2', text: '#263421' },
  slate: { speech: '#78889a', aff: '#6f9a9a', neg: '#b98585', panel: '#f5f7f8', text: '#1d2730' },
};

const SOUND_OPTIONS = {
  none: [],
  debateBell: [{ f: 880, d: 0.16 }, { f: 1174, d: 0.28 }],
  softChime: [{ f: 659, d: 0.12 }, { f: 880, d: 0.12 }, { f: 1318, d: 0.28 }],
  deskBell: [{ f: 1568, d: 0.08 }, { f: 1568, d: 0.08, gap: 0.04 }, { f: 1046, d: 0.2 }],
  seriousBuzz: [{ f: 150, d: 0.35 }, { f: 120, d: 0.25 }],
  sonar: [{ f: 523, d: 0.08 }, { f: 0, d: 0.08 }, { f: 523, d: 0.2 }],
  clownHorn: [{ f: 220, d: 0.1 }, { f: 392, d: 0.18 }, { f: 196, d: 0.2 }],
  victory: [{ f: 523, d: 0.08 }, { f: 659, d: 0.08 }, { f: 784, d: 0.08 }, { f: 1046, d: 0.22 }],
};

const TIMER_LABELS = {
  speech: 'Speech',
  aff: 'Aff Prep',
  neg: 'Neg Prep',
};

const TIMER_WIDTH = 258;

const DEFAULT_TIMER_SETTINGS = {
  colorTheme: 'style',
  sound: 'debateBell',
  constructiveTime: '9:00',
  rebuttalTime: '6:00',
  cxTime: '3:00',
  prepTime: '10:00',
  position: null,
};

function getDefaultTimerPosition() {
  return { x: Math.max(12, window.innerWidth - TIMER_WIDTH - 16), y: 96 };
}

function parseTime(value, fallback = 0) {
  if (typeof value === 'number') return Math.max(0, Math.floor(value));
  const cleaned = String(value ?? '').trim();
  const match = cleaned.match(/^(\d{1,3})(?::([0-5]?\d))?$/);
  if (!match) return fallback;
  const minutes = Number(match[1] ?? 0);
  const seconds = Number(match[2] ?? 0);
  return Math.max(0, minutes * 60 + seconds);
}

function formatTime(totalSeconds) {
  const safe = Math.max(0, Math.floor(totalSeconds || 0));
  const minutes = Math.floor(safe / 60);
  const seconds = String(safe % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function playTimerSound(soundKey) {
  const notes = SOUND_OPTIONS[soundKey] ?? SOUND_OPTIONS.debateBell;
  if (!notes.length) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const ctx = new AudioContext();
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.connect(ctx.destination);
  let offset = 0;
  notes.forEach(note => {
    if (!note.f) {
      offset += note.d + (note.gap ?? 0);
      return;
    }
    const osc = ctx.createOscillator();
    osc.type = soundKey === 'seriousBuzz' ? 'sawtooth' : 'sine';
    osc.frequency.setValueAtTime(note.f, ctx.currentTime + offset);
    gain.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + offset + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offset + note.d);
    osc.connect(gain);
    osc.start(ctx.currentTime + offset);
    osc.stop(ctx.currentTime + offset + note.d + 0.02);
    offset += note.d + (note.gap ?? 0.03);
  });
  setTimeout(() => ctx.close(), Math.ceil((offset + 0.2) * 1000));
}

export default function TimerWidget() {
  const settings = useStore(s => s.settings);
  const updateSettings = useStore(s => s.updateSettings);
  const theme = useTheme(settings.theme);
  const ui = getUiChrome(settings, theme);
  const affColor = getAffColor(settings, theme);
  const negColor = getNegColor(settings, theme);
  const timerSettings = useMemo(() => ({ ...DEFAULT_TIMER_SETTINGS, ...(settings.timer ?? {}) }), [settings.timer]);
  const rootRef = useRef(null);
  const dragRef = useRef(null);
  const [activeTimer, setActiveTimer] = useState('speech');
  const [running, setRunning] = useState(false);
  const [editingValue, setEditingValue] = useState(null);
  const [flash, setFlash] = useState(false);
  const [times, setTimes] = useState(() => ({
    speech: parseTime(timerSettings.constructiveTime ?? '9:00', 540),
    aff: parseTime(timerSettings.prepTime ?? '10:00', 600),
    neg: parseTime(timerSettings.prepTime ?? '10:00', 600),
  }));
  const [position, setPosition] = useState(() => timerSettings.position ?? getDefaultTimerPosition());

  const colors = useMemo(() => {
    const preset = TIMER_COLORS[timerSettings.colorTheme ?? 'style'];
    if (preset) return preset;
    return {
      speech: theme.aff,
      aff: affColor,
      neg: negColor,
      panel: ui.panelBg,
      text: theme.text,
    };
  }, [affColor, negColor, theme, timerSettings.colorTheme, ui.panelBg]);

  const patchTimerSettings = useCallback((patch) => {
    updateSettings({ timer: { ...timerSettings, ...patch } });
  }, [timerSettings, updateSettings]);

  const defaultPosition = useCallback(() => {
    return getDefaultTimerPosition();
  }, []);

  const clampPosition = useCallback((next) => {
    const width = rootRef.current?.offsetWidth || 258;
    const height = rootRef.current?.offsetHeight || 218;
    return {
      x: Math.max(8, Math.min(window.innerWidth - width - 8, next.x)),
      y: Math.max(48, Math.min(window.innerHeight - height - 28, next.y)),
    };
  }, []);

  useEffect(() => {
    const onResize = () => {
      setPosition(current => current ? clampPosition(current) : defaultPosition());
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [clampPosition, defaultPosition]);

  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => {
      setTimes(current => {
        const nextValue = Math.max(0, current[activeTimer] - 1);
        if (nextValue === 0) {
          setRunning(false);
          setFlash(true);
          playTimerSound(timerSettings.sound ?? 'debateBell');
          window.setTimeout(() => setFlash(false), 900);
        }
        return { ...current, [activeTimer]: nextValue };
      });
    }, 1000);
    return () => clearInterval(id);
  }, [activeTimer, running, timerSettings.sound]);

  useEffect(() => {
    const preview = (event) => playTimerSound(event.detail ?? timerSettings.sound ?? 'debateBell');
    window.addEventListener('jayflow-preview-timer-sound', preview);
    return () => window.removeEventListener('jayflow-preview-timer-sound', preview);
  }, [timerSettings.sound]);

  const setActiveTime = useCallback((seconds) => {
    setTimes(current => ({ ...current, [activeTimer]: parseTime(seconds, current[activeTimer]) }));
  }, [activeTimer]);

  const selectTimer = useCallback((key) => {
    if (running) setRunning(false);
    setEditingValue(null);
    setActiveTimer(key);
  }, [running]);

  const applyPreset = useCallback((key) => {
    const value = timerSettings[key] ?? (key === 'constructiveTime' ? '9:00' : key === 'rebuttalTime' ? '6:00' : '3:00');
    setRunning(false);
    setActiveTimer('speech');
    setTimes(current => ({ ...current, speech: parseTime(value, current.speech) }));
  }, [timerSettings]);

  const resetActive = useCallback(() => {
    setRunning(false);
    const next = activeTimer === 'speech'
      ? parseTime(timerSettings.constructiveTime ?? '9:00', 540)
      : parseTime(timerSettings.prepTime ?? '10:00', 600);
    setActiveTime(next);
  }, [activeTimer, setActiveTime, timerSettings.constructiveTime, timerSettings.prepTime]);

  const resetAll = useCallback(() => {
    setRunning(false);
    setActiveTimer('speech');
    setTimes({
      speech: parseTime(timerSettings.constructiveTime ?? '9:00', 540),
      aff: parseTime(timerSettings.prepTime ?? '10:00', 600),
      neg: parseTime(timerSettings.prepTime ?? '10:00', 600),
    });
  }, [timerSettings.constructiveTime, timerSettings.prepTime]);

  const startDrag = useCallback((event) => {
    if (event.button !== 0) return;
    const current = position ?? defaultPosition();
    dragRef.current = { startX: event.clientX, startY: event.clientY, origin: current };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [defaultPosition, position]);

  const moveDrag = useCallback((event) => {
    if (!dragRef.current) return;
    const next = clampPosition({
      x: dragRef.current.origin.x + event.clientX - dragRef.current.startX,
      y: dragRef.current.origin.y + event.clientY - dragRef.current.startY,
    });
    dragRef.current.last = next;
    setPosition(next);
  }, [clampPosition]);

  const endDrag = useCallback((event) => {
    if (!dragRef.current) return;
    const next = dragRef.current.last ?? (position ? clampPosition(position) : defaultPosition());
    dragRef.current = null;
    setPosition(next);
    patchTimerSettings({ position: next });
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* pointer already released */ }
  }, [clampPosition, defaultPosition, patchTimerSettings, position]);

  if (!settings.timerEnabled) return null;

  const activeColor = colors[activeTimer];
  const panelBg = timerSettings.colorTheme === 'style' ? ui.panelBg : colors.panel;
  const textColor = timerSettings.colorTheme === 'style' ? theme.text : colors.text;
  const currentValue = editingValue ?? formatTime(times[activeTimer]);
  const timerPosition = position ?? defaultPosition();

  const tabButton = (key) => {
    const active = activeTimer === key;
    return (
      <button
        key={key}
        onClick={() => selectTimer(key)}
        style={{
          flex: 1,
          minWidth: 0,
          padding: '5px 6px',
          border: `1px solid ${active ? colors[key] : ui.border}`,
          borderRadius: ui.radius,
          background: active ? `${colors[key]}22` : ui.inputBg,
          color: active ? colors[key] : theme.textMuted,
          fontSize: 11,
          fontWeight: active ? 700 : 500,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {TIMER_LABELS[key]}
      </button>
    );
  };

  return (
    <div
      ref={rootRef}
      style={{
        position: 'absolute',
        left: timerPosition.x,
        top: timerPosition.y,
        width: TIMER_WIDTH,
        zIndex: 25,
        background: panelBg,
        color: textColor,
        border: `1px solid ${ui.border}`,
        borderRadius: ui.cardRadius,
        boxShadow: ui.modalShadow,
        overflow: 'hidden',
        fontFamily: ui.fontFamily,
        outline: flash ? `3px solid ${activeColor}` : 'none',
      }}
    >
      <div
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '7px 9px',
          background: `${activeColor}24`,
          borderBottom: `1px solid ${ui.borderSubtle}`,
          cursor: 'move',
          userSelect: 'none',
        }}
      >
        <strong style={{ fontSize: 12, color: activeColor, flex: 1 }}>Timer</strong>
        <button
          onClick={() => {
            const next = defaultPosition();
            setPosition(next);
            patchTimerSettings({ position: next });
          }}
          title="Reset position"
          style={miniButton(theme, ui)}
        >
          Reset pos
        </button>
        <button onClick={() => updateSettings({ timerEnabled: false })} title="Hide timer" style={miniButton(theme, ui)}>Hide</button>
      </div>

      <div style={{ padding: 10 }}>
        <div style={{ display: 'flex', gap: 5, marginBottom: 8 }}>
          {['speech', 'aff', 'neg'].map(tabButton)}
        </div>

        <input
          value={currentValue}
          disabled={running}
          onFocus={() => setEditingValue(formatTime(times[activeTimer]))}
          onChange={e => setEditingValue(e.target.value.replace(/[^0-9:]/g, '').slice(0, 6))}
          onBlur={() => {
            setActiveTime(parseTime(editingValue, times[activeTimer]));
            setEditingValue(null);
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') setEditingValue(null);
          }}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            height: 58,
            textAlign: 'center',
            background: ui.inputBg,
            color: activeColor,
            border: `1px solid ${activeColor}66`,
            borderRadius: ui.radius,
            fontSize: 34,
            fontWeight: 800,
            fontVariantNumeric: 'tabular-nums',
            fontFamily: 'Consolas, "Courier New", monospace',
            outline: 'none',
          }}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 8 }}>
          <button onClick={() => setRunning(value => !value)} style={chromeButton(theme, ui, { color: '#fff', background: activeColor, border: `1px solid ${activeColor}`, fontWeight: 700 })}>
            {running ? 'Pause' : 'Start'}
          </button>
          <button onClick={resetActive} style={chromeButton(theme, ui)}>Reset</button>
          <button onClick={resetAll} style={chromeButton(theme, ui)}>All</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 8 }}>
          <button onClick={() => applyPreset('constructiveTime')} style={presetButton(theme, ui)}>Constructive</button>
          <button onClick={() => applyPreset('rebuttalTime')} style={presetButton(theme, ui)}>Rebuttal</button>
          <button onClick={() => applyPreset('cxTime')} style={presetButton(theme, ui)}>CX</button>
        </div>
      </div>
    </div>
  );
}

function miniButton(theme, ui) {
  return {
    padding: '2px 6px',
    border: `1px solid ${ui.border}`,
    borderRadius: ui.radius,
    background: ui.buttonBg,
    color: theme.textMuted,
    fontSize: 10,
    cursor: 'pointer',
    fontFamily: 'inherit',
  };
}

function presetButton(theme, ui) {
  return chromeButton(theme, ui, {
    padding: '4px 5px',
    fontSize: 10,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  });
}
