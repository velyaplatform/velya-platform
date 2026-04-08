project_name       = "velya"
environment        = "dev"
region             = "us-east-1"
vpc_cidr           = "10.0.0.0/16"
availability_zones = ["us-east-1a", "us-east-1b", "us-east-1c"]
cluster_version    = "1.31"

ecr_repository_names = [
  "velya/api-gateway",
  "velya/web-app",
  "velya/worker",
]
