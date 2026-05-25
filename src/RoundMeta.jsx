import { useState } from 'react';
import useStore, { roundDisplayName } from './store';
import { useTheme, getAffColor } from './theme';
import { getUiChrome, chromeButton } from './uiChrome';

export default function RoundMeta({ round, onClose }) {
  const updateRoundMeta = useStore(s => s.updateRoundMeta);
  const settings = useStore(s => s.settings);
  const theme = useTheme(settings.theme);
  const ui = getUiChrome(settings, theme);
  const affColor = getAffColor(settings, theme);
  const [form, setForm] = useState({
    tournament: round.tournament, roundNum: round.roundNum,
    judges: round.judges, affSchool: round.affSchool, affCode: round.affCode,
    negSchool: round.negSchool, negCode: round.negCode,
  });

  const preview = roundDisplayName({ ...round, ...form });

  const field = (key, label, placeholder = '') => (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: 'block', color: theme.textMuted, fontSize: 11, marginBottom: 3 }}>{label}</label>
      <input dir="ltr" value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={placeholder}
        style={{ width: '100%', padding: '6px 10px', background: ui.inputBg, border: `1px solid ${ui.border}`, borderRadius: ui.radius, color: theme.text, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit', unicodeBidi: 'plaintext', textAlign: 'left' }} />
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: ui.panelBg, backgroundImage: ui.panelBackgroundImage ?? ui.appBackgroundImage, backgroundSize: ui.appBackgroundSize, backgroundPosition: ui.appBackgroundPosition, border: `1px solid ${ui.border}`, borderRadius: ui.cardRadius, width: 420, padding: 24, boxShadow: ui.modalShadow, fontFamily: ui.fontFamily }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ color: theme.text, fontWeight: 700, fontSize: 15 }}>Round Info</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: theme.textMuted, fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 16, padding: '6px 10px', background: ui.cardBg, borderRadius: ui.radius, border: `1px solid ${ui.borderSubtle}` }}>
          {preview}
        </div>

        {field('tournament', 'Tournament', 'Berkeley')}
        {field('roundNum', 'Round', 'Quarterfinals')}
        {field('judges', 'Judge(s)', 'Kevin Hirn, Brett Bricker, Dana Randall')}
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>{field('affSchool', 'Aff School', 'Head-Royce')}</div>
          <div style={{ flex: 1 }}>{field('affCode', 'Aff Code', 'AJ')}</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>{field('negSchool', 'Neg School', 'Taipei')}</div>
          <div style={{ flex: 1 }}>{field('negCode', 'Neg Code', 'YH')}</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
          <button onClick={onClose} style={chromeButton(theme, ui, { padding: '7px 16px', fontSize: 13 })}>Cancel</button>
          <button onClick={() => { updateRoundMeta(round.id, form); onClose(); }}
            style={{ ...chromeButton(theme, ui, { padding: '7px 16px', fontSize: 13 }), background: affColor, borderColor: affColor, color: '#fff', fontWeight: 600 }}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
