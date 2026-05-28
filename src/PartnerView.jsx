import { useState, useEffect } from 'react';
import { sortSheetsForDisplay } from './store';
import { ReadOnlyGrid } from './TeamViewer';

const TYPE_LABEL = { aff: 'Aff', offcase: 'Off' };

export default function PartnerView({ round, partnerActiveId, settings, theme, ui, affColor, negColor, partnerAllowsEdits, onCellEdit }) {
  const sheets = sortSheetsForDisplay(round?.sheets ?? []).filter(s => s.type !== 'cx');
  const [viewSheetId, setViewSheetId] = useState(null);

  useEffect(() => {
    setViewSheetId(id => id ?? partnerActiveId ?? sheets[0]?.id ?? null);
  }, [partnerActiveId]);

  const activeViewId = viewSheetId ?? partnerActiveId ?? sheets[0]?.id ?? null;
  const activeSheet  = sheets.find(s => s.id === activeViewId) ?? sheets[0] ?? null;

  if (!round) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, color: theme.textMuted, fontSize: 13 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', animation: 'pulse-dot 1.5s ease-in-out infinite' }} />
        <style>{`@keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(1.3)} }`}</style>
        Waiting for partner's flow…
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Partner sheet tabs */}
      <div style={{ display: 'flex', alignItems: 'center', background: ui.toolbarBg, borderBottom: `1px solid ${ui.border}`, overflowX: 'auto', flexShrink: 0, height: ui.tabHeight }}>
        {sheets.map(sh => {
          const isActive      = sh.id === activeViewId;
          const isPartnerHere = sh.id === partnerActiveId;
          const color         = sh.type === 'aff' ? affColor : sh.type === 'offcase' ? negColor : theme.textMuted;
          return (
            <div
              key={sh.id}
              onClick={() => setViewSheetId(sh.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '0 10px', height: '100%', cursor: 'pointer', flexShrink: 0,
                borderRight: `1px solid ${ui.borderSubtle}`,
                borderLeft: '3px solid transparent',
                borderBottom: `2px solid ${isActive ? color : 'transparent'}`,
                background: isActive ? ui.tabActiveBg : ui.tabInactiveBg,
                boxShadow: isActive ? ui.tabActiveShadow : 'none',
                whiteSpace: 'nowrap', userSelect: 'none', boxSizing: 'border-box',
              }}
            >
              <span style={{ fontSize: 9, fontWeight: 700, color, padding: '1px 4px', background: `${color}22`, borderRadius: ui.radius }}>
                {TYPE_LABEL[sh.type] ?? '?'}
              </span>
              <span style={{ fontSize: 12, color: isActive ? theme.text : theme.textMuted }}>{sh.name}</span>
              {isPartnerHere && (
                <span
                  style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }}
                  title="Partner is viewing this sheet"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <ReadOnlyGrid
          sheet={activeSheet}
          settings={settings}
          theme={theme}
          ui={ui}
          editable={partnerAllowsEdits}
          onCellEdit={onCellEdit}
        />
      </div>
    </div>
  );
}
