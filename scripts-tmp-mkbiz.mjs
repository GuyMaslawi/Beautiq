import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const user = await prisma.user.findUnique({ where: { email: "shelltest@example.com" } });
// Mirror createBusinessAction: business + owner membership + default policy.
const biz = await prisma.business.create({
  data: {
    name: "סטודיו בדיקה",
    slug: "shell-test-studio",
    members: { create: { userId: user.id, role: "owner" } },
    cancellationPolicy: { create: {} },
  },
});
const member = await prisma.businessUser.findFirst({ where: { businessId: biz.id }, select: { role: true, userId: true } });
const policy = await prisma.cancellationPolicy.findUnique({ where: { businessId: biz.id }, select: { id: true } });
console.log("BIZ", biz.id, biz.slug);
console.log("OWNER_MEMBER", JSON.stringify(member), "matchesUser=", member.userId === user.id);
console.log("POLICY_CREATED", Boolean(policy));
// slug uniqueness guard
try { await prisma.business.create({ data: { name: "dup", slug: "shell-test-studio", members: { create: { userId: user.id, role: "owner" } } } }); console.log("UNIQUE_SLUG=FAIL(no error)"); }
catch (e) { console.log("UNIQUE_SLUG=enforced", e.code); }
await prisma.$disconnect();
