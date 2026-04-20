output "vpc_id" {
  description = "ID of the shared VPC for both clusters"
  value       = module.vpc.vpc_id
}

output "hospitalar_cluster_name" {
  description = "Name of the Velya Hospitalar EKS cluster"
  value       = module.eks_hospitalar.cluster_name
}

output "hospitalar_cluster_endpoint" {
  description = "Private API endpoint for the hospital cluster"
  value       = module.eks_hospitalar.cluster_endpoint
}

output "opensquad_cluster_name" {
  description = "Name of the Opensquad/Autopilot EKS cluster"
  value       = module.eks_opensquad.cluster_name
}

output "opensquad_cluster_endpoint" {
  description = "Private API endpoint for the opensquad cluster"
  value       = module.eks_opensquad.cluster_endpoint
}

output "hospitalar_argocd_role_arn" {
  description = "IRSA role for ArgoCD in the hospital cluster"
  value       = module.iam_hospitalar.argocd_role_arn
}

output "opensquad_argocd_role_arn" {
  description = "IRSA role for ArgoCD in the opensquad cluster"
  value       = module.iam_opensquad.argocd_role_arn
}

output "ecr_repository_urls" {
  description = "Shared ECR repository URLs used by both clusters"
  value       = module.ecr.repository_urls
}
