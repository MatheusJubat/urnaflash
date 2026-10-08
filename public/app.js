const API_POLL_MS = 30_000;
const UF_OPTIONS = [
  ['br','Brasil — Geral'],['ac','Acre'],['al','Alagoas'],['ap','Amapá'],['am','Amazonas'],
  ['ba','Bahia'],['ce','Ceará'],['df','Distrito Federal'],['es','Espírito Santo'],
  ['go','Goiás'],['ma','Maranhão'],['mt','Mato Grosso'],['ms','Mato Grosso do Sul'],
  ['mg','Minas Gerais'],['pa','Pará'],['pb','Paraíba'],['pr','Paraná'],['pe','Pernambuco'],
  ['pi','Piauí'],['rj','Rio de Janeiro'],['rn','Rio Grande do Norte'],['rs','Rio Grande do Sul'],
  ['ro','Rondônia'],['rr','Roraima'],['sc','Santa Catarina'],['sp','São Paulo'],['se','Sergipe'],['to','Tocantins'],
];
const UF_SLUGS = {
  br:'',ac:'acre',al:'alagoas',ap:'amapa',am:'amazonas',ba:'bahia',ce:'ceara',
  df:'distrito-federal',es:'espirito-santo',go:'goias',ma:'maranhao',mt:'mato-grosso',
  ms:'mato-grosso-do-sul',mg:'minas-gerais',pa:'para',pb:'paraiba',pr:'parana',
  pe:'pernambuco',pi:'piaui',rj:'rio-de-janeiro',rn:'rio-grande-do-norte',
  rs:'rio-grande-do-sul',ro:'rondonia',rr:'roraima',sc:'santa-catarina',
  sp:'sao-paulo',se:'sergipe',to:'tocantins'
};
function pagePath(selectedUF) { return selectedUF === 'br' ? '/' : `/eleicoes-2026/${UF_SLUGS[selectedUF]}`; }
function updateAddress(){
  const url=new URL(location.href);
  url.pathname=pagePath(uf);
  if(round===1) url.searchParams.set('turno','1'); else url.searchParams.delete('turno');
  window.history.replaceState(null,'',url.pathname+url.search+url.hash);
  const label=UF_OPTIONS.find(([code])=>code===uf)?.[1]?.replace(' — Geral','')||'Brasil';
  document.title= uf==='br' ? 'Eleições 2026: Apuração do 2º Turno ao Vivo | UrnaFlash'
    : `Eleições 2026 em ${label}: Apuração do 2º Turno | UrnaFlash`;
}
const CANDIDATES = [
  { number:'22', display:'Flávio Bolsonaro', party:'PL', caption:'PARTIDO LIBERAL', css:'flavio' },
  { number:'13', display:'Lula', party:'PT', caption:'PARTIDO DOS TRABALHADORES', css:'lula' },
];
// Valores divulgados pela Agência Brasil em 04/10/2026; exibidos somente como
// referência identificada quando a consulta técnica ao TSE estiver indisponível.
const FIRST_ROUND_REFERENCE = {
  state: 'reference', round: 1, uf:'BR', generatedAt:'04/10/2026',
  candidates:[
    {number:'22',name:'Flávio Bolsonaro',votes:56103033,percentage:47.03,party:'PL'},
    {number:'13',name:'Lula',votes:53870724,percentage:45.16,party:'PT'},
  ], progress: null, sectionsCounted: null, sectionsTotal: null, validVotes:null,
  source:'Agência Brasil — notícia de 04/10/2026',
  sourceUrl:'https://agenciabrasil.ebc.com.br/politica/noticia/2026-10/quando-sera-o-segundo-turno-das-eleicoes-veja-data',
};
const AD_CONTACT_EMAIL = ''; // Troque por um e-mail REAL ao ativar a área de publicidade.
const qs = sel => document.querySelector(sel);
const numberFormat = new Intl.NumberFormat('pt-BR');
const pctFormat = v => Number.isFinite(v) ? v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}) : '—';
const displayNum = v => Number.isFinite(v) ? numberFormat.format(v) : '—';
let round = 2;
let uf = 'br';
let refreshPromise = null;
let activeRefreshKey = null;
let lastRequestId = 0;
let history = new Map();
let toastTimeout = null;
let deferredInstall = null;

function safePref(key, fallback) { try { return localStorage.getItem(key) || fallback; } catch { return fallback; } }
function storePref(key, val) { try { localStorage.setItem(key,val); } catch {} }
function toast(message) {
  const element = qs('#toast');
  element.textContent = message; element.hidden = false;
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => element.hidden = true, 4200);
}
function countdown() {
  // Para o início da votação às 08:00 no horário de Brasília em 25/10/2026 (UTC-03).
  const target = Date.parse('2026-10-25T08:00:00-03:00');
  const delta = Math.max(0, target - Date.now());
  qs('#days').textContent = String(Math.floor(delta/86400000)).padStart(2,'0');
  qs('#hours').textContent = String(Math.floor(delta/3600000)%24).padStart(2,'0');
  qs('#minutes').textContent = String(Math.floor(delta/60000)%60).padStart(2,'0');
}
function setRound(n) {
  round = n;
  storePref('urnaflash-turno',String(round));
  updateAddress();
  for (const r of [1,2]) {
    const node = qs(`#round${r}`);
    node.classList.toggle('selected',r===round);
    node.setAttribute('aria-pressed',String(r===round));
  }
  renderEmpty();
  refresh();
}
function setUf(code) {
  uf = code;
  storePref('urnaflash-uf',uf);
  updateAddress();
  renderEmpty();
  refresh();
}
function setBanner(type, title, detail) {
  const banner = qs('#statusBanner');
  banner.className = `section-status ${type}`;
  banner.querySelector('strong').textContent = title;
  banner.querySelector('span:last-child').textContent = detail;
  banner.querySelector('.banner-icon').textContent = type === 'ok' ? '✓' : type === 'error' ? '!' : '◌';
}
function setPill(text,ready=false) {
  qs('#panelPill').textContent = text;
  qs('#panelPill').classList.toggle('ready',ready);
}
function updateSource(text,state) {
  const pill = qs('#sourcePill');
  pill.classList.toggle('pending',state!=='ok');
  pill.lastChild.textContent = ` ${text}`;
}
function renderCandidate(config,candidate) {
  const known = candidate && Number.isFinite(candidate.percentage);
  const votes = known ? `${pctFormat(candidate.percentage)}<span>%</span>` : '—<span>%</span>';
  const bar = known ? Math.max(0, Math.min(100, candidate.percentage)) : 0;
  const votesText = known ? `${displayNum(candidate.votes)} votos` : 'Votos ainda não divulgados';
  // Todos os campos derivados dos JSONs são inseridos com textContent onde há nomes.
  const node = document.createElement('article');
  node.className = `candidate-card candidate-${config.css}`;
  node.innerHTML = `<div class="candidate-caption"><span class="candidate-number"></span><span class="candidate-caption-text"></span></div><h4></h4><div class="candidate-party"></div><div class="candidate-votes"></div><p></p><div class="candidate-bar"><i></i></div>`;
  node.querySelector('.candidate-number').textContent = config.number;
  node.querySelector('.candidate-caption-text').textContent = config.caption;
  node.querySelector('h4').textContent = config.display;
  node.querySelector('.candidate-party').textContent = config.party;
  node.querySelector('.candidate-votes').innerHTML = votes; // percentual formatado de número, não texto remoto
  node.querySelector('p').textContent = votesText;
  node.querySelector('.candidate-bar i').style.width = `${bar}%`;
  return node;
}
function renderEmpty() {
  const chosenUF = UF_OPTIONS.find(([code])=>code===uf)?.[1]?.replace(' — Geral','') || 'Brasil';
  qs('#resultHeading').textContent = `${round}º turno · ${chosenUF}`;
  qs('#panelPill').textContent = round === 2 ? 'Aguardando apuração' : 'Carregando resultados';
  setPill(round === 2 ? 'Aguardando apuração' : 'Carregando resultados');
  const grid = document.createElement('div');grid.className='candidate-grid';
  for (const candidate of CANDIDATES) grid.appendChild(renderCandidate(candidate,null));
  qs('#resultBody').replaceChildren(grid);
  qs('#progressText').textContent = 'Aguardando divulgação';
  qs('#progressPercent').textContent = '—';
  qs('#progressBar').style.width = '0%';
  qs('#lastUpdated').textContent = 'Última atualização: não disponível';
  qs('#sectionCounts').textContent = '— seções';
  qs('#voteDiff').textContent = '—';
  qs('#voteDiffDetail').textContent = 'Disponível após o início da apuração';
  qs('#validVotes').textContent = '—';
  renderHistory();
}
function historyKey(){return `${round}-${uf}`;}
function addHistory(result) {
  if (result.state !== 'ok' || !Number.isFinite(result.progress) || result.progress === 0) return;
  const list = history.get(historyKey()) || [];
  const first = result.candidates.find(c=>c.number==='22');
  const second = result.candidates.find(c=>c.number==='13');
  if (!first || !second) return;
  const signature = `${result.generatedAt}-${first.votes}-${second.votes}`;
  if (list.some(x => x.signature === signature)) return;
  list.push({signature, time: new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}),
    a:first.percentage,b:second.percentage,sections:result.progress });
  if (list.length > 32) list.shift();
  history.set(historyKey(),list);
}
function renderHistory() {
  const body = qs('#historyBody');
  const list = history.get(historyKey()) || [];
  if (!list.length) {
    body.className='chart-empty';
    body.replaceChildren();
    const icon=document.createElement('div');icon.className='empty-chart-icon';icon.textContent='⌁';
    const title=document.createElement('strong');title.textContent='O histórico aparece aqui';
    const paragraph=document.createElement('p');paragraph.textContent='Quando chegarem novas totalizações, vamos registrar os valores e exibir a evolução.';
    body.append(icon,title,paragraph);return;
  }
  body.className='history-list';body.replaceChildren();
  for(const item of list.slice(-7).reverse()) {
    const row=document.createElement('div');row.className='history-item';
    const time=document.createElement('span');time.className='history-time';time.textContent=`${item.time} · ${Math.round(item.sections)}%`;
    const bars=document.createElement('div');bars.className='history-bars';
    const a=document.createElement('span');a.className='bar-22';a.style.width=`${Math.min(100,item.a)}%`;
    const b=document.createElement('span');b.className='bar-13';b.style.width=`${Math.min(100,item.b)}%`;
    bars.append(a,b);
    const values=document.createElement('span');values.className='history-numbers';values.textContent=`${pctFormat(item.a)}% / ${pctFormat(item.b)}%`;
    row.append(time,bars,values);body.append(row);
  }
  const foot=document.createElement('p');foot.className='history-foot';
  foot.textContent='Registros feitos enquanto esta página permaneceu aberta. Dados do primeiro turno não são reconstruídos artificialmente.';
  body.append(foot);
}
function renderResults(data) {
  const grid=document.createElement('div');grid.className='candidate-grid';
  const selected=[];
  for (const config of CANDIDATES) {
    const actual=data.candidates.find(c=>String(c.number)===config.number);
    selected.push(actual);grid.append(renderCandidate(config,actual));
  }
  qs('#resultBody').replaceChildren(grid);
  const progress=Number.isFinite(data.progress) ? data.progress : null;
  qs('#progressPercent').textContent=progress===null?'—':`${pctFormat(progress)}%`;
  qs('#progressBar').style.width=progress===null?'0%':`${Math.min(100,Math.max(0,progress))}%`;
  qs('#progressText').textContent=progress===null?'Não disponível':progress===100?'Totalização concluída':'Totalização em andamento';
  qs('#sectionCounts').textContent=Number.isFinite(data.sectionsCounted)&&Number.isFinite(data.sectionsTotal)
    ? `${displayNum(data.sectionsCounted)} de ${displayNum(data.sectionsTotal)} seções`:'Seções não informadas';
  qs('#lastUpdated').textContent=data.generatedAt?`Fonte: ${data.generatedAt}`:'Atualização sem horário informado';
  const [a,b]=selected;
  if(a && b && Number.isFinite(a.votes) && Number.isFinite(b.votes)){
    qs('#voteDiff').textContent=displayNum(Math.abs(a.votes-b.votes));
    qs('#voteDiffDetail').textContent='Diferença entre os dois candidatos';
  }
  qs('#validVotes').textContent=Number.isFinite(data.validVotes)?displayNum(data.validVotes):'—';
  addHistory(data);renderHistory();
}
async function refresh() {
  const key=`${round}-${uf}`;
  if (refreshPromise && activeRefreshKey === key) return refreshPromise;
  const requestId=++lastRequestId;
  const requestedRound=round,requestedUf=uf;
  activeRefreshKey=key;
  qs('#refreshBtn').classList.add('refreshing');
  refreshPromise=(async()=>{
    let data;
    try {
      const response=await fetch(`/api/results?round=${requestedRound}&uf=${requestedUf}`,{cache:'no-store'});
      data=await response.json();
      if(!response.ok && data.state!=='unavailable') throw Error('Erro ao consultar apuração');
    }catch{data={state:'unavailable',message:'Sem conexão com o servidor de resultados.'};}
    if(requestId!==lastRequestId || requestedRound!==round || requestedUf!==uf) return;
    if(data.state==='ok'||data.state==='stale') {
      renderResults(data);
      setPill(data.state==='ok'?(data.finished?'Totalizado':'Dados oficiais'):'Dados desatualizados',data.state==='ok');
      setBanner(data.state==='ok'?'ok':'error',data.state==='ok'?(data.finished?'Totalização concluída':'Resultados oficiais do TSE'):'Última leitura disponível',data.state==='ok'?`Dados publicados pelo TSE. Atualizados conforme a fonte oficial. ${data.generatedAt||''}`:data.message);
      updateSource(data.state==='ok'?'Dados oficiais do TSE':'Dados sem atualização',data.state);
      return;
    }
    if(data.state==='unavailable' && requestedRound===1 && requestedUf==='br') {
      renderResults(FIRST_ROUND_REFERENCE);
      setPill('Referência publicada');
      setBanner('error','Referência jornalística — não é leitura ao vivo','A consulta ao TSE está indisponível. Exibindo números publicados pela Agência Brasil em 04/10/2026.');
      updateSource('Referência · 04 OUT','pending');
      return;
    }
    renderEmpty();
    if(data.state==='awaiting') {
      setBanner('', 'Aguardando publicação do TSE','O segundo turno ocorre em 25/10/2026. Não há resultados oficiais disponíveis para este turno.');
      setPill('Aguardando apuração');
      updateSource('Aguardando TSE','pending');
    } else {
      setBanner('error','Dados temporariamente indisponíveis',data.message||'Não foi possível acessar a fonte oficial.');
      setPill('Sem dados disponíveis');
      updateSource('Fonte indisponível','pending');
    }
  })();
  const thisRequest=refreshPromise;
  try { await thisRequest; }
  finally { if(refreshPromise === thisRequest){refreshPromise=null;activeRefreshKey=null;qs('#refreshBtn').classList.remove('refreshing');} }
}
function setupAdvert() {
  const link=qs('#advertBtn');
  if(AD_CONTACT_EMAIL){link.href=`mailto:${AD_CONTACT_EMAIL}?subject=${encodeURIComponent('Anúncio no UrnaFlash')}`;qs('#advertNote').textContent='Entre em contato para consultar disponibilidade.';}
  else {link.addEventListener('click',e=>{e.preventDefault();toast('Contato comercial em configuração.');});}
}
async function share() {
  const info={title:'UrnaFlash — Eleições 2026',text:'Confira a apuração presidencial por estado, com dados do TSE.',url:location.origin+pagePath(uf)+(round===1?'?turno=1':'')};
  if(navigator.share){try{await navigator.share(info);return;}catch(error){if(error.name==='AbortError')return;}}
  try{await navigator.clipboard.writeText(info.url);toast('Link copiado! Compartilhe com seus amigos.');}
  catch{toast('Copie o endereço da página para compartilhar.');}
}
function setupInstall(){
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredInstall=event;qs('#installBtn').hidden=false;});
  qs('#installBtn').addEventListener('click',async()=>{
    if(deferredInstall){deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;qs('#installBtn').hidden=true;}
    else toast('No navegador, escolha “Adicionar à tela inicial”.');
  });
  window.addEventListener('appinstalled',()=>{qs('#installBtn').hidden=true;toast('UrnaFlash adicionado à sua tela inicial!');});
  if(window.matchMedia('(display-mode: standalone)').matches) qs('#installBtn').hidden=true;
  if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
}
function init(){
  const select=qs('#ufSelect');
  for(const [code,label] of UF_OPTIONS.slice(1)){const option=document.createElement('option');option.value=code;option.textContent=label;select.append(option);}
  const prefRound=Number(safePref('urnaflash-turno','2'));
  const fromUrl=new URLSearchParams(location.search).get('turno');
  round=fromUrl==='1'?1:fromUrl==='2'?2:prefRound===1?1:2;
  const prefUf=safePref('urnaflash-uf','br');
  const activeSlug=location.pathname.split('/').filter(Boolean)[1];
  const slugUF=Object.entries(UF_SLUGS).find(([, slug])=>slug && slug===activeSlug)?.[0];
  uf=slugUF || (location.pathname==='/' ? 'br' : UF_OPTIONS.some(x=>x[0]===prefUf)?prefUf:'br');
  select.value=uf;
  updateAddress();
  for(const r of [1,2]){
    qs(`#round${r}`).classList.toggle('selected',r===round);
    qs(`#round${r}`).setAttribute('aria-pressed',String(r===round));
    qs(`#round${r}`).addEventListener('click',()=>{if(round!==r)setRound(r);});
  }
  select.addEventListener('change',event=>setUf(event.target.value));
  qs('#refreshBtn').addEventListener('click',()=>refresh());
  qs('#shareBtn').addEventListener('click',share);
  setupInstall();setupAdvert();countdown();
  renderEmpty();refresh();
  setInterval(countdown,60_000);
  setInterval(()=>{if(!document.hidden)refresh();},API_POLL_MS);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
}
init();
