import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stateMapRecord} from '../tse.mjs';
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
test('painel prioritario e lista extensa recolhida por padrao',()=>{
  for(const id of ['liveFocus','focusCandidates','focusProgressValue','focusVoteMini','insightsGrid','estatisticas']){
    if(id==='focusVoteMini')continue;
    assert.ok(html.includes(`id="${id}"`),id);
  }
  assert.ok(html.includes('<details class="surface candidate-disclosure" id="candidateDisclosure">'));
  assert.ok(html.indexOf('id="resultados"')<html.indexOf('id="liveFocus"'));
  assert.ok(html.indexOf('id="liveFocus"')<html.indexOf('id="mapa"'));
  assert.ok(!html.includes('id="candidateDisclosure" open'));
});
test('mapa transporta todos os candidatos de cada UF para analise imparcial',()=>{
  const d={state:'ok',progress:100,finished:true,sectionsCounted:100,sectionsTotal:100,sectionsRemaining:0,
    candidates:[{name:'A',party:'XX',number:'11',votes:120,percentage:60},{name:'B',party:'YY',number:'22',votes:80,percentage:40}]};
  const record=stateMapRecord('pr',d);
  assert.equal(record.leader.name,'A');
  assert.deepEqual(record.candidates.map(c=>c.name),['A','B']);
  assert.equal(record.candidates[1].votes,80);
  assert.equal(record.candidates[1].percentage,40);
});
test('sem votos publicados, mapa nao disponibiliza candidaturas ficticias',()=>{
  const record=stateMapRecord('pr',{state:'awaiting',candidates:[]});
  assert.deepEqual(record.candidates,[]);
  assert.equal(record.leader,null);
});
test('apresentacao nao declara vencedor a partir de mera lideranca',()=>{
  assert.match(js,/if\(data.finished&&data.decision\?\.kind==='elected'/);
  assert.match(js,/Para deputados, o mais votado não é necessariamente eleito/);
  assert.match(js,/A liderança pode mudar/);
});

test('fases da apuracao nao confundem classificado, parcial e eleito',async()=>{
  const {runInNewContext}=await import('node:vm');
  const start=js.indexOf('function focusPhaseFor(data){'),end=js.indexOf('function focusWaiting(){',start);
  const functionBody=js.slice(start,end);
  const detect=runInNewContext(functionBody+'\nfocusPhaseFor;',{});
  const base={state:'ok',finished:false,candidates:[{name:'A',votes:10,elected:false}]};
  assert.equal(detect(base),'counting');
  assert.equal(detect({...base,finished:true,decision:{kind:'runoff'}}),'runoff');
  assert.equal(detect({...base,finished:true,decision:{kind:'elected'},candidates:[{elected:true,votes:10}]}),'elected');
  assert.equal(detect({...base,finished:true,decision:{kind:'unknown'}}),'counted');
  assert.equal(detect({state:'awaiting'}),'awaiting');
});
