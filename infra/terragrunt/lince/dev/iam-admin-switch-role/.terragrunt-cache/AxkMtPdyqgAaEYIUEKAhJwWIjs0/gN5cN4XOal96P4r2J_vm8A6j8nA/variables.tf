variable "project_name" {
  type        = string
  description = "Project tag for AWS resources."
}

variable "environment" {
  type        = string
  description = "Environment (dev | staging | prod)."
}

variable "role_name" {
  type        = string
  description = "Name of the IAM switch role."
}

variable "trusted_account_id" {
  type        = string
  description = "AWS account ID whose principals are allowed to assume this role."
}

variable "trusted_principal_arns" {
  type        = list(string)
  description = "Explicit IAM user/role ARNs allowed to assume. When empty, falls back to the account root principal, which lets any identity in the account that has sts:AssumeRole permission assume the role."
  default     = []
}

variable "require_mfa" {
  type        = bool
  description = "When true, the trust policy requires MFA to be present."
  default     = false
}

variable "max_session_duration" {
  type        = number
  description = "Maximum session duration in seconds (3600 to 43200)."
  default     = 14400
}

variable "managed_policy_arn" {
  type        = string
  description = "Managed policy ARN to attach to the role. Defaults to AWS AdministratorAccess."
  default     = "arn:aws:iam::aws:policy/AdministratorAccess"
}

variable "description" {
  type        = string
  description = "Role description shown in the IAM console."
  default     = "Switch-role for console administration. Provisioned by OpenTofu + Terragrunt."
}

variable "extra_tags" {
  type        = map(string)
  description = "Additional tags merged on top of the standard project/environment tags."
  default     = {}
}
