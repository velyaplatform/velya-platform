# ============================================
# IAM Admin Switch Role - Lince Dev Account
#
# Creates an IAM role that any identity in the
# Lince account can assume via the console's
# "Switch Role" feature, avoiding day-to-day use
# of the root account.
#
# Permissions match claude-codex-automation user:
# managed policy AdministratorAccess.
# ============================================

include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "../../../../opentofu/modules/aws-iam-admin-switch-role"
}

inputs = {
  role_name            = "LinceAdminSwitchRole"
  max_session_duration = 14400 # 4h
  require_mfa          = false

  managed_policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"

  description = "Admin switch-role for the Lince AWS account. Avoids day-to-day use of the root account. Managed by OpenTofu + Terragrunt."

  extra_tags = {
    Component = "iam-admin-switch-role"
    Owner     = "platform"
    Purpose   = "console-admin-switch"
  }
}
