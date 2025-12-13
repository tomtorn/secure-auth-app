/**
 * AWS ECS Service Status Fetcher
 * Provides deployment status, task health, and service info
 */

import {
  ECSClient,
  DescribeServicesCommand,
  DescribeTasksCommand,
  ListTasksCommand,
} from '@aws-sdk/client-ecs';
import { logger } from './logger.js';

const REGION = process.env.AWS_REGION || 'eu-north-1';
const ECS_CLUSTER = process.env.ECS_CLUSTER || 'secure-auth-cluster';
const ECS_SERVICE = process.env.ECS_SERVICE || 'secure-auth-service';

let ecsClient: ECSClient | null = null;

const getClient = (): ECSClient => {
  if (!ecsClient) {
    ecsClient = new ECSClient({ region: REGION });
  }
  return ecsClient;
};

export interface EcsDeploymentStatus {
  serviceName: string;
  status: 'ACTIVE' | 'DRAINING' | 'INACTIVE' | string;
  runningCount: number;
  desiredCount: number;
  pendingCount: number;
  deployments: Array<{
    id: string;
    status: string;
    taskDefinition: string;
    runningCount: number;
    desiredCount: number;
    createdAt: string;
    updatedAt: string;
  }>;
  tasks: Array<{
    taskArn: string;
    taskDefinitionArn: string;
    lastStatus: string;
    healthStatus: string;
    startedAt: string | null;
    cpu: string;
    memory: string;
  }>;
  lastDeploymentAt: string | null;
}

export const fetchEcsStatus = async (): Promise<EcsDeploymentStatus> => {
  try {
    const client = getClient();

    // Get service info
    const serviceResponse = await client.send(
      new DescribeServicesCommand({
        cluster: ECS_CLUSTER,
        services: [ECS_SERVICE],
      }),
    );

    const service = serviceResponse.services?.[0];
    if (!service) {
      throw new Error('Service not found');
    }

    // Get task ARNs
    const taskListResponse = await client.send(
      new ListTasksCommand({
        cluster: ECS_CLUSTER,
        serviceName: ECS_SERVICE,
      }),
    );

    const taskArns = taskListResponse.taskArns || [];

    // Get task details
    let tasks: EcsDeploymentStatus['tasks'] = [];
    if (taskArns.length > 0) {
      const tasksResponse = await client.send(
        new DescribeTasksCommand({
          cluster: ECS_CLUSTER,
          tasks: taskArns,
        }),
      );

      tasks = (tasksResponse.tasks || []).map((task) => ({
        taskArn: task.taskArn || '',
        taskDefinitionArn: task.taskDefinitionArn || '',
        lastStatus: task.lastStatus || 'UNKNOWN',
        healthStatus: task.healthStatus || 'UNKNOWN',
        startedAt: task.startedAt?.toISOString() || null,
        cpu: task.cpu || '0',
        memory: task.memory || '0',
      }));
    }

    // Map deployments
    const deployments = (service.deployments || []).map((d) => ({
      id: d.id || '',
      status: d.status || 'UNKNOWN',
      taskDefinition: d.taskDefinition?.split('/').pop() || '',
      runningCount: d.runningCount || 0,
      desiredCount: d.desiredCount || 0,
      createdAt: d.createdAt?.toISOString() || '',
      updatedAt: d.updatedAt?.toISOString() || '',
    }));

    // Find last deployment time (use slice to avoid mutating original array)
    const lastDeployment = [...deployments].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )[0];

    return {
      serviceName: service.serviceName || ECS_SERVICE,
      status: service.status || 'UNKNOWN',
      runningCount: service.runningCount || 0,
      desiredCount: service.desiredCount || 0,
      pendingCount: service.pendingCount || 0,
      deployments,
      tasks,
      lastDeploymentAt: lastDeployment?.createdAt || null,
    };
  } catch (error) {
    logger.warn({ err: error }, 'ECS status fetch failed (expected in dev)');
    return {
      serviceName: ECS_SERVICE,
      status: 'UNKNOWN',
      runningCount: 0,
      desiredCount: 0,
      pendingCount: 0,
      deployments: [],
      tasks: [],
      lastDeploymentAt: null,
    };
  }
};
