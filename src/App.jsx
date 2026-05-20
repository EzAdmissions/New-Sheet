import { useState, useCallback, useRef } from 'react';
import useStore, { sortSheetsForDisplay } from './store';
import { useTheme, getAffColor, getNegColor } from './theme';
import Dashboard from './Dashboard';
import FlowGrid from './FlowGrid';
import SettingsPanel from './SettingsPanel';
import RoundMeta from './RoundMeta';
import { getUiChrome, chromeButton } from './uiChrome';

const TYPE_LABEL = { aff: 'Aff', offcase: 'Off' };

export default function App() {
  const view           = useStore(s => s.view);
  const settings       = useStore(s => s.settings);
  const setView        = useStore(s => s.setView);
  const setActiveSheet = useStore(s => s.setActiveSheet);
  const addSheet       = useStore(s => s.addSheet);
  const renameSheet    = useStore(s => s.renameSheet);
  const deleteSheet    = useStore(s => s.deleteSheet);
  const swapSheets     = useStore(s => s.swapSheets);
  const pendingNameSheetIds = useStore(s => s.pendingNameSheetIds);
  const round          = useStore(s => s.rounds.find(r => r.id === s.activeRoundId) ?? null);
  const theme = useTheme(settings.theme);
  const ui = getUiChrome(settings, theme);
  const affColor = getAffColor(settings, theme);
  const negColor = getNegColor(settings, theme);

  const [settingsOpen,    setSettingsOpen]     = useState(false);
  const [settingsTab,     setSettingsTab]      = useState('display');
  const [metaOpen,        setMetaOpen]         = useState(false);
  const [offCount,        setOffCount]         = useState('');
  const [renamingSheetId, setRenamingSheetId] = useState(null);
  const [dragOverId,      setDragOverId]       = useState(null);
  const dragSrcId    = useRef(null);
  const namingInputRef = useRef(null);

  const activeSheet = round?.sheets.find(s => s.id === round.activeSheetId) ?? null;
  const handleBack  = useCallback(() => setView('dashboard'), [setView]);
  const openSettings = useCallback((tab = 'display') => {
    setSettingsTab(tab);
    setSettingsOpen(true);
  }, [setSettingsOpen, setSettingsTab]);

  const showNamingBar = activeSheet && (
    renamingSheetId === activeSheet.id ||
    pendingNameSheetIds.includes(activeSheet.id)
  );
  const namingBarLabel = renamingSheetId === activeSheet?.id && !(activeSheet.needsName ?? false) ? 'Rename:' : 'Name:';

  // Create sheet immediately, mark pending so naming bar shows
  const addOff = useCallback(() => {
    if (!round) return;
    const n = round.sheets.filter(s => s.type === 'offcase').length;
    const id = addSheet('offcase', `Off ${n + 1}`);
    setActiveSheet(id);
  }, [round, addSheet, setActiveSheet]);

  const addAff = useCallback(() => {
    if (!round) return;
    const n = round.sheets.filter(s => s.type === 'aff').length;
    const id = addSheet('aff', n === 0 ? 'Case' : `Aff ${n + 1}`);
    setActiveSheet(id);
  }, [round, addSheet, setActiveSheet]);

  const confirmName = useCallback((name) => {
    if (!activeSheet) return;
    const trimmed = name.trim();
    if (trimmed) renameSheet(activeSheet.id, trimmed);
    setRenamingSheetId(null);
    window.dispatchEvent(new CustomEvent('jayflow-focus-grid'));
  }, [activeSheet, renameSheet]);

  const cancelName = useCallback(() => {
    if (!activeSheet) return;
    setRenamingSheetId(null);
  }, [activeSheet]);

  const handleStartRename = useCallback((sheetId) => {
    const id = sheetId ?? activeSheet?.id;
    if (!id) return;
    setActiveSheet(id);
    setRenamingSheetId(id);
  }, [activeSheet, setActiveSheet]);

  const handleDeleteSheet = useCallback((sheetId) => {
    const id = sheetId ?? activeSheet?.id;
    if (!id) return;
    if (renamingSheetId === id) setRenamingSheetId(null);
    deleteSheet(id);
  }, [activeSheet, deleteSheet, renamingSheetId]);

  const handleAddSheet = useCallback((type, name) => {
    const id = addSheet(type, name);
    setActiveSheet(id);
    setRenamingSheetId(null);
    return id;
  }, [addSheet, setActiveSheet]);

  const handleBulkOff = useCallback((e) => {
    if (e.key !== 'Enter' || !offCount || !round) return;
    const count = Math.max(1, Math.min(20, parseInt(offCount) || 1));
    const base = round.sheets.filter(s => s.type === 'offcase').length;
    const newIds = [];
    for (let i = 0; i < count; i++) {
      const id = addSheet('offcase', `Off ${base + i + 1}`);
      newIds.push(id);
    }
    if (newIds.length > 0) {
      setActiveSheet(newIds[0]);
      setRenamingSheetId(null);
    }
    setOffCount('');
  }, [offCount, round, addSheet, setActiveSheet, setOffCount]);

  if (view === 'dashboard') {
    return (
      <>
        <Dashboard onOpenSettings={() => openSettings('display')} />
        <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} initialTab={settingsTab} />
      </>
    );
  }

  if (!round || !activeSheet) { setView('dashboard'); return null; }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: ui.appBg ?? theme.bg, color: theme.text, fontFamily: ui.fontFamily, overflow: 'hidden' }}>

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 10px', height: ui.toolbarHeight, background: ui.toolbarBg, borderBottom: `1px solid ${ui.border}`, gap: 8, flexShrink: 0 }}>
        <button onClick={handleBack} style={tbBtn(theme, ui)}>Dashboard</button>
        <button onClick={() => setMetaOpen(true)} style={{ ...tbBtn(theme, ui), maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Round Info
        </button>
        <div style={{ flex: 1 }} />
        <button onClick={() => window.dispatchEvent(new CustomEvent('new-sheet-export-round-html'))} style={tbBtn(theme, ui)}>Export</button>
        <button onClick={() => openSettings('display')} style={tbBtn(theme, ui)}>Settings</button>
      </div>

      {/* Sheet tabs - sorted: aff first, then off */}
      <div style={{ display: 'flex', alignItems: 'center', background: ui.toolbarBg, borderBottom: `1px solid ${ui.border}`, overflowX: 'auto', flexShrink: 0, height: ui.tabHeight }}>
        {sortSheetsForDisplay(round.sheets)
          .filter(sh => sh.type !== 'cx')
          .map(sh => {
          const isActive = sh.id === round.activeSheetId;
          const color = sh.type === 'aff' ? affColor : sh.type === 'offcase' ? negColor : theme.textMuted;
          const isDraggable = sh.type === 'offcase';
          const isDragOver = dragOverId === sh.id;
          return (
            <div
              key={sh.id}
              draggable={isDraggable}
              onClick={() => setActiveSheet(sh.id)}
              onDoubleClick={() => { setActiveSheet(sh.id); setRenamingSheetId(sh.id); }}
              onDragStart={() => { dragSrcId.current = sh.id; }}
              onDragOver={e => { if (sh.type === 'offcase') { e.preventDefault(); setDragOverId(sh.id); } }}
              onDragLeave={() => setDragOverId(null)}
              onDrop={e => {
                e.preventDefault();
                setDragOverId(null);
                if (dragSrcId.current && dragSrcId.current !== sh.id && sh.type === 'offcase')
                  swapSheets(dragSrcId.current, sh.id);
                dragSrcId.current = null;
              }}
              onDragEnd={() => { dragSrcId.current = null; setDragOverId(null); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '0 10px', height: '100%',
                cursor: isDraggable ? 'grab' : 'pointer', flexShrink: 0,
                borderRight: `1px solid ${ui.borderSubtle}`,
                borderLeft: isDragOver ? `3px solid ${affColor}` : '3px solid transparent',
                borderBottom: `2px solid ${isActive ? color : 'transparent'}`,
                background: isDragOver ? `${affColor}15` : isActive ? ui.tabActiveBg : ui.tabInactiveBg,
                boxShadow: isActive ? ui.tabActiveShadow : 'none',
                whiteSpace: 'nowrap', userSelect: 'none',
                boxSizing: 'border-box',
              }}
            >
              <span style={{ fontSize: 9, fontWeight: 700, color, padding: '1px 4px', background: `${color}22`, borderRadius: ui.radius }}>
                {TYPE_LABEL[sh.type] ?? '?'}
              </span>
              <span style={{ fontSize: 12, color: isActive ? theme.text : theme.textMuted }}>{sh.name}</span>
              <span onClick={e => { e.stopPropagation(); handleDeleteSheet(sh.id); }} style={{ color: theme.textDim, fontSize: 11, cursor: 'pointer', paddingLeft: 2, lineHeight: 1 }}>✕</span>
            </div>
          );
        })}

        {/* Quick-add buttons */}
        <div style={{ display: 'flex', gap: 4, padding: '0 8px', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <QuickAdd color={negColor} label="+ Off" onClick={addOff} ui={ui} />
            <input
              type="text"
              inputMode="numeric"
              value={offCount}
              onChange={e => setOffCount(e.target.value.replace(/[^0-9]/g, ''))}
              onKeyDown={handleBulkOff}
              title="Type a number and press Enter to add multiple off-case sheets"
              style={{
                width: 34, height: 20, padding: '0 4px',
                background: 'transparent',
                border: `1px solid ${negColor}44`,
                borderRadius: ui.radius, color: negColor,
                fontSize: 10, textAlign: 'center', outline: 'none',
                fontFamily: 'inherit',
              }}
            />
          </div>
          <QuickAdd color={affColor} label="+ Aff" onClick={addAff} ui={ui} />
        </div>
      </div>

      {/* Naming / rename bar — appears when a new sheet needs a name or explicit rename triggered */}
      {showNamingBar && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px', background: ui.toolbarBg, borderBottom: `1px solid ${ui.border}`, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: theme.textMuted, whiteSpace: 'nowrap' }}>
            {namingBarLabel}
          </span>
          <input
            key={activeSheet.id}
            ref={el => { namingInputRef.current = el; if (el) setTimeout(() => el.focus(), 0); }}
            defaultValue={activeSheet.name}
            onKeyDown={e => {
              if (e.key === 'Enter')  { e.preventDefault(); confirmName(e.currentTarget.value); return; }
              if (e.key === 'Escape') { e.preventDefault(); cancelName(); return; }

              // Allow tab-management shortcuts while the naming bar is focused
              const ctrl = e.ctrlKey || e.metaKey;
              if (e.altKey && !ctrl && e.key.toLowerCase() === 'n') {
                e.preventDefault(); addOff(); return;
              }
              if (e.altKey && !ctrl && e.key.toLowerCase() === 'a') {
                e.preventDefault(); addAff(); return;
              }
              if (ctrl && !e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
                e.preventDefault();
                cancelName();
                const sorted = sortSheetsForDisplay(round.sheets)
                  .filter(sh => sh.type !== 'cx');
                const idx = sorted.findIndex(s => s.id === activeSheet.id);
                if (e.key === 'ArrowRight' && idx < sorted.length - 1) setActiveSheet(sorted[idx + 1].id);
                if (e.key === 'ArrowLeft'  && idx > 0)                 setActiveSheet(sorted[idx - 1].id);
                return;
              }
              if (ctrl && e.key === 'Backspace') {
                e.preventDefault(); cancelName(); handleDeleteSheet(activeSheet.id); return;
              }
            }}
            style={{
              flex: 1, maxWidth: 240, height: 22, padding: '0 8px',
              background: theme.bg, border: `1px solid ${activeSheet.type === 'aff' ? affColor : activeSheet.type === 'offcase' ? negColor : affColor}`,
              borderRadius: ui.radius, color: theme.text, fontSize: 12,
              fontFamily: 'inherit', outline: 'none',
            }}
          />
          <span style={{ fontSize: 10, color: theme.textDim }}>Enter to confirm · Esc to cancel · Alt+N/A for new sheet</span>
        </div>
      )}

      {/* Flow */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <FlowGrid
          sheet={activeSheet}
          round={round}
          onOpenSettings={openSettings}
          onOpenMeta={() => setMetaOpen(true)}
          onBack={handleBack}
          onRename={renameSheet}
          onAddSheet={handleAddSheet}
          onStartRename={handleStartRename}
          onDeleteSheet={handleDeleteSheet}
        />
      </div>

      {/* Status bar */}
      <div style={{ height: ui.statusHeight, background: ui.toolbarBg, borderTop: `1px solid ${ui.borderSubtle}`, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 14, fontSize: 10, color: theme.textDim, flexShrink: 0 }}>
        <span>Ctrl+K · keybindings</span>
        <span>Tab · next speech</span>
        <span>Enter · next row</span>
        <span>Ctrl+← → · switch sheet</span>
        <span>Ctrl+scroll · zoom</span>
        <div style={{ flex: 1 }} />
        {round.affCode && <span style={{ color: affColor }}>Aff: {round.affCode}</span>}
        {round.negCode && <span style={{ color: negColor }}>Neg: {round.negCode}</span>}
        {round.judges  && <span>Judge(s): {round.judges}</span>}
      </div>

      <SettingsPanel  open={settingsOpen} onClose={() => setSettingsOpen(false)} initialTab={settingsTab} />
      {metaOpen && <RoundMeta round={round} onClose={() => setMetaOpen(false)} />}
    </div>
  );
}

const tbBtn = (theme, ui) => chromeButton(theme, ui);

function QuickAdd({ color, label, onClick, ui }) {
  return (
    <button onClick={onClick} style={{ padding: '1px 7px', background: `${color}18`, border: `1px solid ${color}44`, borderRadius: ui.radius, color, fontSize: 10, cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}>
      {label}
    </button>
  );
}
