const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyOBLAPmwyTMyJUbDHj6OCKZmOJmqkwvLdQRXVOLb2WqVkNgnlA5NmqATBTfrZjXvth/exec";

function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (e && e.parameter && e.parameter.action === 'confirmMatch') return confirmMatch_(ss, e.parameter);
    const data = JSON.parse(e.postData.contents);
    
    if (data.action === "submitEvent") return eventJson_({ status: "error", error: "Event submissions are closed. Events are managed by the association." });

    if (data.action === "registerMember") return registerMbaParticipant_(ss, data);

    if (data.action !== "submitMatch") return eventJson_({ status: "error", error: "Unknown action." });

    return submitVerifiedMatch_(ss, data);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (e && e.parameter && e.parameter.action === "verifyEvent") {
    return HtmlService.createHtmlOutput('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Association events</title></head><body><h1>Event submissions are closed</h1><p>Events are managed by Melbourne Backgammon Association. This confirmation link cannot publish an event.</p><a href="https://backgammon.melbourne/#events">View association events</a></body></html>');
  }

  if (e && e.parameter && e.parameter.action === 'verifyMatch') return reviewMatch_(ss, e.parameter);

  // 2. Fetch Confirmed Matches (Pending matches are excluded from leaderboard calculations)
  const matchSheet = ss.getSheetByName("Sheet1") || ss.getSheets()[0];
  const matchRows = matchSheet.getDataRange().getValues();
  const matches = [];
  let approvalRows = [];
  try { const sheet = matchApprovalSheet_(ss, false); approvalRows = sheet ? sheet.getDataRange().getValues().slice(1) : []; } catch (_) { /* New matches fail closed if the proof ledger is unavailable. */ }

  for (let i = 1; i < matchRows.length; i++) {
    const r = matchRows[i];
    if (r[1] && r[2] && approvedMatchForFeed_(r, approvalRows) && (!String(r[9]).startsWith("m2_") || matchRows.filter(row => row[9] === r[9]).length === 1)) {
      matches.push({
        date: r[0],
        player1: r[1],
        player2: r[2],
        score1: r[3],
        score2: r[4],
        pr1: r[5],
        pr2: r[6],
        matchLength: r[7],
        format: r[8]
      });
    }
  }

  // 3. Fetch Active Members (Emails & phones kept private)
  const memberSheet = ss.getSheetByName("Members");
  const members = [];
  if (memberSheet) {
    const memberRows = memberSheet.getDataRange().getValues();
    for (let j = 1; j < memberRows.length; j++) {
      const name = (memberRows[j][1] || "").toString().trim();
      const status = (memberRows[j][4] || "Active").toString().trim();
      if (name && status.toLowerCase() !== "inactive") {
        members.push(name);
      }
    }
  }

  return ContentService.createTextOutput(JSON.stringify({ matches, members, events: [], eventsVersion: 1, eventSubmissionsOpen: false, matchConfirmationVersion: 2, registration: publicMembershipSettings_() }))
    .setMimeType(ContentService.MimeType.JSON);
}

// Shared registration helpers. Event publishing is maintained in the website source.
const EVENT_TIME_ZONE_ = "Australia/Melbourne";

function eventJson_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

function eventText_(value, label, max, optional) {
  if (typeof value !== "string") {
    if (optional && value == null) return "";
    throw new Error(label + " is required.");
  }
  const text = value.trim();
  if ((!optional && !text) || text.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) {
    throw new Error("Check " + label.toLowerCase() + ".");
  }
  if (label !== "Description" && /[\r\n\t]/.test(text)) throw new Error("Check " + label.toLowerCase() + ".");
  return text;
}

function eventSheetText_(value) {
  // Prevent untrusted strings from being evaluated as spreadsheet formulas.
  return /^[=+\-@\t\r]/.test(value) ? "'" + value : value;
}

// Enable formal applications only after incorporation/rules adoption is resolved.
// Bank details, once supplied, are public payment instructions, not secrets.
const MEMBERSHIP_SETTINGS_ = {
  applicationsOpen: false,
  rulesAdopted: false,
  rulesVersion: "mba-model-rules-proposed-2026-12-01-v1",
  rulesUrl: "https://backgammon.melbourne/docs/proposed-association-rules.html",
  bankAccount: null
};
const MEMBERSHIP_APPLICATION_HEADERS_ = [
  "ReceivedAt", "ApplicationID", "MembershipYear", "FullName", "Email", "Phone", "NoticeAddress", "AgeCategory",
  "RulesVersion", "RulesAgreement", "ElectronicSignature", "SignatureAgreement", "QuotedFeeCents", "JoiningMonth",
  "Status", "PaymentReference", "PaymentReceivedAt", "CommitteeResolutionDate", "AdmittedAt"
];

function publicMembershipSettings_() {
  return {
    version: 1,
    associationApplicationsOpen: MEMBERSHIP_SETTINGS_.applicationsOpen && MEMBERSHIP_SETTINGS_.rulesAdopted,
    rulesAdopted: MEMBERSHIP_SETTINGS_.rulesAdopted,
    rulesVersion: MEMBERSHIP_SETTINGS_.rulesVersion,
    rulesUrl: MEMBERSHIP_SETTINGS_.rulesUrl,
    annualFeeCents: 10000,
    bankAccount: membershipBank_()
  };
}

function membershipBank_() {
  const bank = MEMBERSHIP_SETTINGS_.bankAccount;
  if (!bank || typeof bank.accountName !== "string" || !bank.accountName.trim() ||
      !/^\d{3}-?\d{3}$/.test(String(bank.bsb || "")) || !/^\d{4,12}$/.test(String(bank.accountNumber || ""))) return null;
  return { accountName: bank.accountName.trim(), bsb: String(bank.bsb), accountNumber: String(bank.accountNumber) };
}

function membershipQuote_(date) {
  const year = Number(Utilities.formatDate(date, EVENT_TIME_ZONE_, "yyyy"));
  const joiningMonth = Number(Utilities.formatDate(date, EVENT_TIME_ZONE_, "MM"));
  return { membershipYear: year, joiningMonth: joiningMonth,
    feeCents: Math.round(10000 * (13 - joiningMonth) / 12 / 500) * 500, renewalDate: (year + 1) + "-01-01" };
}

function membershipApplicationSheet_(ss) {
  let sheet = ss.getSheetByName("MembershipApplications");
  if (!sheet) {
    sheet = ss.insertSheet("MembershipApplications");
    sheet.appendRow(MEMBERSHIP_APPLICATION_HEADERS_);
  } else {
    const header = sheet.getDataRange().getValues()[0] || [];
    if (!MEMBERSHIP_APPLICATION_HEADERS_.every((name, index) => header[index] === name)) {
      throw new Error("Membership applications are temporarily unavailable. Please contact the secretary.");
    }
  }
  return sheet;
}

function registerMbaParticipant_(ss, data) {
  const type = data.membershipType == null ? "community" : data.membershipType;
  if (!["community", "association"].includes(type)) throw new Error("Choose a valid membership option.");
  const name = eventText_(data.fullName, "Full name", 120);
  const email = eventText_(data.email, "Email address", 254).toLowerCase();
  const phone = eventText_(data.phone, "Phone number", 40);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Check your email address.");
  let address = "";
  if (type === "association") {
    // Postal addresses may span lines; they remain private application data.
    address = eventText_(data.noticeAddress, "Description", 300);
    if (!["under15", "15to17", "18plus"].includes(data.ageCategory)) throw new Error("Choose an age category.");
    if (data.rulesAgreement !== true || data.signatureAgreement !== true) {
      throw new Error("Read the rules and confirm your agreement and electronic signature.");
    }
    if (data.rulesVersion !== MEMBERSHIP_SETTINGS_.rulesVersion) {
      throw new Error("The rules reference has changed. Review it and agree again before submitting.");
    }
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    let members = ss.getSheetByName("Members");
    const memberRows = members ? members.getDataRange().getValues() : [];
    const existing = memberRows.slice(1).find(row => String(row[2] || "").trim().toLowerCase() === email);
    if (existing && String(existing[4] || "Active").trim().toLowerCase() === "inactive") {
      throw new Error("Please contact the committee about your existing registration.");
    }
    const now = new Date();
    const quote = membershipQuote_(now);
    let applications = null;
    let previous = null;
    let previousRowNumber = null;
    if (type === "association") {
      applications = membershipApplicationSheet_(ss);
      const applicationRows = applications.getDataRange().getValues();
      const previousIndex = applicationRows.findIndex((row, index) => index > 0 &&
        row[4] === email && Number(row[2]) === quote.membershipYear &&
        ["preincorporation_interest", "pending_committee", "pending_admission", "approved_awaiting_payment", "admitted"].includes(row[14]));
      previous = applicationRows[previousIndex] || null;
      previousRowNumber = previousIndex > 0 ? previousIndex + 1 : null;
    }
    // Both choices include community participation. It is never paid admission.
    if (!members) members = ss.insertSheet("Members");
    if (members.getLastRow() === 0) members.appendRow(["Date", "Name", "Email", "Phone", "Status"]);
    if (!existing) members.appendRow([now, eventSheetText_(name), email, eventSheetText_(phone), "Active"]);
    if (type === "community") {
      return eventJson_({ status: existing ? "exists" : "success", membershipType: "community" });
    }
    const settings = publicMembershipSettings_();
    if (previous && previous[14] !== "preincorporation_interest") {
      // Keep the original formal application or admitted record on repeated requests.
      return eventJson_({ status: "application_received", membershipType: "association", applicationId: previous[1],
        applicationState: previous[14], paymentReference: previous[15], quote: {
          membershipYear: Number(previous[2]), joiningMonth: Number(previous[13]), feeCents: Number(previous[12]),
          renewalDate: (Number(previous[2]) + 1) + "-01-01"
        }, paymentInstructionsAvailable: settings.associationApplicationsOpen && previous[14] === "approved_awaiting_payment" && Number.isFinite(new Date(previous[17]).getTime()) && new Date(previous[17]) <= now && !!settings.bankAccount });
    }
    const id = previous ? previous[1] : "mba_" + Utilities.getUuid();
    const reference = previous ? previous[15] : "MBA" + quote.membershipYear + "-" + id.replace(/[^a-zA-Z0-9]/g, "").slice(-12).toUpperCase();
    const state = settings.associationApplicationsOpen ? "pending_committee" : "preincorporation_interest";
    const applicationRow = [
      now, id, quote.membershipYear, eventSheetText_(name), email, eventSheetText_(phone), eventSheetText_(address),
      data.ageCategory, data.rulesVersion, true, eventSheetText_(name), true, quote.feeCents, quote.joiningMonth,
      state, reference, "", "", ""
    ];
    // A fresh request can turn pre-incorporation interest into a signed formal
    // application only after adoption/opening. It never turns into admission.
    if (previousRowNumber) applications.getRange(previousRowNumber, 1, 1, MEMBERSHIP_APPLICATION_HEADERS_.length).setValues([applicationRow]);
    else applications.appendRow(applicationRow);
    return eventJson_({ status: "application_received", membershipType: "association", applicationId: id,
      applicationState: state, paymentReference: reference, quote: quote,
      paymentInstructionsAvailable: false });
  } finally {
    lock.releaseLock();
  }
}

// Independent email approvals for new matches. Confirmation secrets stay private.
const MATCH_APPROVAL_HEADERS_ = ['MatchID', 'Player1TokenHash', 'Player2TokenHash', 'Player1ConfirmedAt', 'Player2ConfirmedAt', 'ExpiresAt', 'PayloadHash', 'EmailState', 'RequestID'];

function matchHash_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value), Utilities.Charset.UTF_8)
    .map(byte => ('0' + ((byte + 256) % 256).toString(16)).slice(-2)).join('');
}
function matchHtml_(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
function matchPayloadHash_(row) { return matchHash_(JSON.stringify(row.slice(1, 9).map(value => String(value == null ? '' : value)))); }
function matchApprovalSheet_(ss, create) {
  let sheet = ss.getSheetByName('MatchConfirmations');
  if (!sheet && create) sheet = ss.insertSheet('MatchConfirmations');
  if (!sheet) return null;
  if (!sheet.getLastRow()) {
    if (!create) return null;
    sheet.appendRow(MATCH_APPROVAL_HEADERS_);
  }
  const header = sheet.getDataRange().getValues()[0];
  if (!MATCH_APPROVAL_HEADERS_.every((name, index) => header[index] === name)) throw new Error('Match verification is unavailable. Please contact the committee.');
  return sheet;
}
function matchPr_(value) {
  if (value == null || (typeof value === 'string' && !value.trim())) return '';
  if (!['number', 'string'].includes(typeof value) || !Number.isFinite(Number(value)) || Number(value) < 0) throw new Error('PR must be a non-negative number, or left blank.');
  return Number(value);
}
function submitVerifiedMatch_(ss, data) {
  const name1 = eventText_(data.player1, 'Player 1', 120);
  const name2 = eventText_(data.player2, 'Player 2', 120);
  const score = value => {
    if (!['number','string'].includes(typeof value) || String(value).trim() === '' || !Number.isInteger(Number(value)) || Number(value) < 0 || Number(value) > 99) throw new Error('Scores must be whole numbers from 0 to 99.');
    return Number(value);
  };
  const s1 = score(data.score1), s2 = score(data.score2);
  if (s1 === s2) throw new Error('A finished match must have a winner. Check both scores.');
  const length = data.matchLength == null ? Math.max(s1, s2) : score(data.matchLength);
  if (length !== Math.max(s1, s2)) throw new Error('The winning score must equal the match length.');
  const format = data.format || 'Casual';
  if (!['Casual','Tournament'].includes(format)) throw new Error('Choose a valid match format.');
  const pr1 = matchPr_(data.pr1), pr2 = matchPr_(data.pr2);
  const requestId = data.requestId == null ? Utilities.getUuid() : eventText_(data.requestId, 'Submission reference', 80);
  if (!/^[a-zA-Z0-9_-]{16,80}$/.test(requestId)) throw new Error('Invalid submission reference. Refresh the page and try again.');
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const memberSheet = ss.getSheetByName('Members');
    const members = memberSheet ? memberSheet.getDataRange().getValues().slice(1) : [];
    const lookup = name => {
      const candidates = members.filter(row => String(row[1] || '').trim().toLowerCase() === name.toLowerCase() && String(row[4] || 'Active').trim().toLowerCase() === 'active');
      if (candidates.length !== 1) throw new Error('Both players must be active community participants. Choose their registered names; contact the committee if a name is ambiguous.');
      const row = candidates[0];
      const email = String(row[2] || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Both players need registered email addresses before a result can be submitted.');
      return { name: String(row[1]).trim(), email };
    };
    const p1 = lookup(name1), p2 = lookup(name2);
    if (p1.name.toLowerCase() === p2.name.toLowerCase() || p1.email === p2.email) throw new Error('Choose two different players with separate registered email addresses.');
    const matchSheet = ss.getSheetByName('Sheet1') || ss.getSheets()[0];
    const row = [new Date(), eventSheetText_(p1.name), eventSheetText_(p2.name), s1, s2, pr1, pr2, length, format, 'm2_' + Utilities.getUuid(), 'Pending'];
    const payloadHash = matchPayloadHash_(row);
    const approvals = matchApprovalSheet_(ss, true);
    const existing = approvals.getDataRange().getValues().slice(1).filter(entry => entry[8] === requestId);
    if (existing.length) {
      if (existing.length !== 1 || existing[0][6] !== payloadHash) throw new Error('This submission reference was already used. Start a new match entry.');
      if (existing[0][7] !== 'Sent') throw new Error('Email delivery was incomplete. Contact the committee before submitting this match again.');
      return eventJson_({ status: 'success', initialStatus: 'Pending', requiredConfirmations: 2, duplicate: true });
    }
    if (MailApp.getRemainingDailyQuota() < 2) throw new Error('Confirmation emails are temporarily unavailable. Please try again later.');
    const tokens = [Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''), Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '')];
    const approval = [row[9], matchHash_(tokens[0]), matchHash_(tokens[1]), '', '', new Date(Date.now() + 7 * 86400000), payloadHash, 'Sending', requestId];
    approvals.appendRow(approval);
    const approvalRow = approvals.getLastRow();
    matchSheet.appendRow(row);
    const matchRow = matchSheet.getLastRow();
    try {
      [p1, p2].forEach((player, index) => {
        const base = `${SCRIPT_URL}?action=verifyMatch&matchId=${encodeURIComponent(row[9])}&token=${tokens[index]}`;
        const description = `${p1.name} (${s1}) vs ${p2.name} (${s2})`;
        MailApp.sendEmail({
          to: player.email,
          subject: `MBA: confirm your match — ${description}`,
          body: `Please review ${description}. ${format}, ${length} points. PR: ${pr1 === '' ? 'not recorded' : pr1} / ${pr2 === '' ? 'not recorded' : pr2}.\nBoth players must confirm before this result appears publicly.\nReview and confirm: ${base}&decision=confirm\nDispute: ${base}&decision=dispute\nYour private link expires in 7 days. Opening it alone does not confirm the result.`,
          htmlBody: `<div style="font-family:system-ui;max-width:520px;margin:auto;padding:24px;color:#1D1612"><h2>Confirm your MBA match</h2><p>${matchHtml_(description)}</p><p>${matchHtml_(format)} · ${length} points</p><p>PR: ${pr1 === '' ? 'not recorded' : pr1} / ${pr2 === '' ? 'not recorded' : pr2}</p><p>Both players must independently confirm before the result appears in the archive or leaderboard.</p><p><a href="${matchHtml_(base + '&decision=confirm')}">Review and confirm your result →</a></p><p><a href="${matchHtml_(base + '&decision=dispute')}">Report an incorrect result</a></p><p>Your private link expires in 7 days. Opening it alone does not confirm anything. Do not share it.</p></div>`
        });
      });
      approvals.getRange(approvalRow, 8).setValue('Sent');
    } catch (_) {
      approvals.getRange(approvalRow, 8).setValue('Failed');
      matchSheet.getRange(matchRow, 11).setValue('EmailFailed');
      throw new Error('Could not send both confirmation emails. The result is not published. Please contact the committee before resubmitting.');
    }
    return eventJson_({ status: 'success', initialStatus: 'Pending', requiredConfirmations: 2 });
  } finally { lock.releaseLock(); }
}
function matchConfirmationContext_(ss, params) {
  if (!/^m2_[a-zA-Z0-9-]{20,}$/.test(String(params.matchId || '')) || !/^[a-f0-9]{64}$/.test(String(params.token || ''))) throw new Error('This confirmation link is invalid or from the old confirmation system. Please resubmit an unconfirmed match using the website.');
  const sheet = matchApprovalSheet_(ss, false);
  const entries = sheet ? sheet.getDataRange().getValues().map((row,index) => ({row,index})).filter(entry => entry.index && entry.row[0] === params.matchId) : [];
  const matchSheet = ss.getSheetByName('Sheet1') || ss.getSheets()[0];
  const matches = matchSheet.getDataRange().getValues().map((row,index) => ({row,index})).filter(entry => entry.index && entry.row[9] === params.matchId);
  if (entries.length !== 1 || matches.length !== 1) throw new Error('This match cannot be verified. Please contact the committee.');
  const entry = entries[0], match = matches[0];
  const hash = matchHash_(params.token);
  const player = entry.row[1] === hash ? 0 : entry.row[2] === hash ? 1 : -1;
  if (player < 0) throw new Error('This confirmation link is invalid.');
  if (!Number.isFinite(new Date(entry.row[5]).getTime()) || new Date(entry.row[5]).getTime() <= Date.now()) throw new Error('This confirmation link has expired. Please contact the committee or resubmit the unconfirmed match.');
  if (entry.row[7] !== 'Sent' || entry.row[6] !== matchPayloadHash_(match.row)) throw new Error('This result cannot be verified because delivery was incomplete or the recorded details changed. Please contact the committee.');
  return { sheet, entry, matchSheet, match, player };
}
function matchMessage_(title, message, form) {
  return HtmlService.createHtmlOutput(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>MBA match confirmation</title></head><body style="font-family:system-ui;background:#F7F4EE;color:#1D1612;padding:24px"><main style="max-width:520px;margin:32px auto"><h1>${matchHtml_(title)}</h1><p>${matchHtml_(message)}</p>${form || ''}<p><a href="https://backgammon.melbourne/#matches">Return to MBA</a></p></main></body></html>`);
}
function reviewMatch_(ss, params) {
  try {
    const ctx = matchConfirmationContext_(ss, params), row = ctx.match.row;
    if (!['Pending','Confirmed'].includes(row[10])) throw new Error('This match is disputed or unavailable. It cannot be confirmed using this link.');
    const description = `${row[1]} (${row[3]}) vs ${row[2]} (${row[4]}). ${row[8]}, ${row[7]} points. PR: ${row[5] === '' ? 'not recorded' : row[5]} / ${row[6] === '' ? 'not recorded' : row[6]}.`;
    const form = `<form method="post" target="_top" action="${matchHtml_(SCRIPT_URL)}"><input type="hidden" name="action" value="confirmMatch"><input type="hidden" name="matchId" value="${matchHtml_(params.matchId)}"><input type="hidden" name="token" value="${matchHtml_(params.token)}"><p>Confirm only if these details are correct. Both players must confirm separately.</p><button type="submit" name="decision" value="confirm">Confirm my result</button> <button type="submit" name="decision" value="dispute">Dispute this result</button></form>`;
    return matchMessage_('Review your result', description, form);
  } catch (err) { return matchMessage_('Unable to confirm', err.message); }
}
function confirmMatch_(ss, params) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    if (!['confirm','dispute'].includes(params.decision)) throw new Error('Choose confirm or dispute.');
    const ctx = matchConfirmationContext_(ss, params), row = ctx.match.row, entry = ctx.entry.row;
    if (!['Pending','Confirmed'].includes(row[10])) throw new Error('This match is disputed or unavailable. It cannot be confirmed.');
    if (params.decision === 'dispute') {
      ctx.matchSheet.getRange(ctx.match.index + 1, 11).setValue('Disputed');
      return matchMessage_('Result disputed', 'The result is withheld from the archive and leaderboard. Please contact the committee about the correction.');
    }
    if (!entry[3 + ctx.player]) {
      ctx.sheet.getRange(ctx.entry.index + 1, 4 + ctx.player).setValue(new Date());
      entry[3 + ctx.player] = new Date();
    }
    const both = Boolean(entry[3] && entry[4]);
    ctx.matchSheet.getRange(ctx.match.index + 1, 11).setValue(both ? 'Confirmed' : 'Pending');
    return matchMessage_(both ? 'Both players confirmed' : 'Your confirmation is recorded', both ? 'This result can now appear in the archive and leaderboard.' : 'The result remains private until the other player also confirms.');
  } catch (err) { return matchMessage_('Unable to confirm', err.message); }
  finally { if (lock.hasLock ? lock.hasLock() : true) lock.releaseLock(); }
}
function approvedMatchForFeed_(row, entries) {
  if (String(row[10] || '').trim().toLowerCase() !== 'confirmed') return false;
  // Preserve historical published matches; all new m2_ matches need independent proofs.
  if (!String(row[9] || '').startsWith('m2_')) return true;
  const approvals = entries.filter(entry => entry[0] === row[9]);
  return approvals.length === 1 && Boolean(approvals[0][3] && approvals[0][4]) && approvals[0][7] === 'Sent' && approvals[0][6] === matchPayloadHash_(row);
}
