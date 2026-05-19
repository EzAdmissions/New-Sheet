import { roundDisplayName } from './store';

function dl(content, filename, type = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function exportRoundHTML(round) {
  const name = roundDisplayName(round);
  const judges = round.judges?.trim();
  const sheetHtml = round.sheets.map(sh => {
    const { speeches, grid } = sh;
    const rows = grid[speeches[0]]?.length ?? 0;
    let lastRow = 0;
    for (let r = rows - 1; r >= 0; r--) {
      if (speeches.some(sp => (grid[sp]?.[r] ?? '').trim())) { lastRow = r; break; }
    }
    const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
    const header = speeches.map(sp => `<th>${esc(sp)}</th>`).join('');
    const bodyRows = [];
    for (let r = 0; r <= lastRow; r++) {
      const cells = speeches.map(sp => `<td>${esc(grid[sp]?.[r] ?? '')}</td>`).join('');
      bodyRows.push(`<tr>${cells}</tr>`);
    }
    return `<section><h2>${esc(sh.name)}</h2><table><thead><tr>${header}</tr></thead><tbody>${bodyRows.join('')}</tbody></table></section>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>${name}</title>
<style>
body{font-family:Arial,sans-serif;font-size:12px;background:#fff;color:#000;margin:20px}
h1{font-size:18px;margin-bottom:6px}.meta{font-size:12px;margin:0 0 20px;color:#333}h2{font-size:13px;margin:24px 0 6px;color:#444}
table{border-collapse:collapse;width:100%;table-layout:fixed;margin-bottom:16px}
th{background:#f0f0f0;font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:.5px;padding:5px 8px;border:1px solid #ccc;text-align:left}
td{padding:3px 8px;border:1px solid #ddd;vertical-align:top;white-space:pre-wrap;word-break:break-word}
tr:nth-child(even) td{background:#fafafa}
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
