#!/bin/sh
set -e

echo "Running Alembic migrations..."
alembic upgrade head

echo "Initially populating the database..."
python -m backend.populate_db

echo "Starting application..."
exec "$@"