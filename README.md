# UrnaFlash 8.1 — interface simplificada para a apuração de 2026

Projeto independente, responsivo, com Node.js e dados oficiais do TSE quando disponíveis. Versão de **correções de UX** da v8, preparada para o mesmo Web Service do Render.

## O que mudou

- **Fim da lista gigante de nomes no quadro de resultado:** disputas proporcionais mostram uma mensagem curta com quantidade de candidaturas marcadas como eleitas; os nomes permanecem pesquisáveis na lista.
- **Mapa acima da lista longa:** a página apresenta primeiro o resumo, depois o mapa interativo e, em seguida, os cartões com votos de candidatos.
- **Lista de candidatos progressiva:** mostra 8 inicialmente, acrescenta 12 por toque e oferece filtro "Ver somente eleitos" nos cargos proporcionais, quando essa informação está disponível.
- **Trocar estado no lugar certo:** o botão `Trocar estado`/`Escolher estado` abre a busca por estados logo dentro do painel atual, com bandeiras e campos acessíveis. Não envia o usuário ao campo de busca de cidades no topo.
- **Deputado distrital acessível:** ao tocar nesse cargo, seleciona o Distrito Federal e o 1º turno (único turno para esse cargo), com aviso explicativo caso a pessoa estivesse no 2º turno. Deputado estadual não é mostrado quando o recorte é o DF.
- **Navegação móvel:** menu inferior com Apuração, Mapa, Candidatos e Minha cidade; botões e textos ajustados para telas pequenas.
- **Sem dados fictícios de eleição no projeto público.** As prévias de interface são verificadas somente com dados simulados em teste.

## Publicar no GitHub / Render

1. Extraia o ZIP e envie **os arquivos de dentro de `UrnaFlash-v8-1`** para a raiz do repositório `urnaflash` existente. Substitua os arquivos de mesmo nome.
2. Commit na branch `main`: `fix: simplifica lista de eleitos e melhora mapa e filtros`.
3. No Render, mantenha o mesmo **Web Service**, `Node`, `Build Command: npm install --ignore-scripts`, `Start Command: npm start` e o plano já contratado. Com Auto Deploy, a atualização acontece após o commit.
4. Depois do status `Live`, use `Ctrl+Shift+R` no computador ou recarregue a página no celular.

## Testar localmente

Requer Node 20 ou superior.

```bash
npm install --ignore-scripts
npm test
npm start
```

Depois acesse `http://localhost:3000`. A rota `/api/health` identifica a versão 8.1.0.

### Checklist de produção

- Presidente no 1º turno → votos, candidatos e estado da totalização.
- Deputado estadual em SP → resumo curto, busca de candidaturas, opção "Somente eleitos" e expansão progressiva.
- `Trocar estado` dentro do painel → escolha de outra UF sem navegar ao topo.
- Deputado distrital em qualquer UF → vai ao DF, no 1º turno.
- Mapa do Brasil → toque em UF, toque novamente para voltar ao Brasil; consulta do mapa municipal sob demanda.
- No celular → menu inferior sempre acessível, sem rolagem lateral.
- Segundo turno antes de 25/10 → prévia, sem números inventados. A partir de 25/10 inicia selecionado por padrão; arquivos oficiais são consultados conforme janela de divulgação.

O servidor de testes não substitui a verificação das respostas reais do TSE no Render; fonte, autenticação dos números e fotos devem ser conferidas antes de divulgação ampla.

## Transparência

As candidaturas e respectivas marcações eleitorais são normalizadas a partir dos arquivos da Justiça Eleitoral. Para cargos proporcionais, **a votação individual não basta para concluir a eleição**; o status de eleito exige indicação no arquivo oficial. Em caso de indisponibilidade do TSE, o site mostra um aviso e não inventa resultados.

Contato comercial no site: `contatournaflash@gmail.com`.
