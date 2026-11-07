# Etapa 2B — conciliação de publicação e aceite XML pelo painel

Atualização de 07/11/2026, posterior ao commit `b94b1bd` da etapa 2.
Frente mantida na branch isolada `feat/joomla-finalization-step2`.
Este registro prevalece sobre os bloqueios históricos de publicação e revisão
pela UI da [etapa 2](ETAPA-2-PILOTO-XML.md), sem fechar os demais gates.

## Resultado vigente

- **0.11.0 ativa nas duas páginas, ambas publicadas/sem checkout no inventário
  final.** 243 arquivos / 4.146.124 bytes conferidos por SHA-256/bytes/MIME.
- Confirmação real `<dialog>.showModal()` no instalador; Cancelar/Escape,
  Atualizar/Enter e Reverter/Enter exercitados com teclado do FIORI-AUTO.
- Atualização 0.2.0 → 0.2.1 e reversão → 0.2.0 pelo painel, com JS/helper/CSS
  correto observado no site e todas as instâncias/ETags/settings preservados.
- Conflito real durante a confirmação mostrou mensagem na UI e impediu update
  com ETag obsoleta. Habilitação/desabilitação de extensão e instância exercitadas
  separadamente pelos botões reais do painel; estados finais habilitados.
- **40 registros originais/ETags intactos, 42 no total.** Nenhum novo registro
  nesta rodada, nenhuma reinstalação ou exclusão do piloto/amostra.
- **84 suítes aprovadas, zero skips/falhas**; sintaxe de 265 arquivos JS aprovada.
  Child standalone: 72 locais/11 skips esperados, não esconder falhas integradas.

O primeiro cadastro do piloto continua comprovado pelo serviço da etapa anterior,
não pela antiga caixa `window.confirm`. Esta rodada não apaga/recria o registro
para simular aceite de instalação inicial pelo painel. O fallback `window.confirm`
não foi aceito em tenant; a nova confirmação modal é um mecanismo real diferente,
não uma alegação de controle sobre o diálogo JS do navegador.

## Conciliação do rascunho

Histórico da página pública foi inspecionado por portas REST read-only do browser
próprio. A versão 28.2 registrava `RestoredFrom: 28.0`; a intermediária 28.1 tinha
diferenças de conteúdo e intenção de restauração. Não presumir autor ou causa da
operação apenas pelo histórico. A versão atual restaurada coincidiu em **30
campos de conteúdo/layout** com a versão publicada; diferenças de estado e
metadados de autoria/restauração foram classificadas separadamente.

Só depois dessa conciliação, nova releitura de ID/versão/ETag, confirmação de
restauração/sem checkout e verificação imediata anterior ao Publish permitiram
republicar o estado restaurado. Nenhum CanvasContent1 foi escrito, nenhuma versão
intermediária foi apagada ou restaurada novamente. Releitura comprovou estado
publicado e conteúdo preservado. Publish não fornece transação global; sua
atomicidade além desses controles continua não demonstrada.

Evidências operacionais minimizadas ficam em `tmp/step2b/` ignorado; identificadores
de sessão de autoria e metadados de validação do servidor não são necessários ao
relatório nem devem ser transportados para o Git/documentação pública.

## Confirmação no instalador

`com_installer/src/View/confirmation.js` cria um diálogo no root administrativo
usando `ownerDocument` real, com textos via `textContent`, título/descrição
acessíveis, botões portugueses e foco. O navegador fornece modal/inert e Escape;
Enter concede consentimento somente sobre a tela ainda atual. Cancelar não grava.

- Trava por tela cobre a espera de consentimento e o write, inclusive botões
  de candidatos diferentes. Candidato e ETag são capturados antes da espera.
- Navegação, stop, remoção do root/dialog ou mudança de identidade cancelam a
  confirmação; guard é conferido novamente antes de iniciar o write.
- Listeners/observer/timer são descartados. Polling de 100 ms existe somente
  enquanto o diálogo está aberto para detectar stop sem hook de disposal; o
  throttling pode atrasar a limpeza, nunca autoriza write obsoleto.
- DOM sem suporte mantém confirmação antiga como fallback; `showModal` presente
  mas falhando cancela, sem fallback que autoaceite. Nenhum `confirm=()=>true`.
- Foco anterior só é restaurado quando pertence ao mesmo root/tela válido.

**Limite posterior ao congelamento:** a revisão independente reproduziu um salto
de foco ao usar `close()` depois de blur em tela obsoleta/controle do host. Não
permitiu write indevido. Correção **local posterior** remove o modal obsoleto sem
invocar a restauração nativa de `close()`; a suíte agora modela restauração também
a partir do body/viewport e testa foco de tela parada/host. Esses casos passaram
localmente, mas a correção não está no pacote imutável 0.11.0. Deve integrar uma
release futura com aceite real de foco; não declarar esse gate fechado no tenant.

Testes locais com DOM double cobrem instalação, atualização/reversão,
duplo clique, retenção da ETag, erro de write, cancelamento, IME/repeat, foco,
stop/navegação e limpeza. Esses testes não substituem o teclado real do tenant.

## Release 0.11.0 e aceite efetivo

Pacote novo imutável inclui confirmação e a guarda de ordem CSS corrigida
posteriormente à 0.10.0. Raízes das duas revisões do piloto continuam aprovadas;
**0.2.1 é descoberta e 0.2.0 retida sem descoberta**, permitindo atualização e
reversão pela UI sem conflito de origens. Nenhum módulo externo adicional está
configurado/instalado automaticamente.

1. Snapshot dos 42 itens e páginas publicadas foi capturado após conciliação.
   Upload creation-only verificou 243 arquivos; leitura independente confirmou
   hashes/bytes/MIME. Pacotes de módulos existentes não foram sobrescritos.
2. Prévia read-only em sete larguras (320–2560 px) passou rotas públicas/admin,
   contrato XML, ação de upgrade, modal real/cancelamento e piloto existente.
   Cancelamento de prévia foi programático, não o aceite de teclado real abaixo.
3. Ativação seletiva com canvas/ETags atuais alterou somente o script do MINIJOOMLA;
   outras propriedades/webparts preservados. Rollback para 0.10.0 preparado,
   não executado. Assets 0.8.0/0.9.0/0.10.0 continuam disponíveis.
4. No painel efetivo, Escape cancelou sem mudança do snapshot. Enter confirmou
   upgrade e rollback; GETs independentes verificaram ID/key/estado, revisões
   e **todas** as instâncias sem mudança de bytes/ETag. Site recarregado confirmou
   escaping/multilinha/autor/alinhamento e um CSS da revisão correspondente.
5. Durante uma confirmação aberta, um save intencional do **mesmo Ordering** do
   registro novo do piloto criou ETag concorrente real, sem alterar seu valor.
   O aceite da tela antiga mostrou mensagem de conflito e não regravou extensão
   ou instâncias. Esse write de ensaio atingiu só o piloto, não a amostra.
6. Botões do painel desabilitaram/reativaram extensão e instância separadamente.
   Site mostrou ausência de render/CSS quando desabilitado e retorno correto
   após reativação. Settings/atribuições preservados; estados finais habilitados.
7. Reload final passou TinyMCE único, abas/cleanup, quatro plugins, Sample Data
   bloqueado em conteúdo populado, imagens originais/menu e ausência de HTTP
   >=400 de assets na janela observada (166/103 recursos admin/público).
   Inventário final confirmou ambas páginas publicadas e os 42 itens.

A prévia inicial interrompida não gerou recibo de sucesso; repetição somente
read-only passou. Uma fixture de reload ainda procurava a versão antiga de CSS
por substituição incorreta no runner privado; diagnóstico e execução corrigida
passaram sem alterar assets/dados, preservando o recibo anterior de falha.
Antes do hardening de foco posterior, reempacotamento independente confirmou 91
payloads próprios administrativos/core idênticos ao snapshot publicado. HEAD
posterior não reproduz sozinho a 0.11.0: o manifesto operacional privado é sua
referência congelada e a única mudança runtime posterior é a confirmação citada.
Nova comparação após a correção confirmou 90 payloads idênticos e somente esse
delta; revisão independente/focal não encontrou novo bloqueio na limpeza de foco.
Agregação final verificou hashes de 21 recibos privados aprovados, distinguindo
cadastro inicial/modal e correção de foco não publicados dos aceites executados.

## Dez módulos: preparação não é adoção

Editorial recebeu contrato/duas revisões e teste portátil ancorado nos bytes
reais. O teste está integrado ao runner, com auditoria por file ports/import
confiável explícita como modo adicional. [Contrato e bloqueios](MODULO-EDITORIAL-XML.md).

**Não foi publicado/instalado:** o helper de links aceita `//`, backslash e HTTPS
com credenciais, e `[null]` no array causa falha do renderer. São defeitos
caracterizados pelos testes, não entradas aprovadas. Proveniência/licença da fonte
também não comprovada. Não trocar helper compartilhado externo silenciosamente,
não inventar schema de itens nem aplicar a licença do núcleo a CAMAP2.

A [matriz dos dez módulos](MATRIZ-ADOPTION-MODULOS.md) registra campos, consumidores
e outros bloqueios: thumbnails em CSS da videoteca, cores CSS do fórum, variáveis
de layout legadas, IDs repetidos e controles sem interação completa. Preparação
com hashes não demonstra segurança para edição arbitrária ou serviços completos.

## Próximos gates

1. Corrigir/adaptar fontes externas e contratos de entrada de forma delimitada,
   com provenance/avisos, sem alterar as chaves nem aplicar migração implícita.
   Regerar pacotes imutáveis e repetir aceite individual antes de exposição.
2. Aceite do cadastro inicial pelo novo diálogo em destino vazio/novo pacote
   válido ainda pendente; não limpar o site atual para produzir evidência.
   Publicar e aceitar também o hardening local de foco em uma nova release,
   sem sobrescrever 0.11.0 nem reutilizar sua evidência como teste dessa correção.
3. XML plugins/templates com contratos próprios e UI/executor de migração
   assistida continuam não implementados nesta frente.
4. Integração na principal depende de conciliação de seu trabalho local; nenhuma
   alteração foi descartada. Confirmar distribuição/privacidade/fontes e aceites
   assistivos/editoriais integrais separadamente.

Não declarar conclusão integral do plano, equivalência Joomla/PHP ou distribuição
pública pronta. Temas Atum/Cassiopeia preservados; i18n, SEO do host, histórico e
check-in/check-out editorial continuam fora do escopo atual.
