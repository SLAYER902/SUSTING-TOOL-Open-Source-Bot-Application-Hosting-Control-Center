import Docker from "dockerode";

export const docker = new Docker({ socketPath: process.env.DOCKER_SOCKET || "/var/run/docker.sock" });

export async function ensureInternalNetwork() {
  const name = process.env.PROJECT_NETWORK || "sulayer-projects";
  const networks = await docker.listNetworks({ filters: JSON.stringify({ name: [name] }) });
  if (!networks.length) await docker.createNetwork({ Name: name, Driver: "bridge", Internal: true, Attachable: false, Labels: { "io.sulayer.managed": "true" } });
  return name;
}
