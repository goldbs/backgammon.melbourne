"""Read-only checks of approved recurring listings; maps/backend use test doubles."""
from playwright.sync_api import sync_playwright
import subprocess, os
from datetime import datetime, timezone
BASE_URL=os.environ.get('MBA_TEST_URL','http://127.0.0.1:8000/')
ASSET_CACHE={}
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page();errors=[];posts=[]
 page.clock.set_fixed_time(datetime(2026,10,25,0,0,tzinfo=timezone.utc))
 page.on('pageerror',lambda e:errors.append(str(e)))
 def route(r):
  url=r.request.url
  if r.request.method=='POST':posts.append(url);return r.abort()

  if url.startswith('https://script.google.com/'):
   return r.fulfill(json={'matches':[],'members':[],'eventsVersion':1,'events':[]})
  if 'maps.google.com' in url:return r.fulfill(content_type='text/html',body='<p>Map test double</p>')
  if url.startswith('https://'):
   if url not in ASSET_CACHE:ASSET_CACHE[url]=subprocess.check_output(['curl','--fail','--silent','--show-error','--location','--max-time','25',url])
   return r.fulfill(body=ASSET_CACHE[url])
  r.continue_()
 page.route('**/*',route)
 for width in [390,1440]:
  page.set_viewport_size({'width':width,'height':900})
  for instant,expected in [('2026-10-25T09:00:00+00:00',['26 Oct 2026','29 Oct 2026','8 Nov 2026']),('2026-12-24T00:00:00+00:00',['27 Dec 2026','28 Dec 2026','7 Jan 2027']),('2026-10-26T09:00:00+00:00',['29 Oct 2026','2 Nov 2026','8 Nov 2026'])]:
   page.clock.set_fixed_time(datetime.fromisoformat(instant))
   page.goto(BASE_URL,wait_until='networkidle',timeout=60000)
   assert page.locator('#eventsList article').count()==3
   cards=page.locator('#eventsList article')
   for i,date in enumerate(expected):assert date in cards.nth(i).inner_text(),cards.nth(i).inner_text()
   for i in range(3):
    cards.nth(i).get_by_role('button').click()
    assert page.locator('#melbourneMap iframe').get_attribute('src').startswith('https://maps.google.com/maps?q=')
    address=cards.nth(i).locator('a').first.get_attribute('href').split('destination=')[1]
    assert address in page.locator('#melbourneMap iframe').get_attribute('src')
    assert page.locator('#selectedEventDetails').is_visible()
    assert page.locator('#selectedEventDetails').get_attribute('open') is None
    assert cards.nth(i).get_by_role('button').inner_text().split('\n')[1] in page.locator('#selectedEventDescription').text_content()
   assert page.locator('#eventsList button[aria-pressed="true"]').count()==1
   assert 'Masters Tournament' not in page.locator('#eventsList').inner_text()
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   if width >= 1024:
    assert abs(page.locator('#eventsList').bounding_box()['height'] - page.locator('.events-map-shell').bounding_box()['height']) < 100
   print(width,instant,'PASS: three approved listings, recurrence dates, closure exceptions and map selection',flush=True)
 assert not posts
 assert not errors,errors
 b.close()
