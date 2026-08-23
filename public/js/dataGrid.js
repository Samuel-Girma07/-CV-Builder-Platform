let gridState = {
  data: [],
  prefs: { columnOrder: [], hiddenColumns: [], customColumnDefs: [] },
  sortCol: 'created_at',
  sortDir: 'desc',
  filters: {},
  selectedIds: new Set(),
  editing: null, // { id, field }
  lastDeleted: null, // { ids: [...], data: [...] } — restorable via bulk 'restore'
};

const DEFAULT_COLS = [
  { id: '_select', label: '☑', width: '40px', readOnly: true },
  { id: 'company', label: 'Company' },
  { id: 'job_title', label: 'Job Title' },
  { id: 'status', label: 'Status' },
  { id: 'ats_match_score', label: 'ATS Score', readOnly: true },
  { id: 'days_since', label: 'Days Since Applied', readOnly: true },
];

function getGridColumns() {
  const customCols = (gridState.prefs.custom_column_defs || []).map(c => ({ id: 'custom_' + c, label: c, isCustom: true }));
  const allCols = [...DEFAULT_COLS, ...customCols];
  const order = gridState.prefs.column_order || [];
  const hidden = new Set(gridState.prefs.hidden_columns || []);
  
  const ordered = [];
  order.forEach(id => {
    const col = allCols.find(c => c.id === id);
    if (col && !hidden.has(col.id)) ordered.push(col);
  });
  
  allCols.forEach(c => {
    if (!ordered.find(o => o.id === c.id) && !hidden.has(c.id)) {
      ordered.push(c);
    }
  });
  
  return ordered;
}

function getCellValue(row, colId) {
  if (colId === 'days_since') {
    const diff = Date.now() - new Date(row.created_at).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }
  if (colId.startsWith('custom_')) {
    const customKey = colId.replace('custom_', '');
    return (row.custom_fields || {})[customKey] || '';
  }
  return row[colId] === null || row[colId] === undefined ? '' : row[colId];
}

async function renderDataGrid() {
  const query = new URLSearchParams({ sort: gridState.sortCol, order: gridState.sortDir });
  for (const [k, v] of Object.entries(gridState.filters)) {
    if (v) query.append('filter_' + k, v);
  }
  
  shell('<div style="padding:20px;">Loading grid...</div>');
  
  try {
    const [dataRes, prefsRes] = await Promise.all([
      api.get('/api/applications?' + query.toString()),
      api.get('/api/applications/table-preferences')
    ]);
    gridState.data = dataRes.applications;
    gridState.prefs = prefsRes.preferences || { column_order: [], hidden_columns: [], custom_column_defs: [] };
    // Drop selections that no longer match visible rows so filters/sorts can
    // never leave hidden rows silently selected for bulk actions.
    const liveIds = new Set(gridState.data.map((r) => r.id));
    gridState.selectedIds = new Set([...gridState.selectedIds].filter((id) => liveIds.has(id)));
    if (gridState.lastDeleted) {
      gridState.lastDeleted.ids = gridState.lastDeleted.ids.filter((id) => !liveIds.has(id));
      gridState.lastDeleted.data = gridState.lastDeleted.data.filter((r) => !liveIds.has(r.id));
      if (!gridState.lastDeleted.ids.length) gridState.lastDeleted = null;
    }
    drawGrid();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function drawGrid() {
  const cols = getGridColumns();
  
  const ths = cols.map(c => {
    if (c.id === '_select') {
      const allSelected = gridState.data.length > 0 && gridState.selectedIds.size === gridState.data.length;
      return `<th style="width:40px">
                <div class="custom-checkbox-wrap" style="margin: 0 auto;">
                  <input type="checkbox" id="selectAll" ${allSelected ? 'checked' : ''} style="display: none;">
                  <label for="selectAll" class="custom-checkbox-box"></label>
                </div>
              </th>`;
    }
    const isSortable = ['job_title', 'company', 'ats_match_score', 'created_at', 'status'].includes(c.id);
    const sortClass = isSortable ? 'sortable ' + (gridState.sortCol === c.id ? 'sorted' : '') : '';
    const indicator = gridState.sortCol === c.id ? (gridState.sortDir === 'asc' ? '▲' : '▼') : (isSortable ? '↕' : '');
    return `<th data-col="${c.id}" class="${sortClass}">${escapeHtml(c.label)} <span class="sort-indicator">${indicator}</span></th>`;
  }).join('') + `<th class="col-actions-head"></th>`;

  const filters = cols.map(c => {
    if (c.id === '_select' || c.readOnly || c.isCustom) return `<th></th>`;
    const val = gridState.filters[c.id] || '';
    if (c.id === 'status') {
      return `<th>
        <select data-filter="status">
          <option value="">All</option>
          <option value="Applied" ${val === 'Applied' ? 'selected' : ''}>Applied</option>
          <option value="Interviewing" ${val === 'Interviewing' ? 'selected' : ''}>Interviewing</option>
          <option value="Offered/Hired" ${val === 'Offered/Hired' ? 'selected' : ''}>Offered/Hired</option>
          <option value="Rejected" ${val === 'Rejected' ? 'selected' : ''}>Rejected</option>
        </select>
      </th>`;
    }
    return `<th><input type="text" data-filter="${c.id}" value="${escapeHtml(val)}" placeholder="Filter..."></th>`;
  }).join('') + `<th class="col-actions-head"></th>`;

  const rowsHtml = gridState.data.length === 0 
    ? `<tr><td colspan="${cols.length + 1}" style="text-align:center;padding:40px;">No applications found.</td></tr>`
    : gridState.data.map(row => {
      const selected = gridState.selectedIds.has(row.id);
      const stRow = String(row.status || '').toLowerCase();
      const rowStyle = stRow === 'rejected' ? 'opacity: 0.6;' : (stRow.includes('offer') ? 'color: var(--c-primary); font-weight: 500;' : '');
      const tds = cols.map(c => {
        if (c.id === '_select') {
          return `<td>
                    <div class="custom-checkbox-wrap" style="margin: 0 auto;">
                      <input type="checkbox" id="row-sel-${row.id}" class="row-select" data-id="${row.id}" ${selected ? 'checked' : ''} style="display: none;">
                      <label for="row-sel-${row.id}" class="custom-checkbox-box"></label>
                    </div>
                  </td>`;
        }
        
        const val = getCellValue(row, c.id);
        const isEditing = gridState.editing && gridState.editing.id === row.id && gridState.editing.field === c.id;
        
        if (isEditing && c.id !== 'status') {
          return `<td class="editable editing"><input type="text" id="activeEditor" value="${escapeHtml(String(val))}"></td>`;
        }
        
        let displayHtml = escapeHtml(String(val));
        if (c.id === 'status') {
           const st = String(val).toLowerCase();
           let colorClass = 'status-default';
           if (st === 'applied') colorClass = 'status-applied';
           if (st === 'interviewing') colorClass = 'status-interviewing';
           if (st === 'offered/hired' || st === 'offer') colorClass = 'status-offered';
           if (st === 'rejected') colorClass = 'status-rejected';
           
           const currentStatus = String(val);
           displayHtml = `
             <div style="position:relative; display:inline-block;">
               <span class="status-badge ${colorClass}">${displayHtml}</span>
               <select class="status-quick-select" data-id="${row.id}" style="position:absolute; inset:0; opacity:0; width:100%; height:100%; cursor:pointer; -webkit-appearance:none; appearance:none; color:#f4f4f2; background:#191a1c;">
                 <option value="Applied" style="color:#f4f4f2; background:#191a1c;" ${currentStatus === 'Applied' ? 'selected' : ''}>Applied</option>
                 <option value="Interviewing" style="color:#f4f4f2; background:#191a1c;" ${currentStatus === 'Interviewing' ? 'selected' : ''}>Interviewing</option>
                 <option value="Offered/Hired" style="color:#f4f4f2; background:#191a1c;" ${currentStatus === 'Offered/Hired' || currentStatus === 'Offer' ? 'selected' : ''}>Offered/Hired</option>
                 <option value="Rejected" style="color:#f4f4f2; background:#191a1c;" ${currentStatus === 'Rejected' ? 'selected' : ''}>Rejected</option>
               </select>
             </div>
           `;
           return `<td data-id="${row.id}" data-col="${c.id}">${displayHtml}</td>`;
        }
        return `<td class="${c.readOnly ? '' : 'editable'}" tabindex="0" data-id="${row.id}" data-col="${c.id}">${displayHtml}</td>`;
      }).join('');
      // Open button always appended as last sticky td
      const actionTd = `<td class="col-actions-cell"><button class="btn ghost open-app-btn" data-id="${row.id}">Open</button></td>`;
      return `<tr class="${selected ? 'selected' : ''}" style="${rowStyle}">${tds}${actionTd}</tr>`;
    }).join('');

  const toolbarHtml = `
    <div class="grid-toolbar">
      <h2>Applications Tracker</h2>
      <span style="flex:1"></span>
      <button class="btn" id="btnExportCSV">Export CSV</button>
      <button class="btn" id="btnAddColumn">Add Custom Column</button>
      <button class="btn primary" id="btnNewApp">New Application</button>
      ${gridState.selectedIds.size > 0 ? `
        <div class="selected-actions">
          <span>${gridState.selectedIds.size} selected</span>
          <select id="bulkStatusSelect">
            <option value="">Set status...</option>
            <option value="Applied">Applied</option>
            <option value="Interviewing">Interviewing</option>
            <option value="Offered/Hired">Offered/Hired</option>
            <option value="Rejected">Rejected</option>
          </select>
          <button class="btn ghost" id="btnBulkDelete" style="color:red">Delete</button>
        </div>
      ` : ''}
      ${gridState.lastDeleted ? `<button class="btn ghost" id="btnUndo">Undo</button>` : ''}
    </div>
  `;

  shell(`
    <div class="page-title">
      ${toolbarHtml}
    </div>
    <div class="data-grid-container">
      <table class="data-grid" id="mainGrid">
        <thead>
          <tr>${ths}</tr>
          <tr class="filter-row">${filters}</tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  `, { search: false });

  attachGridEvents();
}

function attachGridEvents() {
  // Sort
  document.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', (e) => {
      const col = th.dataset.col;
      if (gridState.sortCol === col) {
        gridState.sortDir = gridState.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        gridState.sortCol = col;
        gridState.sortDir = 'desc';
      }
      renderDataGrid();
    });
  });

  // Filters
  document.querySelectorAll('input[data-filter], select[data-filter]').forEach(inp => {
    inp.addEventListener('change', (e) => {
      gridState.filters[inp.dataset.filter] = e.target.value.trim();
      renderDataGrid();
    });
    if (inp.tagName === 'INPUT') {
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          gridState.filters[inp.dataset.filter] = e.target.value.trim();
          renderDataGrid();
        }
      });
    }
  });

  // Select All
  const selAll = document.getElementById('selectAll');
  if (selAll) {
    selAll.addEventListener('change', (e) => {
      if (e.target.checked) {
        gridState.data.forEach(r => gridState.selectedIds.add(r.id));
      } else {
        gridState.selectedIds.clear();
      }
      drawGrid();
    });
  }

  // Row Select
  document.querySelectorAll('.row-select').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const id = Number(e.target.dataset.id);
      if (e.target.checked) gridState.selectedIds.add(id);
      else gridState.selectedIds.delete(id);
      drawGrid();
    });
  });

  // Open App logic
  document.querySelectorAll('.open-app-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      if (window.navigate) {
        window.navigate('application:' + id);
      }
    });
  });

  // Cell clicks & edit
  document.querySelectorAll('td.editable').forEach(td => {
    td.addEventListener('click', () => {
      if (!td.dataset.id) return;
      startEdit(Number(td.dataset.id), td.dataset.col);
    });
    td.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !gridState.editing) {
        startEdit(Number(td.dataset.id), td.dataset.col);
      }
    });
  });

  // Quick select handling (zero-click edits)
  document.querySelectorAll('.status-quick-select').forEach(sel => {
    sel.addEventListener('change', (e) => {
      gridState.editing = { id: Number(sel.dataset.id), field: 'status' };
      commitEdit(e.target.value);
    });
  });

  // Active Editor handling
  const editor = document.getElementById('activeEditor');
  if (editor) {
    editor.focus();
    if (editor.tagName === 'DIV' && editor.classList.contains('custom-status-editor')) {
      // Legacy custom popup logic fallback
      editor.addEventListener('blur', () => { setTimeout(() => { if (gridState.editing) drawGrid(); }, 150); });
      editor.addEventListener('keydown', (e) => { if (e.key === 'Escape') { gridState.editing = null; drawGrid(); } });
      editor.querySelectorAll('.status-option').forEach(opt => opt.addEventListener('click', () => commitEdit(opt.dataset.value)));
    } else {
      // Standard input/select logic
      if(editor.setSelectionRange && editor.tagName !== 'SELECT') editor.setSelectionRange(0, editor.value.length);
      editor.addEventListener('blur', () => commitEdit(editor.value));
      editor.addEventListener('change', (e) => { if (editor.tagName === 'SELECT') commitEdit(e.target.value); });
      editor.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          editor.blur(); // Triggers blur which commits
        } else if (e.key === 'Escape') {
          gridState.editing = null;
          drawGrid();
        }
      });
    }
  }

  // Grid Keyboard Nav
  const grid = document.getElementById('mainGrid');
  grid.addEventListener('keydown', (e) => {
    if (gridState.editing) return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      const active = document.activeElement;
      if (active && active.tagName === 'TD') {
        e.preventDefault();
        const tr = active.parentElement;
        const tds = Array.from(tr.querySelectorAll('td.editable'));
        const cellIdx = tds.indexOf(active);
        
        if (e.key === 'ArrowRight' && cellIdx < tds.length - 1) tds[cellIdx + 1].focus();
        if (e.key === 'ArrowLeft' && cellIdx > 0) tds[cellIdx - 1].focus();
        
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          const trs = Array.from(grid.querySelectorAll('tbody tr'));
          const rowIdx = trs.indexOf(tr);
          const nextRowIdx = e.key === 'ArrowDown' ? rowIdx + 1 : rowIdx - 1;
          if (nextRowIdx >= 0 && nextRowIdx < trs.length) {
            const nextTds = Array.from(trs[nextRowIdx].querySelectorAll('td.editable'));
            if (nextTds[cellIdx]) nextTds[cellIdx].focus();
          }
        }
      }
    }
  });

  // Buttons
  document.getElementById('btnNewApp')?.addEventListener('click', () => {
    if (window.navigate) window.navigate('new-application');
  });
  document.getElementById('btnExportCSV')?.addEventListener('click', exportCSV);
  document.getElementById('btnAddColumn')?.addEventListener('click', addCustomColumn);
  
  // Bulk Actions
  const bulkStatus = document.getElementById('bulkStatusSelect');
  if (bulkStatus) {
    bulkStatus.addEventListener('change', async (e) => {
      const status = e.target.value;
      if (!status) return;
      try {
        await api.patch('/api/applications/bulk', {
          ids: Array.from(gridState.selectedIds),
          operation: 'status',
          payload: { status }
        });
        showToast('Status updated.');
        gridState.selectedIds.clear();
        await renderDataGrid();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  const btnBulkDelete = document.getElementById('btnBulkDelete');
  if (btnBulkDelete) {
    btnBulkDelete.addEventListener('click', async () => {
      const idsToDelete = Array.from(gridState.selectedIds);
      if (!idsToDelete.length) return;
      btnBulkDelete.disabled = true;
      try {
        // Server-side soft delete: the rows move to trash immediately and stay
        // restorable — no timers, so navigation or a closed tab can never
        // desynchronize the UI from what actually happened on the server.
        await api.patch('/api/applications/bulk', {
          ids: idsToDelete,
          operation: 'delete'
        });
        gridState.lastDeleted = {
          ids: idsToDelete,
          data: gridState.data.filter((r) => idsToDelete.includes(r.id)),
        };
        gridState.data = gridState.data.filter((r) => !idsToDelete.includes(r.id));
        gridState.selectedIds.clear();
        showToast('Applications moved to trash. You can undo.');
      } catch (err) {
        showToast('Delete failed. ' + err.message, 'error');
      }
      drawGrid();
    });
  }

  const btnUndo = document.getElementById('btnUndo');
  if (btnUndo) {
    btnUndo.addEventListener('click', async () => {
      const restoreIds = [...(gridState.lastDeleted?.ids || [])];
      if (!restoreIds.length || !gridState.lastDeleted) return;
      btnUndo.disabled = true;
      try {
        await api.patch('/api/applications/bulk', {
          ids: restoreIds,
          operation: 'restore'
        });
        gridState.data = [...gridState.lastDeleted.data, ...gridState.data];
        gridState.lastDeleted = null;
        showToast('Delete undone.');
      } catch (err) {
        showToast('Restore failed. ' + err.message, 'error');
      }
      drawGrid();
    });
  }
}

function startEdit(id, field) {
  gridState.editing = { id, field };
  drawGrid();
}

async function commitEdit(newVal) {
  if (!gridState.editing) return;
  const { id, field } = gridState.editing;
  gridState.editing = null;
  
  // Optimistic update
  const row = gridState.data.find(r => r.id === id);
  if (!row) { drawGrid(); return; }
  
  const isCustom = field.startsWith('custom_');
  const customKey = isCustom ? field.replace('custom_', '') : null;
  
  const oldVal = isCustom ? (row.custom_fields || {})[customKey] : row[field];
  if (String(oldVal) === String(newVal)) { drawGrid(); return; }
  
  if (isCustom) {
    row.custom_fields = row.custom_fields || {};
    row.custom_fields[customKey] = newVal;
  } else {
    row[field] = newVal;
  }
  drawGrid();
  
  // API Call
  try {
    let payload = {};
    if (isCustom) {
      payload.custom_fields = { [customKey]: newVal };
    } else {
      payload[field] = newVal;
    }
    await api.patch('/api/applications/' + id, payload);
  } catch(err) {
    showToast('Failed to save edit: ' + err.message, 'error');
    // revert
    if (isCustom) {
      row.custom_fields[customKey] = oldVal;
    } else {
      row[field] = oldVal;
    }
    drawGrid();
  }
}

async function addCustomColumn() {
  const colName = prompt("Enter custom column name (e.g. Recruiter Name):");
  if (!colName || !colName.trim()) return;
  
  const name = colName.trim();
  const defs = gridState.prefs.custom_column_defs || [];
  if (defs.includes(name)) {
    showToast('Column already exists.', 'error');
    return;
  }
  
  defs.push(name);
  try {
    await api.put('/api/applications/table-preferences', {
      customColumnDefs: defs
    });
    gridState.prefs.custom_column_defs = defs;
    drawGrid();
  } catch(err) {
    showToast(err.message, 'error');
  }
}

function exportCSV() {
  const cols = getGridColumns().filter(c => c.id !== '_select');
  let csv = cols.map(c => '"' + String(c.label).replace(/"/g, '""') + '"').join(',') + '\n';
  
  gridState.data.forEach(row => {
    csv += cols.map(c => {
      const val = String(getCellValue(row, c.id)).replace(/"/g, '""');
      return '"' + val + '"';
    }).join(',') + '\n';
  });
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'applications_export.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

window.renderDataGrid = renderDataGrid;
