// JOSS CEO TRACKER — CLEAN BACKEND
// Put this entire code inside Code.gs

function doGet() {
  return HtmlService
    .createHtmlOutputFromFile("Index")
    .setTitle("JOSS CEO Tracker")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  createSheet_(ss, "Clients", [
    "Timestamp", "Full Name", "Email", "Phone / Handle", "Business Name",
    "Business Type", "State", "Business Address", "Service", "Amount Paid",
    "Status", "Follow-Up Date", "Source", "Notes", "Internal Notes"
  ]);

  createSheet_(ss, "Sales Tracker", [
    "Timestamp", "Offer", "Price", "Client", "Date"
  ]);

  createSheet_(ss, "Daily Tracker", [
    "Timestamp", "Business", "Date", "Clock In", "Clock Out", "Hours Worked",
    "Reels Created", "DMs Sent", "Follow-Ups", "New Leads", "Sales Closed",
    "Revenue", "Energy Level", "Notes", "Sales Detail"
  ]);

  createSheet_(ss, "Tasks", [
    "Timestamp", "Task", "Group", "Priority", "Status", "Action"
  ]);

  createSheet_(ss, "Weekly Review", [
    "Timestamp", "Section", "Question", "Answer"
  ]);

  return "SETUP COMPLETE";
}

function createSheet_(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    styleHeader_(sheet, headers.length);
  }
}

function styleHeader_(sheet, columns) {
  var range = sheet.getRange(1, 1, 1, columns);
  range.setBackground("#141414");
  range.setFontColor("#ffffff");
  range.setFontWeight("bold");
  range.setHorizontalAlignment("center");
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, columns);
}

function appendToSheet_(sheetName, data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  var keys = Object.keys(data);

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
    return data[header] !== undefined ? data[header] : "";
  });

  sheet.appendRow(row);
  SpreadsheetApp.flush();

  return "SAVED TO " + sheetName;
}

function saveClient(data) {
  return appendToSheet_("Clients", {
    "Timestamp": new Date(),
    "Full Name": data.fullName || "",
    "Email": data.email || "",
    "Phone / Handle": data.phone || "",
    "Business Name": data.businessName || "",
    "Business Type": data.businessType || "",
    "State": data.state || "",
    "Business Address": data.businessAddress || "",
    "Service": data.service || "",
    "Amount Paid": data.amountPaid || "",
    "Status": data.status || "",
    "Follow-Up Date": data.followUpDate || "",
    "Source": data.source || "",
    "Notes": data.notes || "",
    "Internal Notes": data.internalNotes || ""
  });
}

function saveSale(data) {
  return appendToSheet_("Sales Tracker", {
    "Timestamp": new Date(),
    "Offer": data.offer || "",
    "Price": data.price || "",
    "Client": data.client || "",
    "Date": data.date || new Date()
  });
}

function saveDailySummary(data) {
  return appendToSheet_("Daily Tracker", {
    "Timestamp": new Date(),
    "Business": "JOSS Consulting Group",
    "Date": data.date || "",
    "Clock In": data.clockIn || "",
    "Clock Out": data.clockOut || "",
    "Hours Worked": data.hoursWorked || "",
    "Reels Created": data.reels || "",
    "DMs Sent": data.dms || "",
    "Follow-Ups": data.followUps || "",
    "New Leads": data.leads || "",
    "Sales Closed": data.salesClosed || "",
    "Revenue": data.revenue || "",
    "Energy Level": data.energy || "",
    "Notes": data.notes || "",
    "Sales Detail": data.salesDetail || ""
  });
}

function saveTask(data) {
  return appendToSheet_("Tasks", {
    "Timestamp": new Date(),
    "Task": data.task || "",
    "Group": data.group || "",
    "Priority": data.priority || "",
    "Status": data.status || "",
    "Action": data.action || ""
  });
}

function saveWeeklyReview(items) {
  if (!items || !items.length) return "NO REVIEW DATA";

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Weekly Review");

  if (!sheet) {
    sheet = ss.insertSheet("Weekly Review");
    sheet.appendRow(["Timestamp", "Section", "Question", "Answer"]);
    styleHeader_(sheet, 4);
  }

  items.forEach(function(item) {
    sheet.appendRow([
      new Date(),
      item.section || "",
      item.question || "",
      item.answer || ""
    ]);
  });

  SpreadsheetApp.flush();
  return "WEEKLY REVIEW SAVED";
}

function testSaveClient() {
  return saveClient({
    fullName: "Test Client",
    email: "test@email.com",
    phone: "555-000-0000",
    businessName: "Test Business LLC",
    businessType: "LLC",
    state: "Florida",
    businessAddress: "Test Address",
    service: "Test Service",
    amountPaid: "1",
    status: "Lead",
    followUpDate: "",
    source: "Test",
    notes: "This is a test row.",
    internalNotes: "Testing backend."
  });
}
