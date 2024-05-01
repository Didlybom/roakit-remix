GREEN='\033[0;32m'
RED='\033[0;31m'
RESET='\033[0m'

info_page=$(curl --fail-with-body -sS  https://roakit-production.web.app/info)
if [ $? -ne 0 ]; then
    echo "${RED}⚠ Smoke test:${RESET} ERROR (curl)"
    exit 1
fi
echo $info_page | grep 'Copyright © ROAKIT' > /dev/null
if [ $? -ne 0 ]; then
    echo "${RED}⚠ Smoke test:${RESET} ERROR (unexpected response)"
    exit 1
fi
echo "${GREEN}✔ smoke test:${RESET} OK"