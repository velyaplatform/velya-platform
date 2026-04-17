# ============================================
# Wazuh Server - Dev Environment
# Terragrunt wrapper for the wazuh-server OpenTofu module
# ============================================

include "root" {
  path = find_in_parent_folders()
}

terraform {
  source = "../../../opentofu/modules/wazuh-server"
}

# Dependency: VPC must exist first (for vpc_id and subnet_ids)
dependency "vpc" {
  config_path = "../../../opentofu/live/dev"

  # Mock outputs for `terragrunt plan` when VPC hasn't been applied yet
  mock_outputs = {
    vpc_id             = "vpc-mock-12345"
    private_subnet_ids = ["subnet-mock-1a", "subnet-mock-1b", "subnet-mock-1c"]
    vpc_cidr_block     = "10.0.0.0/16"
  }
  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
}

inputs = {
  # Network - place in first private subnet
  vpc_id            = dependency.vpc.outputs.vpc_id
  subnet_id         = dependency.vpc.outputs.private_subnet_ids[0]
  availability_zone = "us-east-1a"

  # Security - allow VPC CIDR for agent communication
  allowed_cidrs           = [dependency.vpc.outputs.vpc_cidr_block]
  dashboard_allowed_cidrs = [dependency.vpc.outputs.vpc_cidr_block]
  monitoring_cidrs        = [dependency.vpc.outputs.vpc_cidr_block]

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
