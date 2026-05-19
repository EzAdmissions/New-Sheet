import { useState } from 'react';
import useStore, { roundDisplayName } from './store';
import { useTheme, getAffColor } from './theme';

export default function RoundMeta({ round, onClose }) {
  const updateRoundMeta = useStore(s => s.updateRoundMeta);
  const settings = useStore(s => s.settings);
  const theme = useTheme(settings.theme);
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
      <input value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={placeholder}
        style={{ width: '100%', padding: '6px 10px', background: theme.input, border: `1px solid ${theme.border}`, borderRadius: 4, color: theme.text, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }} />
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: theme.bgSecondary, border: `1px solid ${theme.border}`, borderRadius: 8, width: 420, padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ color: theme.text, fontWeight: 700, fontSize: 15 }}>Round Info</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: theme.textMuted, fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 16, padding: '6px 10px', background: theme.bgTertiary, borderRadius: 4, border: `1px solid ${theme.borderSubtle}` }}>
          {preview}
        </div>

        {field('tournament', 'Tournament', 'Berkeley')}
        {field('roundNum', 'Round', 'Quarterfinals')}
        {field('judges', 'Judge', 'Kevin Hirn, Brett Bricker, Dana Randall')}
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>{field('affSchool', 'Aff School', 'Head-Royce')}</div>
          <div style={{ flex: 1 }}>{field('affCode', 'Aff Code', 'AJ')}</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>{field('negSchool', 'Neg School', 'Taipei')}</div>
          <div style={{ flex: 1 }}>{field('negCode', 'Neg Code', 'YH')}</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
          <button onClick={onClose} style={{ padding: '7px 16px', background: theme.bgTertiary, border: `1px solid ${theme.border}`, borderRadius: 4, color: theme.textMuted, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>Cancel</button>
          <button onClick={() => { updateRoundMeta(round.id, form); onClose(); }}
            style={{ padding: '7px 16px', background: affColor, border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
