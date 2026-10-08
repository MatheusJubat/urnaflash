# UrnaFlash 2026 — v3 Atlas Eleitoral

Portal web responsivo (sem aplicativo) com primeiro turno e acompanhamento do segundo turno das eleições 2026. Resultados oficiais do TSE são consumidos por um backend Node.js sem dependências externas, com cache e consultas controladas.

## Novidades

- **1º turno por padrão**: resultados presidenciais, governador, senador, deputado federal e estadual/distrital após publicação do TSE.
- **2º turno automático, com cautela**: só muda o painel principal quando a fonte nacional do segundo turno retorna votos reais e seções totalizadas. Filtros manualmente selecionados não são sobrepostos.
- **Mapa dos 27 estados**: cores indicam o candidato presidencial com maior votação naquela UF no turno selecionado; não são projeções de vitória e podem mudar. Estados sem dados ficam cinzentos; outro candidato em primeiro aparece em roxo.
- **Mapa geográfico do IBGE**: carregado no servidor sob demanda. Se a malha geográfica não responder, o site exibe mosaico alternativo de UFs (não é desenho fiel do território).
- **Busca por estado + cargo**: navegação acessível a teclado, resultados e lista de candidatos.
- **Municípios**: pesquisa baseada no catálogo EA12 do TSE. Mapa municipal sob demanda carregado do IBGE. Cidades ficam cinzentas até sua votação presidencial ser consultada; **não é um mapa municipal pré-calculado de 5.500 cidades**.
- Tema claro/escuro, contato `contatournaflash@gmail.com`, faixa ampla de patrocínio, páginas indexáveis por UF e layout mobile.
- Não inclui botão de instalação de app / service worker novo.

## Fonte de dados e limites

Catálogo público do TSE: `https://resultados.tse.jus.br/oficial/comum/config/ele-c.json`.
Documentação: `https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados`.

Os cargos possuem eleições diferentes. No 1º turno 2026 o catálogo oficial identifica a eleição 6257 (presidente) e 6259 (cargos estaduais). O código de município eleitoral vem da configuração EA12. O backend não utiliza contagens simuladas em produção.

A disponibilidade da CDN do TSE, os dados municipais e o GeoJSON do IBGE **precisam ser testados no Render**, com internet. Testes locais usam dados fictícios exclusivamente em testes automatizados e não confirmam que todos os arquivos públicos existam ou tenham sido liberados.

Os dados do mapa de estados são buscados em até cinco solicitações simultâneas e armazenados por 30 segundos no servidor. A sincronização do navegador ocorre a cada 60 segundos enquanto a aba estiver visível. Em alto tráfego, considere instância paga e cache compartilhado antes de divulgar amplamente.

**Importante:** o fato de um candidato estar na frente em uma UF **não significa** que a totalização esteja concluída. Para deputados, mais votos não significam automaticamente eleição, pois a distribuição de vagas depende de regras proporcionais e decisões da Justiça Eleitoral. Os dados podem sofrer retotalizações.

## Rodando localmente

Instale Node.js 20 ou mais recente. No diretório que contém `package.json`:

```bash
npm install --ignore-scripts
npm test
npm start
```

Acesse http://localhost:3000. Diagnóstico: `/api/health`, `/api/status`, `/api/auto`, `/api/results?round=1&uf=br&office=presidente`, `/api/results?round=1&uf=pr&office=senador`, `/api/map?round=1`, `/api/municipalities?uf=pr` e `/api/geo/states`.

## Atualizar GitHub + Render (sem novo serviço)

1. Baixe o ZIP, extraia, entre em **UrnaFlash-v3**.
2. Abra o GitHub do repositório que já está conectado ao Render (`urnaflash`).
3. Escolha **Add file > Upload files** e envie o **conteúdo interno** da pasta, não o ZIP e não a pasta de fora. `package.json`, `server.mjs`, `tse.mjs`, `regions.mjs` ficam na raiz; `public/` e `test/` são subpastas.
4. Substitua arquivos existentes. Confirme o commit na `main`, por exemplo `feat: atlas eleitoral v3 e apuracao completa`.
5. Na aba Events do Render, acompanhe Auto Deploy; **não crie outro Web Service**. Build: `npm install --ignore-scripts`, Start: `npm start`.
6. Caso ainda existam da versão antiga, remova do repositório GitHub os arquivos legados `public/sw.js`, `public/manifest.webmanifest`, `public/icon-192.png` e `public/icon-512.png`. São resíduos da PWA desativada.
7. Abra o URL do Render em aba anônima ou faça recarregamento forçado `Ctrl+Shift+R`.
8. Confira os endpoints de diagnóstico listados acima e compare uma votação ao site oficial do TSE.

O projeto não exige base de dados nem chave paga de API. O plano Free do Render pode hibernar e não é indicado para picos eleitorais sem testes de carga.

## Publicidade / privacidade

A seção comercial cria um e-mail local pelo aplicativo de e-mail do visitante: `contatournaflash@gmail.com`. Essa conta precisa existir e ter 2FA. O endereço é montado no JavaScript, o que reduz raspagem simples, mas **não impede spam**. Não temos formulário nem coletamos dados pessoais em servidor próprio.

O UrnaFlash é independente e não tem vínculo com TSE, partidos ou candidatos. Mantenha anúncios visualmente separados dos resultados e não divulgue publicidade que induza os usuários a acreditar que é conteúdo oficial.

## Estrutura

- `server.mjs`: API, SEO, sitemap, segurança básica, proxy de malha IBGE.
- `tse.mjs`: integração EA11/EA12/EA20, parsers, cache, erros e estado da publicação.
- `regions.mjs`: rotas por UF.
- `public/index.html`, `styles.css`, `app.js`: interface web e mapas sem dependências de CDN.
- `test/`: testes para rotas, lógica de turnos, cargos e municípios.
