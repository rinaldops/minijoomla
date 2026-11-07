# Etapa 2C — foco aceito e primeiro editorial adotado

Registro de 07/11/2026, posterior ao commit `f0c2809`. Branch isolada
`feat/joomla-finalization-step2`; principal com trabalho local preservado.
Prevalece sobre os bloqueios históricos do primeiro editorial e de foco da
[etapa 2B](ETAPA-2B-CONFIRMACAO-E-ACEITE-XML.md), sem liberar os outros módulos.

## Resultado vigente

- **0.13.0 ativa nas duas páginas, ambas publicadas/sem checkout no inventário
  final:** 243 arquivos / 4.147.349 bytes verificados por hash/bytes/MIME.
- **Primeiro dos dez módulos externos adotado individualmente:**
  `camap.mod_camap_editorial`, corrigido, habilitado em **0.3.0**, com uma
  instância em `main-bottom`. Duas revisões imutáveis 0.3.0/0.3.1 aprovadas.
- Registrar/Cancelar/Escape e Registrar/Enter aceitos pelo diálogo real; cadastro
  inicial desabilitado e sem instância automática. Habilitação, criação/edição e
  toggles exercitados pelos botões/formulários reais com teclado do FIORI-AUTO.
- Atualização → 0.3.1, reversão → 0.3.0 e remoção protegida exercitadas pelo serviço,
  com releitura e consumo público do JS/helper/CSS correspondente.
- **Os 42 registros anteriores, inclusive ETags, permanecem integralmente iguais.**
  Total **44**, somente extensão e instância novas. A amostra de 40 foi conferida
  separadamente. Piloto anterior e conteúdo editorial original não foram gravados.
- **85 suítes aprovadas, zero skips/falhas**; checker de 266 JS aprovado.
  Child standalone: 73 locais/11 skips esperados (SPMIDDLE opcional explícito).

Não houve instalação em lote, reordenação ampla, mudança de template, reinstalação
Sample Data ou exclusão para contornar guardas. Os outros **nove** continuam sem
adoção, sujeitos aos [contratos/bloqueios individuais](MATRIZ-ADOPTION-MODULOS.md).

## Correção de foco — 0.12.0

Antes do editorial, a 0.12.0 foi publicada separadamente: 243 arquivos /
4.146.210 bytes. Mesma configuração/dados da 0.11.0; incorporou o hardening de
`com_installer/src/View/confirmation.js` que não chama `close()` quando sua
restauração de foco não pertence à tela atual/root. Não sobrescreveu 0.11.0.

Prévia em sete larguras, hash/bytes/MIME, ativação seletiva e releituras passaram.
Ensaios read-only no browser efetivo verificaram diálogo no top layer, tela
parada sem devolver foco ao trigger antigo, controle do host sem restauração,
trigger próprio atual restaurado e cancelamento após remoção do root. Aceite
de Escape pelo teclado real passou sem alteração de snapshots. Ensaios de foco
usaram root temporário/controle sintético no DOM real, não um DOM double nem
escrita de dados. Isso não equivale ao aceite integral de acessibilidade.

O fechamento independente da 0.12.0 confirmou editor/abas/cleanup, plugins,
conteúdo/menu/imagens, 42 itens e ambas páginas publicadas. A 0.13.0 usa os
mesmos bytes de runtime, alterando configuração para aprovar o editorial.

## Adaptação restrita, fontes e licenças

`scripts/prepare-editorial-adaptation.js` usa snapshot limitado das fontes atuais
CAMAP2, dependências offline e API/gerador originais. O projeto irmão não foi
editado nem recebeu instalação de dependências. Hashes completos autorizam
**somente dois patches** em uma cópia nova:

1. Helper local: HTTPS sem credenciais, fragmentos e caminhos server-relative
   seguros; recusa protocolo relativo, backslash, controles e bypasses codificados.
   Valor válido preservado; link inválido vira `#`, CTA inválido é omitido.
2. Editorial: filtro de itens de runtime, sem getters; objetos válidos com título
   string e URL/resumo conforme contrato. Null/arrays/escalares/tipos inválidos
   não quebram o render. Filtro não remove itens do armazenamento nem transforma
   o schema XML em um schema de cada item.

Chave, quatro parâmetros (`title`, `limit`, `items`, `catalogTarget`), defaults,
labels, XML, CSS e semântica histórica do limit preservados. Nenhum backend,
imagem, HTML rico, ACL, catálogo dinâmico ou nova feature de Joomla/PHP inventada.

[Proveniência local](PROVENIENCIA-MODULOS-CAMAP.md) confirmou MIT na raiz do agregador
no commit de introdução e bytes do editorial/helper/CSS após normalização de
finais de linha. A ausência de LICENSE dentro de CAMAP2 não equivale à ausência
de licença aplicável. O aviso MIT original foi copiado **integralmente**, e a
GPL completa acompanha as alterações próprias, sem atribuir GPL a CAMAP2 inteiro.

Pacotes finais: **11 payloads inventariados / 13 arquivos por revisão**. Incluem
MIT/GPL, inventário, plano, avisos e proveniência; nenhum runtime de outro módulo.
Finalizador recusa arquivos estrangeiros mesmo corretamente inventariados e exige
os cinco payloads runtime, wrapper exato e correspondência de hashes do overlay.
[Builder e contrato](ADAPTACAO-EDITORIAL-SEGURA.md).

| Revisão | SHA-256 do inventário aprovado |
| --- | --- |
| 0.3.0 | `73eb9d3aaec73292e36bf8d7acd762fbd52d9cf5c360073d071c5524ca8725f9` |
| 0.3.1 | `43095f2d50235c6c01bc037601a8e9c871b29d865290a0e8af9098ecedc21208` |

Revisão independente não encontrou blocker para este conjunto mínimo e a operação
delimitada. Avisos/licenças/fontes adicionais foram conferidos antes do upload;
dados da instância são textos novos neutros e links locais, sem mídias externas.
Flags false dos planos preparados não foram reescritas para simular clearance:
evidência operacional fica em recibos separados. Não é aprovação legal/privacidade
global ou fechamento de fontes/build de uma distribuição pública maior.

## Publicação e ciclo real

1. Pacotes finais novos carregados com `overwrite=false`, 13 arquivos por revisão,
   hashes/bytes/MIME relidos. Quatro pacotes (dois do piloto, dois editoriais)
   verificados remotamente por descoberta/inventário, sem executar entrypoints.
2. 0.13.0 contém quatro raízes aprovadas: piloto permanece como na 0.12.0;
   **editorial 0.3.0 descoberto, 0.3.1 aprovado sem descoberta**. Estilos ligados
   ao entrypoint exato de cada revisão. Não elevar limite de dez raízes nem
   remover aprovação de uma revisão em uso para contorná-lo.
3. Prévia read-only em 320/768/769/900/1366/1920/2560 px passou rotas, amostra
   bloqueada, piloto preservado e botão Registrar do editorial. Upload/releitura
   dos 243 assets passaram; rollback para 0.12.0 preparado, não executado.
   Downgrade após cadastro exige desabilitar editorial separadamente; não apagar
   seus dados para trocar host. Ativação seletiva preservou outras webparts.
4. Escape cancelou cadastro sem mudar 42 itens; Enter registrou extensão
   desabilitada sem instância (43). Botão real habilitou; formulário criou uma
   instância (44), escopo All/main-bottom, duas leituras selecionadas com links
   locais. Edição pelo formulário alterou título de parâmetros e limit para 1.
   GETs independentes confirmaram os dados. Nenhum artigo foi criado/editado.
5. Tentativa de edição com ETag da instância anterior foi recusada, sem mudança
   do snapshot. Upgrade/reversão pelo serviço retornaram sucesso/releitura e
   preservaram bytes/ETags de todas as instâncias, IDs, estado e chave. O site
   carregou JS/helper/CSS das revisões 0.3.1 e depois 0.3.0.
6. Botões reais desabilitaram/reativaram extensão e instância separadamente;
   render/CSS editorial desapareceram e voltaram corretamente, sem alterar
   settings/atribuições. Remoção pelo serviço foi recusada pela dependência da
   instância, com snapshot idêntico. Nenhum registro/asset foi removido.
7. Import real do módulo corrigido e ensaio read-only de render no navegador
   confirmaram fallback de URLs, CTA inseguro omitido, texto escapado e itens
   malformados/accessor recusados sem getters. URLs inseguras não foram
   persistidas ou solicitadas. Não é sandbox para código arbitrário/Proxies.
8. Releituras públicas confirmaram título revisado, primeiro item/resumo/link,
   CSS grid e uma única instância/folha de estilo editorial, piloto e conteúdo
   originais. Reload final passou TinyMCE/abas/cleanup, quatro plugins, imagens,
   menus, Sample Data bloqueado, 166/107 recursos admin/público observados sem
   HTTP >=400 de assets. Ambas páginas publicadas; 44 itens finais.

Após rollback a UI pode não mostrar atualização do editorial, pois a raiz
descoberta é 0.3.0; aceitar upgrade pela UI requer nova configuração que descubra
0.3.1 e retenha 0.3.0. Esta rodada comprova revisões pelo serviço, não afirma ter
executado a atualização editorial pelo botão do painel.

## Contraprovas e recuperação

- Teste completo inicial falhou ao comparar fontes do contributor enquanto
  agente alterava o builder/teste. Falha mantida como histórico; execução com
  fontes estáveis passou em 85 suítes. Não mascarar isso como passe inicial.
- Primeira inclusão de GPL expôs lookup com caixa diferente no coletor: build
  falhou antes da reserva do destino final. Correção limitada no lookup;
  novos builds finais/auditoria passaram. Stages anteriores não viraram release.
- Primeiro upload editorial falhou no estágio de pastas por referência residual
  à pasta do piloto no runner privado. Leitura independente confirmou raiz nova
  ausente e zero arquivos. Caminho corrigido, continuação com intent novo e
  `overwrite=false`, sem replay cego. Os dois pacotes finais foram verificados.

IDs/configuração, snapshots brutos/ETags, packages, intents, cópias de avisos e
recibos permanecem em `tmp/step2c/`, `tmp/step2d/` e `tmp/editorial-adapt-*`
ignorados. Não versionar dados/cookies/tokens nem publicar esses arquivos privados.
Agregação final conferiu hashes de 26 recibos aprovados. Reempacotamento
independente confirmou 91 payloads próprios administrativos/core idênticos aos
bytes congelados da 0.13.0; nenhum delta runtime posterior foi incorporado
silenciosamente. Avisos e snapshots da adaptação são fontes de evidência
delimitadas, não um parecer de distribuição pública.

## Fila restante

- Nove módulos: adaptar e aceitar individualmente os defeitos registrados;
  nenhuma correção do helper de seus pacotes antigos foi aplicada implicitamente.
- Plugins/templates XML com contratos separados e executor/UI de migração
  assistida ainda pendentes. Amostra em tenant vazio/recuperação interrompida,
  save/upload editorial integral e aceites assistivos completos não fechados.
- Integração na principal preserva trabalho local, sem merge/descartar patches.
  Fontes correspondentes, privacidade, marcas e direitos da distribuição ampla
  ainda exigem revisão. Não declarar o plano inteiro ou distribuição pública prontos.
