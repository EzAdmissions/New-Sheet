export const ACTIONS = {
  'nav.down':      { label: 'Move Down',             group: 'Navigation', default: 'ArrowDown' },
  'nav.up':        { label: 'Move Up',               group: 'Navigation', default: 'ArrowUp' },
  'nav.right':     { label: 'Move Right',            group: 'Navigation', default: 'ArrowRight' },
  'nav.left':      { label: 'Move Left',             group: 'Navigation', default: 'ArrowLeft' },
  'nav.nextArg':   { label: 'Next Argument Slot',    group: 'Navigation', default: 'Enter' },
  'nav.nextCol':   { label: 'Next Speech Column',    group: 'Navigation', default: 'Tab' },
  'nav.prevCol':   { label: 'Prev Speech Column',    group: 'Navigation', default: 'Shift+Tab' },
  'nav.extendArg': { label: 'Extend Argument Space', group: 'Navigation', default: 'Alt+Enter' },
  'arg.extend':    { label: 'Extend Argument',       group: 'Navigation', default: 'Alt+G' },

  'sheet.nextTab': { label: 'Next Sheet Tab',        group: 'Navigation', default: 'Ctrl+ArrowRight' },
  'sheet.prevTab': { label: 'Prev Sheet Tab',        group: 'Navigation', default: 'Ctrl+ArrowLeft' },

  'sheet.newOff':  { label: 'New Off-Case Sheet',    group: 'Sheets',     default: 'Alt+N' },
  'sheet.newAff':  { label: 'New Aff Sheet',         group: 'Sheets',     default: 'Alt+A' },
  'sheet.rename':  { label: 'Rename Sheet',          group: 'Sheets',     default: 'F2' },

  'round.info':    { label: 'Edit Round Info',       group: 'Round',      default: 'Alt+I' },

  'export.sheet':  { label: 'Export Sheet CSV',      group: 'Export',     default: 'Alt+E' },
  'export.round':  { label: 'Export Round CSV',      group: 'Export',     default: 'Alt+Shift+E' },

  'ui.commands':   { label: 'Command Palette',       group: 'UI',         default: 'Ctrl+K' },
  'ui.settings':   { label: 'Settings',              group: 'UI',         default: 'Ctrl+,' },
  'ui.dashboard':  { label: 'Back to Dashboard',     group: 'UI',         default: 'Alt+H' },

  'zoom.in':       { label: 'Zoom In',               group: 'Zoom',       default: 'Ctrl+=' },
  'zoom.out':      { label: 'Zoom Out',              group: 'Zoom',       default: 'Ctrl+-' },
  'zoom.reset':    { label: 'Reset Zoom',            group: 'Zoom',       default: 'Alt+0' },
};

export const DEFAULT_KEYBINDINGS = Object.fromEntries(
  Object.entries(ACTIONS).map(([id, { default: d }]) => [id, d])
);

export const ACTION_GROUPS = [...new Set(Object.values(ACTIONS).map(a => a.group))];

export function keyEventToString(e) {
  const parts = [];
  const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
  if (e.ctrlKey)  parts.push('Ctrl');
  if (e.altKey)   parts.push('Alt');
  if (e.shiftKey && !['Shift'].includes(e.key)) parts.push('Shift');
  if (!['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) parts.push(key);
  return parts.join('+');
}

export function matchesAction(e, keybindings, actionId) {
  const binding = keybindings[actionId] ?? DEFAULT_KEYBINDINGS[actionId];
  if (!binding) return false;
  return keyEventToString(e) === binding;
}
