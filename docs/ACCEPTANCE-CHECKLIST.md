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

A validação visual deve usar uma instância própria do FIORI-AUTO, conforme as
instruções do workspace. Nenhuma publicação ou acesso SharePoint faz parte dos
testes locais acima.
