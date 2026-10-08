# UrnaFlash 7.0 — resultado primeiro, mapa como exploração

Portal independente para consultar os resultados das eleições de 2026. Layout responsivo, modo claro/escuro, leitura acessível, visualização do Brasil e estados, consulta de cidades, apuração de presidente, governadores, senadores e deputados, com fonte oficial TSE.

## O que foi alterado nesta versão

- Resultados e lista de candidatos aparecem **antes** do mapa para reduzir cliques, principalmente no celular.
- Cartões com nome, partido, número, votos, percentual, foto verificada (se disponível) ou **avatar de iniciais**, nunca foto aleatória.
- Campo de busca por cidade, primeiro/segundo turno, governadores e mapa preservados da versão 6.6.
- Bandeiras das UFs na lista de estados e na indicação da região ativa. Elas usam SVGs do repositório open source [akagabi/bandeira-dos-estados-do-brasil](https://github.com/akagabi/bandeira-dos-estados-do-brasil) (licença MIT). Se o arquivo não carregar, a sigla da UF é exibida.
- **Não contém números fictícios em produção**. A apuração deve ser validada diretamente na origem do TSE antes da divulgação pública.

## Rodando localmente

Requer Node.js 20+.

```sh
npm install --ignore-scripts
npm test
npm start
```

Abra `http://localhost:3000` (ou a porta informada em `PORT`).

## Publicação no GitHub + Render

Atualize os arquivos **da raiz** do repositório `urnaflash` (`server.mjs`, `tse.mjs`, `public/`, `test/`, `tools/` etc.) e faça commit na `main`. O Render já conectado poderá fazer Auto Deploy.

- Serviço: **Web Service**, runtime **Node**.
- Build: `npm install --ignore-scripts`
- Start: `npm start`
- Variáveis obrigatórias: nenhuma. `NODE_ENV=production` é opcional.
- Não precisa de banco de dados ou outro serviço pago para a primeira versão.
- Configure monitoramento e capacidade adequados antes de picos de tráfego: o Render Free pode hibernar e não tem garantia para alto volume.

## Fotos de candidatos (fonte oficial)

As fotos NÃO são associadas pelo nome ou número partidário, para evitar confusão entre homônimos. O JSON oficial EA20 do TSE fornece `sqcand` (sequencial da candidatura). O frontend procura a foto somente se o arquivo tiver sido importado e estiver presente no `public/candidate-photos.json`.

### Como importar fotos do TSE

1. Abra a página oficial: [Candidatos — 2026, Dados Abertos TSE](https://dadosabertos.tse.jus.br/dataset/candidatos-2026).
2. Baixe o arquivo de **Fotos de candidatos** da UF desejada (para a Presidência, escolha **BR**).
3. Na sua máquina, rode `python tools/import_tse_photos.py caminho/para/fotos_2026_BR.zip` (também aceita uma pasta de imagens já extraídas).
4. Confira se o índice `public/candidate-photos.json` foi gerado e se contém os sequenciais esperados. O importador aceita imagens reais JPEG/PNG/WebP com sequência numérica no nome do arquivo; caso o formato do ZIP oficial seja diferente, ajuste manualmente a associação após inspeção.
5. Envie os novos arquivos em `public/candidate-photos/` e o índice gerado para o repositório. **A importação não é automática e o ZIP entregue não contém fotografias dos candidatos.** Até esse passo, serão mostrados avatares neutros com as iniciais.

Para reduzir a carga do projeto, é recomendável começar por presidente e governadores, sem colocar milhares de fotos de candidatos a deputado de uma vez no plano gratuito.

## Fontes e transparência

- Dados da votação: [TSE — Informações técnicas EA20](https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados).
- Fotos oficiais: [TSE — Candidatos 2026](https://dadosabertos.tse.jus.br/dataset/candidatos-2026).
- Bandeiras: [akagabi — MIT](https://github.com/akagabi/bandeira-dos-estados-do-brasil).

`/api/health` indica a versão. `/api/results?round=1&uf=br&office=presidente` permite testar se os votos reais estão chegando. Se o TSE estiver indisponível, o site deve apresentar aviso, nunca números inventados.

## UX

No celular, o usuário começa pela busca e pelos resultados. No desktop, a visão principal continua espaçosa. O mapa Brasil → estado → município permanece disponível para explorar. Ao clicar novamente no estado, volta ao Brasil inteiro; ao recarregar a página, também volta ao Brasil conforme especificado na versão anterior.

**Não afirme que fotos e resultados ao vivo estão validados na internet antes de testar o deploy no Render.** Os testes de navegador desta versão usam dados simulados apenas para checagem de interface.
