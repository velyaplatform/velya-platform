terraform {
  required_version = ">= 1.9"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.80"
    }
    null = {
      source  = "hashicorp/null"
      version = "~> 3.2"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "opentofu"
      Topology    = "segregated-dual-cluster"
    }
  }
}

locals {
  hospital_cluster_name  = "${var.project_name}-hospitalar-${var.environment}"
  opensquad_cluster_name = "${var.project_name}-opensquad-${var.environment}"
}

module "vpc" {
  source = "../../modules/vpc"

  project_name       = var.project_name
  environment        = var.environment
  vpc_cidr           = var.vpc_cidr
  availability_zones = var.availability_zones
  single_nat_gateway = true
  cluster_names = [
    local.hospital_cluster_name,
    local.opensquad_cluster_name,
  ]
}

module "eks_hospitalar" {
  source = "../../modules/eks"

  cluster_name    = local.hospital_cluster_name
  cluster_version = var.cluster_version
  vpc_id          = module.vpc.vpc_id
  subnet_ids      = module.vpc.private_subnet_ids
  environment     = var.environment
  project_name    = var.project_name

  endpoint_public_access       = false
  endpoint_public_access_cidrs = []
  auto_mode_node_pools         = ["general-purpose"]

  enable_frontend_node_group  = true
  enable_backend_node_group   = true
  enable_platform_node_group  = true
  enable_ai_agents_node_group = false
}

module "eks_opensquad" {
  source = "../../modules/eks"

  cluster_name    = local.opensquad_cluster_name
  cluster_version = var.cluster_version
  vpc_id          = module.vpc.vpc_id
  subnet_ids      = module.vpc.private_subnet_ids
  environment     = var.environment
  project_name    = var.project_name

  endpoint_public_access       = false
  endpoint_public_access_cidrs = []
  auto_mode_node_pools         = ["general-purpose"]

  enable_frontend_node_group  = false
  enable_backend_node_group   = false
  enable_platform_node_group  = true
  enable_ai_agents_node_group = true
}

module "ecr" {
  source = "../../modules/ecr"

  project_name     = var.project_name
  environment      = var.environment
  repository_names = var.ecr_repository_names
}

module "iam_hospitalar" {
  source = "../../modules/iam"

  project_name        = var.project_name
  environment         = var.environment
  name_suffix         = "hospitalar"
  oidc_provider_arn   = module.eks_hospitalar.oidc_provider_arn
  oidc_provider_url   = module.eks_hospitalar.oidc_provider_url
  ecr_repository_arns = values(module.ecr.repository_arns)

  secrets_manager_secret_arns = [
    "arn:aws:secretsmanager:${var.region}:*:secret:${var.project_name}/${var.environment}/hospitalar/*"
  ]
}

module "iam_opensquad" {
  source = "../../modules/iam"

  project_name        = var.project_name
  environment         = var.environment
  name_suffix         = "opensquad"
  oidc_provider_arn   = module.eks_opensquad.oidc_provider_arn
  oidc_provider_url   = module.eks_opensquad.oidc_provider_url
  ecr_repository_arns = values(module.ecr.repository_arns)

  secrets_manager_secret_arns = [
    "arn:aws:secretsmanager:${var.region}:*:secret:${var.project_name}/${var.environment}/opensquad/*"
  ]
}
