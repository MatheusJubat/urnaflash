import test, { after } from 'node:test';
import assert from 'node:assert/strict';
process.env.NODE_ENV='test';
const {server}=await import('../server.mjs');
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
after(()=>new Promise(resolve=>server.close(resolve)));

test('homepage contém UrnaFlash, SEO e tema', async()=>{
  const res=await fetch(base+'/');const html=await res.text();
  assert.equal(res.status,200);
  assert.match(html,/Eleições 2026: Apuração do 2º Turno ao Vivo \| UrnaFlash/);
  assert.match(html,/A apuração,/);
  assert.match(html,/id="themeToggle"/);
  assert.match(html,/id="advertBtn"/);
  assert.doesNotMatch(html,/id="installBtn"/);
  assert.doesNotMatch(html,/contatournaflash@gmail\.com/);
  assert.match(html,/property="og:image"/);
  assert.doesNotMatch(html,/\{\{PAGE_/);
});
test('cada estado recebe metadados e página indexável', async()=>{
  const res=await fetch(base+'/eleicoes-2026/parana');const html=await res.text();
  assert.equal(res.status,200);
  assert.match(html,/Eleições 2026 em Paraná: Apuração/);
  assert.match(html,/2º turno · Paraná/);
  assert.match(html,/rel="canonical" href="http:\/\/127\.0\.0\.1:/);
});
test('sitemap e robots apontam páginas por estado',async()=>{
  const sitemap=await(await fetch(base+'/sitemap.xml')).text();
  const robots=await(await fetch(base+'/robots.txt')).text();
  assert.match(sitemap,/<urlset/);
  assert.match(sitemap,/eleicoes-2026\/minas-gerais/);
  assert.match(sitemap,/eleicoes-2026\/parana/);
  assert.match(robots,/Sitemap: http:/);
});
test('arquivos necessários de UI são servidos',async()=>{
  for(const item of ['app.js','styles.css','icon.svg','share.png']){
    const res=await fetch(base+'/'+item);assert.equal(res.status,200,item);
  }
  const app=await(await fetch(base+'/app.js')).text();
  assert.match(app,/const emailAddress/);
  assert.match(app,/setTheme/);
  assert.match(app,/cleanupPreviousPWA/);
});
test('health e validações de API não dependem da internet',async()=>{
  const health=await(await fetch(base+'/api/health')).json();
  assert.deepEqual({ok:health.ok,service:health.service,version:health.version},{ok:true,service:'urnaflash',version:'2.0.0'});
  assert.equal((await fetch(base+'/api/results?round=9&uf=sp')).status,400);
  assert.equal((await fetch(base+'/api/results?round=2&uf=xx')).status,400);
  assert.equal((await fetch(base+'/eleicoes-2026/nao-existe')).status,404);
});
