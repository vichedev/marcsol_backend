#!/usr/bin/env bash
# =========================================================================
# install.sh — DEPRECADO
# =========================================================================
# Este instalador (que corría el backend vía systemd) fue reemplazado por
# una arquitectura 100% dockerizada. Usa ./deploy.sh en su lugar.
# =========================================================================

set -euo pipefail

if [[ -t 1 ]] && command -v tput >/dev/null 2>&1; then
    YELLOW=$(tput setaf 3); CYAN=$(tput setaf 6); BOLD=$(tput bold); NC=$(tput sgr0)
else
    YELLOW=""; CYAN=""; BOLD=""; NC=""
fi

cat <<EOF
${YELLOW}${BOLD}⚠  install.sh está deprecado${NC}

El nuevo flujo de despliegue es Docker-first. Todo (db + api + caddy)
corre en contenedores orquestados por docker-compose.

${BOLD}Para desplegar:${NC}

  1) Edita ${CYAN}.env.production${NC} con tu dominio y credenciales
  2) Corre:  ${CYAN}./deploy.sh full${NC}

Comandos disponibles:
  ./deploy.sh full       Despliegue completo (primera vez)
  ./deploy.sh redeploy   Rebuild api + reinicio
  ./deploy.sh logs       Logs en vivo
  ./deploy.sh status     Estado de los contenedores
  ./deploy.sh help       Ayuda completa

${BOLD}Si vienes del install.sh viejo (backend en systemd):${NC}

  systemctl stop web-dinamica
  systemctl disable web-dinamica
  rm -f /etc/systemd/system/web-dinamica.service
  systemctl daemon-reload
  # Detén el postgres viejo (su volumen se reutilizará):
  docker stop web_dinamica_db && docker rm web_dinamica_db
  # Y ahora sí:
  ./deploy.sh full

EOF

exit 0
