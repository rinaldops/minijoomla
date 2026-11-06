# Compatibilidade com SPMIDDLE 0.2.0

Verificação em 06/11/2026, após informação de atualização do middleware.
**Conclusão: nenhum ajuste obrigatório de compatibilidade identificado no
painel MINIJOOMLA 0.8.0 atualmente publicado.** Não houve alteração de fontes
executáveis, dados, listas, canvas, assets publicados ou imports nesta verificação.

## Atualização efetivamente encontrada

- Versão raiz do SPMIDDLE: **0.2.0**, anteriormente 0.1.0.
- HEAD local permanece `14f5e6d`; atualização da versão/distribuição e adaptador
  MSE encontram-se como alterações locais. Não foi executado fetch ou push.
- Novidades: geração de distribuição independente e adaptador opcional
  `host-adapters/modern-script-editor/` com `Contained`/`FullBleed`.
- Nenhuma modificação em `packages/` identificada no delta Git local.
- Versões individuais dos pacotes de dados continuam 0.1.0. A versão raiz
  identifica a distribuição, não uma alteração de todos os contratos de dados.

## Evidências executadas

| Verificação | Resultado | Limite |
| --- | --- | --- |
| `npm test` do SPMIDDLE atual | Passou, incluindo 16 testes de layout MSE | Geometria por doubles; não aceite visual no tenant |
| Comparação dos módulos incorporados à 0.8.0 | **11 arquivos JS idênticos byte a byte** ao runtime atual dos pacotes consumidos | Comparação com o pacote local previamente enviado; não auditoria da distribuição inteira |
| 17 suítes focalizadas da árvore local MINIJOOMLA | 17 passes, zero skips/falhas | Árvore local tem deltas separados da release publicada |
| 17 suítes focalizadas da fonte limpa publicada | 17 passes, zero skips/falhas | Snapshot importado da 0.8.0 e middleware de bytes idênticos, transporte em memória |
| Inspeção real do painel corporativo via FIORI-AUTO próprio | **16 checks aprovados**, versão efetiva 0.8.0 | Sem salvar, upload, instalar dados de exemplo ou mudar página |

O primeiro teste da fonte limpa apresentou falha na fixture histórica de
`entity-contracts-final.test.js`, que procurava `Author` textual para simular
renomeação. O schema publicado já declara `Author0` explicitamente. Foi
adaptada **somente a fixture da cópia em tmp**, preservando o teste original
e sem modificar qualquer fonte executável. A reexecução passou; não é quebra
causada pela atualização SPMIDDLE.

A inspeção do host confirmou raiz administrativa única, formulário de novo
artigo, TinyMCE inicializado e removido na navegação, rotas de módulos/plugins/
configuração, sem falhas HTTP observadas nos assets MINIJOOMLA. Contagens e
datas de modificação das listas permaneceram iguais. O canvas continua em
0.8.0 e **não carrega o novo host SPMIDDLE**, wrapper ou namespace externo.
Nenhuma certificação de escrita editorial ou acessibilidade integral é inferida.

## Por que não republicar apenas pelo bump

O host MINIJOOMLA importa os módulos de dados de sua própria pasta imutável
`libraries/vendor/spmiddle/`. Publicar uma distribuição SPMIDDLE independente
não substitui esses imports, nem modifica automaticamente snippets ou UI.
Os novos assets de layout também não entram no pacote MINIJOOMLA simplesmente
porque a versão raiz mudou. Ver `SPMIDDLE/docs/DEPLOYMENT.md`, seção de ativação.

Portanto, uma republicação ampla para “atualizar a dependência” seria desnecessária
e poderia incorporar deltas locais que foram excluídos deliberadamente da 0.8.0.
Manter o Atum e a fonte de publicação acordada, não recuperar patches rejeitados.

## Quando haverá ajuste de integração

Somente se o publicador precisar adotar `Contained`/`FullBleed`, preparar uma
mudança específica de host/snippet:

1. Wrapper SPMIDDLE **externo** e raiz MINIJOOMLA filha, preservando o escopo Atum.
2. CSS do layout carregado antes da medição; bootstrap aguarda
   `SPMiddleMseHost.ready` e aplica `applyMseLayout` antes de montar o aplicativo.
3. Cleanup compatível com `start/stop` MINIJOOMLA e `dispose` do layout, inclusive
   falhas de montagem/navegação. Não copiar literalmente o exemplo de mount
   síncrono nem deixar dois responsáveis pela expansão.
4. Preservar max-width de páginas/formulários e revalidar containers estreitos,
   sidebar, editor, zoom, foco, resize, CSP e MIME. FullBleed não é fullscreen
   e não deve substituir a apresentação Joomla por uma casca genérica.

Isso é melhoria opcional, **não reparo de uma regressão observada**. A rotina
Sample Data continua pendência própria do painel e não é fornecida pelo novo
layout SPMIDDLE. Evidências privadas em `tmp/spmiddle-compat-20261106/`.
