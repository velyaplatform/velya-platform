# ============================================
# Terragrunt Root Configuration
# Velya Platform - DRY infrastructure management
# ============================================

locals {
  # Parse environment from directory path
  env_vars = read_terragrunt_config(find_in_parent_folders("env.hcl"))

  project_name = "velya"
  environment  = local.env_vars.locals.environment
  region       = local.env_vars.locals.region
}

# Generate the provider block
generate "provider" {
  path      = "provider.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<-EOF
    terraform {
      required_version = ">= 1.9"

      required_providers {
        aws = {
          source  = "hashicorp/aws"
          version = "~> 5.80"
        }
      }
    }

    provider "aws" {
      region = "${local.region}"

      default_tags {
        tags = {
          Project     = "${local.project_name}"
          Environment = "${local.environment}"
          ManagedBy   = "opentofu"
          Orchestrator = "terragrunt"
        }
      }
    }
  EOF
}

# Remote state configuration - S3 + DynamoDB
remote_state {
  backend = "s3"
  config = {
    bucket         = "${local.project_name}-${local.environment}-tfstate"
    key            = "${path_relative_to_include()}/terraform.tfstate"
    region         = local.region
    encrypt        = true
    dynamodb_table = "${local.project_name}-${local.environment}-tflock"
  }
  generate = {
    path      = "backend.tf"
    if_exists = "overwrite_terragrunt"
  }
}

# Common inputs for all modules
inputs = {
  project_name = local.project_name
  environment  = local.environment
}
