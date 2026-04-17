############################################
# ECR Event Bridge → GitHub Dispatch
# ADR-0017: Autonomous Maintenance Platform
#
# Captures ECR image push events and Inspector
# findings, forwards to GitHub via Lambda.
############################################

variable "project_name" {
  type    = string
  default = "velya"
}

variable "environment" {
  type    = string
  default = "dev"
}

variable "github_repo" {
  type        = string
  description = "GitHub repository (owner/repo format)"
}

variable "github_token_secret_arn" {
  type        = string
  description = "ARN of the Secrets Manager secret containing GitHub PAT"
}

variable "ecr_repository_names" {
  type        = list(string)
  description = "List of ECR repository names to monitor"
  default     = []
}

# --- EventBridge Rule: ECR Push ---
resource "aws_cloudwatch_event_rule" "ecr_push" {
  name        = "${var.project_name}-${var.environment}-ecr-push"
  description = "Capture ECR image push events for automated updates"

  event_pattern = jsonencode({
    source      = ["aws.ecr"]
    detail-type = ["ECR Image Action"]
    detail = {
      action-type     = ["PUSH"]
      result          = ["SUCCESS"]
      repository-name = var.ecr_repository_names
    }
  })

  tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "opentofu"
    Purpose     = "autonomous-maintenance"
  }
}

# --- EventBridge Rule: Inspector Finding ---
resource "aws_cloudwatch_event_rule" "inspector_finding" {
  name        = "${var.project_name}-${var.environment}-inspector-finding"
  description = "Capture Inspector vulnerability findings for automated remediation"

  event_pattern = jsonencode({
    source      = ["aws.inspector2"]
    detail-type = ["Inspector2 Finding"]
    detail = {
      severity = ["CRITICAL", "HIGH"]
    }
  })

  tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "opentofu"
    Purpose     = "autonomous-maintenance"
  }
}

# --- Lambda Function: GitHub Dispatcher ---
data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda_dispatcher" {
  name               = "${var.project_name}-${var.environment}-github-dispatcher"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json

  tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "opentofu"
  }
}

data "aws_iam_policy_document" "lambda_permissions" {
  statement {
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents"
    ]
    resources = ["arn:aws:logs:*:*:*"]
  }
  statement {
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [var.github_token_secret_arn]
  }
}

resource "aws_iam_role_policy" "lambda_permissions" {
  name   = "permissions"
  role   = aws_iam_role.lambda_dispatcher.id
  policy = data.aws_iam_policy_document.lambda_permissions.json
}

resource "aws_lambda_function" "github_dispatcher" {
  function_name = "${var.project_name}-${var.environment}-github-dispatcher"
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  role          = aws_iam_role.lambda_dispatcher.arn
  timeout       = 30
  memory_size   = 128

  filename         = "${path.module}/lambda/dispatcher.zip"
  source_code_hash = filebase64sha256("${path.module}/lambda/dispatcher.zip")

  environment {
    variables = {
      GITHUB_REPO            = var.github_repo
      GITHUB_TOKEN_SECRET_ID = var.github_token_secret_arn
    }
  }

  tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "opentofu"
    Purpose     = "autonomous-maintenance"
  }
}

# --- EventBridge Targets ---
resource "aws_cloudwatch_event_target" "ecr_push_lambda" {
  rule = aws_cloudwatch_event_rule.ecr_push.name
  arn  = aws_lambda_function.github_dispatcher.arn
  input_transformer {
    input_paths = {
      repo   = "$.detail.repository-name"
      tag    = "$.detail.image-tag"
      digest = "$.detail.image-digest"
    }
    input_template = <<-EOT
      {
        "event_type": "ecr-image-updated",
        "image_name": "<repo>",
        "image_tag": "<tag>",
        "image_digest": "<digest>"
      }
    EOT
  }
}

resource "aws_cloudwatch_event_target" "inspector_lambda" {
  rule = aws_cloudwatch_event_rule.inspector_finding.name
  arn  = aws_lambda_function.github_dispatcher.arn
  input_transformer {
    input_paths = {
      severity = "$.detail.severity"
      title    = "$.detail.title"
      resource = "$.detail.resources[0].id"
    }
    input_template = <<-EOT
      {
        "event_type": "inspector-finding",
        "severity": "<severity>",
        "title": "<title>",
        "resource": "<resource>"
      }
    EOT
  }
}

# --- Lambda Permissions for EventBridge ---
resource "aws_lambda_permission" "ecr_push" {
  statement_id  = "AllowEventBridgeECRPush"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.github_dispatcher.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.ecr_push.arn
}

resource "aws_lambda_permission" "inspector_finding" {
  statement_id  = "AllowEventBridgeInspector"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.github_dispatcher.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.inspector_finding.arn
}

# --- Outputs ---
output "lambda_function_arn" {
  value = aws_lambda_function.github_dispatcher.arn
}

output "ecr_push_rule_arn" {
  value = aws_cloudwatch_event_rule.ecr_push.arn
}

output "inspector_rule_arn" {
  value = aws_cloudwatch_event_rule.inspector_finding.arn
}
