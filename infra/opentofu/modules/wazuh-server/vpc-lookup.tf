############################################
# VPC Lookup - Resolves VPC ID and subnet from tags
# Used when deploying standalone (without dependency chain)
############################################

# Look up VPC by project/environment tags if vpc_id not provided
data "aws_vpc" "lookup" {
  count = var.vpc_id == "" ? 1 : 0

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

# Look up private subnets if subnet_id not provided
data "aws_subnets" "private" {
  count = var.subnet_id == "" ? 1 : 0

  filter {
    name   = "vpc-id"
    values = [local.resolved_vpc_id]
  }

  tags = {
    Tier = "private"
  }
}

locals {
  resolved_vpc_id   = var.vpc_id != "" ? var.vpc_id : try(data.aws_vpc.lookup[0].id, "")
  resolved_subnet_id = var.subnet_id != "" ? var.subnet_id : try(data.aws_subnets.private[0].ids[0], "")
  resolved_vpc_cidr = var.vpc_id != "" ? "" : try(data.aws_vpc.lookup[0].cidr_block, "10.0.0.0/16")
}
