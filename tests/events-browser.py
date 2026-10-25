from pathlib import Path
from playwright.sync_api import sync_playwright
import json, subprocess, os
BASE_URL = os.environ.get("MBA_TEST_URL", "http://127.0.0.1:8000/")
ASSET_CACHE = {}
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']); page=b.new_page(); errors=[]; sent=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 def route(r):
  url=r.request.url
  if url.endswith('/events-config.js'):
   return r.fulfill(content_type='application/javascript',body="window.MBA_EVENTS_CONFIG={eventsEndpoint:'https://event-test.invalid/api'}")
  if url.startswith('https://event-test.invalid'):
   if r.request.method=='POST':
    sent.append(json.loads(r.request.post_data)); return r.fulfill(json={'status':'pending_verification'})
   return r.fulfill(json={'eventsVersion':1,'events':[
    {'id':'one','status':'confirmed','title':'Test chouette','venue':'Test venue','address':'1 Test Street, Melbourne VIC','startsAt':'2099-01-01T18:00:00+11:00','endsAt':'2099-01-01T21:00:00+11:00','format':'Chouette','description':'<img src=x onerror=alert(1)>'},
    {'id':'pending','status':'pending','title':'Private event','venue':'X','address':'X','startsAt':'2099-01-01T18:00:00+11:00','endsAt':'2099-01-01T21:00:00+11:00'},
    {'id':'old','status':'confirmed','title':'Expired event','venue':'X','address':'X','startsAt':'2000-01-01T18:00:00+11:00','endsAt':'2000-01-01T21:00:00+11:00'}]})
  if 'maps.google.com' in url: return r.fulfill(content_type='text/html',body='<p>Map test double</p>')
  if url.startswith('https://'):
   if url not in ASSET_CACHE:
    ASSET_CACHE[url] = subprocess.check_output(['curl','--fail','--silent','--show-error','--location','--max-time','25',url])
   return r.fulfill(body=ASSET_CACHE[url])
  r.continue_()
 page.route('**/*',route)
 for width in [390,1440]:
  page.set_viewport_size({'width':width,'height':900})
  page.goto(BASE_URL,wait_until='networkidle',timeout=60000)
  assert page.locator('#eventsList article').count()==1
  assert page.locator('#eventsList img').count()==0
  assert page.locator('#melbourneMap iframe').get_attribute('src').startswith('https://maps.google.com/maps?q=1%20Test')
  page.locator('#addEventBtn').click(); assert page.locator('#eventDialog').is_visible()
  for name,value in [('memberEmail','test@example.com'),('title','Test event'),('venue','Test venue'),('address','Test address'),('startsAt','2099-01-01T18:00'),('endsAt','2099-01-01T17:00')]: page.locator(f'#eventForm [name={name}]').fill(value)
  page.locator('#submitEventBtn').click(); assert 'after the start' in page.locator('#eventFormStatus').inner_text(); assert len(sent)==(0 if width==390 else 1)
  page.locator('[name=endsAt]').fill('2099-01-01T21:00'); page.locator('#submitEventBtn').click(); page.wait_for_timeout(200)
  assert 'stays private' in page.locator('#eventFormStatus').inner_text()
  assert sent[-1]['timeZone']=='Australia/Melbourne'; assert sent[-1]['startsAt']=='2099-01-01T18:00'
  assert page.locator('#eventsList article').count()==1
  assert page.locator('#submitEventBtn').is_enabled()
  page.keyboard.press('Escape'); assert not page.locator('#eventDialog').is_visible()
  assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
  print(width,'PASS: confirmed-only event list, escaped content, Google Maps selection, form validation, pending acknowledgement, Melbourne wall-clock payload, modal keyboard dismissal',flush=True)
 # Simulate rollback to the original backend: event POST must stay unavailable.
 page.route('https://event-test.invalid/**', lambda r: r.fulfill(json={'matches':[], 'members':[]}))
 page.goto(BASE_URL,wait_until='networkidle',timeout=60000)
 page.locator('#addEventBtn').click()
 assert page.locator('#submitEventBtn').is_disabled()
 assert 'coming soon' in page.locator('#eventsStatus').inner_text()
 assert len(sent)==2
 print('Legacy backend: submissions disabled; no event POST sent',flush=True)
 assert not errors,errors
 b.close()
