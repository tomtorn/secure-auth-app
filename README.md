# SecureAuth

A **production-ready authentication system** demonstrating enterprise-grade security practices, built with React, Express, and designed for AWS deployment.

> **Note:** This is a reference implementation. Clone the repo and deploy to your own AWS/Supabase accounts.

## Features

- **Secure Authentication** - Email/password with Supabase Auth
- **Defense in Depth** - CSRF protection, rate limiting, account lockout
- **DevOps Monitoring** - ECS deployments, CloudWatch logs, Sentry errors
- **Real-time Dashboard** - Auth metrics, system health, activity logs
- **Production Infrastructure** - Docker, ECS Fargate, RDS, CI/CD

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   React SPA     │────▶│  Express API    │────▶│   PostgreSQL    │
│   (Amplify)     │     │  (ECS Fargate)  │     │   (Supabase)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │
        │                       ├── Redis (Rate Limiting)
        │                       └── Sentry (Monitoring)
        │
        └── CloudFront CDN
```

## Tech Stack

| Layer              | Technology                                      |
| ------------------ | ----------------------------------------------- |
| **Frontend**       | React 18, TypeScript, Vite, TailwindCSS         |
| **State**          | React Query, React Hook Form                    |
| **Backend**        | Node.js, Express.js, Prisma ORM                 |
| **Database**       | PostgreSQL (Supabase)                           |
| **Auth**           | Supabase Auth + HttpOnly cookies + CSRF tokens  |
| **Infrastructure** | AWS ECS Fargate, Amplify, CloudWatch            |
| **CI/CD**          | GitHub Actions, Docker, Trivy security scanning |

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

```bash
# Server
cp server/.env.example server/.env
# Edit server/.env with your Supabase credentials

# Client (optional)
cp client/.env.example client/.env
```

### 3. Push database schema

```bash
npm run db:push
```

### 4. Start development servers

```bash
npm run dev
```

This starts:

- **Backend** at http://localhost:4000
- **Frontend** at http://localhost:5173

## Scripts

| Command              | Description                    |
| -------------------- | ------------------------------ |
| `npm run dev`        | Start both server and client   |
| `npm run dev:server` | Start server only              |
| `npm run dev:client` | Start client only              |
| `npm run build`      | Build both for production      |
| `npm run lint`       | Lint all workspaces            |
| `npm run db:push`    | Push Prisma schema to database |
| `npm run db:studio`  | Open Prisma Studio             |

## Security

This application implements multiple layers of security:

| Layer                      | Implementation                                            |
| -------------------------- | --------------------------------------------------------- |
| **CSRF Protection**        | Signed HMAC-SHA256 tokens with double-submit pattern      |
| **Rate Limiting**          | Redis-backed with per-IP limits (5 req/min on auth)       |
| **Account Lockout**        | 5 failed attempts triggers 15-minute lockout              |
| **Session Security**       | HttpOnly, Secure, SameSite cookies                        |
| **Input Validation**       | Zod schemas on all endpoints                              |
| **Container Hardening**    | Non-root user, read-only filesystem, dropped capabilities |
| **Vulnerability Scanning** | Trivy scans block deployment on CRITICAL/HIGH             |

## Project Structure

```
secure-auth/
├── client/                 # React SPA
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── hooks/          # React Query hooks (useAuth, useUsers)
│   │   ├── pages/          # Route pages
│   │   └── lib/            # API client, schemas, utilities
│   └── vite.config.ts
│
├── server/                 # Express API
│   ├── src/
│   │   ├── routes/         # API endpoints
│   │   ├── services/       # Business logic
│   │   ├── middleware/     # Auth, CSRF, rate limiting
│   │   └── lib/            # Prisma, Redis, monitoring
│   ├── prisma/             # Database schema
│   └── Dockerfile
│
├── packages/schemas/       # Shared Zod schemas
├── infrastructure/         # AWS ECS task definitions
└── .github/workflows/      # CI/CD pipeline
```

## API Endpoints

| Method | Endpoint                             | Description                |
| ------ | ------------------------------------ | -------------------------- |
| POST   | `/api/auth/signup`                   | Register new user          |
| POST   | `/api/auth/signin`                   | Authenticate user          |
| POST   | `/api/auth/signout`                  | End session                |
| GET    | `/api/auth/me`                       | Get current user           |
| GET    | `/api/users`                         | List users (authenticated) |
| GET    | `/api/monitoring`                    | Dashboard metrics          |
| GET    | `/api/monitoring/health`             | System health check        |
| GET    | `/api/monitoring/activity`           | Recent auth events         |
| GET    | `/api/monitoring/deployments`        | ECS deployment status      |
| GET    | `/api/monitoring/logs`               | CloudWatch server logs     |
| GET    | `/api/monitoring/errors`             | Sentry error stats         |
| GET    | `/api/monitoring/metrics/timeseries` | CPU/Memory time-series     |

## Deployment

The application is deployed using:

- **Frontend**: AWS Amplify (auto-deploys from main branch)
- **Backend**: AWS ECS Fargate with Application Load Balancer
- **Database**: Supabase PostgreSQL
- **Secrets**: AWS Secrets Manager
- **CI/CD**: GitHub Actions with OIDC authentication

## License

MIT
