terraform {
  backend "s3" {
    bucket         = "velya-dev-tfstate"
    key            = "dev/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "velya-dev-tflock"
    encrypt        = true
  }
}
