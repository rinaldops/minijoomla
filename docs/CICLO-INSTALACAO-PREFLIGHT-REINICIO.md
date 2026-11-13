# Instalação: dependências, erros e reinício seguro

Release final: **0.17.6**. As revisões 0.17.3/0.17.4/0.17.5 foram ensaios intermediários
imutáveis; não usar para uma nova instalação.

## Mudanças

- O pacote genérico já contém o SPMIDDLE em `libraries/vendor/spmiddle/`.
  Não depende de uma publicação separada em `SiteAssets/spmiddle/`.
- Antes de liberar a instalação e antes da primeira intenção de escrita,
  o host verifica imports/contratos, recursos JS/CSS obrigatórios, armazenamento
  privado, identidade do web, permissão ManageLists e request digest.
- A tela apresenta falhas de pré-requisitos, progresso imediato e verificação
  novamente, sem repetir automaticamente uma escrita incerta.
- Barra nativa acessível com dez etapas comprovadas, estágio atual, faixa de
  atividade e tempo decorrido desde o clique. Nenhum timer simula avanço ou
  sucesso. Os timers/listeners são removidos ao concluir, falhar ou sair.
- Reinício confirmado limpa apenas o diário do destino vazio ou listas vazias
  com recibos completos, IDs e fingerprints idênticos. Não apaga configuração
  instalada, conteúdo editorial, listas sem recibo, releases, páginas ou SPMIDDLE.
- A criação de listas/campos com `__metadata` usa JSON OData verbose, como exigido
  pela API. Enviar esses corpos como nometadata provocava HTTP 400 antes da
  primeira lista, causando a intenção pendente observada pelo usuário.
- Campos são criados com índices/restrições finais. O Title nativo é reutilizado.
  Quando uma inicialização estreita de um campo ainda for necessária, usa ETag
  forte quando oferecida. SP.Field sem ETag recebe somente inicialização em uma
  lista recém-criada por esta operação, ainda vazia, com rechecagem e readback;
  sem wildcard, ETag inventada, retry ou promessa de concorrência distribuída.

## Limites

O diário e a exclusão local não são lock global de SharePoint. Fechar outras
abas de instalação é necessário; writers externos podem alterar o destino.
O host usa Web Locks quando disponíveis para serializar instalação/reinício
nas abas do mesmo navegador/origem. Isso não bloqueia outros usuários ou perfis.
Reinício não adota uma lista criada sem recibo nem apaga um CMS instalado.
Uma remoção parcial interrompida conserva o diário. Dados alheios são preservados.

## Validação

Os testes cobrem falhas de import/MIME/contratos/permissões, recurso removido
entre inspeção e clique, reset confirmado, conflito de plano/dados, erro na
remoção, preservação do diário e contratos do host genérico com módulos reais.
O navegador real foi operado exclusivamente por instância própria do FIORI-AUTO.
As evidências operacionais locais ficam em `tmp/`, fora do Git.

O ensaio real criou as oito listas vazias e o arquivo operacional, montou o
painel Atum e a página pública Cassiopeia. Não instalou Sample Data ou conteúdo.
O reset de diário pendente com destino vazio foi confirmado na própria UI.
