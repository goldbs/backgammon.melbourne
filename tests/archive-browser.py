"""Archive layout checks with fixture matches and test-only analysis links."""
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
 from playwright.sync_api import expect
 fixtures=[
  {'date':'2026-10-26T00:00:00Z','player1':'Steven Goldberg','player2':'Daniel Wroby','score1':7,'score2':3,'pr1':5.2,'pr2':'6.4','format':'Rated','blissAnalysisUrl':'https://analysis.example.test/match/one'},
  {'date':'2026-10-25T00:00:00Z','player1':'Eric Berkhinfand','player2':'Bryce Adams','score1':5,'score2':2,'pr1':'','pr2':None,'format':'Casual'},
  {'date':'2026-10-24T00:00:00Z','player1':'Greg Sacks','player2':'Daniel Kobrin','score1':0,'score2':7,'pr1':0,'pr2':'','format':'Rated'},
  {'date':'2026-10-23T00:00:00Z','player1':'Yona Takac','player2':'Steven Goldberg','score1':3,'score2':5,'pr1':'bad','pr2':2.01,'blissAnalysisUrl':'javascript:alert(1)'}]
 for width in [320,390,1440]:
  page.set_viewport_size({'width':width,'height':900})
  page.goto(BASE_URL,wait_until='networkidle',timeout=60000)
  page.evaluate('(matches)=>renderMatchesTable(matches)',fixtures)
  archive=page.locator('#matchArchiveContainer')
  assert archive.locator('thead th').all_text_contents()==['Player','PR','Score']
  for heading in archive.locator('thead th').all():
   assert heading.evaluate('(e)=>e.scrollWidth<=e.clientWidth')
  assert archive.locator('tbody').count()==4
  assert archive.bounding_box()['width']<=700
  assert archive.locator('img[src="bliss.jpeg"]').count()==1
  assert 'Powered by Bliss' in archive.inner_text()
  assert archive.locator('tbody').nth(1).locator('.archive-analysis').count()==0
  assert archive.locator('.archive-player-row').count()==8
  assert archive.locator('tbody').nth(0).locator('.archive-pr').all_text_contents()==['5.20','6.40']
  assert archive.locator('tbody').nth(1).locator('.archive-pr').all_text_contents()==['—','—']
  assert archive.locator('tbody').nth(2).locator('.archive-pr').all_text_contents()==['0.00','—']
  assert archive.locator('tbody').nth(2).locator('.archive-score').all_text_contents()==['0','7']
  assert archive.locator('tbody').nth(3).locator('.archive-pr').all_text_contents()==['—','2.01']
  assert archive.locator('a').count()==1
  assert archive.locator('a').get_attribute('href')=='https://analysis.example.test/match/one'
  assert 'Link can be added' in archive.locator('tbody').nth(2).inner_text()
  assert archive.locator('.archive-player-row').first.locator('td').last.get_attribute('class').find('archive-score')>=0
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  page.locator('#matches').screenshot(path=f'/tmp/archive-layout-{width}.png')
  # Zero is a genuine PR in the selected player's average.
  page.evaluate('(matches)=>renderMatchesTable(matches,true,"Greg Sacks")',fixtures)
  assert '0.00' in page.locator('#archivePlayerSummary').inner_text()
  # Text and URLs in the new archive must not become executable markup.
  page.evaluate('()=>renderMatchesTable([{player1:"<img src=x onerror=alert(1)>",player2:"Test",score1:1,score2:0,pr1:0,format:"<b>Casual</b>",blissAnalysisUrl:"https://name:password@example.test/match"}])')
  assert archive.locator('tbody img, tbody b, tbody a').count()==0
  assert '<img' in archive.inner_text()
  print(width,'PASS: aligned player/PR/score rows, missing/partial/zero PR, Bliss link/placeholder, safe rendering and no overflow',flush=True)
 assert not errors,errors
 assert not posts
 b.close()
