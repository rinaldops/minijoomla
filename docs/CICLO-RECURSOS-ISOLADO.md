# Recursos — ciclo isolado de desenvolvimento e teste no site

> **Estado — validação local concluída, aceite do site bloqueado:** 0.4.x corrige
> a coluna compacta e passou nas auditorias locais; ainda não foi carregada/testada
> como pacote final no site. A releitura encontrou alterações concorrentes em
> configuração de template e ETags: **não houve preservação integral do baseline**.
> Recursos não instalado; não restaurar/adotar automaticamente trabalho concorrente.
> Retomar somente após reconciliação da referência autorizada.

Base `3eee4a0`, branch `feat/joomla-finalization-step2`, iniciado em 09/11/2026.
Baseline relido: 48 itens; host aceito 0.15.0/oito raízes. Não instalar Recursos,
configurar novas raízes, publicar páginas ou modificar as listas nesta rodada.

## Desenvolvimento → teste no site → análise

Fonte original preservada. Onze parâmetros originais: title, homeLabel, homeHref,
search, category, sort, view, showActions, showShortcuts, categories e links.
sort admite curada/alfabetica; view cartoes/compacta. Arrays/defaults e aliases
históricos de links devem ser conservados no armazenamento. Render síncrono
filtra/ordena pelos parâmetros salvos, não por interação real dos controles.

Ensaio de HTML neutro da origem, CSS original e root temporário no site em
180/320/768/900 px: cartões com scroll de 2541 px, compacta de 2495 px e título
de 2329 px. Grids mínimos fixos, breadcrumb não quebrável e textos longos
extrapolam o módulo. Variáveis de cor faltam porque seletor da origem exige
wrapper antigo não emitido pela composição Joomla. Não houve write de listas.

Primeira contraprova adaptou seletor/CSS local e passou nos textos/grids, mas
o contador do chip foi comprimido a 2 px em espaço estreito. Correção/reteste:
chips quebram e contador não encolhe. Segunda contraprova passou nas duas views
e nas quatro larguras, sem elementos excedentes observados. Só diagnóstico de
CSS; não é ainda pacote final publicado/validado, nem aceitação assistiva integral.

Contraprova pública adicional com 12 links, labels de breadcrumb/categoria e
textos sem espaços também passou nas oito combinações view/largura, sem offender.
Os controles ainda eram da origem e continuavam operáveis: esse diagnóstico CSS
não prova a correção nativa de somente leitura/desabilitado do pacote futuro.

## Retorno ao desenvolvimento

- Helper URL estrito e links inválidos omitidos, nunca anchors de fallback.
- Dados próprios/inertes sem getters/coerção; preservar aliases/unknown JSON e
  diferenças declaradas de flags inválidas, sem saneamento persistido automático.
- XML canônico de onze campos/defaults sem novos aliases/constraints. maxlength
  100 do input de busca é limite visual de origem, não nova constraint no schema.
- Controles estáticos com disabled/readonly nativos e explicação de prévia.
  Não implementar backend/interações inexistentes por meio de um wrapper.
- CSS restrito à raiz real e filhos, wrap/min-width/grid limitado por espaço;
  manter fontes/cores/padding, aplicar composição estreita por contêiner.
- Snapshot fechado com três patches, avisos MIT/GPL integrais e pins. Novos
  pacotes imutáveis somente após revisão; não modificar CAMAP2 ou provas anteriores.

Testar os bytes finais no público/admin, todas as views/filtros/estados, aliases,
teclado/não-interação honesta, formulário com memória, ETags e cleanup. Repetir
análise/correção se aparecer qualquer falha antes de documentação/avanço.
Evidências brutas ficam ignoradas em `tmp/recursos-cycle/`/`tmp/recursos-adapt-agent-*`.
Não há adoção de Recursos, clearance global ou expansão fictícia de capacidade.

## Revisão preliminar → endurecimento

Revisão somente leitura confirmou três fontes/MIT no commit de origem, XML
canônico conforme gerador local pinado, 192 comparações de semântica válida e
16 de estados. Gerador/API atuais têm hashes locais fixados, mas o gerador
atual não está naquele commit histórico; não confundir origem dos três arquivos
herdados com origem histórica do tooling criado depois.

Achado: guardas de arrays enumeravam descritores antes de recusar `length >500`.
Volta ao desenvolvimento para consultar primeiro o descritor próprio de length,
sem getters/coerção, e só enumerar conteúdo se o limite passar. Não há publicação
de Recursos até o fechamento dos testes/documentação do builder e auditoria
dos bytes exatos. Recusa de inputs arbitrários não equivale a sandbox de Proxies
ou globals previamente alterados.

Política URL reutilizada rejeita protocolos, credenciais, barras/controles e
evasões especificadas; não afirmar rejeição universal de todo Unicode invisível.
Por exemplo, U+200B percent-encoded em path é aceito sem desvio de origem ou
protocolo observado. Não alterar helpers globais ou licenciar CAMAP inteiro por
essa constatação; direitos/privacidade/distribuição integral seguem pendentes.

## Desenvolvimento final e validação local

Guarda length aplicada antes da enumeração completa. Builder fechado em duas
versões 0.3.0/0.3.1, três patches, onze campos, cinco arquivos runtime, 11
payloads inventariados/13 arquivos totais. **20 portáveis / 21 com audit** passaram,
incluindo AST CSS completo, reconstrução dos arquivos, Maps/Buffers inertes,
arrays/aliases/filtros/estados e JSON persistido. A única alteração no preparador
Home é um export aditivo de helper existente; comportamento preservado.

Pacotes operacionais do coordenador (base diferente dos builds neutros do agente):

| Versão | SHA-256 do inventário |
| --- | --- |
| 0.3.0 | `35d0ac28b84707df881e7116b0d92a19069272d55a05c6286854fcd03af19db9` |
| 0.3.1 | `61ed63abd650c9b9daf3cd5abe78a83c4e5ba2ae3a1fb82f7fa5e4dfd0df9ad4` |

Avisos MIT/GPL completos verificados byte-a-byte. Flags globais seguem falsas.
Auditoria dos bytes finais e teste no site são gates distintos; não promover o
build local a instalação ou clearance jurídico/privacidade integral.

## Teste final de 0.3.x → descoberta → retorno ao desenvolvimento

26 arquivos carregados em duas pastas de ensaio novas e relidos por bytes,
hash/MIME; discovery verificou ambas as revisões sem import dos entrypoints.
Ensaios negativos, sem writes: CSS adulterado em porta de leitura recusado,
duplicidade em raízes conflitante e leitura incompleta bloqueada. Nenhuma raiz
publicada ou módulo instalado. A regressão completa passou: **91 suítes, zero
skips/falhas**, child 79 locais/11 skips esperados; não é aprovação do layout.

**Gate individual de texto reprovou 0.3.x:** compacta em roots 768/900 px com
categoria sem espaços, viewport 1912 px. O root/page não rolava, mas a coluna
auto à direita consumiu todo o espaço e a coluna de título/descrição ficou com
**0 px**. Ranges de glifos ainda tinham 10,64/9,25 px, portanto o conteúdo não
coube em seu próprio retângulo. Não aceitar overflow escondido ou skip de
`clientWidth===0` como reflow. Não prosseguir à adoção dessa revisão.

Contraprova temporária: coluna direita `fit-content(40%)`, com primeira coluna
`minmax(0,1fr)` e stack de uma coluna no container ≤400 px, passou ranges dos
mesmos textos. Voltar ao builder para gerar **0.4.0/0.4.1**, preservar 0.3.x/
tooling históricos e retestar integralmente os bytes finais público/admin.
Schema, renderer, flags e filtros permanecem iguais; só a largura CSS é ajustada.

## Desenvolvimento 0.4.x → validação local

CSS recebeu exatamente dois overrides adicionais: linha compacta com
`minmax(0,1fr) fit-content(40%)`; query de contêiner ≤400 px restaura stack de
uma coluna. O patch não altera fontes, padding, renderer, schema ou helper.
Contraprova temporária integral passou nas duas views e quatro larguras com
ranges individuais; não substitui o teste dos pacotes finais novos.

**21 casos portáveis / 22 incluindo auditoria de pacotes** passaram no builder;
auditoria independente dos dois pacotes exatos verificou reconstrução integral,
cinco runtime/11 payloads/13 arquivos, onze parâmetros e avisos MIT/GPL completos.
Code/docs revisados sem bloqueadores locais; helper Home somente exportado.

| Versão local do coordenador | SHA-256 do inventário |
| --- | --- |
| 0.4.0 | `e59bd962e2befcda27e47a3368c21f9bbb9d8acfb19c8c143aabc133b6c6b626` |
| 0.4.1 | `a29140ed875d40561d8c3f9c28a15dc54b1bb6c41121129fb91de21f6341b8f3` |

Runtime LF permanece `4d34ff0852942fab9c24b680fb6bfb395af3e015d36bc6ce02bfc6a71503116d`;
CSS LF agora `b25243f0672426e8260446dc194db96ccd5a4ffb08d29ea4959b371192737dad`.
**0.4.x somente local, sem upload**. 26 arquivos 0.3.x carregados permanecem
imutáveis e não aprovados em layout; tooling histórico preservado. 92 arquivos
externos originais novamente conferidos intactos.

## Bloqueio de preservação concorrente → documentação

Antes de continuar a aceitação, a releitura de preservação **falhou** em dois
registros. Diagnóstico somente leitura mostrou:

- Registro do piloto: Key/manifest/estado/URL não mudaram, mas Modified,
  versão interna e ETag mudaram. Não atribuir autoria ou considerar ETag antiga válida.
- SiteConfig: template salvo passou de `cassiopeia` para `camap`; o JSON de estilos
  passou de uma para três entradas, com Modified/versão interna/ETag novos.

Não foram writes deste ciclo (somente assets 0.3.x e DOM de prova até aqui).
Mudanças desconhecidas são potencial trabalho de outra equipe. Não restaurar,
desabilitar CAMAP, regravar estilos ou adotar silenciosamente novo baseline.
A preferência anterior por Joomla padrão permanece registrada; cabe reconciliar
a referência e autorização com usuário/responsável antes do próximo teste integrado.

Snapshot atual tem **48 registros** e ambas páginas publicadas/sem checkout na
0.15.0. Comparação completa: **46 registros/ETags exatos**, dois alterados nos
campos acima. Isso não é preservação integral e não encerra o ciclo de Recursos.
Não inferir que oito raízes/estilos atuais seguem todas as provas antigas sem
revalidação na referência reconciliada. Nenhuma nova aprovação de raiz ou
extensão/instância Recursos foi feita por este ciclo.

Critério de retomada: definir qual configuração serve de referência; reler
todos os registros/ETags e host/root/canvas na referência aprovada; então carregar
as novas provas imutáveis e repetir público/admin, views/larguras, ranges,
formulário em memória, teclado, descoberta negativa e limpeza. Documentar o
resultado antes de iniciar Showcase. Não contornar o conflito com reset ou
reinstalação de Sample Data.

Evidências privadas ficam em `tmp/recursos-cycle/` e `tmp/recursos-row-cycle/`;
pacotes/snapshot em `tmp/recursos-adapt-agent-*`. Não publicar valores reais
de configuração, identificadores, ETags ou dados corporativos no repositório.
Sete módulos ainda não adotados; Recursos permanece em validação bloqueada.

Reexecução final com arquivos estáveis: **91 suítes aprovadas, zero skips/falhas**;
21 Recursos portáveis, checker 272 JS e child standalone 79 locais/11 skips
esperados. Build local 22/22 e reauditoria de 0.4.x passaram. Uma execução anterior
coincidiu com atualização do README e falhou no guard byte-a-byte do contributor;
não foi contada como aprovação, nenhuma asserção foi enfraquecida e a rodada
estável resolveu a falha. Esse verde local não remove o bloqueio do site.
Recibo de checkpoint privado agrega sete hashes de auditoria/preservação/estado,
com `siteAccepted:false` e `newBaselineApproved:false`. Roots/CSS temporários
removidos e sessão de navegador própria encerrada, sem restaurar registros.
