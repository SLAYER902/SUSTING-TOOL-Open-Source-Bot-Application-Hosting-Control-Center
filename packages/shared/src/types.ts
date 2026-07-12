export type Runtime = "node" | "python" | "java" | "go" | "rust" | "php" | "docker" | "static";

export type DeploymentProvider = {
  validateCredentials(): Promise<boolean>;
  createProject(input: unknown): Promise<{ id: string }>;
  setEnvironmentVariables(projectId: string, variables: Record<string, string>): Promise<void>;
  deploy(projectId: string, config: unknown): Promise<{ id: string; status: string }>;
  getDeploymentStatus(deploymentId: string): Promise<string>;
  getLogs(deploymentId: string): AsyncIterable<{ level: string; message: string; timestamp: Date }>;
  stopService(projectId: string): Promise<void>;
  restartService(projectId: string): Promise<void>;
  deleteService(projectId: string): Promise<void>;
};
