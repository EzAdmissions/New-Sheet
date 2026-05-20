import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import { DEFAULT_KEYBINDINGS } from './keybindings';

export function roundDisplayName(round) {
  const tournament = round.tournament?.trim();
  const roundNum = round.roundNum?.trim();
  const aff = [round.affSchool, round.affCode].map(v => v?.trim()).filter(Boolean).join(' ');
  const neg = [round.negSchool, round.negCode].map(v => v?.trim()).filter(Boolean).join(' ');

  if (!tournament && !roundNum && !aff && !neg) return 'New Round';

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

function makeSheet(type, name, needsName = true) {
  const speeches = SHEET_SPEECHES[type] ?? SHEET_SPEECHES.aff;
  return { id: nanoid(), name, type, speeches, grid: makeGrid(speeches), extensionLinks: [], needsName };
}

function makeRound() {
  const sheets = [
    makeSheet('aff', 'Case', false),
    makeSheet('offcase', 'Off 1', false),
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
    lastEdited: Date.now(),
    sheets,
    activeSheetId: sheets[0].id,
  };
}

const useStore = create(
  persist(
    (set) => ({
      view: 'dashboard',
      rounds: [],
      activeRoundId: null,
      pendingNameSheetIds: [],
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
        activeCellStyle: 'filledBlue',
        activeCellBorderColor: '#1d4ed8',
        activeCellFillColor: '#dbeafe',
        affColor: '#1d4ed8',
        negColor: '#b91c1c',
      },

      setView: (view) => set({ view }),

      newRound: () => {
        const round = makeRound();
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
        const sheet = makeSheet(type, name);
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
      deleteSheet: (sheetId) => set(s => ({
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
      })),

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
        const imported = { ...round, id: nanoid(), lastEdited: Date.now() };
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
      version: 5,
      migrate: (persistedState) => {
        const pending = [];
        const rounds = (persistedState?.rounds ?? []).map(round => ({
          ...round,
          sheets: (round.sheets ?? []).map(sheet => {
            const needsName = inferNeedsName(sheet);
            if (needsName && sheet.type !== 'cx') pending.push(sheet.id);
            return { ...sheet, needsName };
          }),
        }));
        return { ...persistedState, rounds, pendingNameSheetIds: pending };
      },
    }
  )
);

export default useStore;
