#!/usr/bin/env bash
# Guardian del indice de documentacion (CLAUDE.md -> docs/INDICE.md).
#
# Bloquea el commit si se agrego / borro / renombro algo bajo docs/ SIN tocar
# docs/INDICE.md en el mismo commit. Un indice que depende de que alguien se
# acuerde de actualizarlo se degrada; esto lo hace una puerta cerrada.
#
# Bash puro, sin Node ni dependencias: corre en cualquier clon.
set -uo pipefail

# DISPARADOR: docs/ agregado / copiado / borrado / renombrado (--diff-filter=ACDR).
# Son los cambios ESTRUCTURALES que obligan a revisar el indice. -z: separador
# NUL, unico seguro para nombres con espacios o saltos de linea.
# (El indice mismo se evalua aparte, ver abajo: se excluye de esta lista.)
docs_tocados=()
while IFS= read -r -d '' f; do
  case "$f" in
    docs/INDICE.md) : ;;              # el indice no es "otro doc"; se chequea aparte
    docs/*) docs_tocados+=("$f") ;;
  esac
done < <(git diff --cached --name-only --diff-filter=ACDR -z)

# 2) Ningun archivo de docs/ (aparte del indice) -> nada que verificar.
if [ "${#docs_tocados[@]}" -eq 0 ]; then
  exit 0
fi

# 3) El indice cuenta como "tocado" con CUALQUIER cambio en staging, incluida una
# MODIFICACION de contenido (M) -> por eso NO se filtra por ACDR aca: actualizar
# el indice es, casi siempre, editar un archivo que ya existe (status M, que ACDR
# excluiria). Sin esto, agregar un doc y actualizar el indice quedaria bloqueado.
indice_tocado=0
while IFS= read -r -d '' f; do
  [ "$f" = "docs/INDICE.md" ] && indice_tocado=1
done < <(git diff --cached --name-only -z)

if [ "$indice_tocado" -eq 1 ]; then
  exit 0
fi

# 4) Hay docs/ sin el indice -> bloquear con un mensaje util.
{
  echo "BLOQUEADO: se modifico docs/ sin actualizar el indice."
  echo ""
  echo "Archivos de docs/ en este commit:"
  for f in "${docs_tocados[@]}"; do
    echo "  - $f"
  done
  echo ""
  echo "docs/INDICE.md debe actualizarse en el MISMO commit:"
  echo "  - documento nuevo o renombrado -> agregarlo/corregirlo en la tabla que corresponda"
  echo "  - documento obsoleto           -> marcarlo como historico"
  echo "  - regla de negocio nueva       -> anotarla en la seccion correspondiente"
  echo "  - solo correccion de redaccion -> actualiza la fecha del encabezado"
  echo ""
  echo "Si de verdad no corresponde tocar el indice, saltealo con:"
  echo "  git commit --no-verify"
} >&2
exit 1
