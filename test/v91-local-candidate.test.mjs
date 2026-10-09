import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeTseResult} from '../tse.mjs';
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
test('busca municipal de qualquer candidato fica visível, sem depender de top 8',()=>{
  for(const id of ['localVoteFinder','localVoteSearch','localVoteOpen','localVoteSearchStatus','officeQuickTitle','officeButtons'])assert.match(html,new RegExp(`id="${id}"`));
  assert.match(js,/candidateFilter=term/);
  assert.match(js,/const matches=term\?candidates\.filter/);
  assert.match(js,/if\(municipality\)\{\$\('#candidateDisclosure'\)\.open=true/);
  assert.match(js,/shownCandidateCount=municipality\?12:8/);
});
test('votos de município não são apresentados como eleito da cidade',()=>{
  assert.match(js,/!municipality&&candidate\.elected/);
  assert.match(js,/if\(!legislative\|\|municipality\)outcome\.hidden=true/);
  assert.match(js,/candidato.*municip/i);
});
test('cargos acompanham estado e 2o turno não força votação parlamentar inexistente',()=>{
  assert.match(js,/district&&uf!=='df'/);
  assert.match(js,/state&&uf==='df'/);
  assert.match(js,/round===2&&onlyFirst/);
  assert.match(js,/changeRound\(1\)/);
});
test('parser não corta os candidatos do município aos mais votados',()=>{
  const cands=Array.from({length:30},(_,i)=>({n:String(1000+i),nmu:i===26?'ALIEL MACHADO':`CANDIDATO ${i}`,vap:String(300-i),pvap:'0,1'}));
  const raw={t:1,cdabr:'75221',tpabr:'mu',and:'f',s:{ts:20,st:20},carg:[{cd:'6',agr:[{par:[{sg:'PV',cand:cands}]}]}]};
  const result=normalizeTseResult(raw,{round:1,uf:'pr',office:'deputado-federal',municipality:'75221'});
  assert.equal(result.candidates.length,30);
  assert.ok(result.candidates.find(c=>c.name==='ALIEL MACHADO'));
});
