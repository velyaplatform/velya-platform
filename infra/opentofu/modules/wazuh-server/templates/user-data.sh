#!/bin/bash
set -euo pipefail
exec > >(tee /var/log/wazuh-bootstrap.log) 2>&1
echo "[$(date -Iseconds)] Starting Wazuh bootstrap — ${server_name}"

WAZUH_VERSION="${wazuh_version}"
DATA_DEVICE="${data_device}"

# System prep
hostnamectl set-hostname "${server_name}"
dnf update -y
dnf install -y jq curl tar gzip openssl

# Kernel tuning for OpenSearch
echo "vm.max_map_count=262144" >> /etc/sysctl.conf && sysctl -p

# Data volume
while [ ! -b "$DATA_DEVICE" ]; do sleep 5; done
blkid "$DATA_DEVICE" | grep -q ext4 || mkfs.ext4 -L wazuh-data "$DATA_DEVICE"
mkdir -p /var/ossec/data
echo "LABEL=wazuh-data /var/ossec/data ext4 defaults,noatime 0 2" >> /etc/fstab
mount -a

# Install Wazuh all-in-one
curl -sO "https://packages.wazuh.com/$${WAZUH_VERSION%%.*}.x/wazuh-install.sh"
cat > config.yml <<'CONF'
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
CONF
chmod +x wazuh-install.sh
./wazuh-install.sh --generate-config-files
./wazuh-install.sh --wazuh-indexer wazuh-indexer
./wazuh-install.sh --start-cluster
./wazuh-install.sh --wazuh-server wazuh-server
./wazuh-install.sh --wazuh-dashboard wazuh-dashboard

# Node exporter
useradd --no-create-home --shell /bin/false node_exporter || true
NE_VER="${node_exporter_version}"
cd /tmp && curl -LO "https://github.com/prometheus/node_exporter/releases/download/v$NE_VER/node_exporter-$NE_VER.linux-amd64.tar.gz"
tar xzf "node_exporter-$NE_VER.linux-amd64.tar.gz"
cp "node_exporter-$NE_VER.linux-amd64/node_exporter" /usr/local/bin/
chown node_exporter:node_exporter /usr/local/bin/node_exporter
cat > /etc/systemd/system/node_exporter.service <<'SVC'
[Unit]
Description=Node Exporter
After=network.target
[Service]
User=node_exporter
ExecStart=/usr/local/bin/node_exporter --collector.systemd --collector.processes --web.listen-address=:9100
Restart=always
[Install]
WantedBy=multi-user.target
SVC
systemctl daemon-reload && systemctl enable --now node_exporter

echo "[$(date -Iseconds)] Bootstrap complete."
echo "Dashboard: https://$(hostname -I | awk '{print $1}'):443"
