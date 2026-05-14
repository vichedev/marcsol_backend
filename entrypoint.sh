#!/bin/sh
# =========================================================================
# entrypoint.sh — Arranque del contenedor api.
#   1) db-bootstrap: auto-heal del tracking de migraciones (idempotente)
#   2) exec node dist/main.js: arranca la app (PID 1 vía exec)
# =========================================================================

set -e

if [ -f scripts/db-bootstrap.js ]; then
    node scripts/db-bootstrap.js
fi

exec node dist/main.js
