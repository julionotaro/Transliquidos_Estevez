# Correcciones a documentacion previa

Este archivo corrige afirmaciones obsoletas en docs anteriores. Leer ANTES de
actuar sobre supuestos de ONBOARDING.md, ONBOARDING-addendum.md o notas de sesion.

## C-01 (28/07/2026) — NO existe limite de 2.500 chars en execute_workflow

`ONBOARDING-addendum.md` (seccion "Aprendizajes tecnicos") y notas previas afirman:

> "Briefs largos a Dify: execute_workflow falla silencioso >2.5k chars.
>  Via: workflow temporal manualTrigger -> Code -> HTTP a Dify."

**Esto es FALSO.** No habia limite de longitud. El sintoma era un bug de cableado
en el bridge al Equipo de Diseno (n8n `0tGxducQ0fq5uKbs`): el nodo HTTP apuntaba a
`body.query`, un campo que el nodo Code previo ya habia renombrado a `query_for_dify`,
por lo que enviaba query vacia a Dify. El bug ademas duplicaba el payload.

**Corregido y publicado el 26/07/2026.** Ahora usa `{{ JSON.stringify($json.query_for_dify) }}`.

**IMPLICACION:** los briefs largos pasan directo por el bridge. NO hace falta el
workflow temporal ni ningun workaround de longitud. Ignorar toda instruccion previa
que mande partir o acortar briefs por un supuesto limite de caracteres en
execute_workflow.
