# Topsections — ciclo de desenvolvimento e teste no site

> **Resultado vigente:** Topsections 0.3.0 adotado individualmente na **0.15.0**,
> habilitado em `bottom-a` com itemLimit 2; ambas páginas publicadas. **48 itens
> totais e os 46 anteriores/ETags intactos.** Oito raízes aprovadas de um máximo
> de dez. O ciclo abaixo registra os defeitos, correções e aceites delimitados;
> não declara acessibilidade integral ou o plano inteiro concluído.

Iniciado em 08/11/2026, base `9301ab3`, branch isolada
`feat/joomla-finalization-step2`. Baseline do site: 0.14.0, 46 registros;
amostra/piloto/editorial/Highlights preservados. Adoção é individual.

## Iteração 1 — Desenvolvimento → Teste → Análise

O contrato original tem `title`, `items` (JSON array) e `itemLimit` numérico
(default 6). É apresentação de links, sem backend próprio ou imagens. O helper
de URLs da fonte original e itens malformados requerem adaptação defensiva,
sem regravar JSON persistido ou criar limites novos no schema.

Ensaio somente leitura no site, em root temporário do browser FIORI-AUTO:
HTML neutro produzido pelo renderer original revisado, CSS original e largura
de 180 px. O grid exigiu coluna de 224 px (`14rem`), criando excedente de 44 px.
Não houve gravação de listas/páginas nem instalação do módulo nesse ensaio.

## Iteração 2 — Correção → Novo teste → Validação

Troca restrita no CSS do pacote isolado:
`minmax(14rem,1fr)` → `minmax(min(14rem,100%),1fr)`.
Mantém auto-fit, espaçamento, borda, cores e classes. O mesmo ensaio produziu
coluna/root/scroll de 180 px, sem excedente. A correção de reflow não declara
aceite de zoom real ou de textos arbitrariamente longos; repetir com o pacote
real, layouts do site e a instância configurada.

Documentação registra a falha e a contraprova antes da próxima etapa. Pacote
final deve conter três alterações identificadas: URL helper, filtro runtime
e tamanho mínimo de grid; fontes externas/pacotes anteriores intactos.

## Iteração 3 — texto longo e nova correção

Antes da geração final, contraprova com título de item de 300 caracteres sem
espaços expôs novo excedente: 3395 px em contêiner de 180 px, mesmo com grid
corrigido. Regra de quebra de palavras restrita ao módulo e min-width zero
do item reduziu novamente o scroll a 180 px. Essa terceira iteração integra
o patch CSS declarado, sem trocar conteúdo/valores persistidos ou styles globais.

## Iteração 4 — pacote corrigido → site → análise → validação

### Desenvolvimento

`scripts/prepare-topsections-adaptation.js` prepara somente Topsections, em duas
revisões novas. Reutiliza o helper URL seguro e coletores existentes; patches
restritos a helper, renderer/filtro de itens e CSS. Fontes CAMAP2 originais e
pacotes anteriores continuam byte-idênticos. Chave, labels/defaults, markup e
três parâmetros preservados. `itemLimit:0` usa 6, negativos mostram vazio e
frações truncam no slice; nenhum teto novo foi inventado no schema.

Filtro por propriedades próprias/plain rejeita itens malformados e getters
antes do slice, somente no render. Dados/JSON desconhecidos salvos não são
apagados. URLs recusadas viram fallback, sem navegar destinos inseguros. Não é
sandbox de Proxies/código arbitrário, backend, imagem ou extensão PHP.

**13 casos portáveis** e **14/14 com audit dos dois pacotes finais** passaram.
Finalizador exige cinco payloads runtime, controles delimitados e metadata
inerte/limitada; arquivos estrangeiros corretamente inventariados são recusados.
Avisos MIT original e GPL completa das alterações próprias preservados; hashes
e história Git comprovados para o grafo mínimo, não licença global de CAMAP.
[Detalhes da adaptação](ADAPTACAO-TOPSECTIONS-SEGURA.md).

| Revisão | SHA-256 do inventário final | Payloads/arquivos |
| --- | --- | --- |
| 0.3.0 | `d6d8f861cb63e9ae2587aea0731f9f381ea3f88604f87fae604a8b2bcd88f1cc` | 11/13 |
| 0.3.1 | `e54237feed657c8b5397813415731dc3b9ca250191d2949803c6c0706548ee55` | 11/13 |

### Teste no site

1. Baseline independente confirmou 46 itens e módulo ausente, páginas publicadas
   sem checkout, IDs/canvas/ETags atuais. Upload dos pacotes imutáveis foi
   creation-only; 13 arquivos por revisão com hashes/bytes/MIME relidos.
2. Oito pacotes aprovados verificados remotely por XML/inventário, sem executar
   entrypoints no scan. Seis raízes anteriores preservadas integralmente; duas
   novas: 0.3.0 descoberta, 0.3.1 retida aprovada sem descoberta. **8/10**, sem
   elevar teto ou remover revisão em uso. JS/CSS ligados por revisão exata.
3. **0.15.0: 243 arquivos / 4.149.706 bytes**. Prévia read-only em sete larguras
   (320–2560 px) passou rotas administrativas/públicas, dados existentes e botão
   Registrar. Releitura independente de hash/bytes/MIME; ativação seletiva com
   ETags frescas preservou outras propriedades/webparts. Rollback para 0.14.0
   preparado, não executado; downgrade após adoção exige disable separado do novo
   módulo, não apagar seus dados ou restaurar canvas inteiro obsoleto.
4. Escape no diálogo real cancelou sem alterar 46 itens. Enter registrou extensão
   **desabilitada sem instância automática** (47). Botão do painel habilitou;
   formulário/Enter criou única instância em `bottom-a`, escopo All (48), com
   três links locais do blog/artigo/tags. Nenhum artigo/menu foi criado/editado.
5. Edição real pelo formulário mudou title/itemLimit para dois links exibidos,
   mantendo os três no JSON. GET confirmou parâmetros. Tentativa com ETag da
   instância anterior foi recusada sem alterar snapshot.
6. Upgrade 0.3.0 → 0.3.1 e reversão → 0.3.0 pelo serviço, com GETs independentes,
   preservaram ID/key/estado e **bytes/ETags de todas as instâncias**. Site carregou
   JS/helper/CSS da revisão correta. Não afirmar upgrade editorial/Topsections
   pela UI: descobrir 0.3.1 no painel exige configuração imutável nova.
7. Botões reais desativaram/reativaram extensão e instância separadamente: saída/
   CSS desapareceram e voltaram sem mudar settings/atribuições. Remoção pelo
   serviço recusada pela dependência da instância, snapshot idêntico, zero deletes.

### Análise e validação

- CSS final consumido no site: borda de 4 px e lista grid, auto-fit com trilhas
  vazias recolhidas quando há menos itens. ItemLimit atualizado mostrou dois
  links sem remover o terceiro item salvo.
- **320/375/700/768/900/1366/1920 px**: output, URLs/revisões e ausência de overflow
  do módulo conferidos. Ensaio adicional com **bytes finais publicados**, root
  temporário de 180 px e heading/item de 300 caracteres sem espaços confirmou
  `scrollWidth=180`, wrap herdado e min-width zero. Não é zoom real 200%/400%,
  screen reader/forced-colors ou reflow completo de conteúdo arbitrário.
- Tab real percorreu os links, outline sólido de 2 px; Enter abriu o artigo
  configurado. Não são eventos DOM sintéticos; acessibilidade completa pendente.
- Import real read-only confirmou escaping, itens malformados sem getters,
  fallback URL e limites históricos; URLs inseguras não persistidas/solicitadas.
- **Todos os 46 registros anteriores/ETags comparados após ciclo: zero diferenças.**
  Total 48, apenas a extensão/instância Topsections novas. Amostra/piloto/editorial/
  Highlights preservados. Ambas páginas publicadas/sem checkout no inventário final.
- Reload final passou TinyMCE único, abas/cleanup, quatro plugins, imagens/menu,
  Sample Data bloqueado no site populado; 166/115 recursos admin/público na janela
  observada, sem HTTP >=400 de assets. **87 suítes aprovadas, zero skips/falhas**;
  sintaxe de 268 JS aprovada. Child standalone: 75 locais/11 skips esperados.

### Documentação e análise posterior

Revisão independente validou os pacotes finais sem blocker para o cadastro
individual. Identificou tolerância do finalizador a maxlength XML novo; correção
local posterior passou a recusar `maxLength` não previsto e adicionou negativo com
inventário correto. É tooling posterior, não mudança nos bytes runtime aceitos
ou recálculo de inventário da raiz publicada. Pacotes efetivos tiveram XML
byte-exato conferido; nunca sobrescrevê-los para absorver hardening.

Scripts privados recusaram inicialmente o namespace de saída escolhido; nova
saída conforme o contrato fechado foi usada antes de qualquer upload. Sem
arquivos remotos repetidos ou autorização de overwrite. Ensaio original e
contraprovas preservados, distinguindo HTML neutro/root temporário de instância
persistida e teclado real.

Agregação final conferiu hashes de **39 recibos aprovados**. Reempacotamento
independente confirmou 91 payloads administrativos/core idênticos à 0.15.0.
Pacotes, snapshots brutos/ETags/configuração/identificadores e geometrias somente
em `tmp/topsections-cycle/` / `tmp/topsections-adapt-agent-*`, ignorados no Git.

## Próximo ciclo: capacidade antes da expansão

Restam **sete módulos**. Mais um módulo individual com duas revisões esgota as
dez raízes e deixa seis sem capacidade. A análise de
[CAPACIDADE-RAIZES-XML.md](CAPACIDADE-RAIZES-XML.md) será o próximo gate de
desenvolvimento/teste/validação: estudar agrupamento finito apenas de módulos
novos, sem mover raízes existentes, mudar metadata ou instalar em lote. Não
desenvolver/publicar o conjunto inteiro antes dos aceites individuais.

Plugins/templates XML e migração assistida continuam frentes separadas. Principal
com trabalho local preservado sem merge; open source, fontes/privacidade/direitos
globais e save/upload/aceites assistivos integrais não concluídos. Este documento
fecha somente o ciclo delimitado de Topsections.
