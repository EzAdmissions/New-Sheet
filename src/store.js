import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import { DEFAULT_KEYBINDINGS } from './keybindings';

export function roundDisplayName(round) {
  const tournament = round.tournament?.trim();
  const roundNum = round.roundNum?.trim();
  const aff = [round.affSchool, round.affCode].map(v => v?.trim()).filter(Boolean).join(' ');
  const neg = [round.negSchool, round.negCode].map(v => v?.trim()).filter(Boolean).join(' ');

  if (!tournament && !roundNum && !aff && !neg) return round.name?.trim() || 'New Round';

  const roundLabel = roundNum
    ? (/^round\b/i.test(roundNum) || !/^\d+$/.test(roundNum) ? roundNum : `Round ${roundNum}`)
    : '';
  const left = [tournament, roundLabel].filter(Boolean).join(' ');
  const teams = [
    aff && `Aff ${aff}`,
    neg && `Neg ${neg}`,
  ].filter(Boolean).join(' vs. ');

  if (left && teams) return `${left}---${teams}`;
  return left || teams;
}

const SHEET_TYPE_ORDER = { aff: 0, offcase: 1 };

export function sortSheetsForDisplay(sheets = []) {
  return [...sheets]
    .map((sheet, index) => ({ sheet, index }))
    .sort((a, b) => {
      const typeDelta = (SHEET_TYPE_ORDER[a.sheet.type] ?? 2) - (SHEET_TYPE_ORDER[b.sheet.type] ?? 2);
      return typeDelta || a.index - b.index;
    })
    .map(({ sheet }) => sheet);
}

export const SHEET_SPEECHES = {
  aff: ['1AC', '1NC', '2AC', 'Block', '1AR', '2NR', '2AR'],
  offcase: ['1NC', '2AC', 'Block', '1AR', '2NR', '2AR'],
};

export const LD_SHEET_SPEECHES = {
  aff: ['AC', 'NC', '1AR', 'NR', '2AR'],
  offcase: ['NC', '1AR', 'NR', '2AR'],
};

export const PF_SHEET_SPEECHES = {
  aff: ['Pro Constructive', 'Con Constructive', 'Pro Rebuttal', 'Con Rebuttal', 'Pro Summary', 'Con Summary', 'Pro Final Focus', 'Con Final Focus'],
  offcase: ['Pro Constructive', 'Con Constructive', 'Pro Rebuttal', 'Con Rebuttal', 'Pro Summary', 'Con Summary', 'Pro Final Focus', 'Con Final Focus'],
};

function getSheetSpeeches(type, format) {
  const map = format === 'pf' ? PF_SHEET_SPEECHES : format === 'ld' ? LD_SHEET_SPEECHES : SHEET_SPEECHES;
  return map[type] ?? map.aff;
}

const GRID_ROWS = 200;

function inferNeedsName(sheet) {
  if (typeof sheet.needsName === 'boolean') return sheet.needsName;
  if (sheet.type === 'aff') return sheet.name === 'Case' || /^Aff \d+$/.test(sheet.name ?? '');
  if (sheet.type === 'offcase') return /^Off \d+$/.test(sheet.name ?? '');
  return false;
}

function makeGrid(speeches) {
  const grid = {};
  for (const sp of speeches) grid[sp] = Array(GRID_ROWS).fill('');
  return grid;
}

function makeSheet(type, name, needsName = true, format = 'policy') {
  const speeches = getSheetSpeeches(type, format);
  return { id: nanoid(), name, type, speeches, grid: makeGrid(speeches), extensionLinks: [], needsName };
}

function makeFolder(name) {
  return { id: nanoid(), name: name.trim(), createdAt: Date.now() };
}

function makeRound(format = 'policy') {
  const sheets = format === 'pf'
    ? [makeSheet('aff', 'PF Flow', false, format)]
    : [
        makeSheet('aff', 'Case', false, format),
        makeSheet('offcase', 'Off 1', false, format),
      ];
  return {
    id: nanoid(),
    name: '',
    tournament: '',
    roundNum: '',
    judges: '',
    affSchool: '',
    affCode: '',
    negSchool: '',
    negCode: '',
    folderId: null,
    lastEdited: Date.now(),
    sheets,
    activeSheetId: sheets[0].id,
    debateFormat: format,
  };
}

const useStore = create(
  persist(
    (set, get) => ({
      view: 'dashboard',
      rounds: [],
      folders: [],
      activeFolderId: 'all',
      activeRoundId: null,
      pendingNameSheetIds: [],
      sheetUndoStack: [],
      keybindings: DEFAULT_KEYBINDINGS,
      settings: {
        theme: 'light',
        uiStyle: 'modern',
        enterSpacing: 1,
        colWidth: 220,
        fontSize: 12,
        fontFamily: 'Arial, sans-serif',
        rowHeight: 22,
        textWrap: true,
        keyboardMode: 'windows',
        activeCellStyle: 'outlineBlack',
        activeCellBorderColor: '#1d4ed8',
        activeCellFillColor: '#dbeafe',
        affColor: '#1d4ed8',
        negColor: '#b91c1c',
        debateFormat: 'policy',
      },

      setView: (view) => set({ view }),
      setActiveFolder: (folderId) => set({ activeFolderId: folderId }),

      addFolder: (name) => {
        const trimmed = name.trim();
        if (!trimmed) return null;
        const folder = makeFolder(trimmed);
        set(s => ({ folders: [...s.folders, folder], activeFolderId: folder.id }));
        return folder.id;
      },
      renameFolder: (id, name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        set(s => ({ folders: s.folders.map(f => f.id === id ? { ...f, name: trimmed } : f) }));
      },
      deleteFolder: (id) => set(s => ({
        folders: s.folders.filter(f => f.id !== id),
        rounds: s.rounds.map(r => r.folderId === id ? { ...r, folderId: null } : r),
        activeFolderId: s.activeFolderId === id ? 'all' : s.activeFolderId,
      })),
      moveRoundToFolder: (roundId, folderId) => set(s => ({
        rounds: s.rounds.map(r => r.id === roundId ? { ...r, folderId: folderId === 'unfiled' ? null : folderId, lastEdited: Date.now() } : r),
      })),

      newRound: () => {
        const format = get().settings.debateFormat ?? 'policy';
        const round = { ...makeRound(format), folderId: get().activeFolderId === 'all' || get().activeFolderId === 'unfiled' ? null : get().activeFolderId };
        set(s => ({ rounds: [...s.rounds, round], activeRoundId: round.id, view: 'flow' }));
      },
      openRound: (id) => set({ activeRoundId: id, view: 'flow' }),
      deleteRound: (id) => set(s => {
        const rounds = s.rounds.filter(r => r.id !== id);
        const gone = s.activeRoundId === id;
        return { rounds, activeRoundId: gone ? null : s.activeRoundId, view: gone ? 'dashboard' : s.view };
      }),
      updateRoundMeta: (id, meta) => set(s => ({
        rounds: s.rounds.map(r => r.id === id ? { ...r, ...meta, lastEdited: Date.now() } : r),
      })),

      setActiveSheet: (sheetId) => set(s => ({
        rounds: s.rounds.map(r => r.id === s.activeRoundId ? { ...r, activeSheetId: sheetId } : r),
      })),
      addSheet: (type, name) => {
        const { rounds, activeRoundId } = get();
        const currentRound = rounds.find(r => r.id === activeRoundId);
        const format = currentRound?.debateFormat ?? 'policy';
        const sheet = makeSheet(type, name, true, format);
        set(s => ({
          pendingNameSheetIds: type === 'cx'
            ? s.pendingNameSheetIds
            : [...s.pendingNameSheetIds, sheet.id],
          rounds: s.rounds.map(r => {
            if (r.id !== s.activeRoundId) return r;
            return { ...r, sheets: [...r.sheets, sheet], activeSheetId: sheet.id, lastEdited: Date.now() };
          }),
        }));
        return sheet.id;
      },
      renameSheet: (sheetId, name) => set(s => ({
        pendingNameSheetIds: s.pendingNameSheetIds.filter(id => id !== sheetId),
        rounds: s.rounds.map(r => {
          if (r.id !== s.activeRoundId) return r;
          return {
            ...r,
            sheets: r.sheets.map(sh => sh.id === sheetId ? { ...sh, name, needsName: false } : sh),
          };
        }),
      })),
      deleteSheet: (sheetId) => set(s => {
        const round = s.rounds.find(r => r.id === s.activeRoundId);
        const deletedIdx = round?.sheets.findIndex(sh => sh.id === sheetId) ?? -1;
        const deletedSheet = round?.sheets.find(sh => sh.id === sheetId) ?? null;
        const newStack = deletedSheet
          ? [...s.sheetUndoStack, { sheet: deletedSheet, sheetIndex: deletedIdx, roundId: s.activeRoundId }].slice(-20)
          : s.sheetUndoStack;
        return {
          sheetUndoStack: newStack,
          pendingNameSheetIds: s.pendingNameSheetIds.filter(id => id !== sheetId),
          rounds: s.rounds.map(r => {
            if (r.id !== s.activeRoundId) return r;
            const oldIdx = r.sheets.findIndex(sh => sh.id === sheetId);
            const sheets = r.sheets.filter(sh => sh.id !== sheetId);
            let nextId = r.activeSheetId;
            if (r.activeSheetId === sheetId) {
              const neighbor = sheets[oldIdx] ?? sheets[oldIdx - 1] ?? null;
              nextId = neighbor?.id ?? null;
            }
            return { ...r, sheets, activeSheetId: nextId };
          }),
        };
      }),

      undoDeleteSheet: () => set(s => {
        if (!s.sheetUndoStack.length) return s;
        const stack = [...s.sheetUndoStack];
        const { sheet, sheetIndex, roundId } = stack.pop();
        const rounds = s.rounds.map(r => {
          if (r.id !== roundId) return r;
          const sheets = [...r.sheets];
          sheets.splice(Math.min(sheetIndex, sheets.length), 0, sheet);
          return { ...r, sheets, activeSheetId: sheet.id };
        });
        return { rounds, sheetUndoStack: stack, activeRoundId: roundId, view: 'flow' };
      }),

      flushSheet: (sheetId, gridData, extensionLinks) => set(s => ({
        rounds: s.rounds.map(r => {
          if (r.id !== s.activeRoundId) return r;
          return {
            ...r,
            lastEdited: Date.now(),
            sheets: r.sheets.map(sh => sh.id !== sheetId ? sh : {
              ...sh,
              grid: gridData,
              ...(extensionLinks != null ? { extensionLinks } : {}),
            }),
          };
        }),
      })),

      applyRemoteCellEdit: ({ sheetId, speech, row, value }) => set(s => ({
        rounds: s.rounds.map(r => {
          if (r.id !== s.activeRoundId) return r;
          return {
            ...r,
            lastEdited: Date.now(),
            sheets: r.sheets.map(sh => {
              if (sh.id !== sheetId || !sh.grid?.[speech]) return sh;
              const col = [...sh.grid[speech]];
              col[row] = value;
              return { ...sh, grid: { ...sh.grid, [speech]: col } };
            }),
          };
        }),
      })),

      swapSheets: (idA, idB) => set(s => ({
        rounds: s.rounds.map(r => {
          if (r.id !== s.activeRoundId) return r;
          const sheets = [...r.sheets];
          const ia = sheets.findIndex(sh => sh.id === idA);
          const ib = sheets.findIndex(sh => sh.id === idB);
          if (ia === -1 || ib === -1) return r;
          [sheets[ia], sheets[ib]] = [sheets[ib], sheets[ia]];
          return { ...r, sheets };
        }),
      })),

      importRound: (round) => {
        const idMap = new Map();
        const sheets = (round.sheets ?? []).map(sheet => {
          const id = nanoid();
          idMap.set(sheet.id, id);
          return { ...sheet, id };
        });
        const imported = {
          ...round,
          id: nanoid(),
          sheets,
          activeSheetId: idMap.get(round.activeSheetId) ?? sheets[0]?.id ?? null,
          folderId: get().activeFolderId === 'all' || get().activeFolderId === 'unfiled' ? (round.folderId ?? null) : get().activeFolderId,
          lastEdited: Date.now(),
        };
        set(s => ({ rounds: [...s.rounds, imported], activeRoundId: imported.id, view: 'flow' }));
      },

      updateSettings: (patch) => set(s => ({ settings: { ...s.settings, ...patch } })),
      updateKeybinding: (actionId, binding) => set(s => ({
        keybindings: { ...s.keybindings, [actionId]: binding },
      })),
      resetKeybindings: () => set({ keybindings: DEFAULT_KEYBINDINGS }),
    }),
    {
      name: 'jayflow-v3',
      version: 9,
      migrate: (persistedState) => {
        const pending = [];
        const rounds = (persistedState?.rounds ?? []).map(round => ({
          ...round,
          folderId: round.folderId ?? null,
          sheets: (round.sheets ?? []).map(sheet => {
            const needsName = inferNeedsName(sheet);
            if (needsName && sheet.type !== 'cx') pending.push(sheet.id);
            return { ...sheet, needsName };
          }),
        }));
        const settings = {
          ...(persistedState?.settings ?? {}),
          keyboardMode: persistedState?.settings?.keyboardMode === 'mac' ? 'mac' : 'windows',
          activeCellStyle: !persistedState?.settings?.activeCellStyle || persistedState.settings.activeCellStyle === 'filledBlue'
            ? 'outlineBlack'
            : persistedState.settings.activeCellStyle,
        };
        return {
          ...persistedState,
          rounds,
          folders: persistedState?.folders ?? [],
          activeFolderId: persistedState?.activeFolderId ?? 'all',
          pendingNameSheetIds: pending,
          sheetUndoStack: [],
          settings,
        };
      },
    }
  )
);

export default useStore;
