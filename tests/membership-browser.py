"""Read-only browser checks; all application and bank responses are test doubles."""
from playwright.sync_api import sync_playwright
import json, subprocess, os
from datetime import datetime, timezone
BASE_URL = os.environ.get('MBA_TEST_URL', 'http://127.0.0.1:8000/')
cache = {}
with sync_playwright() as p:
 b = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
 page = b.new_page(); errors = []; posts = []
 page.clock.set_fixed_time(datetime(2026, 10, 25, tzinfo=timezone.utc))
 page.on('pageerror', lambda e: errors.append(str(e)))
 settings = {'version':1, 'associationApplicationsOpen':False, 'rulesAdopted':False, 'rulesVersion':'proposed-v1', 'rulesUrl':'https://backgammon.melbourne/docs/proposed-association-rules.html', 'bankAccount':None}
 mode = {'legacy':False, 'error':False, 'approved':False}
 def route(r):
  u = r.request.url
  if u.startswith('https://script.google.com/'):
   if r.request.method == 'GET':
    d = {'eventsVersion':1,'events':[], 'matches':[], 'members':['Test Member']}
    if not mode['legacy']: d['registration'] = settings
    return r.fulfill(json=d)
   data = json.loads(r.request.post_data); posts.append(data)
   if mode['error']: return r.fulfill(json={'status':'error','error':'Test server rejection'})
   if data['membershipType'] == 'community': return r.fulfill(json={'status':'success','membershipType':'community'})
   return r.fulfill(json={'status':'application_received','membershipType':'association','applicationState':('approved_awaiting_payment' if mode['approved'] else 'pending_committee') if settings['associationApplicationsOpen'] else 'preincorporation_interest','paymentReference':'TEST-REF','quote':{'feeCents':2500,'membershipYear':2026},'paymentInstructionsAvailable':bool(mode['approved'] and settings['associationApplicationsOpen'] and settings['bankAccount'])})
  if 'maps.google.com' in u: return r.fulfill(content_type='text/html', body='<p>Map test double</p>')
  if u.startswith('https://'):
   if u not in cache: cache[u] = subprocess.check_output(['curl','--fail','--silent','--show-error','--location','--max-time','25',u])
   return r.fulfill(body=cache[u])
  r.continue_()
 page.route('**/*', route)
 def details():
  for selector,value in [('#regFullName','Test Applicant'),('#regEmail','applicant@example.com'),('#regPhone','0400000000')]: page.locator(selector).fill(value)
 def paid_details():
  details(); page.locator('#regNoticeAddress').fill('1 Test Street, Melbourne VIC');page.locator('#regAgeCategory').select_option('18plus')
 for width in [390,1440]:
  page.set_viewport_size({'width':width,'height':900})
  page.goto(BASE_URL+'?join=association', wait_until='networkidle', timeout=60000)
  assert page.locator('#joinModal').is_visible()
  assert page.locator('#associationJoinFields').is_visible()
  assert '$25.00' in page.locator('#membershipFeeQuote').inner_text()
  assert 'Do not send money' in page.locator('#membershipAvailability').inner_text()
  paid_details(); before = len(posts)
  page.locator('#submitJoinBtn').click(); assert len(posts)==before
  page.locator('#regRulesAgreement').check(); page.locator('#regSignatureAgreement').check()
  page.locator('#submitJoinBtn').click();page.wait_for_timeout(200)
  assert posts[-1]['membershipType']=='association' and posts[-1]['rulesAgreement'] and posts[-1]['signatureAgreement']
  assert 'Your interest is recorded' in page.locator('#joinResultTitle').inner_text()
  assert 'Do not deposit money' in page.locator('#joinPaymentInstructions').inner_text()
  assert 'not been admitted' in page.locator('#joinResultMessage').inner_text()
  page.locator('#joinResultDone').click();page.locator('#joinNav').click()
  assert not page.locator('#associationJoinFields').is_visible()
  details();page.locator('#submitJoinBtn').click();page.wait_for_timeout(200)
  assert posts[-1]['membershipType']=='community' and 'rulesAgreement' not in posts[-1]
  assert 'Welcome' in page.locator('#joinResultTitle').inner_text()
  assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
  print(width,'PASS: deep link, choice, inclusive-month quote, required consent, pre-incorporation interest, no bank request, community registration',flush=True)
 page.clock.set_fixed_time(datetime(2026, 12, 1, tzinfo=timezone.utc))
 page.goto(BASE_URL+'?join=association',wait_until='networkidle',timeout=60000)
 assert '$10.00' in page.locator('#membershipFeeQuote').inner_text()
 assert 'same email address' in page.locator('#associationJoinFields').inner_text()
 page.clock.set_fixed_time(datetime(2026, 10, 25, tzinfo=timezone.utc))
 # Later, formally open applications with controlled fake bank details.
 settings.update({'associationApplicationsOpen':True,'rulesAdopted':True,'rulesVersion':'adopted-v1','bankAccount':{'accountName':'TEST ONLY','bsb':'123-456','accountNumber':'12345678'}})
 page.goto(BASE_URL+'?join=association',wait_until='networkidle',timeout=60000)
 assert 'adopted rules' in page.locator('#membershipAgreementText').inner_text()
 paid_details();page.locator('#regRulesAgreement').check();page.locator('#regSignatureAgreement').check();page.locator('#submitJoinBtn').click();page.wait_for_timeout(200)
 assert 'Do not deposit money' in page.locator('#joinPaymentInstructions').inner_text()
 assert '123-456' not in page.locator('#joinPaymentInstructions').inner_text()
 assert 'awaits a committee decision' in page.locator('#joinResultMessage').inner_text()
 mode['approved']=True
 page.goto(BASE_URL+'?join=association',wait_until='networkidle',timeout=60000)
 paid_details();page.locator('#regRulesAgreement').check();page.locator('#regSignatureAgreement').check();page.locator('#submitJoinBtn').click();page.wait_for_timeout(200)
 assert 'TEST-REF' in page.locator('#joinPaymentInstructions').inner_text()
 assert '123-456' in page.locator('#joinPaymentInstructions').inner_text()
 assert 'committee has approved' in page.locator('#joinResultMessage').inner_text()
 # A rejected submission must never produce a success panel.
 mode['error']=True
 page.goto(BASE_URL+'?join=community',wait_until='networkidle',timeout=60000);details();page.locator('#submitJoinBtn').click();page.wait_for_timeout(200)
 assert 'Test server rejection' in page.locator('#joinFormStatus').inner_text();assert not page.locator('#joinResult').is_visible()
 # Older deployed scripts still support community signup; association cannot POST.
 mode.update({'legacy':True,'error':False})
 page.goto(BASE_URL+'?join=association',wait_until='networkidle',timeout=60000)
 assert page.locator('#submitJoinBtn').is_disabled()
 page.locator('[name=membershipType][value=community]').check();assert page.locator('#submitJoinBtn').is_enabled()
 assert not errors, errors
 print('PASS: later bank-transfer path, error acknowledgement, and old-backend association gating',flush=True)
 b.close()
