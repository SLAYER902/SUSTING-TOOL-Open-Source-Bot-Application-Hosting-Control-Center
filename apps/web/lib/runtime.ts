export type RuntimePreset = { runtime: string; installCommand?: string; buildCommand?: string; startCommand: string; port?: number; confidence: "high" | "medium" };

export const runtimePresets: Record<string, RuntimePreset> = {
  node: { runtime: "Node.js 22", installCommand: "npm ci", buildCommand: "npm run build", startCommand: "npm start", port: 3000, confidence: "high" },
  python: { runtime: "Python 3.12", installCommand: "pip install -r requirements.txt", startCommand: "python main.py", confidence: "high" },
  java: { runtime: "Java 21", installCommand: "./mvnw dependency:resolve", buildCommand: "./mvnw package", startCommand: "java -jar target/*.jar", port: 8080, confidence: "high" },
  go: { runtime: "Go 1.23", buildCommand: "go build -o app .", startCommand: "./app", port: 8080, confidence: "high" },
  rust: { runtime: "Rust stable", buildCommand: "cargo build --release", startCommand: "./target/release/app", confidence: "high" },
  php: { runtime: "PHP 8.3", installCommand: "composer install --no-dev --optimize-autoloader", startCommand: "php -S 0.0.0.0:8080 -t public", port: 8080, confidence: "high" },
  docker: { runtime: "Docker", startCommand: "Dockerfile CMD", confidence: "high" },
  static: { runtime: "Static site", buildCommand: "npm run build", startCommand: "npx serve -s dist -l 3000", port: 3000, confidence: "medium" }
};

export function runtimeFromFiles(files: string[]): RuntimePreset | null {
  const names = new Set(files.map((file) => file.split("/").pop()));
  if (names.has("Dockerfile") || names.has("compose.yaml")) return runtimePresets.docker;
  if (names.has("package.json")) return runtimePresets.node;
  if (names.has("requirements.txt") || names.has("pyproject.toml") || names.has("Pipfile")) return runtimePresets.python;
  if (names.has("pom.xml") || names.has("build.gradle")) return runtimePresets.java;
  if (names.has("go.mod")) return runtimePresets.go;
  if (names.has("Cargo.toml")) return runtimePresets.rust;
  if (names.has("composer.json")) return runtimePresets.php;
  if (names.has("index.html")) return runtimePresets.static;
  return null;
}
