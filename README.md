# MINIJOOMLA

> **Vigente — 0.15.0:** Topsections corrigido/adotado pelo ciclo desenvolvimento
> → site → análise → validação → documentação. 48 itens totais, os 46 anteriores/
> ETags intactos; ambas páginas publicadas, 243 assets e 87 suítes aprovadas.
> [Ciclo e limites](docs/CICLO-TOPSECTIONS.md). Sete módulos pendentes; próximo
> gate é a capacidade das oito raízes atuais, sem instalação em lote ou limpeza.

> **Vigente — 0.14.0:** Highlights corrigido/adotado após ciclos de desenvolvimento,
> teste no site, análise, validação e documentação. 46 itens totais, os 44
> anteriores/ETags intactos, ambas páginas publicadas; 243 assets/86 suítes
> aprovadas. [Ciclo e limites](docs/CICLO-HIGHLIGHTS.md). Restam oito módulos,
> XML plugins/templates e migração assistida; distribuição pública não pronta.

> **Vigente — 0.13.0:** primeiro editorial externo corrigido e adotado
> individualmente; confirmação inicial pelo painel, revisões/rollback e
> preservação dos 42 registros anteriores comprovados. 44 itens totais,
> ambas páginas publicadas, 243 assets e 85 suítes aprovadas.
> [Resultado e limites](docs/ETAPA-2C-EDITORIAL-ADOTADO.md). Nove módulos ainda
> pendentes; principal preservada sem merge e distribuição pública não pronta.

> **Vigente — 0.11.0:** ambas páginas publicadas; confirmação modal real,
> atualização/reversão e conflito do piloto aceitos pelo painel. 243 assets,
> 84 suítes aprovadas, 40 registros originais/ETags preservados e 42 itens totais.
> Dez módulos preparados, ainda não instalados; defeitos/contratos e proveniência
> precisam ser resolvidos antes de exposição. [Resultado e limites](docs/ETAPA-2B-CONFIRMACAO-E-ACEITE-XML.md).
> Principal preservada sem merge; distribuição pública ainda não pronta.

> **Etapa 2 — runtime 0.10.0:** piloto XML com ciclo real de serviço e criação/
> edição de instância pelo painel; 242 assets e 40 registros originais/ETags
> preservados, dois recursos novos de demonstração. Dez módulos preparados
> offline, não instalados. [Evidências e bloqueios](docs/ETAPA-2-PILOTO-XML.md):
> confirmação nativa/ciclo completo pela UI pendentes; pública com rascunho
> concorrente após ativação, não republicado automaticamente. Admin publicado.
> Principal preservada sem merge; distribuição pública ainda não pronta.

> **Etapa 1 publicada — 0.9.0:** correções de plugins/consultas e
> instalação de dados de exemplo em `administrator/modules/mod_sampledata/`,
> com pacote `plugins/sampledata/blog/`. [Contrato e validação](docs/ETAPA-1-SAMPLE-DATA.md).
> 241 assets conferidos, 79 suítes aprovadas e 40 registros/ETags preservados.
> Tela instalada reconhecida após reload; não houve reinstalação da amostra.
> A instalação aceita 0.8.0 permanece para rollback. Estado antigo abaixo é histórico.

> **Estado posterior à confirmação de funcionamento:** commit `57ef821`
> enviado; Joomla Blog Sample Data populado na release 0.8.0: **40 registros
> em oito listas e 12 imagens originais**, com releitura independente.
> [Resultado, adaptações e limites](docs/JOOMLA-SAMPLE-DATA-2026-11-06.md).
> A carga foi feita pelo serviço administrativo, não por um instalador de dados
> de exemplo no painel (ainda pendente). A instalação vazia abaixo é histórica.

> **Publicação vigente após reset autorizado:** **0.8.0**, snapshot da importação
> `0bd5de1`, oito listas canônicas novas **vazias**, sem dados/patches da 0.7.0.
> 79 itens reciclados, 16 listas antigas e as duas pastas solicitadas excluídas
> antes da recriação. [Resultado e limites](docs/REPUBLICACAO-LIMPA-2026-11-06.md).
> O trabalho local da rodada anterior permanece separado; não representa o
> runtime agora publicado nem réplica comprovada da configuração pessoal.

Projeto JavaScript minimalista, modular e independente de transporte, inspirado
na organização e nos comportamentos do Joomla, com painel administrativo próprio
(`src/administrator/components/com_minijoomla/`). O objetivo é uma distribuição open source independente, aberta
à contribuição de outros desenvolvedores, e não uma aplicação corporativa.
Não é uma distribuição oficial do Joomla nem implementa sua equivalência integral.

> **Escopo confirmado:** apresentação Joomla/Atum, sem identidade Petrobras
> obrigatória. Integrações e temas corporativos são opcionais, não requisitos
> da distribuição independente. A preparação open source **não está concluída**;
> veja os [bloqueios atuais](docs/OPEN-SOURCE-READINESS.md) e a
> [estado autoritativo do plano](docs/PLANO-CONTINUIDADE-MINIJOOMLA.md#escopo-vigente--06112026).

**Continuidade — 06/11/2026:** [avaliação completa e escopo aprovado](docs/AVALIACAO-E-ESCOPO-2026-11-06.md).
Inclui adoção dos outros dez módulos externos, XML de plugins/templates e
migração assistida; [contratos e gates](docs/CONTRATOS-EVOLUCAO-XML.md).
i18n, SEO integrado ao host, histórico e check-in/check-out de artigos estão
fora do escopo atual. Git próprio `rinaldops/minijoomla`; números e worktrees
do agregador abaixo são históricos, não o estado do índice atual.

**Delta local desta rodada:** opções de consulta/limites/matching e metadados
públicos corrigidos, auditor core alinhado ao parser, sintaxe incluindo scripts
JS/MJS, plugins administrativos conectados com snapshot por gravação e prévia
pura de migração com ETags/snapshots. Novos perfis XML de
plugins/templates ainda são evolução planejada; prévia de migração não executa
escritas. [Execução e próximos gates](docs/PLANO-CONTINUIDADE-MINIJOOMLA.md#execução-desta-rodada--estado-local).

**Republicação posterior autorizada:** 0.7.0 integral nas duas páginas
corporativas MINIJOOMLA, com sete listas canônicas novas e template existente
preservado. 222 arquivos verificados; 77 suítes passaram/zero skips/falhas.
Seed Joomla Blog suportado relido, sem assets de mídia ainda aprovados.
Retirada das oito listas de teste antigas bloqueada por HTTP 500 na reciclagem;
nenhuma exclusão permanente. [Registro e limites](docs/PLANO-CONTINUIDADE-MINIJOOMLA.md#fechamento-da-rodada-e-republicação-corporativa).

**Estado em 05/11/2026 (producao pessoal):**

- **Destino de producao pessoal:** `https://rinaldops.sharepoint.com/sites/camap-agp`, com
  `SitePages/MiniJoomla.aspx` (público) e `SitePages/Administrator.aspx`
  (administração). Release ativa **0.6.0**, em `SiteAssets/minijoomla/releases/`.
  A [publicacao para aceite XML](docs/PUBLICACAO-JOOMLA-XML-0.6.0.md) registra
  os 202 arquivos verificados e o piloto corpmessage 0.1.1 pronto para Registrar.
  Desde o commit `9feebf9`, a árvore de fontes e a release seguem a estrutura
  oficial do Joomla (`administrator/`, `components/`, `libraries/`, `media/`,
  `modules/`, `plugins/`, `templates/` na raiz da release); não há mais prefixo
  `app/`. A 0.4.5, citada abaixo, foi a última versão com a estrutura antiga.
- **Instalação limpa**, não os antigos deltas corporativos seletivos
  (0.2.x). Esses registros abaixo permanecem como histórico.
- **Local após a integração das frentes:** 72 suítes, 0 skips, 0 falhas; sintaxe em 244 arquivos JS.
  Selecao contributor: 304 arquivos totais, validada isoladamente (63 suítes,
  nove skips esperados sem SPMIDDLE, nenhuma falha).
- **Incremento publicado na 0.5.1:** seis layouts compartilhados em
  `src/layouts/joomla/`; editor de artigo em
  `src/administrator/components/com_content/tmpl/article/edit.js`, preservando o
  entrypoint antigo como reexport. A separação administrativa completa continua
  pendente.
- **Tambem publicado na 0.6.0:** modelo editorial e tabela de artigos
  em `com_content`, tabela de arquivos em `com_media` e modelo dos itens de menu
  em `com_menus`. O antigo `com_minijoomla/menu-types.js` reexporta a mesma API.
  Rotas, schemas e HTML preservados; o roteamento/binding compartilhado ainda
  reside em `com_minijoomla`. Não é separação administrativa integral.
- **Configuração e descoberta locais:** view da configuração em `com_config`;
  consulta, renderização e cadastro da descoberta em `com_installer` e
  `com_templates`. Cadastros usam snapshots da descoberta, não metadados do DOM,
  e ignoram callbacks de telas abandonadas. Extensões continuam desabilitadas
  ao registrar; templates continuam habilitados mediante confirmação, sem
  selecionar um padrão nem instalar código. Ainda não publicado.
- **Mídia local:** serviço de imagens verifica bytes reais (inclusive de outro
  realm), intervalo da vista e limite de 10 MiB antes do transporte. MIME é
  validado por chave própria da allowlist; confirmação do upload exige URL
  server-relative válida. Não há decodificação/certificação do formato nem retry
  automático se a resposta for inválida após enviar o arquivo.
- **Verificação editorial local:** novos avisos de título vazio e ID duplicado,
  mais indicação de links genéricos. Considera entidades, espaços e alternativas
  textuais de imagens; ignora comentários e blocos completos de script/style.
  Não executa HTML, não altera o artigo nem bloqueia o salvamento. É heurística,
  não validação WCAG/assistiva completa.
- **Coordenação:** as frentes administrativas/XML foram integradas em `main`.
  Há alterações paralelas de CAMAP2 na worktree principal: preservar e não
  incluir nos commits desta frente. Mudanças profundas nos contratos XML,
  manifestos, runtime de extensões ou transporte exigem coordenação prévia.
- **Módulos, plugins e estilos locais:** listagens e a pré-visualização de
  posições movidas para `com_modules`, `com_plugins` e `com_templates` como
  views puras. Formulários de módulo, plugin e estilo, catálogo de tipos,
  opções de componentes e gerenciador de extensões agora usam suas views em
  `com_modules`, `com_plugins`, `com_templates`, `com_config` e `com_installer`.
  Filtros, ações, ETag e persistência continuam no coordenador
  `extension-pages.js`. HTML idêntico em 19 cenários de listas/formulários;
  não é ainda separação integral de controllers nem aceite visual/assistivo.
- **Submissão única:** enquanto a gravação estiver pendente, novos submits do
  mesmo formulário de módulo/plugin/estilo/opções/instalação ou lote de módulos
  são ignorados. Após concluir ou falhar, é possível enviar novamente; o ETag
  capturado não é atualizado silenciosamente. Não é trava entre sessões.
- **Navegação administrativa:** ações de telas abandonadas ou após encerrar o
  app não iniciam gravações; conclusões tardias não redirecionam nem reportam
  erro em outra tela. Upload revalida após a leitura do arquivo. Uma gravação
  já iniciada pode concluir, sem cancelamento ou rollback automático.
- **Worktree ativa:** desenvolvimento em `web-devs`, branch `main`. Worktrees
  01/02 removidas após conferência; branches preservadas e resíduos da 02
  guardados em `tmp/worktree-retirement/` ignorado pelo Git.
- **Categorias e tags locais:** listagens movidas para `com_categories` e
  `com_tags` como views puras; filtros, ações em lote e ETag seguem no
  coordenador de conteúdo. HTML idêntico à versão anterior em 8 cenários.
- **Save hooks opt-in:** `createAdminService(repositories, { pluginManager })`
  e `createMiniJoomlaAdminApp({ pluginManager, ... })` conectam beforeSave e
  afterSave ao CRUD de artigos, incluindo duplicação/lote. beforeSave pode
  transformar/vetar; afterSave não mascara uma gravação concluída. O host atual
  não injeta esse manager nem carrega plugins administrativos persistidos.
- **Manifestos de módulos:** o estágio gera os 15 XML nativos usando o catálogo
  do painel, com versão, defaults, limites e opções. Os XML em `src/modules/`
  continuam como descritores locais de compatibilidade; a release usa os gerados.
  O contrato de terceiros `extensions/<key>.manifest.json` não mudou. Manifestos
  de plugins/templates ainda não usam essa geração.
- **Perfil XML de terceiros:** `modules/mod_nome/mod_nome.xml` e entrypoint
  JavaScript, instalacao desabilitada, upgrade/rollback com ETag e CSS por
  revisao. JSON legado preservado; novos perfis de plugins/templates fora do
  escopo. Ver [contrato](docs/EXTENSOES-JOOMLA.md).
- **0.5.0:** release publicada por `rinaldops`, duas páginas, 180 arquivos com
  hashes duplamente verificados. A checagem no host foi de carregamento; não
  houve E2E de escrita nessa publicação.
- **0.5.1:** fonte `32435a8`, 187 arquivos publicados sem mudar esquema de listas,
  upload e releitura independente com zero divergências SHA-256; MIME JS/CSS
  conferido. Público, painel e TinyMCE do novo editor carregaram após reload,
  com um único contêiner por página e sem falhas de recursos no smoke final.
  Um 503 inicial no público desapareceu ao recarregar. Não houve novo teste de
  escrita editorial, aceite nativo de layout ou aceite assistivo.
  Rollback do canvas anterior em `tmp/deploy/0.5.1/rollback-*.html`; 0.5.0 intacta.
- **Plugins nativos** (`emailcloak`, `pagebreak`, `loadmodule`, `pagenavigation`)
  são habilitados na página Plugins da administração, nas linhas `native:<key>`.

Publicação com `scripts/deploy-sharepoint.mjs`, executada no Git Bash:

```sh
MSYS_NO_PATHCONV=1 node scripts/deploy-sharepoint.mjs --version X.Y.Z --web /sites/camap-agp --session <id> [--rpc 47173] [--skip-provision]
```

`--session` é o id de uma sessão aberta com a instância própria do FioriAgent do
usuário; não grave o id em arquivos versionados. Fluxo e rollback em
[RELEASE-MSE-0.1.0.md](docs/RELEASE-MSE-0.1.0.md).

**Estado reconciliado em 04/11/2026, informado pelo coordenador:**

| Frente | Estado | Limite |
| --- | --- | --- |
| Site público no host | **0.2.11 publicada**, fonte `23f4696`; Cassiopeia com CSS neutro carregado/computado após reload | Somente `src` público 0.2.8 → 0.2.11; seis módulos do grafo real substituídos, não atualização integral do runtime nem release OSS |
| Administração no host | **0.2.12 publicada**, pacote fonte `eb423f7`, conversão `7bc5b6e` sobre grafo real 0.2.10; reload/rotas/editor/teclado conversão em sete larguras | Cinco novos/134 dependências/139 assets; público 0.2.11/editor/CSS/dados preservados; incidente de coordenação em contrato 6.8, sem aceite integral |
| Imagens salvas | **Aceite informado pelo usuário**: “ok você está certo acabei testar” | Distinto da fixture sintética e da observação do agente de um artigo real sem imagens; sem nova revalidação nesta reconciliação |
| Fonte/revisão | `23f4696` enviado à main, incluindo `bc64256`, `343bb58` e restauração JSON; revisão independente aprovada | Normalizador histórico, oito tipos nativos/três defaults avançados e corpo da função de renderização conferidos; direitos/privacidade não certificados |
| Regressão | **44 suítes passaram, zero skips/falhas / sintaxe de 137 JS**, contributor integrado | Seleção isolada 36 passes/oito skips esperados/zero falhas; zoom/mídias/leitor e escrita editorial observada pendentes |
| Core selecionado | **0.3.1: 50 arquivos / 496.268 bytes / zero candidatos**, todos os hashes declarados verificados | Gate manifest-only; core anterior 0.3.0 (49/490.634/zero) histórico, não privacidade/direitos/aprovação de distribuição |
| Cassiopeia neutro | Efetivo no público **0.2.11**; nove arquivos novos/248 dependências históricas/257 assets verificados | Antes da publicação, 0.2.8 já montava Cassiopeia com CSS corporativo anterior; origem da mudança externa de configuração desconhecida. Sem escrita de configuração por esta operação |
| Seleção contributor | [Allowlist local](docs/CONTRIBUTOR-SELECTION.md): 171 arquivos, demos/testes/scripts/TinyMCE e manifesto completo | Candidatos encontrados pelo auditor sem isenção de fixtures/regras; referências/privacidade/direitos/fonte-build ainda bloqueantes, não distribuição pública |

**Incidente administrativo:** 0.2.9 foi brevemente ativada, mas a rota efetiva
`#/moduleInstances` falhou por falta do contrato `json` exigido pelo catálogo
publicado da base 0.2.5. Somente o `src` administrativo foi restaurado para
0.2.7, com canvas/ETag recém-lidos, MERGE específico, Publish e reload verificado.
Público 0.2.8 e seu canvas/ETag foram preservados, sem edição de dados. Causa,
limites e correção posterior estão no
[contrato do incidente](docs/CONTRACTS-MINIJOOMLA.md#65-contadores-administrativos-e-parâmetros-declarativos-próprios).

**Fechamento posterior:** 0.2.10 publicou **15 arquivos novos** (14 JS e manifesto),
com **119 dependências / 134 assets totais** verificados por bytes/SHA-256/MIME.
CSS administrativo 0.2.5 mantém o mesmo hash; editor efetivo 0.2.5, agendamentos
0.2.6 e descoberta 0.2.7 foram preservados. Prévia usou catálogo real (11 registros
de módulos e oito tipos nativos, com sobreposições); reload validou rotas, TinyMCE
real/três abas/cleanup e agendamentos sintéticos, preservando ETags de artigos/
páginas e público 0.2.8. Não é release OSS nem aprovação visual integral.

**Publicação pública posterior:** 0.2.11 criou **nove arquivos** (sete JS, CSS e
manifesto), verificando **248 dependências históricas / 257 assets totais** por
bytes/SHA-256/MIME, inclusive CSS. Sanitizador 0.2.8 com hash preservado, quatro
CSS CAMAP opcionais e recursos absolutos 0.2.1/`import.meta` ficaram iguais;
configuração salva mantém precedência sobre o fallback `camap` → `cassiopeia`.
Prévia passou 15 posições/aliases legados, imagem sintética float/180px/margem
20px, contraprovas de segurança/lifecycle/DOM/hash e Enter/Escape nativos do menu.
Reload confirmou montagem única, CSS/cabeçalho computados, navegação e artigo
real sem alerta. Administração 0.2.10/canvas/ETag preservados; ETags das duas
páginas ficaram iguais durante as verificações, sem gravação editorial/configuração,
criação de módulo ou upload. Rollback preparado restaura somente `src` público
para 0.2.8 com canvas/ETag atuais e MERGE específico, preservando admin/outros
webparts; runtime anterior retoma seu CSS, sem sobrescrever assets. Veja o
[contrato público 6.6](docs/CONTRACTS-MINIJOOMLA.md#66-público-neutro-cassiopeia--0211).

**Aceites pendentes:** `Control+Add` foi rejeitado e `Control+Equal` manteve razão
DPR 1; zoom 200/400% não foi estabelecido, não declarado indisponível. Mídias
reais forced-colors/reduced-motion não foram conferidas e leitor de tela não
foi investigado. CSS computado/menu nativo não são aceite visual/assistivo integral.

O núcleo funciona com adapter fake local (sem rede). Há também composições
opcionais de SharePoint via SPMIDDLE; elas não devem ser requisito para executar
as demonstrações ou contribuir com o núcleo em um clone público independente.

## Licença

O código próprio do MINIJOOMLA é licenciado sob **GPL-2.0-or-later**, conforme
[LICENSE.md](LICENSE.md). Componentes de terceiros mantêm seus avisos originais;
pendências de distribuição estão em
[THIRD-PARTY-NOTICES.md](docs/THIRD-PARTY-NOTICES.md). `private: true` no
`package.json` impede publicação acidental no npm, não determina a visibilidade
do repositório Git.

> **Histórico preservado, não versões atuais:** snapshot `39ec4b0` publicado
> como **0.2.1**, com 112 arquivos verificados/reload real; **0.2.3** alterou
> somente o CSS administrativo Atum (ações/cards, menu móvel, tipografia e
> reflow). **0.2.4** publicou títulos clicáveis/nomes contextualizados;
> **0.2.5** corrigiu descoberta; **0.2.6** acrescentou agendamentos (cinco
> scripts/manifesto, editor/serviços 0.2.5 e CSS 0.2.3 preservados), com recarga,
> sete larguras e 42 verificações sintéticas no host. A contraprova 0.2.2
> permanece no handoff. SEO global/tags sem consumidor continuam desabilitados
> e dados legados preservados. Esses incrementos não são releases públicas OSS
> nem aceite integral de zoom/alto contraste/leitor de tela. Consulte o
> [contrato e fechamento atual](docs/CONTRACTS-MINIJOOMLA.md#62-agendamentos-de-artigo-e-indicadores-administrativos), o
> [handoff histórico](docs/HANDOFF-DESENVOLVIMENTO.md), o
> [plano de continuidade](docs/PLANO-CONTINUIDADE-MINIJOOMLA.md) e o
> [prompt de transferência](docs/PROMPT-CONTINUIDADE-MINIJOOMLA.md).

## Executar

```bash
npm test
npm run check
npm run test:standalone-examples
```

O runner registra **72 suítes**: 63 locais e nove opcionais SPMIDDLE.
`npm test` executa o núcleo sem projeto irmão: nove suítes de integração são
explicitamente omitidas quando `../SPMIDDLE` está ausente. Se estiver presente,
falhas de import/assertion continuam sendo falhas, não skips. O target de estágio
`core` seleciona fontes locais e licenças sem middleware/TinyMCE; é um estágio
de fontes, não um clone contributor completo com demos/editor real. `all` e `site`
continuam exigindo `../SPMIDDLE/packages`. Isso ainda não aprova a distribuição
independente nem resolve a auditoria de dados, histórico e terceiros.

O comando standalone executa os módulos inline **sem transformá-los** dos exemplos
em uma seleção isolada de fontes próprias, sem projeto irmão, instalação, rede
ou navegador. Passaram sete grupos de contratos Node; isso não prova TinyMCE
real, DOM de navegador ou distribuição contributor completa. A correção local
CAMAP `343bb58` passou os sete grupos sem `LIMIT` ou warnings tolerados;
seleção de estilos/defaults próprios preserva dados/ETags salvos. O workflow
está em [LOCAL-DEMO.md](docs/LOCAL-DEMO.md). A contagem de 34 passes no child
isolado exclui apenas `runner.test.js` para evitar recursão e inclui os exemplos
standalone; não é o total de suítes locais registradas.

O aviso original TinyMCE foi preservado byte a byte, mantendo os 32 arquivos
vendor anteriores. A nova regressão cobre aviso/staging e preservação dos bytes
Git; não valida proveniência ou fonte/build GPL correspondente. Essa correção
é local e não reescreve os assets publicados. Ver
[avisos de terceiros](docs/THIRD-PARTY-NOTICES.md#subsequent-local-notice-preservation--2026-11-04).

A conversão assistida legada está implementada **localmente**, com prévia,
aplicar/restaurar e ETag ao salvar, sem migração automática. Interseção rota e
alias de categoria é recusada para não ampliar a visibilidade. Não integra ainda
o admin 0.2.10 publicado; ver
[contrato 6.7](docs/CONTRACTS-MINIJOOMLA.md#67-conversão-assistida-de-atribuições-legadas--local).

Para experimentar no navegador, execute o servidor local somente leitura:

```bash
node scripts/serve-local.js
```

Ele escuta somente `127.0.0.1:8080`, serve exemplos/fontes/testes e bloqueia
`tmp/`, Git e documentação. Não é um servidor de produção. Use `--port` para
outra porta. Abra `http://127.0.0.1:8080/examples/index.html` ou
`http://127.0.0.1:8080/examples/admin.html`;
as verificações de navegador neste workspace usam uma instância própria do
FIORI-AUTO. As duas páginas
compartilham dados demonstrativos
persistidos no `localStorage` da mesma origem, com validação pelo serviço
administrativo real e concorrência por ETag. Não são dados do SharePoint.
Alterações já conectadas de ativação, instâncias e template padrão aparecem no
site após recarregar. Atribuições/agendamento/chrome dos módulos, parâmetros e
ordem de plugins, estilos e opções suportadas de componentes têm consumidores
reais; limites e aceites não realizados estão identificados no plano.

Teste nativo de layout separado (Windows/Edge/FIORI-AUTO fornecido localmente):

```powershell
npm run test:admin-layout -- --agent '<caminho-local>\FioriAgent.exe'
```

Abre apenas uma instância/perfil próprios e dados em memória; sete larguras,
contraprovas obrigatórias e saída não zero em falhas. Não acessa tenant/TinyMCE,
não usa outro controlador e não equivale a aceite visual integral. Consulte
[ADMIN-LAYOUT-TESTS.md](docs/ADMIN-LAYOUT-TESTS.md).

Contribuição e limites de segurança: [CONTRIBUTING.md](docs/CONTRIBUTING.md),
[SECURITY.md](docs/SECURITY.md) e [BACKLOG.md](docs/BACKLOG.md).
Estágio opcional independente: [RELEASE-CORE.md](docs/RELEASE-CORE.md).
`npm run release:check` é somente um gate estrutural offline, não autorização
de publicação nem auditoria de direitos/dados.
`scripts/audit-distribution.js` verifica apenas candidatos de um manifest `core`,
sem valores encontrados nos relatórios; ele não aprova privacidade/direitos nem
audita histórico. Veja [DISTRIBUTION-AUDIT.md](docs/DISTRIBUTION-AUDIT.md).

A página inicial aceita `homeView: 'category'` com `homeCategory` (alias da
categoria), ou `homeView: 'featured'` para artigos em destaque de todas as
categorias. Ambos os modos usam a paginação do site. Sem configuração explícita,
a categoria `noticias` continua sendo a página inicial.

Use `examples/index.html?template=cassiopeia` ou `?template=camap` para comparar
os layouts sem alterar o padrão salvo. O painel administrativo usa a paleta
Joomla/Atum. **Cassiopeia neutro está publicado no público 0.2.11**, com paletas azul/bordô,
gradiente, superfícies neutras e fonte de sistema/Roboto instalado. Rótulos dos
estilos mantêm os mesmos valores persistidos. A publicação de imagens 0.2.8 foi
um incremento anterior; 0.2.11 comprovou o CSS neutro sem gravar a seleção salva.
CAMAP permanece opcional. A neutralização de
`51a1b2a` reduziu os três candidatos a zero **nas fontes selecionadas**; o novo
core 0.3.0 também foi auditado com zero candidatos/49 arquivos, conforme
coordenador. A amostra histórica de 48 arquivos/três candidatos permanece
histórica. Os **243 temporários rastreados** e o histórico/raiz/remoto do agregador
continuam sujeitos a revisão separada; zero candidatos não certifica sua privacidade.
Detalhes em
[PUBLIC-TEMPLATE.md](docs/PUBLIC-TEMPLATE.md). Não há equivalência visual pixel
a pixel nem aceite integral de zoom/leitor de tela.

## Administração e templates

- Gestão de módulos, plugins e templates: filtros, edição e ativação persistida.
- Template padrão persistido em `siteConfig.templateKey`, com proteção contra
  desativação/exclusão do padrão ativo.
- Catálogo dos componentes nativos e suas capacidades, sem anunciar instalação
  de componentes PHP ou execução arbitrária de código.
- Cassiopeia e CAMAP com 15 posições de módulos, colunas condicionais,
  navegação responsiva e links de foco que não alteram a rota.
- Instâncias configuradas são a fonte autoritativa dos módulos: desativar ou
  excluir a última instância realmente remove sua apresentação.
- Módulo nativo de busca posicionável, com envio pelo router e rótulos
  acessíveis configuráveis.
- Editor TinyMCE com abas Conteúdo, Opções e Publicação, verificação local de
  acessibilidade, autoria e janelas de publicação/destaque. A janela de imagem
  oferece `Advanced` → espaçamento horizontal/vertical em pixels; o público
  preserva margens numéricas de 0 a 200 px e, desde a correção pública 0.2.8,
  `float` de imagem e largura em pixels limitada, sem liberar CSS arbitrário.
- Salvar aguarda sincronização/uploads e usa o ETag da abertura. Metadados,
  campos desconhecidos e datas intactas são preservados; não há ACL/histórico.

Contratos e limites em [`docs/ADMINISTRATION-EXTENSIONS.md`](docs/ADMINISTRATION-EXTENSIONS.md),
[`docs/CASSIOPEIA.md`](docs/CASSIOPEIA.md) e
[`docs/CAMAP-TEMPLATE.md`](docs/CAMAP-TEMPLATE.md).

Para montar o site com os repositories reais, use
`createMiniJoomlaSiteApplication()` em
`src/composition/createMiniJoomlaSiteApplication.js`. Essa composição carrega
a configuração salva e conecta as listas opcionais de módulos, extensões e
templates ao runtime público. Em um host SharePoint, injete um `documentRef`
cujo `body` seja somente o contêiner dedicado, nunca o corpo da página inteira.
Para carregar CSS automaticamente, exponha também `head`, `baseURI` e
`createElement` do documento real; hosts que gerenciam os estilos externamente
podem continuar fornecendo apenas o contêiner.

O snippet em
[`host-adapters/modern-script-editor/site-snippet.html`](host-adapters/modern-script-editor/site-snippet.html)
usa a composição independente do MINIJOOMLA, não o kernel do mse-platform.
Ele requer a base de uma versão imutável, o site e as listas já existentes.
`mountMiniJoomlaSite()` monta somente o contêiner dedicado e preserva navegação,
título e idioma da página SharePoint. Para refletir a administração salva,
inclua os domínios opcionais `siteConfig`, `moduleInstances`, `extensions` e
`templates` no mapa `lists`; o snippet não provisiona listas.

Não há equivalência integral ao Joomla/PHP: ACL, usuários, instalador de pacotes
e extensões de servidor não são implementados. Parâmetros/ordem/entrypoint de
plugins ativos são relidos a cada navegação, com finalize/init quando mudam;
o mesmo URL mantém import cacheado, portanto código novo exige URL versionado.
Os layouts são implementações JavaScript independentes, não uma distribuição
oficial Joomla. Direitos sobre configurações/código eventualmente reutilizados
e marcas continuam sujeitos à revisão descrita nos avisos de terceiros.

## Arquitetura

`dados → adapter → casos de uso → view models → componentes → template`.

Desde o commit `9feebf9`, as fontes seguem a árvore oficial do Joomla. O núcleo
próprio (antigos `src/core`, `src/application`, `src/composition`,
`src/infrastructure`, `src/security`, `src/modules/*.js` soltos) agora mora em
`src/libraries/minijoomla/{core,application,composition,infrastructure,modules,plugins,security}/`:

- `core`: configuração, eventos, estado e roteamento amigável.
- `infrastructure`: contrato fake substituível e adapter/repositories
  reais do SPMIDDLE, sem REST embutido na UI.
- `application`: casos de uso e view models, incluindo o serviço
  administrativo (`admin-service.js`) e a descoberta de extensões.
- `composition`: composições que montam a aplicação (pública ou
  administrativa) contra o `FakeAdapter` ou os pacotes reais do SPMIDDLE.
- `modules`: registry de módulos e carregamento dinâmico de módulo/plugin
  descoberto (helpers compartilhados; os módulos em si estão em `src/modules/mod_*/`).
- `plugins`: API de plugins declarativa (`onContentPrepare`,
  `onSearchPrepare`, `onAppInit`/`onAppFinalize`).
- `security`: escaping e sanitização de conteúdo/URLs.

O restante da árvore segue os caminhos Joomla padrão:

- `src/components/com_{content,tags,finder}/`: páginas de conteúdo, tags e busca.
- `src/modules/mod_*/`: módulos Joomla nativos (cada um em sua própria pasta,
  com manifesto XML e `tmpl/`).
- `src/plugins/content/<nome>/`: plugins de conteúdo nativos.
- `src/templates/{cassiopeia,camap}/`: shell responsivo e posições de módulo do
  site público; CSS em `src/media/templates/site/`.
- `src/administrator/components/com_minijoomla/`: painel administrativo — app
  separado, próprio router/shell, nunca compartilha página com o site público.
  A divisão por diretório administrativo `com_*` ainda não foi concluída:
  várias páginas de componentes seguem agrupadas no app atual.
- `src/administrator/templates/atum/`: shell do painel administrativo; CSS em
  `src/media/templates/administrator/atum/css/template.css`.
- `src/media/vendor/tinymce`: TinyMCE 7.9.1 self-hosted (licença
  GPL-2.0-or-later, a mesma do `plg_editors_tinymce` do Joomla real),
   árvore minimal vendorizada — editor real de `articletext`, separado em
   `introtext`/`fulltext` por readmore, e HTML personalizado. Skin de terceiros
   intacta, fora da adequação cromática própria (ver
   `src/administrator/components/com_minijoomla/editor.js`).

`createApplication()` aceita `autoStart: false` para composição controlada e
expõe `start()`/`stop()` idempotentes para iniciar ou liberar o listener de
navegação do router em hosts que montam e desmontam a aplicação dinamicamente.
`createAdminApplication()` (`src/administrator/components/com_minijoomla/app.js`)
segue o mesmo princípio para o painel administrativo, com seu próprio
`documentRef`/router.

Não há ACL própria nesta camada (nem no site público, nem no painel
administrativo). Leitura e escrita são separadas no contrato; o `FakeAdapter`
só expõe leitura. A integração real com SPMIDDLE/SharePoint está documentada
em [`docs/INTEGRATION-SPMIDDLE.md`](docs/INTEGRATION-SPMIDDLE.md).

## Próximas lacunas conhecidas

- Completar a separação do painel em diretórios `administrator/components/com_*`.
- Os 15 manifestos de módulos **já são gerados**; geração de plugins/templates
  e descritores de componentes continua pendente.
- i18n, SEO do host, histórico e check-in/check-out de artigos estão excluídos
  desta etapa. Novos componentes como `com_contact`/`com_banners` não são
  requisitos implícitos do fechamento.
- Aceites reais de zoom/reflow, `forced-colors`, `reduced-motion` e leitor de
  tela continuam pendentes; checks de DOM/CSS não os substituem.
- Save hooks `onContentBeforeSave`/`onContentAfterSave` já são chamados pelo
  serviço quando um manager é injetado; conexão de plugins persistidos pelo
  host administrativo é a pendência da baseline (em desenvolvimento).

## Rotas de exemplo

- `#/` — página inicial
- `#/article/boas-vindas` — artigo individual
- `#/category/noticias` — blog de categoria
- `#/search?q=energia` — busca

Navegações internas programáticas preservam o hash completo da rota no
navegador (incluindo query string), evitam reload e ignoram renderizações
assíncronas obsoletas quando o usuário muda de rota rapidamente. O router também
escuta `popstate`, mantendo voltar/avançar do navegador sincronizados com a tela.

O formulário de busca identifica explicitamente sua finalidade, associa o campo
a uma instrução acessível e mantém essa instrução visualmente oculta sem removê-la
da árvore de acessibilidade.

Critérios, lacunas e rollback estão documentados em
[`docs/JOOMLA-EQUIVALENCE.md`](docs/JOOMLA-EQUIVALENCE.md). Estado operacional
completo (testes, publicação real, pendências) em
[`docs/HANDOFF-DESENVOLVIMENTO.md`](docs/HANDOFF-DESENVOLVIMENTO.md).
