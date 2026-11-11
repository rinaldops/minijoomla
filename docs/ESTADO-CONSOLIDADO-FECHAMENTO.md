# MINIJOOMLA — estado consolidado de fechamento (11/11/2026)

> **Entrada única de fila (item D1 do backlog 06/11/2026).** Este documento
> consolida, numa única referência, o que está concluído e o que resta dos
> seis blocos de fechamento nativo, sem substituir o histórico detalhado dos
> demais documentos — apenas aponta para eles. Ver
> [plano de continuidade completo](PLANO-CONTINUIDADE-MINIJOOMLA.md) para o
> histórico incremento a incremento e
> [avaliação/escopo 06/11](AVALIACAO-E-ESCOPO-2026-11-06.md) para os
> critérios de fechamento originais.

## Git e regressão atuais

- Branch `main`, HEAD `b83eac8` (push confirmado em `origin/main`).
- `npm test`: **124 suítes / 0 skips / 0 falhas** (última execução completa
  nesta sessão).
- `npm run check`: **361 arquivos JS/MJS** aprovados.
- Nenhuma worktree paralela; consolidação concluída (ver
  `docs/AVALIACAO-INTEGRACAO-WORKTREES.md`).

## Seis blocos — estado real

| Bloco | Estado | Referência |
| --- | --- | --- |
| 1 — Administração P0 (CRUD, filtros, lote, lixeira, editor/upload) | Concluído, aceite real em destino vazio incluído | [CICLO-ACEITE-DESTINO-VAZIO.md](CICLO-ACEITE-DESTINO-VAZIO.md) |
| 2 — Persistência (oito listas/entidades, provisionamento, ETags) | Concluído | [CHECKLIST-CONCLUSAO-MINIJOOMLA.md §7](CHECKLIST-CONCLUSAO-MINIJOOMLA.md) |
| 3 — Editor/público/imagens | Concluído, upload real validado no aceite 11/11 | [CICLO-ACEITE-DESTINO-VAZIO.md](CICLO-ACEITE-DESTINO-VAZIO.md) |
| 4 — Templates/visual (Atum/Cassiopeia/CAMAP referência) | Concluído; zoom 200/400%/`forced-colors`/leitor de tela real continuam lacuna de ferramental, não de implementação | [RELEASE-MSE-0.1.0.md](RELEASE-MSE-0.1.0.md) |
| 5 — Regressão | Concluída: 124 suítes/0 falhas, 361 arquivos de sintaxe | este documento |
| 6 — Extensões Joomla-like (módulos/plugins/templates XML, migração assistida) | Concluído (três perfis XML + executor); UI de painel para o executor é o único item não conectado | [EXTENSOES-JOOMLA.md](EXTENSOES-JOOMLA.md), [CONTRATOS-EVOLUCAO-XML.md](CONTRATOS-EVOLUCAO-XML.md) |

## Itens do backlog 06/11 (T1/T2/F1/F2/F3/A1/X1-X5/D1)

Todos marcados concluídos na tabela de
[AVALIACAO-E-ESCOPO-2026-11-06.md §3](AVALIACAO-E-ESCOPO-2026-11-06.md), com
evidência de código real conferida nesta sessão (não apenas suítes verdes):
consultas (`content-service.js`), metadados do adapter (`spmiddle-adapter.js`),
plugins administrativos conectados (`admin-plugins.js`/
`createMiniJoomlaAdminApp.js`), onze componentes `com_*` já separados,
manifestos nativos de plugin/template presentes, perfis XML de plugin/
template e executor de migração assistida publicados em `584a57c`/`55e4e80`/
`4b88527`. D1 (esta entrada) é o item que resta e está sendo fechado por este
próprio documento.

## O que explicitamente não está incluído (decisão, não lacuna)

- i18n, SEO integrado ao host, histórico/check-in-out de artigo, ACL própria,
  PHP/SQL/instalador ZIP genérico — excluídos por decisão registrada em
  `AVALIACAO-E-ESCOPO-2026-11-06.md` e `CHECKLIST-CONCLUSAO-MINIJOOMLA.md`.
- Videoteca/Forum — suspensos, pertencem ao TD, não ao MINIJOOMLA.
- Zoom real 200/400%, `forced-colors`, leitor de tela ponta a ponta — lacuna
  de ferramental do FIORI-AUTO, documentada desde `RELEASE-MSE-0.1.0.md`.
- UI de painel para o executor de migração assistida — o executor em si está
  completo e testado (10 cenários reais); só falta conectá-lo a uma tela.
- Revisão jurídica/proveniência de marcas/distribuição pública — fora do
  escopo de qualquer ciclo técnico deste repositório; tratada separadamente.

## Conclusão

Com a correção da documentação desatualizada (`EXTENSOES-JOOMLA.md` ainda
afirmava que plugins/templates XML estavam "fora deste primeiro perfil",
quando já tinham sido implementados dias antes) e a consolidação acima, o
item de fila "Integração final, documentação e margem para correções" está
concluído. Não há código pendente identificado nesta auditoria de fechamento;
os itens remanescentes (zoom/forced-colors/leitor de tela reais, UI do
executor de migração, revisão jurídica) são decisões/lacunas de ferramental
já documentadas, não desenvolvimento esquecido.
