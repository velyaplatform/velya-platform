locals {
  principals = length(var.trusted_principal_arns) > 0 ? var.trusted_principal_arns : ["arn:aws:iam::${var.trusted_account_id}:root"]

  tags = merge(
    {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "opentofu"
      Component   = "iam-switch-role"
    },
    var.extra_tags,
  )
}

data "aws_iam_policy_document" "assume_role" {
  statement {
    sid     = "AllowSwitchRole"
    effect  = "Allow"
    actions = ["sts:AssumeRole", "sts:TagSession"]

    principals {
      type        = "AWS"
      identifiers = local.principals
    }

    dynamic "condition" {
      for_each = var.require_mfa ? [1] : []
      content {
        test     = "Bool"
        variable = "aws:MultiFactorAuthPresent"
        values   = ["true"]
      }
    }
  }
}

resource "aws_iam_role" "this" {
  name                 = var.role_name
  description          = var.description
  assume_role_policy   = data.aws_iam_policy_document.assume_role.json
  max_session_duration = var.max_session_duration
  tags                 = local.tags
}

resource "aws_iam_role_policy_attachment" "managed" {
  role       = aws_iam_role.this.name
  policy_arn = var.managed_policy_arn
}
