// ========================================
// PRODUKSI MANAGER - Google Apps Script v2
// ========================================
// UPDATE: Paste ulang kode ini di Apps Script lalu Deploy ulang (New Deployment)
// ========================================

var SPREADSHEET_ID = '1sqTt3CHGlx-PdwYE-IdubHoUkLQIXb1gU31QwKnnaN8';
var SHEET_NAME = 'Sheet1'; // Ganti jika nama tab sheet berbeda
var DATA_START_ROW = 5;
var DAILY_CAPACITY = 200;
var CACHE_TTL = 25; // seconds for CacheService

var USERS = {
  'admin':    { password: 'admin',    role: 'admin' },
  'cs':       { password: 'cs',       role: 'cs' },
  'produksi': { password: 'produksi', role: 'produksi' }
};

var COL = {
  NO: 1, CUSTOMER: 2, QTY: 3, PAKET1: 4, PAKET2: 5,
  KETERANGAN: 6, BAHAN: 7, DP_PRODUKSI: 8, DL_CUST: 9, NO_WO: 10,
  PROOFING: 11, WAITINGLIST: 12, PRINT: 13, PRES: 14, CUT_FABRIC: 15,
  JAHIT: 16, QC: 17, FINISHING: 18, PENGIRIMAN: 19,
  TGL_SELESAI: 20, STATUS: 21, TGL_KIRIM: 22
};

var STAGE_COLS = {
  PROOFING: 11, WAITINGLIST: 12, PRINT: 13, PRES: 14,
  CUT_FABRIC: 15, JAHIT: 16, QC_JAHIT_STEAM: 17,
  FINISHING: 18, PENGIRIMAN: 19
};

// ====== ENTRY POINTS ======

function doGet(e) {
  var params = e.parameter || {};
  var body = {};

  // Body sent as JSON string in URL param (POST-via-GET pattern)
  if (params.body) {
    try { body = JSON.parse(decodeURIComponent(params.body)); } catch(err) {
      try { body = JSON.parse(params.body); } catch(err2) {}
    }
  }

  var action = body.action || params.action || '';
  return dispatch(action, body, params);
}

function doPost(e) {
  var params = e.parameter || {};
  var body = {};
  try { body = JSON.parse(e.postData.contents); } catch(err) {}
  var action = body.action || params.action || '';
  return dispatch(action, body, params);
}

function dispatch(action, body, params) {
  var output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  try {
    var result;
    if (action === 'login')          result = doLogin(body);
    else if (action === 'getOrders') result = getOrders();
    else if (action === 'addOrder')  result = addOrder(body);
    else if (action === 'updateOrder')    result = updateOrder(body);
    else if (action === 'updateProgress') result = updateProgress(body);
    else if (action === 'getDashboard')   result = getDashboard();
    else if (action === 'getCapacity')    result = getCapacity();
    else result = { success: false, error: 'Action tidak dikenal: ' + action };
    output.setContent(JSON.stringify(result));
  } catch(err) {
    output.setContent(JSON.stringify({ success: false, error: err.toString() }));
  }
  return output;
}

// ====== AUTH ======

function doLogin(data) {
  var u = USERS[data.username || ''];
  if (!u || u.password !== (data.password || ''))
    return { success: false, error: 'Username atau password salah' };
  return { success: true, data: { username: data.username, role: u.role } };
}

// ====== SHEET ======

function getSheet() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  return ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
}

function fmtDate(val) {
  if (!val && val !== 0) return '';
  var d;
  if (val instanceof Date) {
    d = val;
  } else {
    var s = val.toString();
    // Already DD/MM/YYYY
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) return s;
    // Try parse
    d = new Date(s);
    if (isNaN(d.getTime())) return s;
  }
  var day = d.getDate();
  var mon = d.getMonth() + 1;
  var yr  = d.getFullYear();
  return (day < 10 ? '0' : '') + day + '/' + (mon < 10 ? '0' : '') + mon + '/' + yr;
}

function boolVal(v) {
  return v === true || v === 'TRUE' || v === 'true' || v === 1 || v === '1';
}

// ====== GET ORDERS (with CacheService) ======

function getOrders() {
  // Try cache first
  var cache = CacheService.getScriptCache();
  var cached = cache.get('orders_v2');
  if (cached) {
    try { return JSON.parse(cached); } catch(e) {}
  }

  var result = fetchOrdersFromSheet();

  // Store in cache
  try {
    var str = JSON.stringify(result);
    if (str.length < 100000) { // CacheService limit 100KB per item
      cache.put('orders_v2', str, CACHE_TTL);
    }
  } catch(e) {}

  return result;
}

function fetchOrdersFromSheet() {
  var sheet = getSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < DATA_START_ROW) return { success: true, data: [] };

  var numRows = lastRow - DATA_START_ROW + 1;
  var data = sheet.getRange(DATA_START_ROW, 1, numRows, COL.TGL_KIRIM).getValues();

  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var orders = [];

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    if (!row[COL.CUSTOMER - 1]) continue;

    var prog = {
      PROOFING:       boolVal(row[COL.PROOFING - 1]),
      WAITINGLIST:    boolVal(row[COL.WAITINGLIST - 1]),
      PRINT:          boolVal(row[COL.PRINT - 1]),
      PRES:           boolVal(row[COL.PRES - 1]),
      CUT_FABRIC:     boolVal(row[COL.CUT_FABRIC - 1]),
      JAHIT:          boolVal(row[COL.JAHIT - 1]),
      QC_JAHIT_STEAM: boolVal(row[COL.QC - 1]),
      FINISHING:      boolVal(row[COL.FINISHING - 1]),
      PENGIRIMAN:     boolVal(row[COL.PENGIRIMAN - 1])
    };

    var status = (row[COL.STATUS - 1] || '').toString();
    if (!status) {
      if (prog.PENGIRIMAN) status = 'DONE';
      else if (prog.PROOFING || prog.WAITINGLIST || prog.PRINT || prog.PRES ||
               prog.CUT_FABRIC || prog.JAHIT || prog.QC_JAHIT_STEAM || prog.FINISHING) {
        status = 'IN_PROGRESS';
      } else { status = 'OPEN'; }
    }

    var tglSelesai = fmtDate(row[COL.TGL_SELESAI - 1]);
    var dlCust     = fmtDate(row[COL.DL_CUST - 1]);
    var daysLeft = null;
    var riskLevel = 'NORMAL';
    var dlStr = tglSelesai || dlCust;

    if (dlStr) {
      var parts = dlStr.split('/');
      if (parts.length === 3) {
        var dl = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        daysLeft = Math.floor((dl.getTime() - today.getTime()) / 86400000);
        if (status === 'DONE') riskLevel = 'SAFE';
        else if (daysLeft < 0) riskLevel = 'OVERDUE';
        else if (daysLeft <= 3) {
          riskLevel = (lastStageIdx(prog) <= 5) ? 'HIGH' : 'NEAR';
        }
      }
    }

    orders.push({
      rowIndex: DATA_START_ROW + i,
      no: row[COL.NO - 1] || (i + 1),
      customer: (row[COL.CUSTOMER - 1] || '').toString(),
      qty: parseInt(row[COL.QTY - 1]) || 0,
      paket1: (row[COL.PAKET1 - 1] || '').toString(),
      paket2: (row[COL.PAKET2 - 1] || '').toString(),
      keterangan: (row[COL.KETERANGAN - 1] || '').toString(),
      bahan: (row[COL.BAHAN - 1] || '').toString(),
      dpProduksi: fmtDate(row[COL.DP_PRODUKSI - 1]),
      dlCust: dlCust,
      noWorkOrder: (row[COL.NO_WO - 1] || '').toString(),
      tglSelesai: tglSelesai,
      status: status,
      progress: prog,
      tglKirim: fmtDate(row[COL.TGL_KIRIM - 1]),
      daysLeft: daysLeft,
      riskLevel: riskLevel
    });
  }

  return { success: true, data: orders };
}

function lastStageIdx(prog) {
  var keys = ['PROOFING','WAITINGLIST','PRINT','PRES','CUT_FABRIC','JAHIT','QC_JAHIT_STEAM','FINISHING','PENGIRIMAN'];
  var last = -1;
  for (var i = 0; i < keys.length; i++) { if (prog[keys[i]]) last = i; }
  return last;
}

// ====== ADD ORDER ======

function addOrder(data) {
  var sheet = getSheet();
  var lastRow = sheet.getLastRow();
  var newRow = Math.max(lastRow + 1, DATA_START_ROW);
  var no = newRow - DATA_START_ROW + 1;
  var qty = parseInt(data.qty) || 0;
  var tglSelesai = calcTglSelesai(qty, sheet);
  var noWO = makeWO(no);

  var rowData = [
    no,
    data.customer || '',
    qty,
    data.paket1 || '',
    data.paket2 || '',
    data.keterangan || '',
    data.bahan || '',
    data.dpProduksi || '',
    data.dlCust || '',
    noWO,
    false, false, false, false, false, false, false, false, false, // K–S
    tglSelesai, 'OPEN', ''
  ];

  sheet.getRange(newRow, 1, 1, rowData.length).setValues([rowData]);

  // Set checkbox validation on stage columns
  try {
    var rule = SpreadsheetApp.newDataValidation().requireCheckbox().build();
    sheet.getRange(newRow, COL.PROOFING, 1, 9).setDataValidation(rule);
  } catch(e) {}

  SpreadsheetApp.flush();

  // Invalidate cache
  try { CacheService.getScriptCache().remove('orders_v2'); } catch(e) {}

  return { success: true, data: { rowIndex: newRow, no: no, noWorkOrder: noWO, tglSelesai: tglSelesai } };
}

function calcTglSelesai(qty, sheet) {
  var lastRow = sheet.getLastRow();
  var dailyUsage = {};

  if (lastRow >= DATA_START_ROW) {
    var n = lastRow - DATA_START_ROW + 1;
    var qtyVals = sheet.getRange(DATA_START_ROW, COL.QTY, n, 1).getValues();
    var dpVals  = sheet.getRange(DATA_START_ROW, COL.DP_PRODUKSI, n, 1).getValues();
    var stVals  = sheet.getRange(DATA_START_ROW, COL.STATUS, n, 1).getValues();
    for (var i = 0; i < n; i++) {
      if (dpVals[i][0] && stVals[i][0] !== 'DONE') {
        var k = fmtDate(dpVals[i][0]);
        if (k) dailyUsage[k] = (dailyUsage[k] || 0) + (parseInt(qtyVals[i][0]) || 0);
      }
    }
  }

  var rem = qty;
  var cur = new Date();
  cur.setHours(0, 0, 0, 0);
  var lastAlloc = null;

  for (var day = 0; day < 365 && rem > 0; day++) {
    var key = fmtDate(cur);
    var used = dailyUsage[key] || 0;
    var avail = DAILY_CAPACITY - used;
    if (avail > 0) {
      rem -= Math.min(rem, avail);
      lastAlloc = new Date(cur.getTime());
    }
    cur.setDate(cur.getDate() + 1);
  }

  if (!lastAlloc) return '';
  lastAlloc.setDate(lastAlloc.getDate() + 14);
  return fmtDate(lastAlloc);
}

function makeWO(no) {
  var d = new Date();
  var y = d.getFullYear().toString().slice(-2);
  var m = d.getMonth() + 1;
  var mStr = m < 10 ? '0' + m : '' + m;
  var nStr = no < 10 ? '00' + no : no < 100 ? '0' + no : '' + no;
  return 'WO' + y + mStr + '-' + nStr;
}

// ====== UPDATE ORDER ======

function updateOrder(data) {
  if (!data.rowIndex) return { success: false, error: 'rowIndex diperlukan' };
  var sheet = getSheet();
  var ri = parseInt(data.rowIndex);
  var map = {
    customer: COL.CUSTOMER, qty: COL.QTY, paket1: COL.PAKET1, paket2: COL.PAKET2,
    keterangan: COL.KETERANGAN, bahan: COL.BAHAN, dpProduksi: COL.DP_PRODUKSI, dlCust: COL.DL_CUST
  };
  for (var key in map) {
    if (data[key] !== undefined && data[key] !== null) {
      sheet.getRange(ri, map[key]).setValue(data[key]);
    }
  }
  SpreadsheetApp.flush();
  try { CacheService.getScriptCache().remove('orders_v2'); } catch(e) {}
  return { success: true };
}

// ====== UPDATE PROGRESS (checkbox) ======

function updateProgress(data) {
  var ri = parseInt(data.rowIndex);
  var stage = data.stage;

  if (!ri || !stage) return { success: false, error: 'rowIndex dan stage diperlukan' };

  var col = STAGE_COLS[stage];
  if (!col) return { success: false, error: 'Stage tidak valid: ' + stage };

  var checked = boolVal(data.checked);
  var sheet = getSheet();

  // Write checkbox value
  sheet.getRange(ri, col).setValue(checked);

  if (stage === 'PENGIRIMAN' && checked) {
    sheet.getRange(ri, COL.STATUS).setValue('DONE');
    if (data.tglKirim) sheet.getRange(ri, COL.TGL_KIRIM).setValue(data.tglKirim);
  } else if (checked) {
    var curStatus = sheet.getRange(ri, COL.STATUS).getValue().toString();
    if (curStatus === 'OPEN' || curStatus === '') {
      sheet.getRange(ri, COL.STATUS).setValue('IN_PROGRESS');
    }
  }

  // Force commit
  SpreadsheetApp.flush();

  // Invalidate cache
  try { CacheService.getScriptCache().remove('orders_v2'); } catch(e) {}

  return { success: true };
}

// ====== DASHBOARD ======

function getDashboard() {
  var res = getOrders();
  if (!res.success) return res;
  var orders = res.data;

  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var todayKey = fmtDate(today);

  var stats = {
    totalOrders: orders.length,
    openOrders: 0, inProgressOrders: 0, doneOrders: 0,
    nearDeadlineCount: 0, overdueCount: 0, highRiskCount: 0,
    todayCapacity: DAILY_CAPACITY, dailyCapacityUsed: 0,
    stageCounts: {}
  };

  var stageKeys = ['PROOFING','WAITINGLIST','PRINT','PRES','CUT_FABRIC','JAHIT','QC_JAHIT_STEAM','FINISHING','PENGIRIMAN'];

  for (var i = 0; i < orders.length; i++) {
    var o = orders[i];
    if (o.status === 'OPEN') stats.openOrders++;
    else if (o.status === 'IN_PROGRESS') stats.inProgressOrders++;
    else if (o.status === 'DONE') stats.doneOrders++;

    if (o.riskLevel === 'NEAR' || o.riskLevel === 'HIGH') stats.nearDeadlineCount++;
    if (o.riskLevel === 'OVERDUE') stats.overdueCount++;
    if (o.riskLevel === 'HIGH') stats.highRiskCount++;

    if (o.dpProduksi === todayKey && o.status !== 'DONE') {
      stats.dailyCapacityUsed += parseInt(o.qty) || 0;
    }

    if (o.status !== 'DONE') {
      var idx = lastStageIdx(o.progress);
      var sk = idx >= 0 ? stageKeys[idx] : 'OPEN';
      stats.stageCounts[sk] = (stats.stageCounts[sk] || 0) + 1;
    }
  }

  return { success: true, data: stats };
}

// ====== CAPACITY ======

function getCapacity() {
  var sheet = getSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < DATA_START_ROW) return { success: true, data: {} };

  var n = lastRow - DATA_START_ROW + 1;
  var qtyVals = sheet.getRange(DATA_START_ROW, COL.QTY, n, 1).getValues();
  var dpVals  = sheet.getRange(DATA_START_ROW, COL.DP_PRODUKSI, n, 1).getValues();
  var stVals  = sheet.getRange(DATA_START_ROW, COL.STATUS, n, 1).getValues();

  var daily = {};
  for (var i = 0; i < n; i++) {
    if (dpVals[i][0] && stVals[i][0] !== 'DONE') {
      var k = fmtDate(dpVals[i][0]);
      if (k) daily[k] = (daily[k] || 0) + (parseInt(qtyVals[i][0]) || 0);
    }
  }
  return { success: true, data: daily };
}
