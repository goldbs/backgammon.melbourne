"""Galaxy handle and direct-profile link checks; leaderboard data uses a test double."""
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
   return r.fulfill(json={'matches':[],'members':['Steven Goldberg','Another Player'],'eventsVersion':1,'events':[]})
  if 'maps.google.com' in url:return r.fulfill(content_type='text/html',body='<p>Map test double</p>')
  if url.startswith('https://'):
   if url not in ASSET_CACHE:ASSET_CACHE[url]=subprocess.check_output(['curl','--fail','--silent','--show-error','--location','--max-time','25',url])
   return r.fulfill(body=ASSET_CACHE[url])
  r.continue_()
 page.route('**/*',route)
 b.contexts[0].grant_permissions(['clipboard-read','clipboard-write'],origin=BASE_URL.rstrip('/'))
 for width in [390,1440]:
  page.set_viewport_size({'width':width,'height':900})
  page.goto(BASE_URL,wait_until='networkidle',timeout=60000)
  cell=page.locator('#standingsBody td[data-galaxy-username="goldbs"]')
  cell.wait_for(state='visible')
  assert cell.count()==1
  assert 'Steven Goldberg' in cell.inner_text()
  assert cell.get_by_role('link').get_attribute('href')=='https://www.backgammongalaxy.com/play/page_profile?id=6566e056a5e9320025e57b77'
  assert 'Galaxy profile: goldbs' in cell.get_by_role('link').get_attribute('aria-label')
  copy=cell.get_by_role('button',name='Copy Galaxy username goldbs for Steven Goldberg',exact=True)
  copy.click()
  assert page.evaluate('navigator.clipboard.readText()')=='goldbs'
  assert 'Copied' in cell.inner_text()
  page.evaluate("document.querySelector('#standingsBody').innerHTML='<tr><td>1</td><td>Steven Goldberg</td><td>1 - 0</td><td>100%</td><td>2.0</td></tr><tr><td>2</td><td>Another Player</td><td>0 - 1</td><td>0%</td><td>3.0</td></tr>'")
  page.wait_for_timeout(100)
  assert page.locator('#standingsBody [data-galaxy-username]').count()==1
  assert page.locator('#standingsBody a').count()==1
  page.evaluate("() => { navigator.clipboard.writeText=()=>Promise.reject(new Error('test denied')); }")
  cell.get_by_role('button').click()
  page.wait_for_timeout(100)
  assert 'Copy manually: goldbs' in cell.inner_text()
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  print(width,'PASS: Steven-only Galaxy handle, copy, fallback, participant-supplied direct profile link, no duplicates after leaderboard reload',flush=True)
  # Restore the real browser clipboard implementation before the next viewport.
  page.reload(wait_until='networkidle')
 assert not errors,errors
 assert not posts
 b.close()
