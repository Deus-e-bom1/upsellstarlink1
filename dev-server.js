const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const port = Number(process.env.PORT || 4173);
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

const apiRoutes = {
  "/api/check-payment": require("./api/check-payment"),
  "/api/create-pix": require("./api/create-pix"),
  "/api/plan-prices": require("./api/plan-prices"),
};

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function createApiResponse(res) {
  return {
    statusCode: 200,
    setHeader(name, value) {
      res.setHeader(name, value);
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      if (res.writableEnded) return this;
      res.statusCode = this.statusCode;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify(value));
      return this;
    },
  };
}

async function handleApi(req, res, handler) {
  const response = createApiResponse(res);
  try {
    req.body = req.method === "POST" ? await readJson(req) : {};
    await handler(req, response);
    if (!res.writableEnded) response.status(204).json({});
  } catch {
    if (!res.writableEnded) response.status(400).json({ error: "Requisição inválida." });
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const route = apiRoutes[url.pathname];
  if (route) return handleApi(req, res, route);

  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/lib/")) {
    res.writeHead(404).end("Not found");
    return;
  }

  let file = path.resolve(root, `.${decodeURIComponent(url.pathname)}`);
  if (file !== root && !file.startsWith(`${root}${path.sep}`)) {
    res.writeHead(403).end("Forbidden");
    return;
  }

  if (url.pathname.startsWith("/.") || url.pathname === "/dev-server.js") {
    res.writeHead(404).end("Not found");
    return;
  }

  try {
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
      file = path.join(file, "index.html");
    }
  } catch {
    res.writeHead(404).end("Not found");
    return;
  }

  if (!fs.existsSync(file) && !path.extname(url.pathname)) {
    file = path.join(root, "index.html");
  }

  fs.readFile(file, (error, data) => {
    if (error) {
      res.writeHead(404).end("Not found");
      return;
    }
    res.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": mimeTypes[path.extname(file)] || "application/octet-stream",
    });
    res.end(data);
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Local preview with API functions: http://127.0.0.1:${port}`);
});
