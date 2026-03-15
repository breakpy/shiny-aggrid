// ag-Grid initialization and event handling for Shiny
(function(){
  var grid2Api = null;

  // â”€â”€ Custom Date Cell Editor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function DateInputCellEditor() {}
  DateInputCellEditor.prototype.init = function(params){
    this.params = params;
    this.eInput = document.createElement('input');
    this.eInput.setAttribute('type', 'date');
    this.eInput.className = 'ag-input-field-input ag-text-field-input';
    var value = params && params.value ? String(params.value).slice(0, 10) : '';
    this.eInput.value = value;
    var ep = (params && params.cellEditorParams) || {};
    if (ep.min) this.eInput.min = ep.min;
    if (ep.max) this.eInput.max = ep.max;
    // Space/Enter opens the calendar picker without triggering AG Grid's row-commit handler
    var inp = this.eInput;
    inp.addEventListener('keydown', function(ev){
      if (ev.key === ' ' || ev.key === 'Enter'){
        ev.preventDefault();
        ev.stopPropagation();
        try { inp.showPicker(); } catch(e){}
      }
    });
  };
  DateInputCellEditor.prototype.getGui        = function(){ return this.eInput; };
  // Only grab focus when THIS cell triggered editing (cellStartedEdit), not all sibling cells in full-row mode
  DateInputCellEditor.prototype.afterGuiAttached = function(){
    if (this.params && this.params.cellStartedEdit) { this.eInput && this.eInput.focus(); }
  };
  DateInputCellEditor.prototype.getValue      = function(){
    return this.eInput && this.eInput.value ? normalizeDateText(this.eInput.value.slice(0, 10)) : '';
  };
  DateInputCellEditor.prototype.isPopup       = function(){ return false; };

  // Notes modal — opens a proper dialog for editing the long-text Notes field
  function openNotesModal(api, rowNode, rowIndex, flashRowFn, containerId){
    var dialog = document.getElementById('ag-notes-dialog');
    if (!dialog){
      dialog = document.createElement('dialog');
      dialog.id = 'ag-notes-dialog';
      dialog.style.cssText = 'padding:0;border:none;border-radius:10px;'
        + 'box-shadow:0 8px 32px rgba(0,0,0,.28);min-width:480px;max-width:90vw;';
      dialog.innerHTML =
        '<div style="padding:14px 20px;background:#f5f5f5;border-bottom:1px solid #ddd;'
        + 'font-weight:600;font-size:14px;">Edit Notes</div>'
        + '<div style="padding:16px 20px;">'
        + '<textarea id="ag-notes-ta" style="width:100%;height:160px;resize:vertical;'
        + 'border:1px solid #ccc;border-radius:4px;padding:8px;font-family:inherit;'
        + 'font-size:13px;box-sizing:border-box;outline:none;"></textarea>'
        + '</div>'
        + '<div style="padding:6px 20px 16px;display:flex;gap:8px;justify-content:flex-end;">'
        + '<button id="ag-notes-cancel" style="padding:6px 18px;border:1px solid #ccc;'
        + 'border-radius:4px;background:#fff;cursor:pointer;">Cancel</button>'
        + '<button id="ag-notes-save" style="padding:6px 18px;border:none;border-radius:4px;'
        + 'background:#388e3c;color:#fff;font-weight:600;cursor:pointer;">Save</button>'
        + '</div>';
      document.body.appendChild(dialog);
    }
    var ta      = document.getElementById('ag-notes-ta');
    var saveEl  = document.getElementById('ag-notes-save');
    var cancelEl= document.getElementById('ag-notes-cancel');
    ta.value = rowNode.data.notes || '';
    // Replace buttons each time to shed old listeners
    var newSave   = saveEl.cloneNode(true);
    var newCancel = cancelEl.cloneNode(true);
    saveEl.parentNode.replaceChild(newSave, saveEl);
    cancelEl.parentNode.replaceChild(newCancel, cancelEl);
    newCancel.addEventListener('click', function(){ dialog.close(); });
    newSave.addEventListener('click', function(){
      var val = ta.value;
      var old = rowNode.data.notes || '';
      dialog.close();
      if (val === old) return;
      rowNode.data.notes = val;
      rowNode.setDataValue('notes', val);
      var errors = validateRow(rowNode.data);
      if (errors){
        cellErrors[rowNode.data.id] = errors;
        api.refreshCells({ rowNodes: [rowNode], force: true });
        showToast(Object.keys(errors).map(function(k){ return errors[k]; }).join(' \u00b7 '), 'error');
        flashRowFn(rowIndex, 'error');
        return;
      }
      delete cellErrors[rowNode.data.id];
      api.refreshCells({ rowNodes: [rowNode], force: true });
      flashRowFn(rowIndex, 'success');
      if (window.Shiny){
        Shiny.setInputValue('aggrid_updates', { grid: containerId, row: rowNode.data }, { priority: 'event' });
      }
    });
    dialog.showModal();
    ta.focus();
  }

  // â”€â”€ Utilities â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function normalizeDateText(v){
    return v == null ? '' : String(v).trim().replace(/\s+/g, '');
  }

  function parseIsoDate(v){
    var text = normalizeDateText(v);
    if (!text) return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3];
    var dt = new Date(y, mo - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
    dt.setHours(0,0,0,0);
    return dt;
  }

  function todayIso(){
    var d = new Date();
    return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
  }

  // â”€â”€ Validators â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function getDateIssue(v){
    var s = normalizeDateText(v);
    if (!s) return null;
    var parsed = parseIsoDate(s);
    if (!parsed) return 'Invalid date â€” use YYYY-MM-DD';
    var today = new Date(); today.setHours(0,0,0,0);
    if (parsed < today) return 'Date must be today or in the future';
    return null;
  }

  function getAmountIssue(v){
    if (v == null || String(v).trim() === '') return null;
    var n = Number(v);
    if (isNaN(n))  return 'Amount must be numeric';
    if (n < 0)     return 'Amount must be â‰¥ 0';
    if (n > 90)    return 'Amount must be â‰¤ 90';
    return null;
  }

  // Returns {field: message, ...} for every invalid field, or null if all ok
  function validateRow(row){
    var errs = {};
    if (!row.short_text || !String(row.short_text).trim()) errs.short_text = 'Short text is required';
    var a = getAmountIssue(row.amount);  if (a) errs.amount = a;
    var d = getDateIssue(row.date);      if (d) errs.date   = d;
    return Object.keys(errs).length ? errs : null;
  }

  // â”€â”€ Toast â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function showToast(msg, type){
    var old = document.getElementById('ag-val-toast');
    if (old) old.remove();
    var el = document.createElement('div');
    el.id = 'ag-val-toast';
    el.style.cssText = 'position:fixed;top:18px;right:22px;z-index:99999;'
      + 'padding:10px 18px;border-radius:8px;font-size:13px;'
      + 'box-shadow:0 3px 12px rgba(0,0,0,.18);max-width:380px;pointer-events:none;'
      + (type === 'error'
          ? 'background:#fde8e8;color:#8b1a1a;border:1px solid #d14343;'
          : 'background:#e8f5e9;color:#1b5e20;border:1px solid #388e3c;');
    el.textContent = msg;
    document.body.appendChild(el);
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function(){ if (el.parentNode) el.remove(); }, 4500);
  }

  // â”€â”€ Per-cell error state (keyed by row id) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  var cellErrors = {};

  // â”€â”€ Column definitions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function mkColDefs(){
    function errClass(field){
      return { 'cell-error': function(p){ return !!(p.data && cellErrors[p.data.id] && cellErrors[p.data.id][field]); } };
    }
    function errTip(field){
      return function(p){ return p.data && cellErrors[p.data.id] && cellErrors[p.data.id][field] || null; };
    }
    return [
      { headerName: 'ID',         field: 'id',         width: 70,  editable: false },
      { headerName: 'Category',   field: 'category',   width: 120, editable: true,
        cellEditor: 'agSelectCellEditor', cellEditorParams: {values: ['A','B','C']} },
      { headerName: 'Short text', field: 'short_text', flex: 1,    editable: true,
        cellEditor: 'agTextCellEditor',
        cellClassRules: errClass('short_text'), tooltipValueGetter: errTip('short_text') },
      { headerName: 'Amount',     field: 'amount',     width: 120, editable: true,
        cellEditor: 'agTextCellEditor',
        cellClassRules: errClass('amount'),     tooltipValueGetter: errTip('amount'),
        valueSetter:  function(p){ p.data.amount = (p.newValue === '' || p.newValue == null) ? '' : Number(p.newValue); return true; } },
      { headerName: 'Date',       field: 'date',       width: 150, editable: true,
        cellEditor: 'dateInputCellEditor', cellEditorParams: {min: todayIso(), max: '2100-12-31'},
        cellClassRules: errClass('date'),       tooltipValueGetter: errTip('date'),
        valueSetter:  function(p){ p.data.date = normalizeDateText(p.newValue); return true; } },
      // Notes: not part of full-row edit — double-click opens a modal dialog instead
      { headerName: 'Notes', field: 'notes', flex: 2, editable: false,
        cellStyle: { cursor: 'pointer', color: '#555' },
        tooltipValueGetter: function(p){ return p.value ? p.value : '(double-click to add notes)'; } }
    ];
  }

  // â”€â”€ Grid creation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function createGrid(containerId, data){
    var gridDiv = document.getElementById(containerId);
    if (!gridDiv) return null;

    var rowSnapshot = null; // JSON snapshot at row-edit-start for change detection

    function rowKey(d){
      return JSON.stringify({ category: d.category, short_text: d.short_text,
                              amount: d.amount, date: d.date, notes: d.notes });
    }

    function flashRow(rowIndex, type){
      var el = gridDiv.querySelector('[row-index="' + rowIndex + '"]');
      if (!el) return;
      el.classList.remove('row-flash-success', 'row-flash-error');
      void el.offsetWidth; // force reflow so animation restarts cleanly
      el.classList.add(type === 'success' ? 'row-flash-success' : 'row-flash-error');
      setTimeout(function(){ el.classList.remove('row-flash-success','row-flash-error'); }, 2200);
    }

    var gridOptions = {
      columnDefs: mkColDefs(),
      components: { dateInputCellEditor: DateInputCellEditor },
      editType: 'fullRow',
      enableBrowserTooltips: true,
      defaultColDef: { sortable: true, filter: true, resizable: true },
      animateRows: true,
      rowData: data || [],

      // â”€â”€ Editing UX â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      suppressClickEdit: true,           // ONLY double-click starts editing
      stopEditingWhenCellsLoseFocus: false,
      enterNavigatesVerticallyAfterEdit: false,

      // Double-click on a cell: Notes → modal dialog; other cells → start full-row edit
      onCellDoubleClicked: function(e){
        if (!e.api) return;
        if (e.column && e.column.getColId() === 'notes'){
          openNotesModal(e.api, e.node, e.rowIndex, flashRow, containerId);
          return;
        }
        var colDef = e.colDef || {};
        var colKey = (colDef.editable !== false) ? e.column.getColId() : 'category';
        e.api.startEditingCell({ rowIndex: e.rowIndex, colKey: colKey });
      },

      // Snapshot values when row edit begins
      onRowEditingStarted: function(e){
        rowSnapshot = e && e.data ? rowKey(e.data) : null;
      },

      // Validate + save when row editing ends
      onRowEditingStopped: function(e){
        if (!e || !e.data) return;

        var currentKey = rowKey(e.data);
        var changed = rowSnapshot !== null && rowSnapshot !== currentKey;
        rowSnapshot = null;

        // always clear prior per-cell errors for this row
        if (cellErrors[e.data.id]){
          delete cellErrors[e.data.id];
          if (e.api) e.api.refreshCells({ rowNodes: [e.node], force: true });
        }

        if (!changed) return; // no changes â€” skip save entirely

        var errors = validateRow(e.data);
        if (errors){
          cellErrors[e.data.id] = errors;
          if (e.api) e.api.refreshCells({ rowNodes: [e.node], force: true });
          var msgs = Object.keys(errors).map(function(k){ return errors[k]; });
          showToast(msgs.join(' \u00b7 '), 'error');
          flashRow(e.rowIndex, 'error');
          return;
        }

        // Normalise types
        if (e.data.amount !== '' && e.data.amount != null) e.data.amount = Number(e.data.amount);
        e.data.date = normalizeDateText(e.data.date || '');

        flashRow(e.rowIndex, 'success');
        if (window.Shiny){
          Shiny.setInputValue('aggrid_updates', { grid: containerId, row: e.data }, { priority: 'event' });
        }
      },

      // Keyboard actions: Enter/Space on Notes → open modal; Enter elsewhere → commit row
      onCellKeyDown: function(e){
        if (!e || !e.event) return;
        var key = e.event.key;
        var onNotes = e.column && e.column.getColId() === 'notes';
        if (onNotes && (key === 'Enter' || key === ' ')){
          e.event.preventDefault();
          e.event.stopPropagation();
          openNotesModal(e.api, e.node, e.rowIndex, flashRow, containerId);
          return;
        }
        if (key === 'Enter' && !onNotes){
          e.event.preventDefault();
          if (e.api) e.api.stopEditing(false); // false = commit
        }
      }
    };

    if (containerId === 'grid2' && grid2Api){ grid2Api.destroy(); grid2Api = null; }

    function getGridCtor(){
      if (typeof agGrid === 'undefined') return null;
      if (typeof agGrid.Grid === 'function') return agGrid.Grid;
      if (agGrid.grid && typeof agGrid.grid.Grid === 'function') return agGrid.grid.Grid;
      if (agGrid.community && typeof agGrid.community.Grid === 'function') return agGrid.community.Grid;
      return null;
    }

    var useCreateGrid = agGrid && typeof agGrid.createGrid === 'function';
    var GridCtor = getGridCtor();
    if (!GridCtor && !useCreateGrid){
      gridDiv.innerHTML = '<div style="padding:16px;color:#900;">ag-Grid failed to load â€” see README for local file setup.</div>';
      return null;
    }

    var created;
    try {
      created = useCreateGrid ? agGrid.createGrid(gridDiv, gridOptions) : new GridCtor(gridDiv, gridOptions);
    } catch(err){
      console.error('ag-Grid init error', err);
      gridDiv.innerHTML = '<div style="padding:16px;color:#900;">ag-Grid initialization error â€” see console.</div>';
      return null;
    }

    var api = (created && created.api) || (gridDiv.__agGridInstance && gridDiv.__agGridInstance.api) || (gridOptions && gridOptions.api);
    if (containerId === 'grid2') grid2Api = api;
    return api;
  }

  // â”€â”€ Shiny message handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (window.Shiny){
    Shiny.addCustomMessageHandler('initGrids', function(message){
      var d2 = message.grid2 || [];
      if (!Array.isArray(d2) && d2.data) d2 = d2.data;
      createGrid('grid2', d2);
    });
  }

})();
