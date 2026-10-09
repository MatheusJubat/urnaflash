import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
test('visão resumida de eleitos, sem concatenar dezenas de nomes',()=>{
  assert.match(js,/candidaturas marcadas como eleitas pelo TSE/);
  assert.doesNotMatch(js,/elected\.map\(c=>c\.name\)\.join/);
  assert.match(js,/shownCandidateCount\+=12/);
  assert.match(js,/onlyElected\?latestCandidates\.filter/);
});
test('o mapa aparece antes da lista longa de candidatos, com navegação no celular',()=>{
  assert.ok(html.indexOf('id="electionOutcome"')<html.indexOf('id="mapa"'));
  assert.ok(html.indexOf('id="mapa"')<html.indexOf('id="candidateList"'));
  for(const id of ['officeStatePicker','electedFilterBtn','candidateCount','mapa','candidatos'])assert.ok(html.includes(`id="${id}"`));
  assert.match(html,/mobile-quicknav/);
});
test('botão trocar estado abre seletor contextual, sem remeter ao topo',()=>{
  assert.match(js,/pickerForcedOpen=!pickerForcedOpen/);
  assert.match(js,/officeStatePicker'\)\.scrollIntoView/);
  assert.doesNotMatch(js,/\$\('#changePlaceBtn'\)\.addEventListener\('click',\(\)=>\{if\(uf/);
});
test('deputado distrital redireciona para DF e primeiro turno sem botão bloqueado',()=>{
  assert.match(js,/if\(value==='deputado-distrital'\)/);
  assert.match(js,/uf='df';municipality='';cityName=''/);
  assert.match(js,/if\(round===2\)\{round=1;manualTurn=true/);
  assert.doesNotMatch(js,/code==='deputado-distrital'&&uf!=='df'/);
});
