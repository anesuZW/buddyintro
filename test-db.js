const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  console.time("Database");

  const result = await prisma.$queryRaw`SELECT NOW()`;

  console.timeEnd("Database");

  console.log(result);

  await prisma.$disconnect();
}

main().catch(console.error);