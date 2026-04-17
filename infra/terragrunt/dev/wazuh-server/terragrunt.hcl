# ============================================
# Wazuh Server - Dev Environment
# Terragrunt wrapper for the wazuh-server OpenTofu module
# ============================================

include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "../../../opentofu/modules/wazuh-server"

  # Add a data source wrapper to look up VPC by tag
  # This avoids coupling to the live/dev Terragrunt state
  extra_arguments "vpc_lookup" {
    commands = get_terraform_commands_that_need_vars()
  }
}

inputs = {
  # Network - auto-resolved via VPC tags (Project=velya, Environment=dev)
  # Override with env vars if needed: TG_WAZUH_VPC_ID, TG_WAZUH_SUBNET_ID
  vpc_id            = get_env("TG_WAZUH_VPC_ID", "")  # empty = auto-lookup
  subnet_id         = get_env("TG_WAZUH_SUBNET_ID", "") # empty = auto-lookup
  availability_zone = "us-east-1a"

  # Security - allow full VPC CIDR for agent/dashboard/monitoring communication
  allowed_cidrs           = ["10.0.0.0/16"]
  dashboard_allowed_cidrs = ["10.0.0.0/16"]
  monitoring_cidrs        = ["10.0.0.0/16"]

  # Compute - t3.xlarge for dev (4 vCPU, 16 GB RAM)
  instance_type = "t3.xlarge"
  key_pair_name = "" # SSM-only access, no SSH

  # Storage
  data_volume_size_gb    = 100
  data_volume_throughput = 250
  data_volume_iops       = 3000

  # Wazuh - pinned version
  wazuh_version = "4.9.2"

  # Observability
  node_exporter_version  = "1.8.2"
  wazuh_exporter_version = "0.4.0"
  log_retention_days     = 90
}
