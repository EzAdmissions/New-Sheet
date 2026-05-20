import { useState } from 'react';
import useStore from './store';
import { ACTIONS, ACTION_GROUPS, DEFAULT_KEYBINDINGS, formatShortcut, keyEventToString } from './keybindings';
import { useTheme } from './theme';
import { useDialog } from './Dialog';

export default function KeybindingsPanel() {
  const settings         = useStore(s => s.settings);
  const keybindings      = useStore(s => s.keybindings);
  const updateKeybinding = useStore(s => s.updateKeybinding);
  const resetKeybindings = useStore(s => s.resetKeybindings);
  const theme = useTheme(settings.theme);

  const { showConfirm } = useDialog();
  const [recording, setRecording] = useState(null); // actionId being recorded

  // Build reverse map: binding → [actionId]
  const usedBindings = {};
  for (const [id, binding] of Object.entries(keybindings)) {
    if (!usedBindings[binding]) usedBindings[binding] = [];
    usedBindings[binding].push(id);
  }

  const handleRecordKey = async (e) => {
    if (!recording) return;
    e.preventDefault();
    e.stopPropagation();
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return; // modifier alone
    if (e.key === 'Escape') { setRecording(null); return; }

    const combo = keyEventToString(e, settings.keyboardMode);

    // Check for conflicts
    const conflicts = (usedBindings[combo] ?? []).filter(id => id !== recording);
    if (conflicts.length > 0) {
      const names = conflicts.map(id => ACTIONS[id]?.label ?? id).join(', ');
      const ok = await showConfirm(`"${combo}" is already used by: ${names}\n\nOverwrite it?`, { confirmLabel: 'Overwrite' });
      if (!ok) { setRecording(null); return; }
      for (const id of conflicts) updateKeybinding(id, '');
    }

    updateKeybinding(recording, combo);
    setRecording(null);
  };

  return (
    <div
      onKeyDown={recording ? handleRecordKey : undefined}
      style={{ outline: 'none' }}
      tabIndex={recording ? -1 : undefined}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ color: theme.text, fontWeight: 600, fontSize: 14 }}>Keyboard Shortcuts</span>
        <button
          onClick={async () => { if (await showConfirm('Reset all keybindings to defaults?', { confirmLabel: 'Reset' })) resetKeybindings(); }}
          style={{ padding: '4px 10px', background: theme.bgTertiary, border: `1px solid ${theme.border}`, borderRadius: 4, color: theme.textMuted, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Reset Defaults
        </button>
      </div>

      {ACTION_GROUPS.map(group => (
        <div key={group} style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: theme.textMuted, marginBottom: 8, paddingBottom: 4, borderBottom: `1px solid ${theme.borderSubtle}` }}>
            {group}
          </div>
          {Object.entries(ACTIONS)
            .filter(([, a]) => a.group === group)
            .map(([id, action]) => {
              const binding = keybindings[id] ?? DEFAULT_KEYBINDINGS[id] ?? '';
              const isRecording = recording === id;
              const isDefault = binding === DEFAULT_KEYBINDINGS[id];
              const displayBinding = formatShortcut(binding, settings.keyboardMode);

              return (
                <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: theme.text, flex: 1 }}>{action.label}</span>
                  <button
                    onClick={() => setRecording(isRecording ? null : id)}
                    style={{
                      padding: '3px 10px',
                      background: isRecording ? theme.aff + '22' : theme.bgTertiary,
                      border: `1px solid ${isRecording ? theme.aff : theme.border}`,
                      borderRadius: 4,
                      color: isRecording ? theme.aff : binding ? theme.text : theme.textDim,
                      fontSize: 11,
                      fontFamily: 'monospace',
                      cursor: 'pointer',
                      minWidth: 100,
                      textAlign: 'center',
                      fontWeight: isDefault ? 400 : 600,
                    }}
                  >
                    {isRecording ? 'Press key...' : displayBinding || 'Unbound'}
                  </button>
                </div>
              );
            })}
        </div>
      ))}

      {recording && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
          onKeyDown={handleRecordKey}
          tabIndex={0}
          ref={el => el?.focus()}
        >
          <div style={{ background: theme.bgSecondary, border: `1px solid ${theme.border}`, borderRadius: 8, padding: 28, textAlign: 'center' }}>
            <div style={{ fontSize: 14, color: theme.text, marginBottom: 8 }}>
              Recording: <strong>{ACTIONS[recording]?.label}</strong>
            </div>
            <div style={{ fontSize: 12, color: theme.textMuted }}>Press any key combo · Esc to cancel</div>
          </div>
        </div>
      )}
    </div>
  );
}
