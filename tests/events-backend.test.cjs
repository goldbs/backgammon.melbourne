const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const crypto = require('node:crypto');
const source = fs.readFileSync(require('node:path').join(__dirname, '../apps-script/Code.gs'), 'utf8');
const NOW = Date.parse('2026-10-25T00:00:00Z');
class Clock extends Date { constructor(...args) { super(...(args.length ? args : [NOW])); } static now() { return NOW; } }
class Sheet {
  constructor(rows = []) { this.rows = rows; }
  getDataRange() { return { getValues: () => this.rows.map(row => [...row]) }; }
  appendRow(row) { this.rows.push([...row]); }
  getLastRow() { return this.rows.length; }
  getRange(row, col) { return {
    setValue: value => { this.rows[row - 1][col - 1] = value; },
    setValues: values => values.forEach((items, i) => items.forEach((value, j) => { this.rows[row - 1 + i][col - 1 + j] = value; }))
  }; }
}
function fixture() {
  const sheets = { Members: new Sheet([['Date', 'Name', 'Email', 'Phone', 'Status'], [new Date(NOW), 'Test Member', 'member@example.com', '', 'Active']]), Sheet1: new Sheet([['Date', 'P1', 'P2', 'S1', 'S2', 'PR1', 'PR2', 'Length', 'Format', 'MatchID', 'Status']]) };
  const ss = { getSheetByName: name => sheets[name] || null, insertSheet: name => (sheets[name] = new Sheet()), getSheets: () => [sheets.Sheet1] };
  const mail = []; let locked = false; let failMail = false;
  const context = vm.createContext({ Date: Clock, console,
    SpreadsheetApp: { getActiveSpreadsheet: () => ss },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: text => ({ text, setMimeType() { return this; } }) },
    HtmlService: { createHtmlOutput: html => ({ html }) },
    LockService: { getScriptLock: () => ({ waitLock: () => { assert.equal(locked, false); locked = true; }, releaseLock: () => { locked = false; } }) },
    MailApp: { getRemainingDailyQuota: () => 100, sendEmail: message => { if (failMail) throw Error('Mail unavailable'); mail.push(message); } },
    Utilities: {
      getUuid: () => crypto.randomUUID(), DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (_, text) => [...crypto.createHash('sha256').update(text).digest()],
      formatDate: (date, zone, pattern) => {
        const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date).map(p => [p.type, p.value]));
        if (pattern === "yyyy") return parts.year;
        if (pattern === "MM") return parts.month;
        return pattern === "yyyy-MM-dd'T'HH:mm" ? `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}` : date.toISOString();
      }
    }
  });
  vm.runInContext(source, context);
  const post = payload => JSON.parse(context.doPost({ postData: { contents: JSON.stringify(payload) } }).text);
  const get = () => JSON.parse(context.doGet({ parameter: {} }).text);
  const event = { action: 'submitEvent', memberEmail: 'member@example.com', title: 'Sunday chouette', venue: 'Test venue', address: '1 Test St, Melbourne VIC', startsAt: '2026-11-01T18:00', endsAt: '2026-11-01T21:00', format: 'Chouette', description: 'All welcome', timeZone: 'Australia/Melbourne' };
  return { context, sheets, mail, post, get, event, configureMembership: patch => vm.runInContext("Object.assign(MEMBERSHIP_SETTINGS_, " + JSON.stringify(patch) + ")", context), failMail: () => { failMail = true; }, unlocked: () => !locked };
}

test('public event submissions are rejected for members and non-members without writes or email', () => {
  for (const email of ['member@example.com','unknown@example.com']) {
    const f=fixture();const before=JSON.stringify(f.sheets);
    const response=f.post({...f.event,memberEmail:email});
    assert.equal(response.status,'error');assert.match(response.error,/managed by the association/);
    assert.equal(JSON.stringify(f.sheets),before);assert.equal(f.mail.length,0);
  }
});

test('old confirmation links cannot publish pending events or change existing records', () => {
  const f=fixture();
  f.sheets.Events=new Sheet([['Created','EventID','Email','Title','Venue','Address','Start','End','Format','Description','Status'],[new Date(NOW),'evt_old','member@example.com','Old pending event','Venue','Address',new Date(NOW+86400000),new Date(NOW+90000000),'Casual','','pending']]);
  const before=JSON.stringify(f.sheets.Events.rows);
  const response=f.context.doGet({parameter:{action:'verifyEvent',eventId:'evt_old',token:'old-token'}});
  assert.match(response.html,/cannot publish an event/);
  assert.equal(JSON.stringify(f.sheets.Events.rows),before);assert.equal(f.mail.length,0);
});

test('legacy confirmed member events are not automatically republished in association-only listings', () => {
  const f=fixture();f.sheets.Events=new Sheet([['Legacy events'],[new Date(NOW),'evt_old','private@example.com','Legacy event','','',new Date(NOW+86400000),new Date(NOW+90000000),'','','confirmed']]);
  const data=f.get();assert.deepEqual(data.events,[]);assert.equal(data.eventSubmissionsOpen,false);
  assert.ok(!JSON.stringify(data).includes('private@example.com'));assert.equal(f.sheets.Events.rows.length,2);
});

test('existing match submission, verification, public feed and member registration remain available', () => {
  const f = fixture();
  assert.equal(f.post({ action: 'registerMember', fullName: 'Second Member', email: 'second@example.com', phone: '123' }).status, 'success');
  assert.equal(f.post({ action: 'registerMember', fullName: 'Second Member', email: 'second@example.com', phone: '123' }).status, 'exists');
  const result = f.post({ action: 'submitMatch', player1: 'Test Member', player2: 'Second Member', score1: 5, score2: 2, format: 'Casual' });
  assert.equal(result.initialStatus, 'Pending'); assert.equal(f.mail.length, 2); assert.equal(f.get().matches.length, 0);
  const matchId = f.sheets.Sheet1.rows[1][9];
  f.context.doGet({ parameter: { action: 'verifyMatch', matchId, decision: 'confirm' } });
  assert.equal(f.get().matches.length, 1); assert.equal(f.get().members.length, 2); assert.deepEqual(f.get().events, []);
});

test('unknown POST action cannot write an accidental match', () => {
  const f = fixture(); assert.equal(f.post({ action: 'typo' }).status, 'error'); assert.equal(f.sheets.Sheet1.rows.length, 1);
});

const application = {
  action: 'registerMember', membershipType: 'association', fullName: 'New Applicant', email: 'new@example.com',
  phone: '0400000000', noticeAddress: '1 Test Street\nMelbourne VIC 3000', ageCategory: '18plus',
  rulesAgreement: true, signatureAgreement: true, rulesVersion: 'mba-model-rules-proposed-2026-12-01-v1'
};

test('monthly membership fee includes the joining month, rounds to the nearest five dollars, and uses Melbourne dates', () => {
  const f = fixture();
  const amounts = [10000, 9000, 8500, 7500, 6500, 6000, 5000, 4000, 3500, 2500, 1500, 1000];
  for (let month = 1; month <= 12; month++) {
    const quote = f.context.membershipQuote_(new Date(`2026-${String(month).padStart(2, '0')}-15T00:00:00Z`));
    assert.equal(quote.feeCents, amounts[month - 1]); assert.equal(quote.joiningMonth, month);
  }
  assert.equal(f.context.membershipQuote_(new Date('2026-11-30T12:59:59Z')).feeCents, 1500);
  assert.equal(f.context.membershipQuote_(new Date('2026-11-30T13:00:00Z')).feeCents, 1000);
  const renewal = f.context.membershipQuote_(new Date('2026-12-31T13:00:00Z'));
  assert.equal(renewal.feeCents, 10000); assert.equal(renewal.membershipYear, 2027); assert.equal(renewal.renewalDate, '2028-01-01');
});

test('association interest also creates community participation but no admission, payment or email', () => {
  const f = fixture(); const response = f.post({ ...application, feeCents: 1, status: 'admitted', paymentReceivedAt: 'today' });
  assert.equal(response.status, 'application_received'); assert.equal(response.applicationState, 'preincorporation_interest');
  assert.equal(response.quote.feeCents, 2500); assert.equal(response.paymentInstructionsAvailable, false);
  assert.equal(f.sheets.Members.rows.length, 3); assert.equal(f.sheets.MembershipApplications.rows.length, 2);
  const row = f.sheets.MembershipApplications.rows[1];
  assert.equal(row[8], application.rulesVersion); assert.equal(row[9], true); assert.equal(row[10], application.fullName); assert.equal(row[11], true);
  assert.deepEqual(row.slice(16), ['', '', '']); assert.equal(f.mail.length, 0); assert.ok(f.unlocked());
  const publicData = JSON.stringify(f.get());
  for (const privateValue of [application.email, application.noticeAddress, response.applicationId, response.paymentReference]) assert.ok(!publicData.includes(privateValue));
});

test('existing community users can express interest repeatedly without duplicate records or overwriting their registration', () => {
  const f = fixture(); const payload = { ...application, email: 'member@example.com' };
  const first = f.post(payload), second = f.post(payload);
  assert.equal(second.applicationId, first.applicationId); assert.equal(second.paymentReference, first.paymentReference);
  assert.equal(f.sheets.Members.rows.length, 2); assert.equal(f.sheets.Members.rows[1][1], 'Test Member');
  assert.equal(f.sheets.MembershipApplications.rows.length, 2);
});

test('rules consent, signature intent, version and complete application are required before any registration writes', () => {
  for (const patch of [{rulesAgreement:false}, {signatureAgreement:false}, {rulesVersion:'old'}, {noticeAddress:''}, {ageCategory:'invalid'}, {fullName:' '}, {email:'bad'}]) {
    const f = fixture(); assert.equal(f.post({...application,...patch}).status, 'error', JSON.stringify(patch));
    assert.equal(f.sheets.Members.rows.length, 2); assert.equal(f.sheets.MembershipApplications, undefined);
  }
});

test('community-only registration needs no association consent and leaves application records untouched', () => {
  const f = fixture();
  assert.equal(f.post({ action: 'registerMember', fullName: 'Community Player', email: 'community@example.com', phone: '123' }).status, 'success');
  assert.equal(f.sheets.MembershipApplications, undefined); assert.equal(f.get().members.includes('Community Player'), true);
});

test('opening applications requires adopted rules; opening alone never admits a member', () => {
  const f = fixture(); f.configureMembership({ applicationsOpen: true });
  assert.equal(f.get().registration.associationApplicationsOpen, false);
  f.configureMembership({ rulesAdopted: true });
  const response = f.post(application);
  assert.equal(response.applicationState, 'pending_committee'); assert.equal(response.paymentInstructionsAvailable, false);
  assert.deepEqual(f.sheets.MembershipApplications.rows[1].slice(16), ['', '', '']);
});

test('fresh consent can promote recorded interest to a formal pending application once rules are adopted', () => {
  const f = fixture(); const initial = f.post(application);
  f.configureMembership({ applicationsOpen: true, rulesAdopted: true, rulesVersion: 'adopted-v1' });
  assert.equal(f.post(application).status, 'error');
  const updated = f.post({ ...application, rulesVersion: 'adopted-v1' });
  assert.equal(updated.applicationState, 'pending_committee'); assert.equal(updated.applicationId, initial.applicationId);
  assert.equal(f.sheets.MembershipApplications.rows.length, 2); assert.equal(f.sheets.MembershipApplications.rows[1][8], 'adopted-v1');
});

test('payment is requested only after a recorded committee approval; admission fields remain untouched', () => {
  const f = fixture(); f.configureMembership({ applicationsOpen:true, rulesAdopted:true, bankAccount:{accountName:'Test association',bsb:'123-456',accountNumber:'12345678', privateExtra:'not-public'} });
  const response = f.post(application);
  assert.equal(response.applicationState, 'pending_committee');
  assert.equal(response.paymentInstructionsAvailable, false);
  assert.equal(f.get().registration.bankAccount.accountName, 'Test association'); assert.ok(!JSON.stringify(f.get()).includes('not-public'));
  const row = f.sheets.MembershipApplications.rows[1];
  row[14] = 'approved_awaiting_payment';
  assert.equal(f.post(application).paymentInstructionsAvailable, false);
  row[17] = new Date(NOW);
  assert.equal(f.post(application).paymentInstructionsAvailable, true);
  row[14] = 'admitted'; row[17] = 'committee decision'; row[18] = 'admission date';
  const duplicate = f.post(application); assert.equal(duplicate.applicationState, 'admitted'); assert.equal(duplicate.paymentInstructionsAvailable, false);
  assert.equal(row[17], 'committee decision'); assert.equal(row[18], 'admission date');
  f.configureMembership({bankAccount:{accountName:'Incomplete'}}); assert.equal(f.get().registration.bankAccount,null);
});

test('inactive community registration cannot be reactivated through an association application', () => {
  const f = fixture(); f.sheets.Members.rows[1][4]='Inactive';
  assert.equal(f.post({...application,email:'member@example.com'}).status,'error'); assert.equal(f.sheets.MembershipApplications,undefined);
});
