# Contribuir com MINIJOOMLA

MINIJOOMLA é uma implementação JavaScript independente inspirada na organização
do Joomla. Contribuições para o núcleo, testes, acessibilidade e documentação
são bem-vindas. Não é uma distribuição oficial nem promete paridade Joomla/PHP.

## Preparar e testar

Use uma versão LTS mantida do Node.js, 22 ou posterior, com npm. A suíte usa
módulos ES e ferramentas nativas do Node; não exige instalação de pacotes,
conta de serviço, autenticação ou acesso à rede.

Na raiz do projeto:

```bash
npm test
npm run check
```

`npm test` executa os testes do núcleo e contratos locais. Não precisa do
projeto irmão SPMIDDLE. Quando `../SPMIDDLE` está ausente, o runner mostra um
`SKIP` por suíte de integração opcional e informa os totais ao final. As oito
suítes atualmente opcionais são:

- `admin-integrity.test.js`
- `admin-extensions-service.test.js`
- `admin-extensions-app.test.js`
- `spmiddle-integration.test.js`
- `site-runtime.test.js`
- `component-options-runtime.test.js`
- `schema-migration.test.js`
- `entity-contracts-final.test.js`

Algumas incluem verificações locais, mas seus imports transitivos ainda exigem
SPMIDDLE. Separar essas verificações em suítes independentes é trabalho futuro.
Os testes `spmiddle-adapter.test.js` e `spmiddle-error-translation.test.js` usam
implementações locais e **não** são omitidos.

Se o projeto irmão estiver presente, todas as integrações são executadas
automaticamente. Um checkout incompleto, erro de import, export ausente ou
assertion falha produz saída não zero; não é convertido em `SKIP`. O runner
continua nas demais suítes e agrega as falhas. Não há flag CLI para desabilitar
uma integração instalada. Use somente a implementação real compatível, sem
criar pacotes falsos para simular aprovação de middleware.

`tests/runner.test.js` verifica a ausência em uma cópia isolada das fontes e
testes sob `tmp/`, sem mover ou excluir o projeto irmão real. Também comprova
que uma integração incompleta falha. Os temporários criados pelo teste são
removidos ao terminar. `npm run check` verifica sintaxe, não substitui os testes.

Para a demonstração local, execute `node scripts/serve-local.js` e abra
`http://127.0.0.1:8080/examples/index.html` ou `/examples/admin.html`.
O servidor só escuta loopback, é somente leitura e não serve `tmp/`, Git ou
documentação. Não é um servidor de produção. Use `--port` para outra porta local.
Dados das demos são sintéticos e compartilhados no armazenamento dessa origem.

Testes nativos do painel têm um comando separado, sem SPMIDDLE, tenant ou dados
persistidos: `npm run test:admin-layout -- --agent '<caminho-local>\FioriAgent.exe'`.
Requer Windows/Edge e o agente FIORI-AUTO0.3.3 pré-compilado fornecido localmente.
Não é dependência de `npm test`. [ADMIN-LAYOUT-TESTS.md](ADMIN-LAYOUT-TESTS.md)
explica isolamento, sete larguras, controles negativos e limites.

## Escopo e limites

- Preserve a direção `dados → adapter → casos de uso → view models → UI`.
  Evite transporte ou endpoints específicos nos componentes de apresentação.
- Use dados sintéticos e exemplos genéricos. Não envie tokens, cookies,
  credenciais, dados pessoais, identificadores reais ou evidências de ambientes.
- Corrija um problema por contribuição, com teste de regressão proporcional.
  Prefira comportamentos observáveis a detalhes internos de implementação.
- Para mudanças visuais, preserve foco, teclado, reflow, contraste, zoom e
  movimento reduzido. Registre o que foi realmente testado em navegador; as
  verificações Node de DOM/CSS não constituem aceite visual ou de leitor de tela.
- O painel não implementa autenticação/ACL. Veja [SECURITY.md](SECURITY.md)
  antes de propor integração, upload ou exposição em rede.
- O gate offline `npm run release:check`, coberto pela suíte núcleo
  `release-check.test.js`, verifica estrutura local, não aprova publicação.
  O staging opcional [`core`](RELEASE-CORE.md) também é testado pelo runner sem
  SPMIDDLE; `all`/`site` continuam exigindo a integração. Staging e integrações
  ainda exigem revisão própria para uma release pública
  independente. Passar `npm test` não torna a distribuição pronta. Consulte
  [OPEN-SOURCE-READINESS.md](OPEN-SOURCE-READINESS.md) para as pendências.

## Enviar uma contribuição

1. Descreva o problema em uma issue com passos mínimos e dados sintéticos.
   Vulnerabilidades seguem o canal privado descrito em [SECURITY.md](SECURITY.md).
2. Faça a alteração em uma branch própria, preservando mudanças não relacionadas.
3. Inclua testes e atualize os documentos diretamente afetados. Ao adicionar
   uma suíte Node, registre seu arquivo e função exportada em
   `tests/run-tests.js`. Declare dependências opcionais explicitamente e
   justifique imports transitivos; não capture erros do núcleo como skips.
4. Execute os dois comandos acima e `git diff --check`. Informe a versão do
   Node, suítes omitidas, resultados e qualquer validação não realizada.
5. Abra um pull request com resumo, testes e limites. Não inclua `tmp/`,
   snapshots de ambientes reais nem mudanças de publicação não solicitadas.

## Licenciamento

O código próprio usa [GPL-2.0-or-later](../LICENSE.md). Envie apenas material
que você tenha direito de contribuir sob essa licença. Preserve os avisos de
terceiros e confira [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) antes de
adicionar ou redistribuir bibliotecas, ativos ou artefatos compilados.
