# MINIJOOMLA

Camada JavaScript minimalista, modular e independente de transporte que reproduz
organização e comportamentos públicos do Joomla. A primeira fase usa apenas um
adapter fake local; nenhuma chamada SharePoint é feita pelo projeto.

## Executar

```bash
npm test
npm run check
```

Para experimentar no navegador, sirva a pasta com qualquer servidor HTTP
estático e abra `examples/index.html` (por exemplo, `npx serve .`, usando o feed
corporativo quando a instalação de dependências for necessária).

## Arquitetura

`dados → adapter → casos de uso → view models → componentes → template`.

- `src/core`: configuração, eventos, estado e roteamento amigável.
- `src/infrastructure`: contrato fake substituível, sem REST embutido na UI.
- `src/application`: casos de uso e view models.
- `src/components`: páginas de conteúdo e categorias.
- `src/modules`: módulos Joomla genéricos e registry de módulos.
- `src/templates`: shell responsivo e posições de módulo.
- `src/security`: escaping e sanitização de conteúdo/URLs.

Não há ACL nesta fase. Leitura e escrita são separadas no contrato; o fake só
expõe leitura. O plano para uma integração futura está em
[`docs/INTEGRATION-SPMIDDLE.md`](docs/INTEGRATION-SPMIDDLE.md).

## Rotas de exemplo

- `#/` — página inicial
- `#/article/boas-vindas` — artigo individual
- `#/category/noticias` — blog de categoria
- `#/search?q=energia` — busca

Critérios, lacunas e rollback estão documentados em
[`docs/JOOMLA-EQUIVALENCE.md`](docs/JOOMLA-EQUIVALENCE.md).
