output "vpc_id" {
  description = "ID of the dev VPC"
  value       = module.vpc.vpc_id
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = module.vpc.private_subnet_ids
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = module.vpc.public_subnet_ids
}

output "eks_cluster_endpoint" {
  description = "Endpoint for the EKS cluster API server"
  value       = module.eks.cluster_endpoint
}

output "eks_cluster_name" {
  description = "Name of the EKS cluster"
  value       = module.eks.cluster_name
}

output "eks_cluster_ca" {
  description = "Certificate authority data for the EKS cluster"
  value       = module.eks.cluster_ca
  sensitive   = true
}

output "eks_oidc_provider_arn" {
  description = "ARN of the EKS OIDC provider"
  value       = module.eks.oidc_provider_arn
}

output "ecr_repository_urls" {
  description = "URLs of the ECR repositories"
  value       = module.ecr.repository_urls
}

output "argocd_role_arn" {
  description = "ARN of the ArgoCD IAM role"
  value       = module.iam.argocd_role_arn
}

output "external_secrets_role_arn" {
  description = "ARN of the External Secrets IAM role"
  value       = module.iam.external_secrets_role_arn
}

output "keda_role_arn" {
  description = "ARN of the KEDA IAM role"
  value       = module.iam.keda_role_arn
}

# --- Wazuh SIEM ---

output "wazuh_private_ip" {
  description = "Private IP of the Wazuh SIEM server"
  value       = module.wazuh_server.private_ip
}

output "wazuh_instance_id" {
  description = "EC2 instance ID of the Wazuh server"
  value       = module.wazuh_server.instance_id
}

output "wazuh_dashboard_endpoint" {
  description = "Wazuh Dashboard URL (internal)"
  value       = module.wazuh_server.wazuh_dashboard_endpoint
}

output "wazuh_prometheus_targets" {
  description = "Prometheus scrape targets for the Wazuh server"
  value       = module.wazuh_server.prometheus_targets
}
