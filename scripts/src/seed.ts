import { db, usersTable, dealsTable, paymentsTable, expensesTable } from "@workspace/db";
import crypto from "crypto";

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "kitna_salt_2024").digest("hex");
}

async function seed() {
  console.log("Seeding Kitna database...");

  // Create demo user
  const [user] = await db.insert(usersTable).values({
    name: "Aanya Sharma",
    email: "demo@kitna.app",
    passwordHash: hashPassword("demo1234"),
    role: "creator",
    currency: "INR",
  }).onConflictDoNothing().returning();

  if (!user) {
    console.log("Demo user already exists. Skipping seed.");
    return;
  }

  const uid = user.id;
  const now = new Date();
  const mo = (m: number) => new Date(now.getFullYear(), now.getMonth() - m, 15);

  // Create deals
  const [d1] = await db.insert(dealsTable).values({
    userId: uid,
    brandName: "Mamaearth",
    campaignName: "Summer Skincare Reel – Instagram",
    incomeType: "brand_collab",
    amountAgreed: "75000",
    currency: "INR",
    status: "paid",
    isBarter: false,
    startDate: mo(3),
    dueDate: mo(2),
    notes: "2x Instagram Reels + Stories",
  }).returning();

  const [d2] = await db.insert(dealsTable).values({
    userId: uid,
    brandName: "Boat Lifestyle",
    campaignName: "Q2 YouTube Integration",
    incomeType: "brand_collab",
    amountAgreed: "150000",
    currency: "INR",
    status: "partially_paid",
    isBarter: false,
    startDate: mo(2),
    dueDate: mo(0),
    notes: "YouTube dedicated + 2 shorts",
  }).returning();

  const [d3] = await db.insert(dealsTable).values({
    userId: uid,
    brandName: "Amazon India",
    campaignName: "Affiliate – Tech Reviews",
    incomeType: "affiliate",
    amountAgreed: "30000",
    currency: "INR",
    status: "paid",
    isBarter: false,
    startDate: mo(4),
    dueDate: mo(3),
    notes: "Monthly affiliate payout Q1",
  }).returning();

  const [d4] = await db.insert(dealsTable).values({
    userId: uid,
    brandName: "YouTube",
    campaignName: "Channel Monetization – March",
    incomeType: "platform_payout",
    amountAgreed: "45000",
    currency: "INR",
    status: "paid",
    isBarter: false,
    startDate: mo(1),
    dueDate: new Date(now.getFullYear(), now.getMonth() - 1, 28),
    notes: "AdSense payout",
  }).returning();

  const [d5] = await db.insert(dealsTable).values({
    userId: uid,
    brandName: "Vedix",
    campaignName: "Monthly Content Retainer",
    incomeType: "retainer",
    amountAgreed: "60000",
    currency: "INR",
    status: "pending_payment",
    isBarter: false,
    startDate: new Date(now.getFullYear(), now.getMonth(), 1),
    dueDate: new Date(now.getFullYear(), now.getMonth(), 30),
    notes: "4 posts + 8 stories monthly",
  }).returning();

  const [d6] = await db.insert(dealsTable).values({
    userId: uid,
    brandName: "Nykaa",
    campaignName: "Gifted Collaboration – Beauty Haul",
    incomeType: "barter",
    amountAgreed: "15000",
    currency: "INR",
    status: "paid",
    isBarter: true,
    barterEstimatedValue: "15000",
    startDate: mo(1),
    dueDate: mo(1),
    notes: "Products gifted, 1 reel + 3 stories",
  }).returning();

  const [d7] = await db.insert(dealsTable).values({
    userId: uid,
    brandName: "Mivi",
    campaignName: "UGC – Product Unboxing Video",
    incomeType: "ugc",
    amountAgreed: "20000",
    currency: "INR",
    status: "overdue",
    isBarter: false,
    startDate: mo(3),
    dueDate: mo(1),
    notes: "3 UGC videos delivered",
  }).returning();

  const [d8] = await db.insert(dealsTable).values({
    userId: uid,
    brandName: "WOW Skin Science",
    campaignName: "Sponsored IG Post – April",
    incomeType: "brand_collab",
    amountAgreed: "40000",
    currency: "INR",
    status: "active",
    isBarter: false,
    startDate: new Date(now.getFullYear(), now.getMonth(), 1),
    dueDate: new Date(now.getFullYear(), now.getMonth() + 1, 15),
    notes: "1 Reel + swipe up link",
  }).returning();

  // Payments
  if (d1) {
    await db.insert(paymentsTable).values({ userId: uid, dealId: d1.id, amountReceived: "75000", currency: "INR", paymentMethod: "bank_transfer", receivedDate: mo(2), notes: "Full payment received" });
  }
  if (d2) {
    await db.insert(paymentsTable).values({ userId: uid, dealId: d2.id, amountReceived: "75000", currency: "INR", paymentMethod: "bank_transfer", receivedDate: mo(1), notes: "First installment" });
  }
  if (d3) {
    await db.insert(paymentsTable).values({ userId: uid, dealId: d3.id, amountReceived: "30000", currency: "INR", paymentMethod: "gateway", receivedDate: mo(3), notes: "Affiliate Q1" });
  }
  if (d4) {
    await db.insert(paymentsTable).values({ userId: uid, dealId: d4.id, amountReceived: "45000", currency: "INR", paymentMethod: "platform_payout", receivedDate: mo(1), notes: "AdSense March" });
  }

  // Expenses
  await db.insert(expensesTable).values([
    {
      userId: uid,
      dealId: d1?.id ?? null,
      title: "Video editor – Mamaearth reel",
      category: "editing",
      amount: "8000",
      currency: "INR",
      expenseDate: mo(2),
      notes: "Freelance editor",
    },
    {
      userId: uid,
      dealId: d2?.id ?? null,
      title: "Thumbnail designer – Boat collab",
      category: "editing",
      amount: "3000",
      currency: "INR",
      expenseDate: mo(1),
    },
    {
      userId: uid,
      dealId: null,
      title: "Mumbai → Bangalore flight",
      category: "travel",
      amount: "12000",
      currency: "INR",
      expenseDate: mo(2),
      notes: "Brand event attendance",
    },
    {
      userId: uid,
      dealId: null,
      title: "Manager commission – March",
      category: "manager_commission",
      amount: "22500",
      currency: "INR",
      expenseDate: mo(1),
      notes: "15% of March earnings",
    },
    {
      userId: uid,
      dealId: null,
      title: "Camera gimbal rental",
      category: "equipment",
      amount: "4500",
      currency: "INR",
      expenseDate: mo(2),
    },
    {
      userId: uid,
      dealId: null,
      title: "Adobe Creative Cloud",
      category: "software",
      amount: "5200",
      currency: "INR",
      expenseDate: mo(1),
      notes: "Annual subscription / 12",
    },
    {
      userId: uid,
      dealId: d1?.id ?? null,
      title: "Outfit styling – Skincare shoot",
      category: "styling",
      amount: "7000",
      currency: "INR",
      expenseDate: mo(3),
    },
    {
      userId: uid,
      dealId: null,
      title: "Instagram ads – personal brand",
      category: "ads",
      amount: "5000",
      currency: "INR",
      expenseDate: mo(1),
      notes: "Boosted reels",
    },
  ]);

  console.log("Seed complete!");
  console.log("Demo login: demo@kitna.app / demo1234");
  process.exit(0);
}

seed().catch(err => {
  console.error("Seed failed:", err);
  process.exit(1);
});
