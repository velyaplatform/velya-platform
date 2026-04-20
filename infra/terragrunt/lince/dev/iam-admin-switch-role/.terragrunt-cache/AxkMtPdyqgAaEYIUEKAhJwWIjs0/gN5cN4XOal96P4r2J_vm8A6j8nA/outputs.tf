output "role_arn" {
  description = "ARN of the IAM switch role."
  value       = aws_iam_role.this.arn
}

output "role_name" {
  description = "Name of the IAM switch role."
  value       = aws_iam_role.this.name
}

output "switch_role_console_url" {
  description = "Direct AWS console URL to switch into this role."
  value       = "https://signin.aws.amazon.com/switchrole?roleName=${aws_iam_role.this.name}&account=${var.trusted_account_id}&displayName=${replace(aws_iam_role.this.name, "/[^A-Za-z0-9]+/", "+")}"
}
