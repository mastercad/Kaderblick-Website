#!/bin/sh
# Runtime-Substitution der Backend-URL in den gebauten Frontend-Assets.
#
# Das frontend-demo-Image hat VITE_BACKEND_URL=https://demo-api.kaderblick.de
# zur Build-Zeit eingebettet. Für dynamische Demo-Instanzen (demo-<token>-api.kaderblick.de)
# wird die URL beim Container-Start durch RUNTIME_API_URL ersetzt.
#
# Ist RUNTIME_API_URL nicht gesetzt oder entspricht dem Standardwert, wird nichts ersetzt.

BAKED_URL="https://demo-api.kaderblick.de"

if [ -n "$RUNTIME_API_URL" ] && [ "$RUNTIME_API_URL" != "$BAKED_URL" ]; then
    echo "Ersetze Backend-URL: ${BAKED_URL} → ${RUNTIME_API_URL}"
    find /usr/share/nginx/html/assets -name "*.js" | while read -r file; do
        sed -i "s|${BAKED_URL}|${RUNTIME_API_URL}|g" "$file"
    done
fi

exec nginx -g 'daemon off;'
