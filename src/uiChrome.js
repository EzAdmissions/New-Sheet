export const UI_STYLE_OPTIONS = [
  ['modern', 'Modern'],
  ['classicWin', 'Classic Windows'],
  ['compact', 'Compact Utility'],
  ['softGray', 'Soft Gray'],
];

export function getUiChrome(settings, theme) {
  const style = settings?.uiStyle ?? 'modern';
  const dark = settings?.theme === 'dark';

  if (style === 'classicWin') {
    return {
      id: style,
      fontFamily: 'Tahoma, "MS Sans Serif", Arial, sans-serif',
      toolbarBg: dark ? '#2b2b2b' : '#d4d0c8',
      panelBg: dark ? '#202020' : '#d4d0c8',
      cardBg: dark ? '#202020' : '#d4d0c8',
      inputBg: dark ? '#111' : '#fff',
      border: dark ? '#777' : '#808080',
      borderSubtle: dark ? '#555' : '#ffffff',
      radius: 0,
      cardRadius: 0,
      toolbarHeight: 34,
      tabHeight: 28,
      statusHeight: 20,
      buttonPadding: '2px 10px',
      buttonBg: dark ? '#333' : '#d4d0c8',
      buttonColor: theme.text,
      buttonBorder: dark ? '#777' : '#808080',
      buttonShadow: dark
        ? 'inset 1px 1px 0 #555, inset -1px -1px 0 #000'
        : 'inset 1px 1px 0 #fff, inset -1px -1px 0 #808080',
      cardShadow: 'none',
      modalShadow: 'none',
      tabActiveBg: dark ? '#111' : '#ece9d8',
      tabInactiveBg: 'transparent',
      headerWeight: 700,
      uppercaseLabels: false,
    };
  }

  if (style === 'compact') {
    return {
      id: style,
      fontFamily: 'Arial, Helvetica, sans-serif',
      toolbarBg: theme.bg,
      panelBg: theme.bgSecondary,
      cardBg: theme.bgSecondary,
      inputBg: theme.input,
      border: theme.border,
      borderSubtle: theme.borderSubtle,
      radius: 2,
      cardRadius: 3,
      toolbarHeight: 32,
      tabHeight: 27,
      statusHeight: 18,
      buttonPadding: '2px 8px',
      buttonBg: theme.bg,
      buttonColor: theme.textMuted,
      buttonBorder: theme.border,
      buttonShadow: 'none',
      cardShadow: 'none',
      modalShadow: '0 8px 28px rgba(0,0,0,0.22)',
      tabActiveBg: theme.bgSecondary,
      tabInactiveBg: 'transparent',
      headerWeight: 700,
      uppercaseLabels: true,
    };
  }

  if (style === 'softGray') {
    return {
      id: style,
      fontFamily: 'Inter, "Segoe UI", Arial, sans-serif',
      toolbarBg: dark ? '#20242b' : '#f3f4f6',
      panelBg: dark ? '#1d2128' : '#f8fafc',
      cardBg: dark ? '#20242b' : '#ffffff',
      inputBg: theme.input,
      border: dark ? '#3a4049' : '#d1d5db',
      borderSubtle: dark ? '#2f3540' : '#e5e7eb',
      radius: 6,
      cardRadius: 6,
      toolbarHeight: 40,
      tabHeight: 32,
      statusHeight: 20,
      buttonPadding: '4px 11px',
      buttonBg: dark ? '#262b33' : '#ffffff',
      buttonColor: theme.text,
      buttonBorder: dark ? '#3a4049' : '#d1d5db',
      buttonShadow: 'none',
      cardShadow: dark ? 'none' : '0 1px 2px rgba(15,23,42,0.06)',
      modalShadow: '0 18px 50px rgba(0,0,0,0.28)',
      tabActiveBg: theme.bg,
      tabInactiveBg: 'transparent',
      headerWeight: 750,
      uppercaseLabels: true,
    };
  }

  return {
    id: 'modern',
    fontFamily: 'Inter, system-ui, sans-serif',
    toolbarBg: theme.bgSecondary,
    panelBg: theme.bgSecondary,
    cardBg: theme.bgSecondary,
    inputBg: theme.input,
    border: theme.border,
    borderSubtle: theme.borderSubtle,
    radius: 4,
    cardRadius: 8,
    toolbarHeight: 40,
    tabHeight: 32,
    statusHeight: 20,
    buttonPadding: '3px 10px',
    buttonBg: 'transparent',
    buttonColor: theme.textMuted,
    buttonBorder: theme.border,
    buttonShadow: 'none',
    cardShadow: 'none',
    modalShadow: '0 20px 60px rgba(0,0,0,0.5)',
    tabActiveBg: theme.bg,
    tabInactiveBg: 'transparent',
    headerWeight: 800,
    uppercaseLabels: true,
  };
}

export function chromeButton(theme, ui, extra = {}) {
  return {
    padding: ui.buttonPadding,
    background: ui.buttonBg,
    border: `1px solid ${ui.buttonBorder}`,
    borderRadius: ui.radius,
    boxShadow: ui.buttonShadow,
    color: ui.buttonColor,
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: 'inherit',
    ...extra,
  };
}
