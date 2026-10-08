'use strict';
const $=selector=>document.querySelector(selector);
const STATES=[['ac','Acre'],['al','Alagoas'],['ap','Amapá'],['am','Amazonas'],['ba','Bahia'],['ce','Ceará'],['df','Distrito Federal'],['es','Espírito Santo'],['go','Goiás'],['ma','Maranhão'],['mt','Mato Grosso'],['ms','Mato Grosso do Sul'],['mg','Minas Gerais'],['pa','Pará'],['pb','Paraíba'],['pr','Paraná'],['pe','Pernambuco'],['pi','Piauí'],['rj','Rio de Janeiro'],['rn','Rio Grande do Norte'],['rs','Rio Grande do Sul'],['ro','Rondônia'],['rr','Roraima'],['sc','Santa Catarina'],['sp','São Paulo'],['se','Sergipe'],['to','Tocantins']];
const STATE_NAMES=Object.fromEntries([['br','Brasil'],...STATES]);
const SLUGS={ac:'acre',al:'alagoas',ap:'amapa',am:'amazonas',ba:'bahia',ce:'ceara',df:'distrito-federal',es:'espirito-santo',go:'goias',ma:'maranhao',mt:'mato-grosso',ms:'mato-grosso-do-sul',mg:'minas-gerais',pa:'para',pb:'paraiba',pr:'parana',pe:'pernambuco',pi:'piaui',rj:'rio-de-janeiro',rn:'rio-grande-do-norte',rs:'rio-grande-do-sul',ro:'rondonia',rr:'roraima',sc:'santa-catarina',sp:'sao-paulo',se:'sergipe',to:'tocantins'};
const IBGE_CODES={ac:'12',al:'27',ap:'16',am:'13',ba:'29',ce:'23',df:'53',es:'32',go:'52',ma:'21',mt:'51',ms:'50',mg:'31',pa:'15',pb:'25',pr:'41',pe:'26',pi:'22',rj:'33',rn:'24',rs:'43',ro:'11',rr:'14',sc:'42',sp:'35',se:'28',to:'17'};
const IBGE_TO_UF=Object.fromEntries(Object.entries(IBGE_CODES).map(([uf,num])=>[num,uf]));
const OFFICES={presidente:'Presidente',governador:'Governador',senador:'Senador','deputado-federal':'Deputado federal','deputado-estadual':'Deputado estadual','deputado-distrital':'Deputado distrital'};
const TILES={rr:[0,2],ap:[0,5],am:[1,2],pa:[1,4],ma:[2,5],ce:[2,6],rn:[2,7],ac:[3,0],ro:[3,1],mt:[3,2],to:[3,4],pi:[3,5],pb:[3,7],pe:[4,6],al:[5,7],se:[5,6],ba:[5,5],ms:[4,2],go:[4,3],df:[4,4],mg:[5,4],es:[6,6],rj:[6,5],sp:[6,4],pr:[7,3],sc:[8,3],rs:[9,2]};
const fmtVotes=n=>Number(n||0).toLocaleString('pt-BR');
const fmtPct=n=>Number(n||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'%';
const fetchJson=async path=>{const response=await fetch(path,{cache:'no-store'});if(!response.ok)throw Error('HTTP '+response.status);return response.json();};
const el=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
let round=1,office='presidente',uf='br',municipality='',cityName='',manualTurn=false,allCandidates=false;
let resultsSequence=0,mapSequence=0,statesData={},geoFeatures=null,mapRound=1,cityCache={},refreshTimer;
let cityGeoFeatures=null,cityGeoUF='',cityVoteCache=new Map();
let explorerOpenedFrom=null,explorerLoadSequence=0,latestResult=null,viewZoom=1,mapViewBox=null,ignoreNextMapClick=false;
let secondUnlocked=false,nationalSequence=0,latestNational=null,governorSequence=0,governorSituation=null;
const readStore=(key,defaultValue)=>{try{return localStorage.getItem(key)||defaultValue;}catch{return defaultValue;}};
const writeStore=(key,val)=>{try{localStorage.setItem(key,val);}catch{}};
function setTheme(theme){const isDark=theme==='dark';document.documentElement.dataset.theme=isDark?'dark':'light';$('#themeToggle').setAttribute('aria-pressed',String(isDark));$('#themeToggle').setAttribute('aria-label',isDark?'Ativar modo claro':'Ativar modo escuro');$('#themeIcon').textContent=isDark?'☀':'☾';$('#themeLabel').textContent=isDark?'Modo claro':'Modo escuro';writeStore('urnaflash-theme',theme);}
function toast(message){const node=$('#toast');node.textContent=message;node.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>node.hidden=true,4000);}
const email=()=>['contato','urnaflash'].join('')+'@'+'gmail.com';
const pathFor=code=>code==='br'?'/':`/eleicoes-2026/${SLUGS[code]}`;
function applyURL(){const params=new URLSearchParams();if(manualTurn||round===2)params.set('turno',String(round));if(office!=='presidente')params.set('cargo',office);if(municipality)params.set('municipio',municipality);const query=params.toString();history.replaceState({},'',pathFor(uf)+(query?'?'+query:''));}
function setStatus(kind,title,msg){const node=$('#statusBanner');node.dataset.status=kind;$('#statusTitle').textContent=title;$('#statusMessage').textContent=msg;}
function resetCandidateList(){$('#electionOutcome').hidden=true;allCandidates=false;$('#candidateList').replaceChildren(el('div','empty-message','Aguardando a publicação dos resultados para esta seleção.'));$('#moreBar').hidden=true;
  for(const [key,txt] of [['progressPercent','—'],['validVotes','—'],['lastUpdated','—'],['sectionCounts','Sem informação'],['progressText','Sem informação']])$('#'+key).textContent=txt;
  $('#progressBar').style.width='0%';}
function dateInBrasilia(){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const pick=t=>parts.find(p=>p.type===t)?.value;return `${pick('year')}-${pick('month')}-${pick('day')}`;}
function updateUnlockStatus(enabled){
  secondUnlocked=enabled;
  const btn=$('#turnButtons [data-round="2"]');btn.disabled=!enabled;
  btn.querySelector('small').textContent=enabled?'25 de outubro':'25 de outubro · Em breve';
  $('#roundUnlockHint').textContent=enabled?'Segundo turno liberado. Os números aparecem apenas depois de publicados pelo TSE.':'O 2º turno será liberado automaticamente em 25/10, no horário de Brasília.';
}
function populateOffices(){
  if(round===2&&!['presidente','governador'].includes(office))office='presidente';
  if(office==='deputado-distrital'&&uf!=='df')office='deputado-estadual';
  if(office==='deputado-estadual'&&uf==='df')office='deputado-distrital';
  document.querySelectorAll('#officeButtons [data-office]').forEach(btn=>{
    const code=btn.dataset.office;
    const unavailable=round===2&&!['presidente','governador'].includes(code)||code==='deputado-distrital'&&uf!=='df'||code==='deputado-estadual'&&uf==='df';
    btn.disabled=unavailable;btn.classList.toggle('active',office===code);btn.setAttribute('aria-pressed',String(office===code));
  });
}
function updateHeadings(){populateOffices();
  document.querySelectorAll('#turnButtons [data-round]').forEach(btn=>{const active=Number(btn.dataset.round)===round;btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',String(active));});
  $('#mapRoundLabel').textContent=round+'º turno';
  const title=cityName&&municipality?`${cityName} (${uf.toUpperCase()})`:STATE_NAMES[uf]||'Brasil';
  $('#officeCaption').textContent=OFFICES[office].toUpperCase();$('#electionHeading').textContent=`${round}º turno · ${title}`;
  $('#resultsSubtitle').textContent=municipality?'Votos recebidos neste município conforme o TSE':office==='senador'?'Duas vagas de senador em disputa por estado':'Resultados oficiais da eleição selecionada';
  $('#selectedPlace').textContent=municipality?title:uf==='br'?'Brasil inteiro':STATE_NAMES[uf];
  $('#selectedPlaceHint').textContent=municipality?'Resultado municipal · dados do TSE':uf==='br'?'Busque sua cidade acima ou escolha um estado no mapa.':'Resultado estadual · clique no mapa para trocar.';
  $('#changePlaceBtn').textContent=uf==='br'&&office!=='presidente'?'Escolher estado no mapa':'Buscar outra cidade';
  $('#heroRound').textContent=round+'º turno';$('#heroTitle').textContent=round===1?'Resultados do 1º turno':'Apuração do 2º turno';
  $('#heroSubtitle').textContent=round===1?'4 de outubro · Dados oficiais do TSE':'25 de outubro · Acompanhamento oficial';
  $('#cityCardTitle').textContent=municipality?`Você está vendo ${cityName||'sua cidade'}`:'Sua cidade, sem complicação';
  $('#cityCardDescription').textContent=municipality?`Mostramos os votos de ${OFFICES[office].toLowerCase()} em ${cityName||'seu município'}, ${STATE_NAMES[uf]}. Para trocar de cidade, basta usar a busca no topo.`:'Digite o nome da sua cidade no campo no início da página. Não precisa procurar códigos nem navegar por uma lista enorme.';
  $('#cityMapToggle').disabled=uf==='br';
  applyURL();
}
function changeRound(value,manual=true){if(value===2&&!secondUnlocked){toast('Segundo turno disponível a partir de 25 de outubro.');return;}round=value;if(manual)manualTurn=true;
  updateHeadings();resetCandidateList();refreshResults();refreshMap();}
function changeOffice(value){if(!OFFICES[value])return;office=value;
  if(office==='deputado-distrital'&&uf!=='df'){office='deputado-estadual';toast('Deputado distrital é exclusivo do Distrito Federal. Selecione DF no mapa.');return;}
  updateHeadings();resetCandidateList();refreshResults();}
function changeUF(code){if(!STATE_NAMES[code])return;uf=code;municipality='';cityName='';
  $('#cityQuery').value='';renderCitySuggestions([]);showCityFeedback('Busque sua cidade pelo nome para ver os votos municipais.');
  updateHeadings();resetCandidateList();refreshResults();drawMap();refreshGovernorSituation();if(code==='br')closeCityMap();}
function candidateElement(candidate,i){
  const node=el('div','candidate');node.dataset.identity=candidate.number;
  node.append(el('span','candidate-rank',String(i+1).padStart(2,'0')));
  const main=el('div');main.append(el('div','candidate-name',candidate.name||'Nome não informado'),el('div','candidate-meta',`${candidate.party||'Partido não identificado'} · Nº ${candidate.number||'—'}`));
  if(candidate.elected&&latestResult?.finished)main.append(el('span','tiny-badge','Eleito, conforme o TSE'));
  node.append(main);
  const stats=el('div','candidate-votes');stats.append(el('strong','',fmtPct(candidate.percentage)),el('span','',`${fmtVotes(candidate.votes)} votos`));node.append(stats);
  const bar=el('div','candidate-bar'),fill=el('span');fill.style.width=`${Math.max(0,Math.min(100,candidate.percentage))}%`;bar.append(fill);node.append(bar);
  return node;
}
let latestCandidates=[];
function paintCandidates(){const max=allCandidates?latestCandidates.length:Math.min(latestCandidates.length,8);
  $('#candidateList').replaceChildren(...latestCandidates.slice(0,max).map(candidateElement));
  $('#moreBar').hidden=latestCandidates.length<=8||allCandidates;
}
function showResults(data){latestResult=data;latestCandidates=data.candidates||[];allCandidates=false;paintCandidates();updateExplorerSummary(data);
  const outcome=$('#electionOutcome'),elected=data.finished?data.candidates.filter(c=>c.elected):[];
  outcome.replaceChildren();outcome.hidden=false;
  if(elected.length){outcome.dataset.kind='elected';outcome.append(el('strong','',`Resultado oficial: ${elected.map(c=>c.name).join(', ')}`),el('p','','Candidato(s) indicado(s) como eleito(s) no arquivo oficial do TSE.'));}
  else if(data.finished){outcome.dataset.kind='finished';outcome.append(el('strong','','Totalização encerrada'),el('p','','O arquivo informa que a totalização foi concluída, mas ainda não traz confirmação de candidato eleito para esta consulta.'));}
  else{outcome.dataset.kind='partial';outcome.append(el('strong','',`${data.candidates[0]?.name||'Candidato'} está à frente nesta consulta`),el('p','',`${fmtPct(data.candidates[0]?.percentage||0)} dos votos válidos informados até agora. Parcial: os números podem mudar.`));}

  if(municipality&&office==='presidente'&&['ok','stale'].includes(data.state)){cityVoteCache.set(`${round}-${uf}-${municipality}`,{leader:data.candidates[0],progress:data.progress,sectionsRemaining:data.sectionsRemaining,finished:data.finished});if(cityGeoUF===uf&&!$('#cityMapPanel').hidden)drawCityMap();}
  $('#progressPercent').textContent=fmtPct(data.progress);$('#progressBar').style.width=Math.min(100,Math.max(0,data.progress))+'%';
  $('#validVotes').textContent=fmtVotes(data.validVotes);$('#lastUpdated').textContent=data.generatedAt||'Não informada';
  $('#sectionCounts').textContent=`${fmtVotes(data.sectionsCounted)} de ${fmtVotes(data.sectionsTotal)} seções`;
  $('#progressText').textContent=data.finished?'Totalização concluída':`Faltam ${data.sectionsRemaining===null?'—':fmtVotes(data.sectionsRemaining)} seções · parcial`;
  if(data.sourceUrl)$('#tseLink').href=data.sourceUrl;
}
async function refreshResults(){const my=++resultsSequence;updateHeadings();
  setStatus('loading','Consultando resultados oficiais','Buscando arquivo do TSE para a seleção atual.');
  const params=new URLSearchParams({round:String(round),uf,office});if(municipality)params.set('municipality',municipality);
  let data;try{data=await fetchJson('/api/results?'+params);}catch{data={state:'unavailable',message:'Servidor temporariamente indisponível.'};}
  if(my!==resultsSequence)return;
  if(data.state==='ok'||data.state==='stale'){
    showResults(data);
    setStatus(data.state==='ok'?'ok':'awaiting',data.state==='ok'?(data.finished?'Totalização concluída':'Números oficiais disponíveis'):'Último resultado conhecido',
      data.state==='stale'?'Atualização falhou, mostrando última leitura oficial disponível.':`Os dados são do TSE. ${data.finished?'Totalização finalizada no arquivo atual.':'Parcial: a distribuição pode mudar.'}`);
  }else{latestResult=null;updateExplorerSummary(null);latestCandidates=[];resetCandidateList();
    setStatus(['awaiting','choose-state','not-applicable'].includes(data.state)?'awaiting':'error',
      data.state==='not-applicable'?'Governador definido no primeiro turno':data.state==='choose-state'?'Escolha um estado':data.state==='awaiting'?'Aguardando publicação do TSE':'Não foi possível carregar o resultado',data.message||'Tente novamente em instantes.');}
}
function mapClass(d){if(!d?.leader)return 'neutral';return d.leader.number==='13'?'red':d.leader.number==='22'?'green':'other';}
function mapFill(d){const cls=mapClass(d);return cls==='red'?'var(--red)':cls==='green'?'var(--green)':cls==='other'?'#917fc1':'var(--gray)';}
function statusByUF(code){return statesData[code]||null;}
function tooltipText(code){const d=statusByUF(code);if(!d?.leader)return `${STATE_NAMES[code]} · sem resultado disponível`;
  return `${STATE_NAMES[code]} · à frente: ${d.leader.name} (${d.leader.party||'partido não identificado'}), ${fmtPct(d.leader.percentage)} dos votos · ${fmtPct(d.progress)} das seções totalizadas · ${d.sectionsRemaining===null?'restante desconhecido':fmtVotes(d.sectionsRemaining)+' seções restantes'} · ${d.finished?'totalização encerrada':'parcial'}`;}

function drawTiles(){const root=el('div','map-tiles');root.setAttribute('role','group');root.setAttribute('aria-label','Estados do Brasil em mosaico esquemático');
  for(const [code] of STATES){const pos=TILES[code];if(!pos)continue;
    const d=statusByUF(code);const button=el('button','state-tile '+mapClass(d));button.append(el('strong','',code.toUpperCase()),el('small','',d?.leader?fmtPct(d.progress).replace(',00',''):'—')); button.type='button';button.style.gridRow=String(pos[0]+1);button.style.gridColumn=String(pos[1]+1);
    button.setAttribute('aria-label',tooltipText(code));button.title=tooltipText(code);button.addEventListener('click',()=>selectState(code));root.append(button);
  }$('#geoMap').replaceChildren(root);}
function getCode(feature){const p=feature.properties||{};
  for(const raw of [p.codarea,p.CD_UF,p.cd_uf,p.codigo,p.id,feature.id]){const found=IBGE_TO_UF[String(raw??'').trim()];if(found)return found;}
  const str=String(p.sigla||p.uf||'').toLowerCase();if(STATE_NAMES[str])return str;return null;}
function polygonsFor(geometry){if(geometry?.type==='Polygon')return [geometry.coordinates];if(geometry?.type==='MultiPolygon')return geometry.coordinates;return [];}
function drawGeoMap(){const f=geoFeatures;if(!f?.length){drawTiles();return;}
  let all=[];for(const feature of f){for(const poly of polygonsFor(feature.geometry)){for(const ring of poly){for(const pt of ring){if(Number.isFinite(pt[0])&&Number.isFinite(pt[1]))all.push(pt);}}}}
  if(!all.length){drawTiles();return;}
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;for(const [x,y] of all){if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;}
  const width=620,height=425,pad=12;const scale=Math.min((width-2*pad)/(maxX-minX||1),(height-2*pad)/(maxY-minY||1));
  const w=(maxX-minX)*scale,h=(maxY-minY)*scale,offsetX=(width-w)/2,offsetY=(height-h)/2;
  const px=x=>offsetX+(x-minX)*scale,py=y=>offsetY+(maxY-y)*scale;
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.setAttribute('role','group');svg.setAttribute('aria-label','Mapa geográfico interativo das unidades federativas do Brasil');
  let rendered=0;
  for(const feature of f){const code=getCode(feature);if(!code)continue;
    const paths=[];for(const poly of polygonsFor(feature.geometry)){for(const ring of poly){if(!Array.isArray(ring)||ring.length<3)continue;
      paths.push(ring.map((p,i)=>(i?'L':'M')+px(p[0]).toFixed(1)+','+py(p[1]).toFixed(1)).join(' ')+'Z');}}
    if(!paths.length)continue;
    const p=document.createElementNS(ns,'path');p.setAttribute('d',paths.join(' '));p.setAttribute('fill',mapFill(statusByUF(code)));
    p.setAttribute('fill-rule','evenodd');p.setAttribute('class','geo-state');p.setAttribute('tabindex','0');p.setAttribute('role','button');p.setAttribute('aria-label',tooltipText(code));
    const title=document.createElementNS(ns,'title');title.textContent=tooltipText(code);p.append(title);
    p.addEventListener('click',()=>selectState(code));p.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectState(code);}});svg.append(p);
    // Legendas para UFs grandes; UFs pequenas sempre aparecem com dados na lista acessível ao lado.
    const vertices=polygonsFor(feature).flatMap(poly=>poly[0]||[]);const bx=vertices.reduce((a,v)=>a+v[0],0)/(vertices.length||1),by=vertices.reduce((a,v)=>a+v[1],0)/(vertices.length||1);
    if(vertices.length>3 && Number.isFinite(bx)&&Number.isFinite(by)){
      const label=document.createElementNS(ns,'text');label.setAttribute('x',px(bx));label.setAttribute('y',py(by));label.setAttribute('class','geo-state-label');label.setAttribute('text-anchor','middle');label.textContent=code.toUpperCase();svg.append(label);
      const d=statusByUF(code);if(d?.leader){const percentage=document.createElementNS(ns,'text');percentage.setAttribute('x',px(bx));percentage.setAttribute('y',py(by)+12);percentage.setAttribute('class','geo-state-progress');percentage.setAttribute('text-anchor','middle');percentage.textContent=fmtPct(d.progress);svg.append(percentage);}
    }
    rendered++;
  }
  if(rendered<15){drawTiles();return;}
  $('#geoMap').replaceChildren(svg);
}
function drawMap(){if(geoFeatures)drawGeoMap();else drawTiles();}
function renderStateList(){const root=$('#statesList'),q=$('#stateSearch').value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();root.replaceChildren();
  for(const [code,name] of STATES){if(!name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(q)&&!code.includes(q))continue;
    const data=statusByUF(code),btn=el('button','state-row');btn.type='button';btn.setAttribute('aria-label',tooltipText(code));
    const left=el('div');left.append(el('b','',name),el('div','state-sub',code.toUpperCase()));btn.append(left);
    const right=el('div','state-value');if(data?.leader){
      right.append(el('span','value-main',`${data.leader.name} · ${fmtPct(data.leader.percentage)} dos votos`));
      right.append(el('small','',`${fmtPct(data.progress)} das seções · ${data.finished?'concluído':fmtVotes(data.sectionsRemaining)+' restantes'}`));
      const track=el('span','state-progress-line'),bar=el('span');bar.style.width=Math.max(0,Math.min(100,data.progress))+'%';track.append(bar);right.append(track);
      if(data.finished)right.append(el('span','state-totalized','Totalização encerrada'));
    }else right.append(el('small','','Aguardando resultados'));
    btn.append(right);btn.addEventListener('click',()=>selectState(code));root.append(btn);
  }
  if(!root.children.length)root.append(el('div','empty-message','Nenhum estado encontrado.'));
  $('#statesReady').textContent=`${Object.values(statesData).filter(x=>x.leader).length}/27 com dados`;
}
function renderNational(d){const good=['ok','stale'].includes(d?.state)&&d?.candidates?.length;
  if(!good){$('#nationalStatus').textContent=round===2?'Aguardando o início da divulgação':'Dados nacionais temporariamente indisponíveis';
    $('#nationalStatusDetail').textContent=round===2?'No dia 25/10, o TSE divulga os resultados a partir das 17h (Brasília).':'Tente atualizar daqui a pouco. Nenhum número fictício será exibido.';
    $('#nationalBadge').textContent='Aguardando';$('#nationalProgress').textContent='—';$('#nationalProgressBar').style.width='0%';$('#nationalRemaining').textContent='—';$('#nationalSectionTotal').textContent='Sem informação';$('#nationalLeader').textContent='—';$('#nationalLeaderInfo').textContent='Fonte: TSE';$('#nationalLeadLabel').textContent='Candidato à frente';return;}
  const elected=d.finished?d.candidates.find(c=>c.elected):null;
  $('#nationalStatus').textContent=elected?'Resultado oficial da eleição':d.finished?'Totalização encerrada':`${round}º turno: apuração em andamento`;
  $('#nationalStatusDetail').textContent=elected?`Eleito conforme o TSE: ${elected.name}`:d.finished?'Todos os dados de totalização recebidos; consulte o resultado oficial.':'Os percentuais de votos e de seções são métricas diferentes. A liderança ainda pode mudar.';
  $('#nationalBadge').textContent=elected?'Eleito confirmado':d.finished?'Encerrada':'Parcial · ao vivo';
  $('#nationalProgress').textContent=fmtPct(d.progress);$('#nationalProgressBar').style.width=Math.max(0,Math.min(100,d.progress))+'%';
  $('#nationalRemaining').textContent=d.sectionsRemaining===null?'—':fmtVotes(d.sectionsRemaining);
  $('#nationalSectionTotal').textContent=`${fmtVotes(d.sectionsCounted)} de ${fmtVotes(d.sectionsTotal)} seções`;
  $('#nationalLeadLabel').textContent=elected?'Eleito segundo TSE':'Candidato à frente';
  $('#nationalLeader').textContent=(elected||d.candidates[0]).name;
  $('#nationalLeaderInfo').textContent=`${fmtPct((elected||d.candidates[0]).percentage)} dos votos válidos · ${fmtVotes((elected||d.candidates[0]).votes)} votos`;
}
async function refreshNational(){const seq=++nationalSequence,currentRound=round;
  try{const data=await fetchJson(`/api/results?round=${currentRound}&uf=br&office=presidente`);if(seq!==nationalSequence)return;latestNational=data;renderNational(data);}
  catch{if(seq!==nationalSequence)return;latestNational=null;renderNational(null);}
}
async function refreshMap(){const seq=++mapSequence;mapRound=round;$('#statesReady').textContent='Consultando...';
  refreshNational();
  try{const data=await fetchJson('/api/map?round='+mapRound);if(seq!==mapSequence)return;
    statesData=Object.fromEntries((data.states||[]).map(s=>[s.uf,s]));renderStateList();drawMap();
    const total=Object.values(statesData).filter(x=>x.finished).length;
    $('#mapHint').textContent=`${total} de 27 UFs com totalização encerrada. Toque em um estado para ver quem está à frente e quantas seções faltam.`;
  }catch{if(seq!==mapSequence)return;$('#statesReady').textContent='Indisponível';renderStateList();drawMap();$('#mapHint').textContent='Não conseguimos atualizar todos os estados neste momento. Tente novamente.';}
}
async function loadGeometry(){try{const data=await fetchJson('/api/geo/states');if(data?.features?.length){geoFeatures=data.features;drawMap();}}catch{drawTiles();}}
function renderGovernorSituation(data){
  const show=uf!=='br',card=$('#stateRaceCard'),summary=$('#stateRaceSummary');
  summary.hidden=!show;
  if(!show)return;
  const label=STATE_NAMES[uf]||uf.toUpperCase();
  const titles={'decided-first':'Governador definido no 1º turno','decided-second':'Governador eleito no 2º turno',
    'counting-second':'Apuração de governador ao vivo','counted-second':'Seções totalizadas no estado',
    'checking-first':'Verificando resultado do 1º turno','pending':'Segundo turno estadual em verificação','unknown':'Dados do governo estadual indisponíveis'};
  const header=titles[data?.state]||'Situação do governador';
  const detail=data?.message||'Consultando resultados estaduais do TSE.';
  $('#stateRaceTitle').textContent=header;
  $('#stateRaceDescription').textContent=detail;
  $('#stateRaceSummaryTitle').textContent=`${label} · ${header}`;
  $('#stateRaceSummaryDescription').textContent=detail;
  const btnText=data?.state==='decided-first'?'Ver resultado do 1º turno':data?.state==='counting-second'?'Acompanhar apuração estadual':'Consultar votos para governador';
  $('#stateRaceButton').textContent=btnText+' →';
  $('#stateRaceSummaryButton').textContent=btnText;
  card.dataset.state=data?.state||'unknown';summary.dataset.state=data?.state||'unknown';
}
async function refreshGovernorSituation(){
  const seq=++governorSequence,selected=uf;
  $('#stateRaceSummary').hidden=selected==='br';
  if(selected==='br'){governorSituation=null;return;}
  renderGovernorSituation({state:'loading',message:'Consultando a eleição para governador neste estado...'});
  try{
    const data=await fetchJson('/api/governor-status?uf='+encodeURIComponent(selected));
    if(seq!==governorSequence||selected!==uf)return;
    governorSituation=data;renderGovernorSituation(data);
  }catch{
    if(seq!==governorSequence||selected!==uf)return;
    governorSituation={state:'unknown',message:'A consulta ao TSE falhou. Tente novamente em instantes.'};renderGovernorSituation(governorSituation);
  }
}
function showGovernorFromShortcut(){
  if(uf==='br'){toast('Escolha seu estado primeiro.');return;}
  if(governorSituation?.state==='decided-first' && round!==1)changeRound(1);
  office='governador';updateHeadings();resetCandidateList();refreshResults();
  if(!$('#cityMapPanel').hidden)closeCityMap();
  $('#resultados').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
}
function selectState(code){explorerOpenedFrom=document.activeElement;changeUF(code);openCityMap();
  const target=$('#mapa');if(!matchMedia('(max-width:800px)').matches)target.scrollIntoView({behavior:'smooth',block:'start'});
}
// A busca geral usa o catalogo EA12 do TSE no servidor; nao exige selecionar UF.
const normalizeName=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
let citySearchRequest=0,searchTimer=null,searchRows=[],searchCursor=-1;
function renderCitySuggestions(items){const root=$('#citySuggestions');root.replaceChildren();searchRows=items;searchCursor=-1;$('#cityQuery').removeAttribute('aria-activedescendant');
  items.forEach((item,i)=>{const btn=el('button','city-suggestion');btn.type='button';btn.setAttribute('role','option');btn.setAttribute('aria-selected','false');btn.id='city-option-'+i;
    const label=el('strong','',item.name);const area=el('small','',STATE_NAMES[item.uf]||item.uf.toUpperCase());btn.append(label,area);
    btn.addEventListener('click',()=>selectCity(item));root.append(btn);
  });root.hidden=!items.length;$('#cityQuery').setAttribute('aria-expanded',String(!!items.length));
}
function showCityFeedback(text){$('#citySearchHelp').textContent=text;}
async function queryCities(immediate=false){clearTimeout(searchTimer);const q=$('#cityQuery').value.trim();const seq=++citySearchRequest;
  if(q.length<2){renderCitySuggestions([]);showCityFeedback('Digite pelo menos duas letras do nome da cidade.');return;}
  const run=async()=>{showCityFeedback('Procurando cidades...');
    try{const data=await fetchJson('/api/cities/search?q='+encodeURIComponent(q));if(seq!==citySearchRequest)return;
      renderCitySuggestions(data.cities||[]);
      if(data.state==='partial')showCityFeedback((data.message||'Busca limitada no momento.')+((data.cities||[]).length?' Selecione a cidade encontrada.':''));
      else showCityFeedback((data.cities||[]).length?`${data.cities.length} opções. Toque na cidade desejada ou use as setas do teclado.`:'Não encontramos essa cidade. Confira a grafia e tente novamente.');
    }catch{if(seq!==citySearchRequest)return;renderCitySuggestions([]);showCityFeedback('Não foi possível consultar o catálogo do TSE. Tente novamente daqui a pouco.');}
  };if(immediate)await run();else searchTimer=setTimeout(run,220);
}
function selectCity(item,{fromExplorer=false}={}){const code=String(item.code||'').padStart(5,'0');if(!/^[0-9]{5}$/.test(code)||!STATE_NAMES[item.uf])return;
  uf=item.uf;municipality=code;cityName=item.name;$('#cityQuery').value=`${item.name} — ${item.uf.toUpperCase()}`;
  renderCitySuggestions([]);showCityFeedback(`Local selecionado: ${item.name}, ${STATE_NAMES[uf]}. Resultado exibido abaixo.`);
  try{localStorage.setItem('urnaflash-last-city',JSON.stringify({code,uf,name:item.name}));}catch{}
  updateLastCity();updateHeadings();resetCandidateList();updateExplorerSelection();refreshResults();drawMap();refreshGovernorSituation();
  if(fromExplorer)return;
  closeCityMap();
  $('#resultados').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
}
function updateLastCity(){let saved=null;try{saved=JSON.parse(localStorage.getItem('urnaflash-last-city')||'null');}catch{}
  $('#lastCityBtn').hidden=!(saved&&/^[0-9]{5}$/.test(saved.code)&&STATE_NAMES[saved.uf]);
  if(saved)$('#lastCityBtn').textContent=`↶ Última cidade: ${saved.name||'município'} (${saved.uf.toUpperCase()})`;
}
function setupCitySearch(){
  $('#cityQuery').addEventListener('input',()=>queryCities());
  $('#cityFindBtn').addEventListener('click',()=>{if(searchRows.length===1)selectCity(searchRows[0]);else queryCities(true);});
  $('#cityQuery').addEventListener('keydown',event=>{const count=searchRows.length;if(event.key==='Escape'){renderCitySuggestions([]);return;}
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){if(!count)return;event.preventDefault();searchCursor=(searchCursor+(event.key==='ArrowDown'?1:-1)+count)%count;
      [...$('#citySuggestions').children].forEach((node,i)=>node.setAttribute('aria-selected',String(i===searchCursor)));
      $('#cityQuery').setAttribute('aria-activedescendant','city-option-'+searchCursor);
    }else if(event.key==='Enter'){event.preventDefault();if(searchCursor>=0&&searchRows[searchCursor])selectCity(searchRows[searchCursor]);else if(count===1)selectCity(searchRows[0]);else queryCities(true);}
  });
  document.addEventListener('click',event=>{if(!event.target.closest('#busca'))renderCitySuggestions([]);});
  $('#lastCityBtn').addEventListener('click',()=>{let saved;try{saved=JSON.parse(localStorage.getItem('urnaflash-last-city')||'null');}catch{}if(saved)selectCity(saved);});
  updateLastCity();
}
function cityGeoId(feature){
  const p=feature.properties||{};for(const raw of [p.codarea,p.CD_MUN,p.codigo,p.id,feature.id]){const id=String(raw||'').trim();if(/^\d{7}$/.test(id))return id;}
  return null;
}
function drawCityMap(){
  const previousBox=mapViewBox?[...mapViewBox]:null, previousZoom=viewZoom;
  if(!cityGeoFeatures?.length){$('#cityMap').replaceChildren(el('p','loading-state','Mapa geográfico municipal indisponível no momento.'));return;}
  const lookup=new Map((cityCache[cityGeoUF]?.municipalities||[]).map(city=>[city.ibge,{...city,uf:cityGeoUF}]));
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(const f of cityGeoFeatures)for(const poly of polygonsFor(f.geometry))for(const ring of poly)for(const pt of ring){
    const [x,y]=pt;if(!Number.isFinite(x)||!Number.isFinite(y))continue;
    minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
  }
  if(!Number.isFinite(minX)||maxX<=minX){$('#cityMap').replaceChildren(el('p','loading-state','Geometria municipal não disponível.'));return;}
  const width=790,height=530,scale=Math.min(750/(maxX-minX),490/(maxY-minY));
  const dx=(width-(maxX-minX)*scale)/2,dy=(height-(maxY-minY)*scale)/2;
  const X=x=>dx+(x-minX)*scale,Y=y=>dy+(maxY-y)*scale;
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
  svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.setAttribute('role','group');svg.setAttribute('aria-label','Malha municipal do IBGE; escolha uma cidade para consultar seus resultados');
  let drawn=0;
  for(const feature of cityGeoFeatures){
    const item=lookup.get(cityGeoId(feature));if(!item)continue;
    const segments=[];for(const poly of polygonsFor(feature.geometry))for(const ring of poly){if(ring.length<3)continue;
      segments.push(ring.map((pt,index)=>(index?'L':'M')+X(pt[0]).toFixed(1)+','+Y(pt[1]).toFixed(1)).join(' ')+'Z');}
    if(!segments.length)continue;
    const outcome=cityVoteCache.get(`${round}-${cityGeoUF}-${item.code}`);
    const fill=outcome?mapFill({leader:outcome.leader}):'var(--gray)';
    const path=document.createElementNS(ns,'path');path.setAttribute('d',segments.join(' '));path.setAttribute('fill',fill);path.setAttribute('fill-rule','evenodd');path.setAttribute('class','geo-state');
    path.setAttribute('tabindex','0');path.setAttribute('role','button');
    const title=outcome?`${item.name} · À frente: ${outcome.leader.name}, ${fmtPct(outcome.leader.percentage)} dos votos · ${fmtPct(outcome.progress)} das seções totalizadas · ${outcome.finished?'concluída':fmtVotes(outcome.sectionsRemaining)+' restantes'}`:`${item.name} · clique para consultar`; path.setAttribute('aria-label',title);
    const t=document.createElementNS(ns,'title');t.textContent=title;path.append(t);
    const show=()=>{if(ignoreNextMapClick)return;selectCity(item,{fromExplorer:true});$('#explorerSearch').value=item.name;$('#explorerSearchStatus').textContent=`Cidade selecionada: ${item.name}.`;};
    path.addEventListener('click',show);path.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();show();}});
    svg.append(path);drawn++;
  }
  if(!drawn){$('#cityMap').replaceChildren(el('p','loading-state','Não foi possível relacionar esta malha aos códigos municipais do TSE.'));return;}
  $('#cityMap').replaceChildren(svg);resetExplorerZoom();
  if(previousBox&&previousZoom>1){mapViewBox=previousBox;viewZoom=previousZoom;svg.setAttribute('viewBox',mapViewBox.join(' '));updateZoomButtons();}
  wireExplorerPan(svg);
}
function resetExplorerZoom(){viewZoom=1;const svg=$('#cityMap svg');if(!svg)return;mapViewBox=[0,0,790,530];svg.setAttribute('viewBox',mapViewBox.join(' '));updateZoomButtons();}
function updateZoomButtons(){const out=$('#explorerZoomOut');if(out)out.disabled=viewZoom<=1;}
function zoomExplorer(factor){const svg=$('#cityMap svg');if(!svg||!mapViewBox)return;const z=Math.max(1,Math.min(8,viewZoom*factor));if(z===viewZoom)return;
  const [x,y,w,h]=mapViewBox;const newW=790/z,newH=530/z;const cx=x+w/2,cy=y+h/2;
  mapViewBox=[Math.max(0,Math.min(790-newW,cx-newW/2)),Math.max(0,Math.min(530-newH,cy-newH/2)),newW,newH];viewZoom=z;svg.setAttribute('viewBox',mapViewBox.join(' '));updateZoomButtons();
}
function wireExplorerPan(svg){let pan=null;
  svg.addEventListener('pointerdown',e=>{if(viewZoom===1||e.button>0)return;pan={x:e.clientX,y:e.clientY,orig:[...mapViewBox],dragged:false};});
  svg.addEventListener('pointermove',e=>{if(!pan)return;const dx=e.clientX-pan.x,dy=e.clientY-pan.y;if(Math.abs(dx)+Math.abs(dy)>8&&!pan.dragged){pan.dragged=true;try{svg.setPointerCapture(e.pointerId);}catch{}}
    if(!pan.dragged)return;const rect=svg.getBoundingClientRect(),[ox,oy,w,h]=pan.orig;
    mapViewBox=[Math.max(0,Math.min(790-w,ox-dx*w/rect.width)),Math.max(0,Math.min(530-h,oy-dy*h/rect.height)),w,h];svg.setAttribute('viewBox',mapViewBox.join(' '));
  });
  const end=e=>{if(!pan)return;if(pan.dragged){ignoreNextMapClick=true;setTimeout(()=>ignoreNextMapClick=false,90);}pan=null;try{svg.releasePointerCapture(e.pointerId);}catch{}};
  svg.addEventListener('pointerup',end);svg.addEventListener('pointercancel',end);
}
function updateExplorerSelection(){const card=$('#explorerSelected');if(!municipality||cityGeoUF!==uf){card.hidden=true;return;}
  card.hidden=false;$('#explorerSelectedName').textContent=`${cityName} · ${STATE_NAMES[uf]}`;$('#explorerSelectedSummary').textContent='Buscando os votos oficiais desta cidade...';
}
function updateExplorerSummary(data){if(!municipality||$('#explorerSelected').hidden)return;
  const elem=$('#explorerSelectedSummary');
  if(data&&(data.state==='ok'||data.state==='stale')&&data.candidates?.length){const leader=data.candidates[0];elem.textContent=`${leader.name} está à frente com ${fmtPct(leader.percentage)} dos votos válidos. ${fmtPct(data.progress)} das seções totalizadas; ${data.sectionsRemaining===null?'restante não informado':fmtVotes(data.sectionsRemaining)+' seções restantes'}. ${data.finished?'Totalização encerrada.':'Apuração parcial.'}`;}
  else elem.textContent='Não foi possível apresentar os votos desta cidade neste momento. Você ainda pode tentar novamente no painel completo.';
}
function renderExplorerSuggestions(){const query=normalizeName($('#explorerSearch').value.trim()),root=$('#explorerSuggestions');root.replaceChildren();
  if(!query||!cityCache[uf]?.municipalities){root.hidden=true;$('#explorerSearchStatus').textContent='Digite o nome da cidade ou toque no mapa.';return;}
  const items=cityCache[uf].municipalities.filter(c=>normalizeName(c.name).includes(query)).slice(0,8);
  for(const item of items){const btn=el('button','explorer-suggestion',item.name);btn.type='button';btn.addEventListener('click',()=>{selectCity({...item,uf},{fromExplorer:true});$('#explorerSearch').value=item.name;$('#explorerSearchStatus').textContent=`Cidade selecionada: ${item.name}. Os resultados aparecem abaixo.`;root.hidden=true;});root.append(btn);}
  root.hidden=!items.length;$('#explorerSearchStatus').textContent=items.length?`${items.length} cidade(s) encontrada(s). Toque em uma opção.`:'Cidade não encontrada neste estado. Confira o nome.';
}
function closeCityMap(){++explorerLoadSequence;$('#cityMapPanel').hidden=true;$('#statesList').closest('.state-sidebar').hidden=false;$('#mapGrid').classList.remove('exploring');document.body.classList.remove('explorer-open');
  $('#cityMap').replaceChildren(el('p','loading-state','Selecione um estado para explorar.'));$('#explorerSearch').value='';$('#explorerSuggestions').hidden=true;$('#explorerSelected').hidden=true;
  if(explorerOpenedFrom?.isConnected)explorerOpenedFrom.focus({preventScroll:true});
}

async function openCityMap(){
  const selected=uf;if(selected==='br'){toast('Escolha um estado no mapa do Brasil.');return;}
  const seq=++explorerLoadSequence;
  $('#cityMapPanel').hidden=false;$('#statesList').closest('.state-sidebar').hidden=true;$('#mapGrid').classList.add('exploring');
  if(matchMedia('(max-width:800px)').matches){document.body.classList.add('explorer-open');$('#cityMapClose').focus({preventScroll:true});}
  if(cityGeoUF!==selected){viewZoom=1;mapViewBox=null;}
  $('#cityMapPanel').setAttribute('role',matchMedia('(max-width:800px)').matches?'dialog':'region');$('#cityMapPanel').setAttribute('aria-modal',String(matchMedia('(max-width:800px)').matches));
  $('#cityMapTitle').textContent='Mapa do '+(selected==='df'?'Distrito Federal':STATE_NAMES[selected]);
  $('#explorerBreadcrumb').textContent=selected.toUpperCase();
  $('#explorerSearch').value='';$('#explorerSuggestions').hidden=true;$('#explorerSearchStatus').textContent='Digite uma cidade ou toque no mapa.';
  $('#cityMap').replaceChildren(el('p','loading-state','Preparando as cidades e o mapa do estado...'));
  updateExplorerSelection();
  if(!cityCache[selected]){
    try{const data=await fetchJson('/api/municipalities?uf='+selected);if(seq!==explorerLoadSequence)return;
      if(data.state==='ok')cityCache[selected]=data;else throw Error('Catálogo indisponível');
    }catch{if(seq!==explorerLoadSequence)return;$('#cityMap').replaceChildren(el('p','loading-state','Não conseguimos carregar a lista do TSE agora. Use a busca de cidade no topo da página.'));return;}
  }
  if(cityGeoUF===selected&&cityGeoFeatures){drawCityMap();return;}
  try{const data=await fetchJson('/api/geo/cities?uf='+selected);if(seq!==explorerLoadSequence)return;
    cityGeoFeatures=data.features||null;cityGeoUF=selected;drawCityMap();updateExplorerSelection();
  }catch{if(seq!==explorerLoadSequence)return;cityGeoFeatures=null;cityGeoUF=selected;
    $('#cityMap').replaceChildren(el('p','loading-state','O mapa do IBGE está temporariamente indisponível. A pesquisa de municípios acima continua funcionando.'));
  }
}
async function checkAutomaticRound(){
  try{const data=await fetchJson('/api/auto');
    updateUnlockStatus(!!data.unlocked);
    const candidate=data.recommendedRound===2?2:1;
    $('#autoStatus').textContent=data.unlocked?'2º turno liberado · aguardando publicação oficial':'1º turno disponível · 2º turno em 25 de outubro';
    if(!manualTurn&&candidate!==round){changeRound(candidate,false);refreshGovernorSituation();}
  }catch{const enabled=dateInBrasilia()>='2026-10-25';updateUnlockStatus(enabled);
    $('#autoStatus').textContent=enabled?'2º turno liberado · consultando TSE':'O segundo turno será liberado em 25 de outubro';
    if(!manualTurn&&round!==(enabled?2:1)){changeRound(enabled?2:1,false);refreshGovernorSituation();}
  }
}
function setupSharing(){
  $('#shareBtn').addEventListener('click',async()=>{const link=location.href;if(navigator.share){try{await navigator.share({title:'UrnaFlash 2026',url:link});return;}catch{}}
    try{await navigator.clipboard.writeText(link);toast('Link copiado para compartilhar!');}catch{toast('Copie o endereço da barra do navegador.');}});
  $('#advertBtn').addEventListener('click',()=>{
    const subject=encodeURIComponent('Interesse em anunciar no UrnaFlash');const body=encodeURIComponent('Olá! Tenho interesse em divulgar minha empresa no UrnaFlash.\n\nNome:\nEmpresa:\nCidade:\nMensagem:\n');
    location.href=`mailto:${email()}?subject=${subject}&body=${body}`;
  });
  $('#copyEmailBtn').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(email());toast('E-mail comercial copiado.');}catch{toast('Contato: '+email());}});
}
async function cleanupOldSW(){try{if('serviceWorker' in navigator)for(const r of await navigator.serviceWorker.getRegistrations())if(r.scope.startsWith(location.origin))await r.unregister();}catch{}
  try{if('caches' in window)for(const k of await caches.keys())if(k.startsWith('urnaflash-shell-'))await caches.delete(k);}catch{}}
function init(){setTheme(readStore('urnaflash-theme','light'));$('#themeToggle').addEventListener('click',()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark'));
  const path=location.pathname.split('/').filter(Boolean),code=Object.entries(SLUGS).find(([,slug])=>slug===path[1])?.[0];
  uf=code||'br';const params=new URLSearchParams(location.search);
  const unlocked=dateInBrasilia()>='2026-10-25';updateUnlockStatus(unlocked);
  manualTurn=params.get('turno')==='1'||(unlocked&&params.get('turno')==='2');round=manualTurn?(params.get('turno')==='2'?2:1):(unlocked?2:1);
  office=OFFICES[params.get('cargo')]?params.get('cargo'):'presidente';municipality=/^\d{5}$/.test(params.get('municipio')||'')?params.get('municipio'):'';
  if(municipality){cityName=uf==='pr'&&municipality==='75221'?'Carambeí':`Município ${municipality}`;}
  document.querySelectorAll('#turnButtons [data-round]').forEach(btn=>btn.addEventListener('click',()=>changeRound(Number(btn.dataset.round))));
  document.querySelectorAll('#officeButtons [data-office]').forEach(btn=>btn.addEventListener('click',()=>changeOffice(btn.dataset.office)));
  $('#changePlaceBtn').addEventListener('click',()=>{if(uf==='br'&&office!=='presidente'){$('#mapa').scrollIntoView({behavior:'smooth'});$('#stateSearch').focus();}else{$('#cityQuery').focus();$('#busca').scrollIntoView({behavior:'smooth'});}});
  $('#stateRaceButton').addEventListener('click',showGovernorFromShortcut);
  $('#stateRaceSummaryButton').addEventListener('click',showGovernorFromShortcut);
  $('#allBrazilBtn').addEventListener('click',()=>{changeUF('br');$('#resultados').scrollIntoView({behavior:'smooth'});});
  $('#refreshBtn').addEventListener('click',refreshResults);$('#mapRefresh').addEventListener('click',refreshMap);
  $('#stateSearch').addEventListener('input',renderStateList);
  $('#moreCandidates').addEventListener('click',()=>{allCandidates=true;paintCandidates();});
  $('#cityMapToggle').addEventListener('click',()=>{explorerOpenedFrom=document.activeElement;openCityMap();$('#mapa').scrollIntoView({behavior:'smooth',block:'start'});});
  $('#cityMapClose').addEventListener('click',closeCityMap);
  $('#explorerSearch').addEventListener('input',renderExplorerSuggestions);
  $('#explorerSearch').addEventListener('keydown',e=>{if(e.key==='Enter'){const first=$('#explorerSuggestions button');if(first){e.preventDefault();first.click();}}});
  $('#explorerSeeResult').addEventListener('click',()=>{closeCityMap();$('#resultados').scrollIntoView({behavior:'smooth',block:'start'});});
  $('#explorerZoomIn').addEventListener('click',()=>zoomExplorer(1.6));$('#explorerZoomOut').addEventListener('click',()=>zoomExplorer(1/1.6));$('#explorerZoomReset').addEventListener('click',resetExplorerZoom);
  document.addEventListener('keydown',e=>{if($('#cityMapPanel').hidden)return;
    if(e.key==='Escape'){e.preventDefault();closeCityMap();return;}
    if(e.key==='Tab'&&matchMedia('(max-width:800px)').matches){
      const focusables=[...$('#cityMapPanel').querySelectorAll('button:not([disabled]):not([hidden]),input:not([disabled]),[tabindex="0"]')].filter(n=>n.getClientRects().length);
      const first=focusables[0],last=focusables[focusables.length-1];if(!first||!last)return;
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    }
  });

  setupCitySearch();setupSharing();updateHeadings();drawTiles();renderStateList();refreshResults();refreshMap();refreshGovernorSituation();loadGeometry();checkAutomaticRound();cleanupOldSW();
  refreshTimer=setInterval(()=>{if(document.hidden)return;checkAutomaticRound();refreshResults();refreshMap();if(uf!=='br')refreshGovernorSituation();},60_000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){refreshResults();refreshMap();checkAutomaticRound();}});
}
init();
