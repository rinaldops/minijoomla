# Videoteca — ciclo individual de desenvolvimento e teste

> **Suspenso por decisão posterior do usuário:** não desenvolver Videoteca ou
> Forum neste momento. Foco retomado nos itens padrão do Joomla. Arquivos parciais
> preservados localmente, sem integração ao runner/contributor, envio ao site,
> instalação ou exclusão. A fila vigente está no plano de continuidade.

Iniciado após a validação/documentação do ciclo isolado Documentation 0.5.x,
na branch `feat/joomla-finalization-step2`; último commit remoto `30362f1`.
Código Documentation local preservado. Esta frente não instala módulos,
configura raízes, publica páginas ou modifica registros editoriais.

## Desenvolvimento — contrato e origem

Elemento `mod_videoteca`, key `camap.mod_videoteca`; renderer síncrono, dados de
`settings.videos`/`carouselVideos`, sem backend de vídeo, resolução de streams,
tracking ou datasource automático. Preservar 16 campos/defaults/constraints
originais e chaves desconhecidas salvas, sem migrar arrays/JSON automaticamente.

A leitura de origem identificou o port CAMAP e referências declaradas
`mse-platform/modules/mod_videoteca/videoteca-view.js`, `videoteca-data.js` e
`videoteca.css`. O CSS local CAMAP corresponde byte a byte ao CSS upstream local.
MIT do agregador e MIT própria do mse-platform têm o mesmo texto/copyright;
conservar os notices completos e as duas relações de origem, não assumir
clearance global de vendors, mídias ou contribuições anteriores. A revisão
histórica corretiva que difere dos arquivos atuais não é baseline já aplicado.

## Análise inicial — defeitos a caracterizar/corrigir

- Miniaturas interpoladas em `background-image:url('…')` com escape HTML,
  sem política de URL de mídia/escape CSS apropriada; corrigir sem persistir
  data/blob nem perder título/conteúdo de item não-link.
- Helper permissivo e coerção de objetos/getters em settings/linhas; validar
  dados próprios/inertes, arrays densos e limites de recurso antes de renderizar.
- Busca editável, select/botões com `aria-disabled` sem impedimento nativo;
  refletir honestamente o estado estático, sem simular busca/paginação funcional.
- Slides posteriores recortados, mas seus links ainda focáveis; tornar a seleção
  de destaques estática/visível, sem rotação e sem controles falsos.
- CSS raiz depende de dataset que o registry não fornece. Remapear somente o
  contrato de raiz selecionado; manter isolamento entre instâncias e escopo CSS.
- Reflow estreito/textos longos, truncamentos e limites numéricos/paginação
  requerem teste real. Nenhuma falha visual nova foi declarada apenas da leitura.

Desenvolvimento local autorizado em overlay isolado; fontes originais nunca
editadas. Pacotes propostos 0.3.0/0.3.1 ainda dependem de preparo/gate técnico
individual antes de envio ao site. Formulário em memória, URLs/imagens, teclado
contínuo, layout público/admin e limpeza serão testados sobre os bytes finais.

## Preservação e critério de avanço

Referência editorial foi explicitamente confirmada no ciclo anterior: seis
edições reconhecidas, 48 registros/ETags, Cassiopeia/três estilos, configuração
0.15.0/oito raízes. Pública continua em rascunho e administrador publicado;
não restaurar conteúdo nem publicar a página por inferência. Revalidar antes
e depois de qualquer ensaio. Sete módulos ainda aguardam adoção persistida;
grupo definitivo/capacidade não foi congelado ou ampliado.

Seguir **Desenvolvimento → Teste no site → Análise → Validação → Documentação**,
voltando ao desenvolvimento/reteste em caso de descoberta. Forum começa somente
após fechar o ciclo de Videoteca. Sem declaração de paridade Joomla/PHP,
acessibilidade integral ou prontidão para distribuição pública.
