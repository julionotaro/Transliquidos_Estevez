#!/usr/bin/env bash
# Prueba los guardianes en un repo TEMPORAL en /tmp: no ensucia este repo.
# Criterio de exito: los 12 casos con el resultado esperado.
#
# Los "secretos" de prueba se construyen en runtime (variables), para que este
# archivo NO contenga literales que disparen al propio guardian de credenciales.
set -uo pipefail

ORIG="$(git rev-parse --show-toplevel)"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/guardianes.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

git init -q "$TMP"
cd "$TMP"
git config user.email t@t.t
git config user.name t
git config commit.gpgsign false

mkdir -p scripts docs
cp "$ORIG/scripts/guardian-indice.sh"      scripts/
cp "$ORIG/scripts/guardian-credenciales.sh" scripts/
chmod +x scripts/*.sh

# Commit base: indice + un doc existente + un archivo de codigo.
printf '# indice\n' > docs/INDICE.md
printf '# doc existente\n' > docs/existente.md
printf 'var x = 1;\n' > code.js
git add -A
git commit -qm base
BASE="$(git rev-parse HEAD)"

reset_all() { git reset -q --hard "$BASE"; git clean -qfd; }
indice() { bash scripts/guardian-indice.sh >/dev/null 2>&1; echo $?; }
cred()   { bash scripts/guardian-credenciales.sh >/dev/null 2>&1; echo $?; }

pass=0; fail=0
check() { # check <nombre> <esperado> <obtenido>
  if [ "$2" = "$3" ]; then
    pass=$((pass + 1)); printf '  OK   %s\n' "$1"
  else
    fail=$((fail + 1)); printf ' FAIL  %s (esperado=%s obtenido=%s)\n' "$1" "$2" "$3"
  fi
}

echo "== Guardian del indice =="

# 1) solo codigo (fuera de docs/) -> pasa (0)
reset_all
printf 'var x = 2;\n' > code.js; git add code.js
check "1 solo codigo -> pasa" 0 "$(indice)"

# 2) docs/algo.md sin el indice -> bloquea (1)
reset_all
printf '# algo\n' > docs/algo.md; git add docs/algo.md
check "2 docs sin indice -> bloquea" 1 "$(indice)"

# 3) docs/algo.md + docs/INDICE.md -> pasa
reset_all
printf '# algo\n' > docs/algo.md; printf '\nlinea nueva\n' >> docs/INDICE.md
git add docs/algo.md docs/INDICE.md
check "3 docs + indice -> pasa" 0 "$(indice)"

# 4) solo docs/INDICE.md -> pasa
reset_all
printf '\notra linea\n' >> docs/INDICE.md; git add docs/INDICE.md
check "4 solo indice -> pasa" 0 "$(indice)"

# 5) borra un archivo de docs/ sin indice -> bloquea
reset_all
git rm -q docs/existente.md
check "5 borra doc sin indice -> bloquea" 1 "$(indice)"

# 6) renombra un archivo de docs/ sin indice -> bloquea
reset_all
git mv docs/existente.md docs/renombrado.md
check "6 renombra doc sin indice -> bloquea" 1 "$(indice)"

# 7) nombre con espacios -> se comporta igual (bloquea), sin romperse
reset_all
printf '# con espacio\n' > "docs/nombre con espacios.md"
git add "docs/nombre con espacios.md"
check "7 nombre con espacios -> bloquea sin romperse" 1 "$(indice)"

echo "== Guardian de credenciales =="

# Secretos de prueba construidos en runtime (no aparecen literales en este archivo).
SK="sk-$(printf 'A%.0s' $(seq 1 30))"          # sk- + 30 alfanumericos
GHP="ghp_$(printf 'B%.0s' $(seq 1 30))"        # ghp_ + 30 alfanumericos

# 8) linea con sk- (30 chars) -> bloquea
reset_all
printf 'const clave = "%s";\n' "$SK" > src8.js; git add src8.js
check "8 sk-... -> bloquea" 1 "$(cred)"

# 9) linea con ghp_ -> bloquea
reset_all
printf 'const t = "%s";\n' "$GHP" > src9.js; git add src9.js
check "9 ghp_... -> bloquea" 1 "$(cred)"

# 10) api_key = "PLACEHOLDER" -> pasa (excepcion)
reset_all
printf 'api_key = "PLACEHOLDER"\n' > src10.js; git add src10.js
check "10 PLACEHOLDER -> pasa" 0 "$(cred)"

# 11) misma cadena sospechosa dentro de docs/ -> pasa
reset_all
printf 'clave: %s\n' "$SK" > docs/fuga.md; git add docs/fuga.md
check "11 secreto en docs/ -> pasa" 0 "$(cred)"

# 12) el mensaje de error NO imprime la credencial
reset_all
printf 'const clave = "%s";\n' "$SK" > src12.js; git add src12.js
salida="$(bash scripts/guardian-credenciales.sh 2>&1 || true)"
if printf '%s' "$salida" | grep -qF "$SK"; then
  check "12 mensaje NO revela la credencial" "oculta" "REVELADA"
else
  check "12 mensaje NO revela la credencial" "oculta" "oculta"
fi

echo ""
echo "Resultado: $pass OK, $fail FAIL (de $((pass + fail)))"
[ "$fail" -eq 0 ] || exit 1
