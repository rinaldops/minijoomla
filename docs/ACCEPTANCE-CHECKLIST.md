# Checklist de aceite local — MINIJOOMLA

## Validado automaticamente

- [x] Testes unitários e de integração locais passam sem rede.
- [x] Sintaxe de todos os arquivos JavaScript em `src/` e `tests/` é verificada.
- [x] Shell possui skip link, landmarks e foco no conteúdo após navegação.
- [x] Menu e breadcrumbs expõem o item atual com `aria-current`.
- [x] Busca possui label associado, `role="search"` e região `aria-live`.
- [x] CSS contém breakpoints para 768 e 480 px.
- [x] CSS contém foco visível, redução de movimento, `forced-colors` e impressão.
- [x] `git diff --check` passa.

## Pendente de validação visual autorizada

- [ ] Navegação por teclado em 320, 768, 1366 e 1920 px.
- [ ] Zoom de 200% e 400%, incluindo reflow sem rolagem horizontal indevida.
- [ ] Alto contraste/`forced-colors` em navegador.
- [ ] Contraste WCAG e leitura das rotas principais.
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
- [x] As cores estruturais observadas correspondem à paleta autorizada:
  verde `#008542`, azul `#006298`, amarelo `#FDC82F` e branco.
- [ ] A API desta versão do FIORI-AUTO não disponibilizou uma operação de
  teclado, zoom ou `forced-colors`; esses itens continuam sem evidência.
- [ ] `browser.evaluate` foi localizado no contrato RPC, mas retornou
  `E_CDP_NO_VALUE`/`E_INTERNAL` nesta instância para expressões simples; não
  foi usado como evidência de título, foco, idioma ou overflow.

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
