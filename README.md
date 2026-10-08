# UrnaFlash 6.3 — Prévia liberada do segundo turno (presidência e governadores)

Site independente de acompanhamento dos resultados das eleições brasileiras de 2026. Funciona em navegador, responsivo para celular e desktop. **Nenhum resultado simulado é enviado ao visitante.**

## Novidade da 6.3: segundo turno aberto para testar agora

- O botão **2º turno** pode ser clicado antes de 25/10/2026, com aviso explícito de **PRÉVIA**, sem votos oficiais nem percentuais inventados. O mapa de estados fica neutro.
- É possível abrir e compartilhar uma prévia com `?turno=2`; por exemplo, `https://SEU-SITE.onrender.com/?turno=2`.
- Antes de 25/10, a API do 2º turno devolve `state: "awaiting"` com explicação, sem consultar arquivos oficiais futuros. O primeiro turno continua normal.
- **Virada automática preservada:** antes de 25/10 a página abre no 1º turno; a partir de 00h de 25/10 (Brasília) abre no 2º, com números apenas quando publicados pelo TSE. A escolha manual de turno é respeitada até a próxima navegação/recarregamento se estiver na URL.
- **Para testar a experiência visual:** entre no botão 2º turno, clique no mapa, busque um estado e município e volte ao 1º turno. A apuração real só pode ser testada com a fonte oficial após a publicação.

## Melhorias da versão 6.2

- Exemplos da busca nacional agora usam capitais de várias regiões, sem priorizar municípios específicos.
- Cinco atalhos tocáveis: Manaus (Norte), Salvador (Nordeste), Goiânia (Centro-Oeste), São Paulo (Sudeste) e Porto Alegre (Sul). Ao tocar, a busca consulta o catálogo oficial do TSE e abre diretamente a capital se o registro exato estiver disponível.
- No mapa estadual, o exemplo do campo de pesquisa é a capital da UF selecionada, como Curitiba no Paraná ou Recife em Pernambuco.
- A busca continua funcionando para **todos os municípios**, sem restrição a capitais.
- Botões acessíveis, com alvos de toque de pelo menos 44px e contraste no tema claro e escuro.

## O que mudou

- Atalho de Governador em cada estado: mostra situação do 1º turno, consulta o segundo quando houver, nunca presume segundo turno em todos os estados; abre resultado com um toque.
- Visual de apuração com três estados: aguardando, parcial e totalização encerrada.
- Indicador nacional de percentual de seções totalizadas, total e seções restantes.
- Estados clicáveis coloridos por candidato à frente, com percentual das seções totalizadas, votos do líder e contagem de seções restantes. A lista lateral traz os detalhes acessíveis, inclusive para estados muito pequenos.
- Resultado municipal com progresso e seções restantes (somente cidade consultada). O mapa municipal não baixa continuamente resultados de todas as cidades.
- Segundo turno disponível como **prévia sem votos** antes de **25/10/2026 no fuso America/Sao_Paulo**. A partir de 00:00 em Brasília ele se torna padrão e pode mostrar “aguardando” até a divulgação oficial. O 1º turno segue acessível.
- Candidato só aparece como **eleito** quando o arquivo de dados oficial marca eleito **e** a abrangência está com totalização encerrada (`and=f`). Quando houver 100% sem confirmação, o texto evita atribuir vitória.
- Atualização automática a cada 60 segundos enquanto a aba está visível; consultas e mapa de estados compartilhados no cache do servidor.
- Nova API `/api/governor-status?uf=pr` (consulta sob demanda) e atalho para visualizar o governador do estado sem percorrer filtros. Quando eleito no 1º turno, o botão abre os votos do 1º, sem sugerir disputa inexistente.
- O mapa nacional continua dedicado aos votos presidenciais para não misturar candidatos.
- Contato comercial: `contatournaflash@gmail.com`.

**Métrica importante:** o percentual exibido na barra de totalização refere-se às **seções eleitorais totalizadas**, não ao percentual exato de eleitores/votos que ainda faltam. A porcentagem exibida ao lado de um candidato é sua proporção de votos válidos divulgados no arquivo do TSE. Essas porcentagens **não devem ser confundidas**.

## Publicar atualização no Render

1. Extraia o ZIP; selecione os arquivos e as pastas extraídos (`package.json`, `server.mjs`, `public/` etc.) e envie-os à **raiz** do mesmo repositório GitHub `urnaflash`. Não crie uma pasta extra dentro da raiz.
2. Substitua os arquivos existentes no GitHub; confirme commit na `main`. Não é preciso criar outro serviço Render.
3. O Render deve publicar automaticamente quando o Auto Deploy está habilitado. Linguagem Node, Build `npm install --ignore-scripts`, Start `npm start`.
4. Teste `/api/governor-status?uf=pr`, `/api/health`, `/api/auto`, `/api/results?round=1&uf=br&office=presidente`, `/api/map?round=1` e resultados municipais usando o código eleitoral devolvido pela busca por cidade.
5. Como a versão 6 exige substituir o JavaScript, force uma atualização com Ctrl+Shift+R no PC ou abra aba anônima no celular.

## Testes

```bash
npm test
npm start
```

Para validar também a virada automática de data, os testes incluem instantes UTC que correspondem a 23:59:59 de 24/10 e 00:00 de 25/10 em Brasília.

## Fonte de dados e cautelas

- Fonte oficial: https://resultados.tse.jus.br/oficial/ e documentação https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados
- O painel consulta dados nacionais, estaduais e municipais sob demanda. Em caso de falha da fonte, indica indisponibilidade e não cria números.
- Datas e eleição são descobertas no catálogo oficial `ele-c.json`. A estrutura do 2º turno só poderá ser definitivamente validada após disponibilização oficial dos respectivos arquivos.
- Não há garantia de tempo real absoluto; há cache e intervalo de polling. O site informa a hora do arquivo oficial quando disponível.
- Mapa municipal: limites IBGE; **só municípios consultados** recebem cor, porque consultar simultaneamente milhares de arquivos violaria boas práticas de consumo de API.
- O mapa não declara vitória a partir de cores ou porcentagens parciais.

## Arquivos

- `server.mjs`: servidor, proxy, mapas geográficos e rotas.
- `tse.mjs`: leitura do catálogo e EA20 do TSE, cache e normalização.
- `schedule.mjs`: calendário de Brasília e verificação de eleito.
- `public/index.html`, `public/app.js`, `public/styles.css`: interface, mapas, interação.
- `test/`: testes automatizados de regras, resultados e rotas.

## Observação de produção

A CDN do TSE não foi acessível a partir deste ambiente de desenvolvimento. Todos os exemplos dos testes de interface são dados **simulados usados apenas para testes locais**. Antes de divulgar, confirme as consultas reais no Render e compare-as com os Resultados oficiais do TSE. O anúncio do dia 25 ocorre apenas **após validação da integração real**.
