const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyOBLAPmwyTMyJUbDHj6OCKZmOJmqkwvLdQRXVOLb2WqVkNgnlA5NmqATBTfrZjXvth/exec";

function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const data = JSON.parse(e.postData.contents);
    
    if (data.action === "submitEvent") return submitCommunityEvent_(ss, data);

    if (data.action === "registerMember") return registerMbaParticipant_(ss, data);

    if (data.action !== "submitMatch") return eventJson_({ status: "error", error: "Unknown action." });

    // ACTION 2: Submit Match Result
    const matchSheet = ss.getSheetByName("Sheet1") || ss.getSheets()[0];
    const matchId = "m_" + Utilities.getUuid().slice(0, 8);
    const p1 = (data.player1 || "").trim();
    const p2 = (data.player2 || "").trim();
    const s1 = Number(data.score1);
    const s2 = Number(data.score2);
    const matchLength = data.matchLength || Math.max(s1, s2);
    const format = data.format || "Casual";

    // Lookup player emails from Members tab
    const memberSheet = ss.getSheetByName("Members");
    let p1Email = "", p2Email = "";
    if (memberSheet) {
      const mData = memberSheet.getDataRange().getValues();
      for (let i = 1; i < mData.length; i++) {
        const name = (mData[i][1] || "").toString().trim().toLowerCase();
        if (name === p1.toLowerCase()) p1Email = (mData[i][2] || "").toString().trim();
        if (name === p2.toLowerCase()) p2Email = (mData[i][2] || "").toString().trim();
      }
    }

    // Default to Confirmed if neither player has an email registered (e.g. guests)
    const initialStatus = (p1Email || p2Email) ? "Pending" : "Confirmed";

    // Row: [Date, P1, P2, S1, S2, PR1, PR2, Length, Format, MatchID, Status]
    matchSheet.appendRow([
      new Date(),
      p1,
      p2,
      s1,
      s2,
      data.pr1 ? Number(data.pr1) : "",
      data.pr2 ? Number(data.pr2) : "",
      matchLength,
      format,
      matchId,
      initialStatus
    ]);

    // Send 1-Click Verification Email if email exists
    if (initialStatus === "Pending") {
      const confirmUrl = `${SCRIPT_URL}?action=verifyMatch&matchId=${matchId}&decision=confirm`;
      const disputeUrl = `${SCRIPT_URL}?action=verifyMatch&matchId=${matchId}&decision=dispute`;
      
      const emailBodyHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 520px; margin: auto; padding: 24px; border: 1px solid #E5DCce; border-radius: 16px; background-color: #F7F4EE; color: #1D1612;">
          <h2 style="color: #C2593F; margin-top: 0;">Melbourne Backgammon Association</h2>
          <p style="font-size: 15px; line-height: 1.5;">A match result involving you was just submitted:</p>
          <div style="background: #ffffff; padding: 16px; border-radius: 12px; border: 1px solid #E5DCce; margin: 16px 0; text-align: center;">
            <div style="font-size: 14px; color: #543D32; text-transform: uppercase; font-weight: bold;">${format} (${matchLength} pts)</div>
            <div style="font-size: 22px; font-weight: 800; margin: 8px 0;">
              ${p1} <span style="color: #C2593F;">${s1} - ${s2}</span> ${p2}
            </div>
          </div>
          <p style="font-size: 14px; color: #543D32;">Tap below to confirm this result for the official club ladder:</p>
          <div style="margin: 24px 0; text-align: center;">
            <a href="${confirmUrl}" style="background-color: #2E4A62; color: #ffffff; padding: 12px 28px; font-size: 14px; font-weight: bold; border-radius: 9999px; text-decoration: none; display: inline-block;">
              ✓ Confirm Match Result
            </a>
          </div>
          <p style="font-size: 12px; color: #888; text-align: center;">
            Score incorrect? <a href="${disputeUrl}" style="color: #C2593F; text-decoration: underline;">Flag as Disputed</a>
          </p>
        </div>
      `;

      // Send to both players if emails exist
      [p1Email, p2Email].filter(Boolean).forEach(toEmail => {
        MailApp.sendEmail({
          to: toEmail,
          subject: `MBA Match Verification: ${p1} vs ${p2} (${s1}-${s2})`,
          htmlBody: emailBodyHtml
        });
      });
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "success", initialStatus }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (e && e.parameter && e.parameter.action === "verifyEvent") {
    return verifyCommunityEvent_(ss, e.parameter);
  }

  // 1. Handle 1-Click Email Action
  if (e && e.parameter && e.parameter.action === "verifyMatch") {
    const targetId = e.parameter.matchId;
    const decision = e.parameter.decision;
    const matchSheet = ss.getSheetByName("Sheet1") || ss.getSheets()[0];
    const data = matchSheet.getDataRange().getValues();

    let found = false;
    let matchDesc = "";

    for (let i = 1; i < data.length; i++) {
      if (data[i][9] === targetId) { // Column J = Match ID
        const newStatus = decision === "confirm" ? "Confirmed" : "Disputed";
        matchSheet.getRange(i + 1, 11).setValue(newStatus); // Column K = Status
        matchDesc = `${data[i][1]} (${data[i][3]}) vs ${data[i][2]} (${data[i][4]})`;
        found = true;
        break;
      }
    }

    const title = decision === "confirm" ? "Match Verified!" : "Match Disputed";
    const message = found 
      ? (decision === "confirm" ? `The score for <b>${matchDesc}</b> has been confirmed and updated on the MBA leaderboard.` : `The match <b>${matchDesc}</b> has been flagged for committee review.`)
      : "Match ID not found or already verified.";

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>MBA Match Verification</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #F7F4EE; color: #1D1612; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 16px; box-sizing: border-box;">
        <div style="background: white; border: 1px solid #E5DCce; padding: 32px; border-radius: 20px; max-width: 440px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.05);">
          <div style="width: 56px; height: 56px; border-radius: 50%; background: ${decision === 'confirm' ? '#E3EAF0' : '#F8E9E5'}; color: ${decision === 'confirm' ? '#2E4A62' : '#C2593F'}; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-size: 28px; font-weight: bold;">
            ${decision === 'confirm' ? '✓' : '!'}
          </div>
          <h2 style="margin: 0 0 12px; font-size: 22px;">${title}</h2>
          <p style="font-size: 14px; color: #543D32; line-height: 1.5; margin-bottom: 24px;">${message}</p>
          <a href="https://backgammon.melbourne" style="display: inline-block; background: #1D1612; color: #F7F4EE; text-decoration: none; font-size: 13px; font-weight: bold; padding: 12px 24px; border-radius: 9999px;">
            Return to Leaderboard
          </a>
        </div>
      </body>
      </html>
    `;
    return HtmlService.createHtmlOutput(html);
  }

  // 2. Fetch Confirmed Matches (Pending matches are excluded from leaderboard calculations)
  const matchSheet = ss.getSheetByName("Sheet1") || ss.getSheets()[0];
  const matchRows = matchSheet.getDataRange().getValues();
  const matches = [];

  for (let i = 1; i < matchRows.length; i++) {
    const r = matchRows[i];
    const status = (r[10] || "Confirmed").toString().trim(); // Column K
    if (r[1] && r[2] && status.toLowerCase() === "confirmed") {
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

  return ContentService.createTextOutput(JSON.stringify({ matches, members, events: publicCommunityEvents_(ss), eventsVersion: 1, registration: publicMembershipSettings_() }))
    .setMimeType(ContentService.MimeType.JSON);
}

// Community events. Private rows are never included in the public response.
const EVENT_HEADERS_ = ["Created", "EventID", "MemberEmail", "Title", "Venue", "Address", "StartsAt", "EndsAt", "Format", "Description", "Status", "TokenHash", "TokenExpiresAt", "ConfirmedAt"];
const EVENT_TIME_ZONE_ = "Australia/Melbourne";
const EVENT_FORMATS_ = ["Casual play", "Chouette", "Club night", "Tournament", "Beginners welcome"];

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

function eventReadText_(value) {
  return String(value || "").replace(/^'(?=[=+\-@\t\r])/, "");
}

function eventEscapeHtml_(value) {
  return String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function eventTokenHash_(token) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token, Utilities.Charset.UTF_8)
    .map(byte => (byte & 255).toString(16).padStart(2, "0")).join("");
}

function eventLocalDate_(text) {
  if (typeof text !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text)) throw new Error("Check the event date and time.");
  const parts = text.match(/\d+/g).map(Number);
  const wallClock = Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4]);
  // Melbourne uses UTC+10 or UTC+11. Round-trip both to catch daylight-saving
  // gaps, repeated times, impossible dates and invalid hour/minute values.
  const candidates = [10, 11].map(offset => new Date(wallClock - offset * 3600000))
    .filter(date => Utilities.formatDate(date, EVENT_TIME_ZONE_, "yyyy-MM-dd'T'HH:mm") === text);
  if (candidates.length !== 1) throw new Error("Choose an unambiguous Melbourne time outside the daylight-saving changeover.");
  return candidates[0];
}

function eventSheet_(ss) {
  let sheet = ss.getSheetByName("Events");
  if (!sheet) {
    sheet = ss.insertSheet("Events");
    sheet.appendRow(EVENT_HEADERS_);
  } else {
    const header = sheet.getDataRange().getValues()[0] || [];
    if (!EVENT_HEADERS_.every((name, index) => header[index] === name)) {
      throw new Error("The Events sheet has an unexpected layout. Contact the committee.");
    }
  }
  return sheet;
}

function submitCommunityEvent_(ss, data) {
  const neutralResponse = { status: "pending_verification" };
  const email = eventText_(data.memberEmail, "Membership email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Check your membership email.");
  const title = eventText_(data.title, "Event name", 100);
  const venue = eventText_(data.venue, "Venue", 120);
  const address = eventText_(data.address, "Street address", 250);
  const description = eventText_(data.description, "Description", 1500, true);
  if (data.timeZone !== EVENT_TIME_ZONE_) throw new Error("Use Melbourne event times.");
  if (!EVENT_FORMATS_.includes(data.format)) throw new Error("Choose a valid event format.");
  const startsAt = eventLocalDate_(data.startsAt);
  const endsAt = eventLocalDate_(data.endsAt);
  const now = new Date();
  if (startsAt <= now || endsAt <= startsAt || endsAt - startsAt > 7 * 86400000 || startsAt - now > 366 * 86400000) {
    throw new Error("Use a future event within the next year, ending after it starts and lasting no more than seven days.");
  }
  const members = ss.getSheetByName("Members");
  const memberRows = members ? members.getDataRange().getValues().slice(1) : [];
  const member = memberRows.find(row => String(row[2] || "").trim().toLowerCase() === email &&
    String(row[1] || "").trim() && String(row[4] || "Active").trim().toLowerCase() !== "inactive");
  // Do not reveal whether an address is registered; never email non-members.
  if (!member) return eventJson_(neutralResponse);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = eventSheet_(ss);
    const rows = sheet.getDataRange().getValues().slice(1);
    const recent = rows.filter(row => new Date(row[0]).getTime() > now.getTime() - 3600000);
    if (recent.filter(row => row[2] === email).length >= 3 || recent.length >= 30) return eventJson_(neutralResponse);
    const duplicate = rows.some(row => row[2] === email && eventReadText_(row[3]) === title &&
      eventReadText_(row[5]) === address && new Date(row[6]).getTime() === startsAt.getTime() &&
      (row[10] === "confirmed" || (row[10] === "pending" && new Date(row[12]) > now)));
    if (duplicate) return eventJson_(neutralResponse);
    if (MailApp.getRemainingDailyQuota() < 1) throw new Error("Email is temporarily unavailable. Please try later.");
    const eventId = "evt_" + Utilities.getUuid();
    const token = Utilities.getUuid() + Utilities.getUuid();
    const expires = new Date(Math.min(now.getTime() + 86400000, startsAt.getTime()));
    const row = [now, eventId, email, eventSheetText_(title), eventSheetText_(venue), eventSheetText_(address),
      startsAt, endsAt, data.format, eventSheetText_(description), "pending", eventTokenHash_(token), expires, ""];
    sheet.appendRow(row);
    const rowNumber = sheet.getLastRow();
    const confirmUrl = SCRIPT_URL + "?action=verifyEvent&eventId=" + encodeURIComponent(eventId) + "&token=" + encodeURIComponent(token);
    const when = Utilities.formatDate(startsAt, EVENT_TIME_ZONE_, "EEE d MMM yyyy, h:mm a z");
    try {
      MailApp.sendEmail({
        to: String(member[2]).trim(),
        subject: "Confirm your MBA event: " + title,
        body: "Confirm your event: " + title + "\n" + venue + "\n" + address + "\n" + when +
          "\n\nPublish this event: " + confirmUrl + "\n\nThis link expires within 24 hours. If you did not request this, ignore this email.",
        htmlBody: '<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;background:#F7F4EE;color:#1D1612;border-radius:16px">' +
          '<h2 style="color:#C2593F">Confirm your event</h2><h3>' + eventEscapeHtml_(title) + '</h3><p>' + eventEscapeHtml_(venue) +
          '<br>' + eventEscapeHtml_(address) + '<br>' + eventEscapeHtml_(when) + '</p><p>' + eventEscapeHtml_(description).replace(/\n/g, '<br>') +
          '</p><p>Your event is private until you confirm. Use the button below to publish it to the MBA calendar.</p>' +
          '<p><a style="display:inline-block;background:#C2593F;color:white;padding:14px 24px;border-radius:30px;text-decoration:none" href="' + eventEscapeHtml_(confirmUrl) + '">Confirm and publish event</a></p>' +
          '<p>This link expires within 24 hours. If you did not request this, ignore this email.</p></div>'
      });
    } catch (error) {
      sheet.getRange(rowNumber, 11).setValue("email_failed");
      sheet.getRange(rowNumber, 12).setValue("");
      throw new Error("The confirmation email could not be sent. Please try later.");
    }
    return eventJson_(neutralResponse);
  } finally {
    lock.releaseLock();
  }
}

function verifyCommunityEvent_(ss, parameters) {
  let title = "Link unavailable";
  let message = "This link is invalid, expired, or has already been used. Submit the event again if needed.";
  const token = String(parameters.token || "");
  const eventId = String(parameters.eventId || "");
  if (/^evt_[a-zA-Z0-9-]{36}$/.test(eventId) && /^[a-zA-Z0-9-]{72}$/.test(token)) {
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const sheet = ss.getSheetByName("Events");
      const rows = sheet ? sheet.getDataRange().getValues() : [];
      const index = rows.findIndex((row, position) => position > 0 && row[1] === eventId);
      const row = rows[index];
      const now = new Date();
      if (row && row[10] === "pending" && row[11] === eventTokenHash_(token) &&
          new Date(row[12]) > now && new Date(row[6]) > now) {
        // Recheck membership in case the member was deactivated after submission.
        const members = ss.getSheetByName("Members");
        const active = members && members.getDataRange().getValues().slice(1).some(member =>
          String(member[2] || "").trim().toLowerCase() === row[2] &&
          String(member[4] || "Active").trim().toLowerCase() !== "inactive");
        if (active) {
          sheet.getRange(index + 1, 11, 1, 4).setValues([["confirmed", "", row[12], now]]);
          title = "Your event is published!";
          message = eventReadText_(row[3]) + " is now on the MBA event calendar. Thank you for bringing people together.";
        }
      }
    } finally {
      lock.releaseLock();
    }
  }
  return HtmlService.createHtmlOutput('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>MBA event confirmation</title></head>' +
    '<body style="font-family:Arial,sans-serif;background:#F7F4EE;color:#1D1612;padding:32px"><main style="max-width:480px;margin:10vh auto;background:white;padding:32px;border-radius:20px">' +
    '<h1>' + title + '</h1><p>' + eventEscapeHtml_(message) + '</p><a href="https://backgammon.melbourne/#events">Return to the event calendar</a></main></body></html>');
}

function publicCommunityEvents_(ss) {
  const sheet = ss.getSheetByName("Events");
  if (!sheet) return [];
  const now = new Date();
  return sheet.getDataRange().getValues().slice(1)
    .filter(row => row[10] === "confirmed" && new Date(row[7]) > now)
    .map(row => ({
      id: row[1], status: "confirmed", title: eventReadText_(row[3]), venue: eventReadText_(row[4]), address: eventReadText_(row[5]),
      startsAt: new Date(row[6]).toISOString(), endsAt: new Date(row[7]).toISOString(), format: row[8], description: eventReadText_(row[9])
    }))
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
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
