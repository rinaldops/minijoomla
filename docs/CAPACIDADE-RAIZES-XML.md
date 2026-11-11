# Capacidade de raízes XML — decisão antes da próxima expansão

> **Prova posterior (08/11/2026):** empacotador finito desenvolvido e testado
> no site com dois módulos neutros e duas revisões, sem instalação/migração ou
> alteração dos oito roots/48 itens. [Ciclo e contraprovas](CICLO-CAPACIDADE-XML.md).
> Isso prova o mecanismo, não a viabilidade dos sete módulos futuros ou capacidade
> ilimitada. As duas vagas continuam livres no host publicado 0.15.0.

> **Atualização posterior do coordenador:** Topsections adotado/validado na
> 0.15.0; **oito raízes atuais**, 48 itens e os 46 anteriores/ETags preservados.
> [Resultado do ciclo](CICLO-TOPSECTIONS.md). As projeções abaixo agora orientam
> o próximo gate offline antes de consumir as duas vagas restantes; não são
> autorização para remover/mover raízes ou instalar sete módulos em lote.

Análise local somente leitura, 08/11/2026, base `9301ab3`, em
`MINIJOOMLA-worktree02`. **Plano de decisão, não implementação nem autorização
de publicação.** Único arquivo desta frente: este documento. Não houve geração
de pacotes, import de extensões, rede, navegador, build, execução de npm,
alteração de configuração/registro, limpeza de dados ou commit.

## 1. Resultado e contagem correta

O limite implementado é **dez raízes aprovadas no total**, não dez módulos nem
dez raízes descobertas. `discover:false` conserva a aprovação para revisão e
rollback, mas **continua consumindo uma raiz**.

A [evidência de Highlights](CICLO-HIGHLIGHTS.md) registra seis raízes: duas do
piloto, duas de editorial e duas de Highlights. O [ciclo de
Topsections](CICLO-TOPSECTIONS.md) ainda está em andamento nesta referência.
Seu aceite/publicação cabe ao coordenador; não é dado como concluído aqui.
Se conservar o mesmo desenho de duas revisões, a projeção após esse ciclo é:

| Cenário | Raízes retidas/aprovadas | Folga até dez |
| --- | ---: | ---: |
| Baseline documentada após Highlights | 6 | 4 |
| Após Topsections com duas revisões, condicionado ao aceite real | 8 | 2 |
| Depois mais um módulo individual com duas revisões | 10 | 0 |
| Todos os sete módulos posteriores a Topsections, duas raízes individuais cada | 8 + 14 = 22 | Excede em 12 |
| Sete módulos futuros em duas revisões de um único grupo fechado | 8 + 2 = 10 | 0; viabilidade condicionada aos gates abaixo |

**O próximo módulo individual cabe; a continuação individual não cabe.** Na
ordem proposta, Hero consumiria as duas vagas e ainda restariam seis módulos:
Home, Recursos, Showcase, Documentação, Videoteca e Fórum. Não confundir esses
seis com os **sete** pendentes imediatamente após Topsections.

Antes de Topsections, a aritmética alternativa seria seis raízes antigas mais
quatro raízes novas: dois grupos de quatro módulos futuros, com duas revisões
por grupo. Os oito módulos dessa hipótese incluem Topsections. É somente uma
comparação de capacidade, **não recomendação para deslocar seu ciclo em curso**.
Depois de reter as duas raízes individuais de Topsections, dois grupos com duas
raízes cada já resultariam em doze; essa alternativa deixa de caber.

As contagens são projeções derivadas das evidências locais, não inventário
remoto revalidado nesta frente. A releitura da configuração efetiva é gate do
coordenador antes de qualquer expansão.

## 2. O que o código atual já permite — e o que não faz

As referências abaixo foram inspecionadas, não executadas:
Os nomes abreviados na tabela pertencem a
`src/libraries/minijoomla/application/`.

| Contrato | Referência local | Consequência |
| --- | --- | --- |
| Máximo de dez raízes, IDs únicos | `src/libraries/minijoomla/application/joomla-host-config.js:15-22` e `joomla-discovery.js:40-44` | Inclui revisões sem descoberta; não elevar o limite para destravar a adoção. |
| Raiz repetida só pode manter base/hash | `joomla-host-config.js:45-65` | Merge deduplica por ID, não por conteúdo/módulo; mudar base ou hash de ID existente é conflito. |
| Descoberta por pastas/XML | `joomla-discovery.js:75-105` | Uma raiz pode conter vários `modules/mod_nome/mod_nome.xml`; não há seleção de módulos por allowlist na configuração da raiz. |
| Identidade por elemento/chave | `joomla-manifest.js:91-106,130-140` | Pastas, XML homônimo, entrypoint canônico e `mj:key` permanecem coerentes por módulo. |
| Mapeamento no inventário | `joomla-discovery.js:138-175` | `verifyApproval` exige `inventory.moduleKeys[descriptor.element] === descriptor.key` e CSS correspondente. Mapas podem conter vários módulos. |
| Verificação de todos os payloads | `joomla-discovery.js:151-172` | Verificar um candidato lê **todo o inventário** da raiz, não só seu módulo. |
| Registro individual desabilitado | `joomla-extension-installer.js:50-69` | Agrupar arquivos não registra, habilita ou cria instâncias dos demais módulos. |
| Upgrade/rollback | `joomla-extension-installer.js:83-116` | Verifica identidade/schema/instâncias/ETag e revisão anterior aprovada; não migra automaticamente JSON legado. |
| Vínculo JS/CSS por revisão | `joomla-package-assets.js:4-14` e `joomla-host-config.js:35-39` | Manter mapa explícito por entrypoint; rollback não deve receber CSS latest. |

O perfil genérico `joomla-xml-v1` e os mapas existentes já representam múltiplos
módulos em uma raiz. **Não é necessário inventar um novo perfil genérico para
essa estrutura.** Isso não prova a existência de um preparador de agrupamento
seguro: `scripts/prepare-module-adoption.js:43-45,128-170,175-217` exige seleção
individual, fechamento delimitado e recusa `all` na interface de adoção.
O uso interno do gerador original para obter arquivos em snapshot não equivale
a um pacote agrupado aprovado. Qualquer ferramenta futura será uma frente
offline separada, com contrato e testes próprios, não uma alteração implícita
desse preparador ou do core.

### Descoberta e seleção sem escolha silenciosa

- A raiz agrupada descoberta enumera **todos** os XML candidatos nela presentes.
  Ocultar botões ou selecionar somente Hero na UI não reduz o inventário nem
  cria uma aprovação parcial de raiz.
- Duas raízes descobertas com a mesma chave/identidade geram `conflict` e perdem
  aprovação de candidato; não há prioridade automática da versão mais nova.
  Escolher a origem na composição confiável, mantendo apenas uma revisão
  descoberta por identidade. O grupo anterior continua aprovado com
  `discover:false`.
- `mergeExtensionsConfigs` descobre somente as raízes presentes e marcadas na
  **última configuração** recebida. O último envelope deve declarar explicitamente
  as origens que se deseja descobrir; não concatenar planos esperando que todas
  continuem ativas. Preservar todos os IDs/bases/hashes e vínculos CSS antigos.
- `scanUnregistered` filtra chaves já cadastradas; a UI em
  `src/administrator/components/com_installer/src/Model/discovery.js` também
  omite escolhas sem ação de revisão e bloqueia legados/duplicatas. Ausência de
  escolha na tela **não significa** raiz livre, módulo removido ou licença aceita.
- Busca incompleta não produz aprovação instalável. Conflito JSON/XML existente
  exige decisão/migração assistida, nunca apagar o registro para liberar a chave.

## 3. Invariantes: não mover as oito raízes existentes

Manter intactos os pacotes do piloto, editorial, Highlights e, quando aceitos,
Topsections: diretórios, bytes, inventários, aprovação do host e assets. Guardar
em evidência privada, por registro e revisão anterior, pelo menos:

- ID/key/identidade instalados e URL do entrypoint;
- `miniJoomla.rootId`, `baseUrl`, `manifestPath`, `fingerprint` e `inventoryHash`;
- `previousRevision`, vínculos JS/CSS e referências das instâncias;
- JSON próprio/desconhecido, settings, posição/ordem/atribuição e ETags relevantes.

Copiar um pacote antigo para uma raiz agrupada **não transfere** a aprovação
persistida. `verifyRevision` procura o `rootId` armazenado, exige seu
`inventoryHash` e revalida manifesto/arquivos; upgrade ainda compara entrypoint
antigo com o registro. Novo endereço/hash exige nova revisão, não simples
relocação. Remover a origem antiga invalida essas guardas mesmo que a cópia
tenha JS idêntico. Não renomear ID nem fabricar metadata para contorná-las.

**Rollback não libera automaticamente uma raiz.** Após reverter, a raiz antiga
pode voltar a ser a fonte atual de código/CSS; outros módulos de um grupo podem
continuar na nova. Desabilitados, instâncias na lixeira e referências de revisão
também precisam ser considerados. O runtime guarda uma revisão anterior por
registro, não um histórico infinito nem um coletor de pacotes.

Este plano não prevê exclusão/retirada de raiz. Eventual descomissionamento é
decisão separada, condicionada a prova completa de ausência de referências
atuais, anteriores e de recuperação, com autorização própria. Sem essa prova,
reter. Não limpar dados, remover arquivos ou descartar JSON desconhecido para
produzir capacidade artificial.

## 4. Desenho finito para módulos novos, se tecnicamente viável

Reservar as duas vagas restantes para **um grupo de até sete módulos**, com
duas revisões imutáveis de raiz. Exemplos de nomes locais propostos, não
artefatos existentes nem destinos corporativos:

- `tmp/xml-future-group-r1/` / ID proposto `xml-future-group-r1`;
- `tmp/xml-future-group-r2/` / ID proposto `xml-future-group-r2`.

Cada revisão possui um único `MANIFEST-SHA256.json`, seu pin SHA-256 exato e
configuração aprovada própria. ID/base novos por revisão; nunca acrescentar
arquivos, trocar helper ou recalcular inventário dentro de raiz congelada.
O mesmo subconjunto explícito de módulos deve existir nas duas revisões para
o plano de duas versões por módulo. Não transportar os quatro módulos antigos.

| Pasta em ambas as raízes propostas | Key preservada |
| --- | --- |
| `modules/mod_hero/` | `camap.mod_hero` |
| `modules/mod_home/` | `camap.mod_home` |
| `modules/mod_recursos/` | `camap.mod_recursos` |
| `modules/mod_showcase/` | `camap.mod_showcase` |
| `modules/mod_documentation/` | `camap.mod_documentation` |
| `modules/mod_videoteca/` | `camap.mod_videoteca` |
| `modules/mod_forum/` | `camap.mod_forum` |

### Composição de arquivos, não concatenação de controles

1. Entradas são cópias/snapshots novos e confiáveis de revisões delimitadas por
   módulo; fontes CAMAP2 e pacotes anteriormente preparados permanecem intactos.
   Selecionar **um subconjunto finito nomeado**, nunca `all` por conveniência.
2. Conservar XML/defaults/schema/key do módulo e layout canônico
   `modules/<element>/<element>.xml` + `<element>.js`; media usa destino próprio
   `media/<element>/`. Implementações ficam em namespace próprio por elemento,
   por exemplo `libraries/camap/extensions/camap/<element>/`.
3. Inventariar a união do **fechamento real JS/CSS/imports** de cada módulo,
   incluindo bibliotecas/helpers, avisos/licenças e metadata do plano. Não basta
   copiar XML, wrappers ou só `descriptor.requiredFiles`: imports JS precisam
   de parser/fechamento offline; o verifier runtime verifica hashes, não descobre
   sozinho dependências omitidas de JS.
4. `moduleKeys` relaciona cada pasta ao alias exato; `moduleStyles` relaciona
   cada key a caminhos relativos da raiz; `moduleStyleRevisions` do host liga
   cada URL JS nova ao CSS daquela revisão, na ordem declarada. Regerar um
   inventário único a partir dos bytes finais e conferir todos os mapas.
5. Não mesclar por sobrescrita `MANIFEST-SHA256.json`, `host-config.json`,
   `adoption-plan.json` ou notices homônimos de pacotes individuais. Controles
   do grupo são novos; proveniência/decisões individuais ficam identificadas
   sem perder avisos. Inventário e host-config não se inventariam a si mesmos.
6. Caminho idêntico compartilhado só pode deduplicar dentro da raiz quando os
   **bytes forem exatamente iguais**. Igualdade funcional, nome igual ou
   normalização posterior não autorizam substituição. Comparar bytes além do
   hash; rejeitar colisão de case/caminho. O helper
   `libraries/camap/extensions/camap/_shared/render.js` é ponto de conflito
   provável entre adaptações, não equivalência já comprovada nesta frente.
7. Helpers divergentes exigem namespaces privados por módulo/revisão e imports
   locais revisados, ou código comum byte-idêntico comprovado para todos os
   consumidores. Essa adaptação gera novos bytes/revisões e contraprovas de
   cada consumidor; não escolher silenciosamente uma variante nem alterar os
   helpers das raízes antigas. Se o contrato do preparador não permitir a
   variante, bloquear e projetar/testar a ferramenta offline específica.

Dois pins de raiz podem então cobrir sete módulos em duas revisões (**duas
aprovações de raiz em vez de quatorze**), mas cada módulo mantém sua identidade,
revisão, contrato, proveniência e aceite individual. Isso não é licença coletiva,
migração em lote, registro automático ou autorização de habilitação dos sete.

As revisões XML de cada módulo devem ter versão/fingerprint coerentes com o
ciclo planejado, mantendo o contrato de parâmetros compatível. Mudar só a base
da cópia com XML idêntico não garante ação Atualizar na UI, que compara o
fingerprint do manifesto. A troca de raiz descoberta não atualiza registros:
durante aceites individuais, módulos podem permanecer em r1 enquanto outros
usam r2; ambas as raízes e seus vínculos CSS continuam necessários.

### Limite decisivo: duas revisões congeladas não são extensíveis

A economia só existe se o subconjunto e os fechamentos puderem ser preparados,
revisados e congelados antes de aprovar as duas raízes. O perfil atual não permite
aprovar somente Hero de um inventário e ir acrescentando Home/Recursos depois.
Ainda que só Hero seja instalado, verificar seu pacote lê arquivos dos outros
módulos inventariados; a raiz inteira precisa estar íntegra e ter código revisto.

**Não há demonstração de viabilidade incondicional para os sete restantes.**
Renderers/adaptações e direitos ainda não resolvidos podem impedir o congelamento.
Se preparar todo o grupo exigir antecipar desenvolvimento que o usuário só
autorizou após concluir o ciclo do módulo anterior, isso também é bloqueio:
agrupamento não revoga a sequência **Desenvolvimento → Teste → Análise →
Validação → Documentação, completa por módulo**. Não chamar preparação conjunta
de simples otimização para contornar essa regra.

Um grupo menor cabe aritmeticamente, mas não resolve a continuação total:
dois pins para Hero/Home, por exemplo, deixam as outras cinco chaves sem vagas
e não permitem inclusão posterior imutável. Uma terceira revisão do grupo,
necessária por correção descoberta no site, também exigiria a décima primeira
raiz enquanto as dez atuais estiverem referenciadas. **Não prometer expansão
ilimitada nem correções futuras sem nova decisão de capacidade.**

## 5. Gate offline separado após Topsections, antes de atingir dez

Recomendação ao coordenador: concluir/analisar/validar/documentar Topsections
primeiro, sem mudanças de capacidade nesta rodada. Em seguida abrir o gate
offline abaixo **antes de comprometer as duas últimas vagas com Hero individual**.

1. **Rebaseline privada:** conferir seis/oito raízes efetivas, IDs/bases/pins,
   revisões instaladas/anteriores e mapas CSS; capturar referências de todos os
   registros/instâncias pertinentes sem publicar URLs, GUIDs ou JSON corporativo.
2. **Viabilidade e escopo:** decidir se um único grupo fechado dos sete pode ser
   preparado dentro da sequência por módulo já autorizada. Especificar revisões,
   subset, dependências e direitos por módulo/helper/CSS. Documentação, Videoteca,
   Fórum e Showcase têm proveniência/serviços próprios a revisar; comprovação do
   grafo editorial não se estende automaticamente a eles.
3. **Tooling delimitado futuro:** definir preparador de união/cópias imutáveis,
   revisão de código sem colisões e finalização de controles. Não implementar
   agora, não modificar genericamente o perfil nem usar fallback de regex para
   fechamento. Nenhuma importação de fonte não revisada para descobrir contrato.
4. **Limites preservados:** até 500 payloads inventariados por raiz, inventário
   e cada XML até 64 KiB, soma de payloads até 10 MiB; scan com defaults de 500
   pastas/200 candidatos/60 s. Medir o resultado real incluindo helpers/notices;
   sete nomes não provam que bytes e tempo cabem. Não aumentar caps para aceitar.
5. **Contraprovas offline focais:** duas raízes multi-módulo; mapas completos;
   cópia/hash/bytes; colisão de path/case/helper; dependência ausente/transitiva;
   tamper em arquivo de outro módulo bloqueando o candidato; raízes duplicadas
   descobertas em conflito; retained `discover:false` verificável; scan incompleto;
   CSS por entrypoint e preservação integral dos oito pins anteriores. Reusar
   parser/serviço de integridade atuais por portas locais, sem rede ou build
   completo. São testes futuros, **não executados nem aprovados neste documento**.
6. **Aceite por módulo:** somente após os gates de preparo/direitos daquele
   escopo, discovery/registro desabilitado/confirmação individual, instância
   explícita, edição, estados, CSS, ETags, toggles, upgrade/rollback e remoção
   protegida. Documentar o ciclo antes do próximo desenvolvimento; nada de
   autoregistro, instalação em lote, reinstalação de amostra ou cleardata.
   Revalidar inventário completo também na revisão antiga: **todos os arquivos
   do pacote antigo devem continuar disponíveis e exatos** para rollback.

Se qualquer gate impedir a composição finita dentro de dez, **interromper a
expansão e registrar o bloqueio**. Não resolver removendo raízes referenciadas,
substituindo metadados instalados, descartando JSON desconhecido, elevando o
limite ou declarando suporte ainda não implementado.

## 6. Decisão resumida

- **Agora:** preservar a baseline e a rodada Topsections do coordenador.
- **Após seu aceite:** tratar oito raízes retidas como custo fixo; duas vagas,
  sete módulos restantes, não seis.
- **Antes de Hero consumir as duas vagas:** gate offline de um grupo futuro
  finito com duas revisões, somente se código/proveniência/limites e sequência
  individual forem compatíveis. Estrutura já representável no perfil atual;
  preparador agrupado e contraprovas ainda pendentes.
- **Sem viabilidade comprovada:** não há caminho seguro demonstrado para todos
  os módulos com o limite atual. Manter o bloqueio explícito, não fabricar folga
  nem aprovação. Este documento não altera nenhum gate do
  [contrato de evolução](CONTRATOS-EVOLUCAO-XML.md) ou da
  [matriz de adoção](MATRIZ-ADOPTION-MODULOS.md).
