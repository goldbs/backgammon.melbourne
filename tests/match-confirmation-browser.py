"""Match submission safeguards and logo display; no real emails or records."""
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
  if r.request.method=='POST':
   import json
   posts.append(json.loads(r.request.post_data))
   if mode=='network-error':return r.abort()
   return r.fulfill(json=reply)

  if url.startswith('https://script.google.com/'):
   return r.fulfill(json={'matches':[],'members':['Steven Goldberg','Daniel Wroby'],'eventsVersion':1,'events':[],'matchConfirmationVersion':2})
  if 'maps.google.com' in url:return r.fulfill(content_type='text/html',body='<p>Map test double</p>')
  if url.startswith('https://'):
   if url not in ASSET_CACHE:ASSET_CACHE[url]=subprocess.check_output(['curl','--fail','--silent','--show-error','--location','--max-time','25',url])
   return r.fulfill(body=ASSET_CACHE[url])
  r.continue_()
 page.route('**/*',route)
 from playwright.sync_api import expect
 reply={'status':'success','initialStatus':'Pending','requiredConfirmations':2}
 mode='normal'
 for width in [390,1440]:
  page.set_viewport_size({'width':width,'height':1000})
  page.goto(BASE_URL,wait_until='networkidle',timeout=60000)
  logo=page.locator('.hero-logo')
  assert logo.get_attribute('src')=='logo_graphic.png'
  assert logo.evaluate('(e)=>e.naturalWidth')==1254
  assert logo.evaluate('(e)=>getComputedStyle(e).objectFit')=='contain'
  logo.hover()
  assert logo.evaluate('(e)=>getComputedStyle(e).transform')=='none'
  page.locator('#recordMatchNav').click()
  def fill():
   page.locator('#player1Input').fill('Steven Goldberg')
   page.locator('#player2Input').fill('Daniel Wroby')
   page.locator('#score1Input').fill('7')
   page.locator('#score2Input').fill('3')
   page.locator('#pr1Input').fill('0')
  fill();count=len(posts)
  page.locator('#submitBtn').click()
  expect(page.locator('#matchFormStatus')).to_contain_text('until both players confirm')
  assert len(posts)==count+1
  assert len(posts[-1]['requestId'])==48
  assert posts[-1]['pr1']=='0'
  assert page.locator('#matchArchiveContainer tbody').count()==0
  assert page.locator('#player1Input').input_value()==''
  fill();reply={'status':'error','error':'Both players need separate registered email addresses.'}
  page.locator('#submitBtn').click()
  expect(page.locator('#matchFormStatus')).to_contain_text('separate registered email addresses')
  assert page.locator('#player1Input').input_value()=='Steven Goldberg'
  first_id=posts[-1]['requestId']
  mode='network-error'
  page.locator('#submitBtn').click()
  expect(page.locator('#matchFormStatus')).to_contain_text('Check for confirmation emails')
  assert posts[-1]['requestId']==first_id
  mode='normal';reply={'status':'success','initialStatus':'Confirmed'}
  page.locator('#submitBtn').click()
  expect(page.locator('#matchFormStatus')).to_contain_text('couldn’t verify')
  assert page.locator('#player1Input').input_value()=='Steven Goldberg'
  count=len(posts)
  page.locator('#player2Input').fill('Steven Goldberg')
  page.locator('#submitBtn').click()
  expect(page.locator('#matchFormStatus')).to_contain_text('two different players')
  assert len(posts)==count
  page.locator('#player2Input').fill('Unregistered Guest')
  page.locator('#submitBtn').click()
  expect(page.locator('#matchFormStatus')).to_contain_text('join the community first')
  assert len(posts)==count
  page.evaluate('matchConfirmationVersion=0')
  fill();page.locator('#submitBtn').click()
  expect(page.locator('#matchFormStatus')).to_contain_text('temporarily unavailable')
  assert len(posts)==count
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  reply={'status':'success','initialStatus':'Pending','requiredConfirmations':2}
  print(width,'PASS: crisp native logo sizing, pending-only result receipt, errors preserve form, retries keep request ID, no optimistic publication',flush=True)
 assert not errors,errors
 b.close()
