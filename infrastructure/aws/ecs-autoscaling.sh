#!/bin/bash
# =============================================================================
# ECS Fargate Autoscaling Configuration
# =============================================================================
#
# This script configures autoscaling for the ECS service.
# Run after creating the ECS cluster and service.
#
# Prerequisites:
# - AWS CLI configured with appropriate permissions
# - ECS cluster and service already created
#
# Usage:
#   ./ecs-autoscaling.sh
#
# =============================================================================

set -euo pipefail

# Configuration
CLUSTER_NAME="secure-auth-cluster"
SERVICE_NAME="secure-auth-service"
REGION="${AWS_REGION:-eu-north-1}"

# Scaling parameters
MIN_CAPACITY=2
MAX_CAPACITY=10
CPU_TARGET=70
SCALE_OUT_COOLDOWN=60   # seconds to wait before scaling out again
SCALE_IN_COOLDOWN=300   # seconds to wait before scaling in (prevent flapping)

echo "🚀 Configuring ECS autoscaling for ${SERVICE_NAME}..."

# =============================================================================
# Step 1: Register scalable target
# =============================================================================
echo "📋 Registering scalable target..."

aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --resource-id "service/${CLUSTER_NAME}/${SERVICE_NAME}" \
  --scalable-dimension ecs:service:DesiredCount \
  --min-capacity ${MIN_CAPACITY} \
  --max-capacity ${MAX_CAPACITY} \
  --region ${REGION}

echo "✅ Scalable target registered (min: ${MIN_CAPACITY}, max: ${MAX_CAPACITY})"

# =============================================================================
# Step 2: Create CPU-based scaling policy
# =============================================================================
echo "📋 Creating CPU scaling policy..."

aws application-autoscaling put-scaling-policy \
  --service-namespace ecs \
  --resource-id "service/${CLUSTER_NAME}/${SERVICE_NAME}" \
  --scalable-dimension ecs:service:DesiredCount \
  --policy-name "${SERVICE_NAME}-cpu-scaling" \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration "{
    \"TargetValue\": ${CPU_TARGET}.0,
    \"PredefinedMetricSpecification\": {
      \"PredefinedMetricType\": \"ECSServiceAverageCPUUtilization\"
    },
    \"ScaleInCooldown\": ${SCALE_IN_COOLDOWN},
    \"ScaleOutCooldown\": ${SCALE_OUT_COOLDOWN}
  }" \
  --region ${REGION}

echo "✅ CPU scaling policy created (target: ${CPU_TARGET}%)"

# =============================================================================
# Step 3: Create Memory-based scaling policy
# =============================================================================
echo "📋 Creating Memory scaling policy..."

aws application-autoscaling put-scaling-policy \
  --service-namespace ecs \
  --resource-id "service/${CLUSTER_NAME}/${SERVICE_NAME}" \
  --scalable-dimension ecs:service:DesiredCount \
  --policy-name "${SERVICE_NAME}-memory-scaling" \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration "{
    \"TargetValue\": 80.0,
    \"PredefinedMetricSpecification\": {
      \"PredefinedMetricType\": \"ECSServiceAverageMemoryUtilization\"
    },
    \"ScaleInCooldown\": ${SCALE_IN_COOLDOWN},
    \"ScaleOutCooldown\": ${SCALE_OUT_COOLDOWN}
  }" \
  --region ${REGION}

echo "✅ Memory scaling policy created (target: 80%)"

# =============================================================================
# Step 4: Verify configuration
# =============================================================================
echo ""
echo "📊 Current autoscaling configuration:"

aws application-autoscaling describe-scalable-targets \
  --service-namespace ecs \
  --resource-ids "service/${CLUSTER_NAME}/${SERVICE_NAME}" \
  --region ${REGION} \
  --output table

echo ""
echo "📊 Scaling policies:"

aws application-autoscaling describe-scaling-policies \
  --service-namespace ecs \
  --resource-id "service/${CLUSTER_NAME}/${SERVICE_NAME}" \
  --region ${REGION} \
  --query 'ScalingPolicies[*].{Name:PolicyName,Type:PolicyType,Target:TargetTrackingScalingPolicyConfiguration.TargetValue}' \
  --output table

echo ""
echo "✅ Autoscaling configuration complete!"
echo ""
echo "📌 Summary:"
echo "   - Min tasks: ${MIN_CAPACITY}"
echo "   - Max tasks: ${MAX_CAPACITY}"
echo "   - CPU target: ${CPU_TARGET}%"
echo "   - Memory target: 80%"
echo "   - Scale out cooldown: ${SCALE_OUT_COOLDOWN}s"
echo "   - Scale in cooldown: ${SCALE_IN_COOLDOWN}s"
