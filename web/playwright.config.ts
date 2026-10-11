import { defineConfig, devices } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";

const API_PORT = 8100;
const WEB_PORT = 5180;
const dir = join(tmpdir(), `mf-e2e-${Date.now()}`).replace(/\\/g, "/");
const py = process.platform === "win32" ? String.raw`.venv\Scripts\python` : ".venv/bin/python";

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${WEB_PORT}`, trace: "retain-on-failure", ...devices["Desktop Chrome"] },
  webServer: [
    {
      command: `${py} -m uvicorn app.main:app --port ${API_PORT}`,
      cwd: "../api",
      url: `http://localhost:${API_PORT}/healthz`,
      reuseExistingServer: false,
      env: { DATABASE_URL: `sqlite:///${dir}.db`, STORAGE_DIR: `${dir}-files`, MOCK_DELAY_MIN: "0.3", MOCK_DELAY_MAX: "0.6",
        PUBLIC_API_URL: `http://localhost:${WEB_PORT}`, CORS_ORIGINS: `http://localhost:${WEB_PORT}` },
      timeout: 60_000,
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: false,
      env: { API_URL: `http://localhost:${API_PORT}` },
      timeout: 60_000,
    },
  ],
});
