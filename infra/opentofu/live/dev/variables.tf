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
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "Availability zones for the VPC subnets"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

variable "cluster_version" {
  description = "Kubernetes version for EKS"
  type        = string
  default     = "1.31"
}

variable "ecr_repository_names" {
  description = "List of ECR repository names for Velya services"
  type        = list(string)
  default = [
    "velya/api-gateway",
    "velya/web-app",
    "velya/worker",
  ]
}
