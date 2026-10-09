from playwright.sync_api import sync_playwright
import subprocess,time,json,os
from pathlib import Path
root=Path(__file__).parent
proc=subprocess.Popen(['node','server.mjs'],cwd=str(root),stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,env={**os.environ,'PORT':'38127','HOST':'127.0.0.1','NODE_ENV':'test'})
state_list=[('ac','Acre'),('al','Alagoas'),('ap','Amapá'),('am','Amazonas'),('ba','Bahia'),('ce','Ceará'),('df','Distrito Federal'),('es','Espírito Santo'),('go','Goiás'),('ma','Maranhão'),('mt','Mato Grosso'),('ms','Mato Grosso do Sul'),('mg','Minas Gerais'),('pa','Pará'),('pb','Paraíba'),('pr','Paraná'),('pe','Pernambuco'),('pi','Piauí'),('rj','Rio de Janeiro'),('rn','Rio Grande do Norte'),('rs','Rio Grande do Sul'),('ro','Rondônia'),('rr','Roraima'),('sc','Santa Catarina'),('sp','São Paulo'),('se','Sergipe'),('to','Tocantins')]
def candidate(n,name,votes,percentage):return {'number':n,'name':name,'party':'PARTIDO','votes':votes,'percentage':percentage,'sqcand':'','elected':False,'runoffQualified':False}
def response(round=1, uf='br', office='presidente'):
 if round==2:return {'state':'awaiting','message':'Aguardando publicação oficial', 'round':2}
 a=candidate('11','Candidatura A',25000000,52.6)
 b=candidate('22','Candidatura B',20000000,42.1)
 if office.startswith('deputado'):a['elected']=True
 return {'state':'ok','candidates':[a,b], 'office':office,'uf':uf,'round':round,'progress':74.3,'sectionsCounted':743,'sectionsTotal':1000,'sectionsRemaining':257,'finished':False,'generatedAt':'08/10/2026 20:20','decision':{'kind':'none'},'validVotes':47500000,'totalVotes':51000000,'blankVotes':2000000,'nullVotes':1500000,'sourceUrl':'https://resultados.tse.jus.br/','electionId':'6257'}
def map_data():
 return {'state':'ok','round':1,'states':[{'uf':uf,'state':'ok','progress':74.3,'finished':False,'sectionsRemaining':257,'sectionsCounted':743,'sectionsTotal':1000,'leader':{'name':'Candidatura A','party':'PARTIDO','number':'11','percentage':52.6,'votes':10000},'second':{'name':'Candidatura B','number':'22','percentage':42.1,'votes':8000},'candidates':[candidate('11','Candidatura A',10000+(i*12),52.6),candidate('22','Candidatura B',8000+(i*20),42.1)]} for i,(uf,_) in enumerate(state_list)]}
try:
 for _ in range(35):
  try:
   import urllib.request
   urllib.request.urlopen('http://127.0.0.1:38127/api/health',timeout=.7);break
  except Exception:time.sleep(.18)
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'],headless=True)
  for width,height,label in [(1380,860,'desktop'),(390,844,'mobile')]:
   page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1)
   errs=[];page.on('pageerror',lambda e:errs.append(str(e)))
   def api(route):
    from urllib.parse import urlparse,parse_qs
    url=urlparse(route.request.url);q=parse_qs(url.query)
    if url.path=='/api/results':data=response(int(q.get('round',['1'])[0]),q.get('uf',['br'])[0],q.get('office',['presidente'])[0])
    elif url.path=='/api/map':data=map_data()
    elif url.path=='/api/geo/states':data={'type':'FeatureCollection','features':[]}
    elif url.path=='/api/governor-status':data={'state':'checking-first','round':1,'message':'Dados em verificação'}
    elif url.path=='/api/auto':data={'recommendedRound':1,'unlocked':False}
    elif url.path=='/api/cities/search':data={'state':'ok','cities':[]}
    elif url.path=='/api/municipalities':data={'state':'ok','municipalities':[]}
    else:data={}
    route.fulfill(status=200,content_type='application/json',body=json.dumps(data))
   page.route('**/api/**',api)
   page.goto('http://127.0.0.1:38127/',wait_until='domcontentloaded')
   page.wait_for_timeout(750)
   assert page.locator('#focusCandidates .focus-person').count()==2,'focus candidates failed'
   assert page.locator('#focusProgressValue').inner_text()=='74,30%'
   assert page.locator('#estatisticas').is_visible(),'insights missing'
   assert page.locator('#candidateDisclosure').get_attribute('open') is None,'list should be folded'
   assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'),'horizontal overflow'
   page.locator('#candidateDisclosure summary').click()
   assert page.locator('#candidateList .candidate').count()==2
   page.locator('#candidateDisclosure summary').click()
   page.locator('#officeButtons [data-office="governador"]').click()
   assert page.locator('#officeStatePicker').is_visible(),'state picker missing'
   page.locator('#officeStateOptions button').filter(has_text='Paraná').click()
   page.wait_for_timeout(100)
   assert 'Paraná' in page.locator('#electionHeading').inner_text()
   page.locator('#officeButtons [data-office="presidente"]').click()
   page.locator('#turnButtons [data-round="2"]').click()
   assert page.locator('#focusTitle').inner_text()=='Aguardando resultados do 2º turno'
   page.locator('#turnButtons [data-round="1"]').click()
   page.wait_for_timeout(120)
   page.screenshot(path=str(root/f'preview-{label}.png'),full_page=False)
   print(f'{label}: interactive OK; focus={page.locator("#focusTitle").inner_text()}; horizontal overflow=False; jsErrors={errs}')
   assert not errs, errs
   page.close()
  browser.close()
finally:proc.terminate();proc.wait(timeout=4)
