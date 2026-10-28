# MINIJOOMLA — inventário e matriz de equivalência Joomla

**Fase:** 1 — fundação local e contratos fake
**Status:** escopo documentado; a implementação deve ser validada contra os
critérios abaixo
**Fonte de escopo:** `PROMPT-DESENVOLVIMENTO-MINIJOOMLA.md`
**Limite:** nenhuma integração real com SharePoint, `Preview.aspx` ou
`Default.aspx` faz parte desta fase.

## 1. Objetivo e princípio de equivalência

O MINIJOOMLA reproduz somente comportamentos públicos e genéricos do Joomla
necessários à instalação minimalista. “Equivalente” significa compatibilidade de
conceito, fluxo e contrato de apresentação; não significa copiar código, ativos,
nomes de sites corporativos ou implementar toda a plataforma Joomla.

A fronteira da fase é:

```text
fake data/fixtures → adapter local → casos de uso → view models
→ componentes/módulos → shell/template
```

Componentes e templates não conhecem SharePoint, REST, listas `mse*`, ETags,
URLs internas, cookies ou detalhes de autenticação. ACL, permissões editoriais e
administração de usuários ficam explicitamente fora do escopo.

## 2. Inventário da primeira fase

| Área | Equivalente Joomla de referência | Entrega/contrato da fase 1 | Evidência mínima de aceite |
| --- | --- | --- | --- |
| Bootstrap | núcleo da aplicação e ciclo de vida | inicialização configurável, registro de serviços, montagem do shell e eventos de início/fim | aplicação inicia com fixture local, sem rede, e finaliza sem erro |
| Shell/template | template, posições de módulo e layout geral | estrutura responsiva com header, navegação, área de conteúdo, posições de módulos, mensagens e footer | renderização consistente em estados normal, loading, vazio, erro e 404 |
| Router | URLs amigáveis e roteamento de componentes | rotas para artigo, categoria e fallback 404; parâmetros validados e navegação interna | rota válida, rota inexistente, alias inválido, query de paginação e back/forward testados |
| Módulos | extensões de apresentação posicionáveis | registro, seleção por posição, ordem, ativação/configuração e ciclo de renderização | módulo fake isolado pode ser incluído/removido sem alterar o template |
| `com_content` | componente de conteúdo | leitura de artigo, lista/blog de categoria, filtros editoriais aplicáveis, ordenação e paginação | view model estável para artigo e categoria com fixture fake |
| Categorias | hierarquia de categorias | contrato de categoria pai/filha, resolução por alias/id e filtragem de artigos | categoria existente, vazia, hierárquica e inexistente cobertas |
| Tags | relações artigo-tag | contrato de tags e associação; suporte mínimo para exibição/filtro | artigo com zero, uma e várias tags; relação ausente não quebra a tela |
| Menus | menu principal, secundário e de acesso | itens declarativos com rota, label, ordem, estado ativo e destino interno | menus e breadcrumbs apontam para rotas válidas e são acessíveis por teclado |
| Contratos fake | camada de dados substituível | serviços/ports locais para conteúdo, categorias, tags e menus; fixtures determinísticas | testes executam sem rede e podem trocar fixture por fake alternativo |
| Testes | cobertura dos fluxos públicos | unitários de router/contratos/view models/módulos e integração local do shell | comando de testes reproduzível; falhas apontam contrato ou fluxo específico |

### 2.1 Contratos funcionais mínimos

O contrato de módulos da fase é declarativo e neutro: cada definição deve
expor `name`, `settings`, opcionalmente `settingsSchema`, `position`, `order`,
`enabled` e `render(context)`. O registry seleciona módulos por posição,
ordena-os de forma determinística e ignora entradas desabilitadas. Loaders
futuros devem entregar estados `idle`, `loading`, `ready`, `empty` ou `error`;
nenhuma configuração pode executar JavaScript arbitrário.

Os contratos devem ser assíncronos mesmo quando o fake for síncrono, para não
criar uma incompatibilidade artificial com um adapter futuro. Os nomes abaixo
são semânticos; a implementação pode escolher outra nomenclatura, desde que
mantenha a mesma responsabilidade e tipagem documentada.

```text
ContentService
  getArticle(ref, options) -> Article | NotFound
  listArticles(query) -> Page<Article>

CategoryService
  getCategory(ref) -> Category | NotFound
  listCategories(query) -> Category[]

TagService
  listTags(query) -> Tag[]
  listArticlesByTag(tagRef, query) -> Page<Article>

MenuService
  getMenu(name) -> Menu
```

Todo resultado deve declarar estado de ausência, paginação quando aplicável e
erros de domínio sem vazar detalhes de transporte. `Article`, `Category`, `Tag`,
`Menu` e `Page` são view/data contracts neutros; não devem conter objetos de
SharePoint nem propriedades de infraestrutura. O contrato deve acomodar, quando
necessário, título, alias, resumo/texto, imagem segura, autor textual,
categoria, tags, estado editorial, datas, destaque, itens de menu e relação
hierárquica.

## 3. Matriz de equivalência detalhada

### 3.1 Núcleo, shell e router

| Capacidade Joomla-like | MINIJOOMLA fase 1 | Estado | Lacuna/limite |
| --- | --- | --- | --- |
| Bootstrap | composição de dependências e inicialização local | incluído | não há provisioning nem configuração remota |
| Template | shell com posições nomeadas (`header`, `navigation`, `content`, `sidebar`, `footer`) | incluído | sem cópia de template proprietário; identidade visual deve seguir as regras do workspace |
| Navegação | links internos e estado ativo | incluído | sem publicação, histórico de URL externo ou ACL |
| URLs amigáveis | aliases e parâmetros de rota | incluído | regras devem ser definidas sem assumir IIS/SharePoint |
| 404 | estado de rota não encontrada | incluído | não substitui página de erro do host |
| Loading/erro/vazio | estados explícitos em shell, componente e módulo | incluído | mensagens não podem revelar detalhes de backend |
| Breadcrumbs | módulo derivado da rota/hierarquia | incluído | precisa de política para item raiz e fallback |
| Configuração de site | título, descrição, idioma, fuso e metadados como configuração local | parcial | sem configuração por tenant e sem armazenamento persistente |

### 3.2 Conteúdo e taxonomia

| Capacidade Joomla-like | MINIJOOMLA fase 1 | Estado | Critério específico |
| --- | --- | --- | --- |
| Artigo individual | `com_content` + rota de artigo | incluído | alias resolve artigo; artigo ausente apresenta estado controlado |
| Blog de categoria | consulta paginada + cards/itens de artigo | incluído | categoria, ordenação e página aparecem no view model |
| Lista de artigos | `listArticles` com filtros seguros | incluído | limite de página e parâmetros inválidos têm fallback previsível |
| Categoria hierárquica | `parentId`/referência equivalente e filhos | incluído | ciclos e referências órfãs são rejeitados pelo contrato fake |
| Tags | relações many-to-many e filtro | incluído | tags desconhecidas não causam erro de renderização |
| Estado editorial | publicado/draft/arquivado e janela de publicação | parcial | primeira fase cobre leitura determinística; autorização de edição não existe |
| Destaque | atributo de artigo para filtro/ordenação | parcial | somente se presente no fixture/contrato; não há painel editorial |
| Busca | não é dependência do shell; contrato pode ser reservado | lacuna | indexação e módulo `mod_search` ficam para onda posterior |
| Sanitização | fronteira de segurança antes da renderização | requisito | HTML/URL/atributos precisam ser sanitizados; nunca usar conteúdo não confiável diretamente |

### 3.3 Módulos

Cada módulo deve declarar `name`, `settingsSchema`, posição, view model,
renderização e estados `loading`, `empty` e `error`. A configuração é
declarativa e validada; não permite JavaScript arbitrário.

| Módulo Joomla de referência | Escopo da fase 1 | Estado |
| --- | --- | --- |
| `mod_menu` | alimentado por `MenuService`, com item ativo e estados vazios | incluído |
| `mod_breadcrumbs` | derivado do router e das categorias/menus | incluído |
| `mod_articles_latest` | contrato e fixture para artigos recentes | incluído se o shell já consumir a lista; caso contrário, lacuna explícita de implementação |
| `mod_articles_news` | view compacta de artigos selecionados | parcial, contrato preparado |
| `mod_articles_category` | lista filtrada por categoria | incluído junto do fluxo de categoria |
| `mod_articles_archive` | agrupamento temporal de arquivados | lacuna da fase 1, salvo fixture/teste específico |
| `mod_tags_popular` | agregação por contagem de tags | lacuna da fase 1 |
| `mod_tags_similar` | relação de similaridade por tags | lacuna da fase 1 |
| `mod_search` | interface e contrato de busca | lacuna da fase 1; implementar na onda de plugins/busca |
| `mod_login` | somente sessão simulada/configurável, se necessária ao shell | opcional; sem autenticação real |
| HTML personalizado | conteúdo sanitizado, sem script | parcial/futuro |
| Feed | somente com contrato explícito | fora da fase 1 |

## 4. Lacunas, dependências e decisões

### Lacunas conhecidas

1. O repositório inicial não contém implementação nem suíte de testes; esta
   documentação não deve ser interpretada como evidência de que os itens
   “incluídos” já estão implementados.
2. Não há definição final de API pública dos serviços, esquema de erro ou
   convenção de `ref` (id, alias ou objeto); isso deve ser fechado antes de
   conectar outro adapter.
3. Busca/indexação, plugins/eventos completos, feed, edição, upload e ACL não
   são entregas da fase 1.
4. A acessibilidade visual precisa ser verificada em viewport 320, 768, 1366 e
   1920 px, zoom e alto contraste; não há aprovação visual implícita nesta
   matriz.
5. O fuso, idioma e serialização de datas devem ser normalizados no contrato,
   sem depender do relógio ou locale da máquina de teste.

### Dependências obrigatórias

- JavaScript moderno com módulos ES e dependências mínimas.
- Runner de testes determinístico e comando documentado no README do projeto.
- Fixtures locais versionadas, pequenas e sem dados pessoais ou corporativos.
- Sanitizador/validador de HTML, URLs, limites de texto, listas e paginação.
- Contratos de serviço injetáveis, com fake sem acesso de rede.
- Tokens e regras de identidade visual de `web-devs/_docs/IDENTIDADE-PETROBRAS.md`:
  branco predominante, cores autorizadas, contraste WCAG e superfícies
  estruturais com cantos retos.

## 5. Critérios de aceite da fase 1

- [ ] A matriz foi revisada e cada item implementado aponta para teste ou
  evidência local; itens não implementados permanecem marcados como lacuna.
- [ ] O shell monta header, navegação, conteúdo, posições de módulo e footer,
  incluindo loading, vazio, erro e 404.
- [ ] Router cobre artigo, categoria, parâmetros, alias inválido e fallback;
  navegação interna não exige reload indevido.
- [ ] Existe ao menos uma página de artigo e uma página de categoria usando
  exclusivamente fake contracts.
- [ ] Artigos, categorias, tags e menus têm fixtures e contratos sem tipos de
  SharePoint; ordenação, paginação e janelas de publicação são testáveis.
- [ ] Módulos são registráveis/configuráveis, possuem view model e não têm
  dependência do template concreto ou de rede.
- [ ] Testes cobrem rotas, estados, menus/breadcrumbs, filtros, paginação,
  sanitização, teclado e execução sem rede.
- [ ] Layout e conteúdo respeitam teclado, foco, zoom, contraste e larguras
  320/768/1366/1920 px.
- [ ] `git diff --check` passa e o working tree contém somente as alterações
  intencionais da entrega.
- [ ] Não houve publicação, alteração em `Preview.aspx`/`Default.aspx` ou
  criação de dados editoriais permanentes.

## 6. Rollback da fase 1

O rollback é local e reversível:

1. identificar o commit da fase no histórico do repositório;
2. parar o uso do pacote/artefato local da fase e preservar logs de testes;
3. voltar o consumidor ao commit anterior conhecido, ou remover somente os
   arquivos da fase por um commit de reversão (`git revert <commit>`);
4. executar novamente a suíte de testes e `git diff --check`;
5. confirmar que nenhum adapter de produção, site SharePoint ou dado editorial
   foi alterado — nesta fase eles não devem existir.

Não usar reset destrutivo nem apagar fixtures compartilhadas sem verificar
referências. Qualquer futura publicação deverá ter rollback próprio, baseado em
versão imutável do pacote, e não pode ser inferida deste rollback local.
