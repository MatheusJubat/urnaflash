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
  assert.ok(html.includes('id="candidateDisclosure"'));
  assert.ok(html.indexOf('id="candidateDisclosure"')<html.indexOf('id="mapa"')); // lista permanece recolhida por padrão
  for(const id of ['officeStatePicker','electedFilterBtn','candidateCount','mapa','candidatos'])assert.ok(html.includes(`id="${id}"`));
  assert.match(html,/mobile-quicknav/);
});
test('botão trocar estado abre seletor contextual, sem remeter ao topo',()=>{
  assert.match(js,/pickerForcedOpen=!pickerForcedOpen/);
  assert.match(js,/officeStatePicker'\)\.scrollIntoView/);
  assert.doesNotMatch(js,/\$\('#changePlaceBtn'\)\.addEventListener\('click',\(\)=>\{if\(uf/);
});
test('deputado distrital aparece apenas no DF e só existe no 1º turno',()=>{
  assert.match(js,/district&&uf!=='df'/);
  assert.match(js,/round===2&&onlyFirst/);
  assert.match(js,/if\(uf==='df'&&office==='deputado-estadual'\)/);
  assert.match(js,/if\(uf!=='df'&&office==='deputado-distrital'\)/);
  assert.match(js,/value==='deputado-distrital'&&uf!=='df'/);
});
