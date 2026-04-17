#!/bin/bash
set -euo pipefail

# ============================================
# Wazuh Server Bootstrap - ${server_name}
# Environment: ${environment}
# Version: ${wazuh_version}
# ============================================

exec > >(tee /var/log/wazuh-bootstrap.log) 2>&1
echo "[$(date -Iseconds)] Starting Wazuh server bootstrap..."

WAZUH_VERSION="${wazuh_version}"
NODE_EXPORTER_VERSION="${node_exporter_version}"
WAZUH_EXPORTER_VERSION="${wazuh_exporter_version}"
DATA_DEVICE="${data_device}"

# ============================================
# 1. System Preparation
# ============================================

echo "[$(date -Iseconds)] Updating system packages..."
dnf update -y
dnf install -y jq curl unzip tar gzip openssl

# Set hostname
hostnamectl set-hostname "${server_name}"

# Increase vm.max_map_count for OpenSearch/Wazuh Indexer
cat >> /etc/sysctl.conf <<SYSCTL
vm.max_map_count=262144
fs.file-max=65536
net.core.somaxconn=32768
net.ipv4.tcp_max_syn_backlog=8192
SYSCTL
sysctl -p

# Increase file limits
cat >> /etc/security/limits.conf <<LIMITS
* soft nofile 65536
* hard nofile 65536
* soft nproc 32768
* hard nproc 32768
LIMITS

# ============================================
# 2. Data Volume Setup
# ============================================

echo "[$(date -Iseconds)] Setting up data volume..."

# Wait for device to be available
while [ ! -b "$DATA_DEVICE" ]; do
  echo "Waiting for $DATA_DEVICE..."
  sleep 5
done

# Format if not already formatted
if ! blkid "$DATA_DEVICE" | grep -q ext4; then
  mkfs.ext4 -L wazuh-data "$DATA_DEVICE"
fi

mkdir -p /var/ossec/data
echo "LABEL=wazuh-data /var/ossec/data ext4 defaults,noatime 0 2" >> /etc/fstab
mount -a

# ============================================
# 3. Install Wazuh (All-in-One: Manager + Indexer + Dashboard)
# ============================================

echo "[$(date -Iseconds)] Installing Wazuh $WAZUH_VERSION (all-in-one)..."

# Download Wazuh installation assistant
curl -sO https://packages.wazuh.com/$${WAZUH_VERSION%%.*}.x/wazuh-install.sh
curl -sO https://packages.wazuh.com/$${WAZUH_VERSION%%.*}.x/config.yml

# Generate config.yml for single-node
cat > config.yml <<CONFIG
nodes:
  indexer:
    - name: wazuh-indexer
      ip: "127.0.0.1"
  server:
    - name: wazuh-server
      ip: "127.0.0.1"
  dashboard:
    - name: wazuh-dashboard
      ip: "127.0.0.1"
CONFIG

# Run installation
chmod +x wazuh-install.sh
./wazuh-install.sh --generate-config-files
./wazuh-install.sh --wazuh-indexer wazuh-indexer
./wazuh-install.sh --start-cluster
./wazuh-install.sh --wazuh-server wazuh-server
./wazuh-install.sh --wazuh-dashboard wazuh-dashboard

# Extract default credentials
tar -xvf wazuh-install-files.tar
WAZUH_ADMIN_PASS=$(cat wazuh-install-files/wazuh-passwords.txt | grep "indexer_username: 'admin'" -A 1 | tail -1 | awk '{print $2}' | tr -d "'")

echo "[$(date -Iseconds)] Wazuh installation completed."

# ============================================
# 4. Wazuh Manager Configuration
# ============================================

echo "[$(date -Iseconds)] Configuring Wazuh Manager..."

# Enable JSON output for structured logging
cat >> /var/ossec/etc/ossec.conf <<'OSSEC_EXTRA'
<!-- Structured JSON logging for observability -->
<ossec_config>
  <logging>
    <log_format>json</log_format>
  </logging>
  <global>
    <jsonout_output>yes</jsonout_output>
    <alerts_log>yes</alerts_log>
    <logall>no</logall>
    <logall_json>no</logall_json>
  </global>
</ossec_config>
OSSEC_EXTRA

# Restart manager with new config
systemctl restart wazuh-manager

# ============================================
# 5. Prometheus Node Exporter
# ============================================

echo "[$(date -Iseconds)] Installing Prometheus node_exporter v$NODE_EXPORTER_VERSION..."

useradd --no-create-home --shell /bin/false node_exporter || true

cd /tmp
curl -LO "https://github.com/prometheus/node_exporter/releases/download/v$NODE_EXPORTER_VERSION/node_exporter-$NODE_EXPORTER_VERSION.linux-amd64.tar.gz"
tar xzf "node_exporter-$NODE_EXPORTER_VERSION.linux-amd64.tar.gz"
cp "node_exporter-$NODE_EXPORTER_VERSION.linux-amd64/node_exporter" /usr/local/bin/
chown node_exporter:node_exporter /usr/local/bin/node_exporter

cat > /etc/systemd/system/node_exporter.service <<'NODEEXP'
[Unit]
Description=Prometheus Node Exporter
Documentation=https://prometheus.io/docs/guides/node-exporter/
After=network-online.target
Wants=network-online.target

[Service]
User=node_exporter
Group=node_exporter
Type=simple
ExecStart=/usr/local/bin/node_exporter \
  --collector.systemd \
  --collector.processes \
  --collector.filesystem.mount-points-exclude="^/(sys|proc|dev|run)($|/)" \
  --web.listen-address=:9100

Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
NODEEXP

systemctl daemon-reload
systemctl enable --now node_exporter

# ============================================
# 6. Wazuh Prometheus Exporter
# ============================================

echo "[$(date -Iseconds)] Installing Wazuh Prometheus exporter..."

useradd --no-create-home --shell /bin/false wazuh_exporter || true

# Build a simple exporter that queries Wazuh API and exposes metrics
mkdir -p /opt/wazuh-exporter
cat > /opt/wazuh-exporter/exporter.sh <<'EXPORTER'
#!/bin/bash
# Wazuh Prometheus Exporter - polls Wazuh API and serves metrics on :9101
set -euo pipefail

WAZUH_API="https://127.0.0.1:55000"
WAZUH_USER="wazuh"
WAZUH_PASS_FILE="/opt/wazuh-exporter/.api-pass"
LISTEN_PORT=9101
METRICS_FILE="/opt/wazuh-exporter/metrics.prom"

get_token() {
  local pass
  pass=$(cat "$WAZUH_PASS_FILE")
  curl -sk -u "$WAZUH_USER:$pass" -X POST "$WAZUH_API/security/user/authenticate" 2>/dev/null | jq -r '.data.token // empty'
}

collect_metrics() {
  local token
  token=$(get_token)
  if [ -z "$token" ]; then
    echo "# HELP wazuh_api_up Whether the Wazuh API is reachable"
    echo "# TYPE wazuh_api_up gauge"
    echo "wazuh_api_up 0"
    return
  fi

  local auth="Authorization: Bearer $token"

  echo "# HELP wazuh_api_up Whether the Wazuh API is reachable"
  echo "# TYPE wazuh_api_up gauge"
  echo "wazuh_api_up 1"

  # Agent stats
  local agents_json
  agents_json=$(curl -sk -H "$auth" "$WAZUH_API/agents/summary/status" 2>/dev/null)
  if [ -n "$agents_json" ]; then
    echo "# HELP wazuh_agents_total Total number of Wazuh agents by status"
    echo "# TYPE wazuh_agents_total gauge"
    for status in active disconnected never_connected pending; do
      count=$(echo "$agents_json" | jq -r ".data.connection.$status // 0")
      echo "wazuh_agents_total{status=\"$status\"} $count"
    done
    total=$(echo "$agents_json" | jq -r '.data.connection.total // 0')
    echo "wazuh_agents_total{status=\"total\"} $total"
  fi

  # Manager info
  local manager_json
  manager_json=$(curl -sk -H "$auth" "$WAZUH_API/manager/info" 2>/dev/null)
  if [ -n "$manager_json" ]; then
    echo "# HELP wazuh_manager_info Wazuh manager metadata"
    echo "# TYPE wazuh_manager_info gauge"
    local version
    version=$(echo "$manager_json" | jq -r '.data.affected_items[0].version // "unknown"')
    echo "wazuh_manager_info{version=\"$version\"} 1"
  fi

  # Manager stats
  local stats_json
  stats_json=$(curl -sk -H "$auth" "$WAZUH_API/manager/stats" 2>/dev/null)
  if [ -n "$stats_json" ]; then
    echo "# HELP wazuh_events_total Total events processed by the manager"
    echo "# TYPE wazuh_events_total gauge"
    local total_events
    total_events=$(echo "$stats_json" | jq '[.data.affected_items[].events // 0] | add // 0')
    echo "wazuh_events_total $total_events"

    echo "# HELP wazuh_alerts_total Total alerts generated"
    echo "# TYPE wazuh_alerts_total gauge"
    local total_alerts
    total_alerts=$(echo "$stats_json" | jq '[.data.affected_items[].alerts[].alerts // 0] | add // 0')
    echo "wazuh_alerts_total $total_alerts"
  fi

  # Vulnerability stats
  local vuln_json
  vuln_json=$(curl -sk -H "$auth" "$WAZUH_API/vulnerability" 2>/dev/null)
  if [ -n "$vuln_json" ]; then
    echo "# HELP wazuh_vulnerabilities_total Total vulnerabilities detected"
    echo "# TYPE wazuh_vulnerabilities_total gauge"
    local vuln_count
    vuln_count=$(echo "$vuln_json" | jq '.data.total_affected_items // 0')
    echo "wazuh_vulnerabilities_total $vuln_count"
  fi

  # Rules loaded
  local rules_json
  rules_json=$(curl -sk -H "$auth" "$WAZUH_API/rules" -d 'limit=1' 2>/dev/null)
  if [ -n "$rules_json" ]; then
    echo "# HELP wazuh_rules_loaded Total rules loaded in the manager"
    echo "# TYPE wazuh_rules_loaded gauge"
    local rules_total
    rules_total=$(echo "$rules_json" | jq '.data.total_affected_items // 0')
    echo "wazuh_rules_loaded $rules_total"
  fi

  # Indexer cluster health
  local health
  health=$(curl -sk -u admin:$(cat /opt/wazuh-exporter/.indexer-pass) "https://127.0.0.1:9200/_cluster/health" 2>/dev/null)
  if [ -n "$health" ]; then
    echo "# HELP wazuh_indexer_cluster_status Indexer cluster status (0=green, 1=yellow, 2=red)"
    echo "# TYPE wazuh_indexer_cluster_status gauge"
    local status_str
    status_str=$(echo "$health" | jq -r '.status // "unknown"')
    case "$status_str" in
      green) echo "wazuh_indexer_cluster_status 0" ;;
      yellow) echo "wazuh_indexer_cluster_status 1" ;;
      red) echo "wazuh_indexer_cluster_status 2" ;;
      *) echo "wazuh_indexer_cluster_status 3" ;;
    esac

    echo "# HELP wazuh_indexer_active_shards Active shards in the indexer"
    echo "# TYPE wazuh_indexer_active_shards gauge"
    local shards
    shards=$(echo "$health" | jq '.active_shards // 0')
    echo "wazuh_indexer_active_shards $shards"

    echo "# HELP wazuh_indexer_unassigned_shards Unassigned shards in the indexer"
    echo "# TYPE wazuh_indexer_unassigned_shards gauge"
    local unassigned
    unassigned=$(echo "$health" | jq '.unassigned_shards // 0')
    echo "wazuh_indexer_unassigned_shards $unassigned"
  fi

  # Disk usage for /var/ossec/data
  echo "# HELP wazuh_data_disk_used_bytes Bytes used on the Wazuh data volume"
  echo "# TYPE wazuh_data_disk_used_bytes gauge"
  local used_bytes
  used_bytes=$(df -B1 /var/ossec/data | tail -1 | awk '{print $3}')
  echo "wazuh_data_disk_used_bytes $used_bytes"

  echo "# HELP wazuh_data_disk_total_bytes Total bytes on the Wazuh data volume"
  echo "# TYPE wazuh_data_disk_total_bytes gauge"
  local total_bytes
  total_bytes=$(df -B1 /var/ossec/data | tail -1 | awk '{print $2}')
  echo "wazuh_data_disk_total_bytes $total_bytes"
}

# Serve metrics via socat on port 9101
while true; do
  collect_metrics > "$METRICS_FILE" 2>/dev/null || true
  sleep 30
done &

# Simple HTTP server
cd /opt/wazuh-exporter
python3 -c "
import http.server
import socketserver

class MetricsHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/metrics':
            try:
                with open('metrics.prom', 'r') as f:
                    content = f.read()
                self.send_response(200)
                self.send_header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
                self.end_headers()
                self.wfile.write(content.encode())
            except FileNotFoundError:
                self.send_response(503)
                self.end_headers()
        else:
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'Wazuh Exporter. /metrics for Prometheus.')
    def log_message(self, format, *args):
        pass

with socketserver.TCPServer(('', $LISTEN_PORT), MetricsHandler) as httpd:
    httpd.serve_forever()
"
EXPORTER

chmod +x /opt/wazuh-exporter/exporter.sh
chown -R wazuh_exporter:wazuh_exporter /opt/wazuh-exporter

cat > /etc/systemd/system/wazuh-exporter.service <<'WAZUHEXP'
[Unit]
Description=Wazuh Prometheus Exporter
Documentation=https://documentation.wazuh.com/
After=wazuh-manager.service network-online.target
Wants=network-online.target

[Service]
User=wazuh_exporter
Group=wazuh_exporter
Type=simple
ExecStart=/opt/wazuh-exporter/exporter.sh
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
WAZUHEXP

# Store API password for exporter (will be populated by SSM or manual setup)
echo "wazuh" > /opt/wazuh-exporter/.api-pass
echo "$WAZUH_ADMIN_PASS" > /opt/wazuh-exporter/.indexer-pass
chmod 600 /opt/wazuh-exporter/.api-pass /opt/wazuh-exporter/.indexer-pass
chown wazuh_exporter:wazuh_exporter /opt/wazuh-exporter/.api-pass /opt/wazuh-exporter/.indexer-pass

systemctl daemon-reload
systemctl enable --now wazuh-exporter

# ============================================
# 7. CloudWatch Agent for structured logs
# ============================================

echo "[$(date -Iseconds)] Installing CloudWatch agent..."

dnf install -y amazon-cloudwatch-agent || true

cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json <<CWAGENT
{
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/var/ossec/logs/alerts/alerts.json",
            "log_group_name": "/wazuh/${project_name}-${environment}",
            "log_stream_name": "alerts-{instance_id}",
            "retention_in_days": 90
          },
          {
            "file_path": "/var/ossec/logs/ossec.log",
            "log_group_name": "/wazuh/${project_name}-${environment}",
            "log_stream_name": "manager-{instance_id}",
            "retention_in_days": 90
          },
          {
            "file_path": "/var/log/wazuh-bootstrap.log",
            "log_group_name": "/wazuh/${project_name}-${environment}",
            "log_stream_name": "bootstrap-{instance_id}",
            "retention_in_days": 30
          }
        ]
      }
    }
  }
}
CWAGENT

systemctl enable --now amazon-cloudwatch-agent || true

# ============================================
# 8. Final Status
# ============================================

echo "[$(date -Iseconds)] Wazuh server bootstrap completed successfully."
echo "[$(date -Iseconds)] Services status:"
systemctl is-active wazuh-manager && echo "  wazuh-manager: running" || echo "  wazuh-manager: FAILED"
systemctl is-active wazuh-indexer && echo "  wazuh-indexer: running" || echo "  wazuh-indexer: FAILED"
systemctl is-active wazuh-dashboard && echo "  wazuh-dashboard: running" || echo "  wazuh-dashboard: FAILED"
systemctl is-active node_exporter && echo "  node_exporter: running" || echo "  node_exporter: FAILED"
systemctl is-active wazuh-exporter && echo "  wazuh-exporter: running" || echo "  wazuh-exporter: FAILED"

echo "[$(date -Iseconds)] Prometheus targets:"
echo "  node_exporter:  http://$(hostname -I | awk '{print $1}'):9100/metrics"
echo "  wazuh_exporter: http://$(hostname -I | awk '{print $1}'):9101/metrics"
echo "[$(date -Iseconds)] Wazuh Dashboard: https://$(hostname -I | awk '{print $1}'):443"
