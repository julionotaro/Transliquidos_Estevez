#!/usr/bin/env bash
# Guardian de credenciales.
#
# Bloquea el commit si en el CONTENIDO AGREGADO (git diff --cached) aparece algo
# que parece una clave o token. En este proyecto ya se expusieron un token de
# GitHub y una clave de OpenAI; este control lo habria evitado.
#
# Nunca imprime la credencial detectada: solo archivo y numero de linea.
# Bash puro, sin Node ni dependencias.
set -uo pipefail

# Comillas (doble y simple) como clase de caracteres, para no cerrar el string.
q="\"'"

# Patron 3: keyword de secreto seguida de = o : y una cadena literal de mas de 12
# caracteres (13+). La cadena no incluye espacios ni comillas (se corta ahi).
re_kw="(password|passwd|secret|api_key|apikey|token)[[:space:]]*[:=][[:space:]]*[${q}]?[^[:space:]${q}]{13,}"

fail=0
file=""
skip_file=0
lineno=0

# Reporta un hallazgo SIN volcar el contenido de la linea.
reportar() {
  echo "BLOQUEADO: $1 en $file:$lineno" >&2
  fail=1
}

revisar_linea() {
  local content="$1"

  # Excepciones de contenido: no bloquear ejemplos ni marcadores.
  case "$content" in
    *EJEMPLO*|*PLACEHOLDER*|*xxxxx*|*"<"*">"*) return 0 ;;
  esac

  # 1) sk- + 20 o mas alfanumericos (OpenAI / Anthropic).
  if printf '%s' "$content" | grep -Eq 'sk-[A-Za-z0-9]{20,}'; then
    reportar "posible clave estilo sk-..."
    return 0
  fi
  # 2) ghp_ / github_pat_ + alfanumericos (tokens de GitHub).
  if printf '%s' "$content" | grep -Eq '(ghp_|github_pat_)[A-Za-z0-9_]+'; then
    reportar "posible token de GitHub"
    return 0
  fi
  # 3) asignacion tipo password/secret/api_key/token = "cadena larga".
  if printf '%s' "$content" | grep -Eiq "$re_kw"; then
    reportar "posible credencial en una asignacion"
    return 0
  fi
}

# Se recorre el diff unificado sin contexto (-U0): solo cabeceras y lineas +/-.
while IFS= read -r line; do
  case "$line" in
    '+++ '*)
      # Archivo destino. Puede venir como "b/ruta" o "/dev/null".
      path="${line#+++ }"
      path="${path#b/}"
      if [ "$path" = "/dev/null" ]; then
        skip_file=1
      else
        case "$path" in
          docs/*) skip_file=1 ;;                       # docs/ no lleva secretos reales
          *) skip_file=0 ;;
        esac
        [ "$(basename -- "$path")" = ".env.example" ] && skip_file=1
        file="$path"
      fi
      ;;
    '--- '*)
      : # cabecera de archivo origen: se ignora
      ;;
    '@@ '*)
      # @@ -a,b +c,d @@  -> numero de linea nueva inicial = c
      newpart="${line#*+}"
      lineno="${newpart%%[ ,]*}"
      ;;
    '+'*)
      # Linea agregada (ya descartamos '+++ ' arriba).
      [ "$skip_file" -eq 0 ] && revisar_linea "${line:1}"
      lineno=$((lineno + 1))
      ;;
    '-'*)
      : # linea quitada: no cuenta para la numeracion del archivo nuevo
      ;;
    *)
      : # otras cabeceras (diff --git, index, new file mode...): se ignoran
      ;;
  esac
done < <(git diff --cached -U0 --no-color)

if [ "$fail" -ne 0 ]; then
  {
    echo ""
    echo "Sacá la credencial del commit (usá una variable de entorno o .env, que no se versiona)."
    echo "Si es un falso positivo justificado: git commit --no-verify"
  } >&2
  exit 1
fi
exit 0
