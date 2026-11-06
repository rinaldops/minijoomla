# Avaliação e escopo de continuidade — 06/11/2026

## Decisão e uso deste relatório

**Diretriz adicional do responsável, recebida durante a execução:** aproximar
ao máximo arquitetura, nomenclatura e funcionalidades do Joomla original.
Não recuperar soluções descartadas por outras equipes; conferir contratos de
persistência atuais MINIJOOMLA/SPMIDDLE antes de provisionar. Listas de teste
antigas pertencentes ao desenvolvimento inicial devem ser substituídas pelo
modelo vigente, com dados de instalação de referência Joomla, não fixtures
inventadas como seed definitivo. A republicação corporativa foi solicitada
expressamente; o site pessoal não é evidência de publicação no destino corporativo.
Destino e evidências reais permanecem em tmp privado, nunca neste relatório.

Essa autorização posterior substitui a restrição local inicial de publicação
nesta rodada: exige inventário/backup, escopo exato das listas, provisionamento
verificado e nova release imutável/rollback antes de remover recursos antigos.
Não autoriza apagar outras listas pelo prefixo, histórico Git ou versões publicadas.

Referência da avaliação solicitada após a integração de trabalhos de outras
equipes e a vinculação do projeto ao repositório próprio. O escopo aprovado
nesta conversa prevalece sobre filas e checklists históricos. O
[plano de continuidade](PLANO-CONTINUIDADE-MINIJOOMLA.md) acompanha a execução;
este relatório conserva a baseline e os critérios, sem transformar trabalho
planejado em funcionalidade concluída.

**Incluído expressamente pelo responsável pelo projeto:**

- Preparar a adoção dos outros dez módulos externos, após o piloto.
- Ampliar descoberta XML para plugins e templates, com contratos próprios.
- Definir migração assistida de registros JSON para XML e de parâmetros
  incompatíveis, com prévia, confirmação e recuperação verificável.

**Fora do escopo da solução neste momento:** i18n; SEO integrado ao host;
histórico de alterações do artigo; check-in/check-out do artigo. Essas exclusões
não removem campos/metadados existentes nem confundem histórico editorial com
rollback de revisão de extensão. Transportar metadados públicos existentes,
ETags e reversão de extensões continua no escopo.

ACL própria, PHP, SQL, instalador genérico ZIP e novos componentes Joomla não
são requisitos implícitos deste fechamento. Atum/Cassiopeia continuam a direção
padrão; temas corporativos são opcionais. Não implementar identidade opcional
como default nem ampliar automaticamente o escopo de outro projeto.

## 1. Baseline examinada

- Git próprio `rinaldops/minijoomla`, branch `main`, árvore inicialmente limpa.
- HEAD de importação `0bd5de1`: um único commit alcançável na avaliação;
  hashes do agregador citados nos documentos não são checkpoints deste histórico.
- **335 arquivos rastreados, zero em `tmp/`**. O registro antigo de 243
  temporários rastreados refere-se ao agregador anterior, não ao índice atual.
- Avaliação do código, documentação, testes e staging local; sem acesso ao
  SharePoint, fetch, publicação, migração de dados ou reescrita de histórico.
- A documentação registra a **0.6.0 publicada**, runtime `e869f3c`, 202 arquivos
  e piloto XML 0.1.1 disponível para Registrar. Isso é evidência anterior,
  **não verificação remota nesta avaliação**. Há integrações locais posteriores
  ainda descritas como não publicadas.

### Verificação executada na avaliação

| Verificação | Resultado observado | Limite |
| --- | --- | --- |
| `npm run check` | 244 arquivos JS aprovados | O comando da baseline exclui scripts; não prova imports nem navegador |
| Sintaxe separada do tooling | 10 scripts JS/MJS aprovados | Complemento manual, não cobertura do comando padrão |
| `npm test`, primeira execução | 71 passes, zero skips, uma falha | `runner.test.js`: cleanup do auditor no checkout isolado lançou `ENOTEMPTY` |
| `npm test`, segunda execução | Sem conclusão | Runner passou; sequência excedeu 900 s durante a suíte contributor; não contar como passe |
| Execução delimitada | 70 passes, zero skips/falhas | Excluídos explicitamente somente runner e contributor; não substituir o comando completo |
| Contributor separado, modo padrão | Passou; 304 arquivos / 4.234.501 bytes | Allowlist/hashes/inventário; workflow npm aninhado não reexecutado nesse comando |
| Staging/auditoria core atual | 143 arquivos, hashes verificados | Parser e seus dois avisos classificados incorretamente como `outside-core-scope` |

As contagens são fotografias da baseline, não metas fixas. Resultados anteriores
de 72/0/0 são históricos; a execução completa não ficou verde nesta avaliação.
Falhas/timeout não são convertidos em skips nem em aceite.

## 2. Implementado: não reabrir como ausência funcional

- Diretórios Joomla na fonte e na release, sem prefixo `app/`.
- CRUD administrativo, filtros, ordenação, lote, lixeira e duplicação.
- Editor com imagens/links, metadados, agenda, readmore, sincronização de uploads,
  preservação de opções desconhecidas e ETags.
- Views por componente e alguns modelos/controllers já separados; shell Atum.
- Descoberta XML de módulos de site com parser real e limites, instalação
  desabilitada, integridade por pacote aprovado, upgrade/rollback com ETag.
- Troca de JS/CSS pela revisão instalada, deduplicação e cleanup.
- Plugins nativos/persistidos no público, parâmetros/ordem e lifecycle.
- Hooks de gravação de artigos implementados/testados mediante injeção;
  transformação/veto antes e isolamento da observação após persistência.
- Geração dos 15 manifestos XML nativos de módulos pelo catálogo.
- Seleção contributor local, allowlist exata e inventário completo.
- Submissão única e proteção de callbacks de telas abandonadas.
- Verificador editorial heurístico e validação de bytes/MIME/limite de upload.

## 3. Backlog de implementação e critérios de fechamento

| ID | Prioridade e entrega | Critério de fechamento | Dependências / limites |
| --- | --- | --- | --- |
| T1 | Alta — alinhar auditor e core | Parser/avisos exatos autorizados; vendor arbitrário continua recusado; assinaturas continuam examinando todos os arquivos; teste do core real | Não criar whitelist de dados nem aprovação jurídica |
| T2 | Alta — estabilizar testes e cobertura | Cleanup limitado a temporários da suíte, tentativas finitas; ausência de recursão/hang; `npm test` completo concluído; scripts JS/MJS no check | Falha de import/irmão parcial/assertion continua falhando |
| F1 | Alta — opções de consultas | `content.listLimit/orderBy`, `search.resultsLimit/searchPhrases` alteram consultas/total/páginas após save/releitura; precedência de rota documentada; Fake/SPMiddle concordam | Não implementar índice Finder, i18n ou SEO do host |
| F2 | Alta — metadados no adapter público | `metaDescription/metaKeywords` sobrevivem ao mapeamento; related-items funciona somente com keywords | Transportar campos existentes, não emitir `<meta>` no host |
| F3 | Alta — plugins administrativos | Manager próprio, plugins habilitados reconciliados, params/ordem/revisão, init/finalize e save com veto/ETag; host conecta sem compartilhar manager público | Catálogo inválido/indisponível não pode virar sucesso vazio |
| A1 | Média — modularização administrativa | Consultas/ações/bindings nos controllers por componente; shell/router comuns, mesmas rotas/HTML/ETags/guardas | Não refazer views extraídas nem regressar editor |
| X1 | Média — manifestos nativos restantes | Plugins/templates/componentes com descritores coerentes, versão/arquivos/posições/params por target | Módulos já gerados; geração não implica discovery de novos tipos |
| D1 | Média — documentação atual | Entrada única de fila; Git/contagens atuais; hooks implementados vs conexão; limites de publicação | Preservar histórico identificado, não distribuir runbooks em bloco |
| X2 | Incluído — adoção dos outros dez módulos | Inventário por módulo, pacote novo, XML/JS/CSS/hashes/imports, mesma key/settings, ensaio isolado e gates individuais | Piloto real aprovado antes de instalar/migrar; sem alterar CAMAP2 nesta rodada |
| X3 | Incluído — XML plugins | Contrato de identidade/grupo/client/eventos/params, discovery sem import, pacote aprovado, registro desabilitado, revisão/remoção/lifecycle testados | Não tratar um módulo como plugin nem executar provider PHP |
| X4 | Incluído — XML templates | `templateDetails.xml`, client, posições/params/assets, catálogo/default/estilos e lifecycle próprios | Não alterar default ao descobrir/instalar; manter dados/aliases |
| X5 | Incluído — migração assistida | Comparação exata/recusas, plano e snapshots, mapeamento explícito, ETags de todos os envolvidos, diário/retomada/rollback | Sem transação cross-list; nenhuma conversão automática de JSON legado |

### Evidências de código da baseline

- F1: `src/libraries/minijoomla/application/component-options.js:31–37`,
  `src/libraries/minijoomla/index.js:194–202,238–245`,
  `src/libraries/minijoomla/application/content-service.js:14–18,64`.
- F2: `src/libraries/minijoomla/infrastructure/spmiddle-repositories.js:59–60`,
  `src/libraries/minijoomla/infrastructure/spmiddle-adapter.js:47–58`,
  `src/libraries/minijoomla/modules/module-helpers.js:23–32`.
- F3: `src/libraries/minijoomla/composition/createMiniJoomlaAdminApp.js:42–45`,
  `host-adapters/modern-script-editor/host.js:69–93`,
  `src/libraries/minijoomla/application/admin-service.js:499–524`.
- A1: `src/administrator/components/com_minijoomla/app.js`, `content-pages.js`
  e `extension-pages.js`; views já estão nas pastas dos componentes.
- X1/T1: `scripts/module-manifests.js`, `scripts/stage-release.js:298–338`,
  `scripts/audit-distribution.js:72–78`.
- X3/X4/X5: `src/libraries/minijoomla/application/joomla-manifest.js`,
  `joomla-discovery.js`, `joomla-extension-installer.js` e
  [contrato atual de extensões](EXTENSOES-JOOMLA.md).

Linhas referem-se à baseline e podem mudar no desenvolvimento.

## 4. Filas separadas de implementação

### Aceite e publicação

1. Confirmar o estado efetivo do host antes de qualquer nova ação remota.
2. Piloto XML: registrar/reler desabilitado; habilitar/configurar/publicar;
   conferir render/CSS, editar/dados inválidos/ETag, desabilitar/reativar,
   atualizar/reverter e guarda de remoção com instância associada.
3. Identificar o delta local exato frente à 0.6.0, pacote novo imutável,
   releitura independente de hashes/MIME/CSP/cache/canvas e rollback seletivo.
4. Validar layout atual, zoom real 200%/400%, forced-colors/reduced-motion,
   teclado/leitor de tela e upload/save editorial realmente observados.

Nenhuma dessas etapas é comprovada por Node, mocks, DOM/screenshot isolado ou
apenas deploy. Navegador somente via FIORI-AUTO, em instância própria. Este
pedido inicia desenvolvimento/documentação local; não executa migração ou
publicação remota, limpeza de dados nem relaxamento de constraints.

### Distribuição e direitos

- Revisão privada dos candidatos no repositório completo e no recorte contributor.
- Proveniência/licenças/fonte-build do TinyMCE e componentes embutidos,
  parser ISC, SPMIDDLE quando incluído e reutilizações/adaptações Joomla/marcas.
- Revisar links para documentos excluídos do contributor sem copiar runbooks
  indiscriminadamente. Zero tmp rastreado não certifica privacidade.
- Não publicar relatório de valores/cookies/identificadores nem reescrever
  histórico ou mudar visibilidade como efeito desta etapa.

## 5. Ordem de execução e responsabilidade

Primeira rodada em arquivos exclusivos: **tooling (T1/T2)**, **consultas e
metadados (F1/F2)** e **plugins administrativos (F3)** em paralelo. Coordenador
registra relatório/plano, contratos X2–X5 e integra registros de suites/allowlist.
Revisão e execução completa ocorrem após integrar as frentes, não durante
alterações concorrentes do mesmo arquivo.

Depois: A1/X1, aceite do piloto e preparação X2; X3/X4 com contratos separados;
X5 começa por prévia pura e recusas, avançando para gravação somente com
recuperação e concorrência comprovadas. Não marcar o plano completo porque uma
rodada local passou. O histórico de execução fica no plano, com limites reais.
