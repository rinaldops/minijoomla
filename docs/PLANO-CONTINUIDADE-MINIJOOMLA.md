# Plano de continuidade — MINIJOOMLA

> **Estado vigente — Topsections (08/11/2026):** 0.15.0 ativa/publicada nas duas
> páginas, Topsections 0.3.0 em `bottom-a`, itemLimit 2, oito raízes aprovadas.
> Ciclo desenvolvimento/site/análise/validação/documentação executado; 243 assets,
> 87 suítes aprovadas, 48 itens totais e os 46 anteriores/ETags intactos.
> [Resultado e limites](CICLO-TOPSECTIONS.md). Sete módulos restantes; próximo gate
> [capacidade das raízes](CAPACIDADE-RAIZES-XML.md), antes de consumir últimas vagas.
> XML plugins/templates, migração assistida e aceites integrais continuam pendentes.

> **Estado vigente — ciclo Highlights (08/11/2026):** 0.14.0 ativa nas duas
> páginas publicadas, Highlights 0.3.0/horizontal em `top-a`, seis raízes aprovadas.
> Ciclo **Desenvolvimento → Teste no site → Análise → Validação → Documentação**
> executado com correções/contraprovas; 243 assets, 86 suítes aprovadas, 46 itens
> totais e os 44 anteriores/ETags preservados. [Resultado/limites](CICLO-HIGHLIGHTS.md).
> Próximo ciclo individual: Topsections. Oito módulos, XML plugins/templates e
> migração assistida pendentes. Histórico anterior abaixo não substitui o estado vigente.

> **Estado vigente — etapa 2C (07/11/2026):** 0.13.0 ativa nas duas páginas
> publicadas, foco corrigido/aceito na 0.12.0 e editorial externo 0.3.0 adotado
> individualmente com pacote corrigido e avisos MIT/GPL. Registrar pelo diálogo
> real, instância/edit/toggles pelo painel e revisões pelo serviço comprovados.
> Os 42 itens anteriores/ETags intactos, 44 totais; 243 assets/85 suítes aprovadas.
> [Evidências/fila restante](ETAPA-2C-EDITORIAL-ADOTADO.md).
> Nove módulos, XML plugins/templates e migração assistida seguem pendentes.
> Não alterar pacotes/fontes externos ou dados automaticamente. Histórico abaixo.

> **Estado vigente — etapa 2B (07/11/2026):** 0.11.0 ativa, ambas páginas
> publicadas/sem checkout; rascunho conciliado por histórico de restauração e
> conteúdo, sem regravar canvas. Confirmação modal real e Cancelar/Escape,
> upgrade/rollback/Enter, conflito visível e toggles aceitos pelo painel.
> 243 assets, 84 suítes/zero skips/falhas, 40 registros originais/ETags intactos
> e 42 itens totais. [Evidências e próximos gates](ETAPA-2B-CONFIRMACAO-E-ACEITE-XML.md).
> Dez módulos permanecem preparados, **não instalados**: [bloqueios por módulo](MATRIZ-ADOPTION-MODULOS.md).
> Cadastro inicial pelo diálogo novo e aceites integrais continuam pendentes;
> hardening posterior de foco corrigido localmente, ainda não na 0.11.0.
> não reinstalar amostra/piloto para testá-los. Blocos anteriores são histórico.

> **Estado autoritativo — etapa 2:** 0.10.0 ativada/relida, 242 assets;
> piloto XML 0.2.0/0.2.1 com instalação desabilitada, instância/edit via UI,
> ETag 412, upgrade/rollback, enable/disable e remoção protegida exercitados.
> Os 40 registros originais/ETags intactos, dois registros novos do piloto.
> Dez módulos preparados individualmente, **não instalados**. Fonte isolada
> `feat/joomla-finalization-step2`, sem merge na principal suja.
> **Bloqueios:** confirmação nativa e ciclo integral de UI não aceitos; pública
> tornou-se rascunho após ativação com ETag nova/canvas idêntico, não republicada
> automaticamente. Administrador publicado. [Resultado e próximos gates](ETAPA-2-PILOTO-XML.md).
> Concluir esses gates antes da adoção real dos dez; depois perfis XML próprios
> de plugins/templates e migração assistida. Blocos anteriores abaixo são histórico.

> **Atualização autoritativa — etapa 1:** 0.9.0 publicada nas duas páginas,
> fonte `34f0a6e`, 241 assets/79 suítes e 40 registros/ETags preservados.
> Correção Folder, opções de consulta e Sample Data no painel; installed
> reconhecido sem novas escritas. [Publicação e limites](ETAPA-1-SAMPLE-DATA.md).
> Desenvolvimento isolado na branch `feat/joomla-finalization-step1`, sem
> absorver patches antigos da árvore principal. Próxima frente funcional:
> ciclo completo do piloto XML e preparação dos outros dez módulos, depois
> plugins/templates XML e migração assistida. Aceites reais ainda descritos
> como abertos no contrato não são fechados pelo deploy.

> **População posterior autorizada:** funcionamento confirmado pelo responsável,
> commit/push `57ef821` e carga fonte Joomla original sobre listas vazias da 0.8.0.
> 40 registros/12 imagens, 101 verificações de releitura aprovadas; frontpage e
> formulário de artigo conferidos. [Registro vigente](JOOMLA-SAMPLE-DATA-2026-11-06.md).
> Sem restauração de dados antigos. Colisão REST `Folder` contornada nesta carga
> mantendo group no manifesto; fluxo genérico e instalador Sample Data do painel
> continuam pendentes. Estados de listas vazias abaixo descrevem o reset anterior.

> **Estado que prevalece — republicação limpa posterior:** 0.8.0 corporativa,
> baseada na importação `0bd5de1` (não nos patches 0.7.0), oito listas novas
> vazias, hh-web excluído, somente release 0.8.0. 79 itens reciclados/16 listas
> excluídas antes da recriação. [Registro autoritativo](REPUBLICACAO-LIMPA-2026-11-06.md).
> Rodada 0.7.0 abaixo foi rejeitada/substituída. Seus dados não foram restaurados;
> deltas de fonte locais ficam preservados, **não publicados na 0.8.0**.

> **Verificação posterior do SPMIDDLE 0.2.0:** atualização aditiva de distribuição/
> layout MSE, sem alteração nos 11 módulos de dados incorporados à 0.8.0.
> Testes focalizados e 16 checks reais do painel passaram, sem escrita/publicação.
> Nenhum ajuste obrigatório identificado; adoção de Contained/FullBleed é
> integração opcional separada. [Relatório](COMPATIBILIDADE-SPMIDDLE-0.2.0.md).

## Escopo vigente — 06/11/2026

**Steering posterior do responsável:** aderência máxima à arquitetura,
nomenclatura e funcionalidades Joomla; conferir persistência/contratos atuais
SPMIDDLE e usar dados de instalação Joomla. Substituição de listas antigas de
teste do MINIJOOMLA e republicação integral no destino corporativo foram
autorizadas após o início local. Não assumir que a 0.6.0 pessoal esteja no
destino corporativo. Inventário/backup/ETags/configuração ficam em tmp privado;
remover apenas listas identificadas, sem wildcard amplo ou apagar releases.
Esta decisão posterior prevalece sobre as restrições locais de publicação abaixo.

O [relatório de avaliação e escopo](AVALIACAO-E-ESCOPO-2026-11-06.md) registra
a baseline atual e os critérios de fechamento e **prevalece sobre filas
históricas abaixo**. Git próprio `rinaldops/minijoomla`, import `0bd5de1`,
335 arquivos rastreados/zero tmp na baseline. A 0.6.0 é a última publicação
documentada, não revalidada nesta retomada; deltas locais não são deploy.

**Incluídos expressamente:** adoção dos outros dez módulos externos após o
piloto; descoberta XML de plugins/templates com contratos próprios; migração
assistida JSON → XML e de parâmetros incompatíveis. **Fora do escopo agora:**
i18n, SEO integrado ao host, histórico de alterações do artigo e
check-in/check-out do artigo. Preservar dados/campos existentes; rollback de
extensão e ETags continuam incluídos. Temas corporativos permanecem opcionais.

Execução local inicial em paralelo: T1/T2 tooling, F1/F2 opções de consulta e
metadados públicos, F3 conexão de plugins administrativos; coordenador integra
documentos/testes/seleção e define contratos X2–X5. A1/X1 modularização e demais
manifestos seguem após estabilização; aceites e publicação são filas separadas.
Nenhuma migração automática, escrita no tenant ou publicação nesta rodada.

**Baseline de testes reavaliada:** sintaxe 244 JS e 10 scripts separadamente;
70 suítes delimitadas aprovadas, contributor padrão separado aprovado
(304 arquivos/4.234.501 bytes). `npm test` completo falhou inicialmente no
cleanup isolado (`ENOTEMPTY`) e depois excedeu 900 s; não é 72/0/0 atual.
Core 143 arquivos com hashes aprovados, mas auditor ainda rejeita os três
arquivos legítimos do parser. Correções em desenvolvimento; conclusão só
registrada com nova execução posterior à integração.

### Execução desta rodada — estado local

| ID | Entrega / estado | Próximo gate |
| --- | --- | --- |
| D1 | Relatório completo e critérios registrados; README/backlog/planos identificam históricos | Conferir links e manter resultados da integração abaixo |
| T1 | Auditor alinhado aos três arquivos exatos do parser; core real conferido, sem `outside-core-scope` | Candidatos remanescentes continuam bloqueantes de revisão, não aprovação pública |
| T2 | Check inclui scripts JS/MJS; cleanup limitado e negativos runner focalizados, sem perder standalone completo | Nova execução integrada e workflow contributor; não inferir eliminação de toda instabilidade Windows |
| F1/F2 | Consultas/limites/ordem/matching e metadados implementados; revisão independente/focais aprovados | Regressão integrada; aceite no host separado |
| F3 | Runtime administrativo próprio e host conectados; snapshot por gravação, observers isolados e composição parcial corrigidos/revisados; suíte focal aprovada | Regressão integrada e aceites do host; nenhum save remoto executado |
| X2 | Onze keys/elementos e gates individuais inventariados; dez futuros incluídos, limites de forum/videoteca/documentation registrados | Pacotes por módulo e aceite piloto; nenhum módulo externo migrado |
| X3/X4 | Contratos próprios de plugins/templates documentados | Implementar parser/discovery/inventário/lifecycle específicos; nenhum novo perfil liberado |
| X5 | Prévia pura de módulos implementada e revisada, snapshots/ETags/mapeamentos/defaults/recusas, sem executor | UI/diário/recuperação/concorrência do futuro executor; nada aplicado remotamente |
| A1/X1 | Separação de controllers e manifestos nativos restantes seguem pendentes | Após estabilizar recursos existentes |

As decisões de exclusão acima continuam valendo. Prévia `ready` não é pacote
aprovado, completude remota comprovada ou migração realizada. As publicações
históricas não foram reexecutadas. Ver [contratos XML](CONTRATOS-EVOLUCAO-XML.md).

### Fechamento da rodada e republicação corporativa

**Diretriz Joomla mantida:** contratos canônicos de oito domínios e tradução
SharePoint explícita, sem restaurar overlays/hosts históricos. `Author0: Text`
declarado deliberadamente para evitar colisão com `Author` de sistema; campos
excluídos de funcionalidades novas continuam preservados no schema. SPMIDDLE
atual integrado ao pacote, sem editar o projeto irmão nesta rodada.

- **Regressão final integrada:** 77 suítes aprovadas, zero skips/falhas;
  child standalone 65 locais/11 skips esperados, cerca de 248 s. Timeout antigo
  de 240 s era inferior ao custo observado: orçamento completo agora 600 s,
  negativos 60 s, duração por fase registrada. Falhas/timeouts anteriores ficam
  como histórico, não passes. Checker final inclui scripts JS/MJS; **261 arquivos
  aprovados**, incluindo a nova suíte de provisionamento.
- **Estrutura corporativa:** sete listas canônicas novas provisionadas com
  releitura de tipo/required/Choices/defaults/índices; catálogo de templates
  existente preservado sem alterar seus constraints. Lista de templates
  preservada não foi certificada como schema integralmente novo.
- **0.7.0 integral publicada** nas duas páginas MINIJOOMLA do destino
  corporativo autorizado. 222 arquivos/3.221.714 bytes, host/loader/CSS cobertos
  por manifesto operacional e hashes congelados; releitura independente de
  bytes/SHA-256/MIME concluída. O pacote representa snapshot de fontes locais
  integradas, não apenas HEAD de importação. Nenhuma release antiga sobrescrita.
- Timeout inicial ocorreu somente na fase de pastas; inventário confirmou zero
  arquivos antes da continuação única controlada, sem repetir assets/deploy.
- Prévia via FIORI-AUTO em sete larguras passou rotas/contratos sobre novas
  listas sem gravar na prévia. Ativação usou canvas/ETags atuais, patch seletivo
  de `script/scriptCode`, preservando outras propriedades/webparts; comparação
  semântica e estados publicados/sem checkout conferidos. Atomicidade Publish
  continua não comprovada. Rollback preparado, não executado.
- Reload: uma raiz por app, 84/94 recursos no admin/público, sem HTTP >=400 ou
  releases antigas na janela observada. Auditoria efetiva corrigida confirmou
  editor TinyMCE único, abas, cleanup, seis módulos e configuração. Primeira
  fixture consultava API TinyMCE antiga/aguardava rota insuficientemente;
  contraprova diagnóstica e reexecução corrigida passaram, sem alterar runtime.
- **Joomla Blog Sample Data**, subconjunto suportado: 11 artigos, quatro
  categorias, quatro tags (quarta filha da terceira), oito menus, seis instâncias
  e configuração. Fonte/INI Joomla fixados, IDs materializados pelos creates.
  Textos/referências relidos; string vazia em campo Note retorna null no
  SharePoint, sem perda de conteúdo. Verificação inicial estrita e leitor local
  com encoding implícito falharam; UTF-8 explícito/semântica vazio-null passaram
  sem regravar o seed. Mídia NASA/banner pendente de origem/licença/publicação;
  não é instalação integral do sampledata nem novo suporte a workflow/ACL.
- **Retirada de legado não concluída:** oito listas iniciais identificadas e
  backup privado de 44 itens/zero anexos, sem sobreposição com novos IDs ativos.
  Tentativa recuperável de reciclagem retornou HTTP 500; releitura confirmou
  oito listas/44 itens ainda presentes. Não executar DELETE permanente ou retry
  cego. Após resolver o bloqueio, restaurar listas pelos recibos da lixeira antes
  de reativar pointers históricos, se rollback for necessário.

Configuração, GUIDs, snapshots, dados, portas e recibos corporativos somente em
`tmp/joomla-corporate-20261106/` ignorado; seed genérico/evidências em tmp próprio.
Nenhum push de evidências, limpeza de Git ou mudança de visibilidade. Pendências
ativas: retirada segura das oito listas, mídia/aceites reais, outros dez módulos,
XML plugins/templates, UI/executor assistido, controllers/manifestos restantes
e gates de privacidade/direitos. Esta rodada não conclui integralmente o plano.

> Registro histórico desta frente (worktree03): **0.6.0 publicada** no SharePoint
> pessoal, com piloto XML corpmessage 0.1.1 pronto para Registrar. Ver
> [publicacao e limites de aceite](PUBLICACAO-JOOMLA-XML-0.6.0.md).
> Referencias anteriores a 0.5.1 abaixo ficam como historico; melhorias locais
> de outras worktrees nao foram integradas automaticamente.

**Atualizado em 05/11/2026:** plano ainda não integralmente concluído. A matriz
e a fila ativa abaixo prevalecem sobre checklists e versões históricos.

## Estado atual autoritativo — 05/11/2026

Este bloco prevalece sobre a matriz de 04/11 abaixo, que fica como histórico.

- **Publicado:** produção pessoal em `https://rinaldops.sharepoint.com/sites/camap-agp`,
  release **0.6.0**, runtime `e869f3c`, **202 arquivos**, conforme
  `PUBLICACAO-JOOMLA-XML-0.6.0.md`; integrações locais posteriores não publicadas.
  Aceite de instalação/habilitação/instâncias/upgrade/rollback do piloto continua
  pendente; smoke não equivale a escrita editorial nem aceite assistivo.
  A árvore de fontes/release segue o topo Joomla, sem `app/`, mas a separação
  administrativa e a equivalência funcional seguem parciais.
- **Local posterior à integração das frentes:** 72 suítes, 0 skips, 0 falhas;
  sintaxe de 244 arquivos JS e seleção contributor de 304 arquivos. Listagens de
  módulos, plugins e estilos de template e a pré-visualização de posições agora
  em `com_modules`, `com_plugins` e `com_templates`. Listagens de categorias e
  tags agora em `com_categories`/`com_tags`. Modelos de artigo/menu e
  tabelas de artigos/mídia separados em `com_content`, `com_menus` e `com_media`,
  mantendo contratos e HTML. Configuração em `com_config`; descoberta e seus
  callbacks em `com_installer`/`com_templates`, com snapshots e proteção de
  navegação. Rotas e contratos preservados; não é admin integralmente separado.
  Formulários de módulo/plugin/estilo/opções e gerenciamento de extensões já têm
  views puras próprias; consultas, roteamento e bindings continuam compartilhados.
  Não publicado. Geração dos manifestos de módulos
  já existe; demais manifestos e integração administrativa de plugins persistidos
  seguem pendentes. Sanitizador corrigido (ver `SECURITY.md`).
  Detalhes em `README.md`, `JOOMLA-EQUIVALENCE.md` e `RELEASE-MSE-0.1.0.md`.
- **Coordenação atual:** integração administrativa/XML concluída em `d927a3f`;
  desenvolvimento em `main` na worktree principal. Há trabalho paralelo local
  de CAMAP2 pertencente à outra equipe, excluído dos commits MINIJOOMLA desta
  rodada. Sinalizar antes de mudanças profundas nos contratos de descoberta,
  manifestos, runtime, host/transporte ou arquivos compartilhados.
- **Fechamento reduzido atual:** estabilização dos recursos existentes, sem
  novos componentes Joomla. Guard de tela por navegação nos coordenadores e
  ações administrativas: sem novas escritas por callbacks abandonados, nem
  redirecionamentos/mensagens tardias sobre outra tela. Validação de confirmação
  e leitura de arquivo antes da mutação, sem prometer cancelar escrita iniciada.
  Worktrees 01/02 retiradas com autorização, branches e resíduos preservados;
  desenvolvimento somente na principal em main.
- **Rodada independente atual:** somente verificador editorial local e validação
  de imagens, com suas suítes existentes. Alertas heurísticos para títulos vazios,
  IDs duplicados e nomes genéricos; upload valida bytes/10 MiB/MIME antes do
  transporte e a URL de confirmação depois. Sem alterar API de arquivos,
  paginação, composição, schemas ou contratos de extensões; sem publicação.
- **Reflow de viewport histórico** em 320/768/1366/1920 passou no tenant, sem
  overflow horizontal; não foi revalidado nesta rodada. O runner nativo local
  está bloqueado na identificação do listener, não aprovado por testes Node.
- **Lacunas da fila antiga (item 4) ainda abertas:** zoom real 200%/400%,
  forced-colors e reduced-motion com mídia real, e leitor de tela.

## Estado atual autoritativo — 04/11/2026

Reconciliação do agregado e da execução do coordenador. A frente documental
original não revalidou produção; a continuidade local acrescentou avisos e
conversão assistida com testes próprios. **Público 0.2.11 / administração 0.2.12**
são os incrementos efetivos: público fonte `23f4696`; admin pacote fonte `eb423f7`,
delta de conversão `7bc5b6e` sobre o grafo real 0.2.10. Não são uma release OSS.
Push `f1b4a84` incluiu os avisos `11afbe4` e fechamento documental. Conversão
assistida `7bc5b6e` foi posteriormente publicada seletivamente em 0.2.12; ver
[contrato 6.7](CONTRACTS-MINIJOOMLA.md#67-conversão-assistida-de-atribuições-legadas--local).

**Atualização operacional do coordenador:** 0.2.9 foi brevemente ativada
(15 arquivos novos/134 assets totais verificados), mas `#/moduleInstances`
falhou por falta do contrato `json` requerido pelo catálogo histórico da base
publicada 0.2.5, divergente da fonte local. O rollback restaurou **somente o src
administrativo para 0.2.7**, com canvas/ETag recém-lidos, MERGE específico e
Publish verificado. Reload confirmou montagem única/rota funcional; público
0.2.8 e seu canvas/ETag permaneceram iguais, sem edição de dados. 0.2.9 é histórica,
imutável, não ativa nem aprovada. UI/own-properties/grupos `5a02adf` e neutralização
selecionada `51a1b2a` estão commitados/enviados. O push main
`23f46966d19e4bf2418475910347bb94d3e7d32d` inclui standalone `bc64256`, preview
CAMAP `343bb58` e contratos JSON restaurados. **0.2.10 publicada/verificada** após
revisão independente final: normalização histórica, oito tipos nativos, três
defaults avançados e igualdade exata do corpo da função de renderização.
Publicou 15 arquivos novos (14 JS/manifesto), 119 dependências/134 assets totais
verificados por bytes/SHA-256/MIME. CSS administrativo 0.2.5 mantém o hash;
editor efetivo 0.2.5, agendamentos 0.2.6 e descoberta 0.2.7 preservados.
Prévia em sete larguras passou contador sintético 0 → 1 → 2, own-properties,
rejeição de grupo inválido/JSON e snapshot real do catálogo (11 registros de
módulo/oito tipos nativos, com sobreposições). Reload confirmou uma montagem
0.2.10, sete larguras, rotas artigos/módulos/plugins/configuração/descoberta,
TinyMCE real/três abas/cleanup e agendamentos sintéticos. ETags de artigos/páginas
e público 0.2.8 preservados; sem edição remota de dados/criação de módulo/upload.
Evidências privadas em `tmp/sol-admin-final-20261104/`; ver
[contrato do incidente](CONTRACTS-MINIJOOMLA.md#65-contadores-administrativos-e-parâmetros-declarativos-próprios).

**Último incremento público verificado:** 0.2.11, fonte `23f4696`, substituiu
somente `src` público 0.2.8 → 0.2.11, preservando admin 0.2.10/canvas/ETag.
Nove arquivos novos (sete JS/CSS/manifesto), 248 dependências históricas/257 assets
totais verificados por bytes/SHA-256/MIME, inclusive CSS. O fechamento substitui
seis módulos do grafo público real 0.2.8, não todo o runtime; sanitizador 0.2.8
com hash preservado, quatro CSS CAMAP opcionais e recursos absolutos 0.2.1/
`import.meta` permanecem iguais. Configuração salva mantém precedência sobre o
fallback `camap` → `cassiopeia`; nenhum dado/configuração foi gravado. A pré-baseline
0.2.8 já era Cassiopeia efetivo com CSS corporativo anterior; a mudança externa
de configuração tem origem desconhecida, não é efeito comprovado desta publicação.
Prévia em sete larguras passou 15 posições/aliases legados, imagem sintética
float/180px/margem20px, contraprovas de segurança, lifecycle, preservação DOM/hash
e dois checks de Enter/Escape nativos confiáveis. Reload público em sete larguras
confirmou uma montagem 0.2.11, Cassiopeia/CSS neutro/cabeçalho computados,
navegação/artigo real sem alerta. ETags das duas páginas preservados durante checks;
sem edição editorial/configuração/criação de módulo/upload. Rollback preparado
restaura só `src` público 0.2.8, usando canvas/ETag atuais e MERGE específico;
preserva admin/outros webparts e o runtime anterior retoma seu CSS, sem sobrescrever
assets. Reversão não executada; ver
[contrato público 6.6](CONTRACTS-MINIJOOMLA.md#66-público-neutro-cassiopeia--0211).

| Etapa / assunto | Estado atual | Limite e condição de fechamento |
| --- | --- | --- |
| 0 — Coordenação | Frentes exclusivas; main `23f4696` enviado, revisão independente e publicações admin 0.2.10/público 0.2.11 verificadas pelo coordenador | Sete documentos reconciliados nesta frente; 0.2.9 inativa, fechamento OSS/aceites integrais não concluídos |
| 1 — Administração P0 | Implementada com cobertura local e incrementos no host até **0.2.10** | Parsing estrito/legado/ETags preservados; todas as escritas remotas e aceite integral não inferidos |
| 1.1 — Instâncias de módulos | Runtime/atribuições/agenda/chrome/lote/lixeira implementados; rótulos/contador publicados em 0.2.10; conversão assistida exata implementada localmente | Prévia/apply/restore sem escrita automática, ETag ao salvar; recusa interseção rota/categoria. Novo incremento não publicado no host nem migrados dados remotos |
| 1.2 — Plugins/descoberta | Lifecycle/ordem/parâmetros implementados; descoberta 0.2.7 preservada; own-properties/grupos e contrato JSON publicados em 0.2.10 | Revisão independente/catálogo real/host aprovados no escopo; sem reparo automático de manifests legados; mesmo URL mantém cache e hooks não têm timeout |
| 1.3/1.4 — Estilos/opções/global | Consumidores suportados e releitura persistida cobertos localmente; suporte JSON genérico restaurado, controles sem consumidor desabilitados | JSON não implementa editor CAMAP `bandTones`; conversão legada foi implementada separadamente/localmente. SEO global/robots/tags sem suporte e metadados do host são limites explícitos, não recursos concluídos nem requisito automático da primeira OSS |
| 2 — Persistência | Migração autorizada e correção de integração históricas; cobertura local de oito cenários/19 entidades/oito domínios | Integração corporativa opcional; sem rollback de schema nem prova universal de tipos/índices existentes; não ampliar para mudanças no projeto irmão ou remoção de listas |
| 3 — Editor/público/imagens | Público **0.2.11**, preservando sanitizador/correção de imagens 0.2.8; preview sintético float/180px/margem20px aprovado | Aceite de imagem informado pelo usuário distinto de fixtures e de artigo real sem imagens observado antes; navegação/artigo real pós-reload não prova escrita/upload. Sem ACL/histórico/Schema.org/campos separados imagens-links |
| 4 — Templates/visual | Atum publicado; Cassiopeia neutro efetivo em **0.2.11**, sete larguras/15 posições/aliases e menu Enter/Escape nativos aprovados; CAMAP preview sem `LIMIT` | Zoom 200/400% não estabelecido: `Control+Add` rejeitado, `Control+Equal` manteve razão DPR 1. Mídias reais não conferidas/leitor não investigado; sem aceite integral, não declarar indisponibilidade |
| 5 — Regressão | **43 suítes passaram (35 locais/8 opcionais), zero skips/falhas / sintaxe de 136 JS**; conversão com 1.034 comparações públicas/DOM local sete larguras | Novo DOM usa cliques programáticos, não teclado nativo dos novos botões. Hosts 0.2.10/0.2.11 testados antes deste incremento, não atualizar seu escopo de aceite |
| Distribuição independente | `bc64256`/`343bb58` enviados em `23f4696`: sete grupos Node isolados passaram; CAMAP sem `LIMIT`/warnings tolerados, dados/ETags preservados; [LOCAL-DEMO.md](LOCAL-DEMO.md) | Sem irmão, oito integrações omitidas; child atual passa 32 locais após adicionar avisos, exclui apenas `runner.test.js` e inclui standalone, não é o total local. Core/fixture sem runtime TinyMCE/SPMIDDLE não são snapshot contributor completo nem DOM/editor real |
| Core/candidatos técnicos | Novo **0.3.1 / 50 arquivos / 496.268 bytes / zero candidatos**, hashes declarados verificados, CLI 0 | Gate manifest-only, não direitos/privacidade/distribuição. Core 0.3.0 **49/490.634/zero** e amostra **48/477.051/3**, saída 1, permanecem históricos |
| Dados/histórico | Índice após conversão: 436 rastreados/243 em tmp/193 fora de tmp; índices 432/189, 429/186, 425/182 e inventário inicial 400/53/121/21 históricos | Zero no novo core não fecha revisão manual dos dados, temporários/histórico/remoto; nenhuma limpeza/reescrita autorizada por esse passe |
| Licenças/terceiros | GPL própria incluída; stage preserva MIT original SPMIDDLE e `notices.txt` TinyMCE original no target all | Omissões MIT/aviso superadas localmente, não todos os direitos. TinyMCE: 33 cópias locais correspondentes não autenticam origem/fonte preferida e build; licenças integrais/modificações, reutilização Joomla e marcas seguem revisão bloqueante |
| 6 — Publicação no host | Público **0.2.11/admin 0.2.10 publicados**, fonte `23f4696`, conforme coordenador | Público: 9 novos/248 dependências/257 assets; admin: 15/119/134. Bytes/hashes/MIME, catálogo/CSS e reload aprovados; 0.2.9 imutável/inativa. Implantação não é divulgação OSS |
| 7 — Fechamento integral | **Não concluído** | Exige revisão de fonte/staging, seleção independente verificável, privacidade/direitos e aceites realmente aplicáveis; não marcar tudo concluído por passes locais |

**Atualização posterior que prevalece sobre os números históricos da matriz:**
admin **0.2.12** publicada/recarregada, cinco arquivos novos (quatro JS/manifesto),
134 dependências/139 assets verificados; somente `src` admin 0.2.10 → 0.2.12.
Closure reversa exata, deltas canônicos/mesma aresta assignment 0.2.5 e três suítes
package-bound revisados independentemente. Prévia vinculada ao pacote/canvas/ETag,
catálogo real/DOM em sete larguras aprovados. Reload efetivo confirmou rotas,
TinyMCE/três abas/cleanup, agenda e preservação de artigos/páginas/ETags. Tab/Enter
confiáveis em aplicar/restaurar passaram sete larguras, com contraprova sem tecla;
registros temporários apenas, sem gravação/migração/upload no tenant. **Incidente
de coordenação:** revisor somente leitura chamou indevidamente `apply`, que passou
o gate e executou MERGE/Publish. Coordenador verificou sem repetir escrita e fez
reload/aceites; não houve rollback. Atomicidade Publish continua não comprovada.
Tentativas de teclado interrompidas por timeout não contam; fixtures removidos e
reexecução completa posterior passou. Evidências privadas em
`tmp/sol-admin-conversion-20261104/`; não incluir em distribuição/commit novo.

Seleção **contributor-local** implementada/integrada: allowlist 171 arquivos,
manifesto byte/SHA-256 determinístico, inventário completo sem extras, demos,
testes/scripts e 33 vendor TinyMCE intactos, sem irmão/runbooks/evidências.
Auditor agora aceita o manifesto contributor e não isenta fixtures/regras/docs.
**44 suítes completas passaram (36 locais/oito integrações), zero skips/falhas;
sintaxe 137 JS**. Na seleção: 36 passes/oito skips esperados/zero falhas;
child isolado 35 locais, standalone sete grupos, core e HTTP/MIME aprovados.
Seleção segue apenas local, com candidatos e direitos/privacidade/publicação false;
snapshot anterior ao fechamento documental: 171 arquivos/3.734.107 bytes,
17 arquivos com 39 candidatos (categorias sobrepostas), não segredos confirmados.
referências documentais excluídas e terceiros ainda exigem revisão. Ver
[seleção contributor](CONTRIBUTOR-SELECTION.md).

### Fila ativa delimitada

**Gates técnicos concluídos, conforme coordenador:** npm 43/0 skips/0 falhas,
sintaxe 136 JS após conversão assistida; DOM/layout local em sete larguras; standalone em
sete grupos sem warnings CAMAP; novo core 0.3.1 auditado com zero candidatos e
hashes verificados. Revisão independente, main push `23f4696`, prévia com catálogo
real e publicação/reload 0.2.10 também concluídos no escopo descrito acima.
Público 0.2.11/CSS neutro, prévia/reload em sete larguras e menu nativo aprovados;
não equivalem a aceite visual/assistivo integral nem a atualização de todo o runtime.
Evidências privadas em `tmp/sol-admin-final-20261104/`,
`tmp/admin-layout-i7VWr1/report.json` e
`tmp/sol-core-legacy-20261104/manifest.json`; provas anteriores permanecem privadas
e históricas. Não distribuir tmp.
Esses passes não encerram a fila seguinte.

1. [x] Construir/validar o fechamento administrativo seletivo da conversão
   `7bc5b6e` a partir do grafo real 0.2.10, com prévia vinculada ao canvas/ETag
   atual, sem substituir a fonte local inteira. Publicações já concluídas não
   validam este novo incremento; 0.2.12 passou prévia/reload/teclado acima,
   conservando assets imutáveis e público 0.2.11. Incidente de coordenação registrado.
2. [ ] Fechar a seleção contributor utilizável.
   Allowlist local/demos/testes/scripts/TinyMCE e auditor completo implementados;
   comandos isolados passaram, não direitos/privacidade/distribuição pública.
   Revisar referências excluídas e candidatos reais sem transcrever valores,
   distinguir HTTP/Node de editor real. Revisar manualmente os dados
   selecionados e 243 temporários/histórico; zero no manifest não autoriza limpeza.
3. [ ] Completar o mapeamento dos avisos originais e verificar origem/fonte correspondente/
   build/licenças dos terceiros; encaminhar decisões de direitos/reutilização/
   marcas. MIT/aviso TinyMCE já preservados; igualdade de bytes/GPL própria não
   fecham esses gates. Correção de avisos é local, não nova publicação no host.
4. [ ] Executar aceites visual/assistivo aplicáveis com FIORI-AUTO próprio: zoom
   real 200/400%, mídias reais e leitor de tela. Tentativas de zoom falharam em
   estabelecer escala; forced-colors/reduced-motion reais não foram conferidos e
   leitor não foi investigado, não declarar indisponibilidade. A captura privada
   não pôde ser interpretada pelo modelo; não alegar análise visual integral. Classificar
   separadamente o aceite já feito no host da conversão assistida e CAMAP `bandTones`, sem
   ampliar para ACL, gaps do irmão, SEO global ou rollback destrutivo.
5. [x] Registrar publicações/validações verificadas e consolidar contratos
   6.5/6.6 e documentos canônicos com os bloqueios restantes. 0.2.9 está revertida;
   admin 0.2.10/público 0.2.11 publicados, sem declarar o plano todo concluído.
   Commit/push documentais encerram esta frente; não aprovam os gates 1–4.
   Core 0.3.1 é versão de estágio local, não versão do host.

**Limite de autorização:** “prosseguir até concluir” não concede direitos de
terceiros nem autoriza divulgar conteúdo corporativo, alterar visibilidade do
agregador ou apagar/reescrever história. Usar autorizações já concedidas sem
pedidos redundantes; conferir decisões realmente ausentes e controles efetivos.

## Histórico e procedimento reutilizável

Os checkboxes das seções 0–7 abaixo são o registro da fila inicial, **não uma
lista integral de tarefas atualmente pendentes**. Preservam decisões, causa-raiz,
procedimentos e evidências; a matriz/fila ativa acima determina o estado atual.

**Fotografia histórica:** 03/11/2026. **Fase:** rodada integrada publicada com limites de
aceite explícitos; snapshot `39ec4b0` publicado como release imutável 0.2.1,
preservando 0.2.0/anteriores. A situação verificada,
os testes e o histórico estão no [handoff](HANDOFF-DESENVOLVIMENTO.md).
Este plano é uma fila de trabalho, não uma afirmação de que os itens abaixo
já estejam implementados.

## Fechamento histórico reconciliado — 03/11/2026

O checklist detalhado abaixo preserva o histórico. Esta tabela registra o
estado daquela rodada integrada; o estado atual está na matriz de 04/11 acima.

| Etapa | Estado naquela rodada | Evidência / pendência restante |
| --- | --- | --- |
| 0 — Coordenação | Concluída | Baseline, inventário de alterações e frentes exclusivas; editor atual autorizado, b731dec permitido no push |
| 1 — Administração P0 | Implementada/aceite local | Parsers estritos, preservação parcial/legado, controles sem consumidor desabilitados; DOM nativo sintético, não todas as escritas no tenant |
| 1.1 — Módulos | Implementada/aceite local | Título/chrome, atribuição/agenda/lote/lixeira/remoção; conversão assistida de escopo legado não implementada |
| 1.2 — Plugins | Implementada/aceite automatizado | Refresh params/order/url, lifecycle e concorrência; hooks sem timeout e mesmo URL cacheado; DOM com plugins externos não é equivalência integral |
| 1.3/1.4 — Estilos/opções/global | Implementado o suporte real | SEO/metadados globais e opções tags não suportados, controles desabilitados e valores existentes preservados; host não é alterado |
| 2 — Persistência | Cobertura local concluída com limites | 8 cenários schema e 19 entidades, oito domínios, parcial/retomada/ETag/undo; sem rollback schema nem prova de tipos/índices existentes |
| 3 — Editor/público | Implementado/aceite local | Três abas reais, opções individuais/autoria/idioma/agenda, readmore/upload/reabertura/ETag e margens; sem ACL/Schema.org/histórico/campos separados imagens-links |
| 4 — Templates | Estrutura/paleta/reflow validados | 320/768/1366/1920, laterais vazias/preenchidas, um h1, foco/skip/menu; OCR não é comparação visual; zoom real/forced-colors continuam abertos |
| 5 — Regressão | Concluída com limites de aceite | Suíte completa até oito entidades, sintaxe 119 arquivos, staging/release-check/diff e DOM nativo; revisão independente tratada; acessibilidade integral não inferida |
| 6 — Publicação | Concluída/verificada | 0.2.1/39ec4b0, 112 arquivos SHA256, canvases publicados, reload real site/painel/editor; 0.2.0 preservada, rollback preparado não executado |
| 7 — Fechamento | Documentação/commit/push reconciliados | Commit/push somente MINIJOOMLA + b731dec já autorizado; não significa aceite integral de acessibilidade/tenant |

**Pendências de aceite, não funcionalidades simuladas:** zoom real 200/400%,
forced-colors/movimento reduzido com mídia real, leitor de tela, comparação
visual integral e escrita remota de todos os formulários. Não executar remoção
de schema/lista ou rollback destrutivo sem autorização específica.

## Objetivo e prioridades

Entregar um CMS JavaScript funcional, independente do transporte e o mais
próximo possível dos conceitos, fluxos e layouts do Joomla local, respeitando
as limitações do MINIJOOMLA. **Objetivo independente confirmado:** distribuição
open source com apresentação Joomla/Atum, demos/testes sem integração corporativa
obrigatória. SharePoint/SPMIDDLE e CAMAP são opcionais. Prioridade atual:

1. Administração de componentes, módulos, plugins e templates, com efeito
   verificável no site público e persistência segura.
2. Fidelidade estrutural e visual do Cassiopeia ao
   [Joomla de referência](../../JOOMLA/).
3. Manter CAMAP como integração opcional, não identidade obrigatória da
   distribuição independente. A prioridade corporativa da fotografia anterior
   foi superada pela decisão do usuário; não copiar contexto/ativos na seleção OSS.
4. Integração coordenada da frente independente do editor de artigos, testes,
   empacotamento e eventual publicação autorizada.

**Regra de aceite transversal:** salvar um campo no painel não equivale a
funcionalidade pronta. É necessário demonstrar sua aplicação no runtime correto,
após releitura persistida, com testes de sucesso, erro e concorrência.

## 0. Retomar sem perder trabalho ou disputar arquivos

- [ ] Ler o [handoff](HANDOFF-DESENVOLVIMENTO.md), o
  [prompt para a próxima LLM](PROMPT-CONTINUIDADE-MINIJOOMLA.md), as regras da
  raiz e do agregador, e as instruções locais aplicáveis.
- [ ] Executar `git status` no VSTO e em `web-devs`; analisar o diff e incluir
  os arquivos **não rastreados** no inventário. O projeto está dentro do
  repositório `web-devs`; o commit local `a6d809d` cobre apenas um checkpoint,
  não todo o trabalho atual. Não limpar, sobrescrever ou commitar alterações
  de `HH-web`, `hub-ai` ou de outra frente.
- [ ] Coordenar com a LLM do editor antes de editar seus arquivos, integrar
  releases ou alterar o loader. O usuário informou que ela segue
  `docs\PLANO-EDITOR-ARTIGOS-JOOMLA-LIKE.md`; esse arquivo não foi encontrado
  no inventário desta cópia em 03/11. Verificar a worktree e o estado dela,
  sem recriar o documento nem presumir que o trabalho terminou.
- [ ] Dividir frentes independentes com responsáveis exclusivos por arquivos;
  integrar somente após receber e revisar cada entrega. Se usar worktrees,
  nomeá-las `MINIJOOMLA-worktree01`, `MINIJOOMLA-worktree02` etc., irmãs
  de `MINIJOOMLA`, verificando primeiro a relação com o repositório agregador.
  Perfis, logs, screenshots e demais temporários ficam exclusivamente em
  `MINIJOOMLA\tmp`, ou no `tmp` mais próximo do projeto correspondente.
- [ ] Reexecutar a linha de base antes de mudanças; registrar falhas existentes
  e novas. Os resultados da fotografia anterior não substituem esta execução.

**Concluído quando:** não houver escrita concorrente nos mesmos arquivos, a
origem de cada alteração estiver identificada e a linha de base for reproduzível.

## 1. Estabilizar a administração em andamento — prioridade P0

**Diagnóstico da abertura, posteriormente superado pela integração:** a agente
desta frente foi cancelada sem relatório final. As telas e serviços
novos têm testes locais de serviço e DOM simulado, mas parte dos dados ainda
não é consumida pelo site. Detalhes em
[ADMINISTRATION-EXTENSIONS.md](ADMINISTRATION-EXTENSIONS.md).

1. [ ] Inventariar as rotas `#/moduleInstances`, `#/plugins`,
   `#/templates/styles`, `#/templates/positions`, `#/options` e `#/installer`,
   além de `#/config` e dos catálogos existentes. Comparar formulários e
   operações com os equivalentes Joomla sem copiar código ou ativos.
2. [ ] Para cada controle, identificar formulário → serviço → campo persistido
   → composição pública → consumidor. Corrigir a integração; enquanto ela não
   existir, não apresentar o controle como operacional nem permitir uma
   confirmação de sucesso que induza erro.
3. [ ] Revisar erros e dados inválidos. Há pontos novos que capturam falhas e
   devolvem listas vazias ou padrões, inclusive leitura de parâmetros/estilos.
   Não sobrescrever dados existentes a partir de JSON malformado; apresentar
   erro ou aviso seguro e testá-lo. Distinguir repositório ausente de falha de
    um repositório configurado.
    **Avanço após auditoria P0:** `componentParamsJson`/`templateStylesJson`
    persistidos malformados não são mais convertidos silenciosamente em padrões
    nos fluxos administrativos de leitura/escrita. Todas as mutações de estilos
    e a mesclagem de componentes rejeitam corrupção antes de gravar, sem alterar
    dados/ETag. Páginas afetadas apresentam alerta seguro sem formulário padrão.
    Regressões de serviço e aplicação/DOM simulado aprovadas; runtime tolerante,
     outros pontos de parsing/carregamento ainda pendentes. **Continuidade:**
     posições não ocultam falhas SiteConfig/catálogo de estilos; novas páginas
     mostram alerta seguro de carregamento sem formulários padrões. 11 cenários
     nativos locais de corrupção/indisponibilidade aprovados via
     `tests/admin-errors-dom.test.js`, incluindo bloqueio de mutações e
     preservação do armazenamento sintético. Não é aceite em tenant.
4. [ ] Exercitar por navegador autorizado os novos formulários, filtros,
   paginação, estados vazios, mensagens, ações em lote, conflitos de ETag,
   cliques repetidos e navegação por teclado. Os testes com DOM mínimo não
   substituem DOM real.

### 1.1 Módulos e atribuições

**Aceite local adicional:** `tests/site-runtime.test.js` agora remove todas as
cinco linhas demo por trash/delete com ETags relidos, reabre armazenamento e
recompõe o público: coleção vazia configurada suprime defaults; componente,
menu e breadcrumb permanecem. Controle sem repositório preserva fallback.
Esse teste substitui a antiga lacuna de remover somente uma instância extra;
não implica remoção de todas as linhas no tenant.

1. [x] Integrar ao runtime `assignment`/`assignmentJson`, publicação inicial e
   final, lixeira e campos visuais `showTitle`, `moduleClass`, `headerTag` e
   `headerClass` — feito em `src/libraries/minijoomla/modules/dynamic-modules.js`
   (`resolveModuleEntries`: `assignment` tem prioridade sobre o escopo legado
   quando declarado; `trashed`/janela `publishUp`/`publishDown` excluem a
   instância) e propagado até `src/libraries/minijoomla/modules/registry.js`/`content-modules.js`
   (wrapper `moduleClass`, `showTitle`/`headerTag`/`headerClass` com allowlist
   segura). Testes locais em `tests/module-runtime.test.js`. **Ainda falta
   revalidação completa dos parâmetros em DOM real via FIORI-AUTO** (a retomada
   abaixo já cobre `headerTag=p`, não todos os parâmetros). **Achado real
   corrigido nesta rodada**: a lacuna cosmética já anotada em rodada
   anterior ("form's `headerTag` select only offers `h2`–`h6`/`div`/`span`")
   era na verdade uma inconsistência real de três pontas — a validação do
   serviço (`admin-service.js`, `headerTag inválida`) e o runtime
   (`HEADER_TAGS` em `dynamic-modules.js`/`content-modules.js`) sempre
   aceitaram 9 valores (`h1`–`h6`/`div`/`span`/`p`), mas o `<select>` real
   do formulário (`MODULE_ADVANCED_PARAMS`, `src/libraries/minijoomla/application/module-catalog.js`)
   só expunha 7 — um administrador nunca podia escolher `h1`/`p` pela UI,
   mesmo sendo valores válidos já aceitos pelo backend e pelo runtime.
   Corrigido: `MODULE_ADVANCED_PARAMS.headerTag.options` agora espelha
   exatamente a mesma allowlist de 9 tags. Testado em
    `tests/module-runtime.test.js`. Na retomada, selecionar `p` pela UI,
    salvar e reler o site local também produziu título `<p>` em DOM nativo
    FIORI-AUTO. Os demais parâmetros ainda não têm esse aceite completo.
2. [x] Definir um contexto inequívoco para atribuição por item de menu, inclusive
   quando dois itens levam à mesma rota — `resolveActiveMenuItemId`
   (`src/libraries/minijoomla/application/module-assignment.js`) resolve o item ativo pelo
   `path` exato navegado (nunca por rota/alias), devolvendo `undefined`
   (sem inferir um id arbitrário) quando dois ou mais itens publicados
   compartilham o mesmo `path`; conectado em `src/index.js` via
   `resolveModuleEntries(moduleInstances, { ..., menuItemId:
   resolveActiveMenuItemId(menus, location.path) })`. Preserva menus
   hierárquicos/ordenação (inalterados, ver `src/modules/mod_menu/tmpl/default.js`) e
   estado ativo (`activePath`, inalterado). Testado em
   `tests/module-runtime.test.js` (função pura) e
   `tests/site-runtime.test.js` (fim a fim via `createApplication`, dois
   itens de menu para rotas distintas, módulo atribuído a um só aparece
   na rota correspondente).
3. [x] Preservar o comportamento das linhas antigas que usam `ScopeKind`,
   `ScopeRoute` e `ScopeCategoryAlias` — `resolveModuleEntries` cai para o
   escopo legado quando `moduleAssignmentMatches` devolve `undefined` (linha
   sem `assignment`); testado em `tests/module-runtime.test.js` e no teste
   legado preexistente `tests/dynamic-modules.test.js` (ambos passam sem
   regressão). A conversão assistida de escopo legado→novo na tela
   permanece pendente (não implementada nesta rodada).
4. [x] Cobrir as combinações `all`/`none`/`only`/`except`, rota/categoria,
   item de MENU (`menu:<id>`, incluindo o caso de dois itens com o mesmo
   path — resolve `undefined`, não escolhe um arbitrariamente), limites
   EXATOS das datas (publishUp/publishDown iguais a `now`) e
   trashed/desativação, com relógio injetado (`now` determinístico) —
   `tests/module-runtime.test.js`, `tests/site-runtime.test.js`.
5. [x] Testar duplicação, movimentação e lote com sucesso parcial e ETag
   obsoleto; nunca excluir definitivamente sem o estado/ação apropriado —
   já cobertos por `tests/admin-management.test.js` (lote `move`/`trash`/
   `restore`/`delete` com sucesso parcial, exclusão definitiva bloqueada
   fora da lixeira, conflito de ETag detectado e reportado), que existia
   mas não estava registrado em `tests/run-tests.js`; agora integrado à
   suíte principal (ver `6f0d3a5`).

### 1.2 Plugins e registro de extensões

**Integridade administrativa adicional:** parâmetros/manifestos persistidos e
definições inválidos agora são rejeitados em list/get/update/lote, sem defaults
silenciosos nem escrita. Salvar campos declarados preserva configurações avançadas
já existentes; lote confirma tipo Plugin. Compatibilidade legado/ETags/snapshots
testados. Executor DOM nativo local cobre alertas e submit que preserva advanced;
não é validação de dados no tenant nem revisão geral do runtime tolerante.

1. [x] Aplicar parâmetros persistidos e ordem de plugins no pipeline público.
   `ensurePluginsRegistered` (`src/libraries/minijoomla/modules/dynamic-modules.js`) continua
   importando concorrentemente, mas agora REGISTRA sequencialmente, ordenado
   por `extension.ordering` (desempate por `key`) — a ordem de EXECUÇÃO real
   (`pluginManager.prepareContent`/`prepareSearchQuery`) reflete a ordem de
   registro. `paramsJson` chega a cada handler como `context.params`
   (`src/libraries/minijoomla/plugins/manager.js`, `register`/`pipeline`/`broadcast`). Testado em
   `tests/module-runtime.test.js` (ordem determinística mesmo com imports
   concluindo fora de ordem; `context.params` populado).
2. [ ] (aceite completo ainda pendente) Testar ativação/desativação, mudança de parâmetros e reinício em DOM
   real (`onAppInit`/`onAppFinalize` já são cobertos localmente em
   `tests/core.test.js`, sem duplicar listeners); falta a revalidação em
   navegador real via FIORI-AUTO.
3. [x] Manter a instalação restrita a manifesto declarativo validado que aponta
   para módulo ES já publicado no próprio site; é registro inicialmente
   desabilitado, não upload/extração/instalação de pacote PHP. **Achado real
   corrigido nesta rodada**: `parseExtensionManifest` (instalador manual)
   já restringia `entryPointUrl` ao próprio site via `sameSiteModuleUrl`
   (sem esquema, sem `//`, só `.js`/`.mjs`), mas `admin-service.js`
   (`extensions`/`templates` create/update direto) e
   `extension-discovery-service.js` (varredura de manifestos na pasta
   `extensions`/`templates`) usavam a validação mais FROUXA `assetUrl`,
   que aceita qualquer origem `https://` — um manifesto malicioso na pasta
   de descoberta, ou uma chamada direta ao admin-service, registrava um
   módulo/template cujo código era `import()`ado de um domínio externo
   arbitrário diretamente no navegador do visitante/administrador
   (`modules/dynamic-modules.js`, `application/template-runtime.js`).
   `sameSiteModuleUrl` foi movida para `extension-input.js` (fonte única,
   ao lado de `assetUrl`) e agora é usada em TODOS os três caminhos de
   escrita de entrypoint — nenhum mais frouxo que os demais. CSS de
   template continua aceitando qualquer origem HTTPS (menor risco,
   nenhuma execução de código), como já documentado. Testado em
   `tests/extension-discovery-service.test.js` e
   `tests/admin-management.test.js`.

### 1.3 Estilos de template e opções dos componentes

1. [x] Conectar `TemplateStylesJson` à configuração efetivamente entregue aos
   templates na composição SPMIDDLE. `toSiteConfigOverrides` foi extraído
   para `src/libraries/minijoomla/application/site-config-overrides.js` (fonte única, antes só
   dentro de `admin-service.js`) e agora é usado também por
   `createMiniJoomlaSiteApplication.js`, substituindo o espalhamento cru de
   campos. Testado em `tests/site-config-overrides.test.js` e
   `tests/site-runtime.test.js`. A demonstração local (`examples/`) não foi
    revisada na rodada original; na retomada, `examples/index.html` também
    passou a usar `toSiteConfigOverrides`, validado no navegador local.
2. [x] Unificar os metadados do editor de estilos com os parâmetros aceitos
   pelos templates — Cassiopeia reutiliza `TEMPLATE_PARAM_DEFINITIONS` real
   de `src/templates/cassiopeia/index.js` (corrige `logo`→`logoFile`,
   `brand` checkbox→select); CAMAP ganhou `CAMAP_PARAM_DEFINITIONS`
   (`src/templates/camap/index.js`) alinhada à paleta real `ACCENTS` (sem `gray`) e
   a todos os parâmetros de texto/hero/pairSections realmente consumidos por
   `resolveCamapParams`, exceto `bandTones` (objeto por posição, documentado
   como lacuna conhecida no próprio código). Testado em
   `tests/cassiopeia-template.test.js`, `tests/camap-template.test.js`.
3. [x] Ligar `ComponentParamsJson` às renderizações do componente `content`
   (`showTitle`/`linkTitles`/`showIntro`/`showCategory`/`showAuthor`/
   `showPublishDate`/`showTags`/`showReadmore`) e repassar `search`
   (`componentParams.search`) para `renderSearch` — `src/components/com_content/tmpl/article/default.js`,
   `search.js`, `category.js`, conectado em `src/index.js`. `highlightTerms`
   da busca agora implementado com a estratégia segura planejada: destaque
   (`<mark>`) aplicado ao texto plano do TÍTULO antes de qualquer HTML ser
   produzido (nunca regex sobre HTML já gerado), cada segmento escapado
   individualmente — `renderSearch` repassa `highlightQuery` para
   `renderArticleList` só quando `componentParams.search.highlightTerms`
   (default `true`) estiver habilitado. Deliberadamente não aplicado a
   `introtext`/`fulltext` (conteúdo HTML via `sanitizeHtml`, onde um
   destaque textual ingênuo poderia corromper marcação) — documentado no
   código. `listLimit`/`orderBy` (paginação/ordenação, já resolvidos no
   adapter/content-service) continuam fora de escopo do componente de
   apresentação. Testado em `tests/component-options-runtime.test.js`
   (inclusive tentativas de injeção via título/query attacker-controlled).
   **Correção de integração na retomada:** a rota de busca passava somente
   `componentParams.search`, mas `renderSearch` esperava o objeto agrupado
   `search`/`content`. `highlightTerms=false` persistido e opções de conteúdo
   eram ignorados. Agora a rota entrega o conjunto esperado, `articleLink`
   com `basePath` e fuso configurado. Teste administrativo com ETag → releitura
   → aplicação pública comprova a correção; restaurar a passagem antiga fez
   o teste falhar. O componente isolado já passava antes e não pegava o erro.
   A prova FIORI-AUTO nativa também revelou a demonstração pública sem
   `toSiteConfigOverrides`; `examples/index.html` agora reutiliza essa conversão.
   Desmarcar o destaque no painel, salvar e navegar ao site local passou a
   produzir zero `<mark>` no resultado esperado, após releitura persistida.
4. [x] (parcial) Provar edição → gravação com ETag → recarga → HTML visível —
   feito em Node (sem DOM real) via `createApplication`/`createAdminService`
   sobre o MESMO par de repositories em memória (`examples/demo-repositories.js`):
   editar `headerTag` de uma instância de módulo com seu ETag real torna-se
   visível na re-renderização pública (`<h3>` em vez do `<h2>` fixo
   anterior), e editar `siteTitle` de um estilo de template persiste e
   aparece na marca renderizada; um ETag obsoleto no mesmo registro é
   rejeitado em vez de sobrescrever silenciosamente. Testado em
   `tests/site-runtime.test.js`. **Limite histórico parcialmente superado:**
   a retomada acima já registra DOM nativo de `headerTag=p` e busca sem destaque;
   não é prova de todos os parâmetros expostos (offline e demais opções/campos).

### 1.4 Configuração global

1. [x] Preservar e testar a página inicial `category`/`featured`, sua categoria
   e paginação; conferir a migração de registros que não possuem esses campos
   — já coberto para a home em si (`tests/site-runtime.test.js`,
   "configurable home..."); confirmada agora a migração do registro
   persistido: `toSiteConfigOverrides` omite `homeView`/`homeCategory`
   quando o registro não os declara (schemaVersion 1), em vez de passar
   `undefined` como override explícito — `createConfig` então aplica seus
   próprios defaults (`category`/`noticias`), preservando o comportamento
   de um site existente sem exigir backfill de dados. Testado em
   `tests/site-config-overrides.test.js`.
2. [x] (parcial) Implementar o gate de `offline` (mensagem de manutenção
   substitui o conteúdo principal em qualquer rota, preservando
   menus/módulos/template ao redor — `src/index.js`). `metadados`/`robots`/
   título SEO continuam deliberadamente FORA de escopo (ver item 3 abaixo);
   não implementados, não anunciados como funcionais. Testado em
   `tests/offline-gate.test.js`.
3. [ ] Definir o comportamento no host isolado: não sobrescrever título,
   idioma, navegação ou metadados globais do SharePoint sem contrato explícito
   — decisão de contrato ainda pendente, por isso os metadados SEO/robots
   continuam fora do runtime público nesta rodada (só persistidos).


## 2. Persistência, compatibilidade e migração — P0 antes da publicação

1. [x] Comparar os schemas, mapeamentos e dados reais existentes, em leitura
   autorizada, com `schemaVersion: 2` de extensões, instâncias e configuração.
   **Achado real confirmado** (leitura autorizada contra `TesteMiniJoomlaArtigos`,
   `TesteMiniJoomlaExtensions`, `TesteMiniJoomlaModuleInstances`,
   `TesteMiniJoomlaSiteConfig` no tenant): 4 das 8 listas reais estavam em
   schemaVersion 1, faltando ao todo 31 colunas do schemaVersion 2 local
   (`ShowTitle`/`PublishUp`/`PublishDown`/`Trashed`/`Assignment`/`AssignmentJson`/
   `Note` em módulos; `Ordering`/`Folder`/`ParamsJson`/`ManifestJson` em
   extensões; `TemplateKey`/`Offline`/metadados/`TemplateStylesJson`/
   `ComponentParamsJson`/etc. em configuração; 9 campos de artigo). Reproduzido
   e confirmado como bloqueio REAL (não hipotético): salvar um módulo com
   `showTitle`/atribuição pela tela administrativa real falhava com HTTP 400
   (`"The property 'ShowTitle' does not exist on type
   'SP.Data.TesteMiniJoomlaModuleInstancesListItem'"`). `categories`/`tags`/
   `menu`/`templates` já estavam compatíveis.
2. [x] Projetar `inspect → plan → apply → verify` idempotente e reversível para
   campos ausentes, tipos, escolhas, índices e defaults. Implementado seguindo
   exatamente a forma de `createProvisioningManager`
   (`SPMIDDLE/packages/sharepoint-provisioning/src/provisioning.js`:
   `FIELD_TYPES`, `missingFieldAction`), executado dentro da sessão autenticada
   do navegador (FioriAgent) porque a criação de campo via REST exige o
   `X-RequestDigest`/cookies SSO reais, indisponíveis do lado Node. `inspect`
   (plano completo das 31 colunas faltantes, zero escrita) foi revisado antes
   de `apply`; `apply` criou cada campo individualmente, capturando o
   resultado de CADA operação (nunca um "tudo ou nada" silencioso) — 28/31
   campos `Text`/`MultilineText`/`Number`/`DateTime`/`Boolean` criados de
   primeira (HTTP 201); os 3 campos `Choice`
   (`Assignment`/`SitenamePagetitles`/`HomeView`) falharam com HTTP 400
   (`"The property 'Choices' does not exist on type 'SP.Field'"`) porque
   `__metadata.type` precisa ser `SP.FieldChoice`, não o genérico `SP.Field`
   — corrigido e reaplicado só para os 3 pendentes, com sucesso. `verify`
   confirmou as 4 listas `compatible: true` (nenhuma coluna faltante) após o
   apply. Reconciliação com a frente do editor não foi necessária: nenhuma
   coluna de artigo provisionada conflita com `introtext`/`fulltext`/afins já
   em uso por ela (as 9 adicionadas são todas novas: `AuthorAlias`,
   `Language`, `Note`, `VersionNote`, `FeaturedUp`, `FeaturedDown`,
   `MetaDescription`, `MetaKeywords`, `AttribsJson`). **Achado real
   adicional**: a causa do HTTP 400 nos 3 campos `Choice` era um bug
   genuíno em `createProvisioningManager`
   (`SPMIDDLE/packages/sharepoint-provisioning/src/provisioning.js`,
   `missingFieldAction`) — sempre usava `__metadata.type: "SP.Field"`,
   mesmo ao incluir `Choices`, nunca pego pelo teste de integração local
   (`tests/spmiddle-integration.test.js`) porque o transporte fake em
   memória nunca validava `__metadata.type`. Corrigido no próprio
   submódulo SPMIDDLE (`c4452a1`, repositório `rinaldops/spmiddle`): usa
   `SP.FieldChoice` quando o campo é `Choice`. `createListProvisioningFake`
   (`SPMIDDLE/packages/sharepoint-testing/src/index.js`, usado pelo
   próprio teste real do SPMIDDLE) também foi corrigido para validar essa
   mesma restrição — reproduzido e confirmado que, sem a correção de
   `provisioning.js`, o teste real `provisioning.test.js` do SPMIDDLE
   passa a FALHAR de forma determinística (o campo `Choice` nunca é
   criado), provando que a correção fecha uma lacuna de cobertura real,
   não apenas teórica. Ponteiro do submódulo atualizado em `web-devs`
   (`bb1157a`).
3. [ ] (parcial) Criar testes locais de schema antigo e novo, leituras/gravações parciais,
   dados existentes, ETags, repetição, falhas e rollback. Preservar o escopo
   legado de módulos e não converter ausência em sucesso silencioso.
   `tests/schema-migration.test.js` (SPMIDDLE real — `createMapper`/
   `createRepository`/`createSharePointListClient`/
   `createProvisioningManager` — sem rede, mas com um transporte fake fiel
   às duas restrições reais confirmadas contra o tenant: gravar uma
   propriedade/coluna inexistente falha HTTP 400 "The property '<X>' does
   not exist..."; um campo `Choice` só é aceito sob
   `__metadata.type: "SP.FieldChoice"`): (1) uma lista v1 aceita gravação só
   com campos legados e rejeita alto e claro uma gravação com um campo v2
   ainda ausente, sem item parcial; (2) `inspect`/`apply`/`verify` reais
   provisionam exatamente os 7 campos ausentes de `MiniJoomlaModuleInstances`
   (incluindo o `Choice` `Assignment`), nunca escrevem sem confirmação
   explícita, e `verify` confirma compatibilidade total depois; (3) depois do
   provisionamento, a mesma gravação antes rejeitada funciona, e o item
   legado criado antes permanece intacto (nenhuma migração de dados
   silenciosa); (4) um ETag obsoleto continua rejeitado mesmo após a
   migração de schema (sem rollback mascarado), e repetir o mesmo `apply` é
   idempotente (nenhum campo duplicado).
4. [x] Não executar provisionamento, migração ou alteração de dados remotos sem
   conferir destino, impacto e autorização já aplicável. Diagnóstico completo
   (`inspect`, zero escrita) apresentado ao usuário antes de qualquer `apply`;
   autorização explícita obtida ("Provisionar agora via FIORI-AUTO") antes de
   criar qualquer coluna. Nenhuma coluna existente foi alterada/removida;
   nenhum dado existente foi tocado — só criação de colunas ausentes,
   reversível (remover a coluna, se necessário, nunca testado nesta rodada
   por não ter sido preciso). O item de teste criado para validar a correção
   (`Teste Schema v2`, id 4) foi removido ao final, sem deixar resíduo.

**Concluído quando:** uma cópia representativa de cada contrato anterior e novo
passar pelos mesmos fluxos sem perda de dados, e o procedimento remoto tiver
pré-condições, evidência de verificação e reversão. **Qualificação na retomada:**
o diagnóstico real, a correção SPMIDDLE e o provisionamento autorizado foram
verificados, mas a seção 2 não está totalmente fechada. A suíte local cobre
schema antigo/novo de módulos, preservação de dados, ETag, repetição e falhas;
não executa rollback de schema nem todos os contratos de entidades. Remover
colunas é uma possível operação destrutiva, não uma reversão já testada.


## 3. Conteúdo e experiência pública

1. [ ] Integrar o resultado da frente do editor sem sobrescrever seu trabalho;
   verificar HTML sanitizado, imagens, uploads, abas, ETag e os fluxos de
   criação/edição/reabertura a partir do plano e dos testes dela.
2. [ ] Inventariar artigo, categoria/blog, destaques, busca, arquivo, tags,
   menus e breadcrumbs contra o Joomla. Priorizar lacunas necessárias às
   páginas reais; manter limites explícitos para funcionalidades sem backend.
   **Achado real corrigido nesta rodada (breadcrumbs)**: a lacuna já
   documentada ("precisa de política para item raiz e fallback") foi
   confirmada no código — `breadcrumbsModule`
   (`src/libraries/minijoomla/modules/registry.js`) nunca gerava nenhum `<a>`, mesmo com o CSS
   de ambos os templates (`camap.css`, `default.css`) já preparado para
   estilizar links dentro do breadcrumb; "Início" e qualquer categoria
   ancestral eram texto morto, nunca navegáveis, diferente do Joomla real
   (`mod_breadcrumbs/tmpl/default.php`: todo item exceto o atual é link).
   Corrigido: `breadcrumbsModule` aceita itens `{ label, href }` (mesma
   forma já usada pelo breadcrumb do admin em `render-shell.js`) e só
   nunca cria link para o ÚLTIMO item, mesmo que ele declare `href`;
   strings simples continuam como texto morto por compatibilidade retroativa.
   `src/index.js` agora monta `crumbs` com `href` real: "Início"
   (`router.link('/')`) e cada categoria ancestral de `categoryPath`
   (`/category/<alias>`) ficam navegáveis; a página atual permanece texto
   com `aria-current`. **Retomada posterior (03/11/2026):** inventário de
   código das demais superfícies registrado em
   [JOOMLA-EQUIVALENCE.md](JOOMLA-EQUIVALENCE.md#inventário-de-continuidade--03112026),
   com referências Joomla, consumidores locais e limites concretos (blog de
   lista única, arquivo sem formulário completo, tags que levam à busca
   textual, ausência de índice Smart Search e de ACL). Ainda não é aceite
   visual nem confirmação de todas as páginas reais.
3. [ ] (parcial) Testar leitura, paginação, categoria inexistente, itens não
   publicados, janelas de publicação, rotas inválidas, estados vazio/erro e
   navegação back/forward. Dados de conteúdo nunca executam código.
   **Lacunas reais fechadas nesta rodada** (`tests/site-runtime.test.js`,
   via `createApplication` real, não unidade isolada): (1) navegar para
   `#/category/<alias inexistente>` renderiza o 404 acessível
   (`role="alert"`, "Categoria não encontrada") E o breadcrumb termina em
   `404` sem link, preservando "Início" como link real (o `categoryPath.length`
   fallback de `src/index.js` nunca tinha sido exercitado fim a fim); (2)
   navegação back do navegador (`popstate`, hash já revertido pelo
   navegador antes do evento disparar) através da aplicação real
   re-renderiza o conteúdo da página anterior — só havia teste disso no
   `Router` isolado (`tests/core.test.js`), nunca através de
   `createApplication`. Itens não publicados, janelas de publicação exatas
   e rotas inválidas já estavam cobertos (`tests/module-runtime.test.js`,
   `tests/core.test.js`); paginação básica também já cobertas
   (`tests/core.test.js`, `tests/spmiddle-adapter.test.js`). **Retomada:**
   forward simulado foi incorporado ao mesmo teste de back, verificando
   também a remoção do conteúdo anterior. Paginação pela aplicação + adapter
   SPMIDDLE local usa sete artigos publicados, página de dois itens, primeira
   e última página, `aria-current`, páginas zero/negativa e categoria vazia.
   `page=999` foi caracterizado na release 0.2.0: devolve lista vazia e a view
   oculta toda a paginação, embora existam resultados em páginas anteriores.
   **Correção local após publicação:** mensagem específica e links para primeira
   e última página via callback da rota, sem alterar adapter/URL nem esconder
   categoria realmente vazia. Recuperação até os itens esperados comprovada
   pela aplicação local; filtros de busca/arquivo e basePath preservados em
   regressões. FIORI-AUTO local confirmou recuperação por clique nativo para
   primeira página com artigos. Essa melhoria não está na 0.2.0 publicada.
   FIORI-AUTO próprio também
   comprovou `history.back()`/`history.forward()` nativos em origem local
   sem cache, com dados sintéticos; não houve revalidação no tenant.
4. [x] (parcial) Confirmar que os módulos configurados são autoritativos, que
   todas as posições e aliases renderizam na ordem definida e que
   desabilitar/remover uma instância produz o efeito esperado.
   `src/index.js` já tinha um comentário real ("A supplied repository is
   authoritative: removing its last row must remove the module too") sem
   nenhuma prova fim a fim; `tests/site-runtime.test.js` já cobria
   desabilitar (via extensão nativa desabilitada) mas não a REMOÇÃO real de
   uma instância. Adicionado: cria uma instância nova via admin service
   real, confirma que renderiza numa navegação pública real junto dos
   módulos pré-existentes, confirma que `delete` antes de `trash` é
   rejeitado pelo fluxo real de dois passos (`admin-extensions-service.js`,
   nunca excluído silenciosamente), executa `trash` → `delete` reais, e
   confirma numa nova navegação que só a instância removida deixa de
   renderizar — as demais (`Artigos recentes` etc.) continuam intactas, e o
   registro realmente deixou de existir (`get` resolve `null`, não apenas
   oculto). **Limite daquela prova, superado pelo aceite local da seção 1.1:**
   ela não removia a última linha; a regressão posterior remove todas as cinco
   linhas demo e comprova que a coleção configurada vazia suprime defaults.
   Não é remoção/aceite no tenant.
   Posições/aliases (`sidebar`/`content` legados, 15 posições de
   template) e ordem determinística já estavam cobertos
   (`tests/dynamic-modules.test.js`, `tests/site-runtime.test.js` "every
   managed module position..."); não revisados nesta rodada.

## 4. Cassiopeia e CAMAP — em paralelo após separar arquivos

1. [ ] Ler os contratos de [Cassiopeia](CASSIOPEIA.md) e
   [CAMAP](CAMAP-TEMPLATE.md), inspecionar as referências aprovadas e montar
   uma matriz de regiões, tipografia, cores, largura, espaçamento, estados e
   breakpoints. Registrar diferenças concretas antes de alterá-las.
2. [ ] Comparar Cassiopeia com o template original Joomla e CAMAP com o modelo
   `mse-platform` + CAMAP-AGP. Implementar código e ativos próprios, sem copiar
   materiais protegidos ou incorporar dados/URLs corporativos em projeto público.
3. [ ] Testar cada template em 320, 768, 1366 e 1920 px, com ambas as laterais
   vazias/preenchidas, posições, links, menus aninhados e conteúdo extenso.
   Critérios mínimos: largura rolável não maior que a viewport, um `h1`, foco
   visível, skip link funcional, abertura/fechamento e Escape corretos.
4. [ ] Verificar zoom 200%/400%, alto contraste/`forced-colors`, movimento
   reduzido, teclado e contraste. Repetir capturas comparáveis após alterações;
   registrar diferenças remanescentes e aprovação visual, sem chamar testes
   sintéticos de equivalência integral.
5. [ ] Para todo navegador, inclusive local, usar uma instância própria do
   [FIORI-AUTO](../../../app-devs/FIORI-AUTO/), conforme a
   [diretriz](../../docs/DIRETRIZ-FIORI-AUTO-OBRIGATORIA.md). Usar origem sem
   cache para evitar módulos ES antigos. Não assumir a sessão de outro agente.

## 5. Regressão e critérios locais de aceite

Na raiz `C:\PROJETOS\VSTO\web-devs\MINIJOOMLA`:

```powershell
npm test
npm run check
npm run release:check
npm run test:release-stage
git -C .. diff --check -- MINIJOOMLA
```

- [ ] Os testes administrativos novos devem continuar registrados em
  `tests\run-tests.js`; adicionar testes de integração ao runtime para cada
  campo concluído. Rodar também testes reais de DOM/navegador.
- [ ] Verificar arquivos não rastreados, licenças de recursos vendorizados,
  referências e links, diferenças não relacionadas e ausência de segredos.
- [ ] `release:check` atualmente verifica estrutura offline, versão do pacote e
  licença, não mais o runbook histórico 0.1.0. A versão de pacote 0.1.0 não é
  versão implantada. Não é prova de publicação/privacidade/direitos/aceite.
- [ ] Só aceitar a etapa quando os testes automatizados e funcionais exigidos
  passarem e as exceções tiverem responsável, causa e critério de retomada.

## 6. Release, host e eventual publicação autorizada — depende das etapas 0–5

**Publicação autorizada verificada em 03/11:** usuário confirmou o estado atual
`09300fa` para site e painel; release nova 0.2.0, 112 arquivos verificados por
SHA256, canvases publicados e reload real coerente de ambas as páginas. Ver
[runbook](RELEASE-MSE-0.1.0.md#publicação-020-verificada--03112026).
Isso não conclui todos os aceites das etapas 0–5, nem testa rollback/zoom/
permissões amplas. Releases anteriores preservadas; melhorias subsequentes
não devem sobrescrever 0.2.0.

1. [ ] Conciliar o editor e congelar as fontes desejadas. O teste de staging
   falha quando detecta escrita concorrente; não aproveitar um snapshot antigo.
2. [ ] Preparar saída **nova e local**, exclusivamente sob `MINIJOOMLA\tmp`,
   com `scripts\stage-release.js`; seguir o
   [runbook de staging](RELEASE-MSE-0.1.0.md#estágio-reproduzível-do-código-atual-03112026).
   Conferir `manifest.json`, hashes, grafo ES/CSS, TinyMCE, entrypoints e
   dependências externas. `--target site` não aprova nem distribui o painel.
3. [ ] Antes de reservar nova versão, consultar o destino remoto autorizado.
   **Nota histórica superada:** a leitura inicial encontrou `0.1.0` a `0.1.4`
   e tratou `0.2.0` como exemplo local; publicações posteriores usaram 0.2.0/0.2.1
    e os incrementos atuais são público 0.2.11/admin 0.2.10. Nunca sobrescrever
   release imutável nem reservar a próxima por inferência documental.
4. [ ] Conferir o grafo coerente e suas dependências imutáveis antes de publicar.
   **Mistura inicial histórica:** loader/CSS público 0.1.3 com bootstrap/JS0.1.0,
   admin0.1.0. Foi superada por snapshots e incrementos verificados. Incrementos
   posteriores podem referenciar dependências anteriores explicitamente fixadas;
   isso não exige republicar todos os assets na mesma pasta. Manifest/hashes,
   entrypoints, CSS/runtime e rollback devem documentar o grafo efetivo.
5. [ ] Validar a montagem do site no contêiner dedicado do Modern Script Editor,
   sem substituir o `body` do SharePoint; validar separadamente o administrador.
   Conferir MIME, CSP, cache, autenticação, permissões e dependências.
6. [ ] Se a publicação estiver autorizada, verificar novamente site, páginas,
   arquivos e efeitos, executar a sequência documentada, conferir reload real,
   operações autorizadas e rollback. Não usar os métodos inexistentes
   `sharepoint.getPageCanvas`, `sharepoint.updatePageCanvas` ou
   `sharepoint.publishPage` do FioriAgent; consultar o fluxo comprovado em
   `app-devs\FIORI-AUTO\dev-probe\sp_mse_pages.py`.
7. [ ] Registrar versão, hashes, telas, verificações, problemas e resultado
   de rollback sem guardar cookies, tokens, perfis ou dados pessoais.

## 7. Fechamento final

- [ ] Atualizar README, contratos, matriz Joomla, runbook e handoff com fatos
  comprovados; preservar o histórico como histórico.
- [ ] Rever integrações com o editor e com os apontadores dos agregadores.
  Commit/push/publicação são operações distintas: cumprir apenas o escopo
  autorizado, sem incluir alterações alheias.
- [ ] Declarar concluído somente quando os fluxos priorizados estiverem
  implementados de ponta a ponta, os critérios de teste e acessibilidade
  passarem e qualquer publicação tiver sido realmente verificada. Caso
  contrário, entregar pendências identificadas e bloqueios objetivos.
