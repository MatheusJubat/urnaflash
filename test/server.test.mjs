import test from 'node:test';import assert from 'node:assert/strict';
process.env.NODE_ENV='test';const {server}=await import('../server.mjs');
const {secondRoundUnlocked}=await import('../schedule.mjs');
let origin;
test.before(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));origin=`http://127.0.0.1:${server.address().port}`;});
test.after(async()=>{await new Promise(r=>server.close(r));});
async function req(uri){return fetch(origin+uri);}
test('pagina inicial e paginas SEO regionais respondem',async()=>{
 const a=await req('/');assert.equal(a.status,200);assert.match(await a.text(),/A eleição,/);
 const b=await req('/eleicoes-2026/parana');assert.equal(b.status,200);assert.match(await b.text(),/Eleições 2026 em Paraná/);
});
test('rotas de saúde e sitemap funcionam',async()=>{
 assert.equal((await (await req('/api/health')).json()).version,'7.0.0');
 const r=await req('/sitemap.xml');assert.equal(r.status,200);assert.match(await r.text(),/eleicoes-2026\/acre/);
});
test('API rejeita parametros indevidos',async()=>{
 assert.equal((await req('/api/results?round=3&uf=br')).status,400);
 assert.equal((await req('/api/results?round=1&uf=../')).status,400);
 assert.equal((await req('/api/municipalities?uf=../')).status,400);
 assert.equal((await req('/api/geo/cities?uf=../')).status,400);
 assert.equal((await req('/api/cities/search?uf=../&q=Carambei')).status,400);
});
test('HTML tem seletor de cargo, mapa, modo escuro e anuncio',async()=>{
 const html=await (await req('/')).text();
 for(const part of ['id="geoMap"','id="officeButtons"','id="cityQuery"','id="themeToggle"','id="advertBtn"'])assert.ok(html.includes(part),part);
 assert.ok(!html.includes('manifest.webmanifest'));
});

test('busca curta nao consome catalogo do TSE',async()=>{const response=await req('/api/cities/search?q=x');assert.equal(response.status,200);assert.deepEqual((await response.json()).cities,[]);});

test('mapa estadual tem exploração progressiva e campos de acessibilidade',async()=>{
 const html=await (await req('/')).text();
 for(const id of ['id="cityMapPanel"','id="explorerSearch"','id="explorerSuggestions"','id="explorerSeeResult"','id="explorerZoomIn"','id="cityMapClose"'])assert.ok(html.includes(id),id);
 assert.ok(html.indexOf('id="resultados"')<html.indexOf('id="mapa"'));
});

test('API de governador exige UF e cartões acessíveis constam no HTML',async()=>{
 const invalid=await req('/api/governor-status?uf=br');assert.equal(invalid.status,400);
 const html=await (await req('/')).text();
 for(const id of ['id="stateRaceCard"','id="stateRaceButton"','id="stateRaceSummary"','id="stateRaceSummaryButton"'])assert.ok(html.includes(id),id);
});


test('busca nacional destaca capitais de cinco regioes sem substituir busca livre', async()=>{
 const html=await (await req('/')).text();
 for(const pair of ['Manaus|am','Salvador|ba','Goiânia|go','São Paulo|sp','Porto Alegre|rs']){
   const [capital,uf]=pair.split('|');
   assert.ok(html.includes(`data-capital="${capital}" data-uf="${uf}"`),pair);
 }
 assert.ok(html.includes('placeholder="Ex.: São Paulo, Salvador ou Manaus"'));
 assert.ok(!html.includes('Ex.: Carambeí, Curitiba, Campinas'));
 const js=await (await req('/app.js')).text();
 assert.ok(js.includes('STATE_CAPITALS'));
 assert.ok(js.includes('queryCities(true,btn.dataset.uf,true)'));
 assert.ok(js.includes("$('#explorerSearch').placeholder='Ex.: '"));
});

test('botao do segundo turno fica clicavel para testes e mostra aviso de previa',async()=>{
  const html=await (await req('/')).text();
  const button=html.match(/<button[^>]+data-round="2"[^>]*>/)?.[0];
  assert.ok(button,'botão do segundo turno existe');
  assert.doesNotMatch(button,/\sdisabled(?:\s|=|>)/,'botão não pode estar desabilitado');
  assert.match(html,/Prévia disponível para testar|Você já pode explorar a prévia/);
  const js=await (await req('/app.js')).text();
  assert.match(js,/manualTurn=\['1','2'\]\.includes\(params\.get\('turno'\)\)/,'link ?turno=2 acessível antes da data');
});

test('API de prévia do segundo turno não fornece votos anteriores à eleição',async()=>{
  if(secondRoundUnlocked())return; // A partir de 25/10, a API consulta as fontes oficiais.
  const result=await (await req('/api/results?round=2&uf=br&office=presidente')).json();
  assert.equal(result.preview,true);assert.equal(result.state,'awaiting');
  assert.ok(!result.candidates?.length);
  const stateMap=await (await req('/api/map?round=2')).json();
  assert.equal(stateMap.preview,true);assert.deepEqual(stateMap.states,[]);
  const auto=await (await req('/api/auto')).json();
  assert.equal(auto.recommendedRound,1,'o primeiro turno segue padrão antes do dia 25');
});


test('mapa municipal tem seleção única sem legenda nem botão de alternância',async()=>{
  const html=await (await req('/')).text();
  assert.doesNotMatch(html,/id="explorerShowCompared"/);
  assert.doesNotMatch(html,/class="explorer-color-controls"/);
  assert.match(html,/id="explorerStateVotes"/);
  assert.match(html,/id="scopeEyebrow"/);
  const js=await (await req('/app.js')).text();
  assert.doesNotMatch(js,/showConsultedCities/);
  assert.match(js,/isSelected=cityGeoUF===uf&&item.code===municipality/);
  assert.match(js,/if\(selectedCityPath\)svg.append\(selectedCityPath\)/);
  assert.match(js,/function renderScopeSummary\(\)/);
});
