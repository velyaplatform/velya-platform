############################################
# Wazuh Server Module - Outputs
############################################

output "instance_id" {
  description = "EC2 instance ID of the Wazuh server"
  value       = aws_instance.wazuh.id
}

output "private_ip" {
  description = "Private IP address of the Wazuh server"
  value       = aws_instance.wazuh.private_ip
}

output "security_group_id" {
  description = "Security group ID attached to the Wazuh server"
  value       = aws_security_group.wazuh.id
}

output "iam_role_arn" {
  description = "IAM role ARN of the Wazuh server"
  value       = aws_iam_role.wazuh.arn
}

output "iam_instance_profile_name" {
  description = "IAM instance profile name"
  value       = aws_iam_instance_profile.wazuh.name
}

output "data_volume_id" {
  description = "EBS volume ID for Wazuh data"
  value       = aws_ebs_volume.wazuh_data.id
}

output "cloudwatch_log_group_name" {
  description = "CloudWatch log group for Wazuh logs"
  value       = aws_cloudwatch_log_group.wazuh.name
}

output "wazuh_manager_endpoint" {
  description = "Wazuh manager endpoint for agent registration (private IP:1514)"
  value       = "${aws_instance.wazuh.private_ip}:1514"
}

output "wazuh_api_endpoint" {
  description = "Wazuh REST API endpoint"
  value       = "https://${aws_instance.wazuh.private_ip}:55000"
}

output "wazuh_dashboard_endpoint" {
  description = "Wazuh Dashboard endpoint"
  value       = "https://${aws_instance.wazuh.private_ip}:443"
}

output "prometheus_targets" {
  description = "Prometheus scrape targets for this Wazuh server"
  value = {
    node_exporter  = "${aws_instance.wazuh.private_ip}:9100"
    wazuh_exporter = "${aws_instance.wazuh.private_ip}:9101"
  }
}

output "ssm_parameter_private_ip" {
  description = "SSM parameter name storing the Wazuh private IP"
  value       = aws_ssm_parameter.wazuh_private_ip.name
}
