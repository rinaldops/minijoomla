# Integração das branches e retirada de worktrees — avaliação

Avaliação solicitada antes de continuar o fechamento nativo. **Não é merge,
autorização de exclusão ou aceite da integração.** Nenhum index/ref foi alterado,
nenhum arquivo anterior descartado e nenhuma worktree removida nesta avaliação.

## Recomendação

**Consolidar agora, antes de novos blocos funcionais, mas retirar as worktrees
somente depois de preservar/reconciliar o trabalho e verificar suas dependências.**
A integração é um marco próprio de Desenvolvimento → Teste → Análise →
Validação → Documentação; não exige terminar plugins/templates/migração antes.

## Estado Git observado

| Árvore | Branch / HEAD | Estado |
| --- | --- | --- |
| `MINIJOOMLA/` | `main` / `231560b` | 38 arquivos modificados, 13 novos locais; não descartar |
| `MINIJOOMLA-worktree01/` | `feat/joomla-finalization-step1` / `2ae9443` | Git limpo/sincronizado; etapa incluída na step2, artefatos privados separados |
| `MINIJOOMLA-worktree02/` | `feat/joomla-finalization-step2` / `30362f1` | Antes deste documento: 9 arquivos modificados, 8 novos; Documentation/steering e Videoteca parcial suspensa |

Remotos consultados no momento da avaliação correspondem aos três HEADs acima.
`main` é ancestral da step2: **0 commits exclusivos / 14 commits atrás**.
Step1 também é ancestral da step2: 0 exclusivos/12 atrás. O histórico commitado
é linear e pode avançar por **fast-forward** depois de tratar o estado local;
não existe necessidade de um merge separado da step1.

Delta commitado de main à step2: 117 arquivos, +18.896/−118 linhas e 12 novas
imagens do Sample Data. Inclui núcleo/correções/instalador, scripts/testes e
ensaios externos históricos. Incorporar seu histórico não registra, habilita
ou instala outros módulos no site. A diretriz atual suspende expansão futura,
não autoriza retirar módulos existentes ou apagar o trabalho passado.

## Principal: contribuições reais a reconciliar

51 arquivos locais (38 modificados/13 novos), +676/−149 linhas em rastreados e
2.412 linhas em arquivos novos. **19 arquivos rastreados sobrepostos** à step2,
mais colisão com o untracked `tests/query-options.test.js`. Nenhum dos vinte
arquivos é integralmente igual, mesmo desconsiderando finais de linha.

- Consultas/metadata têm a mesma finalidade, mas APIs/aliases/limites distintos.
  Aproveitar a versão validada sem reaplicar cegamente o patch inteiro; conferir
  testes/requisitos exclusivos da principal.
- `application/admin-plugins.js` e suas integrações são contribuição funcional
  local real. Combinar com Sample Data na composição/host/app; não escolher
  uma funcionalidade em lugar da outra.
- `application/extension-migration-plan.js` e `strictMetadata` são prévia local
  relevante, não executor ou migração aceita. Reconciliar antes de desenvolver
  outra prévia redundante.
- `camap-v3` é trabalho independente em andamento, não requisito do fechamento
  padrão. Preservar separadamente, sem incorporar como template default.
- Runner/contributor/auditoria/provisioning e documentação precisam ser
  reconciliados com as novas suítes/allowlists; não conservar travas de contagem
  referentes a outro grafo como se fossem inventário atual.

Inspeção de blocos apontou interseções divergentes em 12 dos 19 rastreados e
46 blocos candidatos. **Não é contagem de conflitos de merge executado**, pois
há alterações semanticamente equivalentes/independentes. O risco exige revisão
de app/composição, consultas e tooling, não resolução automática “ours/theirs”.

## Trabalho local da worktree02

Documentation foi validado tecnicamente e em ensaio isolado, mas sua implementação
e integração ao runner/contributor continuam fora dos commits. São dois scripts,
dois testes e documento de proveniência, além de atualizações documentais e de
steering. Fechar um commit focado requer separar esses arquivos dos dois arquivos
parciais de Videoteca (`prepare-videoteca-adaptation.js` e
`videoteca-adaptation.test.js`). Estes últimos têm pins/fixtures pendentes e não
foram validados; arquivá-los privadamente com bytes/hash, sem integrar como prontos.
O documento do ciclo suspenso pode conservar o registro da decisão.

Não presumir que 94 passes locais autorizam publicação global de fixtures/código
derivado. Notices/fontes do pacote Documentation passaram no gate técnico
escopado; a seleção Git efetivamente enviada exige revisão própria do material,
privacidade e atribuições. Pacotes/recibos/ETags/snapshots privados ficam fora do
Git e precisam de preservação independente do commit.

## Risco adicional: hashes e finais de linha

`core.autocrlf=true`; os onze arquivos de suporte pinados por
`prepare-documentation-source-package.js` misturam LF, CRLF e conteúdo mixed na
worktree. Os blobs Git são LF. Cinco desses arquivos rastreados têm hash local
diferente do blob Git; vários scripts LF não manteriam seus pins num checkout
CRLF novo. Não há regra `eol` para esse conjunto em `.gitattributes`.

Os passes observados foram da árvore local/fixtures copiados, não uma prova de
checkout novo com conversão Git. Antes da integração, definir política de bytes
reproduzíveis delimitada e testar uma cópia nova usando o Git. Não afrouxar hashes
nem regenerar pacotes aprovados no mesmo caminho. Qualquer revisão de fonte/pin
usa perfil/output novo, preservando os pacotes 0.3/0.4/0.5 e sua proveniência.

## Separar integração de código e operação do site

Merge/fast-forward não deve alterar o tenant. A referência aceita continua sendo
48 registros/ETags, Cassiopeia/três estilos, host 0.15.0/oito raízes e página
pública em rascunho preservado. Revisões futuras precisam de publicação explícita
e teste proporcional; não publicar a página como efeito de consolidar Git.
Manter inventários, pacotes e aprovações imutáveis: copiar/realocar artefatos
privados de operação não pode mudar URLs, hashes ou expandir raízes para fabricar
capacidade. Nenhum rollback de artigo ou reinstalação do Sample Data entra nessa
integração. A volta ao foco nativo não exige remover código/testes históricos de
extensões já validadas; Videoteca parcial permanece separada e suspensa.

## Sequência segura proposta — ainda não executada

1. Congelar novas frentes. Preservar bytes/HEAD/index/diffs/untracked da principal
   e da worktree02 com manifesto privado SHA-256; incluir separadamente os
   artefatos ignorados úteis. Não confiar apenas em `git diff` ou `stash`, que
   podem omitir untracked/ignored conforme o comando usado.
2. Classificar o trabalho validado, nativo adicional e suspenso. Resolver o
   contrato de finais de linha/pins e verificar o checkpoint em checkout novo.
3. Preparar uma candidata integrada a partir da step2, reconciliando conjuntos
   funcionais da principal e os arquivos validados atuais. O método exato depende
   de preservar a linha de trabalho local: o histórico publicado permite ff;
   commitar o delta da principal em branch própria pode criar divergência real
   a resolver na candidata. Não chamar a operação inteira de “sem conflitos”.
4. Validar imports, sintaxe, regressão completa, seleção contributor, baseline
   editorial e fluxo no site proporcional ao delta. Não publicar páginas ou
   reinstalar Sample Data como efeito da integração Git.
5. Preservar/migrar dependências operacionais e revisar helpers relocados. Somente
   após confirmar fonte/testes/recibos e branch seguros, atualizar main e enviar
   o checkpoint autorizado; retirar primeiro worktree01 e depois worktree02,
   com consentimento de exclusão e sem `--force` para encobrir trabalho residual.
   Mover também a sessão ativa para a árvore consolidada antes de retirar a
   worktree02. Conservar branches/checkpoints de rollback; remoção da pasta não
   implica autorização para apagar branches ou reescrever seus históricos.

**Conclusão:** antecipar a consolidação reduz o retrabalho e já revela contribuições
que cobrem parte das pendências nativas. Excluir agora, antes desses gates, troca
complexidade por risco de perda. Remover a worktree não é remover uma branch nem
apagar commits; tampouco Git preserva automaticamente arquivos privados ignorados.

## Execução autorizada da sequência — consolidação em andamento

O usuário autorizou prosseguir com a sequência recomendada. Novas funcionalidades
permanecem congeladas; isso inclui Videoteca/Forum e o template experimental.
Snapshots privados completos das alterações/untracked/index foram criados e
reverificados: 51 arquivos da principal, zero alterações na worktree01 e 18
arquivos da worktree02 antes da consolidação. Os originais da principal continuam
intactos. Preservação de tmp/artefatos operacionais é uma frente separada, sem
alterar perfis/cookies de navegador ou copiar esses materiais para Git.

Contribuições nativas da principal foram reconciliadas em app/composição/host,
mantendo Sample Data e plugins administrativos juntos, captura por gravação e
ETags/JSON/guards. A migração é prévia privada sem executor; `strictMetadata`
é opt-in. Consultas receberam compatibilidade dos aliases e regressões da
principal, mantendo guardas e separação de limite de lista versus capacidade
blog. Testes focais passaram; regressão integrada ainda aguarda todas as frentes.

Para preservar os hashes históricos, 18 arquivos exatos do suporte de build
Documentation 0.5.x foram congelados em `scripts/documentation-frozen-build/`.
São o fechamento próprio e seus avisos já incluídos nos pacotes, não novas
fontes de outros módulos. O Git conserva seus bytes com `-text`; a facade atual
usa apenas esse suporte fixo, sem pin de arquivos ativos que mudam na integração.
Teste explícito de build passou 16 grupos; reprodução da versão neutra anterior
comparou todos os 57 arquivos e não encontrou diferença. Pacotes e pins de
0.3.x/0.4.x/0.5.x antigos não foram reescritos.

Limite de agentes simultâneos interrompeu uma frente; nenhuma perda ou exclusão
ocorreu, e o congelamento foi executado pelo coordenador. Ainda pendentes:
fechamento do tooling/allowlists, teste em checkout Git novo, revisão independente,
commit/integração/publicação Git e retirada condicional das worktrees. O tenant
não foi alterado; não tratar esta seção parcial como consolidação concluída.

Regressão integrada da candidata reconciliada passou **100 suítes, zero skips ou
falhas**, com 14 integrações explícitas e seleção contributor de 391 caminhos.
A revisão independente, contudo, reproduziu duas janelas não cobertas na versão
local da principal: cancelamento entre conclusão do hook e início da persistência,
e preparação obsoleta de catálogo/import bloqueando a nova navegação. A candidata
volta à correção/teste dessas janelas antes do commit/merge; testes verdes anteriores
não são usados para ignorar os achados. Arquivos originais e snapshots permanecem
preservados. Cópia-base de tmp tem 55.789 arquivos/330.051.549 bytes; suplemento
e verificação final ainda precisam do recibo autoritativo antes da exclusão.

As duas janelas foram corrigidas e testes de microtask/navegação pendente passaram.
Outra reauditoria identificou Promise rejeitada de guard inválido sem tratamento;
o serviço passou a observar somente rejeição de Promise genuína por intrínseco,
sem `await` entre validação e persistência. Guard assíncrono continua recusado;
teste com rejeição passou, sem escrita nem `unhandledrejection` mascarada.

Durante a consolidação três arquivos da principal mudaram por outra frente.
Uma segunda captura privada preservou admin-service e duas fontes CAMAPv3.
O usuário confirmou **congelar a principal** até terminar. A alteração nativa
de validação de templates por `BUILTIN_TEMPLATES` foi reconciliada, mantendo o
mesmo catálogo padrão; CAMAPv3 continua separado, sem default ou integração.
Não restaurar cegamente o primeiro snapshot sobre esses arquivos.

Nova regressão integrada após correções: **100 passes, zero skips/falhas**.
Revisão independente não encontrou blockers no runtime administrativo nativo;
registrou borda restrita de Promise com constructor/species adulterado em manager
customizado inválido, fora do contrato suportado. O fluxo nativo não retorna
Promise no guard síncrono. Esse limite não é aprovação de sandbox nem motivo
para alterar hashes/fixtures históricas. Próximo gate é commit candidato e
checkout independente com conversão Git, antes de mover a principal/remover árvores.

### Checkpoint candidato validado — troca de main bloqueada por nova concorrência

Commit candidato **`b5c548f`** registra núcleo reconciliado, documentação e suporte
congelado. A seleção exclui fontes/teste parciais de Videoteca; snapshots desses
arquivos e do template experimental permanecem privados. Diff staged foi
verificado; CRLF histórico do suporte congelado conserva os bytes por `-text`
e classificação `cr-at-eol`, sem alterar seus hashes. Scan limitado de padrões
sensíveis não encontrou ocorrência; não é certificação pública de privacidade.

Checkout Git novo, local e sem hardlinks passou: **86 suítes aprovadas, 14 skips
esperados (SPMIDDLE ausente), zero falhas**; child standalone 85/14/0. Syntax:
317 JS/MJS. A árvore nova permaneceu limpa. A suíte integrada da worktree com
SPMIDDLE passou 100/0/0 após as correções. São gates locais; o delta nativo ainda
não foi aceito/publicado no site, que permanece fora de escrita.

Preservação operacional recebeu recibo autoritativo de sucesso: **56.472 arquivos
regulares / 338.433.344 bytes** (base e suplementos), sem overwrite/exclusão,
76 junctions registradas somente como metadados. A janela não é snapshot atômico
e novos outputs posteriores requerem suplemento; nenhum perfil externo copiado.

A rechecagem anterior à troca de main detectou **novas alterações apesar do
congelamento confirmado**. A principal agora tem 57 arquivos locais, incluindo
novos deltas em configurações, estilos/admin e testes, além de CAMAPv3.
Uma terceira captura privada completa passou, preservando esses 57 arquivos,
diffs e estado. Não atualizar main, guardar o delta em stash ou retirar worktrees
enquanto a frente concorrente continuar editando. Não substituir esses arquivos
pela candidata validada nem reaplicar o snapshot antigo sobre mudanças novas.

**Consolidação parcial, não concluída:** fonte candidata commitada e checkout
validado; main permanece em `231560b` e worktrees01/02 preservadas. A próxima
ação exige janela real de edição cessada e reconciliação do novo delta, validação
proporcional no site, depois fast-forward e retirada dos diretórios. Branches de
recuperação e evidências privadas não são apagadas.
