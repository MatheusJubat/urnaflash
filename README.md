# UrnaFlash 8.0 — Apuração nacional, estaduais e fotos oficiais

Portal responsivo e independente. Fonte eleitoral: **Tribunal Superior Eleitoral (TSE)**, com dados públicos EA11/EA12/EA20. O mapa geográfico utiliza malhas do IBGE. **Não tem vínculo institucional com o TSE e não inventa resultados.**

## O que foi corrigido na v8

- **1º turno**: `cand.e = "s"` no EA20 significa **eleito OU classificado para o 2º turno**. Presidente e governador com **dois** candidatos assim marcados recebem a indicação **classificados para o 2º turno**, nunca “dois eleitos”. Se apenas um candidato é indicado no arquivo final, ele aparece como eleito. Senadores e deputados podem ter múltiplos eleitos, conforme a eleição e os registros oficiais.
- **2º turno da presidência**: exibe os candidatos presentes no arquivo do TSE para essa votação (normalmente dois). A legenda do mapa deixa de exibir “Outro candidato” no segundo turno.
- **Brancos e nulos**: novos cartões “Votos válidos”, “Votos em branco”, “Votos nulos”, “Total de votos”. Campos oficiais EA20: `v.vv`, `v.vb`, `v.tvn`, `v.tv`. Os percentuais das candidaturas seguem o arquivo TSE e consideram votos válidos. A proporção de brancos/nulos usa o total de votos.
- **Fotos de candidatos**: o site forma o link a partir do `sqcand` do arquivo oficial e da respectiva eleição/UF: `https://resultados.tse.jus.br/oficial/ele2026/{eleicao}/fotos/{UF}/{sqcand}.jpeg`. Se a foto não estiver disponível, aparecem as iniciais; não substituímos por foto de outra pessoa. As imagens carregam sob demanda. Sem necessidade de pagar serviço de imagens.
- **Governador, senador e deputados a partir de Brasil**: cartão grande para escolher estado, com busca por nome e bandeiras, no próprio painel de resultados. Os resultados desses cargos são estaduais, não nacionais.
- **Filtro de candidato/partido/número**: aparece quando há mais de quatro candidatos (útil especialmente para deputados). Não sobrecarrega a tela de duas candidaturas do 2º turno.
- **Apuração automática**: atualização em primeiro plano a cada 30 segundos, cache no servidor e atualização quando a aba volta a ficar ativa. Os dados exibidos são os publicados na última resposta do TSE, e pode haver atraso de publicação/rede.
- **Dia 25/10**: o padrão do site passa para o 2º turno à 00:00 de Brasília, preservando acesso ao 1º turno. Até **17h** não tenta baixar arquivos da apuração do 2º turno para evitar 404 e bloqueios do TSE. A partir das 17h tenta carregar os arquivos oficiais; se não estiverem disponíveis, mostra “aguardando”, sem números fictícios.
- **Vencedor**: “eleito” apenas na totalização final com indicação oficial apropriada. Uma liderança parcial ou 100% das seções, isoladamente, não comprovam eleição.
- Mapa Brasil → estado → município; tocar novamente no estado ou município ativo volta à visão do Brasil; F5 também volta ao Brasil. Botão de modo escuro mantido.

## Rodar localmente

Requer Node.js 20+.

```bash
npm install --ignore-scripts
npm test
npm start
```

Abra `http://localhost:3000`.

## Publicar no Render (no serviço existente)

1. Extraia o ZIP e envie **o conteúdo da pasta** à raiz do repositório GitHub `urnaflash`, mantendo `server.mjs`, `package.json` e `public/` na raiz.
2. Commit na branch `main`. Se o Render estiver com Auto Deploy habilitado, ele publica automaticamente. **Não crie outro Web Service.**
3. Render: Web Service, Node, Build `npm install --ignore-scripts`, Start `npm start`, Root Directory vazio.
4. Teste a rota `/api/health`. Deve retornar `version: "8.0.0"`.
5. Antes de divulgar, valide `/api/results?round=1&uf=br&office=presidente`, depois `/api/results?round=1&uf=pr&office=governador` e um município de sua escolha.
6. Confira fotos, bandeiras e a consulta ao TSE no próprio domínio publicado (o ambiente de desenvolvimento pode não alcançar a CDN do TSE).

## Cuidados de operação

- **O plano Free do Render hiberna por inatividade** e não garante capacidade para grandes picos de tráfego. Teste carga e monitore antes do dia da eleição.
- A CDN do TSE limita requisições por IP e pode bloquear clientes que gerem muitos 404. O projeto usa cache e consulta em lotes; evite múltiplas réplicas fazendo varreduras independentes sem coordenação.
- Sem um banco persistente, o cache é perdido quando o Render reinicia. Os votos continuam vindo do TSE.
- Fotos pertencem ao acervo oficial do TSE e são exibidas diretamente a partir da URL oficial; imagens ausentes exibem avatares neutros.
- Verifique as políticas eleitorais, de privacidade, acessibilidade e publicitárias antes de comercializar espaços no site. O portal é independente.

## Testes

`npm test` cobre o parser EA20, códigos municipais, conclusão versus 2º turno, seleção de estados, votos válidos/brancos/nulos e o calendário de 25/10. Há testes adicionais com navegador Chromium usando **dados fictícios exclusivamente para teste**, nunca incluídos no conteúdo de produção.

## Contato comercial

`contatournaflash@gmail.com` — confirme que a conta já foi criada antes de divulgar o botão de anúncio.
