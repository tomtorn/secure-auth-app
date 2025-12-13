# Security Groups Configuration

## 1. ALB Security Group (`secure-auth-alb-sg`)

**Inbound Rules:**
| Type | Protocol | Port | Source | Description |
|-------|----------|------|-----------|----------------------|
| HTTPS | TCP | 443 | 0.0.0.0/0 | Public HTTPS access |
| HTTP | TCP | 80 | 0.0.0.0/0 | Redirect to HTTPS |

**Outbound Rules:**
| Type | Protocol | Port | Destination | Description |
|------------|----------|------|------------------|-------------------|
| Custom TCP | TCP | 4000 | secure-auth-ecs-sg | To ECS tasks |

---

## 2. ECS Tasks Security Group (`secure-auth-ecs-sg`)

**Inbound Rules:**
| Type | Protocol | Port | Source | Description |
|------------|----------|------|--------------|-------------------|
| Custom TCP | TCP | 4000 | secure-auth-alb-sg | From ALB only |

**Outbound Rules:**
| Type | Protocol | Port | Destination | Description |
|------------|----------|------|------------------|----------------------|
| PostgreSQL | TCP | 5432 | secure-auth-rds-sg | To RDS database |
| HTTPS | TCP | 443 | 0.0.0.0/0 | To Supabase Auth API |

---

## 3. RDS Security Group (`secure-auth-rds-sg`)

**Inbound Rules:**
| Type | Protocol | Port | Source | Description |
|------------|----------|------|--------------|-------------------|
| PostgreSQL | TCP | 5432 | secure-auth-ecs-sg | From ECS only |

**Outbound Rules:**
| Type | Protocol | Port | Destination | Description |
|------|----------|------|-------------|-------------|
| None | - | - | - | No outbound |

---

## AWS CLI Commands

```bash
# Create VPC (if not using default)
aws ec2 create-vpc --cidr-block 10.0.0.0/16 --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=secure-auth-vpc}]'

# Create ALB Security Group
aws ec2 create-security-group \
  --group-name secure-auth-alb-sg \
  --description "ALB security group for SecureAuth" \
  --vpc-id vpc-xxxxxxxx

# Add ALB inbound rules
aws ec2 authorize-security-group-ingress \
  --group-id sg-alb-xxxxxxxx \
  --protocol tcp --port 443 --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
  --group-id sg-alb-xxxxxxxx \
  --protocol tcp --port 80 --cidr 0.0.0.0/0

# Create ECS Security Group
aws ec2 create-security-group \
  --group-name secure-auth-ecs-sg \
  --description "ECS tasks security group" \
  --vpc-id vpc-xxxxxxxx

# Add ECS inbound from ALB
aws ec2 authorize-security-group-ingress \
  --group-id sg-ecs-xxxxxxxx \
  --protocol tcp --port 4000 \
  --source-group sg-alb-xxxxxxxx

# Create RDS Security Group
aws ec2 create-security-group \
  --group-name secure-auth-rds-sg \
  --description "RDS security group" \
  --vpc-id vpc-xxxxxxxx

# Add RDS inbound from ECS
aws ec2 authorize-security-group-ingress \
  --group-id sg-rds-xxxxxxxx \
  --protocol tcp --port 5432 \
  --source-group sg-ecs-xxxxxxxx
```

---

## Network Architecture

```
Internet
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│                        VPC (10.0.0.0/16)                    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Public Subnets (10.0.1.0/24, 10.0.2.0/24) │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │         Application Load Balancer                │  │ │
│  │  │              (secure-auth-alb-sg)                       │  │ │
│  │  └──────────────────────┬───────────────────────────┘  │ │
│  └─────────────────────────┼──────────────────────────────┘ │
│                            │                                │
│  ┌─────────────────────────┼──────────────────────────────┐ │
│  │           Private Subnets (10.0.3.0/24, 10.0.4.0/24)   │ │
│  │                         ▼                              │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │           ECS Fargate Tasks                      │  │ │
│  │  │              (secure-auth-ecs-sg)                       │  │ │
│  │  └──────────────────────┬───────────────────────────┘  │ │
│  │                         │                              │ │
│  │                         ▼                              │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │           RDS PostgreSQL                         │  │ │
│  │  │              (secure-auth-rds-sg)                       │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```
