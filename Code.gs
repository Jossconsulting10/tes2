// ═══════════════════════════════════════════════════════════════════════════
// JOSS CONSULTING GROUP — Code.gs  (updated)
// Changes:
//   1. Employee ID + email logged on every sheet write
//   2. Clock In / Clock Out saved as separate atomic calls
//   3. loadState / saveState — persists daily + period data per employee
//      so refresh never resets anything
// ═══════════════════════════════════════════════════════════════════════════

// ── SERVE THE APP ────────────────────────────────────────────────────────────
function doGet() {
  return HtmlService
    .createHtmlOutputFromFile('Index')
    .setTitle('JOSS CEO Tracker')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ── EMPLOYEE REGISTRY ────────────────────────────────────────────────────────
// Add every employee email here. Only listed emails can use the app.
// Leave the array empty to allow everyone.
// ── EMPLOYEE REGISTRY ────────────────────────────────────────────────────────
// Set to true to require employees to be registered in the Employees sheet
// Set to false to allow anyone with the URL to log in
var REQUIRE_REGISTRATION = true;

function getCurrentUser() {
  try {
    var email = Session.getActiveUser().getEmail();
    return email || 'unknown@user.com';
  } catch(e) {
    return 'unknown@user.com';
  }
}

// ── GET ALL REGISTERED EMPLOYEES FROM SHEET ───────────────────────────────
function getEmployeesFromSheet() {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Employees');
    if (!sheet || sheet.getLastRow() < 2) return [];
    var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    var employees = [];
    for (var i = 0; i < data.length; i++) {
      if (data[i][0]) {
        employees.push({
          email:  String(data[i][0]).trim().toLowerCase(),
          empId:  String(data[i][1] || '').trim(),
          name:   String(data[i][2] || '').trim(),
          role:   String(data[i][3] || 'Employee').trim(),
          status: String(data[i][4] || 'Active').trim(),
          added:  String(data[i][5] || '').trim()
        });
      }
    }
    return employees;
  } catch(e) {
    return [];
  }
}

// ── CHECK IF EMAIL IS REGISTERED ─────────────────────────────────────────────
function isAllowed(email) {
  if (!REQUIRE_REGISTRATION) return true;
  var employees = getEmployeesFromSheet();
  if (employees.length === 0) return true; // no employees registered yet — allow all
  for (var i = 0; i < employees.length; i++) {
    if (employees[i].email === email.toLowerCase() &&
        employees[i].status.toLowerCase() === 'active') return true;
  }
  return false;
}

// ── REGISTER OR UPDATE EMPLOYEE IN SHEET ─────────────────────────────────────
function registerEmployee(emailIn, empId, name) {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Employees');
    if (!sheet) {
      sheet = ss.insertSheet('Employees');
      sheet.appendRow(['Email', 'Employee ID', 'Name', 'Role', 'Status', 'Date Registered', 'Last Login']);
      styleHeader_(sheet, 7);
    }

    var email = emailIn.trim().toLowerCase();
    var lastRow = sheet.getLastRow();

    // Check if already exists — update last login
    if (lastRow >= 2) {
      var emails = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var i = 0; i < emails.length; i++) {
        if (String(emails[i][0]).trim().toLowerCase() === email) {
          // Update last login timestamp
          sheet.getRange(i + 2, 7).setValue(new Date().toLocaleString('en-US'));
          return { status: 'UPDATED', empId: sheet.getRange(i + 2, 2).getValue() };
        }
      }
    }

    // New employee — add them
    var now = new Date().toLocaleString('en-US');
    sheet.appendRow([email, empId, name || '', 'Employee', 'Active', now, now]);
    SpreadsheetApp.flush();
    return { status: 'REGISTERED', empId: empId };

  } catch(e) {
    return { status: 'ERROR', message: e.message };
  }
}

// ── GET ALL EMPLOYEES (called from HTML to show list) ─────────────────────────
function getAllEmployees() {
  try {
    var email = getCurrentUser();
    return getEmployeesFromSheet();
  } catch(e) {
    return [];
  }
}

// ── LOGIN HANDLER — called from HTML doLogin() ────────────────────────────────
function loginEmployee(emailIn, empIdIn) {
  try {
    var email  = emailIn.trim().toLowerCase();
    var empId  = empIdIn ? empIdIn.trim().toUpperCase() : generateId(email);

    // Check registration if required
    if (REQUIRE_REGISTRATION && !isAllowed(email)) {
      return { success: false, message: 'This email is not registered. Contact your administrator.' };
    }

    // Register / update in sheet
    var result = registerEmployee(email, empId, '');

    return {
      success: true,
      email:   email,
      empId:   empId,
      message: result.status
    };
  } catch(e) {
    return { success: false, message: 'Login error: ' + e.message };
  }
}

// ── PERSISTENT STATE (per employee, survives refresh) ────────────────────────
// Stores daily stats + period data in PropertiesService
// Key format:  joss_state_<sanitized_email>

function getStateKey(email) {
  return 'joss_state_' + email.replace(/[^a-z0-9]/gi, '_');
}

function loadState(email) {
  try {
    var props = PropertiesService.getUserProperties();
    var raw   = props.getProperty(getStateKey(email));
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return null;
}

function saveState(data) {
  try {
    var email = getCurrentUser();
    var props = PropertiesService.getUserProperties();
    props.setProperty(getStateKey(email), JSON.stringify(data));
    return 'STATE_SAVED';
  } catch(e) {
    return 'STATE_SAVE_ERROR: ' + e.message;
  }
}

function getState() {
  var email = getCurrentUser();
  if (!isAllowed(email)) return { error: 'NOT_AUTHORISED', email: email };
  var state = loadState(email);
  return { state: state, email: email };
}

// ── CLOCK IN ─────────────────────────────────────────────────────────────────
function clockIn() {
  var email = getCurrentUser();
  if (!isAllowed(email)) return 'NOT_AUTHORISED';

  var now = new Date();
  var empId = generateId(email);

  return appendToSheet_('Daily Tracker', {
    'Timestamp':      now.toLocaleString('en-US'),
    'Employee ID':    empId,
    'Employee Email': email,
    'Business':       'JOSS Consulting Group',
    'Date':           now.toLocaleDateString('en-US'),
    'Clock In':       now.toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'}),
    'Clock Out':      '',
    'Hours Worked':   ''
  });
}

// ── CLOCK OUT ────────────────────────────────────────────────────────────────
function clockOut(clockInTime) {
  var email = getCurrentUser();
  if (!isAllowed(email)) return 'NOT_AUTHORISED';

  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Daily Tracker');
  if (!sheet) return 'SHEET_NOT_FOUND';

  var now       = new Date();
  var lastRow   = sheet.getLastRow();
  var headers   = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var emailCol  = headers.indexOf('Employee Email') + 1;
  var clockOutCol = headers.indexOf('Clock Out') + 1;
  var hoursCol  = headers.indexOf('Hours Worked') + 1;
  var clockInCol  = headers.indexOf('Clock In') + 1;
  var dateCol   = headers.indexOf('Date') + 1;
  var today     = now.toLocaleDateString('en-US');

  // Find today's row for this employee that has no Clock Out yet
  for (var r = lastRow; r >= 2; r--) {
    var rowEmail = emailCol > 0 ? sheet.getRange(r, emailCol).getValue() : '';
    var rowDate  = dateCol  > 0 ? sheet.getRange(r, dateCol).getValue()  : '';
    var rowClockOut = clockOutCol > 0 ? sheet.getRange(r, clockOutCol).getValue() : '';

    if (rowEmail === email && String(rowDate) === today && rowClockOut === '') {
      var outTime = now.toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'});
      if (clockOutCol > 0) sheet.getRange(r, clockOutCol).setValue(outTime);

      // Calculate hours worked
      if (hoursCol > 0 && clockInCol > 0) {
        var inStr = sheet.getRange(r, clockInCol).getValue();
        try {
          var inDate  = new Date(today + ' ' + inStr);
          var outDate = new Date(today + ' ' + outTime);
          var diffMs  = outDate - inDate;
          var diffH   = Math.floor(diffMs / 3600000);
          var diffM   = Math.floor((diffMs % 3600000) / 60000);
          sheet.getRange(r, hoursCol).setValue(diffH + 'h ' + diffM + 'm');
        } catch(e) {}
      }

      SpreadsheetApp.flush();
      return 'CLOCKED_OUT';
    }
  }

  return 'NO_OPEN_CLOCKIN_FOUND';
}

// ── MAIN SAVE FUNCTION ───────────────────────────────────────────────────────
function saveToSheet(data) {
  try {
    var email = getCurrentUser();
    if (!isAllowed(email)) return 'NOT_AUTHORISED';

    var sheetName = data.sheet;
    delete data.sheet;

    if (!sheetName) return 'ERROR: Missing sheet name';

    // Auto-attach employee info to every row
    if (!data['Employee Email']) data['Employee Email'] = email;
    if (!data['Employee ID'])    data['Employee ID']    = generateId(email);

    return appendToSheet_(sheetName, data);
  } catch(e) {
    return 'ERROR: ' + e.message;
  }
}

// ── GENERATE CONSISTENT EMPLOYEE ID FROM EMAIL ───────────────────────────────
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
  if (keys.length === 0) return 'NO DATA RECEIVED';

  if (sheet.getLastRow() === 0 || sheet.getLastColumn() === 0) {
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

  var row = headers.map(function(header) {
    return data[header] !== undefined ? data[header] : '';
  });

  sheet.appendRow(row);
  SpreadsheetApp.flush();
  return 'SAVED TO ' + sheetName;
}

// ── SETUP ALL SHEETS ─────────────────────────────────────────────────────────
function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // ── EMPLOYEES SHEET (new) ──
  createSheet_(ss, 'Employees', [
    'Email', 'Employee ID', 'Name', 'Role', 'Status', 'Date Registered', 'Last Login'
  ]);

  createSheet_(ss, 'Call-Outs', [
    'Timestamp', 'Employee Email', 'Employee ID', 'Date', 'Reason', 'Notes'
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

  return 'SETUP COMPLETE';
}

// ── CREATE SHEET WITH HEADERS ─────────────────────────────────────────────────
function createSheet_(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0 || sheet.getLastColumn() === 0) {
    sheet.appendRow(headers);
    styleHeader_(sheet, headers.length);
  }
}

// ── STYLE HEADER ROW ─────────────────────────────────────────────────────────
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
function testSaveClient() {
  return appendToSheet_('Clients', {
    'Timestamp':      new Date(),
    'Employee ID':    'EMP_TEST',
    'Employee Email': 'test@joss.com',
    'Full Name':      'Test Client',
    'Email':          'test@email.com',
    'Phone / Handle': '123456',
    'Business Name':  'Test LLC',
    'Business Type':  'LLC',
    'State':          'FL',
    'Business Address': 'Test Address',
    'Service':        'Core Service',
    'Amount Paid':    '197',
    'Status':         'Lead',
    'Follow-Up Date': '',
    'Source':         'Test',
    'Notes':          'Test row',
    'Internal Notes': 'Backend working'
  });
}

function testClockIn() {
  return clockIn();
}

function testGetState() {
  return JSON.stringify(getState());
}
