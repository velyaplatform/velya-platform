############################################
# Velya Platform - Dev Environment
############################################

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
    }
  }
}

locals {
  cluster_name = "${var.project_name}-${var.environment}"
}

############################################
# VPC
############################################

module "vpc" {
  source = "../../modules/vpc"

  project_name       = var.project_name
  environment        = var.environment
  vpc_cidr           = var.vpc_cidr
  availability_zones = var.availability_zones
  single_nat_gateway = true
  cluster_name       = local.cluster_name
}

############################################
# EKS
############################################

module "eks" {
  source = "../../modules/eks"

  cluster_name    = local.cluster_name
  cluster_version = var.cluster_version
  vpc_id          = module.vpc.vpc_id
  subnet_ids      = module.vpc.private_subnet_ids
  environment     = var.environment
  project_name    = var.project_name

  endpoint_public_access       = true
  endpoint_public_access_cidrs = ["0.0.0.0/0"]
}

############################################
# ECR
############################################

module "ecr" {
  source = "../../modules/ecr"

  project_name     = var.project_name
  environment      = var.environment
  repository_names = var.ecr_repository_names
}

############################################
# IAM (IRSA roles for platform services)
############################################

module "iam" {
  source = "../../modules/iam"

  project_name      = var.project_name
  environment       = var.environment
  oidc_provider_arn = module.eks.oidc_provider_arn
  oidc_provider_url = module.eks.oidc_provider_url
  ecr_repository_arns = values(module.ecr.repository_arns)

  secrets_manager_secret_arns = [
    "arn:aws:secretsmanager:${var.region}:*:secret:${var.project_name}/${var.environment}/*"
  ]
}
