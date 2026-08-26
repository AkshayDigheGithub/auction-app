import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const phoneNumber = process.argv[2];
if (!phoneNumber) {
  console.error("Usage: npx tsx scripts/create-admin.mjs +91XXXXXXXXXX");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const user = await prisma.user.upsert({
  where: { phoneNumber },
  update: { role: "admin" },
  create: { phoneNumber, role: "admin" },
});

console.log("Admin user ready:", user);
await prisma.$disconnect();
