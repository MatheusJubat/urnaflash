# UrnaFlash 9.0 — painel com etapas da apuração

Site independente de apuração eleitoral com dados públicos do TSE. 

## O que mudou

- Página inicial compacta: resultados, 2 candidaturas mais votadas, avanço da totalização e votos brancos/nulos logo à vista.
- Fases detectadas pelos dados publicados: aguardando / parcial / totalização encerrada / eleito quando indicado oficialmente.
- Lista longa de candidaturas agora é um painel **Ver lista completa de candidatos e votos**, fechado inicialmente.
- Mapa interativo preservado, com resumo técnico recolhido para evitar repetição visual.
- Estatísticas estaduais: destaque para maior percentual de votos válidos e maior número absoluto de votos por candidatura, em estados com dados disponíveis. Não são rankings de todos os municípios.
- Ao voltar ao site no mesmo navegador, pode mostrar quanto aumentou o número de seções totalizadas desde a visita anterior; armazenamento local do visitante, sem substituir os dados oficiais.
- Todos os recursos anteriores foram mantidos: cargo, turno, mapas estadual/municipal, busca, bandeiras, fotos com associação oficial, zoom e e-mail comercial.

## Publicação

Extraia e envie os arquivos **de dentro de `UrnaFlash-v9`** para a raiz do mesmo repositório `urnaflash` do GitHub. Substitua os existentes. Render: Web Service existente; build `npm install --ignore-scripts`, start `npm start`. Confirme `/api/health` após o deploy.

Sugestão de commit: `feat: melhora acompanhamento eleitoral com painel dinamico e estatisticas estaduais`

## Verificações

`npm test` e `npm start`; consulte o resultado do primeiro turno nacional, de um estado e de deputados. Valide as estatísticas em cada UF e teste a publicação do segundo turno. Não apresente vencedor sem confirmação oficial, nem use dados simulados no site público.

Os arquivos de mapa por UF são obtidos do IBGE, e os resultados do TSE. Resultados oficiais antes de 25/10 são referentes ao primeiro turno. A partir de 25/10 o segundo turno fica selecionado, aguardando publicação dos dados. 

**Limite técnico dos municípios**: o portal consulta cidades sob demanda. Por isso não exibe ranking nacional das 5.570 cidades. Para construir estatísticas municipais completas, será necessário importar o dataset oficial consolidado em um processo separado, com cobertura verificável.

Contato comercial: contatournaflash@gmail.com.
