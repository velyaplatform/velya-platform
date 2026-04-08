############################################
# ECR Module
# Container image repositories for Velya services
############################################

variable "repository_names" {
  description = "List of ECR repository names to create"
  type        = list(string)

  validation {
    condition     = length(var.repository_names) > 0
    error_message = "At least one repository name must be provided."
  }

  validation {
    condition     = alltrue([for name in var.repository_names : can(regex("^[a-z][a-z0-9._/-]{1,254}$", name))])
    error_message = "Repository names must be lowercase, 2-255 characters, and may contain letters, numbers, dots, hyphens, underscores, and forward slashes."
  }
}

variable "project_name" {
  description = "Name of the project for tagging"
  type        = string
}

variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "image_tag_mutability" {
  description = "Tag mutability setting for the repositories (MUTABLE or IMMUTABLE)"
  type        = string
  default     = "IMMUTABLE"

  validation {
    condition     = contains(["MUTABLE", "IMMUTABLE"], var.image_tag_mutability)
    error_message = "Image tag mutability must be MUTABLE or IMMUTABLE."
  }
}

variable "max_image_count" {
  description = "Maximum number of images to retain per repository"
  type        = number
  default     = 30

  validation {
    condition     = var.max_image_count >= 1 && var.max_image_count <= 1000
    error_message = "Max image count must be between 1 and 1000."
  }
}

locals {
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "opentofu"
    Module      = "ecr"
  }
}

resource "aws_ecr_repository" "this" {
  for_each = toset(var.repository_names)

  name                 = each.value
  image_tag_mutability = var.image_tag_mutability
  force_delete         = var.environment == "dev" ? true : false

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = merge(local.common_tags, {
    Name = each.value
  })
}

resource "aws_ecr_lifecycle_policy" "this" {
  for_each = toset(var.repository_names)

  repository = aws_ecr_repository.this[each.key].name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last ${var.max_image_count} images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = var.max_image_count
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

output "repository_urls" {
  description = "Map of repository names to their URLs"
  value       = { for name, repo in aws_ecr_repository.this : name => repo.repository_url }
}

output "repository_arns" {
  description = "Map of repository names to their ARNs"
  value       = { for name, repo in aws_ecr_repository.this : name => repo.arn }
}
