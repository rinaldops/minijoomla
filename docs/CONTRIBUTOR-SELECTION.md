# CONTRIBUTOR LOCAL — seleção técnica revisável

> Baseline reavaliada em 06/11/2026: 304 arquivos / 4.234.501 bytes,
> verificação padrão de seleção/hashes/inventário aprovada. Contagens de 171 e
> testes de 04/11 abaixo são históricos. O `npm test` completo da avaliação
> apresentou falha de cleanup e timeout; não declarar passe atual do workflow
> integral por esse teste padrão separado. [Relatório atual](AVALIACAO-E-ESCOPO-2026-11-06.md).

Esta seleção é uma cópia local utilizável para contribuição, **não uma
distribuição pública aprovada**. O estágio `core` 0.3.1 é runtime-only: não
contém demos, testes nem o runtime TinyMCE e não deve ser chamado de contributor.
O novo target `contributor-local` não é uma versão de release/host.

## Consolidação local — 09/11/2026

**Checkpoint posterior de generalização:** seleção atual com 418 caminhos
exatos, quatro arquivos de bootstrap genérico (host, contexto e dois snippets),
109 suítes registradas, 17 integrações SPMIDDLE opcionais somente quando o irmão
está ausente. Regressão integrada completa aprovada, 333 JS/MJS parse-only;
contador de upload não é baseline fixo da ordem de suítes.
[Ciclo e limites atuais](CICLO-INSTALACAO-CONTINUIDADE.md). Os resultados abaixo
continuam sendo registros históricos da consolidação anterior.

> **Separação posterior:** fontes/teste/documentação específicos de Videoteca
> foram transferidos para TD; Forum não tem implementação ativa neste núcleo.
> O runner não permite mais exceção para fixtures suspensas TD na pasta tests.
> CAMAP permanece referência transitória até o template externo CAMAP-V3 estar
> pronto, não parte da instalação padrão. O
> [contrato genérico](INSTALACAO-GENERICA-MINIJOOMLA.md) integra a seleção.
> Contagens abaixo são snapshots históricos, não metas fixas.
> A nova suíte de escopo genérico verifica ausência de implementações TD na
> seleção/pasta ativa e mantém explícito o aceite real pendente em SharePoint/MSE.

As contagens de 04/11 abaixo são **históricas**, não o inventário desta worktree.
O grafo step2 (sample data, pilotos/adaptações XML e Documentation) é preservado;
o tooling útil do snapshot MAIN é integrado sem ativar CAMAPv3. Videoteca parcial
continua suspensa: seu script/teste não entram na seleção nem no runner. O gate
geral de sintaxe pode analisar esses arquivos existentes, mas não executa fixtures.

O runner registra explicitamente plugins administrativos, plano de migração,
regressão de queries, provisionamento e tooling. A cópia standalone usa os mesmos
**caminhos exatos** de `CONTRIBUTOR_FILES`, incluindo dependências de scripts, sem
descobrir fontes por glob/cópia recursiva e sem copiar projetos irmãos. Quatorze
suítes requerem SPMIDDLE, incluindo plugins administrativos, provisionamento e
o wrapper explícito `query-options-main-spmiddle.test.js`;
regressão de queries, plano de migração e tooling são core/local. Só irmão ausente
gera skip; checkout parcial/import/export/assertion inválidos continuam falhas.

O source package Documentation mantém suas onze referências upstream locais
pinned e o build histórico `.5` separado em `scripts/documentation-frozen-build/`.
Os **18 caminhos exatos** desse suporte foram acrescentados à lista canônica,
incluindo scripts, dependências próprias, parser/avisos/licenças e package.json.
A fachada usa esse build congelado; não se ajustam pins para aceitar qualquer
fonte corrente. Preservação histórica não aprova direitos/publicação, nem essa
inclusão implica revalidação do pacote/contributor completo.

Validação focal desta consolidação:

- Manifestos: **100 suítes / 14 opcionais / 391 caminhos contributor / 18 frozen**,
  sem arquivos declarados ausentes ou suítes registradas omitidas.
- Tooling parse-only/cópia/cleanup e os onze cenários de provisionamento passaram.
  Sintaxe geral: **319 JS/MJS**, sem avaliar imports/fixtures.
- Auditoria adversarial + core local passou com **147 arquivos declarados**,
  hashes/inventário e escopo exato do parser; nenhuma aprovação pública.
- Contributor focal passou com **391 arquivos / 6.820.364 bytes** no snapshot
  daquela execução: hashes/bytes determinísticos, flags false, inventário,
  exclusão de fontes não listadas, hardlinks/CLI e três junction checks;
  uma criação de symlink pendente indisponível por permissão, não simulada.
  Os bytes mudam quando fontes/docs são editadas; não é um baseline imutável.
- Runner focal (`completeStandalone: false`) passou negativos reais/scheduling,
  14 skips visíveis sem irmão e 14 falhas (não skips) no checkout parcial.
  O wrapper de queries passou com SPMIDDLE real/transporte local: 1 passe, zero
  skips/falhas. Não prova execução standalone completa.
- Uma tentativa release-core foi recusada por edição paralela de
  `src/libraries/minijoomla/index.js`; a **repetição estável passou**, mantendo
  comparação de bytes/manifestos, 147 arquivos, loader offline e gates estritos.

Runner completo e workflow `--commands` **não executados nesta consolidação**;
nenhuma contagem histórica é um passe da nova seleção completa. Não houve
navegador, publicação ou alteração do snapshot MAIN.

## Criar e conferir

Na raiz MINIJOOMLA, com Node LTS mantido (22 ou posterior) e npm, sem instalação:

```sh
node scripts/stage-contributor.js --output tmp/contributor-local-01
node --input-type=module -e "const s = await import('./scripts/stage-contributor.js'); s.verifyContributorStage({ output: 'tmp/contributor-local-01' });"
node scripts/audit-distribution.js --manifest tmp/contributor-local-01/manifest.json
node tests/contributor-stage.test.js
node tests/contributor-stage.test.js --commands
```

A primeira execução valida seleção/CLI/integridade sem recursar comandos npm.
`--commands` acrescenta o workflow completo no recorte isolado (npm test,
sintaxe, exemplos, core e HTTP/MIME). Sem essa opção não anunciar esse workflow
como executado. Onze integrações são opcionais somente quando o irmão está ausente.

`--output` é a única opção CLI e resolve relativamente ao projeto, não ao
diretório do terminal. Deve ser um **descendente de `tmp/`**, novo: diretório
existente (mesmo vazio), traversal, UNC/URL, aliases Windows, symlinks/junctions,
links pendentes e arquivos hardlinked são recusados. A API `sourceRoot` existe
somente para fixtures dentro do `tmp/` deste projeto, nunca para o irmão.
O script reserva exclusivamente o diretório e escreve com `wx`, sem overwrite,
limpeza ou atualização in-place. Se houver interrupção/erro de escrita, a pasta
parcial não é um estágio válido; use outro destino, sem reutilizá-la.
Não há proteção contra um processo hostil que altere o filesystem durante a
operação, ACL de imutabilidade ou assinatura de autenticidade.

## Seleção explícita

A lista canônica é `CONTRIBUTOR_FILES` em `scripts/stage-contributor.js`:
**nomes de arquivos exatos**, sem glob ou cópia recursiva das fontes. Arquivo
selecionado ausente/fonte alterada reprova a operação; arquivos novos não entram
automaticamente. Os bytes são copiados intactos, sem alterar imports, comentários,
fixtures, regras de auditoria, exemplos ou avisos.

- Entrada: `README.md`, `package.json` (`private: true` preservado), licença
  própria, `.gitignore`/`.gitattributes` (preservação de bytes vendor).
- Fontes próprias, demos e testes úteis atuais, incluindo testes opcionais,
  auxiliares DOM e fixtures. Composições/adapters próprios SPMIDDLE permanecem
  como **fontes opcionais**, não como dependências obrigatórias das demos.
- Os **33 arquivos TinyMCE** atuais, incluindo `license.md`, `notices.txt`,
  comentários internos, plugins/skins e recursos de idioma, permanecem intactos.
  Isso permite servir os assets do editor local atual, não comprova seu aceite
  real em navegador nem licença completa/proveniência/fonte-build correspondente.
- Scripts de teste/sintaxe/servidor/gates locais, incluindo `stage-release.js`.
- Somente docs de entrada e contratos utilizados pelos testes: este documento, `CONTRIBUTING.md`,
  `SECURITY.md`, `LOCAL-DEMO.md`, `ADMIN-LAYOUT-TESTS.md`, `RELEASE-CORE.md`,
  `THIRD-PARTY-NOTICES.md`, `EXTENSOES-JOOMLA.md`, `CONTRATOS-EVOLUCAO-XML.md`,
  `ETAPA-1-SAMPLE-DATA.md`, `PROVENIENCIA-DOCUMENTATION.md` e o texto GPL. README/avisos ainda contêm contexto
  histórico: sua inclusão **não** autoriza redistribuí-los como documentação OSS.

Não entram o irmão SPMIDDLE nem sua licença sem seu código, Git/índice/histórico,
`tmp/`, arquivos de evidências/perfis, árvores `host-adapters/`/`theme/`, planos,
handoffs, runbooks, inventários e toda a documentação corporativa em bloco.
Links de documentos excluídos podem permanecer no README/avisos originais:
o próximo gate documental deve revisar as entradas e referências, não ampliar
a allowlist para copiar runbooks nem sanitizar automaticamente a fonte.

## Manifesto e integridade

`manifest.json` tem schema 1, target `contributor-local`, algoritmo SHA-256 e
lista ordenada de `{ path, bytes, sha256 }`, caminhos relativos portáveis.
Inclui **cada arquivo da seleção**, inclusive scripts/testes/docs/avisos; apenas
o próprio manifesto é excluído de seu hash autorreferente. Não há timestamps,
caminhos absolutos ou valores de conteúdo. Os mesmos bytes produzem o mesmo
manifesto em outro destino. `publicationApproved`, `privacyApproved` e
`rightsApproved` são sempre **false**.

`verifyContributorStage()` confere inventário completo, ausência de extras/links,
seleção exata e todos os hashes/bytes, inclusive schema/flags e formato determinístico
do manifesto. É verificação de integridade, **não auditor de candidatos**.
Comandos executados dentro da seleção criam seu próprio `tmp/`: isso deixa a
pasta de trabalho com extras e ela não deve ser confundida com o estágio intacto.
O workflow `--commands` remove somente seus próprios temporários e confere novamente.

## Comandos úteis dentro da seleção

Execute na pasta selecionada (ex.: `tmp/contributor-local-01`):

```sh
npm test
npm run check
npm run test:standalone-examples
npm run release:check
node scripts/serve-local.js
node scripts/stage-release.js --version 0.3.1 --output tmp/core-local-01 --target core
```

- `npm test`: o runner real registra as suítes; **quatorze integration skips** são
  esperados sem `../SPMIDDLE`. Falha local ou irmão presente/incompleto continua
  sendo falha. `runner.test.js` cria e executa seu child isolado atual, excluindo
  apenas a si próprio para evitar recursão; nenhuma transformação do runner aqui.
- `npm run check`: sintaxe de `src/tests/examples/scripts`, incluindo `.js/.mjs`,
  com raiz baseada no próprio script. Não avalia módulos, imports ou fixtures.
- Standalone: sete grupos Node com os módulos originais dos exemplos, sem
  navegador/TinyMCE real. Consulte `LOCAL-DEMO.md`.
- Servidor: loopback somente leitura, MIME explícito/no-store/nosniff. Demos em
  `/examples/index.html` e `/examples/admin.html`; nunca é host de produção.
  O teste usa apenas HTTP loopback, incluindo JS/CSS TinyMCE e bloqueio de docs/tmp;
  não abre navegador. No workspace, ações de navegador exigem FIORI-AUTO próprio.
- `stage-release --target core`: útil e autossuficiente. `all`/`site` e execução
  direta de `tests/release-stage.test.js` continuam **opcionais e dependentes do
  irmão real**; não devem ser anunciados como comandos contributor sem dependência.
  Nenhum script copia/instala automaticamente o irmão.
- `test:admin-layout`: opcional, depende do FIORI-AUTO/Windows/Edge fornecidos
  separadamente, não do irmão e não desta validação Node.

O teste está integrado ao runner; seu child isolado também copia os novos
scripts/documentos selecionados. A função exportada usa `commands: false` por
padrão para não recursar npm; a CLI direta também é focal por padrão, e somente
`node tests/contributor-stage.test.js --commands` executa o workflow completo. Nenhuma
falha local de import/integração instalada é convertida em skip.

## Gates ainda bloqueantes

1. Revisão manual dos candidatos do **manifest contributor completo**. O auditor
   agora aceita `contributor-local`, aplica limites/hashes e exige a seleção exata
   com inventário sem extras. Fixtures/regras/docs/vendor não são isentos. CLI 1
   significa candidatos encontrados, não falha técnica nem aprovação. O relatório
   não transcreve valores e nunca sanitiza fontes; zero candidatos também não
   certificaria privacidade/direitos. Não renomear o target para core.
2. Revisão das entradas/documentação/código selecionados e suas referências.
   A seleção evita copiar evidências/runbooks em bloco, mas preserva os candidatos
   atuais em fontes/testes/README/avisos. Não é autorização de divulgação.
3. TinyMCE e terceiros embutidos: origem autenticada, mapeamento dos avisos,
   licenças integrais/copyrights/modificações, escolha compatível de termos e
   fonte preferida correspondente/build/mecanismo GPL efetivo. Correspondência
   local/preservação de bytes não resolvem esses requisitos; Joomla/reutilização
   e marcas também seguem revisão. Ver `THIRD-PARTY-NOTICES.md` original.
4. Aceite real das demos/editor, zoom 200/400%, mídias reais e leitor de tela,
   com ferramentas/autorização próprias; MIME e Node não são aceite visual.
5. Índice/histórico/temporários/remoto do agregador: gate separado e autorizado,
   não lido, limpo ou reescrito por esta seleção. Não gerar ZIP/distribuição
   pública nem publicar com base neste inventário.

### Histórico — validação de 04/11/2026 (não baseline atual)

Execute `node tests/contributor-stage.test.js --commands` para reproduzir allowlist/hashes,
bytes vendor, destinação/imutabilidade/links/hardlinks, extras/tamper, CLI a partir
de outro cwd, npm test com child real, sintaxe/standalone/core e MIME loopback.
Execução direta concluída em **04/11/2026, Node 24.18.0**:

- Allowlist: **171 arquivos**, incluindo 33 vendor TinyMCE intactos; hashes/bytes
  determinísticos, extras (inclusive pasta vazia), tamper, flags e CLI aprovados.
- Contenção/links: três checks de junction aprovados; criação de symlink de
  arquivo pendente indisponível por permissão da plataforma. Hardlinks testados.
  O código recusa também links pendentes por `lstat`, mas esse caso específico
  não foi exercitado nesta máquina.
- Após integração do coordenador: `npm test` completo **44 passes, zero
  skips/falhas**; na seleção **36 passes, oito skips de integração, zero falhas**.
  Child real de `runner.test.js` passa 35 locais, excluindo somente a si próprio.
- `npm run check`: **137 JS**; todos os scripts selecionados conferidos à parte.
- Standalone: sete grupos offline aprovados; structure/core aprovados e
  `all`/`site` recusados pela ausência do irmão, como esperado.
- MIME/bytes reais das duas demos e TinyMCE JS/CSS aprovados por HTTP loopback,
  com no-store/nosniff; nova conferência independente de MIME também passou.
- Revisão independente identificou a ordem de leitura da seleção e o alias `TMP`
  da raiz no Windows. Ambos corrigidos: seleção exata antes de abrir arquivos e
  comparação de raízes por `relative`; regressões específicas e workflow completo
  reexecutados. Limites são aplicados antes de leitura/inventário, sem proteção
  absoluta contra alteração hostil concorrente do filesystem.
- Snapshot revisado antes deste fechamento documental: **171 arquivos /
  3.734.107 bytes**, **17 arquivos com 39 candidatos**, todos os hashes/inventário
  verificados. Categorias se sobrepõem; fixtures e regras não são segredos
  confirmados nem são isentos. Relatório retido apenas em tmp privado.

Tentativas anteriores incluíram timeout e falhas corrigidas do próprio teste;
o passe acima é a reexecução completa posterior, não a tentativa interrompida.
Esta frente não abriu navegador, usou serviço externo nem gerou ZIP/distribuição
pública. A auditoria contributor adicionada foi executada com hashes/inventário
verificados e candidatos encontrados, inclusive fixtures/regras. Não certifica
direitos/privacidade nem equivale às verificações separadas do host.
