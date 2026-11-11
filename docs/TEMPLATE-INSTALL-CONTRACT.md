# Templates instalados — contrato genérico incremental

## Primeiro incremento: posições

Templates instalados podem declarar posições próprias em `positionsJson`,
sem modificar Cassiopeia/Atum ou adicionar seu código ao núcleo. Este incremento
reconcilia somente essa parte da contribuição local da principal.

- `STRUCTURAL_TEMPLATE_POSITIONS` conserva as posições integradas e o alias
  `TEMPLATE_POSITIONS` mantém compatibilidade.
- `templatePositions()` aceita lista densa de 1..100 nomes estruturais ou
  bem-formados, elimina duplicados e não executa getters/hooks. `component`
  é metadata do template, nunca posição atribuível a módulo.
- O catálogo administrativo une posições estruturais/catch-all às posições
  dos templates registrados, inclusive desabilitados. Uma nova atribuição
  customizada exige declaração atual. Nome bem-formado não é aprovação sozinho.
- Na edição, uma posição existente fora do catálogo permanece selecionada e
  identificada; renomear não a troca silenciosamente. Duplicar é nova criação
  e exige declaração atual. Movimentos nativos não dependem de template estranho.
- O runtime relê metadata antes do import, recusa corrupção e entrega somente
  posições do template ativo. Não regrava registros; conserva fallback legado
  para posições desconhecidas e mantém as posições builtin.
- Assets de templates instalados devem pertencer à mesma origem/protocolo do
  host; credenciais, URL externa/traversal e getter não iniciam import de código.

Nenhuma nova coluna é necessária para posições. Não registrar, habilitar ou
selecionar template automaticamente; usar as ações administrativas explícitas.

### Contrato do entrypoint JavaScript

O módulo exporta `renderShell` preferencialmente, ou uma função `default`. O
runtime fornece `{ config, menus, breadcrumbs, content, modules, busy }` e espera
o fragmento HTML do shell. Posições próprias alimentam `modules`; parâmetros
declarados/defaults/estilo selecionado chegam por `config.templateParams`, mantendo
desconhecidos próprios. O renderer deve escapar dados textuais e consumir o HTML
preparado pelos componentes conforme seu contrato.

`bindShell(root)` é opcional e deve ser função quando declarado. Pode devolver
uma função de cleanup; o aplicativo a chama antes de substituir o shell e no
stop, sem executar novamente o bind de uma navegação obsoleta. Não é contrato PHP.
Assets relativos são resolvidos contra `documentRef.baseURI` (ou `import.meta.url`
como fallback), **não contra o manifesto**. Use URLs explícitas aprovadas para
pacotes publicados e não prometer resolução por manifesto sem implementação.

## Limites deste checkpoint

**Incremento de parâmetros declarado posteriormente:** definições e CSS juntos
num envelope `minijoomla-template-metadata-v1` no campo `Styles` existente, sem
criar `ParamDefinitionsJson`. Manifestações aceitam `paramDefinitions`; o registro
guarda a metadata sem instalar/selecionar código. Formulários usam as definições,
validam tipos/limites e preservam metadata futura e outros estilos. Metadata
inválida é bloqueada, não convertida em definições vazias. A composição pública
conserva `templateStylesJson` exato e usa a definição do template ativo.
[Ciclo de parâmetros e limites](CICLO-TEMPLATES-PARAMETROS.md).
Validação funcional: 118 suítes aprovadas e ensaio isolado em memória no
SharePoint, com preservação das listas/páginas/host aceitos. Não é aprovação da
instalação de templates externos nas listas nem adaptação XML completa.
XML de plugins/templates continua pendente.
Preview `--extra-root` e o novo módulo nativo da principal não integram este ciclo.
CAMAP-V3 continua externo, e CAMAP integrado permanece referência temporária.

Teste local e ensaio isolado SharePoint estão em
[CICLO-TEMPLATES-POSICOES.md](CICLO-TEMPLATES-POSICOES.md). O ensaio usa catálogo
e persistência em memória: não é instalação real do template nas listas aceitas,
nem deploy do núcleo, nem aceite integral de acessibilidade/distribuição.

## Preview local: seleção por catálogo

A demo `examples/index.html` aceita `?template=<chave>` para os três builtins
(`default`/`cassiopeia`/`camap`) **ou** qualquer chave habilitada já existente
no catálogo local de templates (por exemplo, um template instalado via
`serve-local.js --extra-root`, documentado em [LOCAL-DEMO.md](LOCAL-DEMO.md)).
Chave desconhecida ou desabilitada é rejeitada com o mesmo erro genérico; a
seleção pela query nunca grava `templateKey` no storage de demonstração nem
ativa/registra o template como padrão. Sem query, a demo continua usando o
template salvo normalmente.

Validado por `scripts/test-standalone-examples.js`: cria um registro habilitado
no catálogo em memória, seleciona-o pela query, confirma ausência de escrita
adicional no storage e recusa a mesma chave após desabilitá-la. Nenhum seed/
template CAMAP-V3 foi incorporado; é preview puramente local, sem publicação.

Teste real complementar: o mesmo grafo de módulos (`src/`, `examples/`) foi
publicado numa pasta de prova nova e isolada no SharePoint, fora das releases
aceitas, e exercitado numa página administrativa real via FIORI-AUTO (iframe
dedicado, sem `<script>` inline — CSP do SharePoint bloqueia scripts inline
mesmo dentro de um iframe filho; o entrypoint usa `<script type="module" src>`
externo com cache-buster). Confirmadas as seis condições do contrato: chave
desconhecida rejeitada, chave habilitada selecionada (`data-template="cassiopeia"`),
nenhuma escrita extra no storage ao selecionar, chave desabilitada rejeitada como
desconhecida, e fallback ao template salvo preservado. Os **48 registros/ETags
de dados, o hash do host 0.16.1 e o canvas das duas páginas aceitas permaneceram
idênticos**; apenas a versão numérica do arquivo da página administrativa
avançou sem alteração de conteúdo, consistente com leitura/sessão do SharePoint,
não uma escrita de conteúdo. Sem instalação/registro persistente de extensão.
