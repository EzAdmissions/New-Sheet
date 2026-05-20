import { useState } from 'react';
import useStore, { roundDisplayName, sortSheetsForDisplay } from './store';
import { useTheme, getAffColor, getNegColor } from './theme';
import { importJflow } from './export';
import { getUiChrome, chromeButton } from './uiChrome';

export default function Dashboard({ onOpenSettings }) {
  const rounds      = useStore(s => s.rounds);
  const folders     = useStore(s => s.folders);
  const activeFolderId = useStore(s => s.activeFolderId);
  const settings    = useStore(s => s.settings);
  const newRound    = useStore(s => s.newRound);
  const openRound   = useStore(s => s.openRound);
  const deleteRound = useStore(s => s.deleteRound);
  const importRound = useStore(s => s.importRound);
  const addFolder   = useStore(s => s.addFolder);
  const renameFolder = useStore(s => s.renameFolder);
  const deleteFolder = useStore(s => s.deleteFolder);
  const setActiveFolder = useStore(s => s.setActiveFolder);
  const moveRoundToFolder = useStore(s => s.moveRoundToFolder);
  const theme = useTheme(settings.theme);
  const ui = getUiChrome(settings, theme);
  const affColor = getAffColor(settings, theme);
  const negColor = getNegColor(settings, theme);
  const [foldersOpen, setFoldersOpen] = useState(false);

  const fmt = (ts) => {
    if (!ts) return '';
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleImport = async () => {
    try {
      const round = await importJflow();
      importRound(round);
    } catch (err) {
      if (err.message !== 'No file') alert(`Import failed: ${err.message}`);
    }
  };

  const handleAddFolder = () => {
    const name = prompt('Folder name');
    if (name?.trim()) addFolder(name);
  };

  const filteredRounds = rounds.filter(r => {
    if (activeFolderId === 'all') return true;
    if (activeFolderId === 'unfiled') return !r.folderId;
    return r.folderId === activeFolderId;
  });
  const sorted = [...filteredRounds].sort((a, b) => (b.lastEdited ?? 0) - (a.lastEdited ?? 0));
  const activeFolderName = activeFolderId === 'all'
    ? 'All Rounds'
    : activeFolderId === 'unfiled'
      ? 'Unfiled'
      : folders.find(f => f.id === activeFolderId)?.name ?? 'Folder';

  return (
    <div style={{
      height: '100vh',
      background: ui.appBg ?? theme.bg,
      backgroundImage: ui.appBackgroundImage,
      backgroundSize: ui.appBackgroundSize,
      backgroundPosition: ui.appBackgroundPosition,
      color: theme.text,
      display: 'flex',
      flexDirection: 'column',
      fontFamily: ui.fontFamily,
    }}>
      {/* Header */}
      <div style={{ padding: '0 32px', height: ui.toolbarHeight + 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${ui.border}`, background: ui.toolbarBg, boxShadow: ui.toolbarShadow, position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <NsLogo />
          <span style={{ fontWeight: ui.headerWeight, fontSize: 18, color: theme.text, letterSpacing: 0 }}>New Sheet</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setFoldersOpen(v => !v)} style={{ ...btnStyle(theme, ui), borderColor: foldersOpen ? affColor : ui.buttonBorder, color: foldersOpen ? affColor : ui.buttonColor }}>
            Folders
          </button>
          <button onClick={onOpenSettings} style={btnStyle(theme, ui)}>Settings</button>
          <button onClick={handleImport}   style={btnStyle(theme, ui)}>Import Backup</button>
          <button
            onClick={newRound}
            style={{ ...btnStyle(theme, ui), background: affColor, borderColor: affColor, color: '#fff', fontWeight: 600 }}
          >
            + New Round
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', position: 'relative' }}>
        {foldersOpen && (
          <>
            <div onClick={() => setFoldersOpen(false)} style={{ position: 'absolute', inset: 0, zIndex: 4 }} />
            <FolderSidebar
              folders={folders}
              rounds={rounds}
              activeFolderId={activeFolderId}
              setActiveFolder={setActiveFolder}
              addFolder={handleAddFolder}
              renameFolder={renameFolder}
              deleteFolder={deleteFolder}
              theme={theme}
              ui={ui}
              affColor={affColor}
              negColor={negColor}
              onClose={() => setFoldersOpen(false)}
            />
          </>
        )}
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px 32px' }}>
        {sorted.length === 0 ? (
          <Empty theme={theme} ui={ui} affColor={affColor} onNew={newRound} label={activeFolderName} />
        ) : (
          <>
            <div style={{ fontSize: 12, color: theme.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 16 }}>
              {activeFolderName} ({sorted.length})
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
              {sorted.map(r => (
                <RoundCard
                  key={r.id}
                  round={r}
                  theme={theme}
                  ui={ui}
                  affColor={affColor}
                  negColor={negColor}
                  folders={folders}
                  onMove={folderId => moveRoundToFolder(r.id, folderId)}
                  onOpen={() => openRound(r.id)}
                  onDelete={() => { if (confirm(`Delete "${roundDisplayName(r)}"?`)) deleteRound(r.id); }}
                  fmt={fmt}
                />
              ))}
              <NewCard theme={theme} ui={ui} affColor={affColor} onClick={newRound} />
            </div>
          </>
        )}
      </div>
      </div>
    </div>
  );
}

function FolderSidebar({ folders, rounds, activeFolderId, setActiveFolder, addFolder, renameFolder, deleteFolder, theme, ui, affColor, negColor, onClose }) {
  const folderCount = (folderId) => rounds.filter(r => folderId === 'unfiled' ? !r.folderId : r.folderId === folderId).length;
  const folderButton = (id, label, count) => {
    const active = activeFolderId === id;
    return (
      <button
        key={id}
        onClick={() => { setActiveFolder(id); onClose?.(); }}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '7px 9px',
          background: active ? ui.tabActiveBg : 'transparent',
          border: `1px solid ${active ? affColor : 'transparent'}`,
          borderRadius: ui.radius,
          color: active ? theme.text : theme.textMuted,
          cursor: 'pointer',
          fontFamily: 'inherit',
          fontSize: 12,
          textAlign: 'left',
          boxShadow: active ? ui.tabActiveShadow : 'none',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        <span style={{ color: active ? affColor : theme.textDim, fontSize: 10 }}>{count}</span>
      </button>
    );
  };

  return (
    <aside style={{ position: 'absolute', top: 12, left: 16, width: 260, maxHeight: 'calc(100% - 24px)', zIndex: 5, padding: 14, border: `1px solid ${ui.border}`, borderRadius: ui.cardRadius, background: ui.panelBg, backgroundImage: ui.panelBackgroundImage ?? ui.appBackgroundImage, backgroundSize: ui.appBackgroundSize, overflowY: 'auto', boxShadow: ui.modalShadow }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ color: theme.textMuted, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' }}>Folders</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={addFolder} style={{ ...btnStyle(theme, ui), padding: '2px 7px', color: affColor, borderColor: affColor }}>+</button>
          <button onClick={onClose} style={{ ...btnStyle(theme, ui), padding: '2px 7px' }}>Close</button>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {folderButton('all', 'All Rounds', rounds.length)}
        {folderButton('unfiled', 'Unfiled', folderCount('unfiled'))}
        {folders.map(folder => (
          <div key={folder.id} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 0 }}>{folderButton(folder.id, folder.name, folderCount(folder.id))}</div>
            <button
              title="Rename folder"
              onClick={() => {
                const name = prompt('Rename folder', folder.name);
                if (name?.trim()) renameFolder(folder.id, name);
              }}
              style={{ ...btnStyle(theme, ui), padding: '2px 5px', fontSize: 10 }}
            >
              Rename
            </button>
            <button
              title="Delete folder"
              onClick={() => { if (confirm(`Delete folder "${folder.name}"? Rounds will move to Unfiled.`)) deleteFolder(folder.id); }}
              style={{ ...btnStyle(theme, ui), padding: '2px 5px', fontSize: 10, color: negColor }}
            >
              Del
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}

function NsLogo() {
  return (
    <div
      aria-hidden="true"
      style={{
        width: 28,
        height: 28,
        borderRadius: 7,
        background: '#1f2933',
        color: '#f8fafc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11,
        fontWeight: 900,
        letterSpacing: 0,
        boxShadow: '0 1px 2px rgba(0,0,0,0.18)',
        flexShrink: 0,
      }}
    >
      NS
    </div>
  );
}

function RoundCard({ round, theme, ui, affColor, negColor, folders, onMove, onOpen, onDelete, fmt }) {
  const name = roundDisplayName(round);
  return (
    <div
      style={{
        background: ui.cardBg, border: `1px solid ${ui.border}`,
        borderRadius: ui.cardRadius, padding: ui.id === 'compact' ? 14 : 18, cursor: 'pointer',
        transition: 'border-color 0.15s', position: 'relative',
        boxShadow: ui.cardShadow,
      }}
      onClick={onOpen}
      onMouseEnter={e => e.currentTarget.style.borderColor = affColor}
      onMouseLeave={e => e.currentTarget.style.borderColor = ui.border}
    >
      <div style={{ fontWeight: 700, fontSize: 15, color: theme.text, marginBottom: 4, paddingRight: 20 }}>
        {name}
      </div>
      {round.judges && (
        <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 6 }}>Judge(s): {round.judges}</div>
      )}
      <select
        value={round.folderId ?? 'unfiled'}
        onClick={e => e.stopPropagation()}
        onChange={e => onMove(e.target.value)}
        style={{ marginTop: 6, maxWidth: '100%', padding: '3px 6px', background: ui.inputBg, border: `1px solid ${ui.borderSubtle}`, borderRadius: ui.radius, color: theme.textMuted, fontSize: 11, fontFamily: 'inherit' }}
      >
        <option value="unfiled">Unfiled</option>
        {folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
      </select>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        {sortSheetsForDisplay(round.sheets).filter(sh => sh.type !== 'cx').map(sh => (
          <span
            key={sh.id}
            style={{
              fontSize: 10, padding: '2px 6px',
              background: theme.bgTertiary, borderRadius: ui.radius,
              color: sh.type === 'aff' ? affColor : sh.type === 'offcase' ? negColor : theme.textMuted,
              border: `1px solid ${ui.borderSubtle}`,
            }}
          >
            {sh.name}
          </span>
        ))}
      </div>
      <div style={{ fontSize: 10, color: theme.textDim, marginTop: 10 }}>{fmt(round.lastEdited)}</div>

      <button
        onClick={e => { e.stopPropagation(); onDelete(); }}
        style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', cursor: 'pointer', color: theme.textDim, fontSize: 14, lineHeight: 1, padding: 4 }}
        onMouseEnter={e => e.currentTarget.style.color = negColor}
        onMouseLeave={e => e.currentTarget.style.color = theme.textDim}
      >
        ✕
      </button>
    </div>
  );
}

function NewCard({ theme, ui, affColor, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'transparent', border: `1.5px dashed ${ui.border}`,
        borderRadius: ui.cardRadius, padding: 18, cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 8, color: theme.textMuted, minHeight: 120,
        transition: 'border-color 0.15s, color 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = affColor; e.currentTarget.style.color = affColor; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = ui.border; e.currentTarget.style.color = theme.textMuted; }}
    >
      <span style={{ fontSize: 28, lineHeight: 1 }}>+</span>
      <span style={{ fontSize: 13, fontWeight: 500 }}>New Round</span>
    </div>
  );
}

function Empty({ theme, ui, affColor, onNew, label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 20, color: theme.textMuted }}>
      <div style={{ fontSize: 20, fontWeight: 600, color: theme.text }}>No rounds in {label}</div>
      <div style={{ fontSize: 14, color: theme.textMuted }}>Create or import a policy debate flow</div>
      <button onClick={onNew} style={{ padding: '10px 28px', background: affColor, border: 'none', borderRadius: ui.radius, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 8, fontFamily: 'inherit' }}>
        New Round
      </button>
    </div>
  );
}

const btnStyle = (theme, ui) => chromeButton(theme, ui, {
  padding: ui.id === 'compact' ? '4px 10px' : '6px 14px',
  fontSize: 13,
});
