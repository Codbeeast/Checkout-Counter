import { MongoClient, Db, ObjectId } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/onnxpay";

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  console.log("[MongoDB] 🔌 Connecting to database...");
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db();

  cachedClient = client;
  cachedDb = db;

  // Run seeder asynchronously to not block connection
  seedMongoData(db).catch((err) => console.error("[MongoDB] Seeding error:", err));

  return { client, db };
}

async function seedMongoData(db: Db) {
  try {
    const adsColl = db.collection("advertisements");
    const pmColl = db.collection("paymentmethods");

    const adsCount = await adsColl.countDocuments();
    const pmCount = await pmColl.countDocuments();

    if (adsCount > 0 && pmCount > 0) {
      console.log("[MongoDB] 📂 Collections already seeded. Skipping seeder.");
      return;
    }

    console.log("[MongoDB] 🌱 Seeding demo P2P vendor advertisements & payment methods...");

    // 1. Seed Payment Methods matching Image 2
    const testPaymentMethodId = new ObjectId("69ee4c2b29f1fdffe39d450e");
    const testVendorId = new ObjectId("69cfe5df8ed631b330505448");

    const dummyQrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=300x300&bgcolor=ffffff&color=0a1628&data=" + 
      encodeURIComponent("upi://pay?pa=gpay-1220902317@okbizaxis&pn=Jaiswal%20enterprises&am=1000.00&cu=INR");

    const seedPaymentMethods = [
      {
        _id: testPaymentMethodId,
        userId: testVendorId,
        type: "UPI",
        title: "test 3",
        upiId: "gpay-1220902317@okbizaxis", // added realistic UPI ID instead of null for standard UPI routing fallback
        accountHolderName: "Jaiswal enterprises", // mapped exactly to Screen 2 screenshot details
        accountNumber: "412357896510032",
        ifscCode: "SBIN0002458",
        bankName: "SBI",
        qrCodeUrl: dummyQrUrl,
        details: "SBI Bank Account for Instant P2P settlements",
        status: "Active",
        createdAt: new Date("2026-04-26T17:32:27.493Z"),
        updatedAt: new Date("2026-04-27T17:52:16.894Z"),
      },
      // Seed another payment method to demonstrate diversity (e.g. PhonePe matching PhonePe flow)
      {
        _id: new ObjectId("69ee4c2b29f1fdffe39d450f"),
        userId: new ObjectId("69cfe5df8ed631b330505449"),
        type: "UPI",
        title: "PhonePe Active",
        upiId: "swift.settle@ybl",
        accountHolderName: "Swift Settlement Services",
        accountNumber: "1009845610023",
        ifscCode: "BARB0COLABA",
        bankName: "Bank of Baroda",
        qrCodeUrl: "https://api.qrserver.com/v1/create-qr-code/?size=300x300&bgcolor=ffffff&color=0a1628&data=" + 
          encodeURIComponent("upi://pay?pa=swift.settle@ybl&pn=Swift%20Settlement%20Services&am=1000.00&cu=INR"),
        details: "PhonePe Auto-Approve channel",
        status: "Active",
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    ];

    await pmColl.deleteMany({});
    await pmColl.insertMany(seedPaymentMethods);
    console.log("[MongoDB] ✅ Seeded payment methods successfully");

    // 2. Seed Advertisements matching Image 1
    const seedAds = [
      {
        _id: new ObjectId("6a08b3992a5224514b116bed"),
        vendorId: testVendorId,
        adId: "ADV-161167KPBIHK",
        assetToken: "USDT",
        fiatCurrency: "INR",
        direction: "Sell",
        priceType: "Fixed",
        fixedPrice: 86.80, // Seeding realistic rate first (₹86.80 INR per USDT)
        totalQuantity: 800,
        matchQuantity: 800,
        minLimit: 800,
        maxLimit: 200000,
        paymentMethods: [testPaymentMethodId],
        terms: "pleas dont write crypto in transfer remarks",
        numTransactions: 0,
        amountTraded: 0,
        status: "Active",
        listingStatus: "Visible",
        createdAt: new Date("2026-05-16T18:12:41.169Z"),
        updatedAt: new Date("2026-05-16T18:12:41.169Z"),
      },
      // Seed another ad with a BETTER exchange rate (₹86.20 INR per USDT) to show the matching engine in action!
      {
        _id: new ObjectId("6a08b3992a5224514b116bee"),
        vendorId: new ObjectId("69cfe5df8ed631b330505449"),
        adId: "ADV-SWIFT7788",
        assetToken: "USDT",
        fiatCurrency: "INR",
        direction: "Sell",
        priceType: "Fixed",
        fixedPrice: 86.20, // Better exchange rate for customer!
        totalQuantity: 2000,
        matchQuantity: 2000,
        minLimit: 500,
        maxLimit: 100000,
        paymentMethods: [new ObjectId("69ee4c2b29f1fdffe39d450f")],
        terms: "Instant settlement, strict no third-party rule.",
        numTransactions: 120,
        amountTraded: 10340,
        status: "Active",
        listingStatus: "Visible",
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    ];

    await adsColl.deleteMany({});
    await adsColl.insertMany(seedAds);
    console.log("[MongoDB] ✅ Seeded advertisements successfully");

  } catch (err) {
    console.error("[MongoDB] Error seeding data:", err);
  }
}
