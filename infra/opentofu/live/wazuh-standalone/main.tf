############################################
# Wazuh SIEM Server - Standalone Deploy
# Uses default VPC, local backend, no dependency on velya/lince state
############################################

terraform {
  required_version = ">= 1.4"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "local" {
    path = "terraform.tfstate"
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "opentofu"
      Service     = "wazuh-siem"
    }
  }
}

module "wazuh_server" {
  source = "../../modules/wazuh-server"

  project_name      = var.project_name
  environment       = var.environment
  vpc_id            = var.vpc_id
  subnet_id         = var.subnet_id
  availability_zone = var.availability_zone

  # Security
  allowed_cidrs           = var.allowed_cidrs
  dashboard_allowed_cidrs = var.dashboard_allowed_cidrs
  monitoring_cidrs        = var.monitoring_cidrs

  # Compute
  instance_type = var.instance_type
  key_pair_name = var.key_pair_name

  # Storage
  data_volume_size_gb    = var.data_volume_size_gb
  data_volume_throughput = 250
  data_volume_iops       = 3000

  # Wazuh
  wazuh_version = var.wazuh_version
}
