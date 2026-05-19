import { useState, useEffect, useRef, useCallback } from 'react';
import useStore from './store';
import { useTheme } from './theme';
import { exportSheetCSV, exportJflow } from './export';

export default function CommandPalette({ open, onClose, onAddSheet, onOpenMeta, onBack, onStartRename }) {
  const settings    = useStore(s => s.settings);
  const keybindings = useStore(s => s.keybindings);
  const storeAddSheet = useStore(s => s.addSheet);
  const deleteSheet = useStore(s => s.deleteSheet);
  const round       = useStore(s => s.rounds.find(r => r.id === s.activeRoundId) ?? null);
  const theme = useTheme(settings.theme);

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef(null);

  const addSheet = onAddSheet ?? storeAddSheet;

  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => {
      setQuery('');
      inputRef.current?.focus();
    }, 0);
    return () => clearTimeout(id);
  }, [open]);

  const sheet = round?.sheets.find(s => s.id === round.activeSheetId);
  const kb = (id) => keybindings[id] ?? '';

  const commands = [
    { id: 'new-off', label: 'New Off-Case Sheet', hint: kb('sheet.newOff'),
      action: () => {
        if (!round) return;
        const n = round.sheets.filter(s => s.type === 'offcase').length;
        addSheet('offcase', `Off ${n + 1}`); onClose();
      } },
    { id: 'new-aff', label: 'New Aff Sheet', hint: kb('sheet.newAff'),
      action: () => {
        if (!round) return;
        const n = round.sheets.filter(s => s.type === 'aff').length;
        addSheet('aff', n === 0 ? 'Case' : `Aff ${n + 1}`); onClose();
      } },
    { id: 'rename',       label: 'Rename Current Sheet',     hint: kb('sheet.rename'),
      action: () => { if (!sheet) return; onStartRename?.(sheet.id); onClose(); } },
    { id: 'delete',       label: 'Delete Current Sheet',     hint: '',
      action: () => { if (!sheet) return; if (confirm(`Delete "${sheet.name}"?`)) deleteSheet(sheet.id); onClose(); } },
    { id: 'export-sheet', label: 'Export Sheet as CSV',      hint: kb('export.sheet'),
      action: () => { if (sheet) exportSheetCSV(sheet); onClose(); } },
    { id: 'export-round', label: 'Export Round CSV', hint: kb('export.round'),
      action: () => { window.dispatchEvent(new CustomEvent('new-sheet-export-round')); onClose(); } },
    { id: 'export-jflow', label: 'Export Backup File', hint: '',
      action: () => { if (round) exportJflow(round); onClose(); } },
    { id: 'round-info',   label: 'Edit Round Info',          hint: kb('round.info'),
      action: () => { onOpenMeta?.(); onClose(); } },
    { id: 'dashboard',    label: 'Back to Dashboard',        hint: kb('ui.dashboard'),
      action: () => { onBack?.(); onClose(); } },
  ];

  const filtered = commands.filter(c => !query || c.label.toLowerCase().includes(query.toLowerCase()));

  const handleKey = useCallback((e) => {
    if (e.key === 'Escape')    { onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(i => Math.min(i + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter')     { e.preventDefault(); filtered[selected]?.action(); }
  }, [filtered, selected, onClose]);

  if (!open) return null;

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 80, zIndex: 1000 }}
      onClick={onClose}
    >
      <div
        style={{ background: theme.bgSecondary, border: `1px solid ${theme.border}`, borderRadius: 8, width: 520, maxHeight: 400, display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.7)' }}
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKey}
      >
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: theme.textMuted, fontSize: 13 }}>{'>'}</span>
          <input
            ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
            onInput={() => setSelected(0)}
            placeholder="Type a command..."
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: theme.text, fontSize: 13, fontFamily: 'inherit' }}
          />
        </div>

        <div style={{ overflowY: 'auto', padding: '4px 0' }}>
          {filtered.map((cmd, i) => (
            <div key={cmd.id} onClick={cmd.action} onMouseEnter={() => setSelected(i)}
              style={{ padding: '8px 14px', cursor: 'pointer', background: i === selected ? theme.bgTertiary : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <span style={{ color: theme.text, fontSize: 13 }}>{cmd.label}</span>
              {cmd.hint && <code style={{ fontSize: 11, color: theme.textMuted, background: theme.bgTertiary, padding: '1px 6px', borderRadius: 3 }}>{cmd.hint}</code>}
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: '16px', color: theme.textMuted, fontSize: 13, textAlign: 'center' }}>No matching commands</div>
          )}
        </div>

        <div style={{ padding: '5px 14px', borderTop: `1px solid ${theme.borderSubtle}`, display: 'flex', gap: 14, fontSize: 11, color: theme.textDim }}>
          <span>arrows navigate</span><span>enter select</span><span>esc close</span>
        </div>
      </div>
    </div>
  );
}
