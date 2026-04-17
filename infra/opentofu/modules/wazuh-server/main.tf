############################################
# Wazuh Server - EC2 Instance Module
# Single-node Wazuh Manager + Indexer + Dashboard
############################################

locals {
  name_prefix = "${var.project_name}-${var.environment}"
  server_name = "${local.name_prefix}-wazuh-server"

  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "opentofu"
    Module      = "wazuh-server"
    Service     = "siem"
  }
}

############################################
# Data Sources
############################################

data "aws_region" "current" {}

data "aws_caller_identity" "current" {}

# Amazon Linux 2023 AMI (latest)
data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }

  filter {
    name   = "architecture"
    values = ["x86_64"]
  }
}

############################################
# IAM Role for Wazuh EC2
############################################

resource "aws_iam_role" "wazuh" {
  name = "${local.server_name}-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy" "wazuh_secrets" {
  name = "${local.server_name}-secrets"
  role = aws_iam_role.wazuh.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ReadWazuhSecrets"
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret",
        ]
        Resource = "arn:aws:secretsmanager:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:secret:${var.project_name}/${var.environment}/wazuh/*"
      },
      {
        Sid    = "CloudWatchLogs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams",
        ]
        Resource = "arn:aws:logs:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:log-group:/wazuh/${local.name_prefix}*"
      },
      {
        Sid    = "EC2DescribeForAutoDiscovery"
        Effect = "Allow"
        Action = [
          "ec2:DescribeInstances",
          "ec2:DescribeTags",
        ]
        Resource = "*"
      },
    ]
  })
}

# SSM for remote management (no SSH needed)
resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.wazuh.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "wazuh" {
  name = "${local.server_name}-profile"
  role = aws_iam_role.wazuh.name

  tags = local.common_tags
}

############################################
# Security Group
############################################

resource "aws_security_group" "wazuh" {
  name_prefix = "${local.server_name}-"
  description = "Wazuh Server - Manager, Indexer, Dashboard"
  vpc_id      = local.resolved_vpc_id

  tags = merge(local.common_tags, {
    Name = "${local.server_name}-sg"
  })

  lifecycle {
    create_before_destroy = true
  }
}

# Wazuh Manager - Agent registration (TCP 1515)
resource "aws_security_group_rule" "agent_registration" {
  type              = "ingress"
  from_port         = 1515
  to_port           = 1515
  protocol          = "tcp"
  cidr_blocks       = var.allowed_cidrs
  security_group_id = aws_security_group.wazuh.id
  description       = "Wazuh agent registration"
}

# Wazuh Manager - Agent communication (TCP 1514)
resource "aws_security_group_rule" "agent_communication" {
  type              = "ingress"
  from_port         = 1514
  to_port           = 1514
  protocol          = "tcp"
  cidr_blocks       = var.allowed_cidrs
  security_group_id = aws_security_group.wazuh.id
  description       = "Wazuh agent event forwarding"
}

# Wazuh API (TCP 55000)
resource "aws_security_group_rule" "wazuh_api" {
  type              = "ingress"
  from_port         = 55000
  to_port           = 55000
  protocol          = "tcp"
  cidr_blocks       = var.allowed_cidrs
  security_group_id = aws_security_group.wazuh.id
  description       = "Wazuh REST API"
}

# Wazuh Dashboard (TCP 443)
resource "aws_security_group_rule" "dashboard" {
  type              = "ingress"
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  cidr_blocks       = var.dashboard_allowed_cidrs
  security_group_id = aws_security_group.wazuh.id
  description       = "Wazuh Dashboard HTTPS"
}

# Wazuh Indexer (TCP 9200) - internal only
resource "aws_security_group_rule" "indexer" {
  type              = "ingress"
  from_port         = 9200
  to_port           = 9200
  protocol          = "tcp"
  cidr_blocks       = var.allowed_cidrs
  security_group_id = aws_security_group.wazuh.id
  description       = "Wazuh Indexer (OpenSearch)"
}

# Prometheus node_exporter (TCP 9100)
resource "aws_security_group_rule" "node_exporter" {
  type              = "ingress"
  from_port         = 9100
  to_port           = 9100
  protocol          = "tcp"
  cidr_blocks       = var.monitoring_cidrs
  security_group_id = aws_security_group.wazuh.id
  description       = "Prometheus node_exporter"
}

# Prometheus wazuh_exporter (TCP 9101)
resource "aws_security_group_rule" "wazuh_exporter" {
  type              = "ingress"
  from_port         = 9101
  to_port           = 9101
  protocol          = "tcp"
  cidr_blocks       = var.monitoring_cidrs
  security_group_id = aws_security_group.wazuh.id
  description       = "Prometheus wazuh_exporter"
}

# Egress - all
resource "aws_security_group_rule" "egress" {
  type              = "egress"
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = aws_security_group.wazuh.id
  description       = "Allow all outbound"
}

############################################
# EBS Volume for Wazuh Data
############################################

resource "aws_ebs_volume" "wazuh_data" {
  availability_zone = var.availability_zone
  size              = var.data_volume_size_gb
  type              = "gp3"
  throughput        = var.data_volume_throughput
  iops              = var.data_volume_iops
  encrypted         = true

  tags = merge(local.common_tags, {
    Name = "${local.server_name}-data"
  })
}

############################################
# EC2 Instance
############################################

resource "aws_instance" "wazuh" {
  ami                    = var.ami_id != "" ? var.ami_id : data.aws_ami.al2023.id
  instance_type          = var.instance_type
  subnet_id              = local.resolved_subnet_id
  vpc_security_group_ids = [aws_security_group.wazuh.id]
  iam_instance_profile   = aws_iam_instance_profile.wazuh.name
  key_name               = var.key_pair_name != "" ? var.key_pair_name : null

  root_block_device {
    volume_type           = "gp3"
    volume_size           = 50
    encrypted             = true
    delete_on_termination = true

    tags = merge(local.common_tags, {
      Name = "${local.server_name}-root"
    })
  }

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required" # IMDSv2 only
    http_put_response_hop_limit = 1
  }

  user_data = base64encode(templatefile("${path.module}/templates/user-data.sh", {
    wazuh_version          = var.wazuh_version
    server_name            = local.server_name
    environment            = var.environment
    project_name           = var.project_name
    region                 = data.aws_region.current.id
    data_device            = "/dev/xvdf"
    node_exporter_version  = var.node_exporter_version
    wazuh_exporter_version = var.wazuh_exporter_version
    wazuh_api_port         = 55000
    indexer_port            = 9200
    dashboard_port          = 443
  }))

  tags = merge(local.common_tags, {
    Name = local.server_name
  })

  lifecycle {
    ignore_changes = [ami, user_data]
  }
}

############################################
# Attach Data Volume
############################################

resource "aws_volume_attachment" "wazuh_data" {
  device_name = "/dev/xvdf"
  volume_id   = aws_ebs_volume.wazuh_data.id
  instance_id = aws_instance.wazuh.id
}

############################################
# CloudWatch Log Group
############################################

resource "aws_cloudwatch_log_group" "wazuh" {
  name              = "/wazuh/${local.name_prefix}"
  retention_in_days = var.log_retention_days

  tags = local.common_tags
}

############################################
# SSM Parameter Store - Cross-stack references
############################################

resource "aws_ssm_parameter" "wazuh_private_ip" {
  name  = "/${var.project_name}/${var.environment}/wazuh/private-ip"
  type  = "String"
  value = aws_instance.wazuh.private_ip

  tags = local.common_tags
}

resource "aws_ssm_parameter" "wazuh_instance_id" {
  name  = "/${var.project_name}/${var.environment}/wazuh/instance-id"
  type  = "String"
  value = aws_instance.wazuh.id

  tags = local.common_tags
}
