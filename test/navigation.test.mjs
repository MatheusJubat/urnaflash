import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const take=(start,end)=>{const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert.ok(a!==-1&&b>a,`${start} found`);return source.slice(a,b);};
const reloadSource=take('function navigationIsReload(){','function announceSelection(');
const resetSource=take('function resetToBrazil(', 'function photoForCandidate(');
const selectSource=take('function selectState(', '// A busca geral');

test('identifica uma atualização F5 e distingue de link aberto diretamente',()=>{
  for(const [type,expected] of [['reload',true],['navigate',false],['back_forward',false]]){
    const context={performance:{getEntriesByType:()=>[{type}]}};
    runInNewContext(reloadSource+'\nvalue=navigationIsReload();',context);
    assert.equal(context.value,expected);
  }
});

test('sem Navigation Timing, não quebra a página',()=>{
  const context={performance:{getEntriesByType(){throw new Error('unsupported');}}};
  runInNewContext(reloadSource+'\nvalue=navigationIsReload();',context);
  assert.equal(context.value,false);
});

function resetFixture({selected='pr',city='12345',position='Palmeira',chosenOffice='governador'}={}){
  const elements=new Map(),calls=[];
  const $=name=>{if(!elements.has(name))elements.set(name,{value:'old',hidden:false,textContent:'',focus(){calls.push(`focus ${name}`)},scrollIntoView(){calls.push(`scroll ${name}`)},setAttribute(n,v){this[n]=v;}});return elements.get(name);};
  const context={
    $,
    clearTimeout(){},
    closeCityMap(opts){calls.push(['close',opts]);},closeInlineCityPicker(){calls.push('closeInlineCityPicker')},
    renderCitySuggestions(){calls.push('suggestions')},showCityFeedback(){calls.push('feedback')},
    updateHeadings(){calls.push('headings')},resetCandidateList(){calls.push('resetCandidates')},
    refreshResults(){calls.push('results')},refreshGovernorSituation(){calls.push('governor')},
    renderStateList(){calls.push('states')},drawMap(){calls.push('map')},renderScopeSummary(){calls.push('summary')},
    announceSelection(msg){calls.push(msg)},
    matchMedia(){return {matches:false}},
    uf:selected,municipality:city,cityName:position,office:chosenOffice,
    citySearchRequest:0,searchTimer:null,
  };
  runInNewContext(resetSource+'\nresetToBrazil({focus:"results"});\nstate={uf,municipality,cityName,office,citySearchRequest};',context);
  return {state:context.state,calls,elements};
}

test('limpa município/estado/cargo e mantém a visualização coerente ao voltar ao Brasil',()=>{
  const {state,calls,elements}=resetFixture();
  assert.deepEqual({...state},{uf:'br',municipality:'',cityName:'',office:'presidente',citySearchRequest:1});
  assert.equal(elements.get('#cityQuery').value,'');
  assert.equal(elements.get('#stateSearch').value,'');
  assert.equal(elements.get('#explorerSearch').value,'');
  assert.ok(calls.includes('summary')); // Atualiza resumo nacional imediatamente
  assert.ok(calls.includes('results'));
  assert.ok(calls.includes('states'));
  assert.ok(calls.includes('map'));
  assert.ok(calls.some(v=>Array.isArray(v)&&v[0]==='close'&&v[1].restoreFocus===false));
  assert.ok(calls.includes('focus #allBrazilBtn'));
});

test('ao tocar novamente no estado atual, volta ao Brasil; outro estado abre mapa',()=>{
  let cleared=0,opened=0,changed='';
  const context={
    uf:'pr',explorerOpenedFrom:null,document:{activeElement:{}},
    resetToBrazil(){cleared++},changeUF(code){changed=code},openCityMap(){opened++},
    announceSelection(){},STATE_NAMES:{pr:'Paraná',sp:'São Paulo'},
    $:()=>({scrollIntoView(){}}),matchMedia:()=>({matches:true}),
  };
  runInNewContext(selectSource+'\nselectState("pr");\nselectState("sp");',context);
  assert.equal(cleared,1);assert.equal(opened,1);assert.equal(changed,'sp');
});

test('o carregamento inicial considera atualização e reinicia o recorte geográfico',()=>{
  assert.match(source,/const resetOnReload=navigationIsReload\(\);uf=resetOnReload\?'br'/);
  assert.match(source,/municipality=!resetOnReload&&uf!=='br'/);
  assert.match(source,/#cityMapClose'\)\.addEventListener\('click',\(\)=>resetToBrazil/);
});
