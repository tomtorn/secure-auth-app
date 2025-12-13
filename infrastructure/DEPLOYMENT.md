# SecureAuth - AWS Production Deployment Guide

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   CloudFront    │────▶│  Amplify        │     │   Supabase      │
│   (CDN)         │     │  React Client   │     │   Auth API      │
└─────────────────┘     └────────┬────────┘     └────────┬────────┘
                                 │                       │
                                 ▼                       │
                        ┌─────────────────┐              │
                        │   ALB (HTTPS)   │              │
                        │   Port 443      │              │
                        └────────┬────────┘              │
                                 │                       │
                        ┌────────▼────────┐              │
                        │   ECS Fargate   │◀─────────────┘
                        │   Express API   │
                        │   Port 4000     │
                        └────────┬────────┘
                                 │
                        ┌────────▼────────┐
                        │  RDS PostgreSQL │
                        │   Port 5432     │
                        └─────────────────┘
```

---

# Phase 1: Dockerize the Express Server

## Prerequisites

- Docker Desktop installed
- AWS CLI v2 installed
- Node.js 20+

## Step 1.1: Build Docker Image Locally

```bash
cd /path/to/secure-auth

# Build from repo root (uses monorepo structure)
npm run docker:build

# Verify image was created
docker images | grep secure-auth-server
```

## Step 1.2: Test Locally

```bash
# Create a test .env file for Docker
cp server/.env.example server/.env
# Edit server/.env with your Supabase + DB credentials

# Run the container
npm run docker:run

# In another terminal, test the health endpoint
curl http://localhost:4000/health
# Expected: {"status":"ok","timestamp":"...","checks":{"database":"connected"}}
```

## Step 1.3: Verify Graceful Shutdown

```bash
# Run in detached mode
docker run -d --name auth-test -p 4000:4000 --env-file server/.env secure-auth-server

# Send SIGTERM (graceful shutdown)
docker stop auth-test

# Check logs for graceful shutdown message
docker logs auth-test | tail -5
# Should see: "Shutting down gracefully..."

# Cleanup
docker rm auth-test
```

---

# Phase 2: Push Image to AWS ECR

## Step 2.1: Create ECR Repository

```bash
# Set your AWS region
export AWS_REGION=eu-north-1
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Create ECR repository
aws ecr create-repository \
  --repository-name secure-auth-server \
  --image-scanning-configuration scanOnPush=true \
  --encryption-configuration encryptionType=AES256 \
  --region $AWS_REGION

# Set lifecycle policy to keep only last 10 images
aws ecr put-lifecycle-policy \
  --repository-name secure-auth-server \
  --lifecycle-policy-text '{
    "rules": [
      {
        "rulePriority": 1,
        "description": "Keep only last 10 images",
        "selection": {
          "tagStatus": "any",
          "countType": "imageCountMoreThan",
          "countNumber": 10
        },
        "action": {
          "type": "expire"
        }
      }
    ]
  }'
```

## Step 2.2: Authenticate Docker to ECR

```bash
# Login to ECR
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com
```

## Step 2.3: Tag and Push Image

```bash
# Tag the image
docker tag secure-auth-server:latest \
  $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/secure-auth-server:latest

# Push to ECR
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/secure-auth-server:latest

# Verify
aws ecr describe-images --repository-name secure-auth-server --region $AWS_REGION
```

---

# Phase 3: Create ECS Fargate Service + ALB

## Step 3.1: Create VPC and Subnets (if needed)

```bash
# Create VPC
VPC_ID=$(aws ec2 create-vpc \
  --cidr-block 10.0.0.0/16 \
  --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=secure-auth-vpc}]' \
  --query 'Vpc.VpcId' --output text)

# Enable DNS hostnames
aws ec2 modify-vpc-attribute --vpc-id $VPC_ID --enable-dns-hostnames

# Create Internet Gateway
IGW_ID=$(aws ec2 create-internet-gateway \
  --tag-specifications 'ResourceType=internet-gateway,Tags=[{Key=Name,Value=secure-auth-igw}]' \
  --query 'InternetGateway.InternetGatewayId' --output text)

aws ec2 attach-internet-gateway --internet-gateway-id $IGW_ID --vpc-id $VPC_ID

# Create public subnets (2 AZs for ALB)
SUBNET_PUBLIC_1=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID --cidr-block 10.0.1.0/24 --availability-zone ${AWS_REGION}a \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=secure-auth-public-1}]' \
  --query 'Subnet.SubnetId' --output text)

SUBNET_PUBLIC_2=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID --cidr-block 10.0.2.0/24 --availability-zone ${AWS_REGION}b \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=secure-auth-public-2}]' \
  --query 'Subnet.SubnetId' --output text)

# Create private subnets for ECS + RDS
SUBNET_PRIVATE_1=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID --cidr-block 10.0.3.0/24 --availability-zone ${AWS_REGION}a \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=secure-auth-private-1}]' \
  --query 'Subnet.SubnetId' --output text)

SUBNET_PRIVATE_2=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID --cidr-block 10.0.4.0/24 --availability-zone ${AWS_REGION}b \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=secure-auth-private-2}]' \
  --query 'Subnet.SubnetId' --output text)
```

## Step 3.2: Create Security Groups

```bash
# ALB Security Group
ALB_SG=$(aws ec2 create-security-group \
  --group-name secure-auth-alb-sg \
  --description "ALB security group" \
  --vpc-id $VPC_ID \
  --query 'GroupId' --output text)

aws ec2 authorize-security-group-ingress --group-id $ALB_SG --protocol tcp --port 443 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $ALB_SG --protocol tcp --port 80 --cidr 0.0.0.0/0

# ECS Security Group
ECS_SG=$(aws ec2 create-security-group \
  --group-name secure-auth-ecs-sg \
  --description "ECS tasks security group" \
  --vpc-id $VPC_ID \
  --query 'GroupId' --output text)

aws ec2 authorize-security-group-ingress --group-id $ECS_SG --protocol tcp --port 4000 --source-group $ALB_SG

# RDS Security Group
RDS_SG=$(aws ec2 create-security-group \
  --group-name secure-auth-rds-sg \
  --description "RDS security group" \
  --vpc-id $VPC_ID \
  --query 'GroupId' --output text)

aws ec2 authorize-security-group-ingress --group-id $RDS_SG --protocol tcp --port 5432 --source-group $ECS_SG
```

## Step 3.3: Create Secrets in Secrets Manager

```bash
# Create secrets for sensitive values
aws secretsmanager create-secret \
  --name secure-auth/database-url \
  --secret-string "postgresql://user:pass@rds-endpoint:5432/authdb?sslmode=require"

aws secretsmanager create-secret \
  --name secure-auth/supabase-url \
  --secret-string "https://your-project.supabase.co"

aws secretsmanager create-secret \
  --name secure-auth/supabase-anon-key \
  --secret-string "your-anon-key"

aws secretsmanager create-secret \
  --name secure-auth/supabase-service-role-key \
  --secret-string "your-service-role-key"

aws secretsmanager create-secret \
  --name secure-auth/frontend-url \
  --secret-string "https://your-amplify-domain.amplifyapp.com"
```

## Step 3.4: Create IAM Roles

```bash
# Create ECS Task Execution Role
aws iam create-role \
  --role-name ecsTaskExecutionRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "ecs-tasks.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

# Attach managed policy
aws iam attach-role-policy \
  --role-name ecsTaskExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

# Attach custom policy for Secrets Manager
aws iam put-role-policy \
  --role-name ecsTaskExecutionRole \
  --policy-name SecretsManagerAccess \
  --policy-document file://infrastructure/aws/iam-task-execution-role.json
```

## Step 3.5: Create ECS Cluster

```bash
aws ecs create-cluster \
  --cluster-name secure-auth-cluster \
  --capacity-providers FARGATE FARGATE_SPOT \
  --default-capacity-provider-strategy capacityProvider=FARGATE,weight=1
```

## Step 3.6: Create Application Load Balancer

```bash
# Create ALB
ALB_ARN=$(aws elbv2 create-load-balancer \
  --name secure-auth-alb \
  --subnets $SUBNET_PUBLIC_1 $SUBNET_PUBLIC_2 \
  --security-groups $ALB_SG \
  --scheme internet-facing \
  --type application \
  --query 'LoadBalancers[0].LoadBalancerArn' --output text)

# Create Target Group
TG_ARN=$(aws elbv2 create-target-group \
  --name secure-auth-tg \
  --protocol HTTP \
  --port 4000 \
  --vpc-id $VPC_ID \
  --target-type ip \
  --health-check-path /health \
  --health-check-interval-seconds 30 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3 \
  --query 'TargetGroups[0].TargetGroupArn' --output text)

# Create HTTPS Listener (requires ACM certificate)
aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn=$ACM_CERT_ARN \
  --default-actions Type=forward,TargetGroupArn=$TG_ARN

# Create HTTP → HTTPS redirect
aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN \
  --protocol HTTP \
  --port 80 \
  --default-actions Type=redirect,RedirectConfig='{Protocol=HTTPS,Port=443,StatusCode=HTTP_301}'
```

## Step 3.7: Register ECS Task Definition

```bash
# Replace placeholders in task definition
sed -i "s/\${AWS_ACCOUNT_ID}/$AWS_ACCOUNT_ID/g" infrastructure/aws/ecs-task-definition.json
sed -i "s/\${AWS_REGION}/$AWS_REGION/g" infrastructure/aws/ecs-task-definition.json

# Register task definition
aws ecs register-task-definition \
  --cli-input-json file://infrastructure/aws/ecs-task-definition.json
```

## Step 3.8: Create ECS Service

```bash
aws ecs create-service \
  --cluster secure-auth-cluster \
  --service-name secure-auth-service \
  --task-definition secure-auth-server \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_PRIVATE_1,$SUBNET_PRIVATE_2],securityGroups=[$ECS_SG],assignPublicIp=DISABLED}" \
  --load-balancers "targetGroupArn=$TG_ARN,containerName=secure-auth-server,containerPort=4000" \
  --health-check-grace-period-seconds 60
```

---

# Phase 4: Move Prisma DB to RDS PostgreSQL

## Step 4.1: Create RDS Instance

```bash
# Create DB Subnet Group
aws rds create-db-subnet-group \
  --db-subnet-group-name secure-auth-db-subnet-group \
  --db-subnet-group-description "SecureAuth DB subnets" \
  --subnet-ids $SUBNET_PRIVATE_1 $SUBNET_PRIVATE_2

# Create RDS PostgreSQL
aws rds create-db-instance \
  --db-instance-identifier secure-auth-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 15 \
  --master-username auth_admin \
  --master-user-password "$(openssl rand -base64 24)" \
  --allocated-storage 20 \
  --storage-type gp3 \
  --vpc-security-group-ids $RDS_SG \
  --db-subnet-group-name secure-auth-db-subnet-group \
  --db-name authdb \
  --backup-retention-period 7 \
  --multi-az \
  --storage-encrypted \
  --deletion-protection \
  --no-publicly-accessible
```

## Step 4.2: Get RDS Endpoint

```bash
# Wait for RDS to be available (5-10 minutes)
aws rds wait db-instance-available --db-instance-identifier secure-auth-db

# Get endpoint
RDS_ENDPOINT=$(aws rds describe-db-instances \
  --db-instance-identifier secure-auth-db \
  --query 'DBInstances[0].Endpoint.Address' --output text)

echo "RDS Endpoint: $RDS_ENDPOINT"
```

## Step 4.3: Update Secrets with RDS URL

```bash
# Update DATABASE_URL secret with RDS endpoint
aws secretsmanager update-secret \
  --secret-id secure-auth/database-url \
  --secret-string "postgresql://auth_admin:YOUR_PASSWORD@$RDS_ENDPOINT:5432/authdb?sslmode=require"
```

## Step 4.4: Run Prisma Migrations

```bash
# Option A: Run from local machine (requires VPN/bastion to RDS)
cd server
DATABASE_URL="postgresql://..." npx prisma migrate deploy

# Option B: Run as one-off ECS task (recommended)
aws ecs run-task \
  --cluster secure-auth-cluster \
  --task-definition secure-auth-server \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_PRIVATE_1],securityGroups=[$ECS_SG],assignPublicIp=DISABLED}" \
  --overrides '{
    "containerOverrides": [{
      "name": "secure-auth-server",
      "command": ["npx", "prisma", "migrate", "deploy"]
    }]
  }'
```

---

# Phase 5: Host React Client on Amplify

## Step 5.1: Create Amplify App

1. Go to AWS Amplify Console
2. Click "New app" → "Host web app"
3. Connect to GitHub repository: `tomtorn/secure-auth-app`
4. Configure build settings:

```yaml
version: 1
applications:
  - appRoot: client
    frontend:
      phases:
        preBuild:
          commands:
            - npm ci
        build:
          commands:
            - npm run build
      artifacts:
        baseDirectory: dist
        files:
          - '**/*'
      cache:
        paths:
          - node_modules/**/*
```

## Step 5.2: Set Environment Variables

In Amplify Console → App settings → Environment variables:

| Variable       | Value                                   |
| -------------- | --------------------------------------- |
| `VITE_API_URL` | `https://api.your-domain.com` (ALB URL) |

## Step 5.3: Configure Custom Domain (Optional)

1. Go to Domain management
2. Add custom domain
3. Configure DNS records as instructed

---

# Phase 6: CI/CD + Observability

## Step 6.1: Configure GitHub Secrets

Add these secrets in GitHub → Settings → Secrets → Actions:

| Secret           | Value                                              |
| ---------------- | -------------------------------------------------- |
| `AWS_ROLE_ARN`   | `arn:aws:iam::ACCOUNT_ID:role/github-actions-role` |
| `AWS_ACCOUNT_ID` | Your AWS account ID                                |

## Step 6.2: Create GitHub Actions OIDC Role

```bash
# Create OIDC provider for GitHub
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1

# Create role for GitHub Actions
aws iam create-role \
  --role-name github-actions-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"},
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:tomtorn/secure-auth-app:*"
        }
      }
    }]
  }'

# Attach necessary policies
aws iam attach-role-policy --role-name github-actions-role \
  --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPowerUser

aws iam attach-role-policy --role-name github-actions-role \
  --policy-arn arn:aws:iam::aws:policy/AmazonECS_FullAccess
```

## Step 6.3: Set Up CloudWatch Alarms

```bash
# ECS CPU Alarm
aws cloudwatch put-metric-alarm \
  --alarm-name secure-auth-ecs-cpu-high \
  --alarm-description "ECS CPU utilization above 80%" \
  --metric-name CPUUtilization \
  --namespace AWS/ECS \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=ClusterName,Value=secure-auth-cluster Name=ServiceName,Value=secure-auth-service \
  --evaluation-periods 2 \
  --alarm-actions $SNS_TOPIC_ARN

# ALB 5xx Errors Alarm
aws cloudwatch put-metric-alarm \
  --alarm-name secure-auth-alb-5xx-errors \
  --alarm-description "ALB 5xx errors above threshold" \
  --metric-name HTTPCode_Target_5XX_Count \
  --namespace AWS/ApplicationELB \
  --statistic Sum \
  --period 60 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=LoadBalancer,Value=app/secure-auth-alb/xxx \
  --evaluation-periods 1 \
  --alarm-actions $SNS_TOPIC_ARN

# RDS Storage Alarm
aws cloudwatch put-metric-alarm \
  --alarm-name secure-auth-rds-storage-low \
  --alarm-description "RDS free storage below 5GB" \
  --metric-name FreeStorageSpace \
  --namespace AWS/RDS \
  --statistic Average \
  --period 300 \
  --threshold 5368709120 \
  --comparison-operator LessThanThreshold \
  --dimensions Name=DBInstanceIdentifier,Value=secure-auth-db \
  --evaluation-periods 1 \
  --alarm-actions $SNS_TOPIC_ARN
```

## Step 6.4: Create CloudWatch Dashboard

```bash
aws cloudwatch put-dashboard \
  --dashboard-name secure-auth \
  --dashboard-body '{
    "widgets": [
      {
        "type": "metric",
        "properties": {
          "title": "ECS CPU & Memory",
          "metrics": [
            ["AWS/ECS", "CPUUtilization", "ClusterName", "secure-auth-cluster", "ServiceName", "secure-auth-service"],
            [".", "MemoryUtilization", ".", ".", ".", "."]
          ],
          "period": 60,
          "stat": "Average"
        }
      },
      {
        "type": "metric",
        "properties": {
          "title": "ALB Request Count",
          "metrics": [
            ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", "app/secure-auth-alb/xxx"]
          ],
          "period": 60,
          "stat": "Sum"
        }
      },
      {
        "type": "metric",
        "properties": {
          "title": "ALB Response Time",
          "metrics": [
            ["AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", "app/secure-auth-alb/xxx"]
          ],
          "period": 60,
          "stat": "Average"
        }
      },
      {
        "type": "metric",
        "properties": {
          "title": "RDS Connections",
          "metrics": [
            ["AWS/RDS", "DatabaseConnections", "DBInstanceIdentifier", "secure-auth-db"]
          ],
          "period": 60,
          "stat": "Average"
        }
      }
    ]
  }'
```

---

# Verification Checklist

- [ ] Docker image builds and runs locally
- [ ] Image pushed to ECR
- [ ] ECS service running with 2 healthy tasks
- [ ] ALB health checks passing
- [ ] RDS accessible from ECS tasks only
- [ ] Prisma migrations applied to RDS
- [ ] Amplify client deployed and accessible
- [ ] CORS configured correctly (FRONTEND_URL matches Amplify domain)
- [ ] GitHub Actions pipeline green
- [ ] CloudWatch alarms configured
- [ ] All secrets in Secrets Manager (not in code)

---

# Cost Estimate (Monthly)

| Service         | Configuration         | Est. Cost   |
| --------------- | --------------------- | ----------- |
| ECS Fargate     | 2x 0.25 vCPU, 0.5GB   | ~$20        |
| ALB             | Standard              | ~$16        |
| RDS PostgreSQL  | db.t3.micro, Multi-AZ | ~$25        |
| ECR             | 10 images             | ~$1         |
| Amplify Hosting | Included tier         | ~$0         |
| CloudWatch      | Logs + Alarms         | ~$5         |
| **Total**       |                       | **~$67/mo** |

For development/staging, use single-AZ RDS and 1 Fargate task (~$35/mo).
development/staging, use single-AZ RDS and 1 Fargate task (~$35/mo).
