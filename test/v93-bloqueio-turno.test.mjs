import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {secondRoundUnlocked,secondRoundPublicationOpen,defaultRound} from '../schedule.mjs';

const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
function extract(start,end){const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert.ok(a>=0&&b>a);return source.slice(a,b);}
const unlock=extract('function updateUnlockStatus(','function renderAutoStatus(');
const change=extract('function changeRound(','function changeOffice(');

test('Bloqueio acompanha exatamente meia-noite em Brasília, não o UTC',()=>{
  const before=new Date('2026-10-25T02:59:59.000Z');
  const start=new Date('2026-10-25T03:00:00.000Z');
  assert.equal(secondRoundUnlocked(before),false);
  assert.equal(secondRoundUnlocked(start),true);
  assert.equal(defaultRound(before),1);
  assert.equal(defaultRound(start),2);
  assert.equal(secondRoundPublicationOpen(start),false);
  assert.equal(secondRoundPublicationOpen(new Date('2026-10-25T19:59:59.000Z')),false);
  assert.equal(secondRoundPublicationOpen(new Date('2026-10-25T20:00:00.000Z')),true);
});

test('Botão fica de fato disabled, acessível e informa a data antes do dia 25',()=>{
  const btn={disabled:false,attrs:{},small:{textContent:''},querySelector(selector){assert.equal(selector,'small');return this.small;},setAttribute(k,v){this.attrs[k]=v;}};
  const hint={hidden:true,textContent:''};let called=0;
  const elements={'#turnButtons [data-round="2"]':btn,'#roundUnlockHint':hint};
  const ctx={round:1,electionDayStarted:false,$:(q)=>elements[q],renderAutoStatus(){called++;}};
  runInNewContext(unlock+'\nupdateUnlockStatus(false);',ctx);
  assert.equal(btn.disabled,true);
  assert.equal(btn.attrs['aria-disabled'],'true');
  assert.equal(btn.small.textContent,'Disponível em 25/10');
  assert.equal(hint.hidden,false);
  assert.match(hint.textContent,/25\/10/);
  assert.equal(ctx.electionDayStarted,false);
  runInNewContext(unlock+'\nupdateUnlockStatus(true);',ctx);
  assert.equal(btn.disabled,false);
  assert.equal(btn.attrs['aria-disabled'],'false');
  assert.equal(hint.hidden,true);
  assert.equal(ctx.electionDayStarted,true);
  assert.equal(called,2);
});

test('Mesmo chamada programática não entra no segundo turno antes da liberação',()=>{
  const calls=[];
  const ctx={round:1,manualTurn:false,electionDayStarted:false,pickerForcedOpen:true,
    toast:s=>calls.push(s),closeInlineCityPicker:()=>calls.push('close picker'),
    renderScopeSummary:()=>calls.push('scope'),renderStateList:()=>calls.push('states'),drawMap:()=>calls.push('map'),renderInsights:()=>calls.push('insights'),
    updateHeadings:()=>calls.push('headings'),resetCandidateList:()=>calls.push('reset'),refreshResults:()=>calls.push('results'),refreshMap:()=>calls.push('refresh map'),
    statesData:{example:1},latestNational:{example:1},
  };
  runInNewContext(change+'\nchangeRound(2,true);',ctx);
  assert.equal(ctx.round,1);
  assert.equal(ctx.manualTurn,false);
  assert.ok(calls.some(x=>String(x).includes('25/10')));
  assert.equal(calls.includes('results'),false);
  ctx.electionDayStarted=true;
  runInNewContext(change+'\nchangeRound(2,false);',ctx);
  assert.equal(ctx.round,2);
  assert.equal(ctx.manualTurn,false);
  assert.ok(calls.includes('results'));
  runInNewContext(change+'\nchangeRound(1,true);',ctx);
  assert.equal(ctx.round,1);
  assert.equal(ctx.manualTurn,true);
});

test('Link direto com ?turno=2 é sanitizado antes do dia 25',()=>{
  const start=source.indexOf('const requestedTurn=params.get(\'turno\');');
  const end=source.indexOf('\n  office=',start);
  assert.ok(start>0&&end>start);
  const snippet=source.slice(start,end);
  for(const [requested,enabled,expectedRound,expectedManual] of [
    ['2',false,1,false],['2',true,2,true],['1',true,1,true],[null,false,1,false],[null,true,2,false],
  ]){
    const ctx={params:new URLSearchParams(requested===null?'':'turno='+requested),unlocked:enabled,resetOnReload:false,manualTurn:false,round:1};
    runInNewContext(snippet+'\nselection={round,manualTurn};',ctx);
    assert.equal(ctx.selection.round,expectedRound,`${requested} ${enabled}`);
    assert.equal(ctx.selection.manualTurn,expectedManual,`${requested} ${enabled}`);
  }
});


test('F5 em 25/10 ignora seleção antiga e abre o segundo turno por padrão',()=>{
  const start=source.indexOf('const requestedTurn=params.get(\'turno\');');
  const end=source.indexOf('\n  office=',start);
  const snippet=source.slice(start,end);
  const ctx={params:new URLSearchParams('turno=1'),unlocked:true,resetOnReload:true,manualTurn:true,round:1};
  runInNewContext(snippet+'\nselection={round,manualTurn};',ctx);
  assert.equal(ctx.selection.round,2);
  assert.equal(ctx.selection.manualTurn,false);
  assert.match(source,/if\(!wasUnlocked&&data\.unlocked\)manualTurn=false/);
});
