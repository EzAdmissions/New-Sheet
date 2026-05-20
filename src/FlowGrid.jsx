/* eslint-disable react-hooks/refs, react-hooks/immutability, react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
import { useRef, useCallback, useEffect, useState, useLayoutEffect, useMemo } from 'react';
import useStore, { sortSheetsForDisplay } from './store';
import { useTheme, getSpeechColor, getAffColor, getNegColor } from './theme';
import { matchesAction } from './keybindings';
import { exportSheetCSV, exportRoundCSV, exportRoundHTML } from './export';
import { getUiChrome } from './uiChrome';

const TOTAL_ROWS = 200;
const AUTO_EXTEND_MAX_ROWS = 8;
let measureCanvas = null;

function estimateTextRows(text, colWidth, fontSize, pad, textWrap, fontFamily) {
  if (!textWrap || !text) return 1;
  const usableWidth = Math.max(24, colWidth - pad * 2);
  if (typeof document === 'undefined') return 1;
  if (!measureCanvas) measureCanvas = document.createElement('canvas');
  const ctx = measureCanvas.getContext('2d');
  ctx.font = `${fontSize}px ${fontFamily}`;

  let rows = 0;
  for (const para of text.split('\n')) {
    if (!para) {
      rows++;
      continue;
    }
    let lineWidth = 0;
    let lineRows = 1;
    const tokens = para.match(/\S+\s*/g) ?? [para];
    for (let token of tokens) {
      const width = ctx.measureText(token).width;
      if (width > usableWidth) {
        for (const char of token) {
          const charWidth = ctx.measureText(char).width;
          if (lineWidth > 0 && lineWidth + charWidth > usableWidth) {
            lineRows++;
            lineWidth = charWidth;
          } else {
            lineWidth += charWidth;
          }
        }
        continue;
      }
      if (lineWidth > 0 && lineWidth + width > usableWidth) {
        lineRows++;
        lineWidth = width;
      } else {
        lineWidth += width;
      }
    }
    rows += lineRows;
  }
  return Math.min(AUTO_EXTEND_MAX_ROWS, Math.max(1, rows));
}

function selBounds(sel) {
  return {
    minCol: Math.min(sel.anchorCol, sel.endCol),
    maxCol: Math.max(sel.anchorCol, sel.endCol),
    minRow: Math.min(sel.anchorRow, sel.endRow),
    maxRow: Math.max(sel.anchorRow, sel.endRow),
  };
}

function isMultiCellSelection(sel) {
  if (!sel) return false;
  return sel.anchorCol !== sel.endCol || sel.anchorRow !== sel.endRow;
}

function speechSide(speech) {
  if (['1AC', '2AC', '1AR', '2AR'].includes(speech)) return 'aff';
  if (['1NC', 'Block', '2NR'].includes(speech)) return 'neg';
  return null;
}

function rgba(hex, alpha) {
  const clean = String(hex ?? '').replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(clean)) return `rgba(29,78,216,${alpha})`;
  const n = parseInt(clean, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function getActiveCellChrome(settings, theme, activeColor) {
  const defaultBorder = !settings.activeCellBorderColor || settings.activeCellBorderColor === '#1d4ed8'
    ? activeColor
    : settings.activeCellBorderColor;
  const defaultFill = !settings.activeCellFillColor || settings.activeCellFillColor === '#dbeafe'
    ? rgba(activeColor, 0.16)
    : settings.activeCellFillColor;
  if (settings.activeCellStyle === 'custom') {
    return {
      boxShadow: `inset 0 0 0 2px ${defaultBorder}`,
      background: defaultFill,
    };
  }
  if (settings.activeCellStyle === 'outlineBlack') {
    return {
      boxShadow: 'inset 0 0 0 2px #000000',
      background: theme.bg,
    };
  }
  if (settings.activeCellStyle === 'outlineBlue') {
    return {
      boxShadow: `inset 0 0 0 2px ${activeColor}`,
      background: theme.bg,
    };
  }
  return {
    boxShadow: `inset 0 0 0 2px ${activeColor}`,
    background: rgba(activeColor, 0.16),
  };
}

export default function FlowGrid({ sheet, round, onOpenSettings, onOpenMeta, onBack, onRename, onAddSheet, onStartRename, onDeleteSheet }) {
  const settings      = useStore(s => s.settings);
  const keybindings   = useStore(s => s.keybindings);
  const flushSheet    = useStore(s => s.flushSheet);
  const deleteSheet   = useStore(s => s.deleteSheet);
  const setActiveSheet = useStore(s => s.setActiveSheet);
  const swapSheets     = useStore(s => s.swapSheets);
  const theme = useTheme(settings.theme);
  const ui = getUiChrome(settings, theme);
  const affColor = getAffColor(settings, theme);
  const negColor = getNegColor(settings, theme);

  const { speeches, id: sheetId, grid } = sheet;
  const { textWrap } = settings;
  const taRef = useRef(null);
  const activeCellRef = useRef({ col: 0, row: 0 });

  // ── Local data buffer ──
  const localData = useRef({});
  const sheetCache = useRef({});
  const lastSpeeches = useRef(speeches);
  const lastSheetId = useRef(null);
  if (lastSheetId.current !== sheetId) {
    if (lastSheetId.current && taRef.current) {
      const { col, row } = activeCellRef.current;
      const oldSpeech = lastSpeeches.current[col];
      if (oldSpeech && sheetCache.current[lastSheetId.current]?.[oldSpeech]) {
        sheetCache.current[lastSheetId.current][oldSpeech][row] = taRef.current.value;
      }
    }
    lastSheetId.current = sheetId;
    lastSpeeches.current = speeches;
    if (!sheetCache.current[sheetId]) {
      const d = {};
      for (const sp of speeches)
        d[sp] = Array.from({ length: TOTAL_ROWS }, (_, i) => {
          const v = grid[sp]?.[i] ?? '';
          return typeof v === 'string' ? v : (v?.text ?? '');
        });
      sheetCache.current[sheetId] = d;
    }
    localData.current = sheetCache.current[sheetId];
  }

  const getText = (sp, row) => localData.current[sp]?.[row] ?? '';
  const setLocalText = (sp, row, val) => { if (localData.current[sp]) localData.current[sp][row] = val; };

  const cloneGrid = useCallback(() => {
    const copy = {};
    for (const sp of speeches) copy[sp] = [...(localData.current[sp] ?? [])];
    return copy;
  }, [speeches]);

  // ── Active cell (ref only — navigation skips React re-renders) ──

  // ── Cell DOM refs for direct visibility toggling ──
  const cellRefs = useRef([]);

  // ── Selection (state needed to trigger highlight re-renders) ──
  const selectionRef = useRef(null);
  const [selection, setSelection] = useState(null);
  const [extensionLinks, setExtensionLinks] = useState(() => sheet.extensionLinks ?? []);
  const extensionLinksRef = useRef(extensionLinks);
  extensionLinksRef.current = extensionLinks;
  const pendingExtendFocusRef = useRef(null);
  const [, forceRender] = useState(0);

  const sortedSheets = useMemo(() => (
    sortSheetsForDisplay(round.sheets)
      .filter(s => s.type !== 'cx')
  ), [round.sheets]);

  const blockedSet = useMemo(() => {
    const s = new Set();
    for (const link of extensionLinks)
      for (let c = link.fromCol + 1; c < link.toCol; c++) s.add(`${c},${link.fromRow}`);
    return s;
  }, [extensionLinks]);

  const blockedSetRef = useRef(blockedSet);
  blockedSetRef.current = blockedSet;

  const blockedColorMap = useMemo(() => {
    const m = {};
    for (const link of extensionLinks) {
      const color = link.side === 'neg' ? negColor : affColor;
      for (let c = link.fromCol + 1; c < link.toCol; c++) m[`${c},${link.fromRow}`] = color;
    }
    return m;
  }, [extensionLinks, affColor, negColor]);
  const isDragging = useRef(false);
  const activeSpanRows = useRef(1);
  const rowSpansRef = useRef(Array(TOTAL_ROWS).fill(1));
  const rowTopsRef = useRef(Array(TOTAL_ROWS).fill(0));
  const gridHeightRef = useRef(TOTAL_ROWS);
  const undoStack = useRef([]);
  const redoStack = useRef([]);
  const editSnapshot = useRef(null);

  // ── Zoom ──
  const [zoom, setZoom] = useState(1);

  const containerRef = useRef(null);
  const headerRef    = useRef(null);
  const gridRef      = useRef(null);

  // ── Scaled dims — also kept in refs for direct-DOM use ──
  const cw  = Math.round(settings.colWidth  * zoom);
  const rh  = Math.round(settings.rowHeight * zoom);
  const fs  = settings.fontSize * zoom;
  const pad = Math.round(5 * zoom);
  const lineHeightPx = textWrap ? Math.round(fs * 1.3) : Math.max(1, rh - 3);
  const cwRef = useRef(cw);
  const rhRef = useRef(rh);
  cwRef.current = cw;
  rhRef.current = rh;

  const getColWidth = useCallback(() => {
    const gridEl = gridRef.current;
    return gridEl ? gridEl.clientWidth / speeches.length : cwRef.current;
  }, [speeches.length]);

  const updateTextareaVerticalPadding = useCallback((ta, row) => {
    if (!ta) return;
    const height = (rowSpansRef.current[row] ?? 1) * rhRef.current;
    const textRows = estimateTextRows(ta.value, getColWidth(), fs, pad, textWrap, settings.fontFamily);
    const contentHeight = Math.min(height, Math.max(lineHeightPx, textRows * lineHeightPx));
    const verticalPad = Math.max(0, Math.floor((height - contentHeight) / 2));
    ta.style.padding = `${verticalPad}px ${pad}px`;
  }, [getColWidth, fs, pad, textWrap, settings.fontFamily, lineHeightPx]);

  const repaintCells = useCallback(() => {
    for (let c = 0; c < speeches.length; c++) {
      const sp = speeches[c];
      for (let r = 0; r < TOTAL_ROWS; r++) {
        const el = cellRefs.current[c]?.[r];
        if (el) {
          el.textContent = localData.current[sp]?.[r] ?? '';
          el.style.height = (rowSpansRef.current[r] ?? 1) * rhRef.current + 'px';
        }
      }
    }
  }, [speeches]);

  const updateCellDom = useCallback((col, row, value) => {
    const el = cellRefs.current[col]?.[row];
    if (el) el.textContent = value;
  }, []);

  const computeRowSpan = useCallback((row, omitCol = null) => {
    const colWidth = getColWidth();
    let span = 1;
    for (let i = 0; i < speeches.length; i++) {
      if (i === omitCol) continue;
      const sp = speeches[i];
      span = Math.max(span, estimateTextRows(getText(sp, row), colWidth, fs, pad, textWrap, settings.fontFamily));
    }
    return span;
  }, [speeches, getColWidth, fs, pad, textWrap, settings.fontFamily]);

  const resizeActiveTextarea = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return 1;
    const rh = rhRef.current;
    const { row } = activeCellRef.current;
    const rows = rowSpansRef.current[row] ?? 1;
    activeSpanRows.current = rows;
    ta.style.height = rows * rh + 'px';
    updateTextareaVerticalPadding(ta, row);
    return rows;
  }, [updateTextareaVerticalPadding]);

  const recomputeRowTops = useCallback(() => {
    let total = 0;
    for (let row = 0; row < TOTAL_ROWS; row++) {
      rowTopsRef.current[row] = total;
      total += rowSpansRef.current[row] ?? 1;
    }
    gridHeightRef.current = total;
    const gridEl = gridRef.current;
    if (gridEl) gridEl.style.height = total * rhRef.current + 'px';
  }, []);

  const pushUndo = useCallback((before) => {
    undoStack.current.push(before);
    if (undoStack.current.length > 100) undoStack.current.shift();
    redoStack.current = [];
  }, []);

  const restoreGrid = useCallback((snapshot) => {
    localData.current = {};
    for (const sp of speeches) localData.current[sp] = [...(snapshot[sp] ?? Array(TOTAL_ROWS).fill(''))];
    sheetCache.current[sheetId] = localData.current;
  }, [speeches, sheetId]);

  const applyHistorySnapshot = useCallback((targetStack, sourceStack) => {
    if (!targetStack.current.length) return;
    editSnapshot.current = null;
    const current = cloneGrid();
    const previous = targetStack.current.pop();
    sourceStack.current.push(current);
    restoreGrid(previous);
    repaintCells();
    for (let row = 0; row < TOTAL_ROWS; row++) rowSpansRef.current[row] = computeRowSpan(row);
    recomputeRowTops();
    const { col, row } = activeCellRef.current;
    if (taRef.current) taRef.current.value = getText(speeches[col], row);
    forceRender(v => v + 1);
  }, [cloneGrid, restoreGrid, repaintCells, computeRowSpan, recomputeRowTops, speeches]);

  const syncRowSpan = useCallback((row, measuredSpan = null) => {
    const next = Math.max(measuredSpan ?? 1, computeRowSpan(row));
    if (rowSpansRef.current[row] !== next) {
      rowSpansRef.current[row] = next;
      recomputeRowTops();
      forceRender(v => v + 1);
    }
    return next;
  }, [computeRowSpan, recomputeRowTops]);

  const syncActiveRowSpan = useCallback((row, col, ta) => {
    if (!ta) return rowSpansRef.current[row] ?? 1;
    const otherCellsSpan = computeRowSpan(row, col);
    const activeText = ta.value ?? '';
    const activeSpan = activeText
      ? estimateTextRows(activeText, getColWidth(), fs, pad, textWrap, settings.fontFamily)
      : 1;
    const next = Math.max(1, otherCellsSpan, activeSpan);

    if (rowSpansRef.current[row] !== next) {
      rowSpansRef.current[row] = next;
      recomputeRowTops();
      forceRender(v => v + 1);
    }
    return next;
  }, [computeRowSpan, getColWidth, fs, pad, textWrap, settings.fontFamily, recomputeRowTops]);

  const commitPendingEdit = useCallback(() => {
    const ta = taRef.current;
    if (!ta || !editSnapshot.current) return;
    const { col, row } = activeCellRef.current;
    const beforeValue = editSnapshot.current[speeches[col]]?.[row] ?? '';
    if (beforeValue !== ta.value) {
      setLocalText(speeches[col], row, ta.value);
      updateCellDom(col, row, ta.value);
      syncActiveRowSpan(row, col, ta);
      undoStack.current.push(editSnapshot.current);
      if (undoStack.current.length > 100) undoStack.current.shift();
      redoStack.current = [];
    }
    editSnapshot.current = null;
  }, [speeches, updateCellDom, syncActiveRowSpan]);

  const insertRowsAfter = useCallback((row, count = 1, rerender = false) => {
    const n = Math.max(1, Math.min(20, count));
    for (const sp of speeches) {
      const colData = localData.current[sp];
      if (!colData) continue;
      for (let r = TOTAL_ROWS - 1; r > row + n; r--) colData[r] = colData[r - n];
      for (let r = row + 1; r <= Math.min(TOTAL_ROWS - 1, row + n); r++) colData[r] = '';
    }
    selectionRef.current = null;
    setSelection(null);
    repaintCells();
    if (rerender) forceRender(v => v + 1);
  }, [speeches, repaintCells]);

  const recomputeAllRowSpans = useCallback(() => {
    for (let row = 0; row < TOTAL_ROWS; row++) {
      rowSpansRef.current[row] = computeRowSpan(row);
    }
    recomputeRowTops();
  }, [computeRowSpan, recomputeRowTops]);

  const recomputeRows = useCallback((rows) => {
    for (const row of rows) rowSpansRef.current[row] = computeRowSpan(row);
    recomputeRowTops();
    forceRender(v => v + 1);
  }, [computeRowSpan, recomputeRowTops]);

  const findSequenceAwareDownRow = useCallback((col, row) => {
    if (col <= 0) return Math.min(TOTAL_ROWS - 1, row + 1);

    for (let r = row + 1; r < TOTAL_ROWS; r++) {
      for (let c = col - 1; c >= 0; c--) {
        if (getText(speeches[c], r).trim()) return row + 1 < r ? row + 1 : r;
      }
    }

    return Math.min(TOTAL_ROWS - 1, row + 1);
  }, [speeches]);

  const rowHasPriorSpeechContent = useCallback((col, row) => {
    for (let c = 0; c < col; c++) {
      if (getText(speeches[c], row).trim()) return true;
    }
    return false;
  }, [speeches]);

  const rowHasAnyContent = useCallback((row) => {
    for (const sp of speeches) {
      if (getText(sp, row).trim()) return true;
    }
    return false;
  }, [speeches]);

  const getExtendOptions = useCallback((fromCol) => {
    const side = speechSide(speeches[fromCol]);
    if (!side) return [];
    return speeches
      .map((speech, col) => ({ speech, col }))
      .filter(opt => opt.col > fromCol && speechSide(opt.speech) === side);
  }, [speeches]);

  const shiftColumnRangeDown = useCallback((col, fromRow, throughRow, targetStartRow) => {
    const sp = speeches[col];
    const colData = localData.current[sp];
    if (!colData || throughRow < fromRow) return false;

    const values = [];
    for (let r = fromRow; r <= throughRow; r++) {
      if (colData[r]) values.push(colData[r]);
      colData[r] = '';
    }
    if (!values.length) return false;

    for (let i = values.length - 1; i >= 0; i--) {
      let dest = Math.min(TOTAL_ROWS - 1, targetStartRow + i);
      while (dest < TOTAL_ROWS && colData[dest]) dest++;
      if (dest < TOTAL_ROWS) colData[dest] = values[i];
    }
    return true;
  }, [speeches]);

  const protectResponseBlock = useCallback((responseCol, editedRow) => {
    if (responseCol <= 0) return;

    let blockStart = editedRow;
    while (blockStart > 0 && getText(speeches[responseCol], blockStart - 1).trim()) {
      blockStart--;
    }

    let anchorRow = blockStart;
    for (let r = blockStart; r >= 0; r--) {
      if (getText(speeches[responseCol - 1], r).trim()) {
        anchorRow = r;
        break;
      }
    }

    let blockEnd = anchorRow;
    for (let r = blockStart; r < TOTAL_ROWS; r++) {
      if (getText(speeches[responseCol], r).trim()) blockEnd = r;
      else if (r > editedRow) break;
    }

    if (blockEnd <= anchorRow) return;

    let changed = false;
    for (let col = 0; col < responseCol; col++) {
      changed = shiftColumnRangeDown(col, anchorRow + 1, blockEnd, blockEnd + 1) || changed;
    }
    if (!changed) return;

    if (editSnapshot.current) {
      pushUndo(editSnapshot.current);
      editSnapshot.current = null;
    }
    for (let r = anchorRow + 1; r <= Math.min(TOTAL_ROWS - 1, blockEnd + responseCol + 2); r++) {
      syncRowSpan(r);
    }
    repaintCells();
  }, [speeches, shiftColumnRangeDown, syncRowSpan, repaintCells, pushUndo]);


  // ── Global mouseup ──
  useEffect(() => {
    const stop = () => { isDragging.current = false; };
    document.addEventListener('mouseup', stop);
    return () => document.removeEventListener('mouseup', stop);
  }, []);

  // ── Refocus grid textarea after naming bar closes ──
  useEffect(() => {
    const handler = () => taRef.current?.focus();
    window.addEventListener('jayflow-focus-grid', handler);
    return () => window.removeEventListener('jayflow-focus-grid', handler);
  }, []);

  // ── Header scroll sync ──
  useEffect(() => {
    const el = containerRef.current;
    const hdr = headerRef.current;
    if (!el || !hdr) return;
    const sync = () => { hdr.scrollLeft = el.scrollLeft; };
    el.addEventListener('scroll', sync, { passive: true });
    return () => el.removeEventListener('scroll', sync);
  }, []);

  // ── Flush ──
  const saveActiveTextarea = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return;
    const { col, row } = activeCellRef.current;
    commitPendingEdit();
    setLocalText(speeches[col], row, ta.value);
    updateCellDom(col, row, ta.value);
  }, [speeches, updateCellDom, commitPendingEdit]);

  const extendArgument = useCallback(() => {
    saveActiveTextarea();
    const { col, row } = activeCellRef.current;
    const text = getText(speeches[col], row).trim();
    const options = getExtendOptions(col);
    if (!text || !options.length) return;

    const { col: toCol } = options[0];
    const side = speechSide(speeches[col]);
    const before = cloneGrid();

    for (let c = Math.min(col, toCol) + 1; c <= Math.max(col, toCol); c++) {
      shiftColumnRangeDown(c, row, row, row + 1);
    }

    pushUndo(before);
    recomputeAllRowSpans();
    repaintCells();
    pendingExtendFocusRef.current = { col: toCol, row };
    setExtensionLinks(links => [
      ...links,
      { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, fromCol: col, fromRow: row, toCol, toRow: row, side },
    ]);
    forceRender(v => v + 1);
  }, [speeches, getExtendOptions, saveActiveTextarea, cloneGrid, shiftColumnRangeDown, pushUndo, recomputeAllRowSpans, repaintCells]);

  const deleteLink = useCallback((linkId) => {
    const link = extensionLinksRef.current.find(l => l.id === linkId);
    setExtensionLinks(links => links.filter(l => l.id !== linkId));
    if (link) recomputeRows([link.fromRow, link.toRow]);
  }, [recomputeRows]);

  const buildGrid = useCallback(() => {
    const gd = {};
    for (const sp of speeches) gd[sp] = [...(localData.current[sp] ?? [])];
    return gd;
  }, [speeches]);

  const getCurrentGrid = useCallback(() => {
    saveActiveTextarea();
    return buildGrid();
  }, [buildGrid, saveActiveTextarea]);

  const getFreshRoundForExport = useCallback((activeGrid = getCurrentGrid()) => ({
    ...round,
    sheets: round.sheets.map(sh => {
      if (sh.id === sheetId) {
        return { ...sh, grid: activeGrid, extensionLinks: extensionLinksRef.current };
      }
      const cachedGrid = sheetCache.current[sh.id];
      if (!cachedGrid) return sh;
      const gridCopy = {};
      for (const sp of sh.speeches ?? []) gridCopy[sp] = [...(cachedGrid[sp] ?? [])];
      return { ...sh, grid: gridCopy };
    }),
  }), [getCurrentGrid, round, sheetId]);

  const flush = useCallback(() => flushSheet(sheetId, getCurrentGrid(), extensionLinksRef.current), [sheetId, getCurrentGrid, flushSheet]);

  // Reset extension links when switching sheets
  useEffect(() => { setExtensionLinks(sheet.extensionLinks ?? []); }, [sheetId]);

  useEffect(() => () => flush(), [flush]);
  useEffect(() => { const id = setInterval(flush, 4000); return () => clearInterval(id); }, [flush]);
  useEffect(() => {
    const exportFreshRound = () => {
      const gridData = getCurrentGrid();
      flushSheet(sheetId, gridData, extensionLinksRef.current);
      exportRoundCSV(getFreshRoundForExport(gridData));
    };
    window.addEventListener('new-sheet-export-round', exportFreshRound);
    return () => window.removeEventListener('new-sheet-export-round', exportFreshRound);
  }, [getCurrentGrid, flushSheet, sheetId, round, settings]);

  useEffect(() => {
    const exportFreshHTML = () => {
      const gridData = getCurrentGrid();
      flushSheet(sheetId, gridData, extensionLinksRef.current);
      exportRoundHTML(getFreshRoundForExport(gridData), { settings });
    };
    window.addEventListener('new-sheet-export-round-html', exportFreshHTML);
    return () => window.removeEventListener('new-sheet-export-round-html', exportFreshHTML);
  }, [getCurrentGrid, flushSheet, sheetId, round, settings]);

  // ── Ensure cell is visible ──
  const ensureVisible = useCallback((col, row) => {
    const el = containerRef.current;
    if (!el) return;
    const cw = getColWidth(), rh = rhRef.current;
    const t = (rowTopsRef.current[row] ?? row) * rh;
    const b = t + (rowSpansRef.current[row] ?? 1) * rh;
    const l = col * cw, r = l + cw;
    if (t < el.scrollTop)                    el.scrollTop  = t;
    if (b > el.scrollTop  + el.clientHeight) el.scrollTop  = b - el.clientHeight;
    if (l < el.scrollLeft)                   el.scrollLeft = l;
    if (r > el.scrollLeft + el.clientWidth)  el.scrollLeft = r - el.clientWidth;
  }, [getColWidth]);

  // ── Apply textarea position directly to DOM ──
  const applyTextareaPos = useCallback((col, row) => {
    const ta = taRef.current;
    if (!ta) return;
    const cw = getColWidth(), rh = rhRef.current;
    ta.style.left = col * cw + 'px';
    ta.style.top  = (rowTopsRef.current[row] ?? row) * rh + 'px';
    ta.style.height = (rowSpansRef.current[row] ?? activeSpanRows.current) * rh + 'px';
    ta.style.width = cw + 'px';
    ta.style.right = '';
    updateTextareaVerticalPadding(ta, row);
  }, [getColWidth, updateTextareaVerticalPadding]);

  // ── Move to cell — zero React re-renders on navigation ──
  const moveTo = useCallback((col, row, keepSel = false) => {
    const { col: oldCol, row: oldRow } = activeCellRef.current;
    saveActiveTextarea();

    if (!keepSel && selectionRef.current) {
      selectionRef.current = null;
      setSelection(null); // re-render only when clearing a selection
    }

    let nc = Math.max(0, Math.min(speeches.length - 1, col));
    const nr = Math.max(0, Math.min(TOTAL_ROWS - 1, row));

    // Never land on a blocked cell — skip in direction of travel
    if (blockedSetRef.current.has(`${nc},${nr}`)) {
      const dir = col >= oldCol ? 1 : -1;
      let c = nc + dir;
      while (c >= 0 && c < speeches.length && blockedSetRef.current.has(`${c},${nr}`)) c += dir;
      if (c >= 0 && c < speeches.length) {
        nc = c;
      } else {
        c = nc - dir;
        while (c >= 0 && c < speeches.length && blockedSetRef.current.has(`${c},${nr}`)) c -= dir;
        if (c >= 0 && c < speeches.length) nc = c;
      }
    }

    // Direct DOM: toggle visibility
    const oldEl = cellRefs.current[oldCol]?.[oldRow];
    if (oldEl) oldEl.style.visibility = 'visible';
    const newEl = cellRefs.current[nc]?.[nr];
    if (newEl) newEl.style.visibility = 'hidden';

    activeSpanRows.current = 1;
    activeCellRef.current = { col: nc, row: nr };

    // Direct DOM: move & update textarea
    applyTextareaPos(nc, nr);
    if (taRef.current) {
      taRef.current.style.color = getSpeechColor(speeches[nc], theme, settings);
      const txt = getText(speeches[nc], nr);
      taRef.current.value = txt;
      editSnapshot.current = null;
      resizeActiveTextarea();
      taRef.current.focus();
      taRef.current.setSelectionRange(txt.length, txt.length);
    }

    ensureVisible(nc, nr);
  }, [speeches, ensureVisible, applyTextareaPos, theme, saveActiveTextarea, resizeActiveTextarea]);

  useLayoutEffect(() => {
    const focus = pendingExtendFocusRef.current;
    if (!focus) return;
    pendingExtendFocusRef.current = null;
    moveTo(focus.col, focus.row);
  }, [extensionLinks, moveTo]);

  const continueResponseSequence = useCallback(() => {
    const { col, row } = activeCellRef.current;
    saveActiveTextarea();
    const nextRow = Math.min(TOTAL_ROWS - 1, row + 1);
    const needsSpace = rowHasAnyContent(nextRow) || rowHasPriorSpeechContent(col, nextRow);
    if (needsSpace) {
      pushUndo(cloneGrid());
      insertRowsAfter(row, 1, false);
      recomputeAllRowSpans();
      forceRender(v => v + 1);
    }
    moveTo(col, row + 1);
  }, [insertRowsAfter, moveTo, recomputeAllRowSpans, saveActiveTextarea, pushUndo, cloneGrid, rowHasAnyContent, rowHasPriorSpeechContent]);

  // ── Sheet init ──
  useLayoutEffect(() => {
    recomputeAllRowSpans();
    activeCellRef.current = { col: 0, row: 0 };
    selectionRef.current = null;
    setSelection(null);
    applyTextareaPos(0, 0);
    activeSpanRows.current = 1;
    if (taRef.current) {
      taRef.current.value = getText(speeches[0], 0);
      taRef.current.style.color = getSpeechColor(speeches[0], theme, settings);
      resizeActiveTextarea();
      taRef.current.focus();
    }
    forceRender(v => v + 1);
  }, [sheetId]);

  // ── Keyboard ──
  const handleKeyDown = useCallback((e) => {
    const { col, row } = activeCellRef.current;
    const ta  = taRef.current;
    const is  = (id) => matchesAction(e, keybindings, id);
    const isArrow = ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key);
    const hasMultiGridSelection = isMultiCellSelection(selectionRef.current);
    const isTextRangeShortcut = isArrow && e.shiftKey && !e.altKey;
    const isTabReorderShortcut = (e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight');
    const shouldReorderTab = isTabReorderShortcut && (e.altKey || !(ta?.value ?? '').length);
    const gridSelectionShortcut = isArrow && e.shiftKey && (e.altKey || hasMultiGridSelection);
    const textSelectionShortcut = isTextRangeShortcut && !hasMultiGridSelection && !shouldReorderTab;

    // Let the textarea handle normal text highlighting: Shift+Arrow, Ctrl+Shift+Arrow,
    // and platform variants. Grid highlighting remains available through mouse drag,
    // Shift+Click, or Alt+Shift+Arrow. Empty cells keep Ctrl+Shift+Left/Right
    // available for sheet reordering; Ctrl+Alt+Shift+Left/Right always reorders.
    if (textSelectionShortcut) return;

    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      commitPendingEdit();
      applyHistorySnapshot(undoStack, redoStack);
      return;
    }
    if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')) {
      e.preventDefault();
      commitPendingEdit();
      applyHistorySnapshot(redoStack, undoStack);
      return;
    }

    if (is('arg.extend')) {
      e.preventDefault();
      extendArgument();
      return;
    }

    // Delete current sheet instantly — switch to adjacent tab first
    if ((e.ctrlKey || e.metaKey) && e.key === 'Backspace') {
      e.preventDefault();
      flush();
      const idx = sortedSheets.findIndex(s => s.id === sheet.id);
      const next = sortedSheets[idx + 1] ?? sortedSheets[idx - 1];
      if (next) setActiveSheet(next.id);
      deleteSheet(sheet.id);
      return;
    }

    // Sheet reorder: Ctrl+Shift+Left/Right — move current off/aff sheet within its type group
    if (shouldReorderTab) {
      e.preventDefault();
      const dir = e.key === 'ArrowRight' ? 1 : -1;
      const group = sortedSheets.filter(s => s.type === sheet.type);
      const idx = group.findIndex(s => s.id === sheet.id);
      const neighbor = group[idx + dir];
      if (neighbor) swapSheets(sheet.id, neighbor.id);
      return;
    }

    // Sheet tab switching (Ctrl+Arrow) — follows sorted display order
    if (is('sheet.nextTab')) {
      e.preventDefault();
      saveActiveTextarea();
      const idx = sortedSheets.findIndex(s => s.id === sheet.id);
      if (idx < sortedSheets.length - 1) setActiveSheet(sortedSheets[idx + 1].id);
      return;
    }
    if (is('sheet.prevTab')) {
      e.preventDefault();
      saveActiveTextarea();
      const idx = sortedSheets.findIndex(s => s.id === sheet.id);
      if (idx > 0) setActiveSheet(sortedSheets[idx - 1].id);
      return;
    }

    // Shift+Arrow: extend selection
    if (gridSelectionShortcut) {
      e.preventDefault();
      let sel = selectionRef.current ?? { anchorCol: col, anchorRow: row, endCol: col, endRow: row };
      let { endCol, endRow } = sel;
      const stepRows = e.ctrlKey || e.metaKey ? 5 : 1;
      if (e.key === 'ArrowDown')  endRow = Math.min(TOTAL_ROWS - 1, endRow + stepRows);
      if (e.key === 'ArrowUp')    endRow = Math.max(0, endRow - stepRows);
      if (e.key === 'ArrowLeft')  endCol = Math.max(0, endCol - 1);
      if (e.key === 'ArrowRight') endCol = Math.min(speeches.length - 1, endCol + 1);
      const newSel = { ...sel, endCol, endRow };
      selectionRef.current = newSel;
      setSelection(newSel);
      const nc = Math.max(0, Math.min(speeches.length - 1, endCol));
      const nr = Math.max(0, Math.min(TOTAL_ROWS - 1, endRow));
      // Direct DOM move for the active cell within selection
      const oldEl = cellRefs.current[col]?.[row];
      if (oldEl) oldEl.style.visibility = 'visible';
      const newEl = cellRefs.current[nc]?.[nr];
      if (newEl) newEl.style.visibility = 'hidden';
      activeSpanRows.current = 1;
      activeCellRef.current = { col: nc, row: nr };
      applyTextareaPos(nc, nr);
      if (ta) {
        ta.style.color = getSpeechColor(speeches[nc], theme, settings);
        ta.value = getText(speeches[nc], nr);
        editSnapshot.current = null;
        resizeActiveTextarea();
        ta.setSelectionRange(ta.value.length, ta.value.length);
      }
      ensureVisible(nc, nr);
      return;
    }

    // Ctrl+C: copy selection
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && isMultiCellSelection(selectionRef.current)) {
      const bounds = selBounds(selectionRef.current);
      const rows = [];
      for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
        const cols = [];
        for (let c = bounds.minCol; c <= bounds.maxCol; c++) cols.push(getText(speeches[c], r));
        rows.push(cols.join('\t'));
      }
      navigator.clipboard.writeText(rows.join('\n')).catch(() => {});
      e.preventDefault();
      return;
    }

    // Delete extension arrow from source cell (when cell text is empty)
    if ((e.key === 'Delete' || e.key === 'Backspace') && !e.shiftKey && !e.ctrlKey && !e.altKey && !selectionRef.current) {
      const links = extensionLinksRef.current.filter(l => l.fromCol === col && l.fromRow === row);
      if (links.length > 0 && (!ta || !ta.value)) {
        e.preventDefault();
        links.forEach(l => deleteLink(l.id));
        return;
      }
    }

    // Delete/Backspace: clear multi-cell selection
    if ((e.key === 'Delete' || e.key === 'Backspace') && isMultiCellSelection(selectionRef.current)) {
      const bounds = selBounds(selectionRef.current);
        e.preventDefault();
        pushUndo(cloneGrid());
        for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
          for (let c = bounds.minCol; c <= bounds.maxCol; c++) setLocalText(speeches[c], r, '');
        }
        repaintCells();
        if (ta) ta.value = getText(speeches[col], row);
        recomputeRows(Array.from({ length: bounds.maxRow - bounds.minRow + 1 }, (_, i) => bounds.minRow + i));
        resizeActiveTextarea();
        selectionRef.current = null;
        setSelection(null);
        return;
    }

    // Navigation
    if (is('nav.extendArg')) { e.preventDefault(); insertRowsAfter(row, 1, true); return; }
    if (is('nav.nextArg')) { e.preventDefault(); continueResponseSequence(); return; }
    if (is('nav.down'))    { e.preventDefault(); moveTo(col, findSequenceAwareDownRow(col, row)); return; }
    if (is('nav.up'))      { e.preventDefault(); moveTo(col, row - 1); return; }
    if (is('nav.nextCol') || (e.key === 'Tab' && !e.shiftKey)) {
      e.preventDefault();
      let nc = col + 1;
      while (nc < speeches.length && blockedSet.has(`${nc},${row}`)) nc++;
      moveTo(nc, row);
      return;
    }
    if (is('nav.prevCol') || (e.key === 'Tab' && e.shiftKey)) {
      e.preventDefault();
      let nc = col - 1;
      while (nc >= 0 && blockedSet.has(`${nc},${row}`)) nc--;
      moveTo(nc, row);
      return;
    }
    if (is('nav.left'))  { e.preventDefault(); let nc = col - 1; while (nc >= 0 && blockedSet.has(`${nc},${row}`)) nc--; moveTo(nc, row); return; }
    if (is('nav.right')) { e.preventDefault(); let nc = col + 1; while (nc < speeches.length && blockedSet.has(`${nc},${row}`)) nc++; moveTo(nc, row); return; }

    // Zoom
    if (is('zoom.in'))    { e.preventDefault(); setZoom(z => +Math.min(3,    z + 0.1).toFixed(2)); return; }
    if (is('zoom.out'))   { e.preventDefault(); setZoom(z => +Math.max(0.25, z - 0.1).toFixed(2)); return; }
    if (is('zoom.reset')) { e.preventDefault(); setZoom(1); return; }

    // Global UI
    if (is('ui.commands'))  { e.preventDefault(); onOpenSettings?.('keybindings'); return; }
    if (is('ui.settings'))  { e.preventDefault(); onOpenSettings?.('display'); return; }
    if (is('ui.dashboard')) { e.preventDefault(); flush(); onBack?.(); return; }
    if (is('round.info'))   { e.preventDefault(); onOpenMeta?.(); return; }

    // Export
    if (is('export.sheet')) {
      e.preventDefault();
      const gridData = getCurrentGrid();
      flushSheet(sheetId, gridData);
      exportSheetCSV({ ...sheet, grid: gridData });
      return;
    }
    if (is('export.round')) {
      e.preventDefault();
      const gridData = getCurrentGrid();
      flushSheet(sheetId, gridData, extensionLinksRef.current);
      exportRoundCSV(getFreshRoundForExport(gridData));
      return;
    }

    // Sheets — no prompt, auto-name
    if (is('sheet.newOff')) {
      e.preventDefault();
      const base = round.sheets.filter(s => s.type === 'offcase').length;
      onAddSheet?.('offcase', `Off ${base + 1}`); return;
    }
    if (is('sheet.newAff')) {
      e.preventDefault();
      const base = round.sheets.filter(s => s.type === 'aff').length;
      onAddSheet?.('aff', base === 0 ? 'Case' : `Aff ${base + 1}`); return;
    }
    if (is('sheet.rename')) {
      e.preventDefault();
      onStartRename?.(sheet.id);
      return;
    }
  }, [keybindings, moveTo, flush, getCurrentGrid, flushSheet, sheetId, onOpenSettings, onBack, onOpenMeta, onAddSheet, onRename, onStartRename, onDeleteSheet, sheet, round, speeches, ensureVisible, applyTextareaPos, theme, setActiveSheet, insertRowsAfter, saveActiveTextarea, repaintCells, recomputeRows, resizeActiveTextarea, continueResponseSequence, findSequenceAwareDownRow, applyHistorySnapshot, pushUndo, cloneGrid, commitPendingEdit, extendArgument, blockedSet, sortedSheets, swapSheets, deleteLink]);


  // ── Paste: multi-cell ──
  const handlePaste = useCallback((e) => {
    const text = e.clipboardData.getData('text');
    if (text.includes('\t') || text.includes('\n')) {
      e.preventDefault();
      commitPendingEdit();
      pushUndo(cloneGrid());
      const { col, row } = activeCellRef.current;
      const rows = text.split('\n').map(r => r.split('\t'));
      for (let ri = 0; ri < rows.length; ri++) {
        for (let ci = 0; ci < rows[ri].length; ci++) {
          const tc = col + ci, tr = row + ri;
          if (tc < speeches.length && tr < TOTAL_ROWS)
            setLocalText(speeches[tc], tr, rows[ri][ci]);
        }
        if (row + ri < TOTAL_ROWS) {
          syncRowSpan(row + ri);
          protectResponseBlock(col, row + ri);
        }
      }
      if (taRef.current) taRef.current.value = getText(speeches[col], row);
      repaintCells();
      resizeActiveTextarea();
    }
  }, [speeches, repaintCells, resizeActiveTextarea, syncRowSpan, protectResponseBlock, pushUndo, cloneGrid, commitPendingEdit]);

  // ── Ctrl+scroll zoom ──
  const handleWheel = useCallback((e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    setZoom(z => +Math.max(0.25, Math.min(3, z + delta)).toFixed(2));
  }, []);

  // ── Re-apply textarea position and recompute spans after zoom/settings change ──
  useEffect(() => {
    recomputeAllRowSpans();
    forceRender(v => v + 1);
    const { col, row } = activeCellRef.current;
    applyTextareaPos(col, row);
    resizeActiveTextarea();
  }, [zoom, applyTextareaPos, resizeActiveTextarea, recomputeAllRowSpans]);


  // ── Cell mouse handlers ──
  const handleCellMouseDown = useCallback((colIdx, rowIdx, e) => {
    if (e.button !== 0) return;
    if (blockedSet.has(`${colIdx},${rowIdx}`)) return;
    e.preventDefault();
    if (e.shiftKey) {
      const anchor = selectionRef.current
        ? { col: selectionRef.current.anchorCol, row: selectionRef.current.anchorRow }
        : activeCellRef.current;
      const newSel = { anchorCol: anchor.col, anchorRow: anchor.row, endCol: colIdx, endRow: rowIdx };
      selectionRef.current = newSel;
      setSelection(newSel);
      moveTo(colIdx, rowIdx, true);
    } else {
      isDragging.current = true;
      moveTo(colIdx, rowIdx);
      selectionRef.current = { anchorCol: colIdx, anchorRow: rowIdx, endCol: colIdx, endRow: rowIdx };
    }
  }, [moveTo, setSelection, blockedSet]);

  const handleCellMouseMove = useCallback((colIdx, rowIdx) => {
    if (!isDragging.current) return;
    const sel = selectionRef.current;
    if (!sel || (sel.endCol === colIdx && sel.endRow === rowIdx)) return;
    const newSel = { ...sel, endCol: colIdx, endRow: rowIdx };
    selectionRef.current = newSel;
    setSelection({ ...newSel });
  }, [setSelection]);

  // ── Selection bounds ──
  const isMultiSel = selection && (
    selection.anchorCol !== selection.endCol || selection.anchorRow !== selection.endRow
  );
  const sBounds = isMultiSel ? selBounds(selection) : null;

  // ── Computed active cell for JSX (refs are the authoritative source — updated by syncRowSpan/recomputeAllRowSpans) ──
  const ac = activeCellRef.current;
  const actualCw = getColWidth();
  const rowSpans = rowSpansRef.current;
  const rowTops = rowTopsRef.current;
  const activeSpeechColor = getSpeechColor(speeches[ac.col] ?? speeches[0], theme, settings);
  const activeCellChrome = getActiveCellChrome(settings, theme, activeSpeechColor);

  useEffect(() => {
    const { col } = activeCellRef.current;
    if (taRef.current) taRef.current.style.color = getSpeechColor(speeches[col] ?? speeches[0], theme, settings);
  }, [speeches, theme, settings, affColor, negColor]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: ui.gridBg ?? theme.bg,
        backgroundImage: ui.gridBackgroundImage,
        backgroundSize: ui.gridBackgroundSize,
      }}
      onWheel={handleWheel}
    >
      {/* Sticky column headers */}
      <div
        ref={headerRef}
        style={{
          display: 'flex', flexShrink: 0, overflow: 'hidden',
          borderBottom: `2px solid ${ui.border ?? theme.border}`,
          background: ui.gridHeaderBg ?? theme.bgSecondary,
        }}
      >
        {speeches.map((sp, colIdx) => {
          return (
            <div
              key={sp}
              style={{
                width: `${100 / speeches.length}%`,
                minWidth: 0,
                flex: '1 0 0',
                flexShrink: 0,
                padding: `5px ${pad}px`,
                fontWeight: 700, fontSize: Math.max(9, Math.round(11 * zoom)),
                color: getSpeechColor(sp, theme, settings),
                textAlign: 'center', letterSpacing: 0.8,
                textTransform: 'uppercase',
                borderRight: colIdx === speeches.length - 1 ? 'none' : `1px solid ${ui.border ?? theme.border}`,
              }}
            >
              {sp}
            </div>
          );
        })}
      </div>

      {/* Scrollable grid */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          position: 'relative',
          background: ui.gridBg ?? theme.bg,
          backgroundImage: ui.gridBackgroundImage,
          backgroundSize: ui.gridBackgroundSize,
        }}
      >
        <div ref={gridRef} style={{
          display: 'flex',
          minWidth: '100%',
          width: '100%',
          height: gridHeightRef.current * rh,
          position: 'relative',
        }}>
          {speeches.map((sp, colIdx) => {
            const color = getSpeechColor(sp, theme, settings);
            return (
              <div
                key={sp}
                style={{
                  width: `${100 / speeches.length}%`,
                  minWidth: 0,
                  flex: '1 0 0',
                  flexShrink: 0,
                  borderRight: colIdx === speeches.length - 1 ? 'none' : `1px solid ${ui.borderSubtle ?? theme.borderSubtle}`,
                }}
              >
                {Array.from({ length: TOTAL_ROWS }, (_, rowIdx) => {
                  const isActive = colIdx === ac.col && rowIdx === ac.row;
                  const isSel = sBounds &&
                    colIdx >= sBounds.minCol && colIdx <= sBounds.maxCol &&
                    rowIdx >= sBounds.minRow && rowIdx <= sBounds.maxRow;
                  const blockedColor = blockedColorMap[`${colIdx},${rowIdx}`];
                  return (
                    <div
                      key={rowIdx}
                      ref={el => {
                        if (!cellRefs.current[colIdx]) cellRefs.current[colIdx] = [];
                        cellRefs.current[colIdx][rowIdx] = el;
                      }}
                      onMouseDown={(e) => handleCellMouseDown(colIdx, rowIdx, e)}
                      onMouseMove={() => handleCellMouseMove(colIdx, rowIdx)}
                      style={{
                        height: rowSpans[rowIdx] * rh,
                        display: 'flex',
                        visibility: isActive ? 'hidden' : 'visible',
                        alignItems: 'center',
                        padding: `0 ${pad}px`,
                        fontSize: fs,
                        fontFamily: settings.fontFamily,
                        color,
                        background: isSel ? theme.selection : 'transparent',
                        borderBottom: `1px solid ${ui.borderSubtle ?? theme.borderSubtle}`,
                        cursor: blockedColor ? 'not-allowed' : 'text',
                        whiteSpace: textWrap ? 'pre-wrap' : 'nowrap',
                        wordBreak: textWrap ? 'break-word' : 'normal',
                        overflow: 'hidden',
                        boxSizing: 'border-box',
                        userSelect: 'none',
                        lineHeight: `${lineHeightPx}px`,
                      }}
                    >
                      {localData.current[sp]?.[rowIdx] ?? ''}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Active cell textarea overlay — positioned via direct DOM after init */}
          <svg
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 8, overflow: 'visible' }}
          >
            <defs>
              <marker id={`extend-arrow-${sheetId}-aff`} markerWidth="5" markerHeight="5" refX="4.5" refY="2.5" orient="auto">
                <path d="M0,0 L5,2.5 L0,5 Z" fill={affColor} />
              </marker>
              <marker id={`extend-arrow-${sheetId}-neg`} markerWidth="5" markerHeight="5" refX="4.5" refY="2.5" orient="auto">
                <path d="M0,0 L5,2.5 L0,5 Z" fill={negColor} />
              </marker>
            </defs>
            {extensionLinks.map(link => {
              const color = link.side === 'neg' ? negColor : affColor;
              const markerId = `extend-arrow-${sheetId}-${link.side ?? 'aff'}`;
              const y1 = ((rowTops[link.fromRow] ?? link.fromRow) + (rowSpans[link.fromRow] ?? 1) / 2) * rh;
              const y2 = ((rowTops[link.toRow] ?? link.toRow) + (rowSpans[link.toRow] ?? 1) / 2) * rh;
              const x1 = (link.fromCol + 1) * actualCw - 10;
              const x2 = link.toCol * actualCw - 10;
              const mid = x1 + Math.max(28, (x2 - x1) * 0.5);
              const pathD = `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`;
              return (
                <g key={link.id}>
                  <path d={pathD} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" markerEnd={`url(#${markerId})`} opacity={0.85} />
                  <path d={pathD} fill="none" stroke="transparent" strokeWidth={12} style={{ pointerEvents: 'stroke', cursor: 'pointer' }} onClick={() => deleteLink(link.id)} />
                </g>
              );
            })}
          </svg>

          <textarea
            ref={taRef}
            rows={1}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onInput={(e) => {
              if (!editSnapshot.current) editSnapshot.current = cloneGrid();
              const { col, row } = activeCellRef.current;
              setLocalText(speeches[col], row, e.currentTarget.value);
              updateCellDom(col, row, e.currentTarget.value);
              syncActiveRowSpan(row, col, e.currentTarget);
              resizeActiveTextarea();
              if (selectionRef.current) { selectionRef.current = null; setSelection(null); }
            }}
            onBlur={flush}
            style={{
              position: 'absolute',
              left: ac.col * actualCw,
              top: rowTops[ac.row] * rh,
              width: actualCw,
              height: rowSpans[ac.row] * rh,
              padding: `0 ${pad}px`,
              margin: 0,
              border: 'none',
              boxShadow: activeCellChrome.boxShadow,
              boxSizing: 'border-box',
              background: activeCellChrome.background,
              color: getSpeechColor(speeches[ac.col] ?? speeches[0], theme, settings),
              fontSize: fs,
              fontFamily: settings.fontFamily,
              lineHeight: `${lineHeightPx}px`,
              resize: 'none',
              overflow: 'hidden',
              outline: 'none',
              caretColor: theme.caret,
              zIndex: 10,
              whiteSpace: textWrap ? 'pre-wrap' : 'nowrap',
            }}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
          />
        </div>
      </div>


      {/* Zoom badge */}
      {zoom !== 1 && (
        <div style={{
          position: 'fixed', bottom: 32, right: 16, pointerEvents: 'none',
          background: theme.bgTertiary, border: `1px solid ${theme.border}`,
          borderRadius: 4, padding: '3px 8px', fontSize: 11, color: theme.textMuted,
        }}>
          {Math.round(zoom * 100)}%
        </div>
      )}
    </div>
  );
}
