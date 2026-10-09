# UrnaFlash 9.1 — resultados claros por cargo e por cidade

Site independente com consulta de resultados do TSE, mapas do IBGE, primeiro/segundo turno e navegação acessível.

## Melhorias desta versão

- **Cargo sem complicação:** abaixo do placar, os cargos aparecem em botões grandes e sempre visíveis. No celular são exibidos em duas colunas, sem depender de gestos ocultos de arrastar.
- **Local preservado:** ao consultar Carambeí, por exemplo, alternar entre Presidente, Governador, Senador e Deputados mantém o município selecionado. Quando o cargo exige uma UF e o Brasil estiver selecionado, aparece uma escolha estadual contextual.
- **Deputado distrital:** aparece **somente com Distrito Federal selecionado**. Em DF, não aparece deputado estadual, pois a eleição legislativa local é de deputado distrital. Em outros estados aparece deputado estadual, não distrital.
- **Turno:** Senado e deputados são votados no primeiro turno. No segundo, a navegação exibe presidente e governador e oferece um botão explícito para consultar cargos do primeiro turno. A data automática de abertura do segundo turno foi preservada.
- **Votos do município:** ao escolher Senador ou Deputados, surge o campo “Quem recebeu votos em [cidade]?”. Digite o nome, partido ou número, toque em **Ver votos** e a lista se abre filtrada, incluindo candidatos fora das primeiras posições. A lista completa também abre automaticamente nas consultas municipais.
- **Sem confusão de resultado:** os textos e cartões municipais deixam claro que são **votos recebidos naquela cidade**, e não a votação total do estado ou uma eleição local para deputado. O destaque “eleito” não é atribuído a municípios.
- **Acessibilidade:** controles grandes, pesquisa por texto, mensagens sobre resultado indisponível, navegação por teclado e respeito à preferência de reduzir animações.

## Publicar uma atualização

1. Extraia o ZIP.
2. Envie **o conteúdo interno** da pasta `UrnaFlash-v9-1` à raiz do repositório `urnaflash` no GitHub, substituindo os arquivos já existentes.
3. Faça commit na branch `main`; o Render usará o mesmo Web Service, sem criar uma segunda hospedagem.
4. Confira o deploy, o endpoint `/api/health` e teste as seguintes combinações: Brasil / Presidente; Carambeí (PR) / Deputado Federal / pesquisar nome; DF / Deputado Distrital; outro estado / Deputado Estadual; segundo turno e retorno aos cargos do primeiro.

Build: `npm install --ignore-scripts`. Start: `npm start`. Testes: `npm test`.

Sugestão de commit: `feat: simplifica filtros e destaca votos dos candidatos por municipio`

## Cuidado com os resultados

As porcentagens e os votos vêm das respostas oficiais do TSE, quando acessíveis. Os testes de navegador usam somente simulações locais; **nenhum voto fictício faz parte dos arquivos publicados**. Não extrapolar “mais votado no município” para “eleito no estado”: a eleição proporcional de deputados depende da totalização estadual e das regras de distribuição de vagas.

A consulta municipal do TSE é feita sob demanda; se uma candidatura não aparecer, verifique disponibilidade e cobertura da consulta oficial antes de concluir que teve zero votos. O identificador eleitoral do município é distinto do código IBGE (ex.: Carambeí/PR é 75221 no TSE).

Ainda é necessário validar o funcionamento dos endpoints com o TSE no ambiente publicado do Render e simular o comportamento de carga perto do dia 25/10. O portal conserva a atualização automática e não declara vencedor a partir de mera liderança nas parciais.

Contato comercial: `contatournaflash@gmail.com`.
