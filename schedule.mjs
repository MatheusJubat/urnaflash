// Calendário de exibição do segundo turno: Brasília (America/Sao_Paulo).
export const SECOND_ROUND_DATE='2026-10-25';
export function brasilDate(date=new Date()){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const get=type=>parts.find(p=>p.type===type)?.value||'';
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function secondRoundUnlocked(date=new Date()){return brasilDate(date)>=SECOND_ROUND_DATE;}
export function defaultRound(date=new Date()){return secondRoundUnlocked(date)?2:1;}
// 2º turno abre como tela inicial à meia-noite, mas só consulta o TSE a partir das 17h.
// Evita centenas de arquivos 404 na manhã do pleito.
export function secondRoundPublicationOpen(date=new Date()){
  const day=brasilDate(date);
  if(day>SECOND_ROUND_DATE)return true;
  if(day<SECOND_ROUND_DATE)return false;
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);
  const get=type=>Number(parts.find(p=>p.type===type)?.value||0);
  return get('hour')>=17;
}
// Nunca definir eleito a partir de uma liderança ou de 100% de seções.
export function officialOutcome(result){
  if(!result||!['ok','stale'].includes(result.state))return {kind:'unavailable'};
  if(result.finished&&result.candidates?.some(c=>c.elected))return {kind:'elected',people:result.candidates.filter(c=>c.elected)};
  if(result.finished)return {kind:'totalized-pending-confirmation'};
  return {kind:'partial'};
}
