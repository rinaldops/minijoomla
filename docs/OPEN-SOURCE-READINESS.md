# Preparação da distribuição open source

> Referência atual: [avaliação e escopo de 06/11/2026](AVALIACAO-E-ESCOPO-2026-11-06.md).
> MINIJOOMLA agora possui Git próprio e zero tmp rastreado na baseline. Números,
> remotos e versões antigos abaixo são históricos. Isso não certifica a
> privacidade do import atual, o histórico legado externo nem direitos de terceiros.
> A seleção técnica cresceu para 304 arquivos na avaliação; não é liberação pública.
>
> **Consolidação em andamento:** branches, código e evidências privadas são
> preservados antes da retirada de worktrees. Testes verdes e integração
> funcional não aprovam privacidade, origem/build/licenças de todos os
> terceiros ou divulgação pública. Ver a
> [avaliação da integração](AVALIACAO-INTEGRACAO-WORKTREES.md).

## Objetivo confirmado — 03/11/2026

MINIJOOMLA é um projeto independente inspirado no Joomla, destinado a um
repositório público para colaboração. Não é uma aplicação Petrobras. A
apresentação desejada volta ao padrão Joomla, em particular o painel Atum.
Temas Petrobras e implantação corporativa são trabalho futuro, não requisito
nem prioridade da distribuição inicial. A alternativa cromática administrativa
da rodada anterior foi rejeitada; não tratá-la como solução aceita.

Esta decisão não autoriza expor evidências, identificadores, dados ou histórico
corporativos. Também não autoriza uma nova publicação no SharePoint.

## Estado reconciliado — 04/11/2026

Esta é uma reconciliação documental do relatório agregado local e dos resultados
informados pelo coordenador, **sem nova execução de testes, leitura de fontes
em alteração ou verificação remota**. Os registros das rodadas abaixo são
históricos; não substituem a
[matriz atual do plano](PLANO-CONTINUIDADE-MINIJOOMLA.md#estado-atual-autoritativo--04112026).

| Frente | Situação reconciliada | Limite / próximo gate |
| --- | --- | --- |
| Host existente | Público **0.2.11** e administração **0.2.10 publicados/recarregados**, fonte `23f4696`, conforme coordenador | Só `src` público mudou no último incremento; admin/canvas/ETag preservados. 0.2.9 imutável/inativa; implantação não é distribuição OSS |
| Correção de imagens | Publicada no público 0.2.8; usuário informou teste positivo | Aceite informado distinto da fixture sintética e do artigo real sem imagens observado pelo agente; não é aceite visual integral |
| UI/consumidores | Main `23f4696` enviado, incluindo restauração JSON, standalone e preview; own-properties/grupos/contador ativos em 0.2.10 | Revisão independente aprovada para contratos históricos, oito tipos nativos/três defaults avançados e igualdade do corpo da função de renderização; não repara dados legados automaticamente |
| Regressão/host | **43 suítes passaram, zero skips/falhas / 136 JS** após conversão assistida; DOM local sete larguras | Novo incremento somente local, cliques programáticos/contraprovas; host 0.2.10/0.2.11 e TinyMCE testados anteriormente, sem revalidar produção para esta conversão |
| Execução independente | `bc64256`/`343bb58` incluídos no push `23f4696`; sete grupos Node isolados passaram, CAMAP sem `LIMIT`/warnings tolerados, dados/ETags preservados | Sem transformação dos módulos/sem irmão; oito integrações omitidas nesse isolamento. [LOCAL-DEMO.md](LOCAL-DEMO.md) não cobre TinyMCE real, DOM nativo ou snapshot contributor completo |
| Estágio core atual | **0.3.1 / 50 arquivos / 496.268 bytes / zero candidatos**, hashes verificados; CLI 0 | Gate manifest-only, não direitos/privacidade/release OSS. Core 0.3.0 (49/490.634/zero) e amostra 48/477.051/3 permanecem históricos |
| Índice local | Fechamento conferiu **436 rastreados**, **243 em tmp**, 193 fora de tmp | Contagem após conversão, não histórico/remoto; índices 432/189, 429/186, 425/182 e inventário inicial 400/categorias 53/121/21 históricos |
| Visual | Atum administrativo e Cassiopeia neutro público 0.2.11 publicados; CSS carregado/computado e sete larguras verificados | Zoom 200/400% não estabelecido nas tentativas; forced-colors/reduced-motion reais não conferidos, leitor de tela não investigado. Aceite visual/assistivo integral aberto |
| Licenças | GPL própria explícita; stage preserva MIT original SPMIDDLE e aviso original TinyMCE no all | Defeitos de cópia MIT/`notices.txt` superados localmente; fonte correspondente, licenças integrais/modificações, proveniência e reutilização/marcas permanecem bloqueantes |
| Privacidade/histórico | Neutralização `51a1b2a`: **3 → 0 nas fontes selecionadas**; novo core com zero candidatos nas assinaturas aplicadas | `publicDistributionApproved`, `rightsReviewed` e `privacyCertified`: **false**; revisão manual e 243 temporários rastreados/histórico permanecem pendentes |

**Incidente administrativo:** a ativação 0.2.9 publicou 15 arquivos e verificou
134 assets/dependências, mas o reload da rota real `#/moduleInstances` expôs a
perda do contrato `json` requerido pelo catálogo histórico da base 0.2.5.
O rollback restaurou **somente o src administrativo para 0.2.7**, com canvas/ETag
recém-lidos, MERGE específico, Publish e reload confirmando montagem única/rota
funcional. Público 0.2.8 e seu canvas/ETag ficaram iguais; nenhum dado foi editado.
A pasta 0.2.9 permanece histórica/imutável, não ativa nem aprovada. JSON,
`maxLength`, clone, URLs/hash e inputs nativos foram restaurados **localmente**;
a revisão independente final passou e **0.2.10 foi publicada**, fonte `23f4696`,
com 15 arquivos novos (14 JS/manifesto) e 119 dependências/134 assets totais
verificados por bytes/SHA-256/MIME. CSS 0.2.5 manteve o hash, editor 0.2.5,
agendamentos 0.2.6 e descoberta 0.2.7 foram preservados. A prévia usou snapshot
real do catálogo (11 registros de módulo/oito tipos nativos com sobreposições)
além dos checks sintéticos. Reload/rotas/editor passaram sete larguras, com
ETags de artigos/páginas e público 0.2.8 preservados. Não houve edição remota de
dados, criação de instância ou upload; não é aceite visual/assistivo integral. Detalhes no
[contrato 6.5](CONTRACTS-MINIJOOMLA.md#65-contadores-administrativos-e-parâmetros-declarativos-próprios).

**Publicação pública posterior:** 0.2.11, fonte `23f4696`, trocou somente `src`
0.2.8 → 0.2.11, preservando administração 0.2.10/canvas/ETag. Nove arquivos novos
(sete JS/CSS/manifesto), 248 dependências históricas/257 assets totais verificados
por bytes/SHA-256/MIME. Substituição de seis módulos do grafo real 0.2.8, não
atualização integral: sanitizador 0.2.8 com hash igual, quatro CSS CAMAP opcionais
e recursos absolutos 0.2.1/`import.meta` preservados. Configuração salva mantém
precedência sobre o fallback `camap` → `cassiopeia`, sem gravação. A pré-baseline
real 0.2.8 já montava Cassiopeia com CSS corporativo antigo; origem da mudança
externa de configuração desconhecida, não atribuir essa troca à publicação.
Prévia em sete larguras confirmou composição/catálogo reais, posições/aliases,
imagens e contraprovas sintéticas, lifecycle/DOM/hash e Enter/Escape nativos.
Reload confirmou montagem única, CSS neutro/cabeçalho computados, navegação e
artigo real sem alerta. ETags das duas páginas preservados durante checks, sem
gravação editorial/configuração/criação de módulo/upload. Rollback preparado só
restaura `src` público 0.2.8 com canvas/ETag atuais e MERGE específico, preservando
admin/outros webparts/assets; não foi executado. Detalhes no
[contrato público 6.6](CONTRACTS-MINIJOOMLA.md#66-público-neutro-cassiopeia--0211).

**Limite de acessibilidade atual:** `Control+Add` foi rejeitado; `Control+Equal`
manteve razão DPR 1, sem estabelecer zoom 200/400%. Tentativa falha não é aceite
nem demonstra indisponibilidade. Mídias reais não verificadas/leitor de tela não
investigado continuam gates, não recursos declarados indisponíveis.

**Próximos gates:** fechar a seleção contributor utilizável;
resolver direitos/fonte correspondente e privacidade/histórico; realizar aceites
visual/assistivo efetivos. A
[fila ativa do plano](PLANO-CONTINUIDADE-MINIJOOMLA.md#fila-ativa-delimitada)
concentra os próximos passos; as rodadas abaixo não são uma segunda fila atual.

**Atualização posterior do coordenador:** administração **0.2.12** publicada e
verificada após reload, fonte do pacote `eb423f7`/delta `7bc5b6e` sobre o grafo
real 0.2.10; cinco novos/134 dependências/139 assets. Catálogo/DOM/rotas/editor e
Tab/Enter da conversão passaram sete larguras sem dados remotos/migração/upload,
preservando público 0.2.11/editor/CSS. A chamada indevida de `apply` pelo revisor
somente leitura foi registrada; coordenador não repetiu escrita e verificou o
estado/reload. Ver [contrato 6.8](CONTRACTS-MINIJOOMLA.md#68-conversão-assistida-no-host--0212).

[Seleção contributor local](CONTRIBUTOR-SELECTION.md) agora existe: 171 arquivos
allowlisted, incluindo demos/testes/scripts/TinyMCE/avisos, sem irmão/evidências
ou runbooks em bloco. Manifesto/hashes/inventário integral e auditor sem isenção
de fixtures/regras implementados. **44 suítes completas passaram/zero skips/falhas,
sintaxe 137 JS**; seleção 36 passes/oito skips esperados, child 35 locais,
standalone/core e MIME aprovados. Candidatos encontrados, referências excluídas
e revisão manual pendentes. Não é distribuição pública aprovada; privacidade,
direitos/fonte-build/proveniência e aceites integrais continuam bloqueantes.

**Continuar até concluir** autoriza o trabalho dentro do escopo, não concede
direitos de terceiros, autorização de exposição corporativa ou remoção/reescrita
de histórico. Autorizações existentes devem ser usadas sem confirmação repetida;
decisões realmente ausentes e bloqueios efetivos continuam sendo requisitos.
Novos commits/push/publicação do incremento cabem ao coordenador após revisão
das fontes e evidência da publicação aplicável. Sem novas URLs, IDs ou conteúdo
corporativo.

## Separação necessária

- Usuário decidiu manter a pasta atual e informou que o remoto já está público.
  Não criar cópia externa, mover a pasta ou inicializar outro Git nesta rodada.
- A raiz Git atual é o agregador `web-devs`, não este projeto. `origin` aponta
  para `rinaldops/web-devs`. A visibilidade pública não foi comprovada:
  `gh --version` foi novamente executado neste fechamento e o comando não foi
  encontrado no PATH. A consulta HTTPS anterior falhou por cadeia de certificado.
  Não relaxar TLS para conferir. Falha de consulta não comprova remoto privado.
  Não tornar esse repositório público, reescrever histórico nem mudar origin.
- O usuário corrigiu `web-devs/AGENTS.md`, excluindo explicitamente MINIJOOMLA
  da identidade Petrobras obrigatória. O bloqueio visual foi resolvido sem
  mover o projeto. A alteração compartilhada é trabalho do usuário, não desta
  rodada, e não deve ser sobrescrita ou incluída em commit do projeto.
- Uma distribuição selecionada não deve carregar evidências ou histórico
  corporativo. Preservar a árvore atual e as publicações já existentes.

## Auditoria inicial local — histórico

Inventário somente leitura dos arquivos rastreados, sem guardar os valores
encontrados: **400 arquivos**, incluindo **243 em `tmp/`**. A regra `/tmp/`
no `.gitignore` não exclui arquivos já rastreados e não saneia o histórico.

A busca encontrou candidatos com endpoints corporativos em **53 arquivos**,
marca/contexto corporativo em **121**, e padrões de GUID em **21**. As categorias
se sobrepõem. GUIDs podem ser fixtures sintéticas; contagens não comprovam
segredos nem constituem aprovação de divulgação. Resultado local em
`tmp/sol-opensource-audit.json`, sem transcrição dos valores encontrados.

Fontes e testes também contêm candidatos, não apenas documentação. Entre os
arquivos a revisar estão `src/libraries/minijoomla/composition/createMiniJoomlaSharePointApp.js`,
`src/libraries/minijoomla/infrastructure/spmiddle-test-schemas.js`, `scripts/release-check.js`,
`tests/admin-app.test.js`, `tests/media-upload-service.test.js` e os documentos
de integração/publicação. Não copiar em bloco e limpar apenas o README.

## Critérios mínimos antes da publicação

1. **Código público selecionado:** sem configurações reais, evidências, perfis,
   releases corporativas, artefatos temporários ou histórico do agregador.
   Revisar também direitos sobre código, ativos e dependências de terceiros.
2. **Licença explícita:** usuário escolheu GPL-2.0-or-later. `LICENSE.md`, texto
   integral em `docs/licenses/GPL-2.0.txt` e campo `license` foram incluídos.
   Obrigações de terceiros continuam pendentes: conferir fonte correspondente
    do TinyMCE; a cópia MIT original ao redistribuir SPMIDDLE já é preservada
    pelo stage atual, sem encerrar a revisão de proveniência/direitos. Avisos e limites
   em `docs/THIRD-PARTY-NOTICES.md`. Não tratar escolha da licença como aprovação
   de divulgação de dados ou de direitos de terceiros.
3. **Clone autossuficiente:** demonstrações locais e testes do núcleo devem
   funcionar sem projetos irmãos ou feeds/autenticação corporativos. Separar
   testes opcionais de integrações sem esconder falhas do núcleo. Revisão
   independente identificou nove imports externos em sete arquivos; oito
   suítes dependem transitivamente de SPMIDDLE. Na auditoria inicial,
   `tests/run-tests.js` e `scripts/stage-release.js` exigiam esse projeto irmão,
   e o gate `scripts/release-check.js` estava preso ao runbook corporativo histórico.
   **Atualização de 04/11:** runner passou a separar explicitamente as oito
   suítes opcionais. Ausência do irmão não impede o núcleo; checkout incompleto
    ou import quebrado não é omitido. Target `core` tem **50 arquivos** no estágio
     atual 0.3.1 (49 no 0.3.0 e 48 na amostra anterior), sem SPMIDDLE ou runtime TinyMCE. É seleção de fontes,
    não distribuição contributor completa. `all`/`site` mantêm requisitos de integração.
   Gate estrutural agora usa versão do pacote/licença e não o runbook histórico;
    nenhum desses passes certifica distribuição pública. A cobertura posterior
     `bc64256`/`343bb58` executa os módulos dos exemplos sem transformá-los em
     isolamento (sete grupos Node, CAMAP sem warnings), sem fornecer runtime
     TinyMCE nem converter a fixture de teste em release. O runner registra
      43 suítes (35 locais/8 opcionais); os 34 passes do child excluem apenas
      `runner.test.js` para evitar recursão e incluem os exemplos standalone,
      não redefinindo o total local registrado.
4. **Visual Joomla:** recuperar apresentação sem restaurar arquivos inteiros
   antigos que descartem correções funcionais. Preservar foco, responsividade,
   três abas, upload/sync aguardados, bloqueio de `data:`/`blob:`, margens de
   imagem, ETags, parsing estrito e lifecycle. Identidade corporativa não será
   recolocada como estilo obrigatório na distribuição independente. **Painel
    restaurado e posteriormente publicado** à paleta/hierarquia Atum. Cassiopeia
    público neutro posteriormente publicado em 0.2.11, separado da correção de
    imagens 0.2.8. Aceite visual/assistivo integral continua aberto; suporte JSON
    genérico não implementa UI CAMAP `bandTones` nem conversão assistida legada.
5. **Entrada para contribuidores:** README autossuficiente, instruções de
   execução, contribuição, política de segurança, testes automatizados e
   backlog curto com limites explícitos. Não anunciar paridade Joomla/PHP.
6. **Limites de segurança:** não há ACL/autenticação própria. Demonstrações com
   dados sintéticos são locais; um painel acessível em rede exige autorização
   aplicada pelo backend/host. Não prometer CMS multiusuário pronto para produção.
7. **Release verificável:** suíte, staging, testes nativos editor/painel e
   acessibilidade proporcionais ao risco, com limites não verificados explícitos.
   Commit, push e tornar público são operações distintas, com destino conferido.

## Histórico — estado da rodada inicial

Objetivo e README corrigidos; inventário inicial e revisão independente
realizados; licença própria GPL-2.0-or-later incluída conforme decisão do usuário.
Painel restaurado ao Atum após a exceção explícita do usuário no AGENTS.md:
cores originais, estados, fundo claro, preferência Roboto local, círculos
internos e sombras discretas. Sem reverter editor/runtime ou reutilizar o
arquivo histórico completo. Contornos funcionais cinza600 e foco sólido são
adaptações acessíveis deliberadas; não há equivalência pixel a pixel.

Suíte Node, sintaxe de 119 JS, staging e gate histórico passaram. FIORI-AUTO
próprio verificou editor/upload/margens/ETags/módulos e painel em quatro
larguras, com dados sintéticos e CSS escopado (190 regras). Não foram aceitos
zoom real, mídia real de alto contraste/movimento reduzido ou leitor de tela.
Captura local disponível, mas não interpretada por esta sessão.

**Revisão histórica na página real, superada pelas publicações abaixo:** usuário
rejeitou a apresentação. O CSS publicado **então era 0.2.1**, não a versão Atum
local. Prévia temporária no
host confirmou defeitos de menu móvel sobre o chrome, erro vazio colorido,
herança tipográfica e editor esmagado a 26px em viewport 769px. Correções
locais testadas nessa mesma página: menu ancorado ao painel, 1rem/1.5, status
vazio invisível e container query de 50rem (editor 362px naquela largura).
Não basta testar ausência de overflow. Matriz de sete larguras e navegação/
abas/diálogo de imagens passaram; CSS escopado aceitou @container. Não houve
publicação nem aceite visual integral; seção SharePoint continua limitando
a largura. Prévia removida e CSS anterior restaurado no navegador.
Limites e evidências privadas estão no handoff, não distribuir tmp.

**Publicação posterior autorizada:** usuário pediu “publique”; o CSS
administrativo 0.2.2 foi publicado de forma incremental e imutável, trocando
somente seu href na página administrativa. Runtime/editor/site permanecem
0.2.1. Hash/MIME, canvases preservados, recarga e matriz de sete larguras do
publicado verificados. Sem gravação de conteúdo editorial, commit/push ou
migração. Isso não resolve os bloqueios de distribuição open source e não
autoriza expor evidências corporativas. Snapshot histórico 0.2.1 intacto;
detalhes, rollback e limites de acessibilidade/visão no handoff.

## Histórico — avanço autorizado em 04/11/2026

- **CSS administrativo 0.2.3 publicado**, somente href do estilo alterado.
  Runtime/editor permanecem 0.2.1; site público preservado. Corrige ações
  quebradas letra a letra e quickicons pequenos/empilhados. Hash/MIME/rollback,
  canvases, recarga e matrizes nativas de sete larguras verificados.
- Títulos como links de edição/cabeçalhos de linha e nomes acessíveis
  contextualizados implementados localmente. Escaping, URLs, navegação e
  layout testados com dados sintéticos; não publicados nesta atualização CSS.
- Guias para contribuição, política de segurança e backlog em `docs/` adicionados.
  Nenhum canal privado de contato é fingido e ausência de ACL segue explícita.
- Servidor demonstrativo loopback/somente leitura permite exemplos sem instalação
  de pacotes; não serve artefatos privados/Git/documentação. Testes verificam MIME,
  caminhos, métodos e HEAD. Não é servidor de produção nem controle de acesso.
- Núcleo, regressão do runner e staging core executados em cópia isolada sem
  projeto irmão. A árvore de trabalho não foi movida, histórico não foi
  reescrito, dados rastreados não foram removidos e nenhum push ocorreu.
- **Pendências naquele momento (parcialmente superadas abaixo):** neutralização do template público, direitos/proveniência
  e fonte correspondente dos terceiros distribuídos, revisão dos candidatos
  corporativos/arquivos rastreados/histórico, aceite visual integral, zoom real,
   mídias reais de acessibilidade e leitor de tela. Links de edição novos
   precisavam de release própria e indicadores ainda precisavam revisão
   **naquele momento**; os incrementos posteriores superaram essas duas pendências.

## Histórico — incremento publicado e avanço seguinte — 04/11/2026

- Usuário reiterou **“publique e prossiga para os próximos passos”**.
  Incremento administrativo **0.2.4 publicado**, somente script src alterado:
  títulos-links, cabeçalhos de linha e nomes acessíveis contextualizados.
  Editor/serviços base0.2.1 e CSS0.2.3 preservados; site público intacto.
  Quatro novos arquivos/16 dependências históricas verificados por hash/MIME;
  recarga, título→registro correto, matrizes de sete larguras e funcionalidades
  passaram. Não é release completa, publicação OSS ou commit/push.
- **Cassiopeia público neutralizado localmente**, CSS/default.js com rótulos
  neutros, valores persistidos iguais. FIORI-AUTO testou demo/fixture em quatro
  larguras, paleta/fonte, menu/Escape, foco skip, laterais e margens de imagem.
   Não publicado e sem equivalência visual integral; CAMAP seguia inalterado
   naquela rodada. A neutralização posterior `51a1b2a` está entregue nas fontes
   selecionadas, seguida pelo core 0.3.0 auditado com zero candidatos;
   prevalece a tabela atual, sem aprovação de privacidade/direitos.
- Auditor offline manifest-only integrado ao runner. Novo `core` de48 arquivos
  passou integridade mas ainda tem **três candidatos em três arquivos**:
  `app/administrator/components/com_minijoomla/editor.js` e `app/templates/camap.js` (corporate-path),
  `app/templates/camap.css` (corporate-context). Gate retorna1, sem valores;
  revisar propósito/autenticidade em vez de apagar ou esconder os candidatos.
  Neutralização de default eliminou candidatos desse template no novo staging.
- Contagem somente leitura daquele momento confirmou **243 arquivos tmp rastreados**.
  Nenhuma exclusão/reescrita feita; histórico e ativos/terceiros continuam
  impedindo declarar a árvore inteira pronta para divulgação.
- Guias [PUBLIC-TEMPLATE.md](PUBLIC-TEMPLATE.md) e
  [DISTRIBUTION-AUDIT.md](DISTRIBUTION-AUDIT.md) registram limites. Licença
  própria/terceiros não certificada pelo gate; TinyMCE/fonte correspondente,
   revisão de direitos das integrações SPMIDDLE e de inspiração seguem pendentes;
   a preservação da licença MIT no staging foi corrigida posteriormente.

### Histórico — retomada após restart: testes duráveis e avisos preservados

- Sem repetir a publicação0.2.4, tocar tenant ou reiniciar automações antigas.
  Comando [nativo/local de layout](ADMIN-LAYOUT-TESTS.md) permanente, instância
  FIORI-AUTO própria, memória, sete larguras e duas contraprovas passou; npm test
  cobre seus contratos sem executar browser.36 suítes passaram, sintaxe126 JS.
- Integrações `all`/`site` agora incluem a licença MIT SPMIDDLE completa/original,
  copyright/disclaimer/hash, e os avisos próprios. Falta/truncamento/junction
  bloqueiam estágio. Novos testes offline48/54/109 arquivos passaram; não
  atualizar releases antigas. Preservação MIT está corrigida, direitos gerais não.
-32/32 arquivos TinyMCE iguais ao arquivo local não comprovam upstream/source
  completa. Avisos internos DOMPurify/PrismJS/prism-themes precisam materiais
   originais e revisão de compatibilidade; a ausência do notices.txt original
   foi registrada naquele subset, sem revalidar a fonte em alteração aqui.
- Naquela revisão, três candidatos foram classificados manualmente, mas nenhum
   foi removido, mascarado ou liberado **naquela rodada**. A neutralização posterior
   `51a1b2a` não altera esse estágio histórico; o novo 0.3.0 auditado com zero
   candidatos está na tabela atual, sem certificar divulgação.
   Privacidade/história/distribuição seguem
  bloqueadas; [third-party notices](THIRD-PARTY-NOTICES.md) detalham o review.
