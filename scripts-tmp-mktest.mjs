import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const prisma = new PrismaClient();
const email = "shelltest@example.com";
const ex = await prisma.user.findUnique({ where: { email } });
if (ex) { await prisma.businessUser.deleteMany({ where: { userId: ex.id } }); await prisma.user.delete({ where: { id: ex.id } }); }
await prisma.business.deleteMany({ where: { slug: "shell-test-studio" } });
const passwordHash = await bcrypt.hash("password123", 10);
const u = await prisma.user.create({ data: { name: "בדיקת מעטפת", email, passwordHash } });
console.log("CREATED_USER", u.id, u.email);
await prisma.$disconnect();
