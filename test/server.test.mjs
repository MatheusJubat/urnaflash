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
 assert.equal((await (await req('/api/health')).json()).version,'3.0.0');
 const r=await req('/sitemap.xml');assert.equal(r.status,200);assert.match(await r.text(),/eleicoes-2026\/acre/);
});
test('API rejeita parametros indevidos',async()=>{
 assert.equal((await req('/api/results?round=3&uf=br')).status,400);
 assert.equal((await req('/api/results?round=1&uf=../')).status,400);
 assert.equal((await req('/api/municipalities?uf=../')).status,400);
 assert.equal((await req('/api/geo/cities?uf=../')).status,400);
});
test('HTML tem seletor de cargo, mapa, modo escuro e anuncio',async()=>{
 const html=await (await req('/')).text();
 for(const part of ['id="geoMap"','id="officeSelect"','id="citySelect"','id="themeToggle"','id="advertBtn"'])assert.ok(html.includes(part),part);
 assert.ok(!html.includes('manifest.webmanifest'));
});
