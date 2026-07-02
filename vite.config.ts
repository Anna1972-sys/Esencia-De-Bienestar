import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import { fileURLToPath, URL } from "node:url";

function localApiPlugin() {
  return {
    name: "local-api-preview",
    configureServer(server: any) {
      const localHandlers: Record<string, string> = {
        "/api/macro-specialist": "/api/macro-specialist.ts",
        "/api/manual-food-items": "/api/manual-food-items.ts",
      };

      server.middlewares.use(async (req: any, res: any, next: any) => {
        const pathname = String(req.url ?? "").split("?")[0];
        const handlerPath = localHandlers[pathname];
        if (!handlerPath) return next();

        try {
          res.setHeader("X-Local-Api-Preview", "true");
          const chunks: Buffer[] = [];
          for await (const chunk of req) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          }
          const rawBody = Buffer.concat(chunks).toString("utf8");
          req.body = rawBody ? JSON.parse(rawBody) : {};

          res.status = (code: number) => {
            res.statusCode = code;
            return res;
          };
          res.json = (payload: unknown) => {
            if (!res.getHeader("Content-Type")) {
              res.setHeader("Content-Type", "application/json; charset=utf-8");
            }
            res.end(JSON.stringify(payload));
          };

          const mod = await server.ssrLoadModule(handlerPath);
          return await mod.default(req, res);
        } catch (error: any) {
          console.error("[local-api-preview] error", pathname, error);
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify({
            error: "Error ejecutando la API local",
            detail: error?.message ?? String(error),
            stack: error?.stack ?? null,
          }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || "https://esencia-de-bienestar-49ii.vercel.app";

  return {
    envPrefix: ["VITE_", "SUPABASE_URL", "SUPABASE_ANON_KEY"],
    server: {
      host: "::",
      port: 8080,
      proxy: {
        "/api": {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: true,
        },
      },
    },
    plugins: [localApiPlugin(), react()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
  };
});
