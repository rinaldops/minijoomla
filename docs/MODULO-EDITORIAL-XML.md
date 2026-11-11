# Editorial CAMAP: preparação XML individual

> **Evolução posterior:** adaptação restrita corrigiu links/itens e preservou
> aviso MIT herdado/GPL das alterações; editorial 0.3.0 adotado individualmente
> na 0.13.0. [Resultado real](ETAPA-2C-EDITORIAL-ADOTADO.md).
> Bytes/bloqueios deste relatório permanecem válidos para a fonte original
> não alterada e os pacotes históricos 0.2.x, não para a adaptação nova.

**Preparado offline; não instalado, não migrado e não aprovado para publicação.**
A chave é `camap.mod_camap_editorial`. Esta extensão não piloto depende do
gate completo do piloto e de autorização individual do coordenador. A preparação
não muda o núcleo, frontend, host, registros atuais, tenant ou fonte CAMAP2.

## Contrato real

O perfil `joomla-xml-v1` usa a implementação real de CAMAP2, seu helper e
`db.css`, com wrapper/XML do gerador original. Revisões `0.2.0` e `0.2.1`
mantêm **a mesma chave e os mesmos quatro parâmetros, na mesma ordem**:

| Campo | Schema CAMAP | XML/runtime | Default | Consumo real |
| --- | --- | --- | --- | --- |
| `title` | `string` | `text` | `Destaques` | Texto escapado em `<h2>` |
| `limit` | `number` | `number` | `3` | Quantidade máxima de itens exibidos |
| `items` | `array` | `json`, `valueType: array` | `[]` | Lista ordenada de publicações |
| `catalogTarget` | `string` | `text` | `""` | Link opcional “Ver todas as publicações” |

Os labels XML originais são os próprios nomes dos campos. Não foram adicionados
campos, limites declarativos, regras de item ou serviços que a fonte não possui.
`0.2.1` altera somente a versão XML e os metadados de revisão, não o renderer,
defaults ou labels. Os títulos “0.2.0”/“editado” usados no teste são configurações
neutras da instância, não um build label inventado dentro da fonte.
`manifestJson` é um **objeto JSON** com `params` como array de definições; não é
um array no nível raiz. O núcleo normaliza `limit` numérico e o JSON de `items`
antes da persistência. O envelope de configurações também precisa ser objeto.

Exemplo neutro e mínimo, sem conteúdo da amostra original:

```json
{
  "title": "Editorial local",
  "limit": 2,
  "items": [
    { "title": "Publicação A", "url": "#/article/local-a", "summary": "Resumo local A" },
    { "title": "Publicação B", "url": "#/article/local-b" }
  ],
  "catalogTarget": "#/category/local"
}
```

Cada item deve ser um objeto de dados com `title` e `url` como strings;
`summary` é opcional. **Essa regra de item é uma exigência de revisão, não
validação garantida pelo XML atual.** O núcleo valida o array/JSON, não o schema
de cada item. `items: [null]` passa pela validação estrutural e lança erro no
renderer real; o registry do núcleo isola a falha com mensagem `role="alert"`.
É bloqueio para dados não revisados, não motivo para editar silenciosamente a
fonte externa.

Ao editar parâmetros já persistidos, utilizar a normalização do núcleo com
`keepUndeclared: true`: preserva dados legados desconhecidos como dados JSON,
sem executar getters/`toJSON` nem poluir protótipos. A suíte testa round-trip,
cópia sem mutação e rejeição de JSON/tipos inválidos. Não simula um backend
próprio nem declara escrita administrativa/remota.

## Visualização e limitações

- O primeiro item é o principal, com link e resumo; os demais exibem somente
  links na coluna secundária. A ordem vem do array: não há ordenação por data,
  catálogo remoto, paginação, busca ou backend editorial automático.
- Título, títulos de itens, resumo e atributos de link recebem escape HTML.
  Strings com `<img>`, `<script>`, aspas e `&` aparecem como texto, não HTML rico.
- **Imagens não são renderizadas.** `image`, `alt` e `html` não são campos do
  módulo e são ignorados como propriedades de item. Não há suporte de `alt` a
  aprovar neste renderer; se imagens forem adotadas depois, exigir implementação
  e testes próprios de URL/escape de `alt`, sem prometer esse recurso hoje.
- `showTitle`, `headerTag` e `headerClass` não são consumidos pelo módulo:
  o `<h2>` próprio permanece. O wrapper de classe do registry é independente.
- `limit` não declara `min`/`max` no XML. A implementação limita o slice a 100;
  `0` volta a 3 por `|| 3`, negativos resultam em nenhum item e frações são
  truncadas pelo slice. Não alterar essas semânticas por um schema inventado.

Estados recebidos explicitamente pelo renderer:

| Estado | Resultado |
| --- | --- |
| `loading` | “Carregando…” com `role="status"`, `aria-live="polite"` |
| `error` | Mensagem segura com `role="alert"` |
| `empty` | “Nenhum destaque publicado no momento.” sem seção/CTA |
| `ready` / outro | Seção real; lista vazia usa “Nenhum conteúdo disponível.” |

Não há fetch ou lifecycle de serviço editorial: testar esses estados por
argumento não comprova carregamento assíncrono remoto.

### Bloqueio de URLs da fonte real

O helper `safeUrl` aceita prefixos `#`, `/` e `https://` e substitui outros por
`#`. `javascript:`, `data:`, `vbscript:` e HTTP direto são recusados; o CTA com
fallback `#` é omitido. Links aceitos recebem escape de atributo.

Entretanto, o filtro é **somente um teste de prefixo**. Aceita `//host/path`,
barra seguida de backslash e HTTPS com credenciais; isso não equivale à política
de URL segura do núcleo. O campo XML `catalogTarget` é `text`, não `url`, e os
links dentro de `items` também não passam pela validação URL do núcleo.
As reproduções locais não navegam nem fazem requisições.

Um valor `#javascript:…` é um fragmento, não o scheme executável `javascript:`;
isso foi distinguido nos testes, sem alegar execução que não ocorreu.

**Adoção fica bloqueada para exposição até revisão/correção autorizada da fonte
externa e nova geração/auditoria.** Nenhuma alteração ao helper compartilhado
ou aos módulos externos foi feita. Uma mudança nesse helper teria impacto em
outros módulos e requer escopo próprio, não uma correção ampla implícita.

## Pacotes e CSS

Saídas locais novas: `tmp/editorial-adoption-0.2.0/` e
`tmp/editorial-adoption-0.2.1/`. Cada revisão tem sete arquivos inventariados
(XML, wrapper, implementação, helper, CSS, aviso e plano), mais
`MANIFEST-SHA256.json` e `host-config.json`: **nove arquivos no total**.
O destino server-relative proposto e os detalhes privados ficam apenas nos
artefatos `tmp/editorial-adoption-*`; não são configuração aplicada ao host.
As saídas recusam sobrescrita, inclusive em uma nova execução do preparador.

O pacote contém uma única extensão e um único CSS: `db.css`. O mapa de estilos
liga a URL do entrypoint **da revisão** ao CSS dessa mesma revisão; não usar
fallback para o CSS mais recente em rollback. O CSS define principal/coluna
secundária e breakpoint de 700px. A suíte lê seus bytes pelo file port e testa
criação/substituição/remoção/deduplicação do `<link>` através do consumidor real
do núcleo com DOM simulado. **Isso não comprova layout, fetch do navegador,
acessibilidade completa ou aparência em tenant.**

As fontes originais foram lidas somente para conferência. O gerador normaliza
CRLF para LF, preservando BOM; o fixture padrão é byte-idêntico ao pacote real.
Âncoras SHA-256 do runtime preparado:

| Payload | SHA-256 |
| --- | --- |
| `module.js` | `91e90509b75450299968695f420857771ddac4b0fcd7702b8fc8a65ef80027a5` |
| `_shared/render.js` | `33a925627f241ae6ed379ddaea89a53acfa24cbe91819aa36c1d0ba08aec5387` |
| `db.css` | `137767308e415745d591665bea090a1e58267646155998e71a6310874fd74fda` |

Licença/proveniência legal da fonte não foi comprovada: não há licença raiz
copiada, `sourceLicensePresent:false` e `rightsApproved:false`. A licença do
núcleo não é uma autorização inventada para distribuir CAMAP2 ou seus dados.

## Teste focal e integração opcional

```powershell
node tests/camap-editorial-adoption.test.js
```

`runCamapEditorialAdoptionTests()` foi integrado pelo coordenador ao runner;
o próprio agente de preparação não alterou o runner ou `package.json`. O modo
padrão depende somente de Node e núcleo local, sem sibling CAMAP2/SPMIDDLE,
gerador, npm install, rede, navegador ou serviços. Os cinco payloads reais são
embutidos e fixados por SHA; metadados de controle são fixtures identificados.
Imports no modo portátil remapeiam apenas a rota do grafo estático já fixado,
não substituem renderers por doubles.

Para auditar dois pacotes locais já preparados, chamar a função com
`packageDirectories: ["tmp/editorial-adoption-0.2.0", "tmp/editorial-adoption-0.2.1"]`.
O modo de execução por `file:` exige adicionalmente `importLocalPackages: true`
e `trustedLocalPackages: true`; verifica inventário, payloads e grafo fechado
antes de importar código. Opção inválida, arquivo ausente ou hash divergente
falha, **sem fallback silencioso**. Não é sandbox para código arbitrário.

O recibo retornado distingue testes aprovados de `adoptionReady:false`, direitos
não aprovados e defeitos conhecidos. A suíte caracteriza os defeitos atuais:
passar não transforma essas entradas em seguras.

## Aceitação futura individual pelo coordenador

1. Comprovar o gate completo do piloto; obter autorização específica do editorial,
   capacidade da raiz, revisão legal e solução autorizada dos bloqueios acima.
2. Verificar offline XML, defaults, quatro parâmetros e SHA das duas revisões.
   Labels/versionamento devem ser explícitos, sem renomear a chave persistida.
3. Capturar IDs, parâmetros e configurações existentes antes de qualquer ação.
   Não descartar os registros atuais nem aplicar reordenação/posição/frontend
   ampla como efeito colateral da adoção de um único módulo.
4. Com autorização remota própria: descobrir e verificar, instalar explicitamente,
   criar/editar apenas a instância prevista com dados neutros e validar render/CSS
   em navegador real. Preparação local não declara esse passo concluído.
5. Atualizar para `0.2.1` mantendo chave, schema, ID da instância, parâmetros,
   ordering, posição e assignment. Reter `0.2.0` imutável com `discover:false`:
   duas origens descobertas simultaneamente causam conflito da mesma chave.
6. Reverter e confirmar a mesma instância/configurações com CSS de `0.2.0`;
   comprovar disable/enable da extensão e instância sem perdas. O teste local
   só exerce loader/registry/discovery/CSS, não um instalador ou serviço remoto.

Nenhum resultado deste documento afirma instalação, migração ou aprovação
de publicação do editorial.
