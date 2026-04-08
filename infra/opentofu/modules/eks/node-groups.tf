############################################
# EKS Node Groups
# Four specialized node groups for Velya tiers
############################################

# ============================================================================
# Node Group 1: Frontend Tier
# Purpose: Next.js web application and static assets
# Workload: Low CPU, low latency
# ============================================================================

resource "aws_eks_node_group" "frontend" {
  cluster_name    = aws_eks_cluster.this.name
  node_group_name = "${var.cluster_name}-frontend"
  node_role_arn   = aws_iam_role.node.arn
  subnet_ids      = var.subnet_ids

  scaling_config {
    desired_size = var.environment == "prod" ? 3 : 2
    max_size     = var.environment == "prod" ? 10 : 5
    min_size     = var.environment == "prod" ? 3 : 1
  }

  instance_types = ["t3.medium"]

  labels = {
    "velya.io/tier"      = "frontend"
    "velya.io/workload"  = "web"
    "velya.io/tier-name" = "Frontend Web Applications"
  }

  tags = merge(local.common_tags, {
    Name = "${var.cluster_name}-frontend-ng"
    Tier = "frontend"
  })

  # Do not apply taints - frontend can receive any pod
  # but we prefer to use nodeSelector to keep it clean

  depends_on = [aws_iam_role_policy_attachment.node_worker_policy]
}

# ============================================================================
# Node Group 2: Backend Tier
# Purpose: API Gateway, microservices, databases
# Workload: Moderate-high CPU, persistent connections
# ============================================================================

resource "aws_eks_node_group" "backend" {
  cluster_name    = aws_eks_cluster.this.name
  node_group_name = "${var.cluster_name}-backend"
  node_role_arn   = aws_iam_role.node.arn
  subnet_ids      = var.subnet_ids

  scaling_config {
    desired_size = var.environment == "prod" ? 3 : 2
    max_size     = var.environment == "prod" ? 15 : 8
    min_size     = var.environment == "prod" ? 3 : 1
  }

  instance_types = ["t3.large"]

  labels = {
    "velya.io/tier"      = "backend"
    "velya.io/workload"  = "api"
    "velya.io/tier-name" = "Backend API Services"
  }

  tags = merge(local.common_tags, {
    Name = "${var.cluster_name}-backend-ng"
    Tier = "backend"
  })

  # Do not apply taints - backend can receive any pod
  # but we prefer to use nodeSelector to keep it clean

  depends_on = [aws_iam_role_policy_attachment.node_worker_policy]
}

# ============================================================================
# Node Group 3: Platform Tools Tier
# Purpose: Infrastructure services (ArgoCD, Prometheus, Grafana, Loki)
# Workload: Variable, low priority, can be evicted
# Taint: platform=true:NoSchedule
# ============================================================================

resource "aws_eks_node_group" "platform" {
  cluster_name    = aws_eks_cluster.this.name
  node_group_name = "${var.cluster_name}-platform"
  node_role_arn   = aws_iam_role.node.arn
  subnet_ids      = var.subnet_ids

  scaling_config {
    desired_size = var.environment == "prod" ? 2 : 1
    max_size     = var.environment == "prod" ? 5 : 3
    min_size     = var.environment == "prod" ? 2 : 1
  }

  instance_types = ["t3.small"]

  labels = {
    "velya.io/tier"      = "platform"
    "velya.io/workload"  = "infra"
    "velya.io/tier-name" = "Platform Infrastructure"
  }

  tags = merge(local.common_tags, {
    Name = "${var.cluster_name}-platform-ng"
    Tier = "platform"
  })

  # Taint to prevent non-platform workloads from scheduling here
  # Only ArgoCD, Prometheus, Grafana, Loki, External Secrets should run here
  taint {
    key    = "velya.io/platform"
    value  = "true"
    effect = "NoSchedule"
  }

  depends_on = [aws_iam_role_policy_attachment.node_worker_policy]
}

# ============================================================================
# Node Group 4: AI/Agents Tier
# Purpose: Agent Orchestrator, AI Gateway, Model Router, specialized workloads
# Workload: CPU-intensive, variable load, GPU-optional
# Taint: ai-workload=true:NoSchedule
# Note: Can be upgraded to g4dn.xlarge for GPU inference
# ============================================================================

resource "aws_eks_node_group" "ai_agents" {
  cluster_name    = aws_eks_cluster.this.name
  node_group_name = "${var.cluster_name}-ai-agents"
  node_role_arn   = aws_iam_role.node.arn
  subnet_ids      = var.subnet_ids

  scaling_config {
    desired_size = var.environment == "prod" ? 2 : 1
    max_size     = var.environment == "prod" ? 10 : 5
    min_size     = var.environment == "prod" ? 2 : 1
  }

  # Use t3.large for CPU-based inference
  # For GPU inference, change to: ["g4dn.xlarge"]
  # For more powerful GPU: ["g4dn.2xlarge", "g4dn.12xlarge"]
  instance_types = var.environment == "prod" ? ["t3.large"] : ["t3.large"]

  labels = {
    "velya.io/tier"      = "ai"
    "velya.io/workload"  = "agents"
    "velya.io/tier-name" = "AI Agents and Inference"
  }

  tags = merge(local.common_tags, {
    Name = "${var.cluster_name}-ai-agents-ng"
    Tier = "ai"
  })

  # Taint to isolate AI/agent workloads
  # Only agent orchestrator, AI gateway, model router should run here
  taint {
    key    = "velya.io/ai-workload"
    value  = "true"
    effect = "NoSchedule"
  }

  depends_on = [aws_iam_role_policy_attachment.node_worker_policy]
}

# ============================================================================
# Outputs
# ============================================================================

output "node_group_frontend_name" {
  value       = aws_eks_node_group.frontend.node_group_name
  description = "Name of the frontend node group"
}

output "node_group_backend_name" {
  value       = aws_eks_node_group.backend.node_group_name
  description = "Name of the backend node group"
}

output "node_group_platform_name" {
  value       = aws_eks_node_group.platform.node_group_name
  description = "Name of the platform node group"
}

output "node_group_ai_agents_name" {
  value       = aws_eks_node_group.ai_agents.node_group_name
  description = "Name of the AI/agents node group"
}
