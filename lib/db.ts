import { connectToDatabase } from "./mongodb";

export type PaymentStatus = "pending" | "confirming" | "completed" | "expired" | "cancelled" | "withheld";

export interface Payment {
  paymentId: string;
  orderId: string;
  amountINR: number;
  amountUSDT: number;
  exchangeRate: number;
  currency: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  callbackUrl: string;
  cancelUrl: string;
  merchantApiKey: string;
  status: PaymentStatus;
  createdAt: number;
  expiresAt: number;
  txHash?: string;

  // P2P fields
  paymentMethod?: string;
  adId?: string;
  vendorId?: string;
  vendorName?: string;
  vendorUpiId?: string;
  vendorBankName?: string;
  vendorAccountHolder?: string;
  vendorAccountNumber?: string;
  vendorIfscCode?: string;
  vendorQrCode?: string;
  utrNumber?: string;
  payerName?: string;
  screenshotUrl?: string;
  vendorApproval?: string;
  liquidityLocked?: boolean;
  verificationType?: string;
  merchantUserId?: string;

  // Withheld/Fee fields
  frozenTimeLeft?: number;
  fee?: number;
  payinCommissionRate?: number;
}

export async function savePayment(payment: Payment) {
  try {
    const { db } = await connectToDatabase();
    
    try {
      await db.collection("payments").insertOne({
        ...payment,
        updatedAt: new Date()
      });
    } catch (insertErr: any) {
      // Self-healing: if duplicate key error occurs on the legacy unique walletAddress index, drop it and retry
      if (insertErr.code === 11000 && (insertErr.message.includes("walletAddress_1") || insertErr.errmsg?.includes("walletAddress_1"))) {
        console.warn(`[DB] ⚠️ Found duplicate key error on legacy unique index 'walletAddress_1'. Programmatically dropping index and retrying...`);
        try {
          await db.collection("payments").dropIndex("walletAddress_1");
          console.log(`[DB] ✅ Legacy unique index 'walletAddress_1' dropped successfully.`);
        } catch (dropErr) {
          console.error(`[DB] Failed to drop unique index:`, dropErr);
        }
        
        // Retry insertion
        await db.collection("payments").insertOne({
          ...payment,
          updatedAt: new Date()
        });
      } else {
        throw insertErr;
      }
    }
    console.log(`[DB] ✅ Payment saved to MongoDB: ${payment.paymentId}`);
  } catch (err) {
    console.error("[DB] Error saving payment to MongoDB:", err);
    throw err;
  }
}

export async function getPayment(paymentId: string): Promise<Payment | undefined> {
  try {
    const { db } = await connectToDatabase();
    const row = await db.collection("payments").findOne({ paymentId });
    if (!row) return undefined;
    return {
      paymentId: row.paymentId,
      orderId: row.orderId,
      amountINR: Number(row.amountINR),
      amountUSDT: Number(row.amountUSDT),
      exchangeRate: Number(row.exchangeRate),
      currency: row.currency,
      customerName: row.customerName,
      customerEmail: row.customerEmail,
      customerPhone: row.customerPhone,
      callbackUrl: row.callbackUrl,
      cancelUrl: row.cancelUrl,
      merchantApiKey: row.merchantApiKey,
      status: row.status,
      createdAt: Number(row.createdAt),
      expiresAt: Number(row.expiresAt),
      txHash: row.txHash,
      paymentMethod: row.paymentMethod,
      adId: row.adId,
      vendorId: row.vendorId,
      vendorName: row.vendorName,
      vendorUpiId: row.vendorUpiId,
      vendorBankName: row.vendorBankName,
      vendorAccountHolder: row.vendorAccountHolder,
      vendorAccountNumber: row.vendorAccountNumber,
      vendorIfscCode: row.vendorIfscCode,
      vendorQrCode: row.vendorQrCode,
      utrNumber: row.utrNumber,
      payerName: row.payerName,
      screenshotUrl: row.screenshotUrl,
      vendorApproval: row.vendorApproval,
      liquidityLocked: row.liquidityLocked,
      verificationType: row.verificationType,
      merchantUserId: row.merchantUserId,
      frozenTimeLeft: row.frozenTimeLeft !== undefined ? Number(row.frozenTimeLeft) : undefined,
      fee: row.fee !== undefined ? Number(row.fee) : undefined,
      payinCommissionRate: row.payinCommissionRate !== undefined ? Number(row.payinCommissionRate) : undefined,
    };
  } catch (err) {
    console.error("[DB] Error getting payment from MongoDB:", err);
    return undefined;
  }
}

export async function updatePayment(
  paymentId: string,
  updates: Partial<Payment>
) {
  try {
    const { db } = await connectToDatabase();
    
    // Map camelCase keys to match our document layout
    const cleanUpdates: Record<string, any> = {};
    for (const [key, val] of Object.entries(updates)) {
      if (val !== undefined) {
        cleanUpdates[key] = val;
      }
    }

    if (Object.keys(cleanUpdates).length === 0) return;

    await db.collection("payments").updateOne(
      { paymentId },
      {
        $set: {
          ...cleanUpdates,
          updatedAt: new Date()
        }
      }
    );
    console.log(`[DB] ✅ Payment updated in MongoDB: ${paymentId}`);
  } catch (err) {
    console.error("[DB] Error updating payment in MongoDB:", err);
  }
}

export async function getAllPayments(): Promise<Payment[]> {
  try {
    const { db } = await connectToDatabase();
    const rows = await db.collection("payments").find({}).toArray();
    return rows.map((row) => ({
      paymentId: row.paymentId,
      orderId: row.orderId,
      amountINR: Number(row.amountINR),
      amountUSDT: Number(row.amountUSDT),
      exchangeRate: Number(row.exchangeRate),
      currency: row.currency,
      customerName: row.customerName,
      customerEmail: row.customerEmail,
      customerPhone: row.customerPhone,
      callbackUrl: row.callbackUrl,
      cancelUrl: row.cancelUrl,
      merchantApiKey: row.merchantApiKey,
      status: row.status,
      createdAt: Number(row.createdAt),
      expiresAt: Number(row.expiresAt),
      txHash: row.txHash,
      paymentMethod: row.paymentMethod,
      adId: row.adId,
      vendorId: row.vendorId,
      vendorName: row.vendorName,
      vendorUpiId: row.vendorUpiId,
      vendorBankName: row.vendorBankName,
      vendorAccountHolder: row.vendorAccountHolder,
      vendorAccountNumber: row.vendorAccountNumber,
      vendorIfscCode: row.vendorIfscCode,
      vendorQrCode: row.vendorQrCode,
      utrNumber: row.utrNumber,
      payerName: row.payerName,
      screenshotUrl: row.screenshotUrl,
      vendorApproval: row.vendorApproval,
      liquidityLocked: row.liquidityLocked,
      verificationType: row.verificationType,
      merchantUserId: row.merchantUserId,
      frozenTimeLeft: row.frozenTimeLeft !== undefined ? Number(row.frozenTimeLeft) : undefined,
      fee: row.fee !== undefined ? Number(row.fee) : undefined,
      payinCommissionRate: row.payinCommissionRate !== undefined ? Number(row.payinCommissionRate) : undefined,
    }));
  } catch (err) {
    console.error("[DB] Error getting all payments from MongoDB:", err);
    return [];
  }
}


export async function closePool() {
  // No-op for MongoDB
}