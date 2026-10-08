import test, { after } from 'node:test';
import assert from 'node:assert/strict';
process.env.NODE_ENV = 'test';
const {server} = await import('../server.mjs');
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base = `http://127.0.0.1:${server.address().port}`;
after(()=>new Promise(resolve=>server.close(resolve)));

test('renderiza homepage da UrnaFlash com metadados prontos',async()=>{
 const res=await fetch(base+'/');
 const html=await res.text();
 assert.equal(res.status,200);
 assert.match(html,/Eleições 2026: Apuração do 2º Turno ao Vivo \| UrnaFlash/);
 assert.match(html,/URNA<span>FLASH<\/span>/);
 assert.match(html,/property="og:image"/);
 assert.doesNotMatch(html,/\{\{PAGE_/);
});
test('cada estado tem HTML indexável próprio',async()=>{
 const res=await fetch(base+'/eleicoes-2026/parana');
 const html=await res.text();
 assert.equal(res.status,200);
 assert.match(html,/Eleições 2026 em Paraná: Apuração/);
 assert.match(html,/2º turno · Paraná/);
 assert.match(html,/rel="canonical" href="http:\/\/127\.0\.0\.1:/);
});
test('sitemap e robots apontam páginas estaduais',async()=>{
 const sitemap=await (await fetch(base+'/sitemap.xml')).text();
 const robots=await (await fetch(base+'/robots.txt')).text();
 assert.match(sitemap,/<urlset/);
 assert.match(sitemap,/eleicoes-2026\/minas-gerais/);
 assert.match(sitemap,/eleicoes-2026\/parana/);
 assert.match(robots,/Sitemap: http:/);
});
test('PWA entrega ícones e manifest',async()=>{
 for(const item of ['manifest.webmanifest','icon-192.png','icon-512.png','share.png','sw.js']){
  const res=await fetch(base+'/'+item); assert.equal(res.status,200,item);
 }
});
test('health e validações de API funcionam sem depender da internet',async()=>{
 const health=await(await fetch(base+'/api/health')).json();
 assert.deepEqual({ok:health.ok,service:health.service},{ok:true,service:'urnaflash'});
 assert.equal((await fetch(base+'/api/results?round=9&uf=sp')).status,400);
 assert.equal((await fetch(base+'/api/results?round=2&uf=xx')).status,400);
 assert.equal((await fetch(base+'/eleicoes-2026/nao-existe')).status,404);
});
