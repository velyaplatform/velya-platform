############################################
# Wazuh Server Module - Variables
############################################

# --- Project ---

variable "project_name" {
  description = "Name of the project, used for resource naming and tagging"
  type        = string

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{1,28}[a-z0-9]$", var.project_name))
    error_message = "Project name must be 3-30 characters, lowercase alphanumeric and hyphens."
  }
}

variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

# --- Network ---

variable "vpc_id" {
  description = "VPC ID where the Wazuh server will be deployed (empty = auto-lookup by project/environment tags)"
  type        = string
  default     = ""
}

variable "subnet_id" {
  description = "Subnet ID for the Wazuh server (empty = auto-lookup first private subnet in VPC)"
  type        = string
  default     = ""
}

variable "availability_zone" {
  description = "Availability zone for the EBS data volume (must match subnet AZ)"
  type        = string
}

variable "allowed_cidrs" {
  description = "CIDR blocks allowed to reach Wazuh manager ports (agents, API, indexer)"
  type        = list(string)

  validation {
    condition     = length(var.allowed_cidrs) > 0
    error_message = "At least one CIDR block must be specified for agent communication."
  }
}

variable "dashboard_allowed_cidrs" {
  description = "CIDR blocks allowed to reach the Wazuh Dashboard (HTTPS 443)"
  type        = list(string)
  default     = []
}

variable "monitoring_cidrs" {
  description = "CIDR blocks allowed to scrape Prometheus exporters (9100, 9101)"
  type        = list(string)
  default     = []
}

# --- Compute ---

variable "instance_type" {
  description = "EC2 instance type for the Wazuh server"
  type        = string
  default     = "t3.xlarge"
}

variable "ami_id" {
  description = "Specific AMI ID to use (empty = latest Amazon Linux 2023)"
  type        = string
  default     = ""
}

variable "key_pair_name" {
  description = "EC2 key pair name for SSH access (empty = SSM only, recommended)"
  type        = string
  default     = ""
}

# --- Storage ---

variable "data_volume_size_gb" {
  description = "Size of the Wazuh data EBS volume in GB"
  type        = number
  default     = 100

  validation {
    condition     = var.data_volume_size_gb >= 50
    error_message = "Wazuh data volume must be at least 50 GB."
  }
}

variable "data_volume_throughput" {
  description = "Throughput for gp3 data volume in MiB/s"
  type        = number
  default     = 250
}

variable "data_volume_iops" {
  description = "IOPS for gp3 data volume"
  type        = number
  default     = 3000
}

# --- Wazuh ---

variable "wazuh_version" {
  description = "Wazuh version to install (pinned, no latest)"
  type        = string
  default     = "4.9.2"

  validation {
    condition     = can(regex("^[0-9]+\\.[0-9]+\\.[0-9]+$", var.wazuh_version))
    error_message = "Wazuh version must be a semantic version (e.g., 4.9.2)."
  }
}

# --- Observability ---

variable "node_exporter_version" {
  description = "Prometheus node_exporter version"
  type        = string
  default     = "1.8.2"
}

variable "wazuh_exporter_version" {
  description = "Prometheus wazuh_exporter version"
  type        = string
  default     = "0.4.0"
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 90
}
