# Checklist de aceite local — MINIJOOMLA

## Validado automaticamente

- [x] Testes unitários e de integração locais passam sem rede.
- [x] Sintaxe de todos os arquivos JavaScript em `src/` e `tests/` é verificada.
- [x] Shell possui skip link, landmarks e foco no conteúdo após navegação.
- [x] Menu e breadcrumbs expõem o item atual com `aria-current`.
- [x] Busca possui label associado, nome acessível no formulário, instrução
  associada por `aria-describedby`, `role="search"` e status `role="status"`
  com `aria-live`/`aria-atomic`.
- [x] CSS contém breakpoints para 768 e 480 px.
- [x] CSS contém foco visível, redução de movimento, `forced-colors` e impressão.
- [x] O router sincroniza navegação programática, `hashchange` e
  voltar/avançar via `popstate`.
- [x] Estados de carregamento, erro e rota inexistente possuem anúncio
  semântico para tecnologias assistivas.
- [x] O shell exibe o estado de carregamento imediatamente, antes da conclusão
  de operações assíncronas do adapter, sem permitir que renders obsoletos o
  sobrescrevam.
- [x] O estado de carregamento também aparece antes de listeners assíncronos
  registrados em `onBeforeRender`.
- [x] Falhas de listeners de ciclo de vida não expõem detalhes internos nem
  interrompem a renderização segura; hooks observacionais pós-render não
  invalidam uma tela já montada.
- [x] `git diff --check` passa.

## Status da validação visual e lacunas residuais

O aceite local da fase 1 está concluído. Os itens abaixo são limitações
residuais que não bloqueiam a composição fake local, mas impedem declarar um
aceite visual completo em navegador/SharePoint.

- [x] Navegação por teclado em 320, 768, 1366 e 1920 px, incluindo `Tab`,
  `Shift+Tab`, skip link, `Enter` na busca e foco pós-navegação.
- [ ] Zoom de 200% e 400%, incluindo reflow sem rolagem horizontal indevida.
- [ ] Alto contraste/`forced-colors` em navegador.
- [x] Contraste WCAG calculado para as combinações usadas e leitura estrutural
  das rotas principais concluída; a emulação de alto contraste permanece
  pendente.
- [ ] Inspeção visual no site de testes SharePoint informado pelo usuário.

### Evidência local parcial — FIORI-AUTO

- [x] As rotas `#/`, `#/article/boas-vindas`, `#/category/noticias`,
  `#/search?q=energia` e `#/rota-inexistente` montaram o shell no navegador.
- [x] Em 320 px, cada rota apresentou `header`, `main#main-content`, `aside`
  e `footer`; a busca apresentou `form[role="search"]` e região `[aria-live]`.
- [x] Foram geradas capturas read-only nas quatro larguras configuradas pelo
  probe: 320, 768, 1366 e 1920 px, para as cinco rotas.
- [x] A matriz DOM nas cinco rotas e quatro larguras confirmou `scrollWidth`
  igual à largura do viewport, sem overflow horizontal, além de `lang="pt-BR"`,
  título específico por rota e `main#main-content`.
- [x] Após cada navegação, o foco foi confirmado em `main#main-content`; os
  menus/breadcrumbs também expuseram elementos com `aria-current`.
- [x] O formulário de busca foi testado por teclado: `Enter` no campo preserva
  a navegação no hash (`#/search?q=arquitetura`) e renderiza o resultado.
- [x] A sequência `Tab`/`Shift+Tab` foi exercitada no shell, incluindo skip
  link, título, itens de menu, links de módulos e retorno ao item anterior.
- [x] A matriz pós-correção repetida nas cinco rotas e quatro larguras confirmou
  novamente foco em `main#main-content`, ausência de overflow horizontal,
  títulos por rota e idioma `pt-BR`; a busca manteve `role="search"` e
  `aria-live`.
- [x] O shell também expõe nomes acessíveis para os landmarks estruturais:
  `main[aria-label="Conteúdo principal"]` e
  `aside[aria-label="Navegação secundária"]`.
- [x] O cálculo WCAG das combinações usadas confirmou branco sobre verde em
  `4,74:1`, branco sobre azul em `6,56:1`, preto sobre amarelo em `13,48:1`,
  preto sobre verde-água em `7,94:1` e preto sobre branco em `21:1`. O cinza
  `#75787B` permanece restrito a bordas (`4,44:1` sobre branco), conforme a
  identidade Petrobras.
- [x] As cores estruturais observadas correspondem à paleta autorizada:
  verde `#008542`, azul `#006298`, amarelo `#FDC82F` e branco.
- [x] A API desta versão do FIORI-AUTO permitiu a operação de teclado via
  `fiori.pressKey`; zoom e `forced-colors` continuam sem emulação disponível.
- [x] `browser.evaluate` foi usado com retorno em envelope serializável para
  confirmar título, foco, idioma, landmarks e overflow nas matrizes locais.

### Inspeção read-only do endereço SharePoint autorizado

- [x] A URL informada foi aberta em uma instância própria do FIORI-AUTO, sem
  publicação ou alteração: `RPC 47176`, perfil isolado da sessão.
- [x] O shell SharePoint respondeu com título `SAP Scripting`, sem overflow
  horizontal no viewport observado.
- [x] A página expôs o shell SharePoint/Office com iframes, mas não expôs
  `main` nem controles identificáveis do MINIJOOMLA; portanto, não há evidência
  para validar visualmente o aplicativo nesse endereço.
- [x] A inspeção estrutural encontrou apenas webparts/Canvas genéricos; não
  encontrou identificadores semânticos `minijoomla`, `modern-script-editor` ou
  `script-editor`. O único falso sinal `mse` veio de uma classe CSS ofuscada,
  sem id semântico, e não caracteriza um webpart MSE.
- [x] A página não ofereceu outra página de conteúdo interna além dela própria;
  a tentativa read-only de abrir a listagem `SitePages/Forms/AllItems.aspx`
  retornou um documento sem título, links ou estrutura utilizável. Nenhuma
  permissão foi contornada e nenhuma API alternativa foi usada.
- [ ] O aceite visual SharePoint permanece pendente: a página autorizada não
  disponibilizou o conteúdo MINIJOOMLA nesta sessão. Uma navegação adicional
  também excedeu o timeout de `networkidle`, embora o DOM do shell tenha
  continuado acessível para inspeção read-only.

A validação visual deve usar uma instância própria do FIORI-AUTO, conforme as
instruções do workspace. Nenhuma publicação ou acesso SharePoint faz parte dos
testes locais acima.

## Roteiro FIORI-AUTO para aceite visual

Quando a instância isolada estiver disponível, executar este roteiro no
documento local servido por HTTP e, somente se autorizado, no MSE da página de
teste informada pelo responsável:

1. Iniciar uma instância própria do `FioriAgent`, com porta RPC/CDP e perfil
   exclusivos da sessão; não reutilizar instância de outra LLM.
2. Abrir as rotas `#/`, `#/article/boas-vindas`, `#/category/noticias`,
   `#/search?q=energia` e `#/rota-inexistente`.
3. Repetir cada rota em 320, 768, 1366 e 1920 px e registrar overflow horizontal,
   cortes, sobreposição, foco e legibilidade.
4. Testar teclado: skip link, menu, busca com `Enter`, resultados, `Tab`,
   `Shift+Tab` e foco em `#main-content` após cada troca de rota.
5. Repetir em zoom 200% e 400%, incluindo reflow equivalente a 320 CSS px.
6. Ativar `forced-colors`/alto contraste e confirmar que foco, links, campos,
   estados e bordas continuam distinguíveis sem depender somente de cor.
7. Conferir título, `lang`, landmarks, breadcrumbs, `aria-current`, região
   `aria-live` e ausência de documento HTML aninhado no `body`.
8. Se o MSE for usado, validar primeiro somente leitura no endereço autorizado;
   qualquer publicação deve usar versão imutável, evidência de rollback e o
   procedimento oficial do workspace. Não registrar cookies, tokens ou dados
   corporativos nas evidências.
