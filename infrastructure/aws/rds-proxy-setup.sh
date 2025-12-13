#!/bin/bash
# =============================================================================
# RDS Proxy Setup for Connection Pooling
# =============================================================================
#
# This script creates an RDS Proxy for managed connection pooling.
# RDS Proxy is recommended for serverless/container workloads to:
# - Manage connection pools automatically
# - Handle failover gracefully
# - Reduce connection overhead
#
# Prerequisites:
# - RDS instance already created
# - Secrets Manager secret with DB credentials
# - VPC and security groups configured
#
# Usage:
#   ./rds-proxy-setup.sh
#
# =============================================================================

set -euo pipefail

# Configuration - UPDATE THESE VALUES
PROXY_NAME="secure-auth-proxy"
DB_INSTANCE_ID="secure-auth-db"
REGION="${AWS_REGION:-eu-north-1}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# These should match your existing infrastructure
SECRET_ARN="arn:aws:secretsmanager:${REGION}:${ACCOUNT_ID}:secret:secure-auth/database-credentials"
VPC_SUBNET_IDS="subnet-private-1,subnet-private-2"  # UPDATE with your private subnet IDs
VPC_SECURITY_GROUP_IDS="sg-ecs-xxxxx"  # UPDATE with your ECS security group ID

echo "🚀 Setting up RDS Proxy for ${DB_INSTANCE_ID}..."

# =============================================================================
# Step 1: Create IAM Role for RDS Proxy
# =============================================================================
echo "📋 Creating IAM role for RDS Proxy..."

# Create trust policy
cat > /tmp/rds-proxy-trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "rds.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

# Create the role
aws iam create-role \
  --role-name rds-proxy-role \
  --assume-role-policy-document file:///tmp/rds-proxy-trust-policy.json \
  --description "Role for RDS Proxy to access Secrets Manager" \
  2>/dev/null || echo "Role already exists, continuing..."

# Create policy for Secrets Manager access
cat > /tmp/rds-proxy-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "${SECRET_ARN}"
    },
    {
      "Effect": "Allow",
      "Action": [
        "kms:Decrypt"
      ],
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "kms:ViaService": "secretsmanager.${REGION}.amazonaws.com"
        }
      }
    }
  ]
}
EOF

aws iam put-role-policy \
  --role-name rds-proxy-role \
  --policy-name SecretsManagerAccess \
  --policy-document file:///tmp/rds-proxy-policy.json

echo "✅ IAM role created"

# Wait for role to propagate
echo "⏳ Waiting for IAM role propagation..."
sleep 10

# =============================================================================
# Step 2: Create the RDS Proxy
# =============================================================================
echo "📋 Creating RDS Proxy..."

aws rds create-db-proxy \
  --db-proxy-name ${PROXY_NAME} \
  --engine-family POSTGRESQL \
  --auth "[{
    \"AuthScheme\": \"SECRETS\",
    \"SecretArn\": \"${SECRET_ARN}\",
    \"IAMAuth\": \"DISABLED\"
  }]" \
  --role-arn "arn:aws:iam::${ACCOUNT_ID}:role/rds-proxy-role" \
  --vpc-subnet-ids ${VPC_SUBNET_IDS} \
  --vpc-security-group-ids ${VPC_SECURITY_GROUP_IDS} \
  --require-tls \
  --idle-client-timeout 1800 \
  --debug-logging \
  --region ${REGION}

echo "✅ RDS Proxy creation initiated"

# =============================================================================
# Step 3: Wait for proxy to be available
# =============================================================================
echo "⏳ Waiting for RDS Proxy to become available (this may take 5-10 minutes)..."

aws rds wait db-proxy-available \
  --db-proxy-name ${PROXY_NAME} \
  --region ${REGION}

echo "✅ RDS Proxy is available"

# =============================================================================
# Step 4: Register the target (RDS instance)
# =============================================================================
echo "📋 Registering target database..."

aws rds register-db-proxy-targets \
  --db-proxy-name ${PROXY_NAME} \
  --db-instance-identifiers ${DB_INSTANCE_ID} \
  --region ${REGION}

echo "✅ Target registered"

# =============================================================================
# Step 5: Wait for target to be available
# =============================================================================
echo "⏳ Waiting for target to become available..."

aws rds wait db-proxy-target-available \
  --db-proxy-name ${PROXY_NAME} \
  --region ${REGION}

echo "✅ Target is available"

# =============================================================================
# Step 6: Get proxy endpoint
# =============================================================================
echo ""
echo "📊 RDS Proxy Details:"

PROXY_ENDPOINT=$(aws rds describe-db-proxies \
  --db-proxy-name ${PROXY_NAME} \
  --query 'DBProxies[0].Endpoint' \
  --output text \
  --region ${REGION})

echo ""
echo "✅ RDS Proxy setup complete!"
echo ""
echo "📌 Proxy Endpoint:"
echo "   ${PROXY_ENDPOINT}"
echo ""
echo "📌 Update your DATABASE_URL in Secrets Manager to:"
echo "   postgresql://YOUR_USER:YOUR_PASSWORD@${PROXY_ENDPOINT}:5432/authdb?sslmode=require"
echo ""
echo "📌 Benefits:"
echo "   - Connection pooling (handles 1000s of connections)"
echo "   - Automatic failover (< 1 second)"
echo "   - Reduced connection overhead"
echo ""
echo "⚠️  Remember to update the secret in Secrets Manager!"
