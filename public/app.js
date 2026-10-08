// UrnaFlash — web responsiva, sem instalação nem bibliotecas externas.
// A fonte dos votos é exclusivamente /api/results (integração TSE no servidor).
const POLL_MS = 30_000;
const UF_OPTIONS = [
  ['br','Brasil — geral'],['ac','Acre'],['al','Alagoas'],['ap','Amapá'],['am','Amazonas'],
  ['ba','Bahia'],['ce','Ceará'],['df','Distrito Federal'],['es','Espírito Santo'],
  ['go','Goiás'],['ma','Maranhão'],['mt','Mato Grosso'],['ms','Mato Grosso do Sul'],
  ['mg','Minas Gerais'],['pa','Pará'],['pb','Paraíba'],['pr','Paraná'],['pe','Pernambuco'],
  ['pi','Piauí'],['rj','Rio de Janeiro'],['rn','Rio Grande do Norte'],['rs','Rio Grande do Sul'],
  ['ro','Rondônia'],['rr','Roraima'],['sc','Santa Catarina'],['sp','São Paulo'],['se','Sergipe'],['to','Tocantins']
];
const SLUGS = {
  br:'',ac:'acre',al:'alagoas',ap:'amapa',am:'amazonas',ba:'bahia',ce:'ceara',
  df:'distrito-federal',es:'espirito-santo',go:'goias',ma:'maranhao',mt:'mato-grosso',
  ms:'mato-grosso-do-sul',mg:'minas-gerais',pa:'para',pb:'paraiba',pr:'parana',
  pe:'pernambuco',pi:'piaui',rj:'rio-de-janeiro',rn:'rio-grande-do-norte',
  rs:'rio-grande-do-sul',ro:'rondonia',rr:'roraima',sc:'santa-catarina',
  sp:'sao-paulo',se:'sergipe',to:'tocantins'
};
const CANDIDATES = [
  {number:'22', name:'Flávio Bolsonaro', party:'PL', color:'flavio'},
  {number:'13', name:'Lula', party:'PT', color:'lula'}
];
const $ = selector => document.querySelector(selector);
const numberFormat = new Intl.NumberFormat('pt-BR');
const votesFormat = value => Number.isFinite(value) ? numberFormat.format(value) : '—';
const percentFormat = value => Number.isFinite(value) ? value.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}) : '—';
const clamp = n => Math.max(0, Math.min(100, Number(n) || 0));
const readStore = (key, fallback) => { try { return localStorage.getItem(key) || fallback; } catch { return fallback; } };
const saveStore = (key, value) => { try { localStorage.setItem(key,value); } catch {} };
const emailAddress = () => ['contato','urnaflash'].join('') + '@' + ['gmail','com'].join('.');
let round=2, uf='br', currentRequest=0, refreshInProgress=false, toastTimer=null;
const snapshots=new Map();
function pathFor(code){ return code==='br' ? '/' : `/eleicoes-2026/${SLUGS[code]}`; }
function regionName(){ return UF_OPTIONS.find(x=>x[0]===uf)?.[1]?.replace(' — geral','') || 'Brasil'; }
function toast(message){
  const el=$('#toast'); el.textContent=message; el.hidden=false;
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.hidden=true,3800);
}
function setTheme(theme){
  const dark=theme==='dark';
  document.documentElement.dataset.theme=dark?'dark':'light';
  $('#themeToggle').setAttribute('aria-pressed',String(dark));
  $('#themeToggle').setAttribute('aria-label',dark?'Ativar modo claro':'Ativar modo escuro');
  $('#themeLabel').textContent=dark?'Modo claro':'Modo escuro';
  document.querySelector('meta[name="theme-color"]').setAttribute('content',dark?'#101720':'#f7f9fc');
  saveStore('urnaflash-theme',dark?'dark':'light');
}
function updateAddress(){
  const url=new URL(location.href); url.pathname=pathFor(uf);
  if(round===1) url.searchParams.set('turno','1'); else url.searchParams.delete('turno');
  history.replaceState(null,'',url.pathname+url.search+url.hash);
  const name=regionName();
  document.title=`Eleições 2026${uf==='br'?'':` em ${name}`}: Apuração do ${round}º Turno | UrnaFlash`;
  const canonical=document.querySelector('link[rel="canonical"]');
  if(canonical) canonical.href=location.origin+url.pathname;
  const og=document.querySelector('meta[property="og:url"]');
  if(og) og.content=location.origin+url.pathname;
}
function setRound(next){
  if(next===round) return; round=next; saveStore('urnaflash-turno',String(round));
  for(const n of [1,2]){
    const btn=$(`#round${n}`); btn.classList.toggle('selected',n===round); btn.setAttribute('aria-pressed',String(n===round));
  }
  updateAddress(); clearResults(); refresh();
}
function setUF(next){
  if(!UF_OPTIONS.some(([key])=>key===next)) return;
  uf=next; saveStore('urnaflash-uf',uf); updateAddress(); clearResults(); refresh();
}
function setBanner(kind, title, text){
  const b=$('#statusBanner'); b.className=`status-banner ${kind||''}`;
  b.querySelector('.banner-symbol').textContent=kind==='ok'?'✓':kind==='error'?'!':'i';
  b.querySelector('strong').textContent=title;
  b.querySelector('div > span').textContent=text;
}
function setSource(text, available){
  $('#sourceText').textContent=text;
  $('#sourcePill').classList.toggle('offline',!available);
}
function setTag(text,good=false){const tag=$('#panelPill');tag.textContent=text;tag.classList.toggle('ready',good);}
function makeCandidate(config,data){
  const box=document.createElement('article');
  box.className=`candidate-card candidate-${config.color}`;
  const meta=document.createElement('span');meta.className='candidate-meta';meta.textContent=`${config.number} · ${config.party}`;
  const name=document.createElement('h4');name.textContent=config.name;
  const strong=document.createElement('strong');strong.className='candidate-votes';
  const pct=data && Number.isFinite(data.percentage) ? data.percentage : null;
  strong.textContent=pct===null?'—':`${percentFormat(pct)}%`;
  const p=document.createElement('p');p.textContent=pct===null?'Votos ainda não divulgados':`${votesFormat(data.votes)} votos`;
  const meter=document.createElement('div');meter.className='candidate-meter';
  const fill=document.createElement('span');fill.style.width=`${clamp(pct)}%`;meter.append(fill);
  box.append(meta,name,strong,p,meter);return box;
}
function resetProgress(){
  $('#progressPercent').textContent='—';$('#progressBar').style.width='0%';
  $('#progressTrack').removeAttribute('aria-valuenow');
  $('#progressText').textContent='Aguardando divulgação';
  $('#sectionCounts').textContent='— seções';
  $('#lastUpdated').textContent='Última atualização: indisponível';
  $('#voteDiff').textContent='—';$('#validVotes').textContent='—';
  $('#voteDiffDetail').textContent='Entre os dois candidatos';
}
function clearResults(){
  $('#resultHeading').textContent=`${round}º turno · ${regionName()}`;
  setTag('Aguardando apuração');
  const grid=document.createDocumentFragment();
  for(const config of CANDIDATES) grid.append(makeCandidate(config,null));
  $('#resultBody').replaceChildren(grid);
  resetProgress();renderHistory();
}
function snapshotKey(){return `${round}-${uf}`;}
function recordSnapshot(result){
  if(result.state!=='ok' || !Number.isFinite(result.progress) || result.progress<=0)return;
  const candidates=CANDIDATES.map(x=>result.candidates.find(c=>String(c.number)===x.number));
  if(candidates.some(c=>!c||!Number.isFinite(c.percentage)))return;
  const key=snapshotKey(), list=snapshots.get(key)||[];
  const signature=candidates.map(c=>`${c.number}/${c.votes}`).join(':');
  if(list.length&&list[list.length-1].signature===signature)return;
  list.push({signature,time:new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}),p:result.progress,values:candidates.map(c=>c.percentage)});
  if(list.length>40)list.shift();snapshots.set(key,list);
}
function renderHistory(){
  const root=$('#historyBody'),list=snapshots.get(snapshotKey())||[];
  root.replaceChildren();
  if(list.length<2){
    root.className='history-empty';
    const icon=document.createElement('span');icon.className='empty-graphic';icon.textContent='⌁';icon.setAttribute('aria-hidden','true');
    const title=document.createElement('strong');title.textContent=list.length?'Aguardando uma nova atualização':'O histórico aparecerá aqui';
    const msg=document.createElement('span');msg.textContent='As mudanças serão registradas enquanto esta página estiver aberta.';
    root.append(icon,title,msg);return;
  }
  root.className='history-chart';
  const vals=list.flatMap(x=>x.values), ymin=Math.max(0,Math.floor(Math.min(...vals)-3)), ymax=Math.min(100,Math.ceil(Math.max(...vals)+3));
  const svgNS='http://www.w3.org/2000/svg';
  const chart=document.createElementNS(svgNS,'svg'); chart.setAttribute('viewBox','0 0 480 155');
  chart.setAttribute('role','img');chart.setAttribute('aria-label','Gráfico de evolução dos percentuais dos dois candidatos durante esta visita');
  const y=v=>140-(v-ymin)/(ymax-ymin||1)*120;
  for(const gy of [20,80,140]){
    const l=document.createElementNS(svgNS,'line');l.setAttribute('x1','8');l.setAttribute('x2','472');l.setAttribute('y1',String(gy));l.setAttribute('y2',String(gy));l.setAttribute('stroke','var(--line)');l.setAttribute('stroke-width','1');chart.append(l);
  }
  for(const [index,color] of ['var(--flavio)','var(--lula)'].entries()){
    const path=document.createElementNS(svgNS,'path');
    const points=list.map((item,i)=>[8+i/(list.length-1)*464,y(item.values[index])]);
    path.setAttribute('d',points.map(([x,yv],i)=>`${i?'L':'M'}${x.toFixed(2)} ${yv.toFixed(2)}`).join(' '));
    path.setAttribute('fill','none');path.setAttribute('stroke',color);path.setAttribute('stroke-width','3');path.setAttribute('stroke-linecap','round');path.setAttribute('stroke-linejoin','round');chart.append(path);
  }
  const axis=document.createElement('div');axis.className='history-axis';
  const start=document.createElement('span');start.textContent=list[0].time;
  const end=document.createElement('span');end.textContent=list.at(-1).time;axis.append(start,end);
  const legend=document.createElement('div');legend.className='history-legend';
  CANDIDATES.forEach((candidate,i)=>{
    const label=document.createElement('span');const dot=document.createElement('i');dot.className=i===0?'color-a':'color-b';
    label.append(dot,document.createTextNode(`${candidate.name}: ${percentFormat(list.at(-1).values[i])}%`));legend.append(label);
  });
  const note=document.createElement('p');note.className='history-note';note.textContent='Histórico local desta visita. Não representa uma série histórica completa da eleição.';
  root.append(chart,axis,legend,note);
}
function showResults(data){
  const grid=document.createDocumentFragment();
  const chosen=CANDIDATES.map(cfg=>data.candidates.find(c=>String(c.number)===cfg.number));
  CANDIDATES.forEach((cfg,i)=>grid.append(makeCandidate(cfg,chosen[i])));
  $('#resultBody').replaceChildren(grid);
  const progress=Number.isFinite(data.progress)?clamp(data.progress):null;
  $('#progressPercent').textContent=progress===null?'—':`${percentFormat(progress)}%`;
  $('#progressBar').style.width=`${progress??0}%`;
  if(progress!==null) $('#progressTrack').setAttribute('aria-valuenow',String(progress));
  else $('#progressTrack').removeAttribute('aria-valuenow');
  $('#progressText').textContent=progress===null?'Totalização não informada':data.finished?'Totalização concluída':'Totalização em andamento';
  $('#sectionCounts').textContent=Number.isFinite(data.sectionsCounted)&&Number.isFinite(data.sectionsTotal)?
    `${votesFormat(data.sectionsCounted)} de ${votesFormat(data.sectionsTotal)} seções`:'Seções não informadas';
  $('#lastUpdated').textContent=data.generatedAt?`Atualização informada pelo TSE: ${data.generatedAt}`:'Atualização sem horário informado';
  if(chosen.every(c=>c && Number.isFinite(c.votes))){
    $('#voteDiff').textContent=votesFormat(Math.abs(chosen[0].votes-chosen[1].votes));
    $('#voteDiffDetail').textContent='Diferença entre os dois candidatos';
  }else{$('#voteDiff').textContent='—';}
  $('#validVotes').textContent=Number.isFinite(data.validVotes)?votesFormat(data.validVotes):'—';
  recordSnapshot(data);renderHistory();
}
async function refresh(){
  const id=++currentRequest, chosenRound=round, chosenUF=uf;
  if(!refreshInProgress){refreshInProgress=true;$('#refreshBtn').classList.add('refreshing');}
  let data;
  try{
    const response=await fetch(`/api/results?round=${chosenRound}&uf=${chosenUF}`,{cache:'no-store'});
    data=await response.json();
    if(!response.ok && data.state!=='unavailable')throw new Error('Falha da API');
  }catch{data={state:'unavailable',message:'Não foi possível conectar ao servidor de resultados.'};}
  if(id!==currentRequest||chosenRound!==round||chosenUF!==uf)return;
  refreshInProgress=false;$('#refreshBtn').classList.remove('refreshing');
  if(data.state==='ok'||data.state==='stale'){
    showResults(data);
    const fresh=data.state==='ok';
    setSource(fresh?'Fonte TSE · disponível':'Fonte TSE · sem atualização',fresh);
    setTag(fresh?(data.finished?'Concluída':'Dados oficiais'):'Dados anteriores',fresh);
    setBanner(fresh?'ok':'error',fresh?(data.finished?'Totalização concluída':'Resultados oficiais disponíveis'):'Última leitura salva',fresh?'Valores recebidos do TSE. Os números podem mudar durante a apuração.':data.message||'Não foi possível atualizar os dados agora.');
  }else{
    clearResults();
    if(data.state==='awaiting'){
      setSource('Aguardando divulgação',false);
      setTag('Ainda não iniciada');
      setBanner('', 'Aguardando publicação do TSE','Não há dados oficiais disponíveis para o turno selecionado.');
    }else{
      setSource('Fonte indisponível',false);
      setTag('Sem dados disponíveis');
      setBanner('error','Consulta temporariamente indisponível',data.message||'Tente novamente em instantes.');
    }
  }
}
function updateDate(){
  const start=Date.parse('2026-10-25T08:00:00-03:00');
  const end=Date.parse('2026-10-25T17:00:00-03:00');
  const now=Date.now(); const el=$('#countdownText');
  if(now>=end){el.textContent='Acompanhe a divulgação oficial';return;}
  if(now>=start){el.textContent='Dia de votação · horário de Brasília';return;}
  const days=Math.ceil((start-now)/86400000);
  el.textContent=`Faltam ${days} ${days===1?'dia':'dias'} para a votação`;
}
function setupContact(){
  // Endereço montado apenas no clique; evita colocá-lo como texto estático no HTML.
  // Isso reduz coleta simples por robôs, mas não substitui filtros anti-spam no Gmail.
  $('#advertBtn').addEventListener('click',()=>{
    const subject=encodeURIComponent('Interesse em anunciar no UrnaFlash');
    const body=encodeURIComponent('Olá, gostaria de conhecer os espaços de publicidade disponíveis no UrnaFlash.\n\nEmpresa:\nNome:\nMensagem:\n');
    window.location.href=`mailto:${emailAddress()}?subject=${subject}&body=${body}`;
  });
  $('#copyEmailBtn').addEventListener('click',async()=>{
    try{await navigator.clipboard.writeText(emailAddress());toast('E-mail comercial copiado!');}
    catch{toast(`Contato: ${emailAddress()}`);}
  });
}
async function share(){
  const link=location.origin+pathFor(uf)+(round===1?'?turno=1':'');
  const options={title:'UrnaFlash — Eleições 2026',text:'Acompanhe os resultados oficiais das eleições de 2026.',url:link};
  if(navigator.share){try{await navigator.share(options);return;}catch(e){if(e.name==='AbortError')return;}}
  try{await navigator.clipboard.writeText(link);toast('Link copiado!');}
  catch{toast('Copie o endereço do navegador para compartilhar.');}
}
async function cleanupPreviousPWA(){
  // A versão anterior possuía instalação PWA. Esta versão foca só na web.
  try{if('serviceWorker' in navigator){const regs=await navigator.serviceWorker.getRegistrations();for(const reg of regs)if(reg.scope.startsWith(location.origin))await reg.unregister();}}
  catch{}
  try{if('caches' in window){for(const key of await caches.keys())if(key.startsWith('urnaflash-shell-'))await caches.delete(key);}}
  catch{}
}
function init(){
  setTheme(readStore('urnaflash-theme','light'));
  $('#themeToggle').addEventListener('click',()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark'));
  const select=$('#ufSelect');
  for(const [code,name] of UF_OPTIONS.slice(1)){
    const option=document.createElement('option');option.value=code;option.textContent=name;select.append(option);
  }
  const search=new URLSearchParams(location.search);
  const savedRound=readStore('urnaflash-turno','2');
  round=search.get('turno')==='1'?1:search.get('turno')==='2'?2:savedRound==='1'?1:2;
  const slug=location.pathname.split('/').filter(Boolean)[1];
  const code=Object.entries(SLUGS).find(([,label])=>label && label===slug)?.[0];
  const savedUF=readStore('urnaflash-uf','br');
  uf=code||(location.pathname==='/'?'br':UF_OPTIONS.some(([c])=>c===savedUF)?savedUF:'br');
  select.value=uf;
  for(const n of [1,2]){$(`#round${n}`).classList.toggle('selected',n===round);$(`#round${n}`).setAttribute('aria-pressed',String(n===round));$(`#round${n}`).addEventListener('click',()=>setRound(n));}
  select.addEventListener('change',e=>setUF(e.target.value));
  $('#refreshBtn').addEventListener('click',refresh);
  $('#shareBtn').addEventListener('click',share);
  setupContact();updateAddress();updateDate();clearResults();refresh();cleanupPreviousPWA();
  setInterval(updateDate,60_000);
  setInterval(()=>{if(!document.hidden)refresh();},POLL_MS);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
}
init();
