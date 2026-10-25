"""Browser checks use test-only listings. No real events or POST requests are submitted."""
from playwright.sync_api import sync_playwright
import json, subprocess, os
from datetime import datetime, timezone
BASE_URL=os.environ.get('MBA_TEST_URL','http://127.0.0.1:8000/')
ASSET_CACHE={}
association={'approved':True,'host':'association','title':'Association test night','venue':'Test venue','address':'1 Test Street, Melbourne VIC','startsAt':'2099-01-01T18:00:00+11:00','endsAt':'2099-01-01T21:00:00+11:00','description':'<img src=x onerror=alert(1)>'}
tournament={'approved':True,'title':'Approved test tournament','organiser':'Example club','startDate':'2099-02-01','venue':'Test venue','address':'2 Tournament Street, Melbourne VIC','sourceUrl':'https://club.example/events/approved'}
listings={'associationEvents':[association,{**association,'approved':False,'title':'Unapproved association event'},{**association,'host':'community','title':'Member event'}],
'sisterClubTournaments':[tournament,{**tournament,'title':'Ongoing approved tournament','startDate':'2026-10-24','endDate':'2026-10-25'},{**tournament,'approved':False,'title':'Unapproved tournament'},{**tournament,'title':'Expired tournament','startDate':'2026-10-24'},{**tournament,'title':'Unsafe link','sourceUrl':'javascript:alert(1)'}]}
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page();errors=[];posts=[]
 page.clock.set_fixed_time(datetime(2026,10,25,0,0,tzinfo=timezone.utc))
 page.on('pageerror',lambda e:errors.append(str(e)))
 def route(r):
  url=r.request.url
  if r.request.method=='POST':posts.append(url);return r.abort()
  if url.endswith('/events-config.js'):return r.fulfill(content_type='application/javascript',body='window.MBA_EVENTS_CONFIG='+json.dumps(listings)+';')
  if url.startswith('https://script.google.com/'):
   return r.fulfill(json={'matches':[],'members':[],'eventsVersion':1,'events':[{**association,'title':'Legacy member event','status':'confirmed'}]})
  if 'maps.google.com' in url:return r.fulfill(content_type='text/html',body='<p>Map test double</p>')
  if url.startswith('https://'):
   if url not in ASSET_CACHE:ASSET_CACHE[url]=subprocess.check_output(['curl','--fail','--silent','--show-error','--location','--max-time','25',url])
   return r.fulfill(body=ASSET_CACHE[url])
  r.continue_()
 page.route('**/*',route)
 for width in [390,1440]:
  page.set_viewport_size({'width':width,'height':900});page.goto(BASE_URL,wait_until='networkidle',timeout=60000)
  assert page.locator('#addEventBtn, #eventDialog, #eventForm').count()==0
  assert page.locator('#eventsList article').count()==3
  assert page.locator('#sister-club-tournaments, #sisterTournamentsList').count()==0
  assert page.locator('#eventsList img').count()==0
  assert 'Legacy member event' not in page.locator('#eventsList').inner_text()
  assert page.locator('#eventsList button').all_text_contents()[0].find('Ongoing approved tournament')>=0
  page.get_by_role('button',name='Show Association test night on the map',exact=True).click()
  assert page.locator('#melbourneMap iframe').get_attribute('src').startswith('https://maps.google.com/maps?q=1%20Test')
  assert 'Hosted by Melbourne Backgammon Association' in page.locator('#eventsList').inner_text()
  page.get_by_role('button',name='Show Approved test tournament on the map',exact=True).click()
  assert page.locator('#melbourneMap iframe').get_attribute('src').startswith('https://maps.google.com/maps?q=2%20Tournament')
  assert 'Hosted by Example club' in page.locator('#eventsList').inner_text()
  assert page.locator('#eventsList button[aria-pressed="true"]').count()==1
  assert page.locator('#eventsList a[href="https://club.example/events/approved"]').count()==2
  assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
  assert not posts
  print(width,'PASS: one mixed calendar, both organisers select the same map, no separate section/submission UI, date and approval filtering.',flush=True)
 listings={'associationEvents':[],'sisterClubTournaments':[]}
 page.goto(BASE_URL,wait_until='networkidle',timeout=60000)
 assert page.locator('#eventsList article').count()==0
 assert 'No upcoming events listed' in page.locator('#eventsStatus').inner_text()
 assert page.locator('#melbourneMap iframe').count()==0
 assert page.locator('#eventMapPanel').is_hidden()
 assert not errors,errors
 print('PASS: empty approved lists publish no candidate events.')
 b.close()
