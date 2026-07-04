#!/usr/bin/env bash
# Deploy Covenant Sentinel on a Vultr compute instance — everything on Vultr,
# from inference to serving.
#
# Requirements:
#   VULTR_API_KEY            — Vultr ACCOUNT api key (vultr.com → Account → API)
#   .env.local in repo root  — contains VULTR_INFERENCE_API_KEY (injected into the instance)
#
# Usage: VULTR_API_KEY=... ./deploy/vultr-deploy.sh
set -euo pipefail

API="https://api.vultr.com/v2"
REGION="${VULTR_REGION:-cdg}"        # Paris
PLAN="${VULTR_PLAN:-vc2-2c-4gb}"     # 2 vCPU / 4 GB — enough to build Next.js
LABEL="covenant-sentinel"

[ -n "${VULTR_API_KEY:-}" ] || { echo "VULTR_API_KEY missing (account API key, not the inference key)"; exit 1; }

DIR="$(cd "$(dirname "$0")" && pwd)"
INFERENCE_KEY="$(grep '^VULTR_INFERENCE_API_KEY' "$DIR/../.env.local" | cut -d'=' -f2 | tr -d ' \r')"
[ -n "$INFERENCE_KEY" ] || { echo "VULTR_INFERENCE_API_KEY not found in .env.local"; exit 1; }

# Ubuntu 24.04 LTS x64, resolved dynamically
OS_ID=$(curl -s "$API/os?per_page=500" -H "Authorization: Bearer $VULTR_API_KEY" |
  python3 -c "import sys,json; print(next(o['id'] for o in json.load(sys.stdin)['os'] if 'Ubuntu 24.04' in o['name'] and 'x64' in o['name']))")

USER_DATA=$(sed "s/__INFERENCE_KEY__/$INFERENCE_KEY/" "$DIR/cloud-init.yaml" | base64 | tr -d '\n')

echo "Creating instance ($REGION / $PLAN / os $OS_ID)…"
INSTANCE=$(curl -s -X POST "$API/instances" \
  -H "Authorization: Bearer $VULTR_API_KEY" -H "Content-Type: application/json" \
  -d "{\"region\":\"$REGION\",\"plan\":\"$PLAN\",\"os_id\":$OS_ID,\"label\":\"$LABEL\",\"user_data\":\"$USER_DATA\",\"backups\":\"disabled\"}")
ID=$(echo "$INSTANCE" | python3 -c "import sys,json; print(json.load(sys.stdin)['instance']['id'])")
echo "Instance $ID created. Waiting for IP…"

for _ in $(seq 1 60); do
  sleep 10
  INFO=$(curl -s "$API/instances/$ID" -H "Authorization: Bearer $VULTR_API_KEY")
  IP=$(echo "$INFO" | python3 -c "import sys,json; print(json.load(sys.stdin)['instance']['main_ip'])")
  STATUS=$(echo "$INFO" | python3 -c "import sys,json; print(json.load(sys.stdin)['instance']['status'])")
  echo "  status=$STATUS ip=$IP"
  [ "$STATUS" = "active" ] && [ "$IP" != "0.0.0.0" ] && break
done

echo ""
echo "Instance active: http://$IP"
echo "cloud-init needs ~4-6 more minutes to clone + build + start the app."
echo "Check:   curl -s http://$IP/api/health"
echo "Destroy: curl -X DELETE $API/instances/$ID -H \"Authorization: Bearer \$VULTR_API_KEY\""
