# Hooks de git — guardianes automáticos

> Controles que corren **antes de cada commit** y lo **bloquean** si algo está
> mal. No son recordatorios: son puertas cerradas. Bash puro, sin Node ni
> dependencias, así funcionan en cualquier clon.

## Qué hay

| Script | Qué hace | Bloquea cuando… |
|---|---|---|
| `scripts/guardian-indice.sh` | Guardián del índice de documentación | Se agrega / borra / renombra algo bajo `docs/` **sin** tocar `docs/INDICE.md` en el mismo commit |
| `scripts/guardian-credenciales.sh` | Guardián de credenciales | En el contenido agregado aparece algo que parece una clave o token |

Los invoca `.githooks/pre-commit`. Si cualquiera devuelve código ≠ 0, el commit se aborta.

## Instalación (una vez por máquina/clon)

```
bash scripts/instalar-hooks.sh
```

Hace `git config core.hooksPath .githooks`. Se usa `core.hooksPath` **a propósito**
en lugar de copiar a `.git/hooks/` (que no se versiona): así el hook vive en el
repo, se versiona y se actualiza solo con cada `git pull`.

Comprobar que quedó instalado:

```
git config core.hooksPath      # debe devolver: .githooks
```

## Guardián del índice — detalle

- **Disparador** (`git diff --cached --diff-filter=ACDR`): docs **agregados,
  copiados, borrados o renombrados**. Son los cambios estructurales que obligan a
  revisar el índice. Una edición de contenido pura (status `M`) de un doc
  existente **no** dispara el control.
- **El índice cuenta como actualizado** con cualquier cambio en staging sobre
  `docs/INDICE.md`, incluida una modificación de contenido (por eso ese chequeo
  **no** filtra por `ACDR`: actualizar el índice casi siempre es editar un archivo
  que ya existe).
- Si `docs/INDICE.md` es el único archivo de `docs/` en el commit → pasa (te
  estás actualizando el índice solo, que es válido).
- Nombres con espacios: se manejan con separador NUL (`-z`), no se rompen.

## Guardián de credenciales — detalle

Revisa solo el **contenido agregado** (`git diff --cached -U0`), línea por línea,
reportando **archivo y número de línea sin volcar la credencial**. Patrones:

- `sk-` + 20 o más alfanuméricos (claves OpenAI/Anthropic)
- `ghp_` / `github_pat_` + alfanuméricos (tokens de GitHub)
- Asignación `password|passwd|secret|api_key|apikey|token` con `=` o `:` y una
  cadena literal de más de 12 caracteres

**No** bloquea (para no molestar a lo tonto):

- Líneas que contienen `EJEMPLO`, `PLACEHOLDER`, `xxxxx`, o un marcador `<...>`
- Cualquier archivo bajo `docs/`
- El archivo `.env.example`

## Saltarse los controles (caso justificado)

```
git commit --no-verify
```

Úsalo solo cuando de verdad no corresponde: un falso positivo, o un cambio en
`docs/` que realmente no afecta al índice.

## Agregar un guardián nuevo

1. Crear `scripts/guardian-<algo>.sh` (bash puro, exit 0 = pasa, exit 1 = bloquea,
   mensajes al **stderr**).
2. Invocarlo desde `.githooks/pre-commit` con `|| exit 1`.
3. Agregar sus casos a `scripts/probar-guardianes.sh` (repo temporal en `/tmp`,
   sin ensuciar este repo) y dejar la prueba en verde.
4. Documentarlo en la tabla de arriba.

## Tests

```
bash scripts/probar-guardianes.sh
```

Monta un repo temporal en `/tmp`, ejercita los 12 casos (7 del índice, 5 de
credenciales) y sale 0 solo si todos dan el resultado esperado. No toca este repo.
