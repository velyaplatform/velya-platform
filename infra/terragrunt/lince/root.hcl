# ============================================
# Terragrunt Root - Lince AWS Account
# Account ID: 582381607124
# State bucket: lince-tfstate-582381607124-us-east-1
# Lock table:   lince-tfstate-lock
# ============================================

locals {
  env_vars = read_terragrunt_config(find_in_parent_folders("env.hcl"))

  project_name = "lince"
  environment  = local.env_vars.locals.environment
  region       = local.env_vars.locals.region
  account_id   = local.env_vars.locals.account_id
}

generate "provider" {
  path      = "provider.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<-EOF
    terraform {
      required_version = ">= 1.4"

      required_providers {
        aws = {
          source  = "hashicorp/aws"
          version = "~> 5.80"
        }
      }
    }

    provider "aws" {
      region = "${local.region}"

      allowed_account_ids = ["${local.account_id}"]

      default_tags {
        tags = {
          Project      = "${local.project_name}"
          Environment  = "${local.environment}"
          ManagedBy    = "opentofu"
          Orchestrator = "terragrunt"
        }
      }
    }
  EOF
}

remote_state {
  backend = "s3"
  config = {
    bucket         = "lince-tfstate-${local.account_id}-${local.region}"
    key            = "${path_relative_to_include()}/terraform.tfstate"
    region         = local.region
    encrypt        = true
    kms_key_id     = "arn:aws:kms:${local.region}:${local.account_id}:key/3294d44a-bbe2-4c7f-906d-4b38cfe0a15b"
    dynamodb_table = "lince-tfstate-lock"
  }
  generate = {
    path      = "backend.tf"
    if_exists = "overwrite_terragrunt"
  }
}

inputs = {
  project_name       = local.project_name
  environment        = local.environment
  trusted_account_id = local.account_id
}
