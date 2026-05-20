import { useEffect, useState } from 'react';
import useStore from './store';
import { getAffColor, getNegColor, useTheme } from './theme';
import KeybindingsPanel from './KeybindingsPanel';
import { UI_STYLE_OPTIONS, getUiChrome } from './uiChrome';

const FONTS = [
  ['Arial, sans-serif',                      'Arial'],
  ['Inter, sans-serif',                      'Inter'],
  ['"Helvetica Neue", Helvetica, sans-serif', 'Helvetica Neue'],
  ['Verdana, sans-serif',                    'Verdana'],
  ['Tahoma, sans-serif',                     'Tahoma'],
  ['"Trebuchet MS", sans-serif',             'Trebuchet MS'],
  ['Georgia, serif',                         'Georgia'],
  ['"Times New Roman", serif',               'Times New Roman'],
  ['"Palatino Linotype", Palatino, serif',   'Palatino'],
  ['monospace',                              'Monospace'],
  ['Consolas, monospace',                    'Consolas'],
  ['"Courier New", monospace',               'Courier New'],
  ['"Lucida Console", Monaco, monospace',    'Lucida Console'],
  ['Impact, Charcoal, sans-serif',           'Impact'],
  ['"Comic Sans MS", cursive',               'Comic Sans MS'],
];

const DEFAULT_COLORS = {
  activeCellStyle: 'filledBlue',
  activeCellBorderColor: '#1d4ed8',
  activeCellFillColor: '#dbeafe',
  affColor: '#1d4ed8',
  negColor: '#b91c1c',
};

export default function SettingsPanel({ open, onClose, initialTab = 'display' }) {
  const settings = useStore(s => s.settings);
  const update   = useStore(s => s.updateSettings);
  const theme = useTheme(settings.theme);
  const ui = getUiChrome(settings, theme);
  const [tab, setTab] = useState('display');

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  if (!open) return null;

  const numInput = (key, min, max, step = 1) => (
    <input
      type="number" min={min} max={max} step={step}
      value={settings[key]}
      onChange={e => update({ [key]: Number(e.target.value) })}
      style={{ width: 72, padding: '4px 8px', background: ui.inputBg, border: `1px solid ${ui.border}`, borderRadius: ui.radius, color: theme.text, fontSize: 13, textAlign: 'center', fontFamily: 'inherit' }}
    />
  );

  const toggle = (key) => (
    <button
      onClick={() => update({ [key]: !settings[key] })}
      style={{
        padding: '4px 16px', borderRadius: ui.radius, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
        background: settings[key] ? theme.aff : theme.bgTertiary,
        border: `1px solid ${settings[key] ? theme.aff : theme.border}`,
        color: settings[key] ? '#fff' : theme.textMuted,
      }}
    >
      {settings[key] ? 'On' : 'Off'}
    </button>
  );

  const row = (label, ctrl) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <label style={{ color: theme.text, fontSize: 13 }}>{label}</label>
      {ctrl}
    </div>
  );

  const select = (key, options) => (
    <select
      value={options.some(([value]) => value === settings[key]) ? settings[key] : options[0]?.[0]}
      onChange={e => update({ [key]: e.target.value })}
      style={{ padding: '4px 8px', background: ui.inputBg, border: `1px solid ${ui.border}`, borderRadius: ui.radius, color: theme.text, fontSize: 13, fontFamily: 'inherit' }}
    >
      {options.map(([value, label]) => (
        <option key={value} value={value}>{label}</option>
      ))}
    </select>
  );

  const colorInput = (key) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input
        type="color"
        value={settings[key] ?? (key === 'activeCellFillColor' ? '#dbeafe' : '#1d4ed8')}
        onChange={e => update({ activeCellStyle: 'custom', [key]: e.target.value })}
        style={{ width: 34, height: 24, padding: 0, background: 'transparent', border: `1px solid ${ui.border}`, borderRadius: ui.radius, cursor: 'pointer' }}
      />
      <input
        type="text"
        value={settings[key] ?? (key === 'activeCellFillColor' ? '#dbeafe' : '#1d4ed8')}
        onChange={e => update({ activeCellStyle: 'custom', [key]: e.target.value })}
        style={{ width: 82, padding: '4px 8px', background: ui.inputBg, border: `1px solid ${ui.border}`, borderRadius: ui.radius, color: theme.text, fontSize: 13, fontFamily: 'inherit' }}
      />
    </div>
  );

  const sideColorInput = (key) => {
    const defaultColor = key === 'affColor' ? '#1d4ed8' : '#b91c1c';
    const effectiveColor = key === 'affColor' ? getAffColor(settings, theme) : getNegColor(settings, theme);
    const value = settings[key] && settings[key] !== defaultColor ? settings[key] : effectiveColor;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="color"
          value={value}
          onChange={e => update({ [key]: e.target.value })}
          style={{ width: 34, height: 24, padding: 0, background: 'transparent', border: `1px solid ${ui.border}`, borderRadius: ui.radius, cursor: 'pointer' }}
        />
        <input
          type="text"
          value={value}
          onChange={e => update({ [key]: e.target.value })}
          style={{ width: 82, padding: '4px 8px', background: ui.inputBg, border: `1px solid ${ui.border}`, borderRadius: ui.radius, color: theme.text, fontSize: 13, fontFamily: 'inherit' }}
        />
      </div>
    );
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{
          background: ui.panelBg,
          backgroundImage: ui.appBackgroundImage,
          backgroundSize: ui.appBackgroundSize,
          border: `1px solid ${ui.border}`,
          borderRadius: ui.cardRadius,
          width: 480,
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: ui.modalShadow,
          fontFamily: ui.fontFamily,
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: `1px solid ${ui.border}` }}>
          <span style={{ color: theme.text, fontSize: 15, fontWeight: 700 }}>Settings</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: theme.textMuted, fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ display: 'flex', borderBottom: `1px solid ${ui.border}` }}>
          {['display', 'keybindings'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '8px 20px', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, fontFamily: 'inherit',
              color: tab === t ? theme.aff : theme.textMuted,
              borderBottom: `2px solid ${tab === t ? theme.aff : 'transparent'}`,
              textTransform: 'capitalize',
            }}>
              {t}
            </button>
          ))}
        </div>

        <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
          {tab === 'display' && (
            <>
              <div style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: theme.textMuted, marginBottom: 10 }}>Theme</div>
              {row('UI Style', select('uiStyle', UI_STYLE_OPTIONS))}
              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                {['light', 'dark'].map(t => (
                  <button key={t} onClick={() => update({ theme: t })} style={{
                    flex: 1, padding: '8px', borderRadius: ui.radius, cursor: 'pointer', fontFamily: 'inherit',
                    fontSize: 13, fontWeight: settings.theme === t ? 600 : 400,
                    background: settings.theme === t ? theme.aff : theme.bgTertiary,
                    border: `1px solid ${settings.theme === t ? theme.aff : theme.border}`,
                    color: settings.theme === t ? '#fff' : theme.textMuted,
                    textTransform: 'capitalize',
                  }}>
                    {t === 'dark' ? 'Dark' : 'Light'}
                  </button>
                ))}
              </div>

              <div style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: theme.textMuted, marginBottom: 10 }}>Grid</div>
              {row('Text Wrap',              toggle('textWrap'))}
              {row('Enter Spacing (rows)',   numInput('enterSpacing', 1, 20))}
              {row('Column Width (px)',      numInput('colWidth', 60, 800, 10))}
              {row('Row Height (px)',        numInput('rowHeight', 14, 80))}
              {row('Font Size (pt)',         numInput('fontSize', 6, 32))}
              {row('Active Cell Style',       select('activeCellStyle', [
                ['filledBlue', 'Blue filled'],
                ['outlineBlue', 'Blue outline'],
                ['outlineBlack', 'Black outline'],
                ['custom', 'Custom colors'],
              ]))}
              {row('Active Cell Line',        colorInput('activeCellBorderColor'))}
              {row('Active Cell Shading',     colorInput('activeCellFillColor'))}
              {row('Aff Text Color',          sideColorInput('affColor'))}
              {row('Neg Text Color',          sideColorInput('negColor'))}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
                <button
                  onClick={() => update(DEFAULT_COLORS)}
                  style={{
                    padding: '5px 10px',
                    background: theme.bgTertiary,
                    border: `1px solid ${theme.border}`,
                    borderRadius: ui.radius,
                    color: theme.textMuted,
                    cursor: 'pointer',
                    fontSize: 12,
                    fontFamily: 'inherit',
                  }}
                >
                  Reset colors to defaults
                </button>
              </div>
              {row('Font', (
                <select
                  value={settings.fontFamily}
                  onChange={e => update({ fontFamily: e.target.value })}
                  style={{ padding: '4px 8px', background: ui.inputBg, border: `1px solid ${ui.border}`, borderRadius: ui.radius, color: theme.text, fontSize: 13, fontFamily: settings.fontFamily }}
                >
                  {FONTS.map(([v, l]) => (
                    <option key={v} value={v} style={{ fontFamily: v }}>{l}</option>
                  ))}
                </select>
              ))}
            </>
          )}
          {tab === 'keybindings' && <KeybindingsPanel />}
        </div>
      </div>
    </div>
  );
}
