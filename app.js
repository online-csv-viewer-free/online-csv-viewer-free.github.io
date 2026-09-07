let rawHeaders = [];
let rawRows = [];
let activeData = [];
let currentFilename = 'data.csv';

// Elements
const heroSection = document.getElementById('hero-section');
const tableSection = document.getElementById('table-section');
const tableControls = document.getElementById('table-controls');
const fileInput = document.getElementById('file-input');
const dropzone = document.getElementById('dropzone');
const tableHead = document.getElementById('table-head');
const tableBody = document.getElementById('table-body');
const searchBox = document.getElementById('search-box');
const statRows = document.getElementById('stat-rows');
const statFilename = document.getElementById('stat-filename');
const emptySearchMsg = document.getElementById('empty-search-msg');

// File Upload & Drag-Drop Listeners
fileInput.addEventListener('change', (e) => {
  if (e.target.files.length) handleFile(e.target.files[0]);
});

['dragenter', 'dragover'].forEach(name => {
  dropzone.addEventListener(name, (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
});

['dragleave', 'drop'].forEach(name => {
  dropzone.addEventListener(name, (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
  });
});

dropzone.addEventListener('drop', (e) => {
  if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});

document.getElementById('open-new-btn').addEventListener('click', () => {
  fileInput.value = '';
  fileInput.click();
});

// Robust Client-Side CSV Parser
function parseDelimitedText(text) {
  // Auto-detect delimiter
  const firstLine = text.split(/\r\n|\n/)[0] || '';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const pipeCount = (firstLine.match(/\|/g) || []).length;

  let delimiter = ',';
  const max = Math.max(commaCount, semiCount, tabCount, pipeCount);
  if (max === semiCount) delimiter = ';';
  else if (max === tabCount) delimiter = '\t';
  else if (max === pipeCount) delimiter = '|';

  const rows = [];
  let row = [];
  let cell = '';
  let insideQuote = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuote && nextChar === '"') {
        cell += '"';
        i++;
      } else {
        insideQuote = !insideQuote;
      }
    } else if (char === delimiter && !insideQuote) {
      row.push(cell.trim());
      cell = '';
    } else if ((char === '\r' || char === '\n') && !insideQuote) {
      if (char === '\r' && nextChar === '\n') i++;
      row.push(cell.trim());
      if (row.some(c => c !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (cell || row.length) {
    row.push(cell.trim());
    if (row.some(c => c !== '')) rows.push(row);
  }
  return rows;
}

function handleFile(file) {
  currentFilename = file.name;
  statFilename.textContent = file.name;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    const parsed = parseDelimitedText(e.target.result);
    if (!parsed.length) return alert('The selected file is empty or invalid.');
    
    rawHeaders = parsed[0];
    rawRows = parsed.slice(1);
    activeData = [...rawRows];

    renderTable();
    heroSection.hidden = true;
    tableSection.hidden = false;
    tableControls.hidden = false;
  };
  reader.readAsText(file);
}

// Render Table
function renderTable() {
  statRows.textContent = `${activeData.length} rows`;
  
  // Headers
  tableHead.innerHTML = `<tr>${rawHeaders.map((h, i) => `<th data-idx="${i}">${escapeHtml(h)} &#x21D5;</th>`).join('')}</tr>`;

  // Body (Limit rendering for massive performance)
  const maxRender = 1000;
  const slice = activeData.slice(0, maxRender);
  
  tableBody.innerHTML = slice.map((r, rIdx) => 
    `<tr>${rawHeaders.map((_, cIdx) => `<td contenteditable="true" data-row="${rIdx}" data-col="${cIdx}">${escapeHtml(r[cIdx] || '')}</td>`).join('')}</tr>`
  ).join('');

  emptySearchMsg.hidden = activeData.length > 0;
}

// Sort columns
tableHead.addEventListener('click', (e) => {
  const th = e.target.closest('th');
  if (!th) return;
  const idx = parseInt(th.dataset.idx);
  const isAsc = th.dataset.order === 'asc';
  
  activeData.sort((a, b) => {
    const valA = a[idx] || '';
    const valB = b[idx] || '';
    return isAsc ? valB.localeCompare(valA, undefined, { numeric: true }) : valA.localeCompare(valB, undefined, { numeric: true });
  });

  th.dataset.order = isAsc ? 'desc' : 'asc';
  renderTable();
});

// Real-time Search
searchBox.addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase().trim();
  if (!query) {
    activeData = [...rawRows];
  } else {
    activeData = rawRows.filter(row => row.some(cell => (cell || '').toLowerCase().includes(query)));
  }
  renderTable();
});

// Quick shortcut '/' to jump to search
window.addEventListener('keydown', (e) => {
  if (e.key === '/' && document.activeElement !== searchBox && !tableControls.hidden) {
    e.preventDefault();
    searchBox.focus();
  }
});

// In-place edits update memory
tableBody.addEventListener('input', (e) => {
  const td = e.target;
  const rIdx = td.dataset.row;
  const cIdx = td.dataset.col;
  if (activeData[rIdx]) {
    activeData[rIdx][cIdx] = td.innerText;
  }
});

// Export features
document.getElementById('export-csv').addEventListener('click', () => {
  const csvContent = [rawHeaders.join(','), ...activeData.map(r => r.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(','))].join('\r\n');
  downloadBlob(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }), `edited-${currentFilename}`);
});

document.getElementById('export-json').addEventListener('click', () => {
  const jsonData = activeData.map(r => {
    const obj = {};
    rawHeaders.forEach((h, i) => obj[h] = r[i] || '');
    return obj;
  });
  downloadBlob(new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' }), 'data.json');
});

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.innerText = text;
  return div.innerHTML;
}

// Service Worker for Offline PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}