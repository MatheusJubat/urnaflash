// Mapeamento público de UFs para páginas indexáveis. Sem códigos de cidades fictícios.
export const REGIONS = [
 ['br','Brasil','brasil'],
 ['ac','Acre','acre'],['al','Alagoas','alagoas'],['ap','Amapá','amapa'],
 ['am','Amazonas','amazonas'],['ba','Bahia','bahia'],['ce','Ceará','ceara'],
 ['df','Distrito Federal','distrito-federal'],['es','Espírito Santo','espirito-santo'],
 ['go','Goiás','goias'],['ma','Maranhão','maranhao'],['mt','Mato Grosso','mato-grosso'],
 ['ms','Mato Grosso do Sul','mato-grosso-do-sul'],['mg','Minas Gerais','minas-gerais'],
 ['pa','Pará','para'],['pb','Paraíba','paraiba'],['pr','Paraná','parana'],
 ['pe','Pernambuco','pernambuco'],['pi','Piauí','piaui'],['rj','Rio de Janeiro','rio-de-janeiro'],
 ['rn','Rio Grande do Norte','rio-grande-do-norte'],['rs','Rio Grande do Sul','rio-grande-do-sul'],
 ['ro','Rondônia','rondonia'],['rr','Roraima','roraima'],['sc','Santa Catarina','santa-catarina'],
 ['sp','São Paulo','sao-paulo'],['se','Sergipe','sergipe'],['to','Tocantins','tocantins']
];
export const regionBySlug = slug => REGIONS.find(([, , s]) => slug === s);
export const regionByUF = uf => REGIONS.find(([code]) => code === uf);
export const slugPath = uf => uf === 'br' ? '/' : `/eleicoes-2026/${regionByUF(uf)?.[2] || 'brasil'}`;
