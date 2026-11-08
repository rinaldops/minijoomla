# Ciclo Highlights — Desenvolvimento → Site → Análise → Validação → Documentação

> **Resultado em 08/11/2026:** Highlights adotado individualmente na **0.14.0**,
> em `top-a`, habilitado em revisão 0.3.0/layout horizontal. Ambas páginas
> publicadas, 46 registros totais; os 44 anteriores/ETags intactos. O ciclo abaixo
> registra as descobertas, correções, contraprovas e limites — não um aceite
> integral de acessibilidade nem conclusão do plano inteiro.

Iniciado em 08/11/2026, a partir de `24b995a`, na branch isolada
`feat/joomla-finalization-step2`. A baseline publicada é 0.13.0, com 44 itens.
Nenhum item anterior deve ser alterado pela adoção individual de Highlights.

## Iteração 1 — contrato e ensaio do layout original

**Desenvolvimento:** preparar adaptação limitada de `camap.mod_camap_highlights`,
preservando três parâmetros (`title`, `layout`, `items`), defaults, identidade e
fontes CAMAP2 originais. Reusar o helper seguro somente no pacote novo. Itens
malformados não devem quebrar o render nem ser apagados do armazenamento.

**Teste no site:** ensaio read-only em root temporário no browser próprio do
FIORI-AUTO, com HTML neutro produzido pelo renderer original revisado. Não foi
registro/instalação de módulo. O CSS original produziu `display:block` e borda
zero nos artigos, pois buscava `.camap-dt1` e o HTML emitia `.camap-highlights`.

**Análise:** substituir somente o seletor fez o grid aparecer com duas colunas,
mas o título ocupou a primeira célula e os dois artigos ficaram em linhas
diferentes. Houve dois defeitos concretos, não um aceite visual do módulo inteiro.

**Validação:** geometria/computed styles do DOM real confirmou esses resultados.
Nenhuma lista, página ou instância foi escrita. O ensaio inicial tentou import
por data URL, bloqueado pelo browser; não houve relaxamento de CSP. Repetição
usou HTML estático neutro do renderer local revisado em root descartável.

**Documentação/retorno ao desenvolvimento:** ajustar classes somente no CSS do
pacote e aplicar `grid-column:1/-1` ao título horizontal; repetir teste no site
antes de aceitar. Modos horizontal/vertical terão aceite próprio. `auto` depende
do argumento de contexto `width`, não do tamanho do viewport; verificar no host
e não prometer automação responsiva onde essa largura não é fornecida.

## Iteração 2 — correção restrita e contraprova no site

**Desenvolvimento:** remapear classes do CSS no pacote isolado e acrescentar
somente `.camap-highlights--horizontal>h2{grid-column:1/-1}`. Não alterar a
estrutura HTML, o core, as três definições XML ou os estilos de outros módulos.

**Teste no site:** mesmo root temporário com largura de 900 px, DOM real e dois
artigos neutros. O título passou a 900 px; os dois artigos permaneceram com
450 px cada e a mesma posição vertical.

**Análise/validação:** correção resolve o título consumindo a primeira célula;
o horizontal agora apresenta os dois destaques lado a lado. Nenhum registro foi
escrito neste ensaio. Repetir com os bytes reais do pacote publicado e com
larguras/edições da instância antes de certificar a adoção.

**Documentação:** esta contraprova fecha apenas o ensaio da correção CSS;
pacote, cadastro, persistência, revisões e preservação continuam nos gates abaixo.

## Iteração 3 — pacote corrigido, teste de instância real e validação

### Desenvolvimento

`scripts/prepare-highlights-adaptation.js` prepara um perfil fechado, preservando
chave, defaults e os três parâmetros XML. Três arquivos são modificados somente
no snapshot novo: helper seguro, filtro de itens do renderer e CSS com classes/
título corrigidos. O filtro não regrava/remover dados desconhecidos ou itens
inválidos salvos. Não é sandbox de código arbitrário/Proxies.

Reutilização do builder editorial ocorre por 14 linhas de exports aditivos e
cópias congeladas de constantes; sua lógica, comportamento e saídas anteriores
não foram modificados. Pacotes antigos/editorial/piloto não foram sobrescritos.
[Contrato da adaptação](ADAPTACAO-HIGHLIGHTS-SEGURA.md).

**12 casos portáveis** cobrem anchors, URLs, itens sem getters, parâmetros,
render/estados, layouts, CSS, preservação JSON e finalização. Com os dois pacotes
finais, **13/13 casos** passaram. MIT original e GPL completa das alterações são
preservadas byte a byte, com proveniência local restrita ao módulo/helper/CSS.
Licença/privacidade globais de CAMAP e distribuição maior não são inferidas.

| Pacote final | SHA-256 do inventário | Payloads/arquivos |
| --- | --- | --- |
| 0.3.0 | `d5941a1e4f0ef39b96a53812f08ee074a3c4fe4e794a53deba231d1ea124b491` | 11/13 |
| 0.3.1 | `7848c9b6d1c9fbcf2e8864297902a38f60964d334110609d2043e13b5e0dccb3` | 11/13 |

### Teste no site

1. Baseline relida: oito listas/44 itens, piloto e editorial existentes, Highlights
   ausente; páginas publicadas/sem checkout. IDs/canvas/ETags em tmp privado.
2. Pacotes finais imutáveis carregados com `overwrite=false`, 13 arquivos por
   revisão, hashes/bytes/MIME verificados. Descoberta/inventários dos seis pacotes
   aprovados passaram read-only, sem importar entrypoints.
3. Nova release **0.14.0: 243 arquivos / 4.148.531 bytes**. Prévia administrativa/
   pública em 320/768/769/900/1366/1920/2560 px passou, sem gravação de registros
   ou diário. Ativação seletiva usou ETags/canvas atuais e preservou outras
   propriedades/webparts. Rollback para 0.13.0 preparado, não executado.
4. Quatro raízes anteriores preservadas integralmente e duas novas adicionadas:
   **6/10**. Highlights 0.3.0 descoberto; 0.3.1 retido aprovado sem descoberta.
   Cada JS liga ao CSS da própria revisão, sem fallback para latest no rollback.
5. Escape cancelou cadastro sem alterar 44 itens; Enter no modal real registrou
   extensão **desabilitada sem instância automática** (45). Botão do painel
   habilitou; formulário/Enter criou uma única instância em `top-a` (46), escopo
   All e dois itens neutros com links internos do blog. Nenhum artigo foi alterado.
6. Formulário editou title/layout/items com teclado do FIORI-AUTO. Layout vertical,
   auto e horizontal foram salvos separadamente e relidos. Write com ETag anterior
   da instância foi recusado sem modificar snapshot. Estado final: horizontal.
7. Atualização para 0.3.1 e rollback para 0.3.0 pelo serviço, com GETs independentes,
   preservaram ID/key/state e bytes/ETags de todas as instâncias. Releitura pública
   confirmou entrypoint/helper/CSS da versão correspondente. Atualização do
   Highlights pelo botão não foi executada; exige descobrir a raiz 0.3.1 em nova
   configuração mantendo 0.3.0 retida. Não afirmar esse aceite de UI.
8. Botões reais desativaram/reativaram extensão e instância separadamente; saída/
   CSS desapareceram e voltaram sem mudar settings/atribuições. Remoção pelo
   serviço foi recusada enquanto a instância existe; nenhum registro/asset apagado.

### Análise

- Na instância real em viewport 1366 px, root de 571,5 px: horizontal usa duas
  trilhas de 285,75 px; título ocupa 571,5 px em linha própria e os artigos
  compartilham a mesma linha. Borda esquerda de 4 px confirmou consumo do CSS.
- Vertical: `display:block`, itens empilhados. **Auto permanece vertical** no
  caminho gerenciado porque o host não fornece `width`; não é erro corrigido
  silenciosamente nem promessa de auto responsivo. O limiar contextual de 760
  foi confirmado por chamada read-only ao renderer, distinto da media query 700.
- Texto `<seguro>` aparece literalmente, sem elemento HTML; links correspondem
  às rotas internas aprovadas. Dados malformados/accessor foram exercitados em
  render read-only real do pacote: zero getters, somente dois itens válidos e URL
  insegura convertida a fallback. Nenhuma URL insegura foi persistida/solicitada.
- Layout horizontal conferido em **320/700/701/760/900/1366/1920 px**: uma coluna
  em ≤700, duas acima de 700, título separado. Isso não comprova zoom real
  200%/400%, screen reader, forced-colors ou reflow de todo conteúdo arbitrário.

### Validação

- Tab real percorreu os dois links do módulo, com outline sólido de 2 px; Enter
  abriu a categoria local configurada. Não são eventos DOM simulados. Ainda não
  é aceite completo de acessibilidade/contexto dos links repetidos “Saiba mais”.
- **Os 44 registros anteriores foram comparados integralmente, incluindo ETags,
  após o ciclo: zero diferenças.** Total 46, somente extensão/instância novas.
  Amostra, piloto e editorial preservados; não reinstalar para fabricar evidência.
- Reload final: editor TinyMCE único, abas/cleanup, quatro plugins, imagens/menu,
  Sample Data bloqueado no site populado; 166/111 recursos admin/público na janela
  observada sem HTTP >=400 de assets. Ambas páginas publicadas/sem checkout.
- **Regressão integrada: 86 suítes aprovadas, zero skips/falhas**; sintaxe de 267 JS
  aprovada. Child standalone: 74 locais/11 skips esperados (dependência SPMIDDLE
  explícita). Revisão independente validou pacote/exports/proveniência sem blocker
  técnico para este conjunto, sem afirmar revalidação remota independente.

### Documentação e próximo desenvolvimento

Os testes iniciais e suas falhas/diferenças foram mantidos como evidência, e as
contraprovas não sobrescreveram pacotes. Pacotes/recibos brutos, endpoints,
identificadores/ETags, geometria e scripts operacionais em `tmp/highlights-cycle/`
e `tmp/highlights-adapt-*` ignorados; não versionar dados corporativos/segredos.
Agregação final verificou hashes de **41 recibos aprovados**. Reempacotamento
independente confirmou 91 payloads administrativos/core idênticos ao snapshot
publicado 0.14.0; arquivos antigos não foram sobrescritos.

Limite adicional de tooling: o finalizer desta entrega é usado após preparo
confiável fechado; a revisão observou tolerância a propriedades extras nos
controles e SHA sintaticamente válido da API em entradas diretas. Os pacotes
efetivos tiveram controles/hashes conferidos. Antes de tratar esse export como
validador independente genérico para metadata não confiável, fechar também esse
contrato, testar e gerar nova revisão; não sobrescrever o pacote aceito.

**Ciclo do Highlights concluído nos gates delimitados acima.** Restam oito módulos;
o próximo é Topsections, sujeito ao mesmo ciclo e ao limite de raízes retidas.
Plugins/templates XML e migração assistida permanecem frentes separadas.
Atum/Cassiopeia mantidos; principal preservada sem merge, distribuição pública,
aceites assistivos e save/upload editoriais integrais não concluídos.
