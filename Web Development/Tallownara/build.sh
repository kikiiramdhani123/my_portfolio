#!/usr/bin/env bash
set -e

echo "==> Installing Python dependencies..."
pip install -r requirements.txt

echo "==> Installing Node dependencies..."
cd frontend
npm install

echo "==> Building React frontend..."
npm run build
cd ..

echo "==> Initializing database..."
python -c "from server import init_db; init_db()"

echo "==> Build complete."
