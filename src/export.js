import { roundDisplayName, sortSheetsForDisplay } from './store';
import { THEMES, getSpeechColor, getAffColor, getNegColor } from './theme';

function dl(content, filename, type = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function esc(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br>');
}

function speechSide(speech) {
  if (['1AC', '2AC', '1AR', '2AR'].includes(speech)) return 'aff';
  if (['1NC', 'Block', '2NR'].includes(speech)) return 'neg';
  return null;
}

function estimateExportRows(text, speechCount, settings) {
  if (!text?.trim()) return 1;
  const fontSize = Number(settings?.fontSize) || 12;
  const colWidth = Math.max(90, Math.min(180, 980 / Math.max(1, speechCount)));
  const charsPerLine = Math.max(10, Math.floor(colWidth / (fontSize * 0.56)));
  return Math.min(8, text.split('\n').reduce((sum, line) => (
    sum + Math.max(1, Math.ceil(line.length / charsPerLine))
  ), 0));
}

export function exportRoundHTML(round, options = {}) {
  const name = roundDisplayName(round);
  const judges = round.judges?.trim();
  const settings = options.settings ?? {};
  const theme = THEMES[settings.theme] ?? THEMES.light;
  const affColor = getAffColor(settings, theme);
  const negColor = getNegColor(settings, theme);
  const rowHeight = Math.max(18, Number(settings.rowHeight) || 22);
  const fontSize = Math.max(9, Number(settings.fontSize) || 12);
  const fontFamily = settings.fontFamily || 'Arial, sans-serif';

  const sheetHtml = sortSheetsForDisplay(round.sheets).map(sh => {
    const { speeches, grid } = sh;
    const rows = grid[speeches[0]]?.length ?? 0;
    const links = sh.extensionLinks ?? [];
    let lastRow = -1;
    for (let r = rows - 1; r >= 0; r--) {
      if (speeches.some(sp => (grid[sp]?.[r] ?? '').trim())) { lastRow = r; break; }
    }
    for (const link of links) lastRow = Math.max(lastRow, link.fromRow ?? 0, link.toRow ?? 0);

    const rowCount = Math.max(0, lastRow + 1);
    const spans = Array.from({ length: rowCount }, (_, r) => (
      Math.max(1, ...speeches.map(sp => estimateExportRows(grid[sp]?.[r] ?? '', speeches.length, settings)))
    ));
    const tops = [];
    let totalUnits = 0;
    for (let r = 0; r < rowCount; r++) {
      tops[r] = totalUnits;
      totalUnits += spans[r];
    }
    const totalHeight = totalUnits * rowHeight;

    const header = speeches.map(sp => (
      `<div class="header-cell" style="color:${getSpeechColor(sp, theme, settings)}">${esc(sp)}</div>`
    )).join('');
    const bodyRows = [];
    for (let r = 0; r < rowCount; r++) {
      const height = spans[r] * rowHeight;
      const cells = speeches.map(sp => (
        `<div class="flow-cell" style="min-height:${height}px;color:${getSpeechColor(sp, theme, settings)}">${esc(grid[sp]?.[r] ?? '')}</div>`
      )).join('');
      bodyRows.push(`<div class="flow-row" style="grid-template-columns:repeat(${speeches.length},minmax(0,1fr));min-height:${height}px">${cells}</div>`);
    }

    const arrows = links.map(link => {
      if (link.fromCol == null || link.toCol == null || link.fromRow == null || link.toRow == null) return '';
      if (link.fromRow >= rowCount || link.toRow >= rowCount) return '';
      const color = link.side === 'neg' || speechSide(speeches[link.fromCol]) === 'neg' ? negColor : affColor;
      const colWidth = 100 / speeches.length;
      const x1 = (link.fromCol + 1) * colWidth - 1.5;
      const x2 = link.toCol * colWidth - 1.5;
      const y1 = ((tops[link.fromRow] ?? link.fromRow) + (spans[link.fromRow] ?? 1) / 2) * rowHeight;
      const y2 = ((tops[link.toRow] ?? link.toRow) + (spans[link.toRow] ?? 1) / 2) * rowHeight;
      const mid = x1 + Math.max(5, (x2 - x1) * 0.5);
      return `<path d="M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" marker-end="url(#arrow-${link.side === 'neg' ? 'neg' : 'aff'})" opacity="0.9"/>`;
    }).join('');

    return `<section>
      <h2>${esc(sh.name)}</h2>
      <div class="flow-sheet" style="--cols:${speeches.length};">
        <div class="flow-header" style="grid-template-columns:repeat(${speeches.length},minmax(0,1fr));">${header}</div>
        <div class="flow-body" style="height:${totalHeight}px">
          <svg class="arrows" viewBox="0 0 100 ${Math.max(1, totalHeight)}" preserveAspectRatio="none">
            <defs>
              <marker id="arrow-aff" markerWidth="5" markerHeight="5" refX="4.5" refY="2.5" orient="auto"><path d="M0,0 L5,2.5 L0,5 Z" fill="${affColor}"/></marker>
              <marker id="arrow-neg" markerWidth="5" markerHeight="5" refX="4.5" refY="2.5" orient="auto"><path d="M0,0 L5,2.5 L0,5 Z" fill="${negColor}"/></marker>
            </defs>
            ${arrows}
          </svg>
          ${bodyRows.join('')}
        </div>
      </div>
    </section>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>${name}</title>
<style>
body{font-family:${fontFamily};font-size:${fontSize}px;background:${theme.bg};color:${theme.text};margin:20px}
h1{font-size:18px;margin:0 0 6px}.meta{font-size:12px;margin:0 0 20px;color:${theme.textMuted}}h2{font-size:13px;margin:24px 0 6px;color:${theme.text}}
.flow-sheet{width:100%;border-top:1px solid ${theme.border};border-left:1px solid ${theme.border};margin-bottom:16px;overflow:hidden}
.flow-header,.flow-row{display:grid;width:100%}
.header-cell{background:${theme.bgSecondary};font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:.5px;padding:5px 8px;border-right:1px solid ${theme.border};border-bottom:2px solid ${theme.border};text-align:center}
.flow-body{position:relative}
.flow-row{position:relative;z-index:1}
.flow-cell{display:flex;align-items:center;padding:0 5px;border-right:1px solid ${theme.borderSubtle};border-bottom:1px solid ${theme.borderSubtle};white-space:pre-wrap;word-break:break-word;overflow:hidden;box-sizing:border-box;background:${theme.bg}}
.arrows{position:absolute;inset:0;width:100%;height:100%;z-index:2;pointer-events:none;overflow:visible}
@media print{body{margin:10px}.flow-sheet{break-inside:avoid}}
</style></head>
<body><h1>${name}</h1>${judges ? `<div class="meta"><strong>Judge(s):</strong> ${judges.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>` : ''}${sheetHtml}</body></html>`;
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
  const judges = round.judges?.trim();
  const parts = sortSheetsForDisplay(round.sheets).map(sh => {
    const { speeches, grid, name } = sh;
    const rows = grid[speeches[0]]?.length ?? 0;
    const lines = [`=== ${name} ===`, speeches.map(s => `"${s}"`).join(',')];
    for (let r = 0; r < rows; r++) {
      const row = speeches.map(sp => `"${(grid[sp]?.[r] ?? '').replace(/"/g, '""')}"`);
      if (row.some(c => c !== '""')) lines.push(row.join(','));
    }
    return lines.join('\n');
  });
  const meta = judges ? [`"${roundDisplayName(round).replace(/"/g, '""')}"`, `"Judge(s): ${judges.replace(/"/g, '""')}"`] : [];
  dl([...meta, parts.join('\n\n')].filter(Boolean).join('\n\n'), `${roundDisplayName(round)}.csv`);
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
