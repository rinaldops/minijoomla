# Adaptação segura e isolada do Hero

> **Ciclo posterior executado pelo coordenador:** duas revisões testadas no site,
> formulário/teclado em memória e preservação de 48 itens, sem instalar Hero ou
> configurar roots. [Resultado e limites](CICLO-HERO-ISOLADO.md).
> Os gates abaixo são do builder e não uma liberação de adoção ou clearance global.

Perfil **`mod_hero` / `camap.mod_hero`**, versões locais imutáveis `0.3.0`
e `0.3.1`. Preparação offline somente; não instala, publica, altera registros,
configura host nem amplia capacidade. A raiz existente permanece **8/10**,
com **48 linhas**. O coordenador valida o site e o ciclo de vida separadamente.

## Contrato preservado

Os sete campos originais, em ordem, sem aliases, opções ou restrições novas:

| Campo | Tipo | Default completo |
| --- | --- | --- |
| `title` | string / XML text | `Profundidade com` |
| `rotatingWords` | array / XML JSON array | `["propósito"]` |
| `mission` | string / XML text | `""` |
| `imageUrl` | string / XML text | `""` |
| `imageAlt` | string / XML text | `""` |
| `primaryAction` | object / XML JSON object | `{}` |
| `secondaryAction` | object / XML JSON object | `{}` |

O renderer mostra somente a **primeira string não vazia válida**, estaticamente.
Não existe rotação real, timer, animação ou comportamento de carrossel.
Continua `h1`: não se muda hierarquia de heading, chrome/header ou template.

Normalização defensiva ocorre numa cópia em memória somente durante render.
Não grava settings, descarta chaves desconhecidas da persistência nem corrige
dados armazenados. Teste com admin-service demonstra que alteração não
relacionada mantém `settingsJson` byte-exato, inclusive valores inválidos,
campos futuros e chave própria `__proto__`. O normalizador de params existente
é verificado separadamente com `keepUndeclared: true`.

## Mudanças explícitas

1. **Helper:** reutiliza exatamente `SAFE_URL_SOURCE`, exportado pelo builder
   editorial. Aceita fragmentos, caminhos server-relative não protocol-relative
   e HTTPS sem credenciais; rejeita protocolos alternativos, controles,
   whitespace, barras invertidas e evasões percent-encoded. Retorna bytes
   seguros originais, não URLs reconstruídas. Afeta somente o novo pacote.
2. **Renderer:** acessa próprios descritores de dados, não getters. Title,
   mission e alt não-string viram string vazia; palavras não-string/vazias são
   filtradas sem coerção. Actions precisam ser objetos próprios plain/inertes,
   label string não branca e target string já validado; CTA inseguro/blank ou
   target `#` é omitido, nunca substituído por âncora de fallback. Imagem exige
   HTTPS ou server-relative validado, **sem fragmento**. Nunca cria `img`
   inseguro, `src=""` ou `src="#"`; alt é escapado. O fallback vazio do helper
   não é usado para validar imagem: nesse helper ele resultaria em `#`.
3. **Acessibilidade/markup:** `aria-labelledby="camap-hero-title"` é substituído
   por `aria-label` com título literal + primeira palavra, escapados. Remove
   `id="camap-hero-title"` do `h1`; não inventa contador global, aleatoriedade ou
   chave estável que o contexto gerenciado não oferece. Nenhum seletor CSS ou
   evento referencia o ID original. Instâncias repetidas não colidem.
4. **Mídia vazia/CSS:** quando não há imagem validada, adiciona somente
   `camap-hero--without-image` à seção. Mantém a div de mídia, oculta por CSS.
   Todos os bytes/declaracões CSS originais são mantidos, mais este append:

   ```css
   .camap-hero{overflow-wrap:anywhere}
   .camap-hero__copy,.camap-hero__media{min-width:0}
   .camap-hero--without-image{grid-template-columns:1fr}
   .camap-hero--without-image .camap-hero__media{display:none}
   ```

   Com imagem válida, conserva duas colunas, cores, classes/estilos de actions
   e regras mobile originais. Sem imagem, usa largura completa e não reserva
   a mídia vazia de `14rem` no mobile. Não altera tema, CSS global ou outro módulo.

O probe **original**, somente leitura, fornecido pelo coordenador mediu raiz
320px em viewport 921px: duas colunas 160/160px; heading 86px e scroll 4050px;
scroll da raiz 4087px para título sem espaços de 180 caracteres; duas
instâncias com o mesmo ID; mídia direita vazia 160 × 429px. O probe inicialmente
removeu BOM **apenas da injeção inline de teste** para aplicar as regras reais.
O pacote preserva BOM dos fontes e normaliza EOL pelo gerador original. Testes
Node/AST não demonstram largura real corrigida: novo probe é gate do coordenador.

### Limite da defesa de dados

Entradas efetivas de params são JSON. Descritores próprios recusam accessors,
funções como `toJSON`/coerção nos objetos inspecionados e tipos não plain, sem
executá-los. Campos desconhecidos/nested inválidos não são serializados pelo
renderer. Isto **não é sandbox contra Proxy, globals hostis ou JavaScript
arbitrário, nem globals previamente modificados**. Não se executa pacote arbitrário recebido: apenas fonte original
local confiável, com hash fixado, em cópia privada.

Evidências Buffer e todos os arquivos staged também são validados **antes** de
ler `.length`, copiar ou calcular hashes: brand `ArrayBuffer.isView`, prototype
exato `Buffer.prototype` e somente índices próprios com descritores de dados
enumeráveis e bytes inteiros 0–255. Propriedades próprias `length`, `valueOf`,
`toJSON`, extras e symbols são recusadas sem executar getters. Tamanho/cópia usam
intrínsecos capturados de typed arrays (`byteLength` e `set`), nunca
`Buffer.from(input)`. Buffers pooled/sliced normais continuam aceitos; a defesa
de bytes não conta cada índice no orçamento de nós de metadata. Esta correção
não muda renderer, CSS, schema, notices ou qualquer byte de pacote válido e não
reescreve/republica artefatos existentes. Regressões cobrem getters nas duas
licenças e em cada arquivo staged, com contador de execuções igual a zero.

Para um nome acessível significativo, mantenha título/palavra úteis na instância.
Se ambos forem explicitamente vazios, o rótulo literal também ficará vazio;
isto é advisory de conteúdo, não uma nova constraint ou mudança de schema.

## Proveniência e licenças

Três fontes originais foram comparadas com blobs Git do commit histórico
`124ac3ea1d002fe7dc517a7d03513d1238396dac` no agregador. A igualdade histórica
usa somente CRLF/CR → LF, **sem remover BOM**. O original nunca é editado.

| Fonte | SHA-256 raw original | SHA-256 LF/histórico |
| --- | --- | --- |
| `extensions/camap/_shared/render.js` | `fd6166e3e3ef13253d4cab93f38d098b1d373548233fea27b727fef42a48795e` | `33a925627f241ae6ed379ddaea89a53acfa24cbe91819aa36c1d0ba08aec5387` |
| `extensions/camap/mod_hero/module.js` | `bf53fdca654eddb0e6ada73d311bff49e814f206cbbfe6f602fe058462645884` | `e9fe4ac17fc1ea129a5d11aa379ebb8b6cec32d4728de9ad3ac370514195c738` |
| `extensions/camap/mod_hero/hero.css` | `78ad460ae9c9ede682cd1bd9570df321a384a5ac02ad159acf95ff2787a152f6` | `0ab33c38cf8a844059ca39c9b166576d89d281868ed5acf8e219f575b9e450ea` |

SHA-256 gerados LF finais: helper
`e6d967556bb4c36db272c967205977b8a9947fadb093819ce069802c91e29c76`, renderer
`e94f3386ceb873a887fff6aee35ae327549d8a638e66b0f3c0e9f9c2b2911ca5`, CSS
`2264d58affec356da17ec03331bc8dfa350682348bfaca46c0d36a0ca6f3be87`.

O MIT herdado limita-se a esses três fontes; não licencia o vendor inteiro.
O texto completo original é mantido byte-exato em
`docs/licenses/CAMAP-ROOT-MIT.txt` no pacote. GPL-2.0-or-later cobre **somente
mudanças autorais**; texto GPL completo é mantido byte-exato em
`docs/licenses/GPL-2.0.txt`. Não se depende apenas de SPDX. `ADAPTATION.json`
registra hashes, origem histórica e escopo, sem identidades, caminhos locais
absolutos ou URLs corporativas. Ausência de LICENSE na raiz CAMAP não implica
ausência do MIT histórico, nem clearance global. Novos notices na raiz exigem
review: o perfil fechado atual tem zero notices CAMAP-root, 13 arquivos exatos.

## Builder e verificações

```powershell
node --test tests/hero-adaptation.test.js
node --input-type=module -e "const m=await import('./tests/hero-adaptation.test.js'); await m.runHeroAdaptationTests();"
node tests/hero-adaptation.test.js --local-build
```

- Modo padrão: **17 casos portáveis**, fontes tiny originais byte-fixadas (helper
  completo e módulo original de oito linhas, BOM incluído), sem checkout CAMAP,
  dependências adicionais, escrita ou rede. Importar exporta runner awaited e
  não agenda `node:test`; somente execução principal agenda testes nativos.
- `--local-build`: **18 casos**; opt-in para dois destinos novos sob
  `tmp/hero-adapt-agent-*`, AST CSS real, XML completo, SHA/inventário/notices,
  discovery via file-port em memória, comparação de cada fonte e dependência
  antes/depois, recusa de overwrite e de cópia já adaptada. Não faz install.
- Collector compartilhado limita snapshot/dependências a 500 arquivos e
  10 MiB, sem links/junctions; copia somente closure offline conhecida.
- Overrides precisam ser cópias originais locais confiáveis comparadas com
  CAMAP/closure fixa. Sem argumentos para código, patch, hash, profile aberto,
  outros módulos ou versões além de `0.3.0`/`0.3.1`.
- Finalizer possui metadata plain/inert via descritores, limites de
  profundidade/nós/bytes, chaves fechadas e hashes gerados hardcoded. XML é
  comparado byte-exato com perfil canônico completo além da validação tipada;
  rejeita atributos desconhecidos, defaults alterados, opções/constraints novas
  mesmo com inventário consistente. Foreign payload é recusado mesmo inventariado.
- Exatamente **5 runtime**: wrapper, XML, CSS, renderer e helper. Controles,
  notices e duas licenças resultam em **13 arquivos / 11 payloads inventariados**.
  Três patches somente; snapshot de outros módulos é evidência privada de
  geração, não payload. Flags de direitos/publicação/host/tenant/records são false.

Preparação pelo coordenador, sempre com destino **novo**:

```powershell
node scripts/prepare-hero-adaptation.js --version 0.3.0 --base /offline/hero/0.3.0 --output tmp/hero-adapt-agent-new-030
node scripts/prepare-hero-adaptation.js --version 0.3.1 --base /offline/hero/0.3.1 --output tmp/hero-adapt-agent-new-031
```

`auditHeroAdaptationPackage(path, version)` faz audit local read-only sem importar
JS do pacote: reconstrói todos os bytes finais pelo finalizer fechado, valida
inventário/control hash, fonte original real e discovery/XML. CLI de audit:

```powershell
node tests/hero-adaptation.test.js --packages tmp/hero-adapt-agent-new-030 tmp/hero-adapt-agent-new-031
```

Gates restantes: probe real corrigido (raiz estreita com viewport largo/mobile,
texto sem espaços, duas instâncias, mídia ausente e imagem segura), revisão de
direitos restrita ao pacote, e ciclo de vida isolado pelo coordenador. Nenhuma
validação offline deste arquivo autoriza publicação, instalação ou mudança de
capacidade da raiz. Não há commit, npm completo, upload de mídia ou acesso externo.
