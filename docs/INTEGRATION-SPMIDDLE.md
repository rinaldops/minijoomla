# MINIJOOMLA — plano futuro de integração com SPMIDDLE

**Status:** planejamento; não implementa nem executa integração SharePoint

O aceite da fase local não equivale a prontidão para integração. Os Marcos C e
D continuam bloqueados até que a matriz visual exigida pelo prompt seja fechada
(incluindo zoom/alto contraste), o working tree da entrega esteja limpo e haja
autorização operacional explícita para o destino correto.
**Princípio:** somente adapters/interfaces injetáveis
**Fase atual:** fake contracts, fixtures locais e testes sem rede

## 1. Objetivo e fronteira

O MINIJOOMLA deve continuar sendo uma camada Joomla-like independente. O
SPMIDDLE será uma implementação futura dos ports de dados, não uma dependência
dos componentes visuais. A integração prevista é:

```text
SPMIDDLE (transporte, auth, schemas, repositories, mappers, ETags)
        ↓ adapter que implementa ports neutros
MINIJOOMLA application services/use cases
        ↓ view models
componentes, módulos e template
```

Nesta fase não haverá URL SharePoint, chamada REST, autenticação, token,
cookie, ETag, provisioning, alteração em `Preview.aspx` ou `Default.aspx`, nem
dados editoriais permanentes. O fake adapter é a única implementação executável
esperada localmente.

## 2. Interfaces estáveis e responsabilidade

Os ports devem representar necessidades de negócio/apresentação, sem reproduzir
assinaturas ou objetos internos do SPMIDDLE.

```text
ContentPort
  getArticle(ref, options) -> Promise<Result<Article>>
  listArticles(query) -> Promise<Page<Article>>

CategoryPort
  getCategory(ref) -> Promise<Result<Category>>
  listCategories(query) -> Promise<Category[]>

TagPort
  listTags(query) -> Promise<Tag[]>
  listArticlesByTag(tagRef, query) -> Promise<Page<Article>>

MenuPort
  getMenu(name) -> Promise<Menu>
```

Os tipos `Article`, `Category`, `Tag`, `Menu`, `Page` e `Result` são contratos
neutros do MINIJOOMLA. O adapter converte os dados de origem para esses tipos e
normaliza ausência, paginação, datas, ordenação e erros. Nenhum componente pode
receber uma resposta REST, item de lista, contexto de autenticação ou metadado
de transporte.

### Responsabilidade por camada

| Camada | Responsabilidade | Não deve fazer |
| --- | --- | --- |
| Componentes/módulos/template | consumir view models, renderizar estados e emitir ações declaradas | importar SPMIDDLE, montar URL, ler token/ETag ou decidir schema |
| Casos de uso | compor ports, aplicar filtros e regras de apresentação | conhecer lista `mse*`, endpoint ou mecanismo de auth |
| Ports/interfaces | definir capacidades e tipos neutros | expor SDK do SharePoint ou detalhes de transporte |
| Adapter SPMIDDLE futuro | mapear ports para contratos/repositories do SPMIDDLE, traduzir erros e paginação | alterar componentes, contornar allowlists ou guardar segredos |
| SPMIDDLE | REST, autenticação, schemas, allowlists, repositories, mappers, ETags e provisioning | assumir decisões de layout ou renderização |
| Fake adapter | fixtures determinísticas, latência/erro simuláveis e dados de teste | acessar rede ou imitar credenciais reais |

## 3. Sequência de integração futura

### Marco A — congelar contratos locais

- publicar tipos/versionamento dos ports;
- definir `NotFound`, validação, falha transitória e erro de contrato;
- definir paginação, limite máximo, ordenação, timezone e serialização de datas;
- manter o fake como implementação de referência e teste de conformidade.

**Saída:** componentes executam com fake sem nenhuma mudança de código visual.

### Marco B — adapter de leitura isolado

- implementar o adapter em pacote/módulo de infraestrutura separado;
- receber dependências SPMIDDLE por injeção, sem import global nos componentes;
- mapear schemas/DTOs para os tipos neutros e descartar campos não necessários;
- respeitar allowlists, timeouts, cancelamento e limites já definidos pelo
  SPMIDDLE;
- cobrir o adapter com testes de contrato usando respostas sanitizadas/fakes,
  não com uma chamada real durante a suíte local.

**Saída:** os mesmos casos de uso podem escolher `FakeAdapter` ou
`SPMiddleAdapter` por composição.

### Marco C — leitura autorizada em Preview

Somente após aceite integral da matriz da fase 1 e autorização operacional
explícita. A primeira superfície futura é `Preview.aspx`; `Default.aspx` fica
para etapa posterior. Validar, antes de qualquer publicação ou conexão:

- destino de produção e sessão autorizada;
- HTTPS, certificado, CSP, MIME, cache e permissões;
- allowlists e schemas do SPMIDDLE;
- ausência de segredo em código, logs, fixtures ou documentação;
- comportamento de 404, timeout, resposta incompleta e indisponibilidade;
- rollback por versão imutável do pacote.

Este marco não autoriza escrita editorial, provisioning ou alteração de listas.

### Marco D — operações mutáveis, se aprovadas

Somente com contratos explícitos de escrita, validação, sanitização, CSRF,
idempotência e controle de concorrência. ETags e detalhes de conflito ficam no
adapter/SPMIDDLE; a UI recebe um erro de domínio acionável. ACL continua fora
do MINIJOOMLA até existir um escopo próprio, aprovado e documentado.

## 4. Matriz de dependências e lacunas

| Dependência/decisão | Dono | Pré-requisito para | Situação na fase 1 |
| --- | --- | --- | --- |
| Ports e tipos neutros | MINIJOOMLA | qualquer adapter | deve ser congelado/testado |
| Fixtures e fake adapter | MINIJOOMLA | desenvolvimento e CI | obrigatório, sem rede |
| Schemas e allowlists | SPMIDDLE | adapter futuro | não disponíveis dentro do MINIJOOMLA |
| Repositories e mappers SharePoint | SPMIDDLE | leitura autorizada | fora do repositório/escopo desta fase |
| Autenticação e sessão | SPMIDDLE/host autorizado | conexão futura | não implementada |
| Política de erros/retry/timeout | contrato conjunto | confiabilidade | lacuna a decidir antes do Marco B |
| ETag/conflito | SPMIDDLE | escrita futura | não exposto ao componente |
| Segurança de escrita/CSRF | integração e host | qualquer mutação | fora da fase 1 |
| Preview e pacote de publicação | operação autorizada | Marco C | não tocar nesta fase |
| Dados editoriais reais | responsável do domínio | validação futura | proibidos nesta fase |

## 5. Critérios de aceite do plano

- [x] Trocar `FakeAdapter` por um adapter de contrato não exige mudar
  componentes, módulos ou templates.
- [x] Nenhum import de SPMIDDLE aparece em UI, template, módulo ou componente.
- [x] Os testes unitários rodam sem rede, credenciais, cookies ou SharePoint.
- [ ] Mapeamentos rejeitam dados inválidos e não deixam escapar DTOs, URLs,
  ETags ou erros de transporte para a apresentação.
- [x] Paginação, datas, ausência, falhas e limites têm comportamento documentado
  e testes de contrato.
- [ ] O plano de leitura em `Preview.aspx` só é executado após autorização e
  validação de produção; `Default.aspx` permanece fora desta etapa.
- [ ] Qualquer escrita futura tem contrato separado, proteção CSRF, validação,
  sanitização, idempotência e rollback demonstrado.
- [x] Não existem segredos ou dados pessoais em fixtures, logs, documentação ou
  configuração versionada.

## 6. Rollback e isolamento

### Antes de conexão

O rollback é simplesmente manter a composição `FakeAdapter`. O build/teste local
deve continuar funcionando sem o pacote ou configuração do SPMIDDLE.

### Após integração de leitura em Preview

1. desativar a composição do adapter remoto e selecionar o fake;
2. restaurar o pacote anterior por versão imutável, sem sobrescrever artefato;
3. confirmar que nenhum componente passou a depender do adapter remoto;
4. revisar logs por tokens, cookies, URLs internas ou dados indevidos;
5. executar testes locais, de contrato e `git diff --check`;
6. registrar a evidência da reversão sem publicar dados ou credenciais.

Se houver operação mutável no futuro, o rollback da aplicação não desfaz
automaticamente uma transação SharePoint. A reversibilidade da escrita deverá
ser definida pelo contrato do SPMIDDLE antes do aceite, com idempotência,
compensação ou procedimento operacional específico.

## 7. Não objetivos explícitos

- não embutir REST, Microsoft Graph ou SDK SharePoint no MINIJOOMLA;
- não fazer descoberta automática de listas, schemas ou endpoints;
- não copiar contratos de `mse-platform` ou de sites específicos;
- não usar `Preview.aspx` como atalho para desenvolver contra SharePoint;
- não introduzir ACL, grupos ou autorização editorial nesta integração;
- não transformar o fake em um servidor ou em uma simulação de produção.
