import http from "node:http";
import { config, getRepoSlug } from "./config.js";
import { getDashboardData, initializeStore, runSync } from "./service.js";

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(payload, null, 2));
}

function sendError(response, statusCode, message) {
  sendJson(response, statusCode, { error: message });
}

async function requestHandler(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === "GET" && url.pathname === "/health") {
    return sendJson(response, 200, {
      ok: true,
      repo: getRepoSlug()
    });
  }

  if (request.method === "GET" && url.pathname === "/api/dashboard") {
    try {
      const dashboardData = await getDashboardData({
        releaseTag: url.searchParams.get("releaseTag") ?? undefined,
        platform: url.searchParams.get("platform") ?? undefined
      });
      return sendJson(response, 200, dashboardData);
    } catch (error) {
      return sendError(response, 500, error.message);
    }
  }

  if (request.method === "POST" && url.pathname === "/api/sync") {
    try {
      const result = await runSync();
      return sendJson(response, 200, result);
    } catch (error) {
      return sendError(response, 502, error.message);
    }
  }

  return sendError(response, 404, "Route not found.");
}

await initializeStore();

if (config.autoSyncOnStartup) {
  try {
    await runSync();
  } catch (error) {
    console.error(`Startup sync failed: ${error.message}`);
  }
}

const server = http.createServer((request, response) => {
  requestHandler(request, response).catch((error) => {
    sendError(response, 500, error.message);
  });
});

server.listen(config.port, () => {
  console.log(`Download tracker listening on http://localhost:${config.port}`);
});
