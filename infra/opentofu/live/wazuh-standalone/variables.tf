variable "project_name" {
  type    = string
  default = "wazuh"
}

variable "environment" {
  type    = string
  default = "prod"
}

variable "region" {
  type    = string
  default = "us-east-1"
}

# Default VPC
variable "vpc_id" {
  type    = string
  default = "vpc-0f1a5d064dacdb713"
}

variable "subnet_id" {
  type    = string
  default = "subnet-09d9365b567b8c9a8" # us-east-1a, public
}

variable "availability_zone" {
  type    = string
  default = "us-east-1a"
}

variable "allowed_cidrs" {
  type    = list(string)
  default = ["172.31.0.0/16"] # Default VPC CIDR
}

variable "dashboard_allowed_cidrs" {
  type    = list(string)
  default = ["0.0.0.0/0"] # Dashboard accessible (HTTPS/443)
}

variable "monitoring_cidrs" {
  type    = list(string)
  default = ["172.31.0.0/16"]
}

variable "instance_type" {
  type    = string
  default = "t3.xlarge"
}

variable "key_pair_name" {
  type    = string
  default = ""
}

variable "data_volume_size_gb" {
  type    = number
  default = 100
}

variable "wazuh_version" {
  type    = string
  default = "4.9.2"
}
