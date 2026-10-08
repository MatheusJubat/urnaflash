# ⚡ UrnaFlash — Eleições 2026

Site independente para acompanhar a **apuração presidencial de 2026** no Brasil, com painel responsivo, páginas estaduais, atualizações por consulta ao TSE e instalação como aplicativo (PWA). O projeto **não é ligado ao TSE nem a partidos políticos**.

> **Status em 08/10/2026:** projeto pronto para subir como MVP e realizar testes de infraestrutura. O segundo turno será em **25/10/2026**. O catálogo oficial do TSE ainda não lista a apuração do segundo turno. No momento, a consulta real a todos os arquivos do TSE **não pôde ser validada neste ambiente** — teste diretamente no Render, em especial `/api/status` e `/api/results?round=1&uf=br`, antes da divulgação.

## O que já existe

- Marca **UrnaFlash** e landing page própria, sem referências à marca anterior.
- Layout responsivo para **computadores, tablets e celulares**; opção de instalar como PWA pelo navegador.
- Brasil + 27 unidades federativas, primeiro e segundo turno, atualização automática do navegador a cada 30 s.
- Backend Node.js 20+ com cache centralizado, ETag/Last-Modified e validação de URLs do TSE.
- Resultados exibidos somente quando a fonte oficial informa números; quando a fonte falha, estado de indisponibilidade. Uma referência **jornalística**, explicitamente rotulada, pode aparecer **somente para o 1º turno Brasil**.
- Dados parciais, seções totalizadas, votos válidos e diferença entre os dois finalistas.
- Histórico das atualizações **somente enquanto a página fica aberta**; não fabrica histórico anterior.
- Link direto por estado: `/eleicoes-2026/parana`, `/eleicoes-2026/sao-paulo`, etc.
- SEO: título/metadescrição por estado no HTML inicial, canonical automático, Open Graph, imagem social, `sitemap.xml`, `robots.txt`, JSON-LD e perguntas frequentes.
- Área para contato comercial (precisa configurar e-mail); isolamento visual da publicidade.
- `render.yaml` configurado para **Web Service Node** no Render, sem dependências npm externas.

## 1. Rodar no seu computador

Requer **Node.js 20 ou superior**.

```bash
npm install
npm start
```

Acesse `http://localhost:3000`. Para rodar os testes:

```bash
npm test
```

No Windows/PowerShell, rode os comandos a partir da pasta que contém `package.json`.

## 2. Colocar no GitHub (usando só o navegador)

1. Faça login em [GitHub](https://github.com/new), crie um repositório chamado `urnaflash` (pode ser público ou privado). Deixe README e `.gitignore` desmarcados, pois já existem no ZIP.
2. **Extraia o ZIP** antes de enviar.
3. Abra seu novo repositório → **Add file → Upload files**.
4. Arraste **todos os arquivos e pastas internos** de `urnaflash/`, incluindo `public/`, `test/`, `server.mjs`, `tse.mjs`, `regions.mjs`, `package.json`, `render.yaml` e este `README.md`.
5. Confira que `package.json` ficou **na raiz**, não dentro de uma segunda pasta `urnaflash/`.
6. Clique em **Commit changes**.

**Atenção:** não envie o ZIP fechado como único arquivo do repositório. O Render precisa de arquivos extraídos.

## 3. Publicar no Render

1. Abra [dashboard.render.com](https://dashboard.render.com) → **+ New → Web Service**.
2. Selecione **Git Provider**, conecte seu GitHub e escolha `urnaflash`.
3. Preencha:

| Campo | Valor |
| --- | --- |
| Name | `urnaflash` (se disponível) |
| Language / Runtime | Node |
| Branch | `main` |
| Root Directory | **vazio** |
| Build Command | `npm install --ignore-scripts` |
| Start Command | `npm start` |
| Instance Type | `Free` para testes |
| Health Check Path (Advanced) | `/api/health` |

4. Adicione a variável de ambiente **`NODE_ENV=production`** (opcional; útil para definir protocolo padrão).
5. Clique em **Create Web Service** e espere o status **Live**. O Render fornece um endereço como `https://urnaflash-xxxx.onrender.com`.
6. Teste os endereços do próximo tópico.

**Não use** Static Site: o UrnaFlash possui backend de API em `server.mjs`.

O plano Free **hiberna após 15 minutos** sem tráfego e pode demorar a despertar. Considere uma instância paga para o dia da apuração — tráfego pesado e estabilidade não são garantidos no plano gratuito.

## 4. Verificar publicação

Abra no navegador (troque pelo seu URL real):

- `/` → tela principal;
- `/eleicoes-2026/parana` → conteúdo com título/descrição específica do Paraná;
- `/api/health` → `{"ok":true,"service":"urnaflash",...}`;
- `/api/status` → catálogo oficial dos turnos (pode responder indisponível se houver bloqueio de rede);
- `/api/results?round=1&uf=br` → primeiro turno, se o JSON puder ser acessado;
- `/api/results?round=2&uf=br` → segundo turno; **não deve exibir números antes de serem publicados**;
- `/sitemap.xml` e `/robots.txt` → páginas regionais;
- `/manifest.webmanifest` → dados de instalação no celular.

Na aplicação, confira filtros por estado, troca de turnos, compartilhamento e leitura no smartphone.

## 5. Apontar `urnaflash.com.br` (apenas DEPOIS de registrar)

O Registro.br indicou o domínio como **disponível para registro** na consulta enviada pelo proprietário. **Disponível não significa comprado ou ativado.** Após efetuar o registro:

1. No Render, abra **Settings → Custom Domains → Add Custom Domain**.
2. Adicione `urnaflash.com.br` e, se desejar, `www.urnaflash.com.br`.
3. Copie **exatamente** os registros DNS mostrados pelo Render para a área **DNS** do Registro.br (ou seu provedor DNS). Os valores podem mudar; **não chute IP nem CNAME**.
4. Aguarde validação e certificado HTTPS do Render.
5. No Render → **Environment**, crie `PUBLIC_SITE_URL` com o valor `https://urnaflash.com.br` (sem barra no final) e efetue deploy novamente.
6. Acesse o domínio e confira o link canonical e o sitemap. Evite publicar outra cópia com mesmo conteúdo em domínios diferentes sem redirecionamento.

**Não configure `PUBLIC_SITE_URL` antes de possuir o domínio**, a menos que queira que todos os metadados apontem para esse endereço.

## 6. SEO e divulgação

1. Com o domínio registrado e online, configure e confirme a propriedade no [Google Search Console](https://search.google.com/search-console).
2. Envie o sitemap `https://urnaflash.com.br/sitemap.xml`.
3. Confira se a página foi indexada, usando a ferramenta de inspeção de URL do Search Console. **Não há garantia de primeira posição** nas buscas por `eleições 2026`.
4. Compartilhe links estaduais. Exemplo: `https://urnaflash.com.br/eleicoes-2026/parana`.
5. Adicione conteúdo editorial e recursos com valor próprio quando o produto amadurecer; SEO não se resume a palavras-chave.

## 7. Habilitar contato comercial

Em `public/app.js`, encontre:

```js
const AD_CONTACT_EMAIL = '';
```

Insira um endereço **já criado e ativo** para que o botão **Quero anunciar** abra o e-mail. Não utilize `comercial@urnaflash.com.br` antes de configurar a caixa postal.

O espaço publicitário não promove candidatos e não interfere nos resultados eleitorais. Verifique regras de anúncios do seu provedor e requisitos legais de publicidade aplicáveis.

## 8. Fontes oficiais e limites

- [Documentação técnica do TSE](https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados)
- [Configuração de eleições EA11](https://resultados.tse.jus.br/oficial/comum/config/ele-c.json)
- [Referência Agência Brasil, 04/10/2026, **exclusivamente primeiro turno**](https://agenciabrasil.ebc.com.br/politica/noticia/2026-10/quando-sera-o-segundo-turno-das-eleicoes-veja-data)

O backend só busca o segundo turno quando o TSE publicar uma eleição presidencial do turno 2 no EA11. Faz cache de resultados por 30 segundos e de configuração por 5 minutos, com validações e proteção contra URLs injetadas. O portal **não prevê vencedores**.

**Limitações deste MVP:** sem banco de dados, sem histórico persistente entre visitantes, sem observabilidade de produção, sem filtro municipal nem serviços de anúncios integrados. Para alta audiência, faça testes de carga, monitore a rede e melhore a infraestrutura. Os candidatos comparados no primeiro turno são apenas os dois finalistas, não todos os candidatos do pleito.

## Estrutura

```text
urnaflash/
├── public/
│   ├── index.html, styles.css, app.js
│   ├── icon.svg, icon-192.png, icon-512.png, share.png
│   └── manifest.webmanifest, sw.js
├── test/
│   ├── tse.test.mjs
│   └── server.test.mjs
├── regions.mjs
├── tse.mjs
├── server.mjs
├── package.json
├── render.yaml
└── README.md
```
