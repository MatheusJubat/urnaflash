import test from 'node:test';import assert from 'node:assert/strict';
process.env.NODE_ENV='test';const {server}=await import('../server.mjs');
let origin;
test.before(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));origin=`http://127.0.0.1:${server.address().port}`;});
test.after(async()=>{await new Promise(r=>server.close(r));});
async function req(uri){return fetch(origin+uri);}
test('pagina inicial e paginas SEO regionais respondem',async()=>{
 const a=await req('/');assert.equal(a.status,200);assert.match(await a.text(),/Todo o Brasil em um mapa/);
 const b=await req('/eleicoes-2026/parana');assert.equal(b.status,200);assert.match(await b.text(),/Eleições 2026 em Paraná/);
});
test('rotas de saúde e sitemap funcionam',async()=>{
 assert.equal((await (await req('/api/health')).json()).version,'6.1.0');
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
 assert.ok(html.indexOf('id="cityMapPanel"')<html.indexOf('id="resultados"'));
});

test('API de governador exige UF e cartões acessíveis constam no HTML',async()=>{
 const invalid=await req('/api/governor-status?uf=br');assert.equal(invalid.status,400);
 const html=await (await req('/')).text();
 for(const id of ['id="stateRaceCard"','id="stateRaceButton"','id="stateRaceSummary"','id="stateRaceSummaryButton"'])assert.ok(html.includes(id),id);
});
