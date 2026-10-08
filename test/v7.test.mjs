import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalizeTseResult} from '../tse.mjs';
const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const js=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const server=await readFile(new URL('../server.mjs',import.meta.url),'utf8');
test('resultado prioritario antes do mapa e navegação via IDs estável',()=>{
 assert.ok(html.indexOf('id="resultados"')<html.indexOf('id="mapa"'));
 for(const key of ['quickOverviewLabel','candidateList','activeRegionFlag','cityMapPanel'])assert.ok(html.includes(`id="${key}"`),key);
});
test('bandeiras com fallback e CSP restrita ao repositório público',()=>{
 assert.match(js,/akagabi\/bandeira-dos-estados-do-brasil/);
 assert.match(js,/addEventListener\('error',\(\)=>img.replaceWith\(flag\)/);
 assert.match(server,/img-src 'self' data: https:\/\/raw.githubusercontent.com/);
});
test('fotos não são inventadas: manifesto local somente aceita seq verificada',()=>{
 assert.match(js,/candidatePhotos\.get\(String\(candidate\.sqcand/);
 assert.match(js,/candidate-photos\.json/);
 assert.match(js,/^.*?candidate-portrait/m);
});
test('EA20 preserva SQ_CANDIDATO para associar foto oficial',()=>{
 const raw={t:1,cdabr:'br',s:{ts:50,st:50},and:'f',carg:[{cd:1,agr:[{par:[{sg:'AAA',cand:[{n:13,sqcand:280001234567,nmu:'PESSOA A',vap:100,pvap:'51,0'}]}]}]}]};
 const r=normalizeTseResult(raw,{round:1,uf:'br',office:'presidente'});
 assert.equal(r.candidates[0].sqcand,'280001234567');
});
