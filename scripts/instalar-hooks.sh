#!/usr/bin/env bash
# Instala los hooks versionados en este clon del repo.
# Usa core.hooksPath (no copia a .git/hooks): asi el hook se versiona y cada
# git pull lo actualiza solo. Correr una vez por maquina nueva.
set -euo pipefail

DIR="$(git rev-parse --show-toplevel)"
cd "$DIR"

git config core.hooksPath .githooks

# Asegurar permisos de ejecucion (git no siempre los preserva al clonar).
chmod +x .githooks/pre-commit \
         scripts/guardian-indice.sh \
         scripts/guardian-credenciales.sh \
         scripts/instalar-hooks.sh \
         scripts/probar-guardianes.sh 2>/dev/null || true

echo "OK: core.hooksPath -> $(git config core.hooksPath)"
echo "Guardianes activos antes de cada commit:"
echo "  - indice de documentacion (docs/ exige tocar docs/INDICE.md)"
echo "  - credenciales (bloquea claves y tokens)"
echo ""
echo "Para saltar los controles en un caso justificado: git commit --no-verify"
