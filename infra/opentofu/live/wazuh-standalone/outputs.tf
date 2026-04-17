output "instance_id" {
  value = module.wazuh_server.instance_id
}

output "private_ip" {
  value = module.wazuh_server.private_ip
}

output "wazuh_dashboard_endpoint" {
  value = module.wazuh_server.wazuh_dashboard_endpoint
}

output "wazuh_api_endpoint" {
  value = module.wazuh_server.wazuh_api_endpoint
}

output "wazuh_manager_endpoint" {
  value = module.wazuh_server.wazuh_manager_endpoint
}

output "prometheus_targets" {
  value = module.wazuh_server.prometheus_targets
}

output "security_group_id" {
  value = module.wazuh_server.security_group_id
}
