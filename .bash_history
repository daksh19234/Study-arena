cd "/public/Customtv"
pkg install nodejs -y
apt install nodejs
apk add apt
apt install nodejs
apk add nodejs
curl -fsSL https://blackbox.ai/install.sh | bash
apk add curl
curl -fsSL https://blackbox.ai/install.sh | bash
curl -sS -L -o /tmp/blackbox-release.json -w '\nHTTP_STATUS=%{http_code}\n' 'https://releases.blackbox.ai/api/v0/latest?product=blackbox-cli-v2&platform=linux-arm64'
cat /tmp/blackbox-release.json
OK: 151 MiB in 98 packages
root@localhost ~/Customtv $ curl -fsSL https://blackbox.ai/install.sh | bash
  ████░░░░░░░░░░░░░░░░ 22% - Fetching release informationError: Failed to fetch release information from https://releases.blackbox.ai/api/v0/latest?product=blackbox-cli-v2&platform=linux-arm64
Please check that the extension service is available and the product 'blackbox-cli-v2' exists.
root@localhost ~/Customtv $ curl -sS -L -o /tmp/blackbox-release.json > -w '\nHTTP_STATUS=%{http_code}\n' > 'https://releases.blackbox.ai/api/v0/latest?product=blackbox-cli-v2&platform=linux-arm64'
HTTP_STATUS=404
root@localhost ~/Customtv $ 
root@localhost ~/Customtv $ cat /tmp/blackbox-release.json
root@localhost ~/Customtv $ 
npm install -g @blackbox_ai/blackbox-cli
apk add npm
npm install -g @blackbox_ai/blackbox-cli
blacbox
blackbox
