# Evolução XML — contratos e gates aprovados

Data: 06/11/2026. Complementa o [relatório de escopo](AVALIACAO-E-ESCOPO-2026-11-06.md)
e o [perfil de módulos implementado](EXTENSOES-JOOMLA.md). **Contrato de evolução,
não anúncio de suporte já implementado**. A descoberta atual continua restrita
a módulos JavaScript de site; os novos perfis abaixo exigem código e testes.

## 1. Adoção dos dez módulos externos

Inventário consultado somente em leitura no gerador do projeto externo
`CAMAP2/tools/prepare-joomla-modules.js`; não foram alterados fontes/pacotes desse
projeto. O gerador já lista onze módulos e aceita seleção `all` ou piloto.
Preparar cada pacote individualmente requer evolução coordenada do gerador;
o suporte a `all` não constitui aceite individual nem instalação de dez módulos.

| Ordem sugerida | Elemento | Key a preservar |
| --- | --- | --- |
| Piloto, anterior à expansão | `mod_camap_corpmessage` | `camap.mod_camap_corpmessage` |
| 1 | `mod_camap_editorial` | `camap.mod_camap_editorial` |
| 2 | `mod_camap_highlights` | `camap.mod_camap_highlights` |
| 3 | `mod_camap_topsections` | `camap.mod_camap_topsections` |
| 4 | `mod_hero` | `camap.mod_hero` |
| 5 | `mod_home` | `camap.mod_home` |
| 6 | `mod_recursos` | `camap.mod_recursos` |
| 7 | `mod_showcase` | `camap.mod_showcase` |
| 8 | `mod_documentation` | `camap.mod_documentation` |
| 9 | `mod_videoteca` | `camap.mod_videoteca` |
| 10 | `mod_forum` | `camap.mod_forum` |

Essa ordem é planejamento, não classificação comprovada de risco. Antes de
cada adoção: inventariar dependências de outros serviços/componentes do módulo,
schema/defaults efetivos e contratos de render; não presumir que forum/vídeos/
documentação funcionam com apenas um wrapper ou sem sua infraestrutura.

Leitura adicional dos fontes externos confirmou limites a preservar no aceite:
`mod_forum` é resumo sem rede, recebe `settings.topics`, chips estáticos e deep
links para um componente externo; `mod_videoteca` recebe `settings.videos`,
controles/carrossel estáticos sem lifecycle interativo nem resolução de streams;
`mod_documentation` recebe categorias/artigos/paginação pré-computada em settings,
sem componente PHP. O empacotamento não transforma esses recursos em serviços
de fórum/vídeo/documentação completos. Se necessário, dados/interações deverão
ter contrato adicional e decisão explícita, sem simular suporte na interface.

### Gate individual obrigatório

1. Piloto: aceite real instalar/habilitar/instância/revisão/reversão concluído.
2. XML homônimo e entrypoint JS canônico, mesma key, parâmetros sem segundo
   manifesto manual; revisar limites/array-object/defaults e dados legados.
3. Pacote novo imutável, grafo JS/CSS/imports fechado, bytes/MIME/hashes e avisos;
   nenhuma dependência corporativa embutida no core genérico.
4. Scan por portas em memória/arquivo confiável, zero import/escrita; discovery
   identifica conflitos e falhas incompletas, instalação revalida inventário.
5. Import/render/CSS real isolado, escaping/estados vazio/erro/foco e cleanup.
6. Instalação desabilitada sem instância automática; registro pré-existente
   exige prévia de migração, nunca excluir dados para contornar identidade.
7. Aceite no host com ETags, edição, desabilitar/reativar, upgrade/rollback,
   dependências de remoção, snapshots privados e recuperação por etapa.

## 2. Perfil XML de plugins — evolução proposta

### Identidade e layout

- Manifesto em `plugins/<grupo>/<elemento>/<elemento>.xml`.
- `<extension type="plugin" group="<grupo>">`; elemento e atributo `plugin`
  do único `<filename>` de entrada devem coincidir com pasta/XML.
- Identidade `(plugin, client, group, element)`; client aceito deve ser declarado
  pelo perfil/raiz. `site` e `administrator` são domínios de lifecycle distintos.
- Key preservada por `mj:key`; nova key determinística não colide com nativos.
  Não deduzir confiança ou contexto a partir de nome de arquivo ou DOM.

### Eventos e parâmetros

O grupo não autoriza evento arbitrário. Cada perfil define allowlist de eventos
consumidos: preparação/exibição de conteúdo e busca no site; eventos de save na
administração. Plugins administrativos não compartilham manager com o público.
Entrypoint exporta contrato declarativo JS existente, nunca strings avaliadas.
XML informa dados de eventos/params, não importa JS para descobrir contratos.
Se a declaração divergir do export real ao ativar, rejeitar com erro seguro.

Reusar tipos/limites/own-properties do parser de parâmetros atual. Nome de campo
reservado, default inválido, filtro PHP/showon obrigatório e campo customizado
sem consumidor tornam candidato não instalável; não ocultar silenciosamente.
Grupos legados desconhecidos continuam legíveis pelo fluxo JSON, não são
reclassificados automaticamente no novo perfil.

### Segurança, ciclo e aceites

- Scan sem executar JS/CSS, raiz finita aprovada, identidade/fingerprint e
  inventário específico de plugins; não reutilizar `moduleKeys` por conveniência.
- Registro desabilitado; habilitar separado. CSS/dependências somente aprovados
  pelo host e sem URLs obtidas de parâmetros persistidos.
- Reconciliar ordem/params/revisão, cache e init/finalize exatamente uma vez;
  erro de import/hook isolado, stop/import obsoleto não registra plugin tardio.
- Upgrade/rollback com identidade/grupo/contexto fixos, ETags/snapshots e revisão
  anterior disponível; schema diferente segue migração assistida.
- Desinstalar não deve excluir dados ou código como efeito colateral. Definir
  dependências/configuração relevante antes de liberar remoção.
- Testar grupos/contextos, tentativa de evento não suportado, veto de save,
  pós-save falho sem mascarar persistência, duas sessões e falhas de import.

## 3. Perfil XML de templates — evolução proposta

- `templates/<elemento>/templateDetails.xml` para site;
  `administrator/templates/<elemento>/templateDetails.xml` para administração.
- `<extension type="template" client="site|administrator">`; elemento/client
  coerentes com raiz/caminho, identidade e key explícitas, sem duplicar nativos.
- Entrypoint JS de template definido pelo perfil MiniJoomla; não executar PHP.
  `<positions>` com nomes únicos/limitados e aliases legados preservados;
  `<config>` com parâmetros do mesmo catálogo usado pelo painel/runtime.
- Inventário próprio relaciona identidade/client, arquivos, CSS e demais assets;
  caminhos/URLs/fontes/imagens/dependências validados no pacote, não apenas link.
- **Descobrir/registrar não seleciona um default**, não duplica estilos e não
  sobrescreve configuração salva. Definir ativação separada e explícita;
  carregar template incompatível com client deve ser recusado.
- Catalogar estilos existentes, IDs, default e uso por configuração/menus antes
  de upgrade/remover. Param schema/posições incompatíveis exigem prévia assistida.
- Runtime mantém replacement/cleanup de recursos e lifecycle do template anterior;
  rollback recupera pacote/configuração, sem restaurar canvas inteiro obsoleto.
- Aceites: laterais/posições vazias e preenchidas, estilos coexistentes, escolha
  explícita do padrão, navegação/foco/erro de CSS/import, reversão e remoção usada.

## 4. Migração assistida JSON → XML e parâmetros incompatíveis

### Contrato inicial: planejar não é aplicar

O primeiro incremento deve ser uma função pura de prévia, sem rede, imports de
extensões, escrita ou alteração dos objetos recebidos. Entradas: registro
instalado/ETag, todas as instâncias relevantes/ETags, XML alvo e mapeamentos de
nomes explícitos. A prévia informa recusas e mudanças de valores/defaults por
registro e conserva dados desconhecidos próprios. **Não verifica a aprovação
remota do pacote**; validação/integridade do discovery permanece gate posterior.

Identidade/type/key não podem mudar; JSON legado é recuperável pelo snapshot,
não pela fabricação de uma revisão XML anterior. Valores incompatíveis exigem
edição assistida/validação, não truncamento, coerção livre ou descarte de dados.
Não executar callbacks fornecidos como mapeamento. Instâncias desabilitadas e
na lixeira também contam. Ausência de ETag, snapshot parcial, JSON corrupto,
IDs duplicados ou mapeamento ambíguo bloqueiam a prévia.

### Futuro executor: gates antes de qualquer gravação

1. Usuário revisa mudanças, recusas/defaults e confirma explicitamente.
2. Revalidar XML/inventário aprovado e revisão/configuração do host; reler o
   registro e **todas** as instâncias envolvidas com seus ETags, comparar ao plano.
3. Janela de manutenção/guardas de escrita por todas as sessões: desabilitar só
   o runtime não impede edição administrativa. Sem isso ou mecanismo equivalente,
   não prometer migração atômica entre listas.
4. Registrar diário privado e snapshots exatos, inclusive strings JSON/ETags e
   referências de pacote anterior. Cada escrita usa IF-MATCH específico.
5. Alterar parâmetros/registro por sequência documentada; verificar/reler cada
   etapa. Falha parcial interrompe, sem retry cego ou update com `*`.
6. Retomada compara diário/estado atual. Rollback usa ETags relidos e não apaga
   edições concorrentes: conflito exige resolução manual, não restauração massiva.
7. Liberar edição/ativação só após comprovar compatibilidade e concluir diário.

No primeiro incremento, `apply`/`rollback` de migração **não existem**; upgrade
automático incompatível continua bloqueado. Testes de prévia não autorizam dados
reais nem substituem testes de falha parcial/concorrência/recuperação do executor.

### Primeiro incremento local implementado

`src/libraries/minijoomla/application/extension-migration-plan.js` expõe
`planExtensionMigration({ extension, instances, completeInstances: true,
targetXml, target: { baseUrl, manifestPath }, parameterMap })`. As flags
`executionAvailable/packageVerified/remoteCompletenessProven` permanecem false.
`ready/convertible` indica somente compatibilidade local, nunca autorização.

Snapshots completos próprios incluem `id/etag/enabled`, identidade/URLs/JSON da
extensão e `extensionKey/settingsJson` das instâncias; ETags fortes próprios não
enumeráveis das linhas SPMIDDLE são capturados como dados sem executar getters.
Relatório profundamente congelado informa schema/defaults, renomes/conversões e
erros por instância. Não imprimir ou distribuir seus snapshots privados.

Limites deste incremento: apenas módulos; sem executor/UI de aplicação nem
`parameterEdits`; valores inválidos exigem nova captura explicitamente corrigida.
Schemas que redeclaram parâmetros avançados do runtime, inclusive XML nativo,
são recusados, não duplicados/mesclados silenciosamente. Templates/plugins terão
planos próprios quando seus perfis e dependências forem implementados.

## 5. Exclusões e publicação

i18n, SEO integrado ao host, histórico e check-in/check-out de artigos permanecem
fora desta etapa. Uma revisão anterior de extensão é rollback de código/metadados,
não histórico editorial. Publicação/distribuição pública/alteração de tenant ou
do projeto externo não são efeitos automáticos destes contratos.
