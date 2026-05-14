#!/usr/bin/env bash
# =========================================================================
# Web Dinámica — script de despliegue (Docker Compose)
# =========================================================================
# Uso:
#   ./deploy.sh                # menú interactivo
#   ./deploy.sh <comando>      # ejecuta comando directo
#
# Comandos:
#   full         Deploy completo (primera vez) — build + up + verifica
#   redeploy     Rebuild de la api y reinicio (sin tocar la BD)
#   up           Levanta los contenedores
#   down         Detiene y elimina los contenedores (mantiene volúmenes)
#   restart      Reinicia los contenedores
#   stop         Detiene los contenedores
#   status       Estado de los contenedores
#   logs [svc]   Logs en vivo (svc = api | db | caddy; omite = todos)
#   shell        Shell dentro del contenedor api
#   admin        Re-ejecuta el seed del super admin
#   backup       Backup .sql de la base de datos en backups/
#   restore <f>  Restaura un .sql en backups/
#   verify       Cura health checks (api + https público)
#   help         Muestra esta ayuda
# =========================================================================

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

ENV_FILE=".env.production"
COMPOSE_PROJECT_NAME="web_dinamica"
export COMPOSE_PROJECT_NAME

DC() { docker compose --env-file "$ENV_FILE" "$@"; }

# ── Logging ──────────────────────────────────────────────────────────────
if [[ -t 1 ]] && command -v tput >/dev/null 2>&1 && [[ $(tput colors 2>/dev/null || echo 0) -ge 8 ]]; then
    GREEN=$(tput setaf 2); YELLOW=$(tput setaf 3); RED=$(tput setaf 1)
    CYAN=$(tput setaf 6); BLUE=$(tput setaf 4); BOLD=$(tput bold); NC=$(tput sgr0)
else
    GREEN=""; YELLOW=""; RED=""; CYAN=""; BLUE=""; BOLD=""; NC=""
fi

log()   { printf "${GREEN}==>${NC} %s\n" "$*"; }
info()  { printf "${CYAN}-->${NC} %s\n" "$*"; }
warn()  { printf "${YELLOW}!!${NC}  %s\n" "$*"; }
err()   { printf "${RED}xx${NC}  %s\n" "$*" >&2; }
title() { printf "\n${BOLD}${BLUE}%s${NC}\n" "$*"; }

# ── Guards ───────────────────────────────────────────────────────────────
require_docker() {
    command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1 || {
        err "Docker o Docker Compose v2 no disponibles."
        info "Instálalos con:  curl -fsSL https://get.docker.com | sh"
        exit 1
    }
}

require_env() {
    [[ -f "$ENV_FILE" ]] || {
        err "No existe $ENV_FILE."
        info "Copia .env.production.example a .env.production y rellena los valores."
        exit 1
    }
    # Validar variables críticas
    local missing=()
    for var in SITE_ADDRESS DB_USERNAME DB_PASSWORD DB_DATABASE JWT_SECRET \
               SEED_ADMIN_EMAIL SEED_ADMIN_PASSWORD; do
        if ! grep -qE "^${var}=.+" "$ENV_FILE"; then
            missing+=("$var")
        fi
    done
    if [[ ${#missing[@]} -gt 0 ]]; then
        err "Faltan variables en $ENV_FILE: ${missing[*]}"
        exit 1
    fi
}

load_env() {
    # Carga las variables a la shell actual (sin afectar a las del sistema)
    set -a
    # shellcheck disable=SC1090
    source <(grep -E '^[A-Z_]+=' "$ENV_FILE")
    set +a
}

# ── Comandos ─────────────────────────────────────────────────────────────
cmd_full() {
    require_docker; require_env; load_env
    title "Despliegue completo"

    log "Construyendo imagen api..."
    DC build api

    log "Levantando contenedores (db, api, caddy)..."
    DC up -d

    log "Esperando a que la base de datos esté healthy..."
    for i in {1..30}; do
        if DC ps db | grep -q "healthy"; then
            info "DB lista"
            break
        fi
        sleep 2
        [[ "$i" -eq 30 ]] && { err "DB no responde tras 60s"; exit 1; }
    done

    log "Esperando a que la api arranque (AutoSeed crea el admin si no existe)..."
    sleep 5
    DC logs --tail=20 api

    log "Verificando que el sitio responde..."
    cmd_verify || true

    title "✓ Despliegue terminado"
    printf "  URL:        ${BOLD}https://%s${NC}\n" "$SITE_ADDRESS"
    printf "  Admin:      ${BOLD}%s${NC} / %s\n" "$SEED_ADMIN_EMAIL" "$SEED_ADMIN_PASSWORD"
    printf "  Logs:       ./deploy.sh logs\n"
    printf "  Reiniciar:  ./deploy.sh redeploy\n"
}

cmd_redeploy() {
    require_docker; require_env
    title "Rebuild api + reinicio"
    log "Reconstruyendo imagen..."
    DC build api
    log "Recreando contenedor api..."
    DC up -d --no-deps --force-recreate api
    log "Logs recientes:"
    DC logs --tail=30 api
    info "Listo. La BD no se ha tocado."
}

cmd_up() {
    require_docker; require_env
    DC up -d
    DC ps
}

cmd_down() {
    require_docker
    DC down
    info "Contenedores detenidos. Los volúmenes (BD, certs) se mantienen."
}

cmd_restart() {
    require_docker; require_env
    DC restart
    DC ps
}

cmd_stop() {
    require_docker
    DC stop
}

cmd_status() {
    require_docker
    DC ps
    echo ""
    info "Volúmenes:"
    docker volume ls --filter "label=com.docker.compose.project=$COMPOSE_PROJECT_NAME" --format "table {{.Name}}\t{{.Driver}}"
}

cmd_logs() {
    require_docker
    local svc="${1:-}"
    if [[ -n "$svc" ]]; then
        DC logs -f --tail=200 "$svc"
    else
        DC logs -f --tail=100
    fi
}

cmd_shell() {
    require_docker
    DC exec api sh
}

cmd_admin() {
    require_docker; require_env; load_env
    log "Re-creando el super admin (idempotente)..."
    DC exec api node dist/database/seeds/admin.seed.js
}

cmd_backup() {
    require_docker; require_env; load_env
    mkdir -p backups
    local ts; ts=$(date +%Y%m%d_%H%M%S)
    local file="backups/${DB_DATABASE}_${ts}.sql"
    log "Volcando BD a $file ..."
    DC exec -T db pg_dump -U "$DB_USERNAME" "$DB_DATABASE" > "$file"
    info "Tamaño: $(du -h "$file" | cut -f1)"
    info "Restaurar con:  ./deploy.sh restore $file"
}

cmd_restore() {
    require_docker; require_env; load_env
    local file="${1:-}"
    [[ -z "$file" ]] && { err "Uso: ./deploy.sh restore <archivo.sql>"; exit 1; }
    [[ -f "$file" ]] || { err "No existe el archivo: $file"; exit 1; }
    warn "Esto SOBREESCRIBE la BD actual."
    read -rp "¿Continuar? (escribe SI): " ans
    [[ "$ans" == "SI" ]] || { info "Cancelado."; exit 0; }
    log "Restaurando $file ..."
    DC exec -T db psql -U "$DB_USERNAME" -d "$DB_DATABASE" < "$file"
    log "Reiniciando api..."
    DC restart api
    info "Restore completo."
}

cmd_verify() {
    require_docker; load_env
    title "Verificación"

    # Health interno
    if DC exec -T api curl -fsS -o /dev/null -m 5 http://127.0.0.1:3000/api/v1/promotions/active; then
        info "✓ API responde dentro del contenedor"
    else
        err "✗ API no responde dentro del contenedor"
        return 1
    fi

    # Health público (Caddy → api)
    info "Probando HTTPS público (Let's Encrypt puede tardar la primera vez)..."
    local ok=0
    for i in {1..15}; do
        if curl -fsS -o /dev/null -m 5 "https://$SITE_ADDRESS/api/v1/promotions/active" 2>/dev/null; then
            info "✓ Sitio responde en https://$SITE_ADDRESS"
            ok=1
            break
        fi
        sleep 3
    done
    if [[ "$ok" -eq 0 ]]; then
        warn "HTTPS aún no responde. Diagnóstico:"
        info "    DC logs caddy --tail=30"
        info "    dig +short $SITE_ADDRESS   # ¿apunta a este servidor?"
        return 1
    fi
}

cmd_help() {
    sed -n '2,28p' "$0" | sed 's/^# \{0,1\}//'
}

# ── Menú interactivo ─────────────────────────────────────────────────────
menu() {
    local action
    while true; do
        title "Web Dinámica — Menú"
        printf "  1) full       — Despliegue completo (primera vez)\n"
        printf "  2) redeploy   — Rebuild api + reinicio\n"
        printf "  3) up         — Levantar contenedores\n"
        printf "  4) logs       — Logs en vivo\n"
        printf "  5) status     — Estado\n"
        printf "  6) shell      — Shell en api\n"
        printf "  7) admin      — Re-crear super admin\n"
        printf "  8) backup     — Backup de la BD\n"
        printf "  9) verify     — Verificar health\n"
        printf "  0) salir\n"
        printf "\n  Opción: "
        read -r action
        case "$action" in
            1) cmd_full ;;
            2) cmd_redeploy ;;
            3) cmd_up ;;
            4) cmd_logs ;;
            5) cmd_status ;;
            6) cmd_shell ;;
            7) cmd_admin ;;
            8) cmd_backup ;;
            9) cmd_verify ;;
            0|q|salir) exit 0 ;;
            *) warn "Opción inválida" ;;
        esac
    done
}

# ── Dispatcher ───────────────────────────────────────────────────────────
case "${1:-menu}" in
    full)     cmd_full ;;
    redeploy) cmd_redeploy ;;
    up)       cmd_up ;;
    down)     cmd_down ;;
    restart)  cmd_restart ;;
    stop)     cmd_stop ;;
    status)   cmd_status ;;
    logs)     shift; cmd_logs "${1:-}" ;;
    shell)    cmd_shell ;;
    admin)    cmd_admin ;;
    backup)   cmd_backup ;;
    restore)  shift; cmd_restore "${1:-}" ;;
    verify)   cmd_verify ;;
    help|-h|--help) cmd_help ;;
    menu)     menu ;;
    *) err "Comando desconocido: $1"; cmd_help; exit 1 ;;
esac
