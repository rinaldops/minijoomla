# MINIJOOMLA — Estado, gaps e prioridades

Guia autossuficiente de escopo do produto, implementação por área, gaps/pendências ativas, gates de publicação e lições operacionais (worktrees, rollback, sequenciamento, validação/aceite). Contratos de dados, instalação/publicação/recuperação e critérios de teste/validação detalhados não são repetidos aqui — ver `docs/CONTRATOS.md`, `docs/INSTALACAO.md` e `docs/DESENVOLVIMENTO.md#validacao`.

## Escopo do produto

MINIJOOMLA é um CMS JavaScript modular, Joomla-like, com adapters de dados
substituíveis (fixtures fake ou SPMIDDLE), administração própria e
integração SharePoint/SPMIDDLE **opcional**. Não é uma distribuição oficial
do Joomla, não é equivalência integral Joomla/PHP e não é uma aplicação
corporativa: é uma distribuição independente; temas/integrações
corporativas são extensões opcionais, nunca requisitos do núcleo.

Fronteiras obrigatórias:

- **MINIJOOMLA** é responsável por shell/template/navegação/rotas,
  renderização de páginas/artigos/categorias/tags/menus, componentes e
  módulos inspirados no Joomla oficial, plugins de conteúdo/busca/eventos,
  formulários/estados/validação/paginação, configuração de site/template/
  módulos, acessibilidade/responsividade/teclado/foco/zoom, e adaptação de
  dados de domínio para view models.
- **SPMIDDLE** é responsável por transporte REST/autenticação SharePoint,
  schemas/allowlists/repositories/mappers/ETags/provisioning, persistência
  das listas e contratos de dados/limites de segurança do armazenamento.
  MINIJOOMLA nunca implementa transporte SharePoint dentro de componentes,
  módulos ou templates; a integração é só por adapters/serviços injetáveis
  (`dados → adapter/ports → casos de uso → view models → componentes → template`).

Proibições explícitas e permanentes:

- Não reutilizar código/layout/nomes/componentes específicos de CAMAP-AGP,
  Tecnologias Digitais (TD), Fórum, Videoteca, "Explorar Mais", recursos
  sociais/módulos internos do `mse-platform`, runtimes `mse-preview-*` ou
  qualquer funcionalidade inventada para um site corporativo específico.
  Esta vedação vale para o núcleo genérico; extensões externas opcionais,
  individualmente aprovadas, seguem os gates de Extensões e Proveniência.
  Ideias/algoritmos equivalentes ao Joomla exigem proveniência documentada.
- **Não implementar ACL própria**: sem permissões por usuário/grupo, matriz
  de acesso, regras de autorização editorial ou telas de gerenciamento ACL.
  Isso não elimina validação de entrada, sanitização, proteção XSS/CSRF em
  escritas, nem separação entre área pública e administrativa.
- Videoteca/Forum foram **transferidos para TD** e estão suspensos; não
  desenvolver nem reativar sem nova decisão explícita. CAMAP/CAMAP-V3 não
  são defaults nem dependências obrigatórias da instalação genérica.
- Apenas `default` e `cassiopeia` são templates builtin (ambos usam
  Cassiopeia). O builtin `camap` foi **removido do núcleo em 11/11/2026**
  por decisão explícita do usuário ("não faz parte do Joomla original").
  Templates externos são publicados/registrados/selecionados explicitamente,
  nunca adotados por inferência.
- Fora de escopo permanente, sem promessa de implementação futura: i18n;
  SEO integrado ao host (metadados/robôs/título globais do host, decisão de
  contrato ainda pendente); histórico de alterações e check-in/check-out de
  artigo; ACL; `com_users`; `com_contact`/`com_banners`/`com_newsfeeds`/
  `com_fields`/`com_workflow`; indexação avançada/ranking de busca
  (`com_finder` completo); `com_redirect`; PHP/SQL; instalador ZIP genérico
  de extensões de servidor. Transportar metadados públicos existentes, ETags
  e reversão de extensões permanecem no escopo.
- Instalação genérica cria **oito domínios/listas vazias estritamente
  verificadas** mais um arquivo operacional, **zero linhas de
  conteúdo/configuração**; Sample Data é opcional e separado do instalador.

### Site consumidor específico (`mse-platform`) — frente separada

O consumidor concreto do Site Kernel do `mse-platform` é uma frente
separada do produto genérico; suas decisões e pendências são:

- Sem ACL/autenticação própria (herda a decisão já tomada no plano do
  kernel); autorização é 100% nativa do SharePoint.
- Convenção de nomenclatura 100% oficial Joomla nas listas/campos
  SharePoint (`MSE<TabelaJoomla>`), incluindo a lista nova `MSEContent`
  (`#__content`); tradução de nomes para o shape interno do kernel acontece
  só na camada de adaptação do site, nunca no SharePoint nem no kernel.
  Achado documentado: o kernel compara o valor de `estado` contra o literal
  fixo em português `"Publicado"`, não configurável por `fieldMap` — a
  camada de adaptação do site precisa traduzir o valor antes de entregá-lo.
- Acesso a dados via adapter REST dedicado do `mse-platform`
  (`spmiddle-rest-adapter.js`), nunca dentro do pacote SPMIDDLE em si.
- Template `minijoomla-classic` inspirado em Cassiopeia; cores/tokens do
  site ficam fora do pacote do produto.
- **Status registrado:** código criado, **sem provisionamento nem
  publicação em tenant real**. Migração de dados legados e provisionamento
  real das listas deste site continuam fora de escopo até autorização.

## Estado de implementação por área

> `package.json` declara **0.17.6** na fonte local; isso não certifica qual
> release está ativa em um destino remoto — contagens de versão evoluem a
> cada publicação e não devem ser propagadas como atuais sem reverificação.
> Desde a convenção adotada em 11/11/2026, a versão do `package.json` deve
> sempre ser igual ao `--version` da última release imutável publicada pelos
> scripts de deploy/stage — nenhum script sincroniza esse campo
> automaticamente; atualizar manualmente no mesmo commit da publicação.

Implementado e validado localmente (com níveis de aceite reais diferentes
por item — ver "Gates atuais" para o que ainda falta antes de tratar algo
como pronto para produção):

- **Administração:** CRUD de artigos/categorias/tags/menu com filtros,
  ordenação, lote, lixeira e duplicação; editor com imagens/links/
  metadados/agendamento/readmore, sincronização de uploads, preservação de
  opções desconhecidas e ETags; TinyMCE 7.9.1 self-hosted (GPL-2.0-or-later)
  no campo composto `articletext` (quebra readmore separa `introtext`/
  `fulltext`) e em `customHtmlBody` da configuração.
- **Separação por componente:** views/controllers extraídos para a maioria
  dos `com_*` (conteúdo, categorias, tags, menu, módulos, plugins,
  templates, config, installer/discovery); roteamento, bindings e alguns
  helpers de formulário ainda são parcialmente compartilhados entre
  componentes (ver Gaps). Shell/sidebar do Atum compartilhados.
- **Extensões via XML:** descoberta de módulos de site com parser real e
  limites, instalação inicialmente desabilitada, integridade por pacote
  aprovado, upgrade/rollback com ETag; perfil XML de **plugins** e de
  **templates** concluídos (identidade/grupo/client/eventos/params para
  plugins; posições/params/assets/estilos/default para templates — templates
  são *register-only*, sem upgrade/rollback ainda). Geração automática dos
  15 manifestos XML nativos de módulos a partir do catálogo administrativo.
- **Plugins nativos:** parâmetros/ordem/lifecycle persistidos e aplicados no
  pipeline público; hooks de gravação de artigos via injeção opt-in
  (`beforeSave` transforma/veta, `afterSave` é observacional).
- **Migração assistida (JSON legado → XML/parâmetros):** executor concluído
  (comparação exata/recusas, plano, snapshots, mapeamento explícito, ETags,
  diário/retomada/rollback); **UI de painel para o executor ainda não está
  conectada** — não há tela administrativa que dispare o fluxo.
- **Instalação genérica:** engine/porta/UI/bootstrap/pacote implementados e
  testados localmente (suítes Node verdes, parse completo dos módulos
  envolvidos). **O aceite real de primeira instalação pelo botão/UI em um
  destino genuinamente vazio no SharePoint permanece pendente** — gate
  explicito mantido em `docs/INSTALACAO.md` ("aceite real no SharePoint
  pendente") e cobrado por teste automatizado (`tests/generic-installation-
  scope.test.js`). Os ensaios históricos registrados usaram destinos já
  parcialmente configurados por *tooling* (não pelo wizard de primeira
  instalação) ou aplicaram o dataset Sample Data sobre listas de teste
  pré-existentes, nunca o fluxo completo de instalação inicial contra um
  destino vazio; não tratar esses ensaios como o aceite genérico fechado.
- **FullBleed/visual:** integração do layout de viewport com o wrapper
  oficial do SPMIDDLE publicada e validada (mount/resize/navegação
  readonly); não é ativação persistida nem remove os limites internos dos
  templates.
- **Contributor/seleção pública:** allowlist determinística, manifesto
  byte/SHA-256, auditor de distribuição (`scripts/audit-distribution.js`)
  integrado ao runner, servidor de demo local somente leitura
  (`scripts/serve-local.js`) com suporte a montagem explícita de pacotes e
  seleção de template por catálogo (`?template=`).
- **Publicação e Sample Data:** ensaios históricos não fecham o aceite da
  instalação genérica. Retirada de oito listas legadas permanece pendente;
  preservar as listas e resolver a falha antes de qualquer nova reciclagem.

## Gaps e pendências ativas

Não tratar os itens abaixo como concluídos por nenhuma contagem de suíte,
teste sintético ou validação isolada anterior:

1. **Zoom real 200%/400%, reflow a 320 CSS px em zoom, `forced-colors`/alto
   contraste real, `reduced-motion` real e leitor de tela** — nunca
   estabelecidos em nenhuma rodada registrada. Tentativas de zoom via
   `Control+Add`/`Control+Equal` não alteraram o DPR real; essas tentativas não
   estabeleceram o comportamento assistivo real. Esta é a lacuna mais
   persistente do projeto e não deve ser declarada "indisponível" nem
   "aprovada por zoom CSS" — apenas "não estabelecida".
2. **UI do executor de migração assistida** ainda não existe no painel
   administrativo; o executor funciona isoladamente, sem tela que o dispare.
3. **Separação administrativa por `com_*`** tem roteamento/bindings e
   alguns helpers de formulário ainda compartilhados entre componentes
   (`app.js`, `extension-pages.js`, `field-schemas.js`); não tratar a
   separação como integralmente concluída mesmo com a maioria das views já
   extraídas.
4. **Adoção externa parcial:** três dos dez módulos foram adotados
   individualmente; sete continuam pendentes. Cinco desses sete foram
   ensaiados; Fórum/Videoteca estão suspensos. Gates legais permanecem abertos.
5. **Retirada segura das oito listas legadas** no destino corporativo
   permanece bloqueada por um erro recuperável (HTTP 500 em tentativa de
   reciclagem); não reexecutar DELETE/retry às cegas antes de resolver o
   bloqueio e restaurar pela lixeira, se necessário.
6. **Escrita em listas editoriais finais de produção** (conteúdo real persistente em `MiniJoomlaArticles`/demais listas definitivas, além do preview) ainda não foi autorizada; todas as escritas reais validadas até hoje usaram **listas de teste dedicadas dentro do mesmo tenant de produção** (por exemplo `TesteMiniJoomlaArtigos`), nunca um ambiente separado de desenvolvimento/homologação — este workspace opera somente em produção. Tratar essas listas de teste como recursos isolados dentro da própria produção, não como evidência equivalente à escrita editorial final.
7. **Direitos, privacidade e proveniência de terceiros** (fonte/build
   correspondente do TinyMCE vendorizado, avisos originais de
   DOMPurify/PrismJS/prism-themes quando presentes, revisão manual de
   candidatos sensíveis no core/seleção contributor, histórico de arquivos
   temporários rastreados) permanecem gates bloqueantes para qualquer
   prontidão de distribuição pública — nenhum teste automatizado os fecha.
8. **Controle de acesso à página administrativa** (restringir a uma única
   conta) foi deliberadamente adiado para a etapa do "site definitivo"; não
   revisitar sem o usuário levantar o assunto.
9. Fora de escopo permanente (ver "Escopo do produto"): i18n, SEO do host,
   histórico/check-in de artigo, ACL, `com_contact`/`com_banners`/
   `com_newsfeeds`/`com_fields`/`com_workflow`, indexação avançada de busca,
   `com_redirect`.
10. O site consumidor específico do `mse-platform`
    descrito na seção de consumidor acima permanece sem provisionamento nem
    publicação em tenant real; é uma frente própria, não acompanhada pelo
    restante do backlog consolidado aqui.

## Gates atuais de publicação e distribuição

- O workspace opera **somente em produção**: nenhuma operação remota
  (publicação, escrita, provisionamento, retirada de lista) sem destino e
  autorização confirmados na sessão atual; autorizações de rodadas antigas
  não se estendem automaticamente a um novo destino ou efeito.
- Toda automação de navegador, inclusive para páginas locais, usa
  obrigatoriamente uma instância própria do FIORI-AUTO (binário .NET 9
  pré-compilado); nunca Selenium/Playwright/CDP direto; nunca assumir a
  sessão de outro agente.
- Escrita em listas de **produção**/dados editoriais reais exige
  autorização operacional explícita e contrato próprio — distinta da
  escrita já validada contra listas de **teste**, que não é precedente
  automático.
- `release:check`, estágios locais (`--target core/site/all`) e suítes
  Node verdes **não são prova** de publicação, privacidade, direitos ou
  aceite visual/assistivo.
- Rollback de schema (remoção de colunas provisionadas) é uma operação
  destrutiva **nunca testada** em nenhuma rodada registrada; não tratar
  como procedimento disponível.
- Qualquer nova integração deve impor sua própria autorização no
  backend/host; MINIJOOMLA não implementa ACL para compensar.

## Lições — worktrees e integração de branches

- Nomear worktrees como `MINIJOOMLA-worktreeNN`, sempre irmãs do projeto
  (nunca dentro dele); perfis e temporários ficam exclusivamente no `tmp`
  mais próximo do projeto correspondente.
- Histórico Git linear permitindo fast-forward **não autoriza** substituir
  uma árvore de trabalho (`main` ou qualquer worktree) que esteja *dirty*;
  verificar ancestralidade e estado de trabalho como condições
  independentes antes de qualquer merge.
- Diffs semânticos (não apenas textuais) são necessários para reconciliar
  contribuições concorrentes: arquivos com a mesma finalidade podem ter
  APIs/aliases/limites distintos; aplicar um patch antigo "cegamente" pode
  reintroduzir bugs de concorrência/cancelamento já corrigidos na versão
  mais nova — revisão independente encontrou esse tipo de regressão mais de
  uma vez durante consolidações deste projeto.
- Antes de remover qualquer worktree: capturar um snapshot privado completo
  (bytes + SHA-256) de alterações rastreadas, *untracked* e *ignored*
  relevantes — nunca confiar apenas em `git diff`/`stash`, que podem omitir
  conteúdo dependendo do comando usado. Resíduos devem ser **movidos**
  (nunca descartados) para `tmp/worktree-retirement/<data>/` dentro do
  mesmo volume, com conferência de contagem/bytes depois da movimentação.
- `git worktree remove --force` só é aceitável após confirmar
  ancestralidade, ausência de dados relevantes não preservados e
  autorização explícita do usuário para aquela retirada específica; seguir
  com `git worktree prune` (após *dry-run*) para limpar cadastro obsoleto.
- Processos órfãos (ex.: instâncias de teste de navegador) podem bloquear a
  movimentação/remoção de pastas no Windows; encerrar apenas as árvores de
  processo confirmadas como próprias (perfil exato + agente-pai ausente),
  nunca sessões de outro agente ou pessoais.
- Remover uma worktree/pasta **não é** remover uma branch nem autorização
  para apagar histórico; branches de checkpoint/recuperação (ex.: branches
  de etapa usadas durante a integração) devem permanecer preservadas.
- Concorrência durante a janela de consolidação é um risco recorrente: já
  houve caso de a árvore principal continuar mudando **depois** de um
  congelamento confirmado pelo usuário, exigindo nova captura privada e
  bloqueio do fast-forward até a edição concorrente cessar de fato. Nunca
  declarar uma consolidação concluída enquanto outra frente ainda grava no
  mesmo branch/arquivo.

## Lições — rollback

- Rollback de uma fase **local** (sem publicação remota) é simples:
  reverter o commit da fase, repetir a suíte de testes e `git diff --check`;
  nunca usar reset destrutivo nem apagar fixtures/arquivos de outra frente.
- Rollback de uma **publicação remota** é por composição/asset, não por
  exclusão em massa: repontar somente o(s) arquivo(s)/`src` alterado(s)
  para a versão anterior, usando o canvas/ETag vigente e um `MERGE`
  específico; nunca restaurar o backup integral do canvas nem sobrescrever
  pastas de release já publicadas e imutáveis.
- Toda nova versão publicada deve viver em uma pasta **imutável nova**
  (nunca sobrescrever uma release anterior); releases antigas permanecem no
  host como pontos de rollback válidos mesmo depois de publicações
  subsequentes.
- A API de publicação remota não oferece transação atômica entre leitura de
  estado e publicação — releitura e comparação pós-escrita continuam
  necessárias em toda publicação; isso nunca foi "resolvido", apenas
  mitigado por verificação dupla (antes/depois) em cada rodada.
- Nunca repetir um `DELETE` permanente ou qualquer exclusão remota por
  *retry* às cegas após uma falha recuperável; esperar a resolução do
  bloqueio real e, se for preciso reverter, restaurar primeiro pela
  lixeira/reciclagem antes de reativar qualquer apontador histórico.
- Um snapshot/backup privado (hashes + bytes) antes de qualquer escrita
  remota é condição prévia obrigatória; "zero arquivos `tmp` rastreados no
  Git" nunca foi, por si só, evidência suficiente de privacidade ou
  integridade.

## Lições — sequenciamento de entregas

- Toda mutação remota segue estritamente `inspect → plan/apply → verify`
  (nunca "detectar → aplicar" direto): apresentar o diagnóstico completo
  com zero escrita antes de qualquer `apply`, dentro do destino e efeito já
  abrangidos pela autorização vigente da sessão — sem repetir confirmação
  já concedida, e sem pular a etapa de inspeção quando o destino/efeito
  mudar.
- Uma entrega administrativa só pode ser apresentada como operacional
  depois de demonstrar a cadeia completa `formulário → serviço → campo
  persistido → composição pública → consumidor`; salvar um campo no painel
  nunca equivale, por si só, a funcionalidade pronta.
- Frentes paralelas precisam de arquivos de responsabilidade exclusiva; uma
  frente que precise alterar contratos compartilhados (descoberta/
  instalação, parser/manifestos, runtime/transporte, `app.js`, staging,
  registro de testes) deve sinalizar previamente às demais frentes antes de
  tocar nesses arquivos, mesmo operando "no seu próprio escopo".
- Cada incremento publicado deve declarar seu grafo efetivo (quais
  arquivos/dependências foram realmente substituídos versus herdados de uma
  release anterior); misturar origens de versões diferentes num mesmo
  incremento é um erro histórico recorrente — verificar hash/MIME/versão de
  cada asset antes de declarar o incremento coerente.
- A regressão completa (suíte + sintaxe + seleção contributor + estágios)
  deve ser reexecutada a cada incremento antes de publicar; contagens de
  passes de uma rodada anterior **não transferem aprovação** para uma árvore
  nova, e um timeout/falha parcial nunca conta como passe mesmo que uma
  execução anterior tenha sido verde.
- Cache HTTP/CDN é por URL exata; a entrega deve usar **paths/revisões
  imutáveis com hashes** e verificar o asset efetivo. Query única serve apenas
  ao diagnóstico, não como política de versionamento/publicação.

- Toda tela/ação administrativa precisa de um *guard* de navegação atual
  desde o desenho inicial (callback de tela abandonada não deve gravar nem
  re-renderizar outra tela) — isso já precisou ser corrigido depois de
  implementado em mais de um incremento deste projeto.

## Lições — validação e aceite

- Marcar um item como concluído exige evidência registrada (comando, teste,
  captura); "está no Git" ou "parece implementado" nunca é evidência
  suficiente.
- Suíte Node 100% verde **nunca** prova aceite visual, assistivo ou de
  navegador real; toda alteração de UI/rota/CSS exige revalidação pelo
  FIORI-AUTO em instância própria.
- Testes com DOM simulado/mínimo não substituem DOM real; já houve telas
  administrativas "confirmadas" apenas por teste de serviço isolado cujos
  dados não chegavam de fato ao runtime público — nunca apresentar um
  controle como operacional sem a cadeia completa comprovada.
- Zoom real, `forced-colors`, `reduced-motion` real e leitor de tela
  permanecem não estabelecidos; qualquer tentativa que não
  altere o DPR real deve ser registrada como "não estabelecida", nunca
  como "aprovada" ou "indisponível por limitação permanente".
- Validação contra fixtures/transporte fake não prova comportamento contra
  o tenant real; divergências reais só apareceram ao validar contra listas
  de **teste** reais (por exemplo: a leitura em lote do transporte SPMIDDLE
  não anexa ETag aos itens; um campo customizado de autor colidiu com um
  campo de sistema nativo do SharePoint e foi renomeado silenciosamente pelo
  próprio tenant). Reservar sempre uma rodada de validação contra listas de
  teste reais antes de tratar um contrato de mapeamento como fechado.
- Comparação de HTML byte-a-byte contra um checkpoint anterior é necessária,
  mas não suficiente, para aceitar que uma extração/refatoração de view não
  alterou comportamento visível.
- Contagens de "suítes aprovadas" cresceram continuamente ao longo do
  projeto sem nunca medir paridade Joomla ou conclusão geral; usar sempre o
  número do momento da verificação atual, nunca propagar uma contagem
  antiga como se fosse vigente.
- Revisão independente (segundo revisor/modelo) encontrou repetidamente
  defeitos reais que a suíte automatizada não cobria (condições de corrida,
  validação de URL de entrypoint mais frouxa em caminhos de escrita
  alternativos, bugs de tipo em chamadas de provisionamento) — reservar
  sempre uma passada de revisão independente antes de declarar um
  incremento fechado.

## Referências canônicas

- Contratos de dados, adapters, SPMIDDLE e evolução XML: `docs/CONTRATOS.md`.
- Instalação, publicação, Sample Data e rollback de host: `docs/INSTALACAO.md`.
- Testes, acessibilidade, aceite e limites de evidência: `docs/DESENVOLVIMENTO.md#validacao`.
- Templates Cassiopeia/posições/parâmetros: `docs/TEMPLATES.md`.
- Administração, módulos/plugins, XML e migração/adoção: `docs/EXTENSOES.md`.
- Setup, demo, contribuição e seleção de release: `docs/DESENVOLVIMENTO.md`.
- Derivações, direitos e gates de distribuição/proveniência: `docs/PROVENIENCIA.md`.
- Inventário de equivalência Joomla: seção abaixo, sem promessa de paridade integral.

## Inventário de equivalência Joomla

Equivalência significa **conceito, fluxo e contrato de apresentação**, não
cópia de implementação/ativos PHP nem paridade integral com o Joomla.

| Tema | Superfície entregue / limite |
| --- | --- |
| Núcleo | Bootstrap configurável, shell/módulos e estados loading, vazio, erro e 404; não substitui o erro do host |
| Conteúdo | Artigos com autor/datas/imagens de introdução/completa/links A/B/C; blog/lista/destaques, categorias, tags, arquivo, impressão e paginação |
| Navegação | Menus hierárquicos, rota hash, breadcrumbs; raiz e ancestrais são links e só a página atual é texto com `aria-current` |
| Administração | CRUD, filtros/ordenação/lote/lixeira/duplicação; categorias aninhadas, tags, menus, mídia, configuração, instâncias e discovery de pacotes aprovados |
| Extensões | Módulos e plugins de conteúdo/busca/lifecycle; discovery/registro não equivale a upload/execução arbitrária de código |
| Sessão | Login representa apenas sessão do host; não há autenticação nem ACL própria |
| Ausências intencionais | SEF do host, índice/ranking completo, popularidade sem dados de acesso, feed sem contrato e demais componentes fora do escopo |

### Administração Atum e acessibilidade

O admin é uma aplicação separada da pública, inspirada no Atum real:
header/sidebar `#132f53`, Roboto, árvore de dois níveis (Tags em Componentes),
cpanel agrupado em Site/Sistema. Ícones de estado circulares de 26px, sem texto
visível, exigem rótulo acessível; destaque `#c78800`. Vermelho `#c52827` para
exclusão/erro é restrito ao admin. SVGs são próprios, sem vendorizar Font Awesome.
Corrigir cor não basta para fidelidade estrutural; validação DOM/OCR não prova
equivalência visual pixel a pixel. Editor em aba oculta deve iniciar ao revelar
a aba, evitando instância 0×0. Nenhuma paleta corporativa é requisito do núcleo.

### Contratos que evitam regressão entre adapters

Ports são assíncronos mesmo com fixtures síncronas; ausência, paginação e erros
de domínio são explícitos, sem objetos/detalhes de transporte nas views. Datas,
fuso e serialização precisam de clock injetável e fixtures determinísticas,
sem dependência de locale ou relógio da máquina. Sanitização de saída não
reescreve HTML autoral salvo. Os detalhes executáveis ficam em Contratos;
aceite visual/assistivo real continua sujeito aos gates de Validação.
