# UrnaFlash — versão 2.0

Site de apuração eleitoral de 2026, com **interface responsiva e minimalista**, **modo claro/escuro**, **resultados do TSE por estado**, **espaço de publicidade** e **contato comercial por Gmail**. O site funciona diretamente no navegador, sem aplicativo ou botão de instalação.

## O que mudou

- Interface clara por padrão, com contraste alto, botões maiores, texto legível e modo escuro persistido no dispositivo.
- Primeiro os resultados: escolha 1º/2º turno, escolha o estado, veja votos e seções totalizadas; atualização automática a cada 30 segundos enquanto a aba estiver aberta.
- Sem resultados falsos: mostra aguardando/publicação indisponível quando o TSE não responder. Sem estatísticas fictícias.
- Histórico simples desenhado apenas com as atualizações desta visita, sem alegar histórico oficial completo.
- Faixa de patrocínio **grande e destacada**, identificada como publicidade e separada da apuração.
- Contato comercial por `contatournaflash@gmail.com`, montado no JavaScript somente ao clicar em **Quero anunciar** e com botão **Copiar e-mail comercial**. Não há formulário ou banco de dados para spam/contato.
- PWA e botão de instalação removidos. Um trecho do JavaScript tenta remover o antigo service worker e limpar seu cache nos dispositivos que já visitaram a primeira versão.
- SEO por região, sitemap.xml e cards OG para compartilhamento.

> IMPORTANTE: **a conta contatournaflash@gmail.com deve existir no Gmail**. O site não cria contas nem recebe e-mails sozinho. O botão abre o aplicativo de e-mail configurado pelo visitante.

## Rodando no PC (Node.js 20 ou superior)

```bash
npm install --ignore-scripts
npm test
npm start
```

Acesse http://localhost:3000, veja a saúde da aplicação em http://localhost:3000/api/health e os resultados em http://localhost:3000/api/results?round=2&uf=br.

## Atualização do GitHub existente

Repositório esperado: `urnaflash`.

1. Extraia este ZIP e abra **a pasta UrnaFlash-v2**.
2. **Envie os arquivos de dentro da pasta para a raiz** do repositório GitHub, mantendo `package.json`, `server.mjs` e `public/` na raiz.
3. Para garantir remoção completa dos arquivos antigos (especialmente manifest e service worker), prefira atualizar pelo Git, usando a pasta do repositório existente:

```bash
# Executar DENTRO do clone do repositório
# Copie o conteúdo da pasta UrnaFlash-v2 para cá, substituindo arquivos antigos.
# Remova os arquivos antigos que não existem no ZIP.
git status
git add -A
git commit -m "feat: visual minimalista e contato comercial UrnaFlash v2"
git push origin main
```

Se usar **Upload files no navegador**, ele atualiza os arquivos com o mesmo nome, mas **não apaga arquivos antigos** (`sw.js`, `manifest.webmanifest`, `icon-192.png`, `icon-512.png`). Nesse caso, abra cada arquivo antigo no GitHub, use o menu `...` > Delete file e confirme. O funcionamento básico do novo site não depende dessa remoção, pois a nova página não chama a PWA.

## Render

Se o Web Service já está online e conectado ao GitHub, um push/commit na branch `main` deverá iniciar um novo deploy automaticamente (se Auto Deploy estiver ativado). **Não é necessário criar outro serviço nem pagar um novo plano.**

Configuração:

| Opção | Valor |
|---|---|
| Runtime | Node |
| Root directory | vazio |
| Build command | `npm install --ignore-scripts` |
| Start command | `npm start` |
| Plano | Free para validação, sujeito a hibernação/limites |
| `NODE_ENV` | `production` (opcional) |
| `PUBLIC_SITE_URL` | Só após registrar e apontar domínio, por exemplo `https://urnaflash.com.br` |

O código não precisa de chave de API. O backend centraliza as consultas oficiais e usa cache (configuração 5 min, resultados 30 s). Em caso de falha de consulta e sem leitura anterior, mostramos indisponibilidade. O servidor **não envia e-mails**.

## Publicidade e spam

- Crie primeiro `contatournaflash@gmail.com` e ative verificação em duas etapas.
- No Gmail, ative o filtro anti-spam e crie filtros/etiquetas para assuntos contendo `Interesse em anunciar no UrnaFlash`.
- O endereço não está como texto puro no HTML. **Isso só reduz coleta por robôs simples**, não impede spam; alguém que entrar em contato poderá ver o endereço.
- Não permita publicidade confundida com resultados, nem mensagens que pareçam de um candidato, partido ou TSE.

## Testes

`npm test` executa testes do servidor, das rotas, da página e do tratamento dos arquivos eleitorais. Para fazer um teste da conexão real ao TSE, abra o site publicado e confira primeiro a rota `/api/status` e depois `/api/results?round=1&uf=br`. Esses testes locais não garantem disponibilidade pública dos dados na data da eleição.

## Aviso

O UrnaFlash é independente. Não é serviço oficial do Tribunal Superior Eleitoral. Os dados mostrados são publicados pelo TSE, quando disponíveis, e a identificação da fonte e do estado da atualização deve ser mantida no portal.
