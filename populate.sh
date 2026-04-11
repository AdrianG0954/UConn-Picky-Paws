#!/bin/sh
set -e

echo "Populating db with this weeks dishes..."
python -m backend.populate_db
echo "Done!"