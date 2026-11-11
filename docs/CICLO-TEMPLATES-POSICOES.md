# Ciclo — posições de templates instalados

## Desenvolvimento

Base `420bb07`, branch step2; primeiro incremento menor da reconciliação nativa
de templates da `main`. O processo segue Desenvolvimento → Teste no site →
Análise → correções/reteste → Validação → Documentação. Etapas seguintes não
avançam usando passe antigo quando uma nova falha é descoberta.

Implementado: declaração segura de posições próprias, catálogo administrativo,
validação de criação/movimentação e roteamento por template ativo. Preservados
defaults genéricos, código de cancelamento/plugins, JSON desconhecido e ETags.
Sem nova coluna, XML de templates, parâmetros de estilo ou template CAMAP-V3.
[Contrato incremental](TEMPLATE-INSTALL-CONTRACT.md).

A principal continuou editada por outra frente. Nova captura privada de **65
arquivos / 993.291 bytes** preservou o estado observado, além do snapshot anterior
de 59. Não foi modificada por este incremento e merge/retirada continuam pendentes.

## Teste no site → análise → Desenvolvimento → reteste

FIORI-AUTO próprio na página administrativa SharePoint autorizada. Antes/depois,
48 registros com ETags, duas páginas e hash do host ativo conferidos e iguais.
Prova temporária em iframe próprio, com fontes servidas em pasta imutável de
SiteAssets; catálogo/repositórios estritamente em memória, sem escritas nas
listas/páginas e sem instalação/ativação de template no site aceito.

Falhas encontradas e corrigidas antes de validar:

1. Envio inicial excedeu o timeout e ficou parcial. Arquivos já presentes foram
   lidos/hash verificados; completados somente caminhos ausentes, sem overwrite.
   Lotes pequenos passaram. Primeira prova não constitui aceite do incremento.
2. Target core não inclui o admin-service; o pacote de teste não montou.
   Preparado target all em **revisão nova**, sem regravar a prova anterior.
3. O SharePoint transforma HTML em página de visualização; módulo da fixture
   não rodou diretamente nessa página. Usado documento temporário de iframe com
   módulo externo same-origin. A variante `srcdoc` também rejeitou `pushState`;
   o iframe passou a ter documento normal sem alterar canvas ou estilos do host.
4. A revisão independente encontrou posição órfã selecionando `topbar` ao editar
   somente título. A view conserva a opção atual “fora do catálogo”; teste pelo
   handler real confirmou preservação. Não liberar posições órfãs para novas
   criações/duplicações.
5. Array externo de templates executava getter antes do import. Leitura por
   descritores e negativo zero getter/zero import corrigiram essa fronteira.
6. Movimento estrutural em lote dependia de catálogo customizado corrompido.
   Destinos nativos dispensam catálogo; customizados continuam exigindo leitura
   completa/metadata válida.

Reteste SharePoint final: posição própria no select, edição/salvamento com
teclado, renderização do módulo `custom-html` no slot do template externo,
link por Enter e reflow de 320/768/900. Pacote all de prova contém 253 payloads
inventariados, mais seu manifesto; entry externo corretivo tem recibo próprio.
Original administrativo permaneceu intacto; iframe foi removido e navegador
próprio encerrado. Assets imutáveis de prova permanecem, sem uso pelo host ativo.

## Validação e documentação

Focais de runtime/administração aprovados após os achados. Regressão integrada
concluída: **114 suítes aprovadas, zero skips/falhas**; parse-only **342 JS/MJS**.
Contributor validou **433 caminhos exatos** com hashes/inventário determinísticos;
arquivos de fixture e novos testes foram selecionados explicitamente, sem abrir
acesso a pastas privadas. Os casos antigos que tratavam qualquer posição nova
como erro foram atualizados para nomes malformados, mantendo testes de recusa.
Reauditoria independente dos três achados confirmou correções e executou os
dois exports focais novamente, aprovados; não encontrou P1 remanescente no recorte.
A lista externa de registros não é um sandbox contra Proxies/objetos JS hostis;
o negativo de accessor comprovado não é garantia universal desse tipo.
Este ensaio real SharePoint valida comportamento **isolado em memória**, não
persistência de um template no catálogo real, release nativa, XML completo ou
aceite de toda a instalação genérica. Nenhum commit/push desta rodada automático.

Próximo desenvolvimento: parâmetros declarados de estilos e demais contribuições
nativas da principal, com desenho de persistência explícito, ciclo próprio e
sem descartar mudanças posteriores. Merge/retirada ainda exigem reconciliação
completa, teste proporcional e suplemento da preservação operacional.
