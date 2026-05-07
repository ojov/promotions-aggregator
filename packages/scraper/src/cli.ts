import "./env.js";
import { runScrape } from "./scrape.js";
import { createPrismaClient } from "./prisma.js";

const prisma = createPrismaClient();

try {
  const result = await runScrape(prisma);
  console.log(JSON.stringify(result, null, 2));
  if (result.status === "FAILED") {
    process.exitCode = 1;
  }
} finally {
  await prisma.$disconnect();
}
