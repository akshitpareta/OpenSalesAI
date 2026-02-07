#!/bin/bash
# =============================================================================
# PostgreSQL — Initialize Multiple Databases
# =============================================================================
# This script runs on first container startup (when data volume is empty).
# It creates additional databases needed by services (keycloak, n8n, mlflow).
#
# The POSTGRES_MULTIPLE_DATABASES env var is a comma-separated list of DB names.
# The primary database (POSTGRES_DB) is created automatically by the image.
# =============================================================================

set -e
set -u

function create_user_and_database() {
    local database=$1
    echo "  Creating database '$database'..."
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
        SELECT 'CREATE DATABASE "$database"'
        WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$database')\gexec
        GRANT ALL PRIVILEGES ON DATABASE "$database" TO "$POSTGRES_USER";
EOSQL
    echo "  Database '$database' created."
}

if [ -n "${POSTGRES_MULTIPLE_DATABASES:-}" ]; then
    echo "=== Multiple database creation requested ==="
    echo "Databases: $POSTGRES_MULTIPLE_DATABASES"
    echo ""

    for db in $(echo "$POSTGRES_MULTIPLE_DATABASES" | tr ',' ' '); do
        db=$(echo "$db" | xargs)  # trim whitespace
        if [ -n "$db" ]; then
            create_user_and_database "$db"
        fi
    done

    echo ""
    echo "=== Multiple database creation complete ==="
else
    echo "No POSTGRES_MULTIPLE_DATABASES variable set. Skipping."
fi

# ---------------------------------------------------------------------------
# Enable useful extensions in the primary database
# ---------------------------------------------------------------------------
echo ""
echo "=== Enabling PostgreSQL extensions ==="
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS "btree_gist";
    CREATE EXTENSION IF NOT EXISTS "pg_trgm";
EOSQL
echo "=== Extensions enabled ==="
