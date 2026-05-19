export const THEMES = {
  dark: {
    bg:           '#0a0a0a',
    bgSecondary:  '#111111',
    bgTertiary:   '#1a1a1a',
    bgHover:      '#161616',
    bgActive:     '#1a2a3a',
    selection:    '#1e3a5f',
    border:       '#222222',
    borderSubtle: '#171717',
    text:         '#e0e0e0',
    textMuted:    '#888888',
    textDim:      '#444444',
    input:        '#1a1a1a',
    aff:          '#3b82f6',
    neg:          '#ef4444',
    block:        '#ef4444',
    cx:           '#34d399',
    caret:        '#ffffff',
  },
  light: {
    bg:           '#ffffff',
    bgSecondary:  '#f5f5f5',
    bgTertiary:   '#ebebeb',
    bgHover:      '#f0f0f0',
    bgActive:     '#dbeafe',
    selection:    '#bfdbfe',
    border:       '#e0e0e0',
    borderSubtle: '#eeeeee',
    text:         '#111111',
    textMuted:    '#777777',
    textDim:      '#bbbbbb',
    input:        '#f5f5f5',
    aff:          '#1d4ed8',
    neg:          '#b91c1c',
    block:        '#b91c1c',
    cx:           '#065f46',
    caret:        '#000000',
  },
};

export function useTheme(themeName) {
  return THEMES[themeName] ?? THEMES.dark;
}

export function getAffColor(settings, theme) {
  return settings?.affColor || theme.aff;
}

export function getNegColor(settings, theme) {
  return settings?.negColor || theme.neg;
}

export function getSpeechColor(speech, theme, settings) {
  if (speech === 'Block') return getNegColor(settings, theme);
  if (['1AC', '2AC', '1AR', '2AR'].includes(speech)) return getAffColor(settings, theme);
  if (['1NC', '2NR'].includes(speech)) return getNegColor(settings, theme);
  if (speech.includes('CX')) return theme.cx;
  return theme.text;
}
