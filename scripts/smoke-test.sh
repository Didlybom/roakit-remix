GREEN='\033[0;32m'
RED='\033[0;31m'
RESET='\033[0m'

info_page=$(curl --fail-with-body -sS https://roakit-production.web.app/info)
if [ $? -ne 0 ]; then
    printf "${RED}⚠  smoke test:${RESET} ERROR (curl)\n"
    exit 1
fi
echo $info_page | grep '© Roakit' > /dev/null
if [ $? -ne 0 ]; then
    printf "${RED}⚠  smoke test:${RESET} ERROR (unexpected response)\n"
    exit 1
fi
printf "${GREEN}✔  smoke test:${RESET} OK\n"