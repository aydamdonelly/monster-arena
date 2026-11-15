#!/bin/sh
# Web-Version bauen und auf Vercel veröffentlichen (Projekt snappymon -> snappymon.com).
# Braucht .env.local (EXPO_PUBLIC_CONVEX_URL) und .env.deploy (VERCEL_ORG_ID, VERCEL_PROJECT_ID); beide sind nicht im Repo.
set -e
cd "$(dirname "$0")/.."
set -a; . ./.env.deploy; set +a
npx expo export -p web
# Die Seite lädt jede Ansicht (Arena, Sammlung, Kampf) erst bei Bedarf nach, unter einem Namen mit Prüfsumme.
# Wer einen Tab von vor dieser Veröffentlichung offen hat, fragt weiter nach den alten Namen. Darum liegen die
# nachgeladenen Teile früherer Veröffentlichungen jeder neuen bei (Archiv .web-chunks, nicht im Repo).
mkdir -p .web-chunks
cp dist/_expo/static/js/web/*.js .web-chunks/
for f in .web-chunks/*.js; do
  case "$(basename "$f")" in
    __common-*|entry-*|__expo-metro-runtime-*) ;; # schon beim Seitenstart geladen, alte Tabs brauchen sie nicht mehr
    *) [ -e "dist/_expo/static/js/web/$(basename "$f")" ] || cp "$f" dist/_expo/static/js/web/ ;;
  esac
done
# monster-kit als statische Seiten unter /kit (Reel, Arena, Testseite)
mkdir -p dist/kit
cp monster-kit/*.js monster-kit/*.html monster-kit/*.json dist/kit/
# Lokale Arbeitsdateien (Unterstrich am Anfang, z. B. der Export der Kontrollseite) gehören nicht ins Netz
rm -f dist/kit/_*
# Vercel lädt keine Ordner namens node_modules hoch. Schriften und Icons liegen im Export aber unter assets/node_modules:
# Ordner umbenennen und die alten Pfade per Rewrite darauf zeigen lassen.
if [ -d dist/assets/node_modules ]; then mv dist/assets/node_modules dist/assets/nm; fi
cat > dist/vercel.json <<'JSON'
{
  "rewrites": [
    { "source": "/assets/node_modules/:path*", "destination": "/assets/nm/:path*" },
    { "source": "/analytics", "destination": "/kit/analytics.html" },
    { "source": "/admin", "destination": "/kit/admin.html" },
    { "source": "/((?!kit/|_expo/|assets/).*)", "destination": "/index.html" }
  ]
}
JSON
vercel deploy dist --prod --yes
