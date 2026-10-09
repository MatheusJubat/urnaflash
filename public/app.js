'use strict';
const $=selector=>document.querySelector(selector);
const STATES=[['ac','Acre'],['al','Alagoas'],['ap','Amapá'],['am','Amazonas'],['ba','Bahia'],['ce','Ceará'],['df','Distrito Federal'],['es','Espírito Santo'],['go','Goiás'],['ma','Maranhão'],['mt','Mato Grosso'],['ms','Mato Grosso do Sul'],['mg','Minas Gerais'],['pa','Pará'],['pb','Paraíba'],['pr','Paraná'],['pe','Pernambuco'],['pi','Piauí'],['rj','Rio de Janeiro'],['rn','Rio Grande do Norte'],['rs','Rio Grande do Sul'],['ro','Rondônia'],['rr','Roraima'],['sc','Santa Catarina'],['sp','São Paulo'],['se','Sergipe'],['to','Tocantins']];
const STATE_NAMES=Object.fromEntries([['br','Brasil'],...STATES]);
const STATE_CAPITALS={ac:'Rio Branco',al:'Maceió',ap:'Macapá',am:'Manaus',ba:'Salvador',ce:'Fortaleza',df:'Brasília',es:'Vitória',go:'Goiânia',ma:'São Luís',mt:'Cuiabá',ms:'Campo Grande',mg:'Belo Horizonte',pa:'Belém',pb:'João Pessoa',pr:'Curitiba',pe:'Recife',pi:'Teresina',rj:'Rio de Janeiro',rn:'Natal',rs:'Porto Alegre',ro:'Porto Velho',rr:'Boa Vista',sc:'Florianópolis',sp:'São Paulo',se:'Aracaju',to:'Palmas'};
const SLUGS={ac:'acre',al:'alagoas',ap:'amapa',am:'amazonas',ba:'bahia',ce:'ceara',df:'distrito-federal',es:'espirito-santo',go:'goias',ma:'maranhao',mt:'mato-grosso',ms:'mato-grosso-do-sul',mg:'minas-gerais',pa:'para',pb:'paraiba',pr:'parana',pe:'pernambuco',pi:'piaui',rj:'rio-de-janeiro',rn:'rio-grande-do-norte',rs:'rio-grande-do-sul',ro:'rondonia',rr:'roraima',sc:'santa-catarina',sp:'sao-paulo',se:'sergipe',to:'tocantins'};
const FLAG_URL_BASE='https://raw.githubusercontent.com/akagabi/bandeira-dos-estados-do-brasil/master/';
const PHOTO_BASE='https://resultados.tse.jus.br/oficial/ele2026/';
const IBGE_CODES={ac:'12',al:'27',ap:'16',am:'13',ba:'29',ce:'23',df:'53',es:'32',go:'52',ma:'21',mt:'51',ms:'50',mg:'31',pa:'15',pb:'25',pr:'41',pe:'26',pi:'22',rj:'33',rn:'24',rs:'43',ro:'11',rr:'14',sc:'42',sp:'35',se:'28',to:'17'};
const IBGE_TO_UF=Object.fromEntries(Object.entries(IBGE_CODES).map(([uf,num])=>[num,uf]));
const OFFICES={presidente:'Presidente',governador:'Governador',senador:'Senador','deputado-federal':'Deputado federal','deputado-estadual':'Deputado estadual','deputado-distrital':'Deputado distrital'};
const TILES={rr:[0,2],ap:[0,5],am:[1,2],pa:[1,4],ma:[2,5],ce:[2,6],rn:[2,7],ac:[3,0],ro:[3,1],mt:[3,2],to:[3,4],pi:[3,5],pb:[3,7],pe:[4,6],al:[5,7],se:[5,6],ba:[5,5],ms:[4,2],go:[4,3],df:[4,4],mg:[5,4],es:[6,6],rj:[6,5],sp:[6,4],pr:[7,3],sc:[8,3],rs:[9,2]};
const fmtVotes=n=>Number(n||0).toLocaleString('pt-BR');
const fmtPct=n=>Number(n||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'%';
const fetchJson=async path=>{const response=await fetch(path,{cache:'no-store'});if(!response.ok)throw Error('HTTP '+response.status);return response.json();};
const el=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
let round=1,office='presidente',uf='br',municipality='',cityName='',manualTurn=false,candidateFilter='',shownCandidateCount=8,onlyElected=false,pickerForcedOpen=false;
let resultsSequence=0,mapSequence=0,statesData={},geoFeatures=null,mapRound=1,cityCache={},refreshTimer;
let cityGeoFeatures=null,cityGeoUF='',cityVoteCache=new Map();
let inlineCitySearchSequence=0,inlineCitySearchTimer=null,inlineCityRows=[],inlineCityCursor=-1;
let explorerOpenedFrom=null,explorerLoadSequence=0,latestResult=null,viewZoom=1,mapViewBox=null,ignoreNextMapClick=false;
let electionDayStarted=false,nationalSequence=0,latestNational=null,governorSequence=0,governorSituation=null;
const readStore=(key,defaultValue)=>{try{return localStorage.getItem(key)||defaultValue;}catch{return defaultValue;}};
const writeStore=(key,val)=>{try{localStorage.setItem(key,val);}catch{}};
function setTheme(theme){const isDark=theme==='dark';document.documentElement.dataset.theme=isDark?'dark':'light';$('#themeToggle').setAttribute('aria-pressed',String(isDark));$('#themeToggle').setAttribute('aria-label',isDark?'Ativar modo claro':'Ativar modo escuro');$('#themeIcon').textContent=isDark?'☀':'☾';$('#themeLabel').textContent=isDark?'Modo claro':'Modo escuro';writeStore('urnaflash-theme',theme);}
function toast(message){const node=$('#toast');node.textContent=message;node.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>node.hidden=true,4000);}
const candidatePhotos = new Map();
async function loadPhotoManifest(){try{const response=await fetch('/candidate-photos.json',{cache:'force-cache'});if(!response.ok)return;const data=await response.json();for(const [id,url] of Object.entries(data)){if(/^\d{8,18}$/.test(id)&&/^\/candidate-photos\/[a-zA-Z0-9_-]+\.(?:jpe?g|png|webp)$/.test(url))candidatePhotos.set(id,url);}}catch{}}
function stateFlag(code){const flag=el('span','state-flag-placeholder',code==='br'?'🇧🇷':String(code||'').toUpperCase());if(!STATE_NAMES[code]||code==='br')return flag;const img=el('img','state-flag');img.src=FLAG_URL_BASE+code+'.svg';img.alt='Bandeira de '+STATE_NAMES[code];img.width=38;img.height=26;img.loading='lazy';img.decoding='async';img.addEventListener('error',()=>img.replaceWith(flag),{once:true});return img;}
function regionHeading(target,code,text){const container=$(target);container.replaceChildren(stateFlag(code),el('span','',text));}
const email=()=>['contato','urnaflash'].join('')+'@'+'gmail.com';
const pathFor=code=>code==='br'?'/':`/eleicoes-2026/${SLUGS[code]}`;
function applyURL(){const params=new URLSearchParams();if(manualTurn||round===2)params.set('turno',String(round));if(office!=='presidente')params.set('cargo',office);if(municipality)params.set('municipio',municipality);const query=params.toString();history.replaceState({},'',pathFor(uf)+(query?'?'+query:''));}
// Na atualização (F5), a navegação reinicia no Brasil; links diretos continuam abrindo seus estados.
function navigationIsReload(){
  try{return performance.getEntriesByType('navigation').some(entry=>entry.type==='reload');}
  catch{return false;}
}
function announceSelection(text){const node=$('#selectionAnnouncement');if(node)node.textContent=text;}
function setStatus(kind,title,msg){const node=$('#statusBanner');node.dataset.status=kind;$('#statusTitle').textContent=title;$('#statusMessage').textContent=msg;}
function resetCandidateList(){focusWaiting();$('#electionOutcome').hidden=true;shownCandidateCount=8;onlyElected=false;$('#electedFilterBtn').hidden=true;$('#electedFilterBtn').setAttribute('aria-pressed','false');$('#electedFilterBtn').textContent='Mostrar apenas eleitos';$('#voteBreakdown').hidden=true;$('#candidateSearchWrap').hidden=true;candidateFilter='';$('#candidateSearch').value='';$('#candidateList').replaceChildren(el('div','empty-message','Aguardando a publicação dos resultados para esta seleção.'));$('#moreBar').hidden=true;$('#candidateCount').textContent='';
  for(const [key,txt] of [['progressPercent','—'],['validVotes','—'],['lastUpdated','—'],['sectionCounts','Sem informação'],['progressText','Sem informação']])$('#'+key).textContent=txt;
  $('#progressBar').style.width='0%';}
function dateInBrasilia(){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const pick=t=>parts.find(p=>p.type===t)?.value;return `${pick('year')}-${pick('month')}-${pick('day')}`;}
function updateUnlockStatus(dayStarted){
  electionDayStarted=dayStarted;
  const btn=$('#turnButtons [data-round="2"]');btn.disabled=false;
  btn.querySelector('small').textContent=dayStarted?'25 de outubro':'25 de outubro · Prévia';
  $('#roundUnlockHint').hidden=round!==2;
  $('#roundUnlockHint').textContent=dayStarted?'Segundo turno disponível. Os votos só aparecem após publicação oficial do TSE.':'Prévia disponível para testar o 2º turno. A votação ocorre em 25/10 e não há apuração oficial para mostrar antes disso. Na data, a página abrirá neste turno automaticamente.';
  renderAutoStatus();
}
function renderAutoStatus(){
  $('#autoStatus').textContent=electionDayStarted?'2º turno disponível · atualização oficial a partir das 17h':round===2?'Prévia do 2º turno · sem votos oficiais':'1º turno disponível · prévia do 2º turno liberada';
}
function populateOffices(){
  if(round===2&&!['presidente','governador'].includes(office))office='presidente';
  if(uf==='df'&&office==='deputado-estadual')office='deputado-distrital';
  if(uf!=='df'&&office==='deputado-distrital')office=uf==='br'?'presidente':'deputado-estadual';
  for(const btn of document.querySelectorAll('#officeButtons [data-office]')){
    const code=btn.dataset.office;
    const district=code==='deputado-distrital';
    const state=code==='deputado-estadual';
    const onlyFirst=!['presidente','governador'].includes(code);
    btn.hidden=(district&&uf!=='df')||(state&&uf==='df')||(round===2&&onlyFirst);
    btn.disabled=false;
    btn.classList.toggle('active',office===code);
    btn.setAttribute('aria-pressed',String(office===code));
  }
  $('#firstRoundOfficesBtn').hidden=round!==2;
  $('#officeQuickTitle').textContent=municipality?`Resultados de ${cityName}`:uf==='br'?'Outros cargos eleitorais':`Resultados de ${STATE_NAMES[uf]}`;
  $('#officeQuickTip').textContent=round===2?'Neste turno há presidente e, quando aplicável, governador.':uf==='br'?'Para governador e deputados, escolha um estado.':'Toque no cargo para ver os votos neste mesmo local.';
}

function updateHeadings(){populateOffices();
  document.querySelectorAll('#turnButtons [data-round]').forEach(btn=>{const active=Number(btn.dataset.round)===round;btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',String(active));});
  $('#mapRoundLabel').textContent=round+'º turno';$('#mapOtherLegend').hidden=round===2;
  const title=cityName&&municipality?`${cityName} (${uf.toUpperCase()})`:STATE_NAMES[uf]||'Brasil';
  const overviewLabel=$('#quickOverviewLabel'),overviewTip=$('#quickOverviewTip');if(overviewLabel)overviewLabel.textContent=`${title} · ${OFFICES[office]}`;if(overviewTip)overviewTip.textContent=municipality?'Votos da cidade selecionada':uf==='br'?'Resultado do Brasil inteiro':'Votos do estado selecionado';
  $('#officeCaption').textContent=OFFICES[office].toUpperCase();$('#electionHeading').textContent=uf==='br'&&office!=='presidente'?`${OFFICES[office]} · escolha seu estado`:`${round}º turno · ${title}`;
  $('#resultsSubtitle').textContent=round===2&&!electionDayStarted?'Prévia de navegação · sem apuração oficial até 25 de outubro':municipality?'Votos recebidos neste município conforme o TSE':office==='senador'?'Duas vagas de senador em disputa por estado':'Resultados oficiais da eleição selecionada';
  $('#selectedPlace').textContent=municipality?title:uf==='br'&&office!=='presidente'?'Selecione um estado':uf==='br'?'Brasil inteiro':STATE_NAMES[uf];
  const regionMark=$('#activeRegionFlag');if(regionMark)regionMark.replaceChildren(stateFlag(uf));
  $('#selectedPlaceHint').textContent=municipality?'Resultado municipal · dados do TSE':uf==='br'?'Busque sua cidade acima ou escolha um estado no mapa.':'Resultado estadual · clique no mapa para trocar.';
  $('#changePlaceBtn').textContent=uf==='br'?'Escolher estado':'Trocar estado';
  $('#changeCityBtn').textContent=uf==='br'?'Buscar cidade':'Trocar cidade';
  $('#heroRound').textContent=round+'º turno';$('#heroTitle').textContent=round===1?'Resultados do 1º turno':electionDayStarted?'Apuração do 2º turno':'Prévia do 2º turno';
  $('#heroSubtitle').textContent=round===1?'4 de outubro · Dados oficiais do TSE':electionDayStarted?'25 de outubro · Acompanhamento oficial':'Disponível para testar · votação em 25/10';
  updateLocalVoteFinder();
  $('#cityCardTitle').textContent=municipality?`Você está vendo ${cityName||'sua cidade'}`:'Sua cidade, sem complicação';
  $('#cityCardDescription').textContent=municipality?`Mostramos os votos de ${OFFICES[office].toLowerCase()} em ${cityName||'seu município'}, ${STATE_NAMES[uf]}. Para trocar de cidade, basta usar a busca no topo.`:'Digite o nome da sua cidade no campo no início da página. Não precisa procurar códigos nem navegar por uma lista enorme.';
  $('#cityMapToggle').disabled=uf==='br';
  $('#clearCityBtn').hidden=uf==='br';
  // O botao 'Voltar ao Brasil' ja limpa a selecao; nao duplicar a mesma acao na interface.
  $('#clearSelectionBtn').hidden=true;
  $('#allBrazilBtn').textContent=uf==='br'?'✓ Brasil inteiro':'← Voltar ao Brasil';
  $('#allBrazilBtn').setAttribute('aria-label',uf==='br'?'Exibindo Brasil inteiro':'Limpar seleção e voltar aos resultados do Brasil');
  $('#roundUnlockHint').hidden=round!==2;
  renderAutoStatus();applyURL();
}
function changeRound(value,manual=true){if(![1,2].includes(value))return;round=value;if(manual)manualTurn=true;pickerForcedOpen=false;closeInlineCityPicker();
  // Nunca mostrar dados do turno anterior enquanto chegam novas respostas oficiais.
  statesData={};latestNational=null;renderScopeSummary();renderStateList();drawMap();renderInsights();
  updateHeadings();resetCandidateList();refreshResults();refreshMap();}
function changeOffice(value){if(!OFFICES[value])return;
  if(value==='deputado-distrital'&&uf!=='df')return;
  $('#filterDisclosure').open=false;
  if(round===2&&!['presidente','governador'].includes(value)){
    round=1;manualTurn=true;
    toast('Senadores e deputados foram votados no 1º turno. Abrimos essa votação.');
  }
  office=value;pickerForcedOpen=false;closeInlineCityPicker();
  updateHeadings();resetCandidateList();refreshResults();drawMap();renderScopeSummary();
}

function changeUF(code){if(!STATE_NAMES[code])return;closeInlineCityPicker();pickerForcedOpen=false;if(code==='br'){resetToBrazil({focus:'results'});return;}uf=code;municipality='';cityName='';
  if(office==='deputado-distrital'&&uf!=='df')office='deputado-estadual';
  if(office==='deputado-estadual'&&uf==='df')office='deputado-distrital';
  $('#cityQuery').value='';renderCitySuggestions([]);showCityFeedback('Busque sua cidade pelo nome para ver os votos municipais.');
  updateHeadings();resetCandidateList();refreshResults();drawMap();refreshGovernorSituation();renderScopeSummary();renderExplorerStateVotes();}
// Reset único: mapa, cidade, botões, resultado e URL precisam concordar.
function resetToBrazil({focus='map',scroll=false}={}){
  const hadSelection=uf!=='br'||Boolean(municipality);
  ++citySearchRequest;clearTimeout(searchTimer);closeInlineCityPicker();
  // Fechar o explorador antes de atualizar o mapa; não devolver foco a um polígono removido.
  closeCityMap({restoreFocus:false});
  uf='br';municipality='';cityName='';office='presidente';pickerForcedOpen=false;
  $('#cityQuery').value='';$('#explorerSearch').value='';$('#stateSearch').value='';
  renderCitySuggestions([]);showCityFeedback('Mostrando Brasil inteiro. Digite o nome de uma cidade para consultar os votos.');
  $('#explorerSuggestions').hidden=true;
  updateHeadings();resetCandidateList();refreshResults();refreshGovernorSituation();
  renderStateList();drawMap();renderScopeSummary();
  announceSelection(hadSelection?'Seleção removida. Agora você está vendo o Brasil inteiro.':'Você já está vendo o Brasil inteiro.');
  if(focus==='search')$('#cityQuery').focus({preventScroll:true});
  else if(focus==='map')$('#mapTitle').focus({preventScroll:true});
  else if(focus==='results')$('#allBrazilBtn').focus({preventScroll:true});
  if(scroll){const target=focus==='results'?'#resultados':focus==='search'?'#busca':'#mapa';$(target).scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});}
}
function photoForCandidate(candidate){
  const id=String(latestResult?.electionId||'');
  const sq=String(candidate.sqcand||'');
  const scope=office==='presidente'?'br':uf;
  if(!/^\d{1,6}$/.test(id)||!/^\d{8,18}$/.test(sq)||!STATE_NAMES[scope])return null;
  return `${PHOTO_BASE}${encodeURIComponent(id)}/fotos/${scope}/${sq}.jpeg`;
}
function updateStatePicker(){
  const show=(office!=='presidente'&&uf==='br')||pickerForcedOpen;
  $('#officeStatePicker').hidden=!show;
  $('#changePlaceBtn').setAttribute('aria-expanded',String(show));
  if(!show)return;
  $('#officeStateHeading').textContent=`Qual estado você quer consultar?`;
  renderOfficeStates();
}
// Troca rápida de cidade no painel de resultados, sem passar pelo filtro de estados.
function closeInlineCityPicker({returnFocus=false}={}){
  clearTimeout(inlineCitySearchTimer);++inlineCitySearchSequence;
  $('#inlineCityPicker').hidden=true;
  $('#inlineCitySearch').setAttribute('aria-expanded','false');
  $('#changeCityBtn').setAttribute('aria-expanded','false');
  $('#inlineCitySuggestions').replaceChildren();$('#inlineCitySuggestions').hidden=true;
  inlineCityRows=[];inlineCityCursor=-1;
  if(returnFocus)$('#changeCityBtn').focus({preventScroll:true});
}
function renderInlineCities(items){
  const list=$('#inlineCitySuggestions');list.replaceChildren();inlineCityRows=items;inlineCityCursor=-1;
  $('#inlineCitySearch').removeAttribute('aria-activedescendant');
  items.forEach((item,i)=>{
    const button=el('button','inline-city-option');button.type='button';button.id='inline-city-option-'+i;
    button.setAttribute('role','option');button.setAttribute('aria-selected','false');
    button.append(el('strong','',item.name),el('small','',STATE_NAMES[item.uf]||item.uf.toUpperCase()));
    button.addEventListener('click',()=>chooseInlineCity(item));list.append(button);
  });
  list.hidden=items.length===0;$('#inlineCitySearch').setAttribute('aria-expanded',String(items.length>0));
}
function chooseInlineCity(item){
  // Evita escolher uma cidade de outro estado se o usuario alterou UF durante a busca.
  if(uf!=='br'&&item.uf!==uf)return;
  closeInlineCityPicker();selectCity(item,{keepPosition:true});
  $('#changeCityBtn').focus({preventScroll:true});
  announceSelection(`${item.name}, ${STATE_NAMES[item.uf]}: resultados atualizados para o mesmo cargo.`);
}
async function searchInlineCities(now=false){
  clearTimeout(inlineCitySearchTimer);const term=$('#inlineCitySearch').value.trim(),requestedUF=uf;
  const request=++inlineCitySearchSequence;
  if(term.length<2){renderInlineCities([]);$('#inlineCitySearchStatus').textContent='Digite pelo menos duas letras para buscar.';return;}
  const search=async()=>{
    $('#inlineCitySearchStatus').textContent='Procurando cidades...';
    try{
      const suffix=requestedUF==='br'?'':'&uf='+encodeURIComponent(requestedUF);
      const data=await fetchJson('/api/cities/search?q='+encodeURIComponent(term)+suffix);
      if(request!==inlineCitySearchSequence||$('#inlineCityPicker').hidden||requestedUF!==uf)return;
      const candidates=(data.cities||[]).filter(city=>requestedUF==='br'||city.uf===requestedUF);
      renderInlineCities(candidates);
      $('#inlineCitySearchStatus').textContent=data.state==='partial'?(data.message||'Busca temporariamente limitada. Tente novamente.'):
        candidates.length?`${candidates.length} cidade(s) encontrada(s). Selecione uma opção para ver os votos.`:'Nenhuma cidade encontrada. Confira a grafia e tente novamente.';
    }catch{
      if(request!==inlineCitySearchSequence)return;
      renderInlineCities([]);$('#inlineCitySearchStatus').textContent='Não foi possível consultar cidades agora. Tente novamente.';
    }
  };
  if(now)await search();else inlineCitySearchTimer=setTimeout(search,230);
}
function toggleInlineCityPicker(){
  const open=$('#inlineCityPicker').hidden;
  closeInlineCityPicker();
  if(!open)return;
  pickerForcedOpen=false;$('#officeStatePicker').hidden=true;$('#changePlaceBtn').setAttribute('aria-expanded','false');
  $('#filterDisclosure').open=true;$('#inlineCityPicker').hidden=false;
  $('#changeCityBtn').setAttribute('aria-expanded','true');
  $('#inlineCityHeading').textContent=uf==='br'?'Qual cidade você quer consultar?':`Qual cidade de ${STATE_NAMES[uf]} você quer consultar?`;
  $('#inlineCityTip').textContent=uf==='br'?'Busque por nome em todo o Brasil.':'Busque outra cidade de '+STATE_NAMES[uf]+'. Não precisa escolher o estado novamente.';
  $('#inlineCitySearch').value='';$('#inlineCitySearch').placeholder=uf==='br'?'Ex.: São Paulo, Salvador ou Manaus':'Ex.: '+STATE_CAPITALS[uf];
  $('#inlineCitySearchStatus').textContent='Digite duas letras para encontrar uma cidade.';
  $('#inlineCitySearch').focus({preventScroll:true});
}
function setupInlineCityPicker(){
  $('#changeCityBtn').addEventListener('click',toggleInlineCityPicker);
  $('#inlineCityClose').addEventListener('click',()=>closeInlineCityPicker({returnFocus:true}));
  $('#inlineCityFindBtn').addEventListener('click',()=>searchInlineCities(true));
  $('#inlineCitySearch').addEventListener('input',()=>searchInlineCities());
  $('#inlineCitySearch').addEventListener('keydown',e=>{
    if(e.key==='Escape'){e.preventDefault();closeInlineCityPicker({returnFocus:true});return;}
    if(['ArrowDown','ArrowUp'].includes(e.key)&&inlineCityRows.length){
      e.preventDefault();inlineCityCursor=(inlineCityCursor+(e.key==='ArrowDown'?1:-1)+inlineCityRows.length)%inlineCityRows.length;
      [...$('#inlineCitySuggestions').children].forEach((n,i)=>n.setAttribute('aria-selected',String(i===inlineCityCursor)));
      $('#inlineCitySearch').setAttribute('aria-activedescendant','inline-city-option-'+inlineCityCursor);
    } else if(e.key==='Enter'){
      e.preventDefault();
      if(inlineCityCursor>=0&&inlineCityRows[inlineCityCursor])chooseInlineCity(inlineCityRows[inlineCityCursor]);
      else if(inlineCityRows.length===1)chooseInlineCity(inlineCityRows[0]);
      else searchInlineCities(true);
    }
  });
}
function renderOfficeStates(){
  const q=normalizeName($('#officeStateSearch').value);
  const root=$('#officeStateOptions');root.replaceChildren();
  for(const [code,name] of STATES){
    if(!normalizeName(name+' '+code).includes(q))continue;
    const b=el('button','office-state-button');b.type='button';b.append(stateFlag(code),el('span','',`${name} · ${code.toUpperCase()}`));
    b.addEventListener('click',()=>{changeUF(code);$('#officeStateSearch').value='';pickerForcedOpen=false;$('#officeStatePicker').hidden=true;$('#resultsTitle').scrollIntoView({behavior:'smooth',block:'start'});announceSelection(`${name} selecionado. Resultados atualizados.`);});
    root.append(b);
  }
  if(!root.children.length)root.append(el('p','empty-message','Não encontramos esse estado.'));
}
function isLegislativeOffice(value=office){return ['deputado-federal','deputado-estadual','deputado-distrital'].includes(value);}
function updateLocalVoteFinder(){
  const enabled=Boolean(municipality&&cityName&&(isLegislativeOffice(office)||office==='senador'));
  $('#localVoteFinder').hidden=!enabled;
  $('#localVoteTitle').textContent=enabled?`Quem recebeu votos em ${cityName}?`:'Como sua cidade votou?';
  $('#localVoteDescription').textContent=enabled?`Confira os votos em ${cityName} (${uf.toUpperCase()}) para ${OFFICES[office].toLowerCase()}. A votação municipal é diferente da votação total do estado.`:'Encontre os votos registrados no município.';
  $('#candidateDetailTitle').textContent=enabled?`Todos os candidatos · ${cityName}`:'Lista completa de candidatos e votos';
  $('#candidateDetailSubtitle').textContent=enabled?`Votos em ${cityName}, não no estado inteiro`:'Pesquise nome, número ou partido e consulte os detalhes';
  $('#candidateSearchLabel').textContent=enabled?`Buscar nos votos de ${cityName}`:'Buscar candidato, partido ou número';
  if(!enabled){$('#localVoteSearch').value='';$('#localVoteSearchStatus').textContent='A busca encontra candidatos além dos primeiros colocados.';}
}
function syncCityCandidateQuery(){
  const term=$('#localVoteSearch').value;
  candidateFilter=term;$('#candidateSearch').value=term;
  shownCandidateCount=12;onlyElected=false;
  if(latestResult?.candidates?.length){
    paintCandidates();
    const total=latestCandidates.filter(c=>normalizeName(`${c.name} ${c.party} ${c.number}`).includes(normalizeName(term))).length;
    $('#localVoteSearchStatus').textContent=term.trim()?`${fmtVotes(total)} candidaturas encontradas nesta consulta municipal. Toque em “Ver votos” para abrir os resultados.`:`${fmtVotes(latestCandidates.length)} candidaturas disponíveis. Pesquise pelo nome ou toque em “Ver votos”.`;
  }else $('#localVoteSearchStatus').textContent='Aguardando dados oficiais da cidade para realizar a busca.';
}
function openCityCandidateResults(){
  $('#candidateDisclosure').open=true;
  syncCityCandidateQuery();
  const target=$('#candidatos');target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
  $('#candidateSearch').focus({preventScroll:true});
}
function candidateElement(candidate,i){
  const node=el('div','candidate');node.dataset.identity=candidate.number;
  node.append(el('span','candidate-rank',String(i+1).padStart(2,'0')));
  const portrait=el('span','candidate-portrait');portrait.setAttribute('aria-hidden','true');portrait.textContent=String(candidate.name||'?').trim().split(/\s+/).slice(0,2).map(w=>w[0]||'').join('').toUpperCase();
  const photo=candidatePhotos.get(String(candidate.sqcand||'')) || photoForCandidate(candidate);
  if(photo){const img=el('img','candidate-photo');img.src=photo;img.loading=i>2?'lazy':'eager';img.decoding='async';img.alt='';img.addEventListener('error',()=>img.replaceWith(portrait),{once:true});node.append(img);}else node.append(portrait);
  const main=el('div','candidate-details');main.append(el('div','candidate-name',candidate.name||'Nome não informado'),el('div','candidate-meta',`${candidate.party||'Partido não identificado'} · Nº ${candidate.number||'—'}`));
  if(!municipality&&candidate.elected&&latestResult?.finished)main.append(el('span','tiny-badge','Eleito, conforme o TSE'));
  else if(candidate.runoffQualified)main.append(el('span','tiny-badge','Classificado para o 2º turno'));
  node.append(main);
  const stats=el('div','candidate-votes');stats.append(el('strong','',fmtPct(candidate.percentage)),el('span','',`${fmtVotes(candidate.votes)} votos${municipality?' nesta cidade':''}`));node.append(stats);
  const bar=el('div','candidate-bar'),fill=el('span');fill.style.width=`${Math.max(0,Math.min(100,candidate.percentage))}%`;bar.append(fill);node.append(bar);
  return node;
}
// V9: um resumo único que muda com o estágio da apuração.
const visitBaselines=new Map();
function keyForVisit(){return `urnaflash-visit-v9-${round}-${office}-${uf}-${municipality||'all'}`;}
function focusPhaseFor(data){
  if(!data||!['ok','stale'].includes(data.state)||!data.candidates?.length)return 'awaiting';
  if(data.finished&&data.decision?.kind==='elected'&&data.candidates.some(c=>c.elected))return 'elected';
  if(data.finished&&data.decision?.kind==='runoff')return 'runoff';
  if(data.finished)return 'counted';
  return 'counting';
}
function focusWaiting(){
  const title=round===2?'Aguardando resultados do 2º turno':'Buscando resultados oficiais';
  $('#focusPhase').textContent=round===2?'AGUARDANDO PUBLICAÇÃO':'CONSULTANDO TSE';
  $('#focusTitle').textContent=title;
  $('#focusDescription').textContent=round===2?'O painel será preenchido quando o TSE divulgar votos e seções totalizadas.':'Não exibimos valores fictícios quando a fonte está indisponível.';
  $('#focusUpdated').textContent='Fonte: TSE';
  $('#focusCandidates').replaceChildren();
  $('#focusProgressValue').textContent='—';$('#focusProgressBar').style.width='0%';
  $('#focusProgressLabel').textContent='Seções totalizadas';
  $('#focusVisitMessage').textContent='Atualização automática quando a página estiver aberta.';
  $('#focusVotesMini').hidden=true;
  $('#liveFocus').dataset.phase='awaiting';
}
function focusCandidateCard(candidate,index,phase){
  const card=el('div','focus-person'),head=el('div','focus-person-identity'),portrait=el('div','focus-person-photo');
  portrait.textContent=String(candidate.name||'?').split(/\s+/).slice(0,2).map(s=>s[0]||'').join('').toUpperCase();
  const photo=candidatePhotos.get(String(candidate.sqcand||''))||photoForCandidate(candidate);
  if(photo){const img=el('img','');img.src=photo;img.alt='';img.loading='lazy';img.decoding='async';img.addEventListener('error',()=>img.replaceWith(portrait),{once:true});head.append(img);}else head.append(portrait);
  const names=el('div','focus-person-label');names.append(el('strong','',candidate.name||'Candidato'),el('small','',`${candidate.party||'Partido não identificado'} · Nº ${candidate.number||'—'}`));head.append(names);
  const numbers=el('div','focus-person-numbers');numbers.append(el('strong','',fmtPct(candidate.percentage)),el('small','',`${fmtVotes(candidate.votes)} votos`));
  card.append(head,numbers);
  const track=el('div','focus-person-track'),bar=el('span');bar.style.width=`${Math.min(100,Math.max(0,Number(candidate.percentage)||0))}%`;track.append(bar);card.append(track);
  if(!municipality&&phase==='elected'&&candidate.elected)card.append(el('span','focus-person-label-elected','Eleito, conforme o TSE'));
  return card;
}
function getVisitChange(data){
  const key=keyForVisit();let prior;
  if(visitBaselines.has(key))prior=visitBaselines.get(key);
  else{
    try{prior=JSON.parse(localStorage.getItem(key)||'null');}catch{prior=null;}
    visitBaselines.set(key,prior);
  }
  // Uma leitura anterior é apenas uma comparação local, nunca um dado do TSE.
  try{if(data.state==='ok')localStorage.setItem(key,JSON.stringify({counted:data.sectionsCounted,round,office,at:Date.now()}));}catch{}
  const current=Number(data.sectionsCounted),previous=Number(prior?.counted);
  if(prior&&Number.isFinite(current)&&Number.isFinite(previous)&&current>previous)return `Desde sua última visita neste navegador: +${fmtVotes(current-previous)} seções totalizadas.`;
  if(prior&&Number.isFinite(current)&&Number.isFinite(previous)&&current===previous)return 'Nenhuma nova seção totalizada desde sua última visita neste navegador.';
  return 'Este painel verifica atualizações automaticamente a cada 30 segundos.';
}
function renderFocus(data){
  if(!data||!['ok','stale'].includes(data.state)||!data.candidates?.length){focusWaiting();return;}
  const phase=focusPhaseFor(data),place=municipality?cityName:(STATE_NAMES[uf]||'Brasil');
  const legislative=['deputado-federal','deputado-estadual','deputado-distrital'].includes(office);
  $('#liveFocus').dataset.phase=phase;
  $('#focusPhase').textContent=municipality?'VOTOS NESTE MUNICÍPIO':phase==='elected'?'RESULTADO CONFIRMADO PELO TSE':phase==='runoff'?'CLASSIFICAÇÃO PARA O 2º TURNO':phase==='counted'?'TOTALIZAÇÃO ENCERRADA':'APURAÇÃO PARCIAL';
  const winner=!municipality&&phase==='elected'&&!legislative&&office!=='senador'?data.candidates.find(c=>c.elected):null;
  $('#focusTitle').textContent=municipality?`Como ${cityName} votou para ${OFFICES[office].toLowerCase()}?`:winner?`${winner.name} · eleito segundo o TSE`:phase==='elected'&&(legislative||office==='senador')?'Eleitos informados pelo TSE':phase==='runoff'?'Candidatos classificados para o 2º turno':phase==='counted'?'Seções totalizadas neste recorte':legislative?'Mais votados até agora':uf==='br'&&!municipality?'Quem está à frente no Brasil?':`Quem está à frente em ${place}?`;
  $('#focusDescription').textContent=municipality?`Estes são os votos registrados em ${cityName}. Use a busca abaixo para encontrar qualquer candidatura presente no arquivo municipal do TSE. A eleição de deputados depende do resultado estadual.`:legislative?'Para deputados, o mais votado não é necessariamente eleito. Consulte a lista com as marcações oficiais.':winner?'Resultado indicado nos arquivos oficiais, sem projeção do UrnaFlash.':phase==='runoff'?'A classificação para o segundo turno está indicada pelo TSE. Não significa eleição no primeiro turno.':phase==='counted'?'A contagem de seções terminou. A confirmação de eleito, quando existir, será indicada separadamente.':'Estes números são parciais e podem mudar conforme novas seções chegam.';
  $('#focusUpdated').textContent=data.generatedAt?`Atualização TSE: ${data.generatedAt}`:'Fonte: TSE';
  const featured=legislative?data.candidates.slice(0,2):data.candidates.slice(0,Math.min(2,data.candidates.length));
  $('#focusCandidates').replaceChildren(...featured.map((c,i)=>focusCandidateCard(c,i,phase)));
  $('#focusProgressLabel').textContent=`Seções totalizadas · ${fmtVotes(data.sectionsCounted)} de ${fmtVotes(data.sectionsTotal)}`;
  $('#focusProgressValue').textContent=fmtPct(data.progress);
  $('#focusProgressBar').style.width=`${Math.min(100,Math.max(0,Number(data.progress)||0))}%`;
  $('#focusVisitMessage').textContent=data.state==='stale'?'Mostrando a última leitura disponível; a atualização falhou.':getVisitChange(data);
  const mini=$('#focusVotesMini');mini.replaceChildren();
  for(const [label,value] of [['Válidos',data.validVotes],['Brancos',data.blankVotes],['Nulos',data.nullVotes]]){
    const item=el('div','focus-mini-vote');item.append(el('small','',label),el('strong','',value!==null&&value!==undefined&&Number.isFinite(Number(value))?fmtVotes(value):'—'));mini.append(item);
  }
  mini.hidden=false;
}
function renderInsights(){
  const root=$('#estatisticas'),grid=$('#insightsGrid');
  const national=latestNational;
  const values=Object.values(statesData).filter(s=>s?.candidates?.length&&['ok','stale'].includes(s.state));
  const canShow=round>=1&&national?.candidates?.length&&['ok','stale'].includes(national.state)&&values.length>0;
  root.hidden=!canShow;$('#mobileInsightsLink').hidden=!canShow;
  if(!canShow)return;
  const completed=national.finished&&values.length===27&&values.every(s=>s.finished);
  $('#insightsTitle').textContent=completed?'O Brasil depois da apuração':'Como os estados estão votando';
  $('#insightsIntro').textContent=completed?'Comparação dos resultados estaduais finalizados, com base em votos válidos.':`Comparação provisória de ${values.length} das 27 UFs com informações oficiais disponíveis. Os números ainda podem mudar.`;
  grid.replaceChildren();
  const people=national.candidates.slice(0,2);
  for(const candidate of people){
    const observations=values.map(s=>{const x=s.candidates.find(c=>String(c.number)===String(candidate.number));return x?{uf:s.uf,percentage:Number(x.percentage),votes:Number(x.votes),finished:s.finished}:null;}).filter(Boolean);
    if(!observations.length)continue;
    const strongestShare=[...observations].sort((a,b)=>b.percentage-a.percentage||a.uf.localeCompare(b.uf))[0];
    const strongestTotal=[...observations].sort((a,b)=>b.votes-a.votes||a.uf.localeCompare(b.uf))[0];
    const card=el('article','surface insights-card');
    card.append(el('span','eyebrow',candidate.party||'CANDIDATURA'),el('h3','',candidate.name));
    const statA=el('div','insight-line');statA.append(el('span','','Maior percentual de votos válidos'),el('strong','',`${STATE_NAMES[strongestShare.uf]} · ${fmtPct(strongestShare.percentage)}`));
    const statB=el('div','insight-line');statB.append(el('span','','Maior número absoluto de votos'),el('strong','',`${STATE_NAMES[strongestTotal.uf]} · ${fmtVotes(strongestTotal.votes)} votos`));
    card.append(statA,statB);grid.append(card);
  }
  $('#insightsDisclaimer').textContent=`Comparação entre ${values.length} UFs disponíveis. ${completed?'Totalização encerrada nas 27 unidades federativas, conforme fontes consultadas.':'Dados ainda parciais; a liderança e a ordem podem mudar.'} Percentuais são calculados sobre votos válidos, não sobre toda a população. Rankings municipais nacionais não são exibidos sem cobertura completa.`;
}
let latestCandidates=[];
function paintCandidates(){
  const term=normalizeName(candidateFilter);
  const candidates=onlyElected?latestCandidates.filter(c=>c.elected):latestCandidates;
  const matches=term?candidates.filter(c=>normalizeName(`${c.name} ${c.party} ${c.number}`).includes(term)):candidates;
  const subset=matches.slice(0,shownCandidateCount);
  $('#candidateList').replaceChildren(...subset.map((person,i)=>candidateElement(person,i)));
  if(!matches.length)$('#candidateList').append(el('p','empty-message',onlyElected?'Nenhum eleito encontrado nesta pesquisa.':'Nenhum candidato encontrado. Tente outro nome ou partido.'));
  $('#moreBar').hidden=matches.length<=shownCandidateCount;
  $('#moreCandidates').textContent=`Mostrar mais candidatos (${fmtVotes(matches.length-shownCandidateCount)} restantes) ↓`;
  $('#candidateCount').textContent=`${fmtVotes(Math.min(shownCandidateCount,matches.length))} de ${fmtVotes(matches.length)} candidaturas${municipality?' · votos nesta cidade':''}`;
}
function showResults(data){latestResult=data;latestCandidates=data.candidates||[];shownCandidateCount=municipality?12:8;onlyElected=false;
  if(municipality){$('#candidateDisclosure').open=true;$('#localVoteSearch').value='';candidateFilter='';$('#candidateSearch').value='';updateLocalVoteFinder();}
  $('#candidateSearchWrap').hidden=!municipality&&latestCandidates.length<=4;
  const legislative=['deputado-federal','deputado-estadual','deputado-distrital'].includes(office);
  const electedCount=latestCandidates.filter(c=>c.elected).length;
  $('#electedFilterBtn').hidden=Boolean(municipality)||!legislative||electedCount===0;
  $('#electedFilterBtn').textContent=`Ver somente eleitos (${electedCount})`;$('#electedFilterBtn').setAttribute('aria-pressed','false');
  paintCandidates();if(municipality)syncCityCandidateQuery();updateExplorerSummary(data);renderVoteBreakdown(data);renderFocus(data);
  const outcome=$('#electionOutcome'),elected=data.finished?data.candidates.filter(c=>c.elected):[];
  outcome.replaceChildren();outcome.hidden=false;
  if(data.decision?.kind==='runoff'){
    outcome.dataset.kind='finished';outcome.append(el('strong','','Candidatos classificados para o 2º turno'),el('p','',`${data.candidates.filter(c=>c.runoffQualified).map(c=>c.name).join(' e ')}. Classificação informada pelo TSE; não são eleitos no 1º turno.`));
  }else if(elected.length){
    outcome.dataset.kind='elected';
    if(['deputado-federal','deputado-estadual','deputado-distrital'].includes(office)){
      outcome.append(el('strong','',`${fmtVotes(elected.length)} candidaturas marcadas como eleitas pelo TSE`),el('p','','Consulte os nomes nos cartões abaixo. Use a busca ou toque em “Ver somente eleitos” para encontrar um candidato.'));
    }else{
      outcome.append(el('strong','',`Eleito conforme TSE: ${elected[0]?.name||'Candidato'}`),el('p','','Resultado informado no arquivo oficial desta disputa.'));
    }
  }
  else if(data.finished){outcome.dataset.kind='finished';outcome.append(el('strong','','Totalização encerrada'),el('p','','A totalização consta como encerrada, sem indicação de eleito no arquivo consultado.'));}
  else{outcome.dataset.kind='partial';outcome.append(el('strong','',`${data.candidates[0]?.name||'Candidato'} está à frente nesta consulta`),el('p','',`${fmtPct(data.candidates[0]?.percentage||0)} dos votos válidos informados até agora. Parcial: os números podem mudar.`));}

  if(!legislative||municipality)outcome.hidden=true;
  if(municipality&&office==='presidente'&&['ok','stale'].includes(data.state)&&data.candidates?.[0]?.votes>0){cityVoteCache.set(`${round}-${uf}-${municipality}`,{leader:data.candidates[0],progress:data.progress,sectionsRemaining:data.sectionsRemaining,finished:data.finished});if(cityGeoUF===uf&&!$('#cityMapPanel').hidden)drawCityMap();}
  $('#progressPercent').textContent=fmtPct(data.progress);$('#progressBar').style.width=Math.min(100,Math.max(0,data.progress))+'%';
  $('#validVotes').textContent=fmtVotes(data.validVotes);$('#lastUpdated').textContent=data.generatedAt||'Não informada';
  $('#sectionCounts').textContent=`${fmtVotes(data.sectionsCounted)} de ${fmtVotes(data.sectionsTotal)} seções`;
  $('#progressText').textContent=data.finished?'Totalização concluída':`Faltam ${data.sectionsRemaining===null?'—':fmtVotes(data.sectionsRemaining)} seções · parcial`;
  if(data.sourceUrl)$('#tseLink').href=data.sourceUrl;
}
function renderVoteBreakdown(data){
  const root=$('#voteBreakdown');root.hidden=false;
  const n=val=>Number.isFinite(Number(val))?Number(val):null;
  const total=n(data.totalVotes),valid=n(data.validVotes),blank=n(data.blankVotes),nulls=n(data.nullVotes);
  const entries=[['Votos válidos',valid],['Votos em branco',blank],['Votos nulos',nulls],['Total de votos',total]];
  root.replaceChildren();
  for(const [label,count] of entries){
    const box=el('div','vote-breakdown-item');box.append(el('span','',label),el('strong','',count===null?'—':fmtVotes(count)));
    if(total>0&&count!==null&&label!=='Total de votos')box.append(el('small','',fmtPct(count/total*100)+' do total de votos'));
    root.append(box);
  }
  root.append(el('p','vote-breakdown-note','Os percentuais dos candidatos usam votos válidos. Brancos e nulos são informados separadamente e não entram nesse cálculo.'));
}
async function refreshResults(){const my=++resultsSequence;updateHeadings();
  updateStatePicker();
  setStatus('loading','Consultando resultados oficiais','Buscando arquivo do TSE para a seleção atual.');
  const params=new URLSearchParams({round:String(round),uf,office});if(municipality)params.set('municipality',municipality);
  let data;try{data=await fetchJson('/api/results?'+params);}catch{data={state:'unavailable',message:'Servidor temporariamente indisponível.'};}
  if(my!==resultsSequence)return;
  if(data.state==='ok'||data.state==='stale'){
    showResults(data);
    setStatus(data.state==='ok'?'ok':'awaiting',data.state==='ok'?(data.finished?'Totalização concluída':'Números oficiais disponíveis'):'Último resultado conhecido',
      data.state==='stale'?'Atualização falhou, mostrando última leitura oficial disponível.':`Os dados são do TSE. ${data.finished?'Totalização finalizada no arquivo atual.':'Parcial: a distribuição pode mudar.'}`);
  }else{latestResult=null;updateExplorerSummary(null);latestCandidates=[];resetCandidateList();focusWaiting();
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
    button.setAttribute('aria-label',tooltipText(code)+(uf===code?' Selecionado. Clique novamente para voltar ao Brasil.':''));button.setAttribute('aria-pressed',String(uf===code));button.classList.toggle('is-selected',uf===code);button.title=tooltipText(code);button.addEventListener('click',()=>selectState(code));root.append(button);
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
  let rendered=0;const labelNodes=[];
  for(const feature of f){const code=getCode(feature);if(!code)continue;
    const paths=[];for(const poly of polygonsFor(feature.geometry)){for(const ring of poly){if(!Array.isArray(ring)||ring.length<3)continue;
      paths.push(ring.map((p,i)=>(i?'L':'M')+px(p[0]).toFixed(1)+','+py(p[1]).toFixed(1)).join(' ')+'Z');}}
    if(!paths.length)continue;
    const p=document.createElementNS(ns,'path');p.setAttribute('d',paths.join(' '));p.setAttribute('fill',mapFill(statusByUF(code)));
    p.setAttribute('fill-rule','evenodd');p.setAttribute('class','geo-state');p.setAttribute('tabindex','0');p.setAttribute('role','button');p.setAttribute('aria-label',tooltipText(code));
    const title=document.createElementNS(ns,'title');title.textContent=tooltipText(code);p.append(title);
    p.setAttribute('aria-pressed',String(uf===code));p.setAttribute('aria-label',tooltipText(code)+(uf===code?' Selecionado. Toque novamente para voltar ao Brasil.':''));p.setAttribute('data-selected',String(uf===code));p.addEventListener('click',()=>selectState(code));p.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectState(code);}});svg.append(p);
    // Legendas para UFs grandes; UFs pequenas sempre aparecem com dados na lista acessível ao lado.
    const vertices=polygonsFor(feature).flatMap(poly=>poly[0]||[]);const bx=vertices.reduce((a,v)=>a+v[0],0)/(vertices.length||1),by=vertices.reduce((a,v)=>a+v[1],0)/(vertices.length||1);
    if(vertices.length>3 && Number.isFinite(bx)&&Number.isFinite(by)){
      const label=document.createElementNS(ns,'text');label.setAttribute('x',px(bx));label.setAttribute('y',py(by));label.setAttribute('class','geo-state-label');label.setAttribute('text-anchor','middle');label.textContent=code.toUpperCase();labelNodes.push(label);
      const d=statusByUF(code);if(d?.leader){const percentage=document.createElementNS(ns,'text');percentage.setAttribute('x',px(bx));percentage.setAttribute('y',py(by)+12);percentage.setAttribute('class','geo-state-progress');percentage.setAttribute('text-anchor','middle');percentage.textContent=fmtPct(d.progress);labelNodes.push(percentage);}
    }
    rendered++;
  }
  if(rendered<15){drawTiles();return;}
  svg.append(...labelNodes);
  $('#geoMap').replaceChildren(svg);
}
function drawMap(){if(geoFeatures)drawGeoMap();else drawTiles();}
function renderStateList(){const root=$('#statesList'),q=$('#stateSearch').value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();root.replaceChildren();
  for(const [code,name] of STATES){if(!name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(q)&&!code.includes(q))continue;
    const data=statusByUF(code),btn=el('button','state-row');btn.type='button';btn.setAttribute('aria-label',tooltipText(code)+(uf===code?' Selecionado. Clique novamente para voltar ao Brasil.':''));btn.setAttribute('aria-pressed',String(uf===code));btn.classList.toggle('is-selected',uf===code);
    const left=el('div','state-identity');left.append(stateFlag(code));const labels=el('div','state-text');labels.append(el('b','',name),el('div','state-sub',code.toUpperCase()));left.append(labels);btn.append(left);
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
// O cartão principal é contextual: Brasil sem filtro; UF escolhida com dados do estado.
// A disputa exibida no mapa é SEMPRE a presidência, independentemente do cargo do painel abaixo.
function renderScopeSummary(){
  const isState=uf!=='br',d=isState?statusByUF(uf):latestNational;
  const place=isState?STATE_NAMES[uf]:'Brasil';
  $('#scopeEyebrow').textContent=`PRESIDÊNCIA · ${isState?place.toUpperCase():'BRASIL'}`;
  const good=isState?Boolean(d?.leader):['ok','stale'].includes(d?.state)&&Boolean(d?.candidates?.length);
  const candidate=isState?d?.leader:d?.candidates?.[0];
  const elected=!isState&&d?.finished&&d?.decision?.kind==='elected'?d.candidates?.find(c=>c.elected):null;
  if(!good){
    $('#nationalStatus').textContent=isState?`${place} · aguardando dados`:round===2?'Aguardando o início da divulgação':'Dados nacionais temporariamente indisponíveis';
    $('#nationalStatusDetail').textContent=isState?'Nenhum número oficial desta UF disponível por enquanto. Volte ao Brasil ou escolha outro estado.':round===2?'Os dados aparecerão após a divulgação oficial do TSE.':'Tente atualizar daqui a pouco. Nenhum número fictício será exibido.';
    $('#nationalBadge').textContent='Aguardando';$('#nationalProgress').textContent='—';$('#nationalProgressBar').style.width='0%';$('#nationalRemaining').textContent='—';$('#nationalSectionTotal').textContent='Sem informação';$('#nationalLeader').textContent='—';$('#nationalLeaderInfo').textContent='Fonte: TSE';$('#nationalLeadLabel').textContent='Candidato à frente';
    renderExplorerStateVotes();return;
  }
  const complete=Boolean(d.finished);
  $('#nationalStatus').textContent=isState?`${place} · ${complete?'totalização encerrada':'apuração parcial'}`:elected?'Resultado oficial da eleição':complete?'Totalização encerrada':`${round}º turno: apuração em andamento`;
  $('#nationalStatusDetail').textContent=isState?'Resultados presidenciais neste estado. A liderança estadual não representa o resultado nacional.':elected?`Eleito conforme o TSE: ${elected.name}`:complete?'Totalização encerrada; verifique o resultado oficial da eleição.':'A liderança pode mudar enquanto novas seções são totalizadas.';
  $('#nationalBadge').textContent=elected?'Eleito confirmado':complete?'Totalizada':'Parcial';
  $('#nationalProgress').textContent=fmtPct(d.progress);$('#nationalProgressBar').style.width=Math.max(0,Math.min(100,d.progress||0))+'%';
  $('#nationalRemaining').textContent=d.sectionsRemaining===null?'—':fmtVotes(d.sectionsRemaining);
  $('#nationalSectionTotal').textContent=`${fmtVotes(d.sectionsCounted)} de ${fmtVotes(d.sectionsTotal)} seções`;
  $('#nationalLeadLabel').textContent=elected?'Eleito segundo o TSE':'Candidato à frente';
  const displayed=elected||candidate;
  $('#nationalLeader').textContent=displayed.name;
  $('#nationalLeaderInfo').textContent=`${fmtPct(displayed.percentage)} dos votos válidos · ${fmtVotes(displayed.votes)} votos`;
  renderExplorerStateVotes();
}
function renderExplorerStateVotes(){
  const root=$('#explorerStateVotes');if(!root)return;
  const d=statusByUF(uf);
  if(uf==='br'){root.hidden=true;return;}
  root.hidden=false;
  $('#explorerStateVotesPlace').textContent=`Presidente · ${STATE_NAMES[uf]}`;
  if(!d?.leader){$('#explorerStateVotesLeader').textContent='Aguardando dados oficiais';$('#explorerStateVotesProgress').textContent='Os votos deste estado ainda não estão disponíveis.';return;}
  $('#explorerStateVotesLeader').textContent=`${d.leader.name} · ${fmtPct(d.leader.percentage)} dos votos válidos`;
  $('#explorerStateVotesProgress').textContent=`${fmtVotes(d.leader.votes)} votos · ${fmtPct(d.progress)} das seções totalizadas · ${d.sectionsRemaining===null?'Restante não informado':fmtVotes(d.sectionsRemaining)+' seções restantes'}`;
}
async function refreshNational(){const seq=++nationalSequence,currentRound=round;
  try{const data=await fetchJson(`/api/results?round=${currentRound}&uf=br&office=presidente`);if(seq!==nationalSequence)return;latestNational=data;renderScopeSummary();renderInsights();}
  catch{if(seq!==nationalSequence)return;latestNational=null;renderScopeSummary();renderInsights();}
}
async function refreshMap(){const seq=++mapSequence;mapRound=round;$('#statesReady').textContent='Consultando...';
  refreshNational();
  try{const data=await fetchJson('/api/map?round='+mapRound);if(seq!==mapSequence)return;
    statesData=Object.fromEntries((data.states||[]).map(s=>[s.uf,s]));renderStateList();drawMap();renderScopeSummary();renderInsights();
    const total=Object.values(statesData).filter(x=>x.finished).length;
    $('#mapHint').textContent=`${total} de 27 UFs com totalização encerrada. Toque em um estado para ver quem está à frente e quantas seções faltam.`;
  }catch{if(seq!==mapSequence)return;$('#statesReady').textContent='Indisponível';renderStateList();drawMap();renderScopeSummary();$('#mapHint').textContent='Não conseguimos atualizar todos os estados neste momento. Tente novamente.';}
}
async function loadGeometry(){try{const data=await fetchJson('/api/geo/states');if(data?.features?.length){geoFeatures=data.features;drawMap();}}catch{drawTiles();}}
function renderGovernorSituation(data){
  const show=uf!=='br'&&['presidente','governador'].includes(office),card=$('#stateRaceCard'),summary=$('#stateRaceSummary');
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
}

function selectState(code){
  if(code===uf){resetToBrazil({focus:'map',scroll:true});return;}
  explorerOpenedFrom=document.activeElement;changeUF(code);openCityMap();
  announceSelection(`${STATE_NAMES[code]} selecionado. Explore os municípios ou volte ao Brasil.`);
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
async function queryCities(immediate=false, preferredUF="", autoOpenExact=false){clearTimeout(searchTimer);const q=$('#cityQuery').value.trim();const seq=++citySearchRequest;
  if(q.length<2){renderCitySuggestions([]);showCityFeedback('Digite pelo menos duas letras do nome da cidade.');return;}
  const run=async()=>{showCityFeedback('Procurando cidades...');
    try{const data=await fetchJson('/api/cities/search?q='+encodeURIComponent(q)+(preferredUF?'&uf='+encodeURIComponent(preferredUF):''));if(seq!==citySearchRequest)return;
      if(autoOpenExact && data.state==='ok'){const exact=(data.cities||[]).find(c=>c.uf===preferredUF&&normalizeName(c.name)===normalizeName(q));if(exact){selectCity(exact);return;}}
      renderCitySuggestions(data.cities||[]);
      if(data.state==='partial')showCityFeedback((data.message||'Busca limitada no momento.')+((data.cities||[]).length?' Selecione a cidade encontrada.':''));
      else showCityFeedback((data.cities||[]).length?`${data.cities.length} opções. Toque na cidade desejada ou use as setas do teclado.`:'Não encontramos essa cidade. Confira a grafia e tente novamente.');
    }catch{if(seq!==citySearchRequest)return;renderCitySuggestions([]);showCityFeedback('Não foi possível consultar o catálogo do TSE. Tente novamente daqui a pouco.');}
  };if(immediate)await run();else searchTimer=setTimeout(run,220);
}
function selectCity(item,{fromExplorer=false,keepPosition=false}={}){const code=String(item.code||'').padStart(5,'0');if(!/^[0-9]{5}$/.test(code)||!STATE_NAMES[item.uf])return;
  uf=item.uf;municipality=code;cityName=item.name;
  if(office==='deputado-estadual'&&uf==='df')office='deputado-distrital';
  if(office==='deputado-distrital'&&uf!=='df')office='deputado-estadual';
  $('#cityQuery').value=`${item.name} — ${item.uf.toUpperCase()}`;
  renderCitySuggestions([]);showCityFeedback(`Local selecionado: ${item.name}, ${STATE_NAMES[uf]}. Resultado exibido abaixo.`);
  try{localStorage.setItem('urnaflash-last-city',JSON.stringify({code,uf,name:item.name}));}catch{}
  updateLastCity();updateHeadings();resetCandidateList();updateExplorerSelection();renderScopeSummary();
  announceSelection(`Cidade selecionada: ${item.name}, ${STATE_NAMES[uf]}.`);
  // Destacar a cidade imediatamente; não esperar pelos dados da API nem colorir outras seleções antigas.
  if(cityGeoUF===uf&&cityGeoFeatures&&!$('#cityMapPanel').hidden)drawCityMap();
  refreshResults();drawMap();refreshGovernorSituation();
  if(fromExplorer)return;
  closeCityMap();
  if(!keepPosition)$('#resultados').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
}
function updateLastCity(){let saved=null;try{saved=JSON.parse(localStorage.getItem('urnaflash-last-city')||'null');}catch{}
  $('#lastCityBtn').hidden=!(saved&&/^[0-9]{5}$/.test(saved.code)&&STATE_NAMES[saved.uf]);
  if(saved)$('#lastCityBtn').textContent=`↶ Última cidade: ${saved.name||'município'} (${saved.uf.toUpperCase()})`;
}
function setupCitySearch(){
  $('#cityQuery').addEventListener('input',()=>{
    if(!$('#cityQuery').value.trim()&&uf!=='br'){resetToBrazil({focus:'search'});return;}
    queryCities();
  });
  $('#cityFindBtn').addEventListener('click',()=>{if(searchRows.length===1)selectCity(searchRows[0]);else queryCities(true);});
  $('#cityQuery').addEventListener('keydown',event=>{const count=searchRows.length;if(event.key==='Escape'){renderCitySuggestions([]);return;}
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){if(!count)return;event.preventDefault();searchCursor=(searchCursor+(event.key==='ArrowDown'?1:-1)+count)%count;
      [...$('#citySuggestions').children].forEach((node,i)=>node.setAttribute('aria-selected',String(i===searchCursor)));
      $('#cityQuery').setAttribute('aria-activedescendant','city-option-'+searchCursor);
    }else if(event.key==='Enter'){event.preventDefault();if(searchCursor>=0&&searchRows[searchCursor])selectCity(searchRows[searchCursor]);else if(count===1)selectCity(searchRows[0]);else queryCities(true);}
  });
  document.addEventListener('click',event=>{if(!event.target.closest('#busca'))renderCitySuggestions([]);});
  document.querySelectorAll('.capital-shortcut').forEach(btn=>btn.addEventListener('click',()=>{
    $('#cityQuery').value=btn.dataset.capital;
    showCityFeedback('Buscando '+btn.dataset.capital+' nos dados do TSE...');
    queryCities(true,btn.dataset.uf,true);
  }));
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
  let drawn=0,selectedCityPath=null;
  for(const feature of cityGeoFeatures){
    const item=lookup.get(cityGeoId(feature));if(!item)continue;
    const segments=[];for(const poly of polygonsFor(feature.geometry))for(const ring of poly){if(ring.length<3)continue;
      segments.push(ring.map((pt,index)=>(index?'L':'M')+X(pt[0]).toFixed(1)+','+Y(pt[1]).toFixed(1)).join(' ')+'Z');}
    if(!segments.length)continue;
    const outcome=cityVoteCache.get(`${round}-${cityGeoUF}-${item.code}`);
    const isSelected=cityGeoUF===uf&&item.code===municipality;
    // Único padrão de leitura: somente a cidade ativa recebe destaque azul.
    const fill=isSelected?'var(--blue-soft)':'var(--gray)';
    const path=document.createElementNS(ns,'path');path.setAttribute('d',segments.join(' '));path.setAttribute('fill',fill);
    path.setAttribute('fill-rule','evenodd');path.setAttribute('class',`geo-city${isSelected?' is-selected':''}`);
    path.setAttribute('data-city-code',item.code);path.setAttribute('data-selected',String(isSelected));
    path.setAttribute('tabindex','0');path.setAttribute('role','button');
    path.setAttribute('aria-current',isSelected?'location':'false');
    const details=outcome?.leader?`Votos já consultados: ${outcome.leader.name} à frente com ${fmtPct(outcome.leader.percentage)} dos votos válidos, ${fmtPct(outcome.progress)} das seções totalizadas.`:'Resultado ainda não consultado neste mapa.';
    const title=`${item.name}${isSelected?' · CIDADE SELECIONADA':''}. ${details} ${isSelected?'Toque novamente para desmarcar e ver Brasil inteiro.':'Toque para consultar este município.'}`;
    path.setAttribute('aria-label',title);
    const t=document.createElementNS(ns,'title');t.textContent=title;path.append(t);
    const show=()=>{if(ignoreNextMapClick)return;if(isSelected){resetToBrazil({focus:'map',scroll:true});return;}selectCity(item,{fromExplorer:true});$('#explorerSearch').value=item.name;$('#explorerSearchStatus').textContent=`Cidade selecionada: ${item.name}. Apenas ela está destacada no mapa.`;};
    path.addEventListener('click',show);path.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();show();}});
    if(isSelected)selectedCityPath=path;
    else svg.append(path);
    drawn++;
  }
  if(selectedCityPath)svg.append(selectedCityPath); // Traçar acima dos limites vizinhos para o contorno não sumir.
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
function closeCityMap({restoreFocus=true}={}){++explorerLoadSequence;$('#cityMapPanel').hidden=true;$('#statesList').closest('.state-sidebar').hidden=false;$('#mapGrid').classList.remove('exploring');document.body.classList.remove('explorer-open');
  $('#cityMap').replaceChildren(el('p','loading-state','Selecione um estado para explorar.'));$('#explorerSearch').value='';$('#explorerSuggestions').hidden=true;$('#explorerSelected').hidden=true;
  if(restoreFocus&&explorerOpenedFrom?.isConnected)explorerOpenedFrom.focus({preventScroll:true});
}

async function openCityMap(){
  const selected=uf;if(selected==='br'){toast('Escolha um estado no mapa do Brasil.');return;}
  const seq=++explorerLoadSequence;
  $('#cityMapPanel').hidden=false;$('#statesList').closest('.state-sidebar').hidden=true;$('#mapGrid').classList.add('exploring');
  renderExplorerStateVotes();
  if(matchMedia('(max-width:800px)').matches){document.body.classList.add('explorer-open');$('#cityMapClose').focus({preventScroll:true});}
  if(cityGeoUF!==selected){viewZoom=1;mapViewBox=null;}
  $('#cityMapPanel').setAttribute('role',matchMedia('(max-width:800px)').matches?'dialog':'region');$('#cityMapPanel').setAttribute('aria-modal',String(matchMedia('(max-width:800px)').matches));
  $('#cityMapTitle').textContent='Mapa do '+(selected==='df'?'Distrito Federal':STATE_NAMES[selected]);
  $('#explorerBreadcrumb').textContent=selected.toUpperCase();
  $('#explorerSearch').placeholder='Ex.: '+(STATE_CAPITALS[selected]||'nome da cidade');
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
    if(!manualTurn&&candidate!==round){changeRound(candidate,false);refreshGovernorSituation();}
    updateHeadings();
  }catch{const enabled=dateInBrasilia()>='2026-10-25';updateUnlockStatus(enabled);
    if(!manualTurn&&round!==(enabled?2:1)){changeRound(enabled?2:1,false);refreshGovernorSituation();}
    updateHeadings();
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
  const resetOnReload=navigationIsReload();uf=resetOnReload?'br':code||'br';const params=new URLSearchParams(location.search);
  const unlocked=dateInBrasilia()>='2026-10-25';updateUnlockStatus(unlocked);
  manualTurn=['1','2'].includes(params.get('turno'));round=manualTurn?(params.get('turno')==='2'?2:1):(unlocked?2:1);
  office=resetOnReload?'presidente':OFFICES[params.get('cargo')]?params.get('cargo'):'presidente';municipality=!resetOnReload&&uf!=='br'&&/^\d{5}$/.test(params.get('municipio')||'')?params.get('municipio'):'';
  if(office!=='presidente')$('#filterDisclosure').open=true;
  if(municipality){cityName=uf==='pr'&&municipality==='75221'?'Carambeí':`Município ${municipality}`;}
  document.querySelectorAll('#turnButtons [data-round]').forEach(btn=>btn.addEventListener('click',()=>changeRound(Number(btn.dataset.round))));
  document.querySelectorAll('#officeButtons [data-office]').forEach(btn=>btn.addEventListener('click',()=>changeOffice(btn.dataset.office)));
  $('#changePlaceBtn').addEventListener('click',()=>{
    closeInlineCityPicker();
    $('#filterDisclosure').open=true;
    pickerForcedOpen=!pickerForcedOpen;
    updateStatePicker();
    if(pickerForcedOpen){$('#officeStatePicker').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'nearest'});$('#officeStateSearch').focus({preventScroll:true});}
    else $('#changePlaceBtn').focus();
  });
  setupInlineCityPicker();
  $('#stateRaceButton').addEventListener('click',showGovernorFromShortcut);
  $('#stateRaceSummaryButton').addEventListener('click',showGovernorFromShortcut);
  $('#allBrazilBtn').addEventListener('click',()=>resetToBrazil({focus:'results',scroll:true}));
  $('#clearCityBtn').addEventListener('click',()=>resetToBrazil({focus:'search',scroll:true}));
  $('#clearSelectionBtn').addEventListener('click',()=>resetToBrazil({focus:'results',scroll:true}));
  $('#explorerClearCity').addEventListener('click',()=>resetToBrazil({focus:'map',scroll:true}));
  $('#refreshBtn').addEventListener('click',refreshResults);$('#mapRefresh').addEventListener('click',refreshMap);
  $('#stateSearch').addEventListener('input',renderStateList);
  $('#officeStateSearch').addEventListener('input',renderOfficeStates);
  $('#candidateSearch').addEventListener('input',()=>{candidateFilter=$('#candidateSearch').value;shownCandidateCount=municipality?12:8;if(municipality)$('#localVoteSearch').value=candidateFilter;paintCandidates();});
  $('#localVoteSearch').addEventListener('input',syncCityCandidateQuery);
  $('#localVoteSearch').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();openCityCandidateResults();}});
  $('#localVoteOpen').addEventListener('click',openCityCandidateResults);
  $('#firstRoundOfficesBtn').addEventListener('click',()=>{changeRound(1);$('#officeQuickTitle').scrollIntoView({behavior:'smooth',block:'center'});});
  $('#electedFilterBtn').addEventListener('click',()=>{onlyElected=!onlyElected;shownCandidateCount=8;$('#electedFilterBtn').setAttribute('aria-pressed',String(onlyElected));$('#electedFilterBtn').textContent=onlyElected?'✓ Mostrando somente eleitos · Ver todos':'Ver somente eleitos ('+latestCandidates.filter(c=>c.elected).length+')';paintCandidates();});
  $('#moreCandidates').addEventListener('click',()=>{shownCandidateCount+=12;paintCandidates();});
  $('#cityMapToggle').addEventListener('click',()=>{explorerOpenedFrom=document.activeElement;openCityMap();$('#mapa').scrollIntoView({behavior:'smooth',block:'start'});});
  $('#cityMapClose').addEventListener('click',()=>resetToBrazil({focus:'map',scroll:true}));
  $('#explorerSearch').addEventListener('input',renderExplorerSuggestions);
  $('#explorerSearch').addEventListener('keydown',e=>{if(e.key==='Enter'){const first=$('#explorerSuggestions button');if(first){e.preventDefault();first.click();}}});
  $('#explorerSeeResult').addEventListener('click',()=>{closeCityMap();$('#resultados').scrollIntoView({behavior:'smooth',block:'start'});});
  $('#explorerZoomIn').addEventListener('click',()=>zoomExplorer(1.6));$('#explorerZoomOut').addEventListener('click',()=>zoomExplorer(1/1.6));$('#explorerZoomReset').addEventListener('click',resetExplorerZoom);
  document.addEventListener('keydown',e=>{if($('#cityMapPanel').hidden)return;
    if(e.key==='Escape'){e.preventDefault();resetToBrazil({focus:'map',scroll:true});return;}
    if(e.key==='Tab'&&matchMedia('(max-width:800px)').matches){
      const focusables=[...$('#cityMapPanel').querySelectorAll('button:not([disabled]):not([hidden]),input:not([disabled]),[tabindex="0"]')].filter(n=>n.getClientRects().length);
      const first=focusables[0],last=focusables[focusables.length-1];if(!first||!last)return;
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    }
  });

  loadPhotoManifest().then(()=>{if(latestResult?.candidates?.length)paintCandidates();});
  document.querySelectorAll('a[href="#candidatos"]').forEach(a=>a.addEventListener('click',()=>{$('#candidateDisclosure').open=true;}));
  setupCitySearch();setupSharing();updateHeadings();drawTiles();renderStateList();renderScopeSummary();refreshResults();refreshMap();refreshGovernorSituation();loadGeometry();checkAutomaticRound();cleanupOldSW();
  refreshTimer=setInterval(()=>{if(document.hidden)return;checkAutomaticRound();refreshResults();refreshMap();if(uf!=='br')refreshGovernorSituation();},30_000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){refreshResults();refreshMap();checkAutomaticRound();}});
}
init();
