// ═══════════════════════════════════════════════════════════════════════════
// JOSS CONSULTING GROUP — Code.gs (FINAL VERSION)
// ═══════════════════════════════════════════════════════════════════════════

// ── ADMIN EMAILS — always have access no matter what ─────────────────────────
// YOUR EMAIL IS ALREADY ADDED BELOW — you always get in
var ADMIN_EMAILS = [
  'jossconsultinggroup@gmail.com'   // ← your email — NEVER remove this line
];

// ── REGISTRATION SETTING ─────────────────────────────────────────────────────
// true  = only registered employees can log in
// false = anyone with the URL can log in
var REQUIRE_REGISTRATION = true;

// ─────────────────────────────────────────────────────────────────────────────

function getCurrentUser() {
  try {
    var email = Session.getActiveUser().getEmail();
    return email || 'unknown@user.com';
  } catch(e) {
    return 'unknown@user.com';
  }
}

function isAdmin(email) {
  for (var i = 0; i < ADMIN_EMAILS.length; i++) {
    if (ADMIN_EMAILS[i].toLowerCase() === email.toLowerCase()) return true;
  }
  return false;
}

function isAllowed(email) {
  // Admins always get in — no registration check
  if (isAdmin(email)) return true;
  // If registration not required — let everyone in
  if (!REQUIRE_REGISTRATION) return true;
  // Check Employees sheet
  var employees = getEmployeesFromSheet();
  if (employees.length === 0) return true;
  for (var i = 0; i < employees.length; i++) {
    if (employees[i].email === email.toLowerCase() &&
        employees[i].status.toLowerCase() === 'active') return true;
  }
  return false;
}

// ── UPDATE LAST LOGIN / CLOCK IN TIME IN EMPLOYEES SHEET ─────────────────────
function updateEmployeeActivity(email, column, value) {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Employees');
    if (!sheet || sheet.getLastRow() < 2) return;
    var emails  = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var colIdx  = headers.indexOf(column) + 1;
    if (colIdx < 1) return;
    for (var i = 0; i < emails.length; i++) {
      if (String(emails[i][0]).trim().toLowerCase() === email.toLowerCase()) {
        sheet.getRange(i + 2, colIdx).setValue(value);
        SpreadsheetApp.flush();
        return;
      }
    }
  } catch(e) {}
}

// ── GET EMPLOYEES FROM SHEET ─────────────────────────────────────────────────
function getEmployeesFromSheet() {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Employees');
    if (!sheet || sheet.getLastRow() < 2) return [];
    var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    var out  = [];
    for (var i = 0; i < data.length; i++) {
      if (data[i][0]) {
        out.push({
          email:   String(data[i][0]).trim().toLowerCase(),
          empId:   String(data[i][1] || '').trim(),
          name:    String(data[i][2] || '').trim(),
          role:    String(data[i][3] || 'Employee').trim(),
          status:  String(data[i][4] || 'Active').trim(),
          added:   String(data[i][5] || '').trim(),
          lastLogin: String(data[i][6] || '').trim(),
          lastClockIn: String(data[i][7] || '').trim()
        });
      }
    }
    return out;
  } catch(e) { return []; }
}

function getAllEmployees() {
  return getEmployeesFromSheet();
}

// ── REGISTER OR UPDATE EMPLOYEE ───────────────────────────────────────────────
function registerEmployee(emailIn, empId, name) {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Employees');
    if (!sheet) {
      sheet = ss.insertSheet('Employees');
      sheet.appendRow(['Email','Employee ID','Name','Role','Status','Date Registered','Last Login','Last Clock In']);
      styleHeader_(sheet, 8);
    }
    var email   = emailIn.trim().toLowerCase();
    var now     = new Date().toLocaleString('en-US');
    var lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      var emails = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var i = 0; i < emails.length; i++) {
        if (String(emails[i][0]).trim().toLowerCase() === email) {
          sheet.getRange(i + 2, 7).setValue(now);
          return { status: 'UPDATED', empId: sheet.getRange(i + 2, 2).getValue() };
        }
      }
    }
    var role = isAdmin(email) ? 'Owner' : 'Employee';
    sheet.appendRow([email, empId, name || '', role, 'Active', now, now, '']);
    SpreadsheetApp.flush();
    return { status: 'REGISTERED', empId: empId };
  } catch(e) {
    return { status: 'ERROR', message: e.message };
  }
}

// ── LOGIN HANDLER ─────────────────────────────────────────────────────────────
function loginEmployee(emailIn, empIdIn) {
  try {
    var email = emailIn.trim().toLowerCase();
    var empId = empIdIn ? empIdIn.trim().toUpperCase() : generateId(email);
    if (!isAllowed(email)) {
      return { success: false, message: 'This email is not registered. Ask your administrator to add you.' };
    }
    registerEmployee(email, empId, '');
    return { success: true, email: email, empId: empId };
  } catch(e) {
    return { success: false, message: 'Login error: ' + e.message };
  }
}

// ── PERSISTENT STATE ─────────────────────────────────────────────────────────
function getStateKey(email) {
  return 'joss_state_' + email.replace(/[^a-z0-9]/gi, '_');
}

function saveState(data) {
  try {
    var email = getCurrentUser();
    PropertiesService.getUserProperties().setProperty(getStateKey(email), JSON.stringify(data));
    return 'STATE_SAVED';
  } catch(e) { return 'ERROR: ' + e.message; }
}

function getState() {
  var email = getCurrentUser();
  if (!isAllowed(email)) return { error: 'NOT_AUTHORISED', email: email };
  try {
    var raw = PropertiesService.getUserProperties().getProperty(getStateKey(email));
    return { state: raw ? JSON.parse(raw) : null, email: email };
  } catch(e) { return { state: null, email: email }; }
}

// ── CLOCK IN ─────────────────────────────────────────────────────────────────
function clockIn() {
  var email = getCurrentUser();
  if (!isAllowed(email)) return 'NOT_AUTHORISED';
  var now   = new Date();
  var empId = generateId(email);
  var timeStr = now.toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'});

  // Update Last Clock In in Employees sheet
  updateEmployeeActivity(email, 'Last Clock In', now.toLocaleString('en-US'));
  updateEmployeeActivity(email, 'Last Login',    now.toLocaleString('en-US'));

  return appendToSheet_('Daily Tracker', {
    'Timestamp':      now.toLocaleString('en-US'),
    'Employee ID':    empId,
    'Employee Email': email,
    'Business':       'JOSS Consulting Group',
    'Date':           now.toLocaleDateString('en-US'),
    'Clock In':       timeStr,
    'Clock Out':      '',
    'Hours Worked':   ''
  });
}

// ── CLOCK OUT ────────────────────────────────────────────────────────────────
function clockOut(clockInTime) {
  var email = getCurrentUser();
  if (!isAllowed(email)) return 'NOT_AUTHORISED';
  var ss      = SpreadsheetApp.getActiveSpreadsheet();
  var sheet   = ss.getSheetByName('Daily Tracker');
  if (!sheet) return 'SHEET_NOT_FOUND';
  var now     = new Date();
  var lastRow = sheet.getLastRow();
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var emailCol    = headers.indexOf('Employee Email') + 1;
  var clockOutCol = headers.indexOf('Clock Out') + 1;
  var hoursCol    = headers.indexOf('Hours Worked') + 1;
  var clockInCol  = headers.indexOf('Clock In') + 1;
  var dateCol     = headers.indexOf('Date') + 1;
  var today       = now.toLocaleDateString('en-US');
  for (var r = lastRow; r >= 2; r--) {
    var rowEmail   = emailCol   > 0 ? sheet.getRange(r, emailCol).getValue()   : '';
    var rowDate    = dateCol    > 0 ? sheet.getRange(r, dateCol).getValue()    : '';
    var rowClockOut= clockOutCol> 0 ? sheet.getRange(r, clockOutCol).getValue(): '';
    if (rowEmail === email && String(rowDate) === today && rowClockOut === '') {
      var outTime = now.toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'});
      if (clockOutCol > 0) sheet.getRange(r, clockOutCol).setValue(outTime);
      if (hoursCol > 0 && clockInCol > 0) {
        var inStr = sheet.getRange(r, clockInCol).getValue();
        try {
          var diff = new Date(today + ' ' + outTime) - new Date(today + ' ' + inStr);
          var h = Math.floor(diff/3600000);
          var m = Math.floor((diff%3600000)/60000);
          sheet.getRange(r, hoursCol).setValue(h + 'h ' + m + 'm');
        } catch(e) {}
      }
      SpreadsheetApp.flush();
      return 'CLOCKED_OUT';
    }
  }
  return 'NO_OPEN_CLOCKIN_FOUND';
}

// ── SAVE TO SHEET ─────────────────────────────────────────────────────────────
function saveToSheet(data) {
  try {
    var email = getCurrentUser();
    if (!isAllowed(email)) return 'NOT_AUTHORISED';
    var sheetName = data.sheet;
    delete data.sheet;
    if (!sheetName) return 'ERROR: Missing sheet name';
    if (!data['Employee Email']) data['Employee Email'] = email;
    if (!data['Employee ID'])    data['Employee ID']    = generateId(email);
    return appendToSheet_(sheetName, data);
  } catch(e) { return 'ERROR: ' + e.message; }
}

// ── GENERATE EMPLOYEE ID FROM EMAIL ──────────────────────────────────────────
function generateId(email) {
  var hash = 0;
  for (var i = 0; i < email.length; i++) {
    hash = ((hash << 5) - hash) + email.charCodeAt(i);
    hash = hash & hash;
  }
  return 'EMP' + Math.abs(hash).toString(36).toUpperCase().slice(0, 6);
}

// ── APPEND ROW ───────────────────────────────────────────────────────────────
function appendToSheet_(sheetName, data) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);
  var keys = Object.keys(data);
  if (keys.length === 0) return 'NO DATA';
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(keys);
    styleHeader_(sheet, keys.length);
  }
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  keys.forEach(function(key) {
    if (headers.indexOf(key) === -1) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(key);
      headers.push(key);
    }
  });
  sheet.appendRow(headers.map(function(h){ return data[h] !== undefined ? data[h] : ''; }));
  SpreadsheetApp.flush();
  return 'SAVED TO ' + sheetName;
}

// ── SETUP ALL SHEETS ─────────────────────────────────────────────────────────
function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  createSheet_(ss, 'Employees', [
    'Email','Employee ID','Name','Role','Status','Date Registered','Last Login','Last Clock In'
  ]);

  createSheet_(ss, 'Call-Outs', [
    'Timestamp','Employee Email','Employee ID','Date','Reason','Notes'
  ]);

  createSheet_(ss, 'Clients', [
    'Timestamp','Employee ID','Employee Email','Full Name','Email','Phone / Handle',
    'Business Name','Business Type','State','Business Address','Service','Amount Paid',
    'Status','Follow-Up Date','Source','Notes','Internal Notes'
  ]);

  createSheet_(ss, 'Sales Tracker', [
    'Timestamp','Employee ID','Employee Email','Offer','Price','Client','Date'
  ]);

  createSheet_(ss, 'Daily Tracker', [
    'Timestamp','Employee ID','Employee Email','Business','Date',
    'Clock In','Clock Out','Hours Worked',
    'Reels Created','DMs Sent','Follow-Ups','New Leads','Sales Closed',
    'Revenue','Energy Level','Notes','Sales Detail'
  ]);

  createSheet_(ss, 'Tasks', [
    'Timestamp','Employee ID','Employee Email','Task','Group','Priority','Status','Action'
  ]);

  createSheet_(ss, 'Weekly Review', [
    'Timestamp','Employee ID','Employee Email','Section','Question','Answer'
  ]);

  createSheet_(ss, 'Business Goals', [
    'Timestamp','Employee ID','Employee Email',
    'Goal Type','Goal Name','Target Amount','Current Amount','Deadline','Status','Notes'
  ]);

  createSheet_(ss, 'Expenses', [
    'Timestamp','Employee ID','Employee Email',
    'Date','Category','Vendor','Description','Amount','Payment Method','Notes'
  ]);

  createSheet_(ss, 'Lead Pipeline', [
    'Timestamp','Employee ID','Employee Email',
    'Full Name','Contact','Source','Interest','Stage','Follow-Up Date','Notes'
  ]);

  createSheet_(ss, 'Content Tracker', [
    'Timestamp','Employee ID','Employee Email',
    'Date','Platform','Content Type','Topic','CTA','Status','Views','Leads','Sales','Notes'
  ]);

  createSheet_(ss, 'Monthly Review', [
    'Timestamp','Employee ID','Employee Email',
    'Month','Revenue','Expenses','Profit','Best Offer','Best Platform',
    'Biggest Lesson','Next Month Focus'
  ]);

  // Auto-register owner in Employees sheet
  var ownerEmail = ADMIN_EMAILS[0];
  var ownerEmpId = generateId(ownerEmail);
  registerEmployee(ownerEmail, ownerEmpId, 'Owner');

  return 'SETUP COMPLETE — ' + ownerEmail + ' registered as Owner';
}

// ── CREATE SHEET ─────────────────────────────────────────────────────────────
function createSheet_(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    styleHeader_(sheet, headers.length);
  }
}

// ── STYLE HEADER ─────────────────────────────────────────────────────────────
function styleHeader_(sheet, columns) {
  sheet.getRange(1, 1, 1, columns)
    .setBackground('#141414')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, columns);
}

// ── TEST FUNCTIONS ────────────────────────────────────────────────────────────
function testClockIn()   { return clockIn(); }
function testClockOut()  { return clockOut(''); }
function testGetState()  { return JSON.stringify(getState()); }
function testEmployees() { return JSON.stringify(getEmployeesFromSheet()); }

function doGet() {
  return HtmlService
    .createHtmlOutputFromFile('Index')
    .setTitle('JOSS CEO Tracker')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
