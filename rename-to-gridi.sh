#!/usr/bin/env bash
set -e

echo "Renombrando proyecto a GRIDI (v0.2)..."

# 1) app.ts – título visible
sed -i 's/Glitch Groovebox v0.2/GRIDI v0.2/g' src/ui/app.ts

# 2) index.html – título de la pestaña
sed -i 's/<title>.*<\/title>/<title>GRIDI<\/title>/g' index.html

# 3) package.json – nombre del paquete
sed -i 's/"name": *"[^"]*"/"name": "gridi"/g' package.json

echo "✔ Nombre actualizado:"
echo "  - UI: GRIDI v0.2"
echo "  - HTML title: GRIDI"
echo "  - package.json name: gridi"
