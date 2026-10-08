# UrnaFlash 5.0 — exploração Brasil → estado → município

Atualização visual a partir da versão 4, sem custos ou dependências novas.

## Novidades
- Clique em um estado no mapa do Brasil para visualizar o mapa dos municípios à direita no desktop.
- No celular o mapa estadual ocupa a tela, com botão **Voltar ao Brasil** e busca por cidade.
- Pesquisa por município dentro do estado, zoom e arrastar o mapa ampliado.
- Ao selecionar cidade, permite visualizar resumo e acessar os resultados oficiais completos.
- Mapa municipal mostra em cinza os municípios ainda não consultados; não inventa votos.
- Modo escuro e áreas comerciais foram mantidos.

## Rodar
`npm start` e acessar `http://localhost:3000` (Node >= 20).

## Testes
`npm test`

## Publicação no Render
Atualize os arquivos existentes no repositório `urnaflash` na branch `main`.
Build Command: `npm install --ignore-scripts`; Start Command: `npm start`; plano Free pode dormir após inatividade.

## Observação sobre os mapas e apuração
Os mapas consultam o serviço do IBGE e o catálogo de municípios do TSE. Se uma fonte estiver indisponível, a busca de cidade no topo continua disponível. O mapa municipal não consulta milhares de municípios automaticamente: cada cidade recebe sua cor após consulta individual, evitando sobrecarga e números não verificados. Valide a CDN oficial em produção antes de divulgação ampla.
