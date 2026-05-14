#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
# Web Dinámica — Instalador de producción
# ─────────────────────────────────────────────────────────────────────────
# Despliega backend (NestJS) + frontend (Vite) en un único host. El backend
# sirve la API en /api/v1 y la SPA del frontend desde /. Postgres corre en
# Docker (con docker-compose.yml) si Docker está disponible; si no, asume
# Postgres instalado localmente.
#
# Uso:
#   ./install.sh              # instalación interactiva (recomendado)
#   ./install.sh --no-prompt  # usa valores de .env si existe, sin preguntar
#   ./install.sh --reset-env  # regenera .env desde cero
#
# Requisitos del host:
#   - Linux/macOS con bash 4+
#   - Node.js 20+ y npm
#   - Docker + docker compose (recomendado) o Postgres 16+ corriendo
#   - openssl (para generar secretos)
# ─────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Colores y logging ────────────────────────────────────────────────────
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
    printf '%.s═' {1..70}; printf "\n"
    printf "  WEB DINÁMICA — Instalador de producción\n"
    printf '%.s═' {1..70}
    printf "${NC}\n\n"
}

# ── Flags ────────────────────────────────────────────────────────────────
NO_PROMPT=0
RESET_ENV=0
for arg in "$@"; do
    case "$arg" in
        --no-prompt) NO_PROMPT=1 ;;
        --reset-env) RESET_ENV=1 ;;
        -h|--help)
            sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
            exit 0 ;;
        *)  log_err "Argumento desconocido: $arg"; exit 1 ;;
    esac
done

# ── Paths ────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACK_DIR="$SCRIPT_DIR"
ROOT_DIR="$(cd "$BACK_DIR/.." && pwd)"
FRONT_DIR="$ROOT_DIR/front_web_dinamica_admin"
BACK_ENV="$BACK_DIR/.env"
BACK_ENV_TEMPLATE="$BACK_DIR/.env.production.example"
FRONT_ENV_PROD="$FRONT_DIR/.env.production"
PUBLIC_DIR="$BACK_DIR/public"

banner

# ── 1. Verificar dependencias del sistema ───────────────────────────────
step "1/9  Verificando dependencias del sistema"

check_cmd() {
    if command -v "$1" >/dev/null 2>&1; then
        local version
        version=$("$1" --version 2>/dev/null | head -n1 || echo "")
        log_ok "$1 disponible ${version:+($version)}"
        return 0
    fi
    return 1
}

MISSING=()
check_cmd node    || MISSING+=("node (>=20)")
check_cmd npm     || MISSING+=("npm")
check_cmd openssl || MISSING+=("openssl")

if [[ ${#MISSING[@]} -gt 0 ]]; then
    log_err "Faltan dependencias: ${MISSING[*]}"
    log_info "En Debian/Ubuntu: sudo apt install -y nodejs npm openssl"
    log_info "Para Node 20+: usa nvm o las builds oficiales de nodesource."
    exit 1
fi

# Node 20+
NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
if [[ "$NODE_MAJOR" -lt 20 ]]; then
    log_err "Se requiere Node 20+. Detectado: $(node -v)"
    exit 1
fi

# Docker — opcional pero recomendado para Postgres
USE_DOCKER=0
if check_cmd docker; then
    if docker compose version >/dev/null 2>&1; then
        USE_DOCKER=1
        log_ok "Docker Compose disponible — Postgres correrá en contenedor"
    elif command -v docker-compose >/dev/null 2>&1; then
        USE_DOCKER=1
        log_ok "docker-compose (v1) disponible"
    else
        log_warn "Docker presente pero sin compose. Postgres deberá ser externo."
    fi
else
    log_warn "Docker no encontrado. Se asume Postgres corriendo localmente."
fi

# ── 2. Cargar/preguntar configuración ───────────────────────────────────
step "2/9  Configuración de despliegue"

prompt() {
    # prompt VAR "Etiqueta" "default"
    local __var="$1" __label="$2" __default="${3:-}" __input=""
    if [[ "$NO_PROMPT" -eq 1 ]]; then
        printf -v "$__var" '%s' "$__default"
        return
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
        printf -v "$__var" '%s' "$__default"
        return
    fi
    printf "  ${BOLD}%s${NC} [enter = generar aleatorio]: " "$__label"
    read -rs __input || true
    printf "\n"
    [[ -z "$__input" ]] && __input="$__default"
    printf -v "$__var" '%s' "$__input"
}

# Si .env ya existe y no se pidió reset, reusarlo
if [[ -f "$BACK_ENV" && "$RESET_ENV" -eq 0 ]]; then
    log_info ".env existente detectado, se reutilizará."
    log_info "Pasa --reset-env para regenerarlo."
    # shellcheck disable=SC1090
    set -a; source "$BACK_ENV"; set +a
    DOMAIN="${DOMAIN:-}"
    # Si no hay DOMAIN en el .env, sácalo de CORS_ORIGIN
    if [[ -z "$DOMAIN" ]] && [[ -n "${CORS_ORIGIN:-}" ]]; then
        DOMAIN="${CORS_ORIGIN%%,*}"
    fi
else
    prompt DOMAIN          "Dominio público que ya apunta a este servidor (con https://)"  "https://marcsol-preview.casacam.net"

    # ¿URLs absolutas en el bundle del frontend?
    # Por defecto NO: el back sirve el front en el mismo origen → paths
    # relativos son más portables (el mismo dist funciona en cualquier dominio).
    prompt FRONT_ABSOLUTE  "¿Hornear el dominio en el bundle del front? (y/N)"   "N"

    prompt DB_HOST         "DB host"                          "localhost"
    prompt DB_PORT         "DB port"                          "5432"
    prompt DB_USERNAME     "DB usuario"                       "postgres"
    prompt_secret DB_PASSWORD "DB password"                   "$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-24)"
    prompt DB_DATABASE     "DB nombre"                        "web_dinamica"

    prompt SEED_ADMIN_EMAIL "Email del super admin"           "admin@${DOMAIN#https://}"
    SEED_ADMIN_EMAIL="${SEED_ADMIN_EMAIL#admin@www.}"
    prompt_secret SEED_ADMIN_PASSWORD "Password del super admin" "$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-18)"
    prompt SEED_ADMIN_NAME "Nombre del super admin"           "Super Admin"

    prompt PORT            "Puerto donde escucha el backend"  "3000"

    # Secretos automáticos
    JWT_SECRET="$(openssl rand -hex 32)"   # 64 chars hex → cumple min 48
    log_ok "JWT_SECRET generado (64 chars)"

    # Cookie domain a partir del dominio
    COOKIE_HOST="${DOMAIN#https://}"; COOKIE_HOST="${COOKIE_HOST#http://}"; COOKIE_HOST="${COOKIE_HOST%%/*}"
    COOKIE_DOMAIN_DEFAULT=""
    if [[ "$COOKIE_HOST" =~ \. ]]; then
        # Para hostnames como app.midominio.com, dejamos vacío y la cookie queda atada al host.
        COOKIE_DOMAIN_DEFAULT=""
    fi

    # Generar .env
    log_info "Generando $BACK_ENV ..."
    umask 077
    cat > "$BACK_ENV" <<EOF
# Generado por install.sh — $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# Edita con cuidado. No comitear este archivo.

NODE_ENV=production
PORT=$PORT
API_PREFIX=api/v1

DB_HOST=$DB_HOST
DB_PORT=$DB_PORT
DB_USERNAME=$DB_USERNAME
DB_PASSWORD=$DB_PASSWORD
DB_DATABASE=$DB_DATABASE
DB_SYNCHRONIZE=false
DB_LOGGING=false

JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=1d

COOKIE_NAME=ws_session
COOKIE_SECURE=$( [[ "$DOMAIN" == https://* ]] && echo true || echo false )
COOKIE_SAMESITE=lax
COOKIE_DOMAIN=$COOKIE_DOMAIN_DEFAULT

CORS_ORIGIN=$DOMAIN

BCRYPT_SALT_ROUNDS=12

THROTTLE_TTL_MS=60000
THROTTLE_LIMIT=120

SEED_ADMIN_EMAIL=$SEED_ADMIN_EMAIL
SEED_ADMIN_PASSWORD=$SEED_ADMIN_PASSWORD
SEED_ADMIN_NAME=$SEED_ADMIN_NAME

UPLOAD_DEST=./uploads
UPLOAD_MAX_SIZE=5242880

# Memo del instalador (no la lee Nest)
DOMAIN=$DOMAIN
EOF
    chmod 600 "$BACK_ENV"
    log_ok "$BACK_ENV creado (permisos 600)"
fi

# Validar que tenemos lo necesario para continuar
: "${DOMAIN:?Falta DOMAIN}"
: "${DB_PASSWORD:?Falta DB_PASSWORD}"

# ── 3. Levantar Postgres (Docker) ───────────────────────────────────────
step "3/9  Base de datos"

if [[ "$USE_DOCKER" -eq 1 ]]; then
    log_info "Levantando contenedor de Postgres con docker compose..."
    # shellcheck disable=SC1090
    set -a; source "$BACK_ENV"; set +a
    (cd "$BACK_DIR" && docker compose up -d) || (cd "$BACK_DIR" && docker-compose up -d)
    # Espera a que Postgres acepte conexiones
    log_info "Esperando a Postgres..."
    for i in {1..30}; do
        if docker exec web_dinamica_db pg_isready -U "$DB_USERNAME" -d "$DB_DATABASE" >/dev/null 2>&1; then
            log_ok "Postgres responde"
            break
        fi
        sleep 1
        [[ "$i" -eq 30 ]] && { log_err "Postgres no respondió en 30s"; exit 1; }
    done
else
    log_warn "Asegúrate de que Postgres corre en $DB_HOST:$DB_PORT con DB \"$DB_DATABASE\"."
fi

# ── 4. Backend: dependencias + build ────────────────────────────────────
step "4/9  Backend — instalando dependencias"

cd "$BACK_DIR"
if [[ -f package-lock.json ]]; then
    npm ci --no-audit --no-fund
else
    npm install --no-audit --no-fund
fi
log_ok "Dependencias del backend instaladas"

step "5/9  Backend — compilando"
npm run build
log_ok "Backend compilado en dist/"

# ── 5. Frontend: dependencias + build con .env.production ───────────────
step "6/9  Frontend — instalando dependencias y compilando"

if [[ ! -d "$FRONT_DIR" ]]; then
    log_err "No encuentro la carpeta del frontend en $FRONT_DIR"
    exit 1
fi

# Decidir si el bundle del front lleva URLs absolutas o relativas.
# - Relativas (default): el mismo dist funciona en cualquier dominio.
# - Absolutas: hornean DOMAIN en el bundle. Útil sólo si en algún momento
#   el front se servirá desde un dominio DIFERENTE al backend.
FRONT_ABS_FLAG="${FRONT_ABSOLUTE:-N}"
FRONT_ABS_FLAG="$(printf '%s' "$FRONT_ABS_FLAG" | tr '[:upper:]' '[:lower:]')"

# Backup del .env.production existente para no perder claves de EmailJS si las hubiera.
EMAILJS_PUB=""; EMAILJS_SVC=""; EMAILJS_T1=""; EMAILJS_T2=""; ADMIN_EMAIL_FRONT=""
if [[ -f "$FRONT_ENV_PROD" ]]; then
    EMAILJS_PUB=$(grep -E '^VITE_EMAILJS_PUBLIC_KEY=' "$FRONT_ENV_PROD" | cut -d= -f2- || true)
    EMAILJS_SVC=$(grep -E '^VITE_EMAILJS_SERVICE_ID=' "$FRONT_ENV_PROD" | cut -d= -f2- || true)
    EMAILJS_T1=$(grep -E '^VITE_EMAILJS_TEMPLATE_CONTACT=' "$FRONT_ENV_PROD" | cut -d= -f2- || true)
    EMAILJS_T2=$(grep -E '^VITE_EMAILJS_TEMPLATE_SUBSCRIBE=' "$FRONT_ENV_PROD" | cut -d= -f2- || true)
    ADMIN_EMAIL_FRONT=$(grep -E '^VITE_ADMIN_EMAIL=' "$FRONT_ENV_PROD" | cut -d= -f2- || true)
fi

if [[ "$FRONT_ABS_FLAG" =~ ^(y|yes|s|si|sí)$ ]]; then
    log_info "Hornearé el dominio en el bundle del frontend: $DOMAIN"
    VITE_API_URL_VAL="${DOMAIN%/}/api/v1"
    VITE_STATIC_URL_VAL="${DOMAIN%/}"
else
    log_info "Bundle del frontend con paths relativos (mismo origen, portable)"
    VITE_API_URL_VAL="/api/v1"
    VITE_STATIC_URL_VAL=""
fi

cat > "$FRONT_ENV_PROD" <<EOF
# Generado por install.sh — $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# Modo: $( [[ "$FRONT_ABS_FLAG" =~ ^(y|yes|s|si|sí)$ ]] && echo "URLs absolutas (dominio horneado)" || echo "paths relativos (mismo origen)" )
VITE_API_URL=$VITE_API_URL_VAL
VITE_STATIC_URL=$VITE_STATIC_URL_VAL
VITE_EMAILJS_PUBLIC_KEY=$EMAILJS_PUB
VITE_EMAILJS_SERVICE_ID=$EMAILJS_SVC
VITE_EMAILJS_TEMPLATE_CONTACT=$EMAILJS_T1
VITE_EMAILJS_TEMPLATE_SUBSCRIBE=$EMAILJS_T2
VITE_ADMIN_EMAIL=$ADMIN_EMAIL_FRONT
EOF
log_ok "Escrito $FRONT_ENV_PROD"

cd "$FRONT_DIR"
if [[ -f package-lock.json ]]; then
    npm ci --no-audit --no-fund
else
    npm install --no-audit --no-fund
fi
log_ok "Dependencias del frontend instaladas"

# Vite usa NODE_ENV=production cuando se invoca 'vite build' (es el default).
npm run build
log_ok "Frontend compilado en $FRONT_DIR/dist/"

# ── 6. Copiar dist del front al public/ del back ────────────────────────
step "7/9  Copiando dist del frontend a $PUBLIC_DIR"

mkdir -p "$PUBLIC_DIR"
# Limpieza segura: borramos el contenido pero NO la carpeta (puede tener .gitkeep).
find "$PUBLIC_DIR" -mindepth 1 -delete
cp -R "$FRONT_DIR/dist/." "$PUBLIC_DIR/"
log_ok "Frontend copiado a $PUBLIC_DIR (servido en /)"

# ── 7. Migraciones + seed del admin ─────────────────────────────────────
step "8/9  Migraciones y seed del primer admin"

cd "$BACK_DIR"
# shellcheck disable=SC1090
set -a; source "$BACK_ENV"; set +a

log_info "Aplicando migraciones de TypeORM..."
npm run migration:run
log_ok "Migraciones aplicadas"

log_info "Creando super admin (idempotente)..."
npm run seed:admin
log_ok "Seed ejecutado"

# ── 8. Configurar servicio systemd (si está disponible) ─────────────────
step "9/9  Servicio del sistema"

setup_systemd() {
    local svc_name="web-dinamica"
    local svc_path="/etc/systemd/system/${svc_name}.service"
    local user
    user="$(id -un)"

    if [[ $EUID -ne 0 ]] && ! command -v sudo >/dev/null 2>&1; then
        log_warn "No soy root y no hay sudo: omito systemd."
        return 1
    fi

    log_info "Generando unit file en $svc_path"

    local SUDO=""; [[ $EUID -ne 0 ]] && SUDO="sudo"
    $SUDO tee "$svc_path" >/dev/null <<EOF
[Unit]
Description=Web Dinámica — NestJS backend + SPA
After=network.target docker.service
Wants=docker.service

[Service]
Type=simple
User=$user
WorkingDirectory=$BACK_DIR
EnvironmentFile=$BACK_ENV
ExecStart=$(command -v node) $BACK_DIR/dist/main
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$svc_name
# Hardening básico
NoNewPrivileges=true
ProtectSystem=full
ProtectHome=read-only
PrivateTmp=true
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

    $SUDO systemctl daemon-reload
    $SUDO systemctl enable "$svc_name"
    $SUDO systemctl restart "$svc_name"
    sleep 2
    if $SUDO systemctl is-active --quiet "$svc_name"; then
        log_ok "Servicio $svc_name activo (systemctl status $svc_name)"
        return 0
    else
        log_err "El servicio no arrancó. Diagnóstico: journalctl -u $svc_name -n 50"
        return 1
    fi
}

SYSTEMD_OK=0
if command -v systemctl >/dev/null 2>&1 && [[ -d /etc/systemd/system ]]; then
    if setup_systemd; then
        SYSTEMD_OK=1
    fi
else
    log_warn "systemd no disponible — arranca manualmente con:"
    log_info "  cd $BACK_DIR && NODE_ENV=production node dist/main"
fi

# ── Resumen final ───────────────────────────────────────────────────────
printf "\n${BOLD}${GREEN}"
printf '%.s═' {1..70}; printf "\n"
printf "  INSTALACIÓN COMPLETA\n"
printf '%.s═' {1..70}
printf "${NC}\n\n"

printf "  ${BOLD}Dominio${NC}:        %s\n" "$DOMAIN"
printf "  ${BOLD}Backend puerto${NC}: %s\n" "${PORT:-3000}"
printf "  ${BOLD}API${NC}:            %s/api/v1\n" "$DOMAIN"
printf "  ${BOLD}Admin email${NC}:    %s\n" "${SEED_ADMIN_EMAIL:-N/A}"
printf "  ${BOLD}DB${NC}:             %s@%s:%s/%s\n" "$DB_USERNAME" "$DB_HOST" "$DB_PORT" "$DB_DATABASE"
printf "\n"

if [[ "$SYSTEMD_OK" -eq 1 ]]; then
    printf "  ${BOLD}Servicio${NC}:       systemctl status web-dinamica\n"
    printf "  ${BOLD}Logs${NC}:           journalctl -u web-dinamica -f\n"
else
    printf "  ${BOLD}Arranque${NC}:       cd $BACK_DIR && node dist/main\n"
fi

# ── Generar archivos de reverse proxy con tu dominio ya rellenado ────────
DEPLOY_DIR="$BACK_DIR/deploy"
DOMAIN_HOST="${DOMAIN#https://}"; DOMAIN_HOST="${DOMAIN_HOST#http://}"; DOMAIN_HOST="${DOMAIN_HOST%%/*}"
GENERATED_DIR="$DEPLOY_DIR/generated"
mkdir -p "$GENERATED_DIR"

if [[ -f "$DEPLOY_DIR/Caddyfile" ]]; then
    sed -e "s|__DOMAIN__|$DOMAIN_HOST|g" \
        -e "s|__PORT__|${PORT:-3000}|g" \
        "$DEPLOY_DIR/Caddyfile" > "$GENERATED_DIR/Caddyfile"
fi
if [[ -f "$DEPLOY_DIR/nginx.conf" ]]; then
    sed -e "s|__DOMAIN__|$DOMAIN_HOST|g" \
        -e "s|__PORT__|${PORT:-3000}|g" \
        "$DEPLOY_DIR/nginx.conf" > "$GENERATED_DIR/${DOMAIN_HOST}.conf"
fi

printf "\n  ${BOLD}Reverse proxy${NC} (plantillas ya con tu dominio):\n"
[[ -f "$GENERATED_DIR/Caddyfile" ]]            && printf "     • Caddy: %s\n" "$GENERATED_DIR/Caddyfile"
[[ -f "$GENERATED_DIR/${DOMAIN_HOST}.conf" ]]  && printf "     • nginx: %s\n" "$GENERATED_DIR/${DOMAIN_HOST}.conf"

printf "\n  ${YELLOW}⚠  Próximos pasos:${NC}\n"
printf "     1) Coloca el reverse proxy con HTTPS apuntando a 127.0.0.1:${PORT:-3000}\n"
printf "        Caddy (recomendado, TLS automático):\n"
printf "          sudo cp $GENERATED_DIR/Caddyfile /etc/caddy/Caddyfile\n"
printf "          sudo systemctl reload caddy\n"
printf "        nginx + certbot:\n"
printf "          sudo cp $GENERATED_DIR/${DOMAIN_HOST}.conf /etc/nginx/sites-available/${DOMAIN_HOST}\n"
printf "          sudo ln -sf /etc/nginx/sites-available/${DOMAIN_HOST} /etc/nginx/sites-enabled/${DOMAIN_HOST}\n"
printf "          sudo certbot --nginx -d $DOMAIN_HOST\n"
printf "     2) Inicia sesión en $DOMAIN y CAMBIA LA PASSWORD del admin\n"
printf "     3) Configura backup periódico de Postgres y de ./uploads\n"
printf "     4) Verifica DNS:  dig +short $DOMAIN_HOST  → debe devolver la IP de este servidor\n\n"
