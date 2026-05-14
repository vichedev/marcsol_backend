#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
# Web Dinámica — Instalador de producción (todo-en-uno)
# ─────────────────────────────────────────────────────────────────────────
# Desde cero, en un solo comando, deja funcionando en https://TU_DOMINIO:
#   • Postgres en Docker
#   • Backend NestJS (systemd) sirviendo API + SPA del front (carpeta public/)
#   • Caddy reverse proxy con TLS automático (Let's Encrypt)
#   • Firewall ufw abierto en 80/443 (si está activo)
#
# Auto-instala lo que falte (Node 20, Docker, Caddy, openssl, curl).
# Idempotente: lo puedes correr varias veces sin romper nada.
#
# Uso:
#   ./install.sh                   # interactivo, despliegue completo con TLS
#   ./install.sh --reset-env       # regenera .env desde cero
#   ./install.sh --no-tls          # sin Caddy (NO recomendado: el bundle del
#                                  #   front trae URLs https:// horneadas)
#   ./install.sh --no-install      # falla si falta algún paquete (no instala)
#   ./install.sh --no-prompt       # usa defaults / .env existente, sin preguntar
# ─────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Colores ──────────────────────────────────────────────────────────────
if [[ -t 1 ]] && command -v tput >/dev/null 2>&1 && [[ $(tput colors 2>/dev/null || echo 0) -ge 8 ]]; then
    RED=$(tput setaf 1); GREEN=$(tput setaf 2); YELLOW=$(tput setaf 3)
    BLUE=$(tput setaf 4); CYAN=$(tput setaf 6); BOLD=$(tput bold); NC=$(tput sgr0)
else
    RED=""; GREEN=""; YELLOW=""; BLUE=""; CYAN=""; BOLD=""; NC=""
fi

log_info() { printf "${BLUE}ℹ${NC}  %s\n" "$*"; }
log_ok()   { printf "${GREEN}✓${NC}  %s\n" "$*"; }
log_warn() { printf "${YELLOW}⚠${NC}  %s\n" "$*"; }
log_err()  { printf "${RED}✗${NC}  %s\n" "$*" >&2; }
step()     { printf "\n${BOLD}${CYAN}▸ %s${NC}\n" "$*"; }
banner() {
    printf "\n${BOLD}${BLUE}"
    printf '═%.0s' {1..70}; printf "\n"
    printf "  WEB DINÁMICA — Instalador de producción\n"
    printf '═%.0s' {1..70}
    printf "${NC}\n\n"
}

# ── Flags ────────────────────────────────────────────────────────────────
USE_TLS=1
AUTO_INSTALL=1
RESET_ENV=0
NO_PROMPT=0
for arg in "$@"; do
    case "$arg" in
        --no-tls)     USE_TLS=0 ;;
        --no-install) AUTO_INSTALL=0 ;;
        --reset-env)  RESET_ENV=1 ;;
        --no-prompt)  NO_PROMPT=1 ;;
        -h|--help)
            grep -E '^# ' "$0" | head -25 | sed 's/^# \?//'
            exit 0 ;;
        *) log_err "Argumento desconocido: $arg"; exit 1 ;;
    esac
done

# ── Paths ────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACK_DIR="$SCRIPT_DIR"
ROOT_DIR="$(cd "$BACK_DIR/.." && pwd)"
FRONT_DIR="$ROOT_DIR/front_web_dinamica_admin"
BACK_ENV="$BACK_DIR/.env"
FRONT_ENV_PROD="$FRONT_DIR/.env.production"
PUBLIC_DIR="$BACK_DIR/public"

PREBUILT_FRONT=0
[[ -f "$PUBLIC_DIR/index.html" ]] && PREBUILT_FRONT=1

banner

# ── Privilegios y package manager ───────────────────────────────────────
SUDO=""
if [[ $EUID -ne 0 ]]; then
    if command -v sudo >/dev/null 2>&1; then
        SUDO="sudo"
    else
        log_err "Necesitas ser root o tener 'sudo' instalado."
        exit 1
    fi
fi

PM=""; PM_FAMILY=""
if   command -v apt-get >/dev/null 2>&1; then PM="apt-get"; PM_FAMILY="debian"
elif command -v dnf     >/dev/null 2>&1; then PM="dnf";     PM_FAMILY="rhel"
elif command -v yum     >/dev/null 2>&1; then PM="yum";     PM_FAMILY="rhel"
else
    log_err "Distribución no soportada (necesito apt, dnf o yum)."
    exit 1
fi

apt_updated=0
apt_refresh() {
    [[ "$PM_FAMILY" != "debian" ]] && return 0
    [[ "$apt_updated" -eq 1 ]] && return 0
    $SUDO apt-get update -qq && apt_updated=1
}

pkg_install() {
    case "$PM_FAMILY" in
        debian) apt_refresh; $SUDO apt-get install -y --no-install-recommends "$@" ;;
        rhel)   $SUDO "$PM" install -y "$@" ;;
    esac
}

# ── Helpers de prompts ──────────────────────────────────────────────────
prompt() {
    local __var="$1" __label="$2" __default="${3:-}" __input=""
    if [[ "$NO_PROMPT" -eq 1 ]]; then
        printf -v "$__var" '%s' "$__default"; return
    fi
    if [[ -n "$__default" ]]; then
        printf "  ${BOLD}%s${NC} [${CYAN}%s${NC}]: " "$__label" "$__default"
    else
        printf "  ${BOLD}%s${NC}: " "$__label"
    fi
    read -r __input || true
    [[ -z "$__input" ]] && __input="$__default"
    printf -v "$__var" '%s' "$__input"
}

prompt_secret() {
    local __var="$1" __label="$2" __default="${3:-}" __input=""
    if [[ "$NO_PROMPT" -eq 1 ]]; then
        printf -v "$__var" '%s' "$__default"; return
    fi
    printf "  ${BOLD}%s${NC} [enter = generar aleatorio]: " "$__label"
    read -rs __input || true
    printf "\n"
    [[ -z "$__input" ]] && __input="$__default"
    printf -v "$__var" '%s' "$__input"
}

# Helper para escribir variables al .env con quoting POSIX-seguro.
write_env() {
    local n="$1" v="$2"
    v="${v//\'/\'\\\'\'}"
    printf "%s='%s'\n" "$n" "$v" >> "$BACK_ENV"
}

# ═════════════════════════════════════════════════════════════════════════
# 1) DEPENDENCIAS DEL SISTEMA
# ═════════════════════════════════════════════════════════════════════════
step "1/9  Dependencias del sistema"

ensure_simple_pkg() {
    # ensure_simple_pkg <cmd> <pkg-debian> [<pkg-rhel>]
    local cmd="$1" pkg_deb="$2" pkg_rhel="${3:-$2}"
    if command -v "$cmd" >/dev/null 2>&1; then
        log_ok "$cmd disponible"
        return 0
    fi
    [[ "$AUTO_INSTALL" -eq 0 ]] && { log_err "Falta $cmd"; exit 1; }
    log_info "Instalando $cmd..."
    case "$PM_FAMILY" in
        debian) pkg_install "$pkg_deb" ;;
        rhel)   pkg_install "$pkg_rhel" ;;
    esac
    log_ok "$cmd instalado"
}

ensure_simple_pkg curl    curl
ensure_simple_pkg openssl openssl

# Node 20 LTS vía NodeSource
need_node=0
if ! command -v node >/dev/null 2>&1; then
    need_node=1
else
    NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
    [[ "$NODE_MAJOR" -lt 20 ]] && need_node=1
fi

if [[ "$need_node" -eq 1 ]]; then
    [[ "$AUTO_INSTALL" -eq 0 ]] && { log_err "Falta Node 20+"; exit 1; }
    log_info "Instalando Node 20 LTS (NodeSource)..."
    case "$PM_FAMILY" in
        debian)
            pkg_install ca-certificates gnupg
            curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO -E bash -
            pkg_install nodejs
            ;;
        rhel)
            curl -fsSL https://rpm.nodesource.com/setup_20.x | $SUDO bash -
            $SUDO "$PM" install -y nodejs
            ;;
    esac
fi
log_ok "node $(node -v) / npm $(npm -v)"

# Docker + compose
if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
    [[ "$AUTO_INSTALL" -eq 0 ]] && { log_err "Falta Docker + compose"; exit 1; }
    log_info "Instalando Docker (script oficial get.docker.com)..."
    curl -fsSL https://get.docker.com | $SUDO sh
    command -v systemctl >/dev/null 2>&1 && $SUDO systemctl enable --now docker 2>/dev/null || true
fi
log_ok "docker $(docker --version | awk '{print $3}' | tr -d ',')"

# Caddy (solo si vamos a usar TLS)
if [[ "$USE_TLS" -eq 1 ]]; then
    if ! command -v caddy >/dev/null 2>&1; then
        [[ "$AUTO_INSTALL" -eq 0 ]] && { log_err "Falta Caddy"; exit 1; }
        log_info "Instalando Caddy (repo oficial Cloudsmith)..."
        case "$PM_FAMILY" in
            debian)
                pkg_install debian-keyring debian-archive-keyring apt-transport-https
                curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
                    | $SUDO gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
                curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
                    | $SUDO tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
                apt_updated=0; apt_refresh
                pkg_install caddy
                ;;
            rhel)
                $SUDO "$PM" install -y 'dnf-command(copr)' || true
                $SUDO "$PM" copr enable -y @caddy/caddy
                $SUDO "$PM" install -y caddy
                ;;
        esac
    fi
    log_ok "caddy $(caddy version 2>/dev/null | awk '{print $1}')"
fi

# ═════════════════════════════════════════════════════════════════════════
# 2) CONFIGURACIÓN (.env)
# ═════════════════════════════════════════════════════════════════════════
step "2/9  Configuración"

if [[ -f "$BACK_ENV" && "$RESET_ENV" -eq 0 ]]; then
    log_info ".env existente, se reutiliza (--reset-env para regenerar)"
    set -a; source "$BACK_ENV"; set +a
    DOMAIN="${DOMAIN:-${CORS_ORIGIN%%,*}}"
else
    prompt DOMAIN "Dominio público (con https://)" "https://marcsol-preview.casacam.net"
    DOMAIN_HOST="${DOMAIN#https://}"; DOMAIN_HOST="${DOMAIN_HOST#http://}"; DOMAIN_HOST="${DOMAIN_HOST%%/*}"

    prompt DB_HOST     "DB host"     "localhost"
    prompt DB_PORT     "DB port"     "5432"
    prompt DB_USERNAME "DB usuario"  "postgres"
    prompt_secret DB_PASSWORD "DB password" "$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-24)"
    prompt DB_DATABASE "DB nombre"   "web_dinamica"

    prompt        SEED_ADMIN_EMAIL    "Email del super admin"    "admin@${DOMAIN_HOST}"
    prompt_secret SEED_ADMIN_PASSWORD "Password del super admin" "$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-18)"
    SEED_ADMIN_NAME="Super Admin"

    PORT="3000"
    JWT_SECRET="$(openssl rand -hex 32)"

    COOKIE_SECURE_VAL="false"
    [[ "$USE_TLS" -eq 1 && "$DOMAIN" == https://* ]] && COOKIE_SECURE_VAL="true"

    umask 077
    : > "$BACK_ENV"
    {
        echo "# Generado por install.sh — $(date -u +%FT%TZ)"
        echo "# NO comitear este archivo."
        echo ""
    } >> "$BACK_ENV"
    write_env NODE_ENV          "production"
    write_env PORT              "$PORT"
    write_env API_PREFIX        "api/v1"
    write_env DB_HOST           "$DB_HOST"
    write_env DB_PORT           "$DB_PORT"
    write_env DB_USERNAME       "$DB_USERNAME"
    write_env DB_PASSWORD       "$DB_PASSWORD"
    write_env DB_DATABASE       "$DB_DATABASE"
    write_env DB_SYNCHRONIZE    "false"
    write_env DB_LOGGING        "false"
    write_env JWT_SECRET        "$JWT_SECRET"
    write_env JWT_EXPIRES_IN    "1d"
    write_env COOKIE_NAME       "ws_session"
    write_env COOKIE_SECURE     "$COOKIE_SECURE_VAL"
    write_env COOKIE_SAMESITE   "lax"
    write_env COOKIE_DOMAIN     ""
    write_env CORS_ORIGIN       "$DOMAIN"
    write_env BCRYPT_SALT_ROUNDS "12"
    write_env THROTTLE_TTL_MS   "60000"
    write_env THROTTLE_LIMIT    "120"
    write_env SEED_ADMIN_EMAIL    "$SEED_ADMIN_EMAIL"
    write_env SEED_ADMIN_PASSWORD "$SEED_ADMIN_PASSWORD"
    write_env SEED_ADMIN_NAME     "$SEED_ADMIN_NAME"
    write_env UPLOAD_DEST       "./uploads"
    write_env UPLOAD_MAX_SIZE   "5242880"
    write_env DOMAIN            "$DOMAIN"
    chmod 600 "$BACK_ENV"
    log_ok ".env generado (permisos 600)"
fi

# Defaults por si vienen del .env existente
: "${PORT:=3000}"
: "${DOMAIN:?Falta DOMAIN en .env}"
DOMAIN_HOST="${DOMAIN#https://}"; DOMAIN_HOST="${DOMAIN_HOST#http://}"; DOMAIN_HOST="${DOMAIN_HOST%%/*}"

# ═════════════════════════════════════════════════════════════════════════
# 3) POSTGRES (Docker)
# ═════════════════════════════════════════════════════════════════════════
step "3/9  Postgres en Docker"

cd "$BACK_DIR"
set -a; source "$BACK_ENV"; set +a
$SUDO docker compose up -d
log_info "Esperando a Postgres..."
for i in {1..30}; do
    if $SUDO docker exec web_dinamica_db pg_isready -U "$DB_USERNAME" -d "$DB_DATABASE" >/dev/null 2>&1; then
        log_ok "Postgres responde"
        break
    fi
    sleep 1
    [[ "$i" -eq 30 ]] && { log_err "Postgres no respondió en 30s"; exit 1; }
done

# ═════════════════════════════════════════════════════════════════════════
# 4) BACKEND — build
# ═════════════════════════════════════════════════════════════════════════
step "4/9  Backend — build"

cd "$BACK_DIR"
# IMPORTANTE: --include=dev fuerza devDeps (nest CLI, ts-node) aunque
# NODE_ENV=production esté seteado por el source de .env.
if [[ -f package-lock.json ]]; then
    npm ci --no-audit --no-fund --include=dev
else
    npm install --no-audit --no-fund --include=dev
fi
npm run build
log_ok "Backend compilado"

# ═════════════════════════════════════════════════════════════════════════
# 5) FRONTEND — usar precompilado o compilar
# ═════════════════════════════════════════════════════════════════════════
step "5/9  Frontend"

if [[ "$PREBUILT_FRONT" -eq 1 ]]; then
    log_ok "Build pre-horneado detectado en public/ → no recompilo"
elif [[ -d "$FRONT_DIR" ]]; then
    log_info "Compilando frontend con dominio horneado: $DOMAIN"
    cat > "$FRONT_ENV_PROD" <<EOF
VITE_API_URL=$DOMAIN/api/v1
VITE_STATIC_URL=$DOMAIN
EOF
    cd "$FRONT_DIR"
    if [[ -f package-lock.json ]]; then
        npm ci --no-audit --no-fund --include=dev
    else
        npm install --no-audit --no-fund --include=dev
    fi
    npm run build
    cd "$BACK_DIR"
    mkdir -p "$PUBLIC_DIR"
    find "$PUBLIC_DIR" -mindepth 1 -delete
    cp -R "$FRONT_DIR/dist/." "$PUBLIC_DIR/"
    log_ok "Frontend compilado y copiado a public/"
else
    log_err "No hay public/index.html ni carpeta del front en $FRONT_DIR"
    log_info "Compila el front en tu máquina de dev y commitea back/public/"
    exit 1
fi

# ═════════════════════════════════════════════════════════════════════════
# 6) MIGRACIONES + SEED
# ═════════════════════════════════════════════════════════════════════════
step "6/9  Migraciones y seed del admin"

cd "$BACK_DIR"
set -a; source "$BACK_ENV"; set +a
npm run migration:run
npm run seed:admin
log_ok "DB lista"

# ═════════════════════════════════════════════════════════════════════════
# 7) SYSTEMD — servicio del backend
# ═════════════════════════════════════════════════════════════════════════
step "7/9  Servicio systemd (backend)"

SVC_NAME="web-dinamica"
SVC_PATH="/etc/systemd/system/${SVC_NAME}.service"
RUN_USER="$(id -un)"
NODE_BIN="$(command -v node)"

$SUDO tee "$SVC_PATH" >/dev/null <<EOF
[Unit]
Description=Web Dinámica — NestJS backend + SPA
After=network.target docker.service
Wants=docker.service

[Service]
Type=simple
User=$RUN_USER
WorkingDirectory=$BACK_DIR
EnvironmentFile=$BACK_ENV
ExecStart=$NODE_BIN $BACK_DIR/dist/main
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$SVC_NAME
NoNewPrivileges=true
ProtectSystem=full
ProtectHome=read-only
PrivateTmp=true
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

$SUDO systemctl daemon-reload
$SUDO systemctl enable "$SVC_NAME" >/dev/null 2>&1 || true
$SUDO systemctl restart "$SVC_NAME"
sleep 2
if $SUDO systemctl is-active --quiet "$SVC_NAME"; then
    log_ok "$SVC_NAME activo"
else
    log_err "El servicio no arrancó. Mira: journalctl -u $SVC_NAME -n 50"
    exit 1
fi

# ═════════════════════════════════════════════════════════════════════════
# 8) CADDY — reverse proxy con TLS automático
# ═════════════════════════════════════════════════════════════════════════
step "8/9  Caddy (reverse proxy + TLS)"

if [[ "$USE_TLS" -eq 0 ]]; then
    log_warn "Caddy/TLS DESACTIVADO (--no-tls)"
    log_warn "El bundle del front trae URLs https:// horneadas; sin TLS no funcionará el dashboard."
    log_info "Backend escuchando en http://127.0.0.1:$PORT"
else
    $SUDO mkdir -p /var/log/caddy
    $SUDO tee /etc/caddy/Caddyfile >/dev/null <<EOF
$DOMAIN_HOST {
    encode zstd gzip
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "SAMEORIGIN"
        Referrer-Policy "strict-origin-when-cross-origin"
        -Server
    }
    request_body {
        max_size 10MB
    }
    reverse_proxy 127.0.0.1:$PORT {
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
    log {
        output file /var/log/caddy/access.log {
            roll_size 50MB
            roll_keep 5
        }
        format console
    }
}
EOF
    $SUDO caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
    $SUDO systemctl enable caddy >/dev/null 2>&1 || true
    $SUDO systemctl restart caddy
    sleep 2
    if $SUDO systemctl is-active --quiet caddy; then
        log_ok "Caddy activo para $DOMAIN_HOST → 127.0.0.1:$PORT"
        log_info "El cert de Let's Encrypt se emite automáticamente al primer hit (~10-30s)"
    else
        log_err "Caddy no arrancó. Mira: journalctl -u caddy -n 30"
    fi
fi

# ═════════════════════════════════════════════════════════════════════════
# 9) FIREWALL
# ═════════════════════════════════════════════════════════════════════════
step "9/9  Firewall (ufw)"

if command -v ufw >/dev/null 2>&1; then
    UFW_STATUS=$($SUDO ufw status 2>/dev/null | head -1 | awk '{print $2}' || echo "inactive")
    if [[ "$UFW_STATUS" == "active" ]]; then
        if [[ "$USE_TLS" -eq 1 ]]; then
            $SUDO ufw allow 80/tcp >/dev/null 2>&1   && log_ok "ufw: 80/tcp permitido"
            $SUDO ufw allow 443/tcp >/dev/null 2>&1  && log_ok "ufw: 443/tcp permitido"
            # Cerramos el 3000 al exterior si estaba abierto
            $SUDO ufw delete allow "${PORT}/tcp" >/dev/null 2>&1 || true
        else
            $SUDO ufw allow "${PORT}/tcp" >/dev/null 2>&1 && log_ok "ufw: ${PORT}/tcp permitido"
        fi
    else
        log_info "ufw instalado pero inactivo (no se filtra ningún puerto a nivel SO)"
    fi
else
    log_info "ufw no instalado, se asume sin firewall local o uno externo del proveedor"
fi

# ═════════════════════════════════════════════════════════════════════════
# VERIFICACIÓN FINAL
# ═════════════════════════════════════════════════════════════════════════
step "Verificación"

sleep 3
if curl -fsS -o /dev/null -m 5 "http://127.0.0.1:$PORT/api/v1/promotions/active"; then
    log_ok "Backend responde local en http://127.0.0.1:$PORT"
else
    log_warn "Backend no responde aún en local. Logs: journalctl -u $SVC_NAME -n 30"
fi

if [[ "$USE_TLS" -eq 1 ]]; then
    log_info "Probando HTTPS (Let's Encrypt puede tardar la primera vez)..."
    OK=0
    for i in {1..15}; do
        if curl -fsS -o /dev/null -m 5 "https://$DOMAIN_HOST/api/v1/promotions/active"; then
            log_ok "Sitio responde en https://$DOMAIN_HOST"
            OK=1
            break
        fi
        sleep 3
    done
    if [[ "$OK" -eq 0 ]]; then
        log_warn "HTTPS aún no responde. Diagnóstico:"
        printf "    journalctl -u caddy -n 30 --no-pager\n"
        printf "    dig +short $DOMAIN_HOST   # ¿la IP es la de este server?\n"
        printf "    curl -v http://$DOMAIN_HOST/.well-known/acme-challenge/test\n"
    fi
fi

# ═════════════════════════════════════════════════════════════════════════
# RESUMEN FINAL
# ═════════════════════════════════════════════════════════════════════════
printf "\n${BOLD}${GREEN}"
printf '═%.0s' {1..70}; printf "\n"
printf "  INSTALACIÓN COMPLETA\n"
printf '═%.0s' {1..70}
printf "${NC}\n\n"

if [[ "$USE_TLS" -eq 1 ]]; then
    printf "  ${BOLD}URL${NC}:               https://%s\n" "$DOMAIN_HOST"
else
    printf "  ${BOLD}URL${NC}:               http://%s:%s\n" "$DOMAIN_HOST" "$PORT"
fi
printf "  ${BOLD}Login${NC}:             %s/login\n" "$DOMAIN"
printf "  ${BOLD}Admin email${NC}:       %s\n" "$SEED_ADMIN_EMAIL"
printf "  ${BOLD}Admin password${NC}:    grep SEED_ADMIN_PASSWORD %s\n" "$BACK_ENV"
printf "\n"
printf "  ${BOLD}Servicios${NC}:\n"
printf "     • Backend:  systemctl status $SVC_NAME\n"
[[ "$USE_TLS" -eq 1 ]] && printf "     • Caddy:    systemctl status caddy\n"
printf "     • Postgres: docker ps | grep web_dinamica_db\n"
printf "\n"
printf "  ${BOLD}Logs${NC}:\n"
printf "     • Backend:  journalctl -u $SVC_NAME -f\n"
[[ "$USE_TLS" -eq 1 ]] && printf "     • Caddy:    journalctl -u caddy -f\n"
printf "     • Postgres: docker logs -f web_dinamica_db\n"
printf "\n"
printf "  ${YELLOW}⚠  Después del primer login: CAMBIA LA PASSWORD del admin${NC}\n\n"
