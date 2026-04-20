variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "velya"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "dev"
}

variable "region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}

variable "vpc_cidr" {
  description = "CIDR block for the shared VPC"
  type        = string
  default     = "10.40.0.0/16"
}

variable "availability_zones" {
  description = "Availability zones for the shared VPC subnets"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

variable "cluster_version" {
  description = "Kubernetes version for both EKS clusters"
  type        = string
  default     = "1.31"
}

variable "ecr_repository_names" {
  description = "Shared ECR repositories for both clusters"
  type        = list(string)
  default = [
    "velya/api-gateway",
    "velya/web-app",
    "velya/worker",
    "velya/ai-gateway",
    "velya/agent-orchestrator",
    "velya/autopilot-agents",
  ]
}
