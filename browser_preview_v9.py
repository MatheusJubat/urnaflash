import json
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).parent
html=(root/'public/index.html').read_text().replace('<link rel="stylesheet" href="/styles.css">','<style>'+(root/'public/styles.css').read_text()+'</style>').replace('<script defer src="/app.js"></script>','')
js=(root/'public/app.js').read_text()
bootstrap='''<script>
window.history.replaceState=()=>{};
window.fetch=async function(resource){
 const uri=String(resource),url=new URL('https://fixture.test'+uri),q=url.searchParams;
 const ok=data=>({ok:true,status:200,json:async()=>data});
 const candidates=[{name:'CANDIDATURA A',party:'PARTIDO A',number:'11',percentage:52.61,votes:25000000,sqcand:'',elected:false},{name:'CANDIDATURA B',party:'PARTIDO B',number:'22',percentage:42.1,votes:20000000,sqcand:'',elected:false}];
 if(uri.includes('/api/results')){
   const round=q.get('round');if(round==='2')return ok({state:'awaiting',message:'Aguardando publicação de resultados'});
   return ok({state:'ok',round:1,office:q.get('office'),uf:q.get('uf'),progress:74.3,finished:false,sectionsCounted:743,sectionsTotal:1000,sectionsRemaining:257,validVotes:47500000,blankVotes:2000000,nullVotes:1500000,totalVotes:51000000,generatedAt:'08/10/2026 20:20',decision:{kind:'none'},candidates});
 }
 if(uri.includes('/api/map'))return ok({state:'ok',states:Array.from([['ac','Acre'],['al','Alagoas'],['ap','Amapá'],['am','Amazonas'],['ba','Bahia'],['ce','Ceará'],['df','Distrito Federal'],['es','Espírito Santo'],['go','Goiás'],['ma','Maranhão'],['mt','Mato Grosso'],['ms','Mato Grosso do Sul'],['mg','Minas Gerais'],['pa','Pará'],['pb','Paraíba'],['pr','Paraná'],['pe','Pernambuco'],['pi','Piauí'],['rj','Rio de Janeiro'],['rn','Rio Grande do Norte'],['rs','Rio Grande do Sul'],['ro','Rondônia'],['rr','Roraima'],['sc','Santa Catarina'],['sp','São Paulo'],['se','Sergipe'],['to','Tocantins']],([uf,name],i)=>({uf,state:'ok',progress:74.3,finished:false,sectionsCounted:743,sectionsTotal:1000,sectionsRemaining:257,leader:{name:'CANDIDATURA A',party:'PARTIDO A',number:'11',percentage:52.61,votes:10000+i*10},second:{name:'CANDIDATURA B',party:'PARTIDO B',number:'22',percentage:42.1,votes:8000+i*20},candidates:[{...candidates[0],votes:10000+i*10},{...candidates[1],votes:8000+i*20}]}))});
 if(uri.includes('/api/geo/'))return ok({features:[]});
 if(uri.includes('/api/auto'))return ok({unlocked:false,recommendedRound:1});
 if(uri.includes('/api/governor-status'))return ok({state:'unknown',message:'Sem informação disponível'});
 if(uri.includes('/candidate-photos.json'))return ok({});
 if(uri.includes('/api/cities/search'))return ok({state:'ok',cities:[]});
 if(uri.includes('/api/municipalities'))return ok({state:'ok',municipalities:[]});
 return ok({});
};
</script>'''
html=html.replace('</body>',bootstrap+'<script>'+js+'</script></body>')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 for label,w,h in [('desktop',1400,900),('mobile',390,844)]:
  page=b.new_page(viewport={'width':w,'height':h})
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content(html,wait_until='domcontentloaded');page.wait_for_timeout(350)
  print(label,'status',page.locator('#focusTitle').inner_text(),'insights',page.locator('#estatisticas').is_visible(),'list folded',not page.locator('#candidateDisclosure').get_attribute('open'),'horizontal',page.evaluate('document.documentElement.scrollWidth-window.innerWidth'),'errors',errors)
  assert page.locator('#focusCandidates .focus-person').count()==2
  assert page.locator('#estatisticas').is_visible()
  assert page.evaluate('document.documentElement.scrollWidth<=window.innerWidth')
  assert not errors,errors
  page.screenshot(path=str(root/f'preview-{label}.png'),full_page=False)
  page.locator('#candidateDisclosure summary').click()
  assert page.locator('#candidateList .candidate').count()==2
  page.locator('#candidateDisclosure summary').click()
  page.locator('#filterDisclosure summary').click()
  page.locator('#officeButtons [data-office="governador"]').click()
  assert page.locator('#officeStatePicker').is_visible()
  page.locator('#officeStateOptions button').filter(has_text='Paraná').click()
  assert 'Paraná' in page.locator('#electionHeading').inner_text()
  page.locator('#officeButtons [data-office="presidente"]').click()
  page.locator('#turnButtons [data-round="2"]').click()
  assert 'Aguardando' in page.locator('#focusTitle').inner_text()
  assert not errors,errors
  print(label,'PASS: list, state picker, second round preview, 0 errors')
  page.close()
 b.close()
