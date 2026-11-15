#!/bin/sh
# Web-Version bauen und auf Vercel veröffentlichen (Projekt snappymon -> snappymon.com).
# Braucht .env.local (EXPO_PUBLIC_CONVEX_URL) und .env.deploy (VERCEL_ORG_ID, VERCEL_PROJECT_ID); beide sind nicht im Repo.
set -e
cd "$(dirname "$0")/.."
set -a; . ./.env.deploy; set +a
npx expo export -p web
# monster-kit als statische Seiten unter /kit (Reel, Arena, Testseite)
mkdir -p dist/kit
cp monster-kit/*.js monster-kit/*.html monster-kit/*.json dist/kit/
printf '%s\n' '{ "rewrites": [{ "source": "/((?!kit/|_expo/|assets/).*)", "destination": "/index.html" }] }' > dist/vercel.json
vercel deploy dist --prod --yes
