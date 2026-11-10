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
