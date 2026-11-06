# Prompt de desenvolvimento — MINIJOOMLA

Você é a LLM responsável por desenvolver o **MINIJOOMLA**, uma camada de
aplicação JavaScript que reproduz, de forma minimalista e modular, a experiência
do Joomla oficial. O projeto será usado em conjunto com o **SPMIDDLE**, mas deve
permanecer completamente separado dele e do `mse-platform`.

## Objetivo

Construir uma aplicação web JavaScript capaz de oferecer, sem ACL, as interfaces,
layouts, rotas, componentes, módulos, plugins e comportamentos públicos do Joomla
que sejam necessários para uma instalação minimalista. O resultado deve ter a
mesma linguagem de interação e aparência geral do Joomla oficial, respeitando a
identidade visual obrigatória do workspace quando houver conflito com estilos
corporativos.

O objetivo não é criar uma cópia do CAMAP-AGP, do site TD ou do
`mse-platform`. O objetivo é implementar uma camada Joomla-like genérica,
reutilizável e independente de site.

## Fronteiras obrigatórias

### MINIJOOMLA é responsável por

- shell da aplicação, template, navegação e rotas;
- renderização de páginas, artigos, categorias, tags e menus;
- componentes e módulos inspirados exclusivamente no Joomla oficial;
- plugins de conteúdo, busca, autenticação simulada/configurável e eventos;
- formulários, estados vazios, validação, mensagens e paginação;
- configuração de site, template, módulos e parâmetros;
- acessibilidade, responsividade, teclado, foco, zoom e estados de erro;
- adaptação dos dados de domínio para view models e componentes visuais.

### SPMIDDLE é responsável por

- transporte REST e autenticação SharePoint;
- schemas, allowlists, repositories, mappers, ETags e provisioning;
- persistência e leitura das listas `mse*` no SharePoint;
- contratos de dados e limites de segurança do armazenamento.

MINIJOOMLA não deve implementar transporte SharePoint diretamente dentro de
componentes, módulos ou templates. A integração deve ocorrer por interfaces de
serviço/adapters injetáveis, permitindo executar o MINIJOOMLA com dados fake,
fixtures locais ou SPMIDDLE.

## Proibições explícitas

Não reutilize código, layout, nomes, componentes ou módulos específicos de:

- CAMAP-AGP;
- Tecnologias Digitais (TD);
- Fórum;
- Videoteca;
- Explorar Mais;
- Recursos sociais ou módulos internos do `mse-platform`;
- runtimes `mse-preview-*` específicos de host;
- qualquer funcionalidade inventada para um site corporativo específico.

Também não reutilize o `mse-platform` apenas por conveniência. Só é permitido
aproveitar uma ideia ou algoritmo se ele for claramente equivalente a um
comportamento do Joomla oficial, tiver proveniência documentada e não carregar
dependências, nomes ou contratos específicos do projeto de origem.

Não implementar ACL nesta versão. Isso significa não criar permissões por
usuário/grupo, matriz de acesso, regras de autorização editorial ou telas de
gerenciamento ACL. A ausência de ACL não elimina validação de entrada,
sanitização, autenticação configurável, proteção contra XSS/CSRF quando houver
escrita e separação entre conteúdo público e área administrativa.

## Escopo funcional mínimo

Implemente, em ondas pequenas e testáveis, os equivalentes Joomla abaixo:

### Núcleo e apresentação

- bootstrap da aplicação;
- roteador e URLs amigáveis configuráveis;
- template responsivo com header, navegação, conteúdo, posições de módulo e
  footer;
- mensagens de sistema, 404, loading, erro e estado vazio;
- breadcrumbs;
- menu principal, menu secundário e menu de acesso;
- configuração de título, descrição, idioma, fuso e metadados;
- layout de artigo individual, blog de categoria e lista de artigos.

### Conteúdo

- `com_content` minimalista;
- artigos com título, alias, introtext, texto completo, imagem, autor textual,
  categoria, tags, estado editorial, datas e destaque;
- categorias hierárquicas;
- tags e relações artigo-tag;
- publicação, expiração, destaque, ordenação e paginação;
- busca de conteúdo;
- formulário de leitura e, quando o contrato permitir, edição sem ACL;
- sanitização rigorosa de HTML e URLs.

### Módulos oficiais equivalentes

Priorize os módulos Joomla genéricos que possuem uso comprovado no domínio
oficial:

- `mod_menu`;
- `mod_breadcrumbs`;
- `mod_articles_latest`;
- `mod_articles_news`;
- `mod_articles_category`;
- `mod_articles_archive`;
- `mod_tags_popular`;
- `mod_tags_similar`;
- `mod_search`;
- `mod_login` ou equivalente de sessão;
- módulo de HTML personalizado;
- módulo de feed, somente se houver contrato explícito.

Cada módulo deve ter settings-schema, view model, renderização, estados de
erro/loading/vazio, testes e contrato de dados. Não criar módulos com nomes ou
finalidades de CAMAP/TD.

### Plugins e eventos

Crie uma API de eventos inspirada no Joomla para plugins de conteúdo e sistema:

- eventos de preparação e renderização de conteúdo;
- filtros de texto e links;
- busca/indexação;
- inicialização e finalização da aplicação;
- extensão por plugin sem acoplamento ao template.

Plugins devem ser opt-in, declarativos e testáveis. Não permitir execução de
JavaScript arbitrário vindo do conteúdo ou da configuração.

## Arquitetura recomendada

Use JavaScript moderno, módulos ES e dependências mínimas. Separe pelo menos:

```text
MINIJOOMLA/
  README.md
  PROMPT-DESENVOLVIMENTO-MINIJOOMLA.md
  package.json
  src/
    core/              # bootstrap, router, events, config, state
    application/       # casos de uso e view models
    components/        # com_content, com_categories, com_tags, com_search
    modules/           # módulos Joomla oficiais
    plugins/           # plugins e eventos
    templates/         # template Joomla-like e posições
    infrastructure/    # adapters injetáveis, nunca REST embutido na UI
    security/          # sanitização, validação, proteção de conteúdo
  tests/
  docs/
  examples/
```

A estrutura pode evoluir, mas as fronteiras devem permanecer explícitas:

```text
dados → adapters/serviços → casos de uso → view models → componentes → template
```

Componentes visuais não devem conhecer SharePoint, URLs internas, ETags ou
detalhes de transporte. O adapter SPMIDDLE deve ser substituível por um fake
sem alteração nos componentes.

## Design e identidade

Antes de criar layouts, consulte o documento de identidade visual do workspace.
Use branco como base, cores Petrobras autorizadas, contraste WCAG, cantos retos
em superfícies estruturais, sombras mínimas e tipografia com fallback seguro.
Não hospede fontes corporativas sem autorização e não invente marca, ícones ou
cores institucionais.

A interface deve lembrar o Joomla oficial por sua organização e comportamento:
template, posições de módulos, breadcrumbs, menus, cards de conteúdo, filtros,
paginação, mensagens e formulários. Não copie ativos proprietários sem licença
nem reproduza literalmente código de terceiros sem verificar a licença.

## Segurança

- sanitizar HTML, atributos, estilos e URLs;
- rejeitar JavaScript inline e URLs `javascript:`, `data:` e credenciais;
- limitar tamanhos de texto, listas, paginação e uploads;
- escapar conteúdo antes da renderização;
- proteger ações mutáveis contra CSRF quando existirem;
- não guardar tokens, cookies, senhas ou dados pessoais no repositório;
- não usar `innerHTML` com conteúdo não sanitizado;
- manter leitura e escrita separadas e explicitamente declaradas.

## Processo obrigatório

Trabalhe em ondas:

1. inventário do Joomla oficial e matriz de equivalência;
2. arquitetura e contratos locais;
3. shell, template e roteador;
4. conteúdo, categorias, tags e menus;
5. módulos oficiais;
6. plugins e busca;
7. adapters fake e SPMIDDLE;
8. acessibilidade, segurança e responsividade;
9. testes funcionais e visuais;
10. documentação, rollback e pacote de integração.

Antes de implementar cada onda, documente escopo, dependências, lacunas,
critérios de aceite e rollback. Não misture publicação SharePoint com
desenvolvimento local. O primeiro destino de integração, quando autorizado, é
`Preview.aspx`; `Default.aspx` só pode ser tratado em etapa futura, após aceite
integral do preview.

## Testes e critérios de aceite

Cada entrega deve incluir testes unitários e de integração para:

- rotas, parâmetros e estados;
- menus e breadcrumbs;
- artigos, categorias, tags e filtros;
- publicação e janelas de vigência;
- ordenação e paginação;
- módulos oficiais;
- eventos e plugins;
- sanitização e segurança;
- acessibilidade e teclado;
- responsividade em 320, 768, 1366 e 1920 px;
- zoom e alto contraste;
- ausência de reload/navegação indevida em ações internas;
- uso de fake adapter sem rede;
- integração com SPMIDDLE somente através do contrato definido.

O projeto só pode ser considerado pronto para integração quando houver uma
matriz de equivalência Joomla aprovada, cobertura dos fluxos implementados,
rollback demonstrado, working tree limpo e documentação suficiente para outra
LLM continuar o trabalho sem consultar histórico de conversa.

## Entregáveis da primeira fase

A primeira fase deve entregar somente:

1. inventário e matriz de equivalência do Joomla;
2. esqueleto do repositório MINIJOOMLA;
3. shell/template inicial;
4. router e sistema de módulos;
5. contratos fake para conteúdo, categorias, tags e menus;
6. uma página de artigo e uma página de categoria;
7. testes automatizados e README;
8. plano de integração futura com SPMIDDLE.

Não publicar em SharePoint, não alterar `Preview.aspx`, não alterar `Default.aspx`
e não criar dados editoriais permanentes durante a primeira fase.
