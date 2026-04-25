// ═══════════════════════════════════════════════════════════════════════════════
// JOSS CONSULTING GROUP — Google Apps Script
// ───────────────────────────────────────────────────────────────────────────────
// SETUP INSTRUCTIONS (read carefully — takes about 5 minutes):
//
// 1. Go to sheets.google.com — create a new spreadsheet
//    Name it: JOSS Consulting Group — Data Hub
//
// 2. Click Extensions → Apps Script
//    A new tab opens with the script editor
//
// 3. Delete everything in the editor and paste ALL of this code
//
// 4. Click the floppy disk icon (Save) — name the project: JOSS Data Receiver
//
// 5. Click Deploy → New Deployment
//    - Type: Web app
//    - Execute as: Me
//    - Who has access: Anyone
//    - Click Deploy
//    - COPY the Web App URL that appears
//
// 6. Open your JOSS_Consulting_v3.html file in Notepad
//    Find this line near the top of the <script> section:
//      var SHEETS_URL = 'PASTE_YOUR_APPS_SCRIPT_URL_HERE';
//    Replace PASTE_YOUR_APPS_SCRIPT_URL_HERE with the URL you just copied
//
// 7. Save the HTML file and upload it back to GHL
//
// That's it! Every time you:
//   - Add a client in the CRM tab       → saves to "Clients" sheet
//   - Submit Day Summary                → saves to "Daily Tracker" sheet
//   - Log a sale                        → saves to "Sales Tracker" sheet
// ═══════════════════════════════════════════════════════════════════════════════

var SPREADSHEET_NAME = 'JOSS Consulting Group — Data Hub';

// ── MAIN RECEIVER ─────────────────────────────────────────────────────────────
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var sheetName = payload.sheet || 'General';
    var data      = payload.data  || {};

    var ss    = getOrCreateSpreadsheet();
    var sheet = getOrCreateSheet(ss, sheetName);

    writeRow(sheet, data);

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Handle GET requests (for testing the URL is working)
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      status: 'JOSS Data Receiver is live',
      time:   new Date().toLocaleString()
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── WRITE A ROW ───────────────────────────────────────────────────────────────
function writeRow(sheet, data) {
  var headers = getOrCreateHeaders(sheet, data);

  // Build a row in the same order as the headers
  var row = [];
  for (var i = 0; i < headers.length; i++) {
    row.push(data[headers[i]] !== undefined ? data[headers[i]] : '');
  }

  sheet.appendRow(row);

  // Auto-resize columns for readability
  try { sheet.autoResizeColumns(1, headers.length); } catch(e) {}
}

// ── HEADERS ───────────────────────────────────────────────────────────────────
function getOrCreateHeaders(sheet, data) {
  var lastCol    = sheet.getLastColumn();
  var dataKeys   = Object.keys(data);

  if (lastCol === 0) {
    // Sheet is brand new — write headers from data keys
    sheet.appendRow(dataKeys);
    formatHeaderRow(sheet);
    return dataKeys;
  }

  // Sheet exists — get existing headers
  var headerRange    = sheet.getRange(1, 1, 1, lastCol);
  var existingHeaders= headerRange.getValues()[0];

  // Add any new keys that don't exist yet
  var newKeys = [];
  for (var i = 0; i < dataKeys.length; i++) {
    if (existingHeaders.indexOf(dataKeys[i]) === -1) {
      newKeys.push(dataKeys[i]);
    }
  }
  if (newKeys.length > 0) {
    var nextCol = lastCol + 1;
    for (var j = 0; j < newKeys.length; j++) {
      sheet.getRange(1, nextCol + j).setValue(newKeys[j]);
    }
    // Re-read all headers
    existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  }

  return existingHeaders;
}

// ── FORMAT HEADER ROW ─────────────────────────────────────────────────────────
function formatHeaderRow(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol === 0) return;

  var headerRange = sheet.getRange(1, 1, 1, lastCol);

  // JOSS brand colors: coral background, white text, bold
  headerRange.setBackground('#E07055');
  headerRange.setFontColor('#FFFFFF');
  headerRange.setFontWeight('bold');
  headerRange.setFontSize(11);

  // Freeze header row so it stays visible while scrolling
  sheet.setFrozenRows(1);
}

// ── SHEET UTILITIES ───────────────────────────────────────────────────────────
function getOrCreateSpreadsheet() {
  // Try to find existing spreadsheet by name
  var files = DriveApp.getFilesByName(SPREADSHEET_NAME);
  if (files.hasNext()) {
    var file = files.next();
    return SpreadsheetApp.openById(file.getId());
  }
  // Create fresh
  var ss = SpreadsheetApp.create(SPREADSHEET_NAME);
  // Rename default Sheet1 to match first expected sheet
  ss.getActiveSheet().setName('Daily Tracker');
  return ss;
}

function getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

// ── EMAIL NOTIFICATION (optional — runs on every new row) ────────────────────
// To enable: in Apps Script → click the clock icon (Triggers)
//            → Add Trigger → function: sendEmailAlert
//            → Event source: From spreadsheet
//            → Event type: On change
//            → Save
//
// Then replace YOUR_EMAIL_HERE with your real email address:
var NOTIFY_EMAIL = 'YOUR_EMAIL_HERE';

function sendEmailAlert(e) {
  if (!NOTIFY_EMAIL || NOTIFY_EMAIL === 'YOUR_EMAIL_HERE') return;
  try {
    var ss      = getOrCreateSpreadsheet();
    var sheets  = ss.getSheets();
    var subject = 'New JOSS entry — ' + new Date().toLocaleDateString('en-US');
    var body    = 'A new entry was added to your JOSS Consulting data hub.\n\n';
    body += 'View your data: ' + ss.getUrl() + '\n\n';
    body += 'JOSS Consulting Group · Orlando · Columbus';
    MailApp.sendEmail(NOTIFY_EMAIL, subject, body);
  } catch(err) {}
}

// ── MANUAL TEST ───────────────────────────────────────────────────────────────
// Run this function manually inside Apps Script to verify the setup is working.
// Click the Run button after selecting testSetup from the function dropdown.
function testSetup() {
  var ss = getOrCreateSpreadsheet();

  // Test client row
  var clientSheet = getOrCreateSheet(ss, 'Clients');
  writeRow(clientSheet, {
    'Timestamp':     new Date().toLocaleString('en-US'),
    'Full Name':     'Test Client',
    'Email':         'test@test.com',
    'Phone / Handle':'(555) 000-0000',
    'Business Name': 'Test LLC',
    'Business Type': 'LLC',
    'State':         'Florida',
    'Business Address': '123 Test St, Orlando FL 32801',
    'Service':       'Core Service — $197',
    'Amount Paid':   197,
    'Status':        'active',
    'Source':        'Instagram',
    'Notes':         'This is a test row from Apps Script setup.'
  });

  // Test daily tracker row
  var dailySheet = getOrCreateSheet(ss, 'Daily Tracker');
  writeRow(dailySheet, {
    'Timestamp':     new Date().toLocaleString('en-US'),
    'Date':          new Date().toLocaleDateString('en-US'),
    'Clock In':      '12:30 PM',
    'Clock Out':     '3:00 PM',
    'Hours Worked':  '2h 30m',
    'Reels Created': 2,
    'DMs Sent':      12,
    'Follow-Ups':    6,
    'New Leads':     3,
    'Sales Closed':  1,
    'Revenue':       '$197',
    'Energy Level':  '8/10',
    'Notes':         'Test day summary from Apps Script setup.'
  });

  // Test sales row
  var salesSheet = getOrCreateSheet(ss, 'Sales Tracker');
  writeRow(salesSheet, {
    'Timestamp': new Date().toLocaleString('en-US'),
    'Date':      new Date().toLocaleDateString('en-US'),
    'Offer':     'Core Service',
    'Price':     197,
    'Client':    'Test Client'
  });

  Logger.log('Test complete. Check your spreadsheet: ' + ss.getUrl());
  SpreadsheetApp.flush();
}
