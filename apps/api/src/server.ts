import "./env.js";
import { createApp } from "./app.js";
import { createPrismaClient } from "./prisma.js";

const prisma = createPrismaClient();
const app = createApp(prisma);
const port = Number(process.env.API_PORT ?? 4000);

const server = app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  });
}
