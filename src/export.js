import { roundDisplayName } from './store';

const AFF_SPEECHES = new Set(['1AC', '2AC', '1AR', '2AR']);
const NEG_SPEECHES = new Set(['1NC', 'Block', '2NR']);
const ROW_HEIGHT = 28;
const HEADER_HEIGHT = 28;
const CELL_PAD_X = 8;
const CELL_PAD_Y = 4;

function dl(content, filename, type = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br>');
}

function speechSide(speech) {
  if (AFF_SPEECHES.has(speech)) return 'aff';
  if (NEG_SPEECHES.has(speech)) return 'neg';
  return null;
}

function speechColor(speech, colors) {
  const side = speechSide(speech);
  if (side === 'aff') return colors.aff;
  if (side === 'neg') return colors.neg;
  return '#374151';
}

function estimateExportRows(text) {
  if (!text) return 1;
  const charsPerLine = 32;
  return Math.min(8, text.split('\n').reduce((sum, line) => (
    sum + Math.max(1, Math.ceil(line.length / charsPerLine))
  ), 0));
}

function sheetRowSpans(sheet) {
  const { speeches, grid } = sheet;
  const rows = grid[speeches[0]]?.length ?? 0;
  const spans = [];
  for (let r = 0; r < rows; r++) {
    let span = 1;
    for (const sp of speeches) span = Math.max(span, estimateExportRows(grid[sp]?.[r] ?? ''));
    spans[r] = span;
  }
  return spans;
}

function rowTopsFromSpans(spans) {
  const tops = [];
  let total = 0;
  for (let r = 0; r < spans.length; r++) {
    tops[r] = total;
    total += spans[r] ?? 1;
  }
  return { tops, total };
}

export function exportRoundHTML(round, options = {}) {
  const name = roundDisplayName(round);
  const colors = {
    aff: options.affColor ?? '#1d4ed8',
    neg: options.negColor ?? '#b91c1c',
  };

  const sheetHtml = round.sheets.filter(sh => sh.type !== 'cx').map(sh => {
    const { speeches, grid } = sh;
    const rows = grid[speeches[0]]?.length ?? 0;
    let lastRow = 0;
    for (let r = rows - 1; r >= 0; r--) {
      if (speeches.some(sp => (grid[sp]?.[r] ?? '').trim())) { lastRow = r; break; }
    }
    for (const link of sh.extensionLinks ?? []) lastRow = Math.max(lastRow, link.fromRow ?? 0, link.toRow ?? 0);

    const spans = sheetRowSpans(sh);
    const { tops, total } = rowTopsFromSpans(spans);
    const bodyHeight = Math.max(ROW_HEIGHT, total * ROW_HEIGHT);
    const colPct = 100 / speeches.length;
    const cells = [];

    for (let c = 0; c < speeches.length; c++) {
      const sp = speeches[c];
      const color = speechColor(sp, colors);
      cells.push(`
        <div class="header-cell" style="left:${c * colPct}%;width:${colPct}%;color:${color}">${escapeHtml(sp)}</div>
      `);
    }

    for (let r = 0; r <= lastRow; r++) {
      for (let c = 0; c < speeches.length; c++) {
        const sp = speeches[c];
        const color = speechColor(sp, colors);
        const text = grid[sp]?.[r] ?? '';
        const top = HEADER_HEIGHT + (tops[r] ?? r) * ROW_HEIGHT;
        const height = (spans[r] ?? 1) * ROW_HEIGHT;
        cells.push(`
          <div class="flow-cell" style="left:${c * colPct}%;top:${top}px;width:${colPct}%;height:${height}px;color:${color}">
            ${escapeHtml(text)}
          </div>
        `);
      }
    }

    const arrows = (sh.extensionLinks ?? []).map(link => {
      const sideColor = link.side === 'neg' ? colors.neg : colors.aff;
      const fromCol = link.fromCol ?? 0;
      const toCol = link.toCol ?? fromCol + 1;
      const fromRow = link.fromRow ?? 0;
      const toRow = link.toRow ?? fromRow;
      const x1 = ((fromCol + 1) / speeches.length) * 100 - 1.1;
      const x2 = (toCol / speeches.length) * 100 - 1.1;
      const y1 = HEADER_HEIGHT + ((tops[fromRow] ?? fromRow) + (spans[fromRow] ?? 1) / 2) * ROW_HEIGHT;
      const y2 = HEADER_HEIGHT + ((tops[toRow] ?? toRow) + (spans[toRow] ?? 1) / 2) * ROW_HEIGHT;
      const mid = x1 + Math.max(3, (x2 - x1) * 0.5);
      return `
        <path d="M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}"
          fill="none" stroke="${sideColor}" stroke-width="2" stroke-linecap="round"
          marker-end="url(#arrow-${link.side === 'neg' ? 'neg' : 'aff'})" opacity="0.85"
          vector-effect="non-scaling-stroke" />
      `;
    }).join('');

    return `
      <section>
        <h2>${escapeHtml(sh.name)}</h2>
        <div class="flow-sheet" style="height:${HEADER_HEIGHT + bodyHeight}px">
          ${cells.join('')}
          <svg class="arrow-layer" viewBox="0 0 100 ${HEADER_HEIGHT + bodyHeight}" preserveAspectRatio="none">
            <defs>
              <marker id="arrow-aff" markerWidth="5" markerHeight="5" refX="4.5" refY="2.5" orient="auto">
                <path d="M0,0 L5,2.5 L0,5 Z" fill="${colors.aff}" />
              </marker>
              <marker id="arrow-neg" markerWidth="5" markerHeight="5" refX="4.5" refY="2.5" orient="auto">
                <path d="M0,0 L5,2.5 L0,5 Z" fill="${colors.neg}" />
              </marker>
            </defs>
            ${arrows}
          </svg>
        </div>
      </section>
    `;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>${escapeHtml(name)}</title>
<style>
body{font-family:Arial,sans-serif;font-size:12px;background:#fff;color:#111827;margin:20px}
h1{font-size:18px;margin:0 0 20px}
h2{font-size:13px;margin:24px 0 6px;color:#374151}
section{break-inside:avoid;margin-bottom:18px}
.flow-sheet{position:relative;width:100%;border-top:1px solid #cbd5e1;border-left:1px solid #cbd5e1;overflow:hidden}
.header-cell{position:absolute;top:0;height:${HEADER_HEIGHT}px;box-sizing:border-box;background:#f8fafc;border-right:1px solid #cbd5e1;border-bottom:1px solid #cbd5e1;padding:6px ${CELL_PAD_X}px;font-weight:700;font-size:10px;text-transform:uppercase;text-align:center;letter-spacing:.5px}
.flow-cell{position:absolute;box-sizing:border-box;border-right:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;padding:${CELL_PAD_Y}px ${CELL_PAD_X}px;white-space:pre-wrap;word-break:break-word;overflow:hidden;line-height:1.3;background:#fff}
.flow-cell:nth-child(even){background:#fdfdfd}
.arrow-layer{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible}
@media print{body{margin:10mm}.flow-sheet{break-inside:avoid}}
</style></head>
<body><h1>${escapeHtml(name)}</h1>${sheetHtml}</body></html>`;
  dl(html, `${name}.html`, 'text/html;charset=utf-8;');
}

export function exportSheetCSV(sheet) {
  const { speeches, grid, name } = sheet;
  const rows = grid[speeches[0]]?.length ?? 0;
  const lines = [speeches.map(s => `"${s}"`).join(',')];
  for (let r = 0; r < rows; r++) {
    const row = speeches.map(sp => `"${(grid[sp]?.[r] ?? '').replace(/"/g, '""')}"`);
    if (row.some(c => c !== '""')) lines.push(row.join(','));
  }
  while (lines.length > 1 && lines[lines.length - 1].split(',').every(c => c === '""')) lines.pop();
  dl(lines.join('\n'), `${name}.csv`);
}

export function exportRoundCSV(round) {
  const parts = round.sheets.map(sh => {
    const { speeches, grid, name } = sh;
    const rows = grid[speeches[0]]?.length ?? 0;
    const lines = [`=== ${name} ===`, speeches.map(s => `"${s}"`).join(',')];
    for (let r = 0; r < rows; r++) {
      const row = speeches.map(sp => `"${(grid[sp]?.[r] ?? '').replace(/"/g, '""')}"`);
      if (row.some(c => c !== '""')) lines.push(row.join(','));
    }
    return lines.join('\n');
  });
  dl(parts.join('\n\n'), `${roundDisplayName(round)}.csv`);
}

export function exportJflow(round) {
  const data = { version: 1, type: 'jayflow-round', exportedAt: new Date().toISOString(), round };
  dl(JSON.stringify(data, null, 2), `${roundDisplayName(round)}.jflow`, 'application/json');
}

export function importJflow() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.jflow,application/json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) { reject(new Error('No file')); return; }
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          if (data.type !== 'jayflow-round' || !data.round) throw new Error('Not a valid .jflow file');
          resolve(data.round);
        } catch (err) { reject(err); }
      };
      reader.onerror = () => reject(new Error('Read error'));
      reader.readAsText(file);
    };
    input.click();
  });
}
