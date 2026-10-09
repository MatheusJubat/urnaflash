import json
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).parent
html=(root/'public/index.html').read_text().replace('<link rel="stylesheet" href="/styles.css">','<style>'+(root/'public/styles.css').read_text()+'</style>').replace('<script defer src="/app.js"></script>','')
js=(root/'public/app.js').read_text()
bootstrap='''<script>
window.history.replaceState=()=>{};
window.fetch=async function(resource){
 const uri=String(resource),u=new URL('https://fixture.test'+uri),q=u.searchParams;
 const ok=data=>({ok:true,status:200,json:async()=>data});
 const office=q.get('office')||'presidente', city=!!q.get('municipality');
 const candidates = office==='deputado-federal'||office==='deputado-estadual'||office==='deputado-distrital'?
   Array.from({length:26},(_,i)=>({name:i===19?'ALIEL MACHADO':'CANDIDATO '+String(i+1),party:i===19?'PV':'ABC',number:String(5000+i),percentage:Math.max(0.1,10-i/3),votes:1000-i*30,sqcand:'',elected:false})): 
   [{name:'PESSOA A',party:'ABC',number:'11',percentage:52.61,votes:25000,sqcand:'',elected:false},{name:'PESSOA B',party:'DEF',number:'22',percentage:42.1,votes:20000,sqcand:'',elected:false}];
 if(uri.includes('/api/results'))return ok(q.get('round')==='2'?{state:'awaiting',message:'Aguardando dados oficiais'}:
 {state:'ok',round:1,office,uf:q.get('uf'),municipality:q.get('municipality')||'',progress:100,finished:true,sectionsCounted:1000,sectionsTotal:1000,sectionsRemaining:0,validVotes:47500,blankVotes:2000,nullVotes:1500,totalVotes:51000,generatedAt:'08/10/2026 20:20',decision:{kind:'counted'},candidates});
 if(uri.includes('/api/map'))return ok({state:'ok',states:[]});
 if(uri.includes('/api/geo/'))return ok({features:[]});
 if(uri.includes('/api/auto'))return ok({unlocked:false,recommendedRound:1});
 if(uri.includes('/api/governor-status'))return ok({state:'unknown',message:'Sem informação disponível'});
 if(uri.includes('/candidate-photos.json'))return ok({});
 if(uri.includes('/api/cities/search'))return ok({state:'ok',cities:[{name:'CARAMBEÍ',uf:'pr',code:'75221'}]});
 if(uri.includes('/api/municipalities'))return ok({state:'ok',municipalities:[]});
 return ok({});
};
</script>'''
html=html.replace('</body>',bootstrap+'<script>'+js+'</script></body>')
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 for label,w,h in [('desktop',1365,900),('mobile',390,844)]:
  page=browser.new_page(viewport={'width':w,'height':h})
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content(html,wait_until='domcontentloaded');page.wait_for_timeout(150)
  assert not page.locator('#officeButtons [data-office="deputado-distrital"]').is_visible(), 'district not hidden outside df'
  page.locator('#cityQuery').fill('Carambei');page.wait_for_timeout(350)
  page.locator('#citySuggestions button').first.click();page.wait_for_timeout(120)
  assert not page.locator('#localVoteFinder').is_visible(), 'keep president screen simple'
  page.locator('#officeButtons [data-office="deputado-federal"]').click();page.wait_for_timeout(90)
  assert page.locator('#localVoteFinder').is_visible(), 'local finder must show for deputies'
  assert 'CARAMBEÍ' in page.locator('#localVoteTitle').inner_text()
  assert page.locator('#candidateDisclosure').get_attribute('open') is not None
  assert page.locator('#candidateList .candidate').count()==12
  assert page.locator('#localVoteFinder').is_visible()
  assert 'CARAMBEÍ' in page.locator('#candidateDetailTitle').inner_text()
  page.locator('#localVoteSearch').fill('aliel');page.wait_for_timeout(70)
  assert '1 candidaturas' in page.locator('#localVoteSearchStatus').inner_text()
  page.locator('#localVoteOpen').click();page.wait_for_timeout(100)
  assert page.locator('#candidateList .candidate').count()==1
  assert 'ALIEL MACHADO' in page.locator('#candidateList').inner_text()
  assert 'nesta cidade' in page.locator('#candidateList').inner_text()
  page.locator('#officeButtons [data-office="senador"]').click();page.wait_for_timeout(120)
  assert 'CARAMBEÍ' in page.locator('#quickOverviewLabel').inner_text()
  page.locator('#officeButtons [data-office="presidente"]').click();page.wait_for_timeout(100)
  assert 'CARAMBEÍ' in page.locator('#quickOverviewLabel').inner_text()
  assert not page.locator('#officeButtons [data-office="deputado-distrital"]').is_visible()
  print(f'{label}: city vote search + federal deputy + senator + president PASS; overflow={page.evaluate("document.documentElement.scrollWidth-window.innerWidth")}; errors={errors}')
  assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth+1')
  assert not errors,errors
  page.screenshot(path=str(root/f'preview-city-{label}.png'),full_page=False)
  page.locator('#turnButtons [data-round="2"]').click();page.wait_for_timeout(90)
  assert not page.locator('#officeButtons [data-office="senador"]').is_visible()
  page.locator('#firstRoundOfficesBtn').click();page.wait_for_timeout(90)
  assert page.locator('#officeButtons [data-office="senador"]').is_visible()
  # Distrito Federal: distrital only in DF; estadual disappears.
  page.locator('#filterDisclosure summary').click()
  page.locator('#changePlaceBtn').click()
  page.locator('#officeStateOptions button').filter(has_text='Distrito Federal').click()
  page.wait_for_timeout(130)
  assert page.locator('#officeButtons [data-office="deputado-distrital"]').is_visible()
  assert not page.locator('#officeButtons [data-office="deputado-estadual"]').is_visible()
  page.locator('#officeButtons [data-office="deputado-distrital"]').click()
  page.wait_for_timeout(100)
  assert 'Distrito Federal' in page.locator('#electionHeading').inner_text()
  assert 'deputado distrital' in page.locator('#officeCaption').inner_text().lower()
  print(f'{label}: DF district-only PASS')
  page.close()
 browser.close()
