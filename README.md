# UrnaFlash 6.6 — mapa simples, resultado no primeiro clique

Portal responsivo de acompanhamento das eleições de 2026, com dados públicos do TSE e mapas geográficos do IBGE. Este projeto é independente e **não** representa a Justiça Eleitoral.

## Novidades de navegação

- **Brasil é a visão inicial**. O resumo acima do mapa mostra a apuração da presidência no país.
- **Toque em um estado** (no mapa ou na lista): o resumo muda imediatamente para o estado selecionado, com candidato à frente, votos recebidos, progresso da totalização de seções e seções restantes. A seleção também abre o mapa municipal do estado.
- **Toque novamente no estado escolhido**: limpa estado e cidade e retorna ao Brasil. É possível também usar o botão **Voltar ao Brasil**.
- **Toque em outro estado**: substitui o resumo e o mapa municipal pelos do estado novo.
- **Siglas das UFs no mapa nacional**, por exemplo PR, SP e RJ. Se a malha geográfica do IBGE não estiver disponível, a alternativa em mosaico mantém as mesmas siglas. Estados pequenos também estão disponíveis na lista acessível.
- **Mapa dos municípios mais limpo**: a cidade escolhida recebe contorno azul; as demais ficam neutras. **Não há mais** botão de alternar cores, legenda de seleção ou exibição de múltiplas cidades coloridas.
- **No celular**, o explorador estadual ocupa a tela e começa com o resumo presidencial do estado, seguido do mapa e da busca de cidade. Botão grande de voltar sempre visível.
- **F5/atualização** limpa o recorte geográfico e volta ao Brasil, mantendo a regra de turno; links compartilhados diretos continuam sendo interpretados na abertura inicial.

## Informações eleitorais

- O mapa nacional e o resumo contextual mostram **presidência**. Governador, senador, deputado federal e deputado estadual/distrital ficam no painel de resultados.
- Primeiro turno de 04/10/2026 disponível; segundo turno liberado em modo **prévia** antes de 25/10, sem votos fabricados. Em 25/10, o segundo turno torna-se a visualização inicial, pelo relógio de Brasília.
- Apuração parcial não significa resultado definitivo. Um candidato só recebe o título de eleito quando o arquivo oficial o identifica e os dados indicam totalização encerrada.
- Percentuais de **seções totalizadas** não representam percentuais de **votos apurados**. As porcentagens dos candidatos referem-se aos votos válidos contabilizados na fonte.
- Cidades são carregadas sob demanda para não sobrecarregar a API do TSE ou o Render.
- Atualização automática a cada minuto enquanto a página está visível. Cache no servidor reduz consultas repetidas ao TSE.
- Contato de publicidade por e-mail `contatournaflash@gmail.com`, via ação de abrir cliente de e-mail.

## Rodar no computador

Requer **Node.js 20+**. Na raiz do projeto:

```bash
npm install --ignore-scripts
npm test
npm start
```

Abra `http://localhost:3000`.

## Atualizar a publicação no GitHub e Render

1. Extraia o ZIP. **Envie o conteúdo**, não a pasta ZIP ou outra subpasta, para a raiz do repositório `urnaflash` já conectado ao Render.
2. Substitua `public/app.js`, `public/index.html`, `public/styles.css` e os arquivos de servidor/testes quando o GitHub solicitar; confirme o commit na branch `main`.
3. No Render, mantenha o mesmo **Web Service**. Build Command: `npm install --ignore-scripts`. Start Command: `npm start`. O Auto Deploy deve iniciar a nova publicação.
4. Confirme `/api/health` (`version: "6.6.0"`) e teste a homepage, o mapa, a troca de estado e a busca por município.
5. Se o navegador ainda mostrar a interface anterior, use `Ctrl+Shift+R` ou abra em aba anônima.

## Verificação e limitações

Os testes do Node.js verificam rotas, interface estática, resumo contextual, lógica de navegação, mapa municipal, turnos e interpretação dos arquivos do TSE. Rodar `npm test` **não verifica** que o TSE está alcançável pelo Render naquele instante. A fonte oficial e a malha do IBGE devem ser testadas no site publicado antes da divulgação pública.

Rotas úteis de teste:

- `/api/health`
- `/api/map?round=1`
- `/api/results?round=1&uf=br&office=presidente`
- `/api/results?round=1&uf=pr&office=presidente`
- `/api/governor-status?uf=pr`

Em qualquer erro de fonte, a UI sinaliza indisponibilidade em vez de inventar resultados.
