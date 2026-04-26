// ═══════════════════════════════════════════════════════════════════════════════
// JOSS CONSULTING GROUP — Code.gs FINAL v2
// ═══════════════════════════════════════════════════════════════════════════════

// ── ADMINS — always have access ───────────────────────────────────────────────
var ADMIN_EMAILS = [
  'support@jossconsultinggroup.com'
];

// ── SET true TO REQUIRE EMPLOYEES TO BE IN THE SHEET ─────────────────────────
var REQUIRE_REGISTRATION = true;

// ── HARDCODED SCHEDULES ───────────────────────────────────────────────────────
var HARDCODED_SCHEDULES = {
  'yoldinejoscirin@gmail.com': {
    Mon:{start:'9:00 AM',end:'5:00 PM'},Tue:{start:'9:00 AM',end:'5:00 PM'},
    Wed:{start:'9:00 AM',end:'5:00 PM'},Thu:{start:'9:00 AM',end:'5:00 PM'},
    Fri:{start:'9:00 AM',end:'5:00 PM'},Sat:{start:'',end:''},Sun:{start:'',end:''}
  },
  'support@jossconsultinggroup.com': {
    Mon:{start:'12:00 PM',end:'5:00 PM'},Tue:{start:'12:00 PM',end:'5:00 PM'},
    Wed:{start:'8:00 AM',end:'12:00 PM'},Thu:{start:'12:00 PM',end:'5:00 PM'},
    Fri:{start:'',end:''},Sat:{start:'',end:''},Sun:{start:'',end:''}
  },
  'support@jossconsultinggroup.com': {
    Mon:{start:'12:00 PM',end:'5:00 PM'},Tue:{start:'12:00 PM',end:'5:00 PM'},
    Wed:{start:'8:00 AM',end:'12:00 PM'},Thu:{start:'12:00 PM',end:'5:00 PM'},
    Fri:{start:'',end:''},Sat:{start:'',end:''},Sun:{start:'',end:''}
  }
};

// ─────────────────────────────────────────────────────────────────────────────

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('JOSS CEO Tracker')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getCurrentUser() {
  try { return Session.getActiveUser().getEmail() || ''; } catch(e) { return ''; }
}

function isAdmin(email) {
  for (var i = 0; i < ADMIN_EMAILS.length; i++) {
    if (ADMIN_EMAILS[i].toLowerCase() === email.toLowerCase()) return true;
  }
  return false;
}

function isAllowed(email) {
  if (!email) return false;
  if (isAdmin(email)) return true;
  if (!REQUIRE_REGISTRATION) return true;
  var list = getEmployeesFromSheet();
  if (!list.length) return true;
  for (var i = 0; i < list.length; i++) {
    if (list[i].email === email.toLowerCase() && list[i].status.toLowerCase() === 'active') return true;
  }
  return false;
}

function generateId(email) {
  var h = 0;
  for (var i = 0; i < email.length; i++) { h = ((h<<5)-h)+email.charCodeAt(i); h=h&h; }
  return 'EMP'+Math.abs(h).toString(36).toUpperCase().slice(0,6);
}

// ── EMPLOYEES SHEET ───────────────────────────────────────────────────────────
function getEmployeesFromSheet() {
  try {
    var ss=SpreadsheetApp.getActiveSpreadsheet();
    var sheet=ss.getSheetByName('Employees');
    if (!sheet||sheet.getLastRow()<2) return [];
    var data=sheet.getRange(2,1,sheet.getLastRow()-1,sheet.getLastColumn()).getValues();
    var out=[];
    for (var i=0;i<data.length;i++) {
      if (data[i][0]) out.push({
        email:String(data[i][0]).trim().toLowerCase(),
        empId:String(data[i][1]||''),
        name:String(data[i][2]||''),
        role:String(data[i][3]||'Employee'),
        status:String(data[i][4]||'Active')
      });
    }
    return out;
  } catch(e) { return []; }
}

function updateEmployeeCol(email,colName,value) {
  try {
    var ss=SpreadsheetApp.getActiveSpreadsheet();
    var sheet=ss.getSheetByName('Employees');
    if (!sheet||sheet.getLastRow()<2) return;
    var headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
    var col=headers.indexOf(colName)+1;
    if (col<1) return;
    var emails=sheet.getRange(2,1,sheet.getLastRow()-1,1).getValues();
    for (var i=0;i<emails.length;i++) {
      if (String(emails[i][0]).trim().toLowerCase()===email.toLowerCase()) {
        sheet.getRange(i+2,col).setValue(value);
        SpreadsheetApp.flush(); return;
      }
    }
  } catch(e) {}
}

// ── LOGIN — validates ID against sheet ───────────────────────────────────────
function loginEmployee(emailIn, empIdIn) {
  try {
    var email = emailIn.trim().toLowerCase();
    var empId = empIdIn ? empIdIn.trim().toUpperCase() : '';

    if (!isAllowed(email)) {
      return { success:false, message:'Your email is not registered. Contact support@jossconsultinggroup.com.' };
    }

    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Employees');

    // Admin access: support@jossconsultinggroup.com must always be able to log in.
    // If the admin row is missing, create it automatically so login does not fail.
    if (isAdmin(email)) {
      var adminId = generateId(email);
      if (!empId) empId = adminId;

      if (!sheet) {
        sheet = ss.insertSheet('Employees');
        sheet.appendRow(['Email','Employee ID','Name','Role','Status','Date Registered','Last Login','Last Clock In']);
        styleHeader_(sheet,8);
      }

      var foundAdmin = false;
      if (sheet.getLastRow() >= 2) {
        var adminHeaders = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
        var adminIdCol = adminHeaders.indexOf('Employee ID') + 1;
        var adminEmails = sheet.getRange(2,1,sheet.getLastRow()-1,1).getValues();
        for (var a=0; a<adminEmails.length; a++) {
          if (String(adminEmails[a][0]).trim().toLowerCase() === email) {
            foundAdmin = true;
            var savedAdminId = adminIdCol > 0 ? String(sheet.getRange(a+2,adminIdCol).getValue()).trim().toUpperCase() : '';
            if (!savedAdminId && adminIdCol > 0) {
              sheet.getRange(a+2,adminIdCol).setValue(adminId);
              savedAdminId = adminId;
            }
            updateEmployeeCol(email,'Last Login',new Date().toLocaleString('en-US'));
            return { success:true, email:email, empId:savedAdminId || adminId };
          }
        }
      }

      if (!foundAdmin) {
        registerEmployee(email, adminId, 'Admin');
        updateEmployeeCol(email,'Last Login',new Date().toLocaleString('en-US'));
        return { success:true, email:email, empId:adminId };
      }
    }

    if (sheet && sheet.getLastRow() >= 2) {
      var headers  = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
      var emailCol = headers.indexOf('Email')+1;
      var idCol    = headers.indexOf('Employee ID')+1;
      var emails   = sheet.getRange(2,1,sheet.getLastRow()-1,1).getValues();

      for (var i=0;i<emails.length;i++) {
        if (String(emails[i][0]).trim().toLowerCase()===email) {
          var storedId = idCol>0 ? String(sheet.getRange(i+2,idCol).getValue()).trim().toUpperCase() : '';

          // ID exists in sheet — must match exactly
          if (storedId && empId !== storedId) {
            return { success:false, message:'Incorrect Employee ID. Check and try again.' };
          }

          // No ID in sheet yet — save the one they entered
          if (!storedId && empId && idCol>0) {
            sheet.getRange(i+2,idCol).setValue(empId);
            SpreadsheetApp.flush();
          }

          updateEmployeeCol(email,'Last Login',new Date().toLocaleString('en-US'));
          return { success:true, email:email, empId:storedId||empId };
        }
      }
    }

    // Not in sheet — register if open access
    if (!REQUIRE_REGISTRATION) {
      registerEmployee(email, empId, '');
      return { success:true, email:email, empId:empId };
    }

    return { success:false, message:'Email not found. Contact support@jossconsultinggroup.com.' };
  } catch(e) {
    return { success:false, message:'Login error: '+e.message };
  }
}

function registerEmployee(emailIn, empId, name) {
  try {
    var ss=SpreadsheetApp.getActiveSpreadsheet();
    var sheet=ss.getSheetByName('Employees');
    if (!sheet) { sheet=ss.insertSheet('Employees'); sheet.appendRow(['Email','Employee ID','Name','Role','Status','Date Registered','Last Login','Last Clock In']); styleHeader_(sheet,8); }
    var email=emailIn.trim().toLowerCase();
    var now=new Date().toLocaleString('en-US');
    if (sheet.getLastRow()>=2) {
      var emails=sheet.getRange(2,1,sheet.getLastRow()-1,1).getValues();
      for (var i=0;i<emails.length;i++) {
        if (String(emails[i][0]).trim().toLowerCase()===email) { sheet.getRange(i+2,7).setValue(now); return {status:'UPDATED',empId:sheet.getRange(i+2,2).getValue()}; }
      }
    }
    var role=isAdmin(email)?'Owner':'Employee';
    sheet.appendRow([email,empId,name||'',role,'Active',now,now,'']);
    SpreadsheetApp.flush();
    return {status:'REGISTERED',empId:empId};
  } catch(e) { return {status:'ERROR',message:e.message}; }
}

// ── CLOCK IN / OUT ────────────────────────────────────────────────────────────
function clockIn() {
  var email=getCurrentUser(); if (!isAllowed(email)) return 'NOT_AUTHORISED';
  var now=new Date(); var empId=generateId(email);
  var timeStr=now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
  updateEmployeeCol(email,'Last Clock In',now.toLocaleString('en-US'));
  return appendToSheet_('Daily Tracker',{
    'Timestamp':now.toLocaleString('en-US'),'Employee ID':empId,'Employee Email':email,
    'Business':'JOSS Consulting Group','Date':now.toLocaleDateString('en-US'),
    'Clock In':timeStr,'Clock Out':'','Hours Worked':''
  });
}

function clockOut() {
  var email=getCurrentUser(); if (!isAllowed(email)) return 'NOT_AUTHORISED';
  var ss=SpreadsheetApp.getActiveSpreadsheet(); var sheet=ss.getSheetByName('Daily Tracker');
  if (!sheet) return 'SHEET_NOT_FOUND';
  var now=new Date(); var headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
  var eCol=headers.indexOf('Employee Email')+1,coCol=headers.indexOf('Clock Out')+1;
  var hwCol=headers.indexOf('Hours Worked')+1,ciCol=headers.indexOf('Clock In')+1,dCol=headers.indexOf('Date')+1;
  var today=now.toLocaleDateString('en-US');
  var outStr=now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
  for (var r=sheet.getLastRow();r>=2;r--) {
    var rE=eCol>0?sheet.getRange(r,eCol).getValue():'';
    var rD=dCol>0?sheet.getRange(r,dCol).getValue():'';
    var rO=coCol>0?sheet.getRange(r,coCol).getValue():'';
    if (rE===email&&String(rD)===today&&rO==='') {
      if (coCol>0) sheet.getRange(r,coCol).setValue(outStr);
      if (hwCol>0&&ciCol>0) {
        try {
          var inStr=sheet.getRange(r,ciCol).getValue();
          var diff=new Date(today+' '+outStr)-new Date(today+' '+inStr);
          var h=Math.floor(diff/3600000),m=Math.floor((diff%3600000)/60000);
          sheet.getRange(r,hwCol).setValue(h+'h '+m+'m');
        } catch(e) {}
      }
      SpreadsheetApp.flush(); return 'CLOCKED_OUT';
    }
  }
  return 'NO_OPEN_CLOCKIN';
}

// ── SAVE TODAY DATA — called on every stat update (live save) ─────────────────
function saveTodayData(data) {
  try {
    var email=getCurrentUser(); if (!isAllowed(email)) return 'NOT_AUTHORISED';
    if (!data) return 'NO_DATA';
    data['Employee Email']=email;
    data['Employee ID']=generateId(email);
    // Upsert: find today's row and update, or create new one
    var ss=SpreadsheetApp.getActiveSpreadsheet();
    var sheet=ss.getSheetByName('Daily Tracker');
    if (!sheet) return appendToSheet_('Daily Tracker',data);
    var today=new Date().toLocaleDateString('en-US');
    var headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
    var eCol=headers.indexOf('Employee Email')+1;
    var dCol=headers.indexOf('Date')+1;
    // Find existing row for today
    for (var r=sheet.getLastRow();r>=2;r--) {
      var rE=eCol>0?String(sheet.getRange(r,eCol).getValue()).toLowerCase():'';
      var rD=dCol>0?String(sheet.getRange(r,dCol).getValue()):'';
      if (rE===email.toLowerCase()&&rD===today) {
        // Update existing row
        for (var key in data) {
          var ci=headers.indexOf(key)+1;
          if (ci>0) sheet.getRange(r,ci).setValue(data[key]);
        }
        SpreadsheetApp.flush();
        return 'UPDATED';
      }
    }
    // No row today — create one
    return appendToSheet_('Daily Tracker',data);
  } catch(e) { return 'ERROR:'+e.message; }
}

// ── MAIN SAVE ─────────────────────────────────────────────────────────────────
function saveToSheet(data) {
  try {
    var sheetName=data.sheet; delete data.sheet;
    if (!sheetName) return 'ERROR: Missing sheet name';
    var email=getCurrentUser();
    if (email&&!data['Employee Email']) data['Employee Email']=email;
    if (email&&!data['Employee ID'])    data['Employee ID']=generateId(email);
    return appendToSheet_(sheetName,data);
  } catch(e) { return 'ERROR:'+e.message; }
}

// ── STATE PERSISTENCE ─────────────────────────────────────────────────────────
function saveState(stateObj) {
  try {
    var email=getCurrentUser();
    var key='joss_'+email.replace(/[^a-z0-9]/gi,'_');
    PropertiesService.getUserProperties().setProperty(key,JSON.stringify(stateObj));
    return 'OK';
  } catch(e) { return 'ERR'; }
}

function getState() {
  try {
    var email=getCurrentUser();
    var key='joss_'+email.replace(/[^a-z0-9]/gi,'_');
    var raw=PropertiesService.getUserProperties().getProperty(key);
    return {state:raw?JSON.parse(raw):null,email:email};
  } catch(e) { return {state:null,email:''}; }
}

// ── SCHEDULE ──────────────────────────────────────────────────────────────────
function getEmployeeSchedule(emailParam) {
  try {
    var email=emailParam?emailParam.trim().toLowerCase():getCurrentUser();
    var ss=SpreadsheetApp.getActiveSpreadsheet();
    var sheet=ss.getSheetByName('Employees');
    if (sheet&&sheet.getLastRow()>=2) {
      var headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
      var emails=sheet.getRange(2,1,sheet.getLastRow()-1,1).getValues();
      for (var i=0;i<emails.length;i++) {
        if (String(emails[i][0]).trim().toLowerCase()===email) {
          var row=sheet.getRange(i+2,1,1,sheet.getLastColumn()).getValues()[0];
          var days=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
          var schedule={};
          for (var d=0;d<days.length;d++) {
            var sc=headers.indexOf(days[d]+' Start'),ec=headers.indexOf(days[d]+' End');
            schedule[days[d]]={start:sc>-1?formatTime_(row[sc]):'',end:ec>-1?formatTime_(row[ec]):''};
          }
          return {email:email,schedule:schedule};
        }
      }
    }
    if (HARDCODED_SCHEDULES[email]) return {email:email,schedule:HARDCODED_SCHEDULES[email]};
    return null;
  } catch(e) {
    var em=emailParam?emailParam.trim().toLowerCase():'';
    if (HARDCODED_SCHEDULES[em]) return {email:em,schedule:HARDCODED_SCHEDULES[em]};
    return null;
  }
}

function formatTime_(val) {
  if (!val||val==='') return '';
  if (typeof val==='string') { var c=val.trim(); if (c===''||c.toLowerCase()==='off') return ''; if (c.charAt(0)==="'") c=c.slice(1); return c; }
  if (val instanceof Date) { try { var h=val.getHours(),m=val.getMinutes(),ap=h>=12?'PM':'AM',h12=h%12||12,mm=m<10?'0'+m:String(m); return h12+':'+mm+' '+ap; } catch(e){return '';} }
  if (typeof val==='number'&&val>=0&&val<1) { var tm=Math.round(val*24*60),hh=Math.floor(tm/60),mm2=tm%60,ap2=hh>=12?'PM':'AM',hh12=hh%12||12,ms=mm2<10?'0'+mm2:String(mm2); return hh12+':'+ms+' '+ap2; }
  return '';
}

// ── ORG DASHBOARD ─────────────────────────────────────────────────────────────
function getOrgDashboard() {
  try {
    var ss=SpreadsheetApp.getActiveSpreadsheet();
    var now=new Date();
    var today=now.toLocaleDateString('en-US');
    var wd=now.getDay(),wdiff=now.getDate()-wd+(wd===0?-6:1);
    var weekStart=new Date(now.getFullYear(),now.getMonth(),wdiff,0,0,0,0);
    var monthStart=new Date(now.getFullYear(),now.getMonth(),1);
    var q=Math.floor(now.getMonth()/3);
    var qStart=new Date(now.getFullYear(),q*3,1);
    var yearStart=new Date(now.getFullYear(),0,1);

    function dateOf(v) {
      if (!v) return null;
      if (v instanceof Date) return v;
      var d=new Date(v); return isNaN(d)?null:d;
    }
    function inPeriod(v,start) {
      var d=dateOf(v); if (!d) return false;
      return d>=start&&d<=now;
    }

    var dtSheet=ss.getSheetByName('Daily Tracker');
    var dtData=dtSheet&&dtSheet.getLastRow()>1?dtSheet.getRange(2,1,dtSheet.getLastRow()-1,dtSheet.getLastColumn()).getValues():[];
    var dtH=dtSheet&&dtSheet.getLastRow()>0?dtSheet.getRange(1,1,1,dtSheet.getLastColumn()).getValues()[0]:[];

    var stSheet=ss.getSheetByName('Sales Tracker');
    var stData=stSheet&&stSheet.getLastRow()>1?stSheet.getRange(2,1,stSheet.getLastRow()-1,stSheet.getLastColumn()).getValues():[];
    var stH=stSheet&&stSheet.getLastRow()>0?stSheet.getRange(1,1,1,stSheet.getLastColumn()).getValues()[0]:[];

    function gc(row,headers,name){var i=headers.indexOf(name);return i>-1?row[i]:'';}
    function num(v){return parseFloat(String(v).replace(/[^0-9.]/g,''))||0;}
    function int(v){return parseInt(v)||0;}

    var blank=function(){return {revenue:0,sales:0,reels:0,dms:0,fu:0,leads:0,clients:0};};
    var org={today:blank(),week:blank(),month:blank(),quarter:blank(),year:blank()};
    var emps={};

    function ensureEmp(e){if(!e)return;if(!emps[e])emps[e]={today:blank(),week:blank(),month:blank(),quarter:blank(),year:blank(),clockIn:'',clockOut:'',hours:''};}

    for (var i=0;i<dtData.length;i++) {
      var row=dtData[i];
      var em=String(gc(row,dtH,'Employee Email')).toLowerCase().trim();
      var dt=gc(row,dtH,'Date');
      var rev=num(gc(row,dtH,'Revenue'));
      var reels=int(gc(row,dtH,'Reels Created'));
      var dms=int(gc(row,dtH,'DMs Sent'));
      var fu=int(gc(row,dtH,'Follow-Ups'));
      var leads=int(gc(row,dtH,'New Leads'));
      var sales=int(gc(row,dtH,'Sales Closed'));
      var ci=String(gc(row,dtH,'Clock In')||'');
      var co=String(gc(row,dtH,'Clock Out')||'');
      var hw=String(gc(row,dtH,'Hours Worked')||'');
      ensureEmp(em);
      var periods=['today','week','month','quarter','year'];
      var starts=[null,weekStart,monthStart,qStart,yearStart];
      var todayDate=new Date(today);
      for (var p=0;p<periods.length;p++) {
        var inP=p===0?String(dt)===today:inPeriod(dt,starts[p]);
        if (inP) {
          if (em&&emps[em]){emps[em][periods[p]].revenue+=rev;emps[em][periods[p]].reels+=reels;emps[em][periods[p]].dms+=dms;emps[em][periods[p]].fu+=fu;emps[em][periods[p]].leads+=leads;emps[em][periods[p]].sales+=sales;}
          org[periods[p]].revenue+=rev;org[periods[p]].reels+=reels;org[periods[p]].dms+=dms;org[periods[p]].fu+=fu;org[periods[p]].leads+=leads;
          if (p===0&&em&&emps[em]){if(ci)emps[em].clockIn=ci;if(co)emps[em].clockOut=co;if(hw)emps[em].hours=hw;}
        }
      }
    }

    for (var j=0;j<stData.length;j++) {
      var srow=stData[j];
      var sem=String(gc(srow,stH,'Employee Email')).toLowerCase().trim();
      var sdt=gc(srow,stH,'Date');
      var sp=num(gc(srow,stH,'Price'));
      ensureEmp(sem);
      var speriods=['today','week','month','quarter','year'];
      var sstarts=[null,weekStart,monthStart,qStart,yearStart];
      for (var sp2=0;sp2<speriods.length;sp2++) {
        var sinP=sp2===0?String(sdt)===today:inPeriod(sdt,sstarts[sp2]);
        if (sinP){
          if (sem&&emps[sem]){emps[sem][speriods[sp2]].revenue+=sp;emps[sem][speriods[sp2]].sales++;}
          org[speriods[sp2]].revenue+=sp;org[speriods[sp2]].sales++;
        }
      }
    }

    return {success:true,org:org,employees:emps,generated:new Date().toLocaleString('en-US')};
  } catch(e) { return {success:false,error:e.message}; }
}

// ── APPEND ROW ────────────────────────────────────────────────────────────────
function appendToSheet_(sheetName,data) {
  var ss=SpreadsheetApp.getActiveSpreadsheet();
  var sheet=ss.getSheetByName(sheetName);
  if (!sheet) sheet=ss.insertSheet(sheetName);
  var keys=Object.keys(data);
  if (!keys.length) return 'NO DATA';
  if (sheet.getLastRow()===0||sheet.getLastColumn()===0){sheet.appendRow(keys);styleHeader_(sheet,keys.length);}
  var headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
  keys.forEach(function(k){if(headers.indexOf(k)===-1){sheet.getRange(1,sheet.getLastColumn()+1).setValue(k);headers.push(k);}});
  sheet.appendRow(headers.map(function(h){return data[h]!==undefined?data[h]:'';}));
  SpreadsheetApp.flush();
  return 'SAVED TO '+sheetName;
}

// ── SETUP ─────────────────────────────────────────────────────────────────────
function setupSheets() {
  var ss=SpreadsheetApp.getActiveSpreadsheet();
  createSheet_(ss,'Employees',['Email','Employee ID','Name','Role','Status','Date Registered','Last Login','Last Clock In']);
  createSheet_(ss,'Call-Outs',['Timestamp','Employee Email','Employee ID','Date','Reason','Notes']);
  createSheet_(ss,'Clients',['Timestamp','Employee ID','Employee Email','Full Name','Email','Phone / Handle','Business Name','Business Type','State','Business Address','Service','Amount Paid','Status','Follow-Up Date','Source','Notes','Internal Notes']);
  createSheet_(ss,'Sales Tracker',['Timestamp','Employee ID','Employee Email','Offer','Price','Client','Date']);
  createSheet_(ss,'Daily Tracker',['Timestamp','Employee ID','Employee Email','Business','Date','Clock In','Clock Out','Hours Worked','Reels Created','DMs Sent','Follow-Ups','New Leads','Sales Closed','Revenue','Energy Level','Notes','Sales Detail']);
  createSheet_(ss,'Tasks',['Timestamp','Employee ID','Employee Email','Task','Group','Priority','Status','Action']);
  createSheet_(ss,'Weekly Review',['Timestamp','Employee ID','Employee Email','Section','Question','Answer']);
  createSheet_(ss,'Business Goals',['Timestamp','Employee ID','Employee Email','Goal Type','Goal Name','Target Amount','Current Amount','Deadline','Status','Notes']);
  createSheet_(ss,'Expenses',['Timestamp','Employee ID','Employee Email','Date','Category','Vendor','Description','Amount','Payment Method','Notes']);
  createSheet_(ss,'Lead Pipeline',['Timestamp','Employee ID','Employee Email','Full Name','Contact','Source','Interest','Stage','Follow-Up Date','Notes']);
  createSheet_(ss,'Content Tracker',['Timestamp','Employee ID','Employee Email','Date','Platform','Content Type','Topic','CTA','Status','Views','Leads','Sales','Notes']);
  createSheet_(ss,'Monthly Review',['Timestamp','Employee ID','Employee Email','Month','Revenue','Expenses','Profit','Best Offer','Best Platform','Biggest Lesson','Next Month Focus']);
  var oe=ADMIN_EMAILS[0];
  registerEmployee(oe,generateId(oe),'Owner');
  return 'SETUP COMPLETE — '+oe+' registered';
}

function createSheet_(ss,name,headers) {
  var sheet=ss.getSheetByName(name);
  if (!sheet) sheet=ss.insertSheet(name);
  if (sheet.getLastRow()===0||sheet.getLastColumn()===0){sheet.appendRow(headers);styleHeader_(sheet,headers.length);}
}

function styleHeader_(sheet,columns) {
  sheet.getRange(1,1,1,columns).setBackground('#141414').setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1,columns);
}

function getAllEmployees() { return getEmployeesFromSheet(); }

// ═══════════════════════════════════════════════════════════════════════════════
// PORTAL — CLIENT MANAGEMENT SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

// ── GENERATE UNIQUE ID ────────────────────────────────────────────────────────
function genUID_(prefix) {
  var ts  = new Date().getTime().toString(36).toUpperCase();
  var rnd = Math.random().toString(36).substr(2,4).toUpperCase();
  return (prefix||'ID') + '-' + ts + '-' + rnd;
}

// ── AUDIT TRAIL ───────────────────────────────────────────────────────────────
function logAudit_(action, clientId, recordType, recordId, description, source) {
  try {
    var email = getCurrentUser() || 'system';
    var emp   = getEmployeesFromSheet().find(function(e){ return e.email===email; });
    var name  = emp ? (emp.name || email) : email;
    appendToSheet_('Audit Trail', {
      'Audit ID':       genUID_('AUD'),
      'Date Time':      new Date().toLocaleString('en-US'),
      'Employee Name':  name,
      'Employee Email': email,
      'Action Type':    action,
      'Client ID':      clientId   || '',
      'Record Type':    recordType || '',
      'Record ID':      recordId   || '',
      'Description':    description|| '',
      'Source':         source     || 'Employee'
    });
  } catch(e) {}
}

// ── SAVE CLIENT RECORD ────────────────────────────────────────────────────────
function saveClientRecord(data) {
  try {
    var email  = getCurrentUser();
    var emp    = getEmployeesFromSheet().find(function(e){ return e.email===email; });
    var name   = emp ? (emp.name||email) : email;
    var now    = new Date().toLocaleString('en-US');
    var isNew  = !data['Client ID'];
    if (isNew) data['Client ID'] = genUID_('CLT');
    data['Updated By'] = name; data['Updated At'] = now;
    if (isNew) { data['Created By'] = name; data['Created At'] = now; }
    var result = isNew ? appendToSheet_('Clients', data) : updateSheetRow_('Clients','Client ID',data['Client ID'],data);
    logAudit_(isNew?'Client Created':'Client Updated', data['Client ID'], 'Client', data['Client ID'],
      (isNew?'New client added: ':'Client updated: ')+(data['Full Name']||''), 'Employee');
    return { success:true, clientId: data['Client ID'], result: result };
  } catch(e) { return { success:false, error: e.message }; }
}

// ── GET CLIENTS ───────────────────────────────────────────────────────────────
function getClients() {
  try {
    var ss=SpreadsheetApp.getActiveSpreadsheet();
    var sheet=ss.getSheetByName('Clients');
    if (!sheet||sheet.getLastRow()<2) return [];
    var headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
    var data=sheet.getRange(2,1,sheet.getLastRow()-1,sheet.getLastColumn()).getValues();
    return data.map(function(row){
      var obj={};
      headers.forEach(function(h,i){ obj[h]=row[i]; });
      return obj;
    }).filter(function(r){ return r['Full Name']||r['Client ID']; });
  } catch(e) { return []; }
}

// ── SAVE INVOICE ──────────────────────────────────────────────────────────────
function saveInvoice(data) {
  try {
    var email=getCurrentUser();
    var emp=getEmployeesFromSheet().find(function(e){return e.email===email;});
    var name=emp?(emp.name||email):email;
    var now=new Date().toLocaleString('en-US');
    var isNew=!data['Invoice #'];
    if (isNew) data['Invoice #']=genUID_('INV');
    data['Updated By']=name; data['Updated At']=now;
    if (isNew) { data['Created By']=name; data['Created At']=now; }
    // Auto-calculate status
    var total=parseFloat(data['Total'])||0;
    var paid=parseFloat(data['Amount Paid'])||0;
    var due=new Date(data['Due Date']);
    var balance=total-paid;
    data['Balance Due']=balance;
    if (paid>=total && total>0) data['Status']='Paid';
    else if (paid>0) data['Status']='Partial Payment';
    else if (due<new Date() && total>0) data['Status']='Overdue';
    var result=isNew?appendToSheet_('Invoices',data):updateSheetRow_('Invoices','Invoice #',data['Invoice #'],data);
    logAudit_(isNew?'Invoice Created':'Invoice Updated',data['Client ID'],'Invoice',data['Invoice #'],
      'Invoice '+(isNew?'created':'updated')+': '+data['Invoice #']+' — $'+total,'Employee');
    return {success:true,invoiceId:data['Invoice #'],result:result};
  } catch(e) { return {success:false,error:e.message}; }
}

// ── GET INVOICES ──────────────────────────────────────────────────────────────
function getInvoices(clientId) {
  try {
    var ss=SpreadsheetApp.getActiveSpreadsheet();
    var sheet=ss.getSheetByName('Invoices');
    if (!sheet||sheet.getLastRow()<2) return [];
    var headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
    var data=sheet.getRange(2,1,sheet.getLastRow()-1,sheet.getLastColumn()).getValues();
    var rows=data.map(function(row){var obj={};headers.forEach(function(h,i){obj[h]=row[i];});return obj;});
    return clientId ? rows.filter(function(r){return r['Client ID']===clientId;}) : rows;
  } catch(e) { return []; }
}

// ── SAVE PAYMENT ──────────────────────────────────────────────────────────────
function savePayment(data) {
  try {
    var email=getCurrentUser();
    var emp=getEmployeesFromSheet().find(function(e){return e.email===email;});
    var name=emp?(emp.name||email):email;
    var now=new Date().toLocaleString('en-US');
    data['Payment ID']=data['Payment ID']||genUID_('PAY');
    data['Created By']=name; data['Created At']=now;
    // Update invoice Amount Paid
    if (data['Invoice #']) {
      var ss=SpreadsheetApp.getActiveSpreadsheet();
      var iSheet=ss.getSheetByName('Invoices');
      if (iSheet&&iSheet.getLastRow()>=2) {
        var iHeaders=iSheet.getRange(1,1,1,iSheet.getLastColumn()).getValues()[0];
        var iData=iSheet.getRange(2,1,iSheet.getLastRow()-1,iSheet.getLastColumn()).getValues();
        var invNumCol=iHeaders.indexOf('Invoice #');
        var paidCol=iHeaders.indexOf('Amount Paid');
        var totalCol=iHeaders.indexOf('Total');
        var statusCol=iHeaders.indexOf('Status');
        var balCol=iHeaders.indexOf('Balance Due');
        for (var i=0;i<iData.length;i++) {
          if (iData[i][invNumCol]===data['Invoice #']) {
            var currentPaid=parseFloat(iData[i][paidCol])||0;
            var newPaid=currentPaid+parseFloat(data['Amount Paid']||0);
            var total=parseFloat(iData[i][totalCol])||0;
            var balance=total-newPaid;
            var status=newPaid>=total?'Paid':newPaid>0?'Partial Payment':'Waiting Payment';
            if (paidCol>-1) iSheet.getRange(i+2,paidCol+1).setValue(newPaid);
            if (balCol>-1)  iSheet.getRange(i+2,balCol+1).setValue(balance);
            if (statusCol>-1) iSheet.getRange(i+2,statusCol+1).setValue(status);
            SpreadsheetApp.flush();
            break;
          }
        }
      }
    }
    var result=appendToSheet_('Payments',data);
    logAudit_('Payment Recorded',data['Client ID'],'Payment',data['Payment ID'],
      'Payment of $'+data['Amount Paid']+' via '+data['Payment Method'],'Employee');
    return {success:true,paymentId:data['Payment ID'],result:result};
  } catch(e) { return {success:false,error:e.message}; }
}

function getPayments(clientId) {
  try {
    var ss=SpreadsheetApp.getActiveSpreadsheet();
    var sheet=ss.getSheetByName('Payments');
    if (!sheet||sheet.getLastRow()<2) return [];
    var headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
    var data=sheet.getRange(2,1,sheet.getLastRow()-1,sheet.getLastColumn()).getValues();
    var rows=data.map(function(row){var obj={};headers.forEach(function(h,i){obj[h]=row[i];});return obj;});
    return clientId?rows.filter(function(r){return r['Client ID']===clientId;}):rows;
  } catch(e) { return []; }
}

// ── SAVE COMMUNICATION LOG ────────────────────────────────────────────────────
function saveCommLog(data) {
  try {
    var email=getCurrentUser();
    var emp=getEmployeesFromSheet().find(function(e){return e.email===email;});
    var name=emp?(emp.name||email):email;
    var now=new Date().toLocaleString('en-US');
    data['Log ID']=data['Log ID']||genUID_('LOG');
    data['Staff Member']=name;
    data['Staff Email']=email;
    data['Timestamp']=now;
    var result=appendToSheet_('Contact Logs',data);
    logAudit_('Communication Logged',data['Client ID'],'Contact Log',data['Log ID'],
      data['Communication Type']+' — '+data['Subject'],'Employee');
    return {success:true,logId:data['Log ID'],result:result};
  } catch(e) { return {success:false,error:e.message}; }
}

function getCommLogs(clientId) {
  try {
    var ss=SpreadsheetApp.getActiveSpreadsheet();
    var sheet=ss.getSheetByName('Contact Logs');
    if (!sheet||sheet.getLastRow()<2) return [];
    var headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
    var data=sheet.getRange(2,1,sheet.getLastRow()-1,sheet.getLastColumn()).getValues();
    var rows=data.map(function(row){var obj={};headers.forEach(function(h,i){obj[h]=row[i];});return obj;});
    return clientId?rows.filter(function(r){return r['Client ID']===clientId;}):rows;
  } catch(e) { return []; }
}

// ── SAVE NOTE ─────────────────────────────────────────────────────────────────
function saveNote(data) {
  try {
    var email=getCurrentUser();
    var emp=getEmployeesFromSheet().find(function(e){return e.email===email;});
    var name=emp?(emp.name||email):email;
    var now=new Date().toLocaleString('en-US');
    data['Note ID']=data['Note ID']||genUID_('NOTE');
    data['Staff']=name; data['Staff Email']=email; data['Timestamp']=now;
    var result=appendToSheet_('Notes',data);
    logAudit_('Note Added',data['Client ID'],'Note',data['Note ID'],
      name+' added a note on '+now,'Employee');
    return {success:true,noteId:data['Note ID'],result:result};
  } catch(e) { return {success:false,error:e.message}; }
}

function getNotes(clientId) {
  try {
    var ss=SpreadsheetApp.getActiveSpreadsheet();
    var sheet=ss.getSheetByName('Notes');
    if (!sheet||sheet.getLastRow()<2) return [];
    var headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
    var data=sheet.getRange(2,1,sheet.getLastRow()-1,sheet.getLastColumn()).getValues();
    var rows=data.map(function(row){var obj={};headers.forEach(function(h,i){obj[h]=row[i];});return obj;});
    return clientId?rows.filter(function(r){return r['Client ID']===clientId;}):rows;
  } catch(e) { return []; }
}

// ── SAVE COMPLIANCE ITEM ──────────────────────────────────────────────────────
function saveCompliance(data) {
  try {
    var email=getCurrentUser();
    var emp=getEmployeesFromSheet().find(function(e){return e.email===email;});
    var name=emp?(emp.name||email):email;
    var now=new Date().toLocaleString('en-US');
    var isNew=!data['Compliance ID'];
    if (isNew) data['Compliance ID']=genUID_('COMP');
    data['Created By']=data['Created By']||name;
    data['Created At']=data['Created At']||now;
    // Auto-detect status from expiration date
    if (data['Expiration Date']) {
      var exp=new Date(data['Expiration Date']);
      var today=new Date(); today.setHours(0,0,0,0);
      var diff=Math.floor((exp-today)/(1000*60*60*24));
      if (diff<0)       data['Status']='Expired';
      else if (diff<=7) data['Status']='Expiring Soon';
      else if (diff<=30)data['Status']='Expiring Soon';
      else              data['Status']=data['Status']||'Active';
    }
    var result=isNew?appendToSheet_('Compliance',data):updateSheetRow_('Compliance','Compliance ID',data['Compliance ID'],data);
    logAudit_(isNew?'Compliance Added':'Compliance Updated',data['Client ID'],'Compliance',data['Compliance ID'],
      data['Item Name']+' — status: '+data['Status'],'Employee');
    return {success:true,compId:data['Compliance ID'],result:result};
  } catch(e) { return {success:false,error:e.message}; }
}

function getCompliance(clientId) {
  try {
    var ss=SpreadsheetApp.getActiveSpreadsheet();
    var sheet=ss.getSheetByName('Compliance');
    if (!sheet||sheet.getLastRow()<2) return [];
    var headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
    var data=sheet.getRange(2,1,sheet.getLastRow()-1,sheet.getLastColumn()).getValues();
    var rows=data.map(function(row){var obj={};headers.forEach(function(h,i){obj[h]=row[i];});return obj;});
    return clientId?rows.filter(function(r){return r['Client ID']===clientId;}):rows;
  } catch(e) { return []; }
}

// ── SAVE CLIENT TASK ──────────────────────────────────────────────────────────
function saveClientTask(data) {
  try {
    var email=getCurrentUser();
    var emp=getEmployeesFromSheet().find(function(e){return e.email===email;});
    var name=emp?(emp.name||email):email;
    var now=new Date().toLocaleString('en-US');
    data['Task ID']=data['Task ID']||genUID_('TSK');
    data['Created By']=name; data['Created At']=now;
    var result=appendToSheet_('Client Tasks',data);
    logAudit_('Task Added',data['Client ID'],'Task',data['Task ID'],data['Task Name'],'Employee');
    return {success:true,taskId:data['Task ID'],result:result};
  } catch(e) { return {success:false,error:e.message}; }
}

function getClientTasks(clientId) {
  try {
    var ss=SpreadsheetApp.getActiveSpreadsheet();
    var sheet=ss.getSheetByName('Client Tasks');
    if (!sheet||sheet.getLastRow()<2) return [];
    var headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
    var data=sheet.getRange(2,1,sheet.getLastRow()-1,sheet.getLastColumn()).getValues();
    var rows=data.map(function(row){var obj={};headers.forEach(function(h,i){obj[h]=row[i];});return obj;});
    return clientId?rows.filter(function(r){return r['Client ID']===clientId;}):rows;
  } catch(e) { return []; }
}

// ── PORTAL DASHBOARD STATS ────────────────────────────────────────────────────
function getPortalDashboard() {
  try {
    var clients=getClients();
    var invoices=getInvoices(null);
    var compliance=getCompliance(null);
    var commLogs=getCommLogs(null);
    var today=new Date(); today.setHours(0,0,0,0);
    var totalRevenue=0, outstanding=0, overdue=0;
    invoices.forEach(function(inv){
      var total=parseFloat(inv['Total'])||0;
      var paid=parseFloat(inv['Amount Paid'])||0;
      totalRevenue+=paid;
      outstanding+=total-paid;
      if (inv['Status']==='Overdue') overdue++;
    });
    var expiring=compliance.filter(function(c){return c['Status']==='Expiring Soon';}).length;
    var expired=compliance.filter(function(c){return c['Status']==='Expired';}).length;
    var followUps=clients.filter(function(cl){
      if (!cl['Follow-Up Date']) return false;
      var fd=new Date(cl['Follow-Up Date']); fd.setHours(0,0,0,0);
      return fd<=today;
    }).length;
    return {
      success:true,
      totalClients:clients.length,
      totalRevenue:totalRevenue,
      outstanding:outstanding,
      overdueInvoices:overdue,
      expiringCompliance:expiring,
      expiredCompliance:expired,
      followUpsDue:followUps,
      recentComm:commLogs.slice(-5).reverse(),
      generated:new Date().toLocaleString('en-US')
    };
  } catch(e) { return {success:false,error:e.message}; }
}

// ── SEND COMPLIANCE REMINDERS ─────────────────────────────────────────────────
// This should be set as a time-based trigger in Apps Script
// Triggers → sendComplianceReminders → Time-driven → Day timer → 9-10am
function sendComplianceReminders() {
  try {
    var ss=SpreadsheetApp.getActiveSpreadsheet();
    var compSheet=ss.getSheetByName('Compliance');
    if (!compSheet||compSheet.getLastRow()<2) return 'NO COMPLIANCE DATA';
    var headers=compSheet.getRange(1,1,1,compSheet.getLastColumn()).getValues()[0];
    var data=compSheet.getRange(2,1,compSheet.getLastRow()-1,compSheet.getLastColumn()).getValues();
    var clients=getClients();
    var today=new Date(); today.setHours(0,0,0,0);
    var sent=0;
    for (var i=0;i<data.length;i++) {
      var row=data[i];
      var obj={};
      headers.forEach(function(h,idx){obj[h]=row[idx];});
      if (!obj['Expiration Date']||obj['Status']==='Expired') continue;
      var exp=new Date(obj['Expiration Date']); exp.setHours(0,0,0,0);
      var diff=Math.floor((exp-today)/(1000*60*60*24));
      var triggerAt=[30,14,7,0];
      if (triggerAt.indexOf(diff)<0 && diff!==-1) continue;
      // Find client email
      var client=clients.find(function(c){return c['Client ID']===obj['Client ID'];});
      if (!client||!client['Email']) continue;
      var subject='Action Required: '+obj['Item Name']+' expires in '+(diff>0?diff+' days':'TODAY');
      var nl='\n';
      var body='Dear '+client['Full Name']+','+nl+nl
        +'This is a reminder that your compliance item requires attention:'+nl+nl
        +'Business: '+client['Business Name']+nl
        +'Item: '+obj['Item Name']+nl
        +'Type: '+obj['Item Type']+nl
        +'Expiration Date: '+obj['Expiration Date']+nl
        +(diff<=0?'STATUS: OVERDUE - Immediate action required.'+nl:'Days Remaining: '+diff+nl)
        +nl+'Please contact JOSS Consulting Group immediately to handle your renewal.'+nl+nl
        +'JOSS Consulting Group'+nl
        +'info@jossconsultinggroup.com'+nl
        +'jossconsultinggroup.com';
      try {
        MailApp.sendEmail(client['Email'],subject,body);
        var reminderData={
          'Reminder ID':genUID_('REM'),
          'Compliance ID':obj['Compliance ID'],
          'Client ID':obj['Client ID'],
          'Client Name':client['Full Name'],
          'Item Name':obj['Item Name'],
          'Expiration Date':obj['Expiration Date'],
          'Days Until Expiry':diff,
          'Date Sent':new Date().toLocaleString('en-US'),
          'Sent To':client['Email'],
          'Sent By':'System',
          'Delivery Status':'Sent',
          'Notes':'Auto-triggered reminder'
        };
        appendToSheet_('Reminder Logs',reminderData);
        // Update last reminder on compliance record
        var compIdCol=headers.indexOf('Compliance ID');
        var lastRemCol=headers.indexOf('Last Reminder Sent');
        if (lastRemCol>-1 && compIdCol>-1 && String(data[i][compIdCol])===obj['Compliance ID']) {
          compSheet.getRange(i+2,lastRemCol+1).setValue(new Date().toLocaleString('en-US'));
        }
        logAudit_('Reminder Sent',obj['Client ID'],'Compliance',obj['Compliance ID'],
          'Auto reminder sent to '+client['Email']+' — '+diff+' days to expiry','System');
        sent++;
      } catch(mailErr) {}
    }
    SpreadsheetApp.flush();
    return 'REMINDERS SENT: '+sent;
  } catch(e) { return 'ERROR: '+e.message; }
}

// ── UPDATE SHEET ROW ──────────────────────────────────────────────────────────
function updateSheetRow_(sheetName, keyCol, keyVal, data) {
  try {
    var ss=SpreadsheetApp.getActiveSpreadsheet();
    var sheet=ss.getSheetByName(sheetName);
    if (!sheet||sheet.getLastRow()<2) return appendToSheet_(sheetName,data);
    var headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
    var ki=headers.indexOf(keyCol);
    if (ki<0) return appendToSheet_(sheetName,data);
    var col=sheet.getRange(2,ki+1,sheet.getLastRow()-1,1).getValues();
    for (var i=0;i<col.length;i++) {
      if (String(col[i][0])===String(keyVal)) {
        // Ensure new columns exist
        Object.keys(data).forEach(function(k){
          if (headers.indexOf(k)===-1){
            sheet.getRange(1,sheet.getLastColumn()+1).setValue(k);
            headers.push(k);
          }
        });
        // Write updated values
        var row=headers.map(function(h){return data[h]!==undefined?data[h]:sheet.getRange(i+2,headers.indexOf(h)+1).getValue();});
        sheet.getRange(i+2,1,1,row.length).setValues([row]);
        SpreadsheetApp.flush();
        return 'UPDATED ROW '+(i+2);
      }
    }
    return appendToSheet_(sheetName,data);
  } catch(e) { return 'ERROR: '+e.message; }
}

// ── SETUP PORTAL SHEETS ───────────────────────────────────────────────────────
function setupPortalSheets() {
  var ss=SpreadsheetApp.getActiveSpreadsheet();
  createSheet_(ss,'Clients',['Client ID','Full Name','Email','Phone / Handle','Business Name','Business Type','State','Business Address','Service','Amount Paid','Status','Follow-Up Date','Source','Notes','Internal Notes','Created By','Created At','Updated By','Updated At','Employee Email','Employee ID']);
  createSheet_(ss,'Invoices',['Invoice #','Client ID','Client Name','Business Name','Service Description','Quantity','Price','Subtotal','Tax','Total','Amount Paid','Balance Due','Due Date','Status','Date Created','Created By','Created At','Updated By','Updated At','Employee Email']);
  createSheet_(ss,'Payments',['Payment ID','Invoice #','Client ID','Payment Date','Amount Paid','Payment Method','Reference Number','Notes','Receipt Link','Created By','Created At','Employee Email']);
  createSheet_(ss,'Contact Logs',['Log ID','Client ID','Date / Time','Communication Type','Direction','Subject','Summary / Notes','Follow-Up Needed','Follow-Up Date','Staff Member','Staff Email','Timestamp','Created By','Created At']);
  createSheet_(ss,'Notes',['Note ID','Client ID','Date','Note','Staff','Staff Email','Timestamp','Created By','Created At']);
  createSheet_(ss,'Compliance',['Compliance ID','Client ID','Item Type','Item Name','Issuing Authority','Issue Date','Expiration Date','Renewal Required','Renewal Frequency','Status','Notes','Document Link','Last Reminder Sent','Reminder Status','Created By','Created At','Timestamp']);
  createSheet_(ss,'Client Tasks',['Task ID','Client ID','Task Name','Description','Assigned To','Priority','Status','Due Date','Completed At','Created By','Created At']);
  createSheet_(ss,'Reminder Logs',['Reminder ID','Compliance ID','Client ID','Client Name','Item Name','Expiration Date','Days Until Expiry','Date Sent','Sent To','Sent By','Delivery Status','Notes']);
  createSheet_(ss,'Audit Trail',['Audit ID','Date Time','Employee Name','Employee Email','Action Type','Client ID','Record Type','Record ID','Description','Source']);
  return 'PORTAL SHEETS SETUP COMPLETE';
}

function testSaveClient() { return appendToSheet_('Clients',{'Timestamp':new Date(),'Employee ID':'TEST','Employee Email':'test@joss.com','Full Name':'Test Client','Email':'test@email.com','Phone / Handle':'123','Business Name':'Test LLC','Business Type':'LLC','State':'FL','Business Address':'Test','Service':'Core','Amount Paid':'197','Status':'Lead','Follow-Up Date':'','Source':'Test','Notes':'Test row','Internal Notes':'OK'}); }
