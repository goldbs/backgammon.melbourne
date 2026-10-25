(() => {
  'use strict';
  const form = document.getElementById('joinForm');
  const modal = document.getElementById('joinModal');
  const result = document.getElementById('joinResult');
  const fields = document.getElementById('associationJoinFields');
  const submit = document.getElementById('submitJoinBtn');
  const feedback = document.getElementById('joinFormStatus');
  const rulesAgreement = document.getElementById('regRulesAgreement');
  const signatureAgreement = document.getElementById('regSignatureAgreement');
  const endpoint = SCRIPT_URL;
  const money = cents => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);
  let settings = null;
  let sending = false;
  let lastTrigger = null;
  const associationSelected = () => form.elements.membershipType.value === 'association';

  function localQuote(now = new Date()) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-AU', {
      timeZone: 'Australia/Melbourne', year: 'numeric', month: 'numeric'
    }).formatToParts(now).map(part => [part.type, part.value]));
    const year = Number(parts.year);
    const month = Number(parts.month);
    return { feeCents: Math.round(10000 * (13 - month) / 12 / 500) * 500, months: 13 - month, year };
  }

  function bankText(bank, reference) {
    return `Account name: ${bank.accountName}\nBSB: ${bank.bsb}\nAccount number: ${bank.accountNumber}` +
      (reference ? `\nPayment reference: ${reference}` : '');
  }

  function updateChoice() {
    const paid = associationSelected();
    fields.hidden = !paid;
    fields.disabled = !paid;
    for (const id of ['regNoticeAddress', 'regAgeCategory', 'regRulesAgreement', 'regSignatureAgreement']) {
      document.getElementById(id).required = paid;
    }
    const available = settings?.version === 1;
    submit.disabled = sending || (paid && !available);
    submit.textContent = sending ? 'Submitting…' : !paid ? 'Join the community' :
      settings?.associationApplicationsOpen ? 'Submit membership application' : 'Register membership interest';
    const quote = localQuote();
    document.getElementById('membershipFeeQuote').textContent =
      `${money(quote.feeCents)} if joining this month, for ${quote.months} remaining ${quote.months === 1 ? 'month' : 'months'} of ${quote.year}, including this month. Renew on 1 January ${quote.year + 1}. The treasurer will confirm any adjustment if admission takes place in a later month.`;
    document.getElementById('membershipAvailability').textContent = !available
      ? 'Association requests aren’t available yet. You can join the free community now and return to apply later.'
      : settings.associationApplicationsOpen
        ? 'This application also registers you as a community participant. The committee considers it first; accepted applicants receive payment instructions. Admission requires approval and confirmed payment.'
        : 'We’re preparing to incorporate. This records your interest and joins you to the free community; it does not make you a paid association member. Do not send money yet.';
    document.getElementById('membershipAgreementText').textContent = settings?.associationApplicationsOpen
      ? 'I wish to become an association member, support the association’s purposes, have read the adopted rules and agree to comply with them.'
      : 'I support the association’s purposes and have read the proposed model rules. I intend to apply and agree to comply with the rules once adopted. I understand this is an expression of interest while the association prepares to incorporate.';
    const link = document.getElementById('membershipRulesLink');
    link.textContent = settings?.rulesAdopted ? 'the adopted association rules' : 'the proposed CAV model rules';
    link.href = settings?.rulesUrl?.startsWith('https://') ? settings.rulesUrl : 'docs/proposed-association-rules.html';
    const preview = document.getElementById('joinBankPreview');
    preview.style.whiteSpace = 'pre-line';
    preview.textContent = settings?.associationApplicationsOpen
      ? 'Bank transfer after committee approval\nDo not deposit money with this application. The secretary will notify you of the decision and provide payment instructions if accepted, once account details are confirmed.'
      : 'Bank transfer · details to be confirmed\nDo not deposit money yet. Payment instructions will follow committee approval once membership is open and account details are confirmed.';
  }

  async function loadSettings() {
    try {
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error('Unavailable');
      const data = await response.json();
      settings = data.registration?.version === 1 ? data.registration : null;
    } catch (_) {
      settings = null;
    }
    updateChoice();
    return settings;
  }

  function resetJoin(type) {
    form.reset();
    form.hidden = false;
    result.hidden = true;
    feedback.textContent = '';
    if (type) form.elements.membershipType.value = type;
    updateChoice();
    if (!sending) document.getElementById('regFullName').focus();
  }
  document.getElementById('joinNav').addEventListener('click', event => {
    lastTrigger = event.currentTarget;
    if (!sending) resetJoin();
    loadSettings();
  });
  form.querySelectorAll('[name="membershipType"]').forEach(input => input.addEventListener('change', () => {
    rulesAgreement.checked = false;
    signatureAgreement.checked = false;
    feedback.textContent = '';
    updateChoice();
  }));
  document.getElementById('joinResultDone').addEventListener('click', () => {
    closeModal(modal);
    lastTrigger?.focus();
  });
  modal.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeModal(modal);
      lastTrigger?.focus();
    }
    if (event.key === 'Tab') {
      const focusable = [...modal.querySelectorAll('button, input, textarea, select, a[href], [tabindex="0"]')]
        .filter(element => !element.disabled && element.getClientRects().length);
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (sending || submit.disabled || !form.reportValidity()) return;
    const paid = associationSelected();
    const payload = {
      action: 'registerMember', membershipType: paid ? 'association' : 'community',
      fullName: document.getElementById('regFullName').value.trim(),
      email: document.getElementById('regEmail').value.trim(),
      phone: document.getElementById('regPhone').value.trim()
    };
    if (!payload.fullName || !payload.phone) { feedback.textContent = 'Enter your name and phone number.'; return; }
    if (paid) Object.assign(payload, {
      noticeAddress: document.getElementById('regNoticeAddress').value.trim(),
      ageCategory: document.getElementById('regAgeCategory').value,
      rulesAgreement: rulesAgreement.checked, signatureAgreement: signatureAgreement.checked,
      rulesVersion: settings.rulesVersion
    });
    sending = true;
    updateChoice();
    feedback.textContent = 'Submitting your request…';
    try {
      if (paid) {
        const previousVersion = payload.rulesVersion;
        const previousOpen = settings.associationApplicationsOpen;
        const current = await loadSettings();
        if (!current) throw new Error('Association requests are temporarily unavailable. Please try later.');
        if (current.rulesVersion !== previousVersion || current.associationApplicationsOpen !== previousOpen) {
          rulesAgreement.checked = false;
          signatureAgreement.checked = false;
          throw new Error('The rules or application arrangements changed. Please review them and agree again.');
        }
      }
      const response = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error('We couldn’t confirm your request. Please try again later.');
      const data = await response.json();
      if (data.status === 'error') throw new Error(data.error || 'Please check your details.');
      if (paid ? data.status !== 'application_received' || data.membershipType !== 'association' : !['success', 'exists'].includes(data.status)) {
        throw new Error('We couldn’t confirm your request. Please contact the secretary before trying again.');
      }
      document.getElementById('joinResultTitle').textContent = !paid
        ? data.status === 'exists' ? 'Already in the community' : 'Welcome to the community'
        : data.applicationState === 'preincorporation_interest' ? 'Your interest is recorded' : 'Your membership request is recorded';
      document.getElementById('joinResultMessage').textContent = !paid
        ? 'This email is registered for community participation. Community registration does not provide association membership or voting rights.'
        : data.applicationState === 'preincorporation_interest'
          ? 'You’re also registered as a community participant. We’ll provide next steps when formal applications open. You have not been admitted as an association member.'
          : data.applicationState === 'admitted'
            ? 'An association membership record already exists for this year. Contact the secretary about your membership or any payment questions.'
            : data.applicationState === 'approved_awaiting_payment'
              ? 'The committee has approved your application. Membership will commence once the required payment is confirmed; voting eligibility remains subject to the rules.'
              : 'You’re also registered as a community participant. Your application awaits a committee decision. The secretary will notify you in writing and provide payment instructions if accepted. Do not deposit money yet.';
      document.getElementById('joinResultFee').textContent = paid
        ? `${money(data.quote.feeCents)} quoted for ${data.quote.membershipYear}; renewal 1 January ${data.quote.membershipYear + 1}.` : '';
      document.getElementById('joinResultReference').textContent = paid ? `Request reference: ${data.paymentReference}` : '';
      const payment = document.getElementById('joinPaymentInstructions');
      payment.hidden = !paid;
      payment.style.whiteSpace = 'pre-line';
      payment.textContent = paid && data.paymentInstructionsAvailable && settings?.associationApplicationsOpen && settings.bankAccount && data.applicationState === 'approved_awaiting_payment'
        ? `Deposit ${money(data.quote.feeCents)} using these details:\n` + bankText(settings.bankAccount, data.paymentReference) + '\nThe treasurer must confirm receipt; do not submit another application to report a payment.'
        : 'Do not deposit money yet. The secretary will provide payment instructions after committee approval, once account details are confirmed.';
      form.hidden = true;
      result.hidden = false;
      result.focus();
      fetchAppData();
    } catch (error) {
      feedback.textContent = error instanceof Error ? error.message.slice(0, 300) : 'Unable to confirm your request. Please try later.';
    } finally {
      sending = false;
      updateChoice();
    }
  });

  const initialChoice = new URLSearchParams(location.search).get('join');
  if (['community', 'association'].includes(initialChoice)) {
    lastTrigger = document.getElementById('joinNav');
    openModal(modal);
    resetJoin(initialChoice);
  }
  loadSettings();
})();
