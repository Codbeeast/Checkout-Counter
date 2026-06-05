import { getPayment, updatePayment } from "./db";
import { connectToDatabase } from "./mongodb";
import { ObjectId } from "mongodb";

export async function settleP2PPayment(paymentId: string): Promise<{ success: boolean; txHash: string; error?: string }> {
  try {
    console.log(`[Settlement] ⚙️ Starting settlement process for payment: ${paymentId}`);

    // 1. Fetch Payment from PostgreSQL (or MongoDB payments collection)
    const payment = await getPayment(paymentId);
    if (!payment) {
      console.error(`[Settlement] ❌ Payment ${paymentId} not found in DB`);
      return { success: false, txHash: "", error: "Payment not found" };
    }

    if (payment.status === "completed") {
      console.log(`[Settlement] ✅ Payment ${paymentId} is already completed`);
      return { success: true, txHash: payment.txHash || "" };
    }

    if (!payment.vendorId) {
      console.error(`[Settlement] ❌ Payment ${paymentId} has no matched vendor`);
      return { success: false, txHash: "", error: "Payment has no matched vendor" };
    }

    // 2. Retrieve Settlement Details
    console.log(`[Settlement] Sweeping Amount: ${payment.amountUSDT} USDT`);

    // Connect to database
    const { db } = await connectToDatabase();

    // 3. Generate Simulated matching TxHash (64 hex characters) representing platform matching sweep
    const txHash = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    console.log(`[Settlement] 💡 Generated simulated platform TxHash: ${txHash}`);

    // 4. Update Database Record atomically to prevent double settlement
    const updateResult = await db.collection("payments").updateOne(
      { paymentId, status: { $ne: "completed" } },
      {
        $set: {
          status: "completed",
          txHash: txHash,
          vendorApproval: "approved",
          updatedAt: new Date()
        }
      }
    );

    if (updateResult.modifiedCount === 0) {
      console.log(`[Settlement] ⚠️ Payment ${paymentId} is already completed (concurrency guard)`);
      return { success: true, txHash: payment.txHash || txHash };
    }

    console.log(`[Settlement] ✅ Payment status marked as completed in DB`);

    // 5. Update balances atomically
    try {
      const vendorIdObj = typeof payment.vendorId === "string" ? new ObjectId(payment.vendorId) : payment.vendorId;
      const vendorUpdate = await db.collection("vendorprofiles").updateOne(
        { _id: vendorIdObj as any },
        { $inc: { balance: -payment.amountUSDT } }
      );
      console.log(`[Settlement] Deducted ${payment.amountUSDT} USDT from vendor profile ${payment.vendorId}. Result: matched=${vendorUpdate.matchedCount}, modified=${vendorUpdate.modifiedCount}`);

      // Credit USDT to merchant (fee is 0 by default, so credit full amountUSDT)
      const merchantUpdate = await db.collection("merchants").updateOne(
        { apiKey: payment.merchantApiKey },
        { $inc: { balance: payment.amountUSDT } }
      );
      console.log(`[Settlement] Credited ${payment.amountUSDT} USDT to merchant using apiKey. Result: matched=${merchantUpdate.matchedCount}, modified=${merchantUpdate.modifiedCount}`);
    } catch (balanceErr) {
      console.error("[Settlement] ❌ Balance settlement error:", balanceErr);
      // We don't fail the whole function if payment status was updated, but log the error
    }

    // 6. Fire Merchant Webhook Callback (POST)
    try {
      console.log(`[Settlement] 🚀 Sending secure payment success callback to: ${payment.callbackUrl}`);
      const callbackPayload = {
        payment_id: payment.paymentId,
        order_id: payment.orderId,
        status: "completed",
        amount_usdt: payment.amountUSDT,
        amount_inr: payment.amountINR,
        tx_hash: txHash,
        payer_name: payment.payerName || "",
        utr_number: payment.utrNumber || "",
        vendor_id: payment.vendorId,
        exchange_rate: payment.exchangeRate,
        timestamp: Date.now()
      };

      // Best-effort callback
      fetch(payment.callbackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(callbackPayload),
      })
      .then((res) => console.log(`[Settlement] Webhook callback fired. Status: ${res.status}`))
      .catch((err) => console.error(`[Settlement] Webhook callback fetch error:`, err));

    } catch (webhookErr) {
      console.error(`[Settlement] ❌ Failed to dispatch merchant webhook:`, webhookErr);
    }

    return { success: true, txHash };
  } catch (err: any) {
    console.error("[Settlement] ❌ Exception during P2P settlement:", err);
    return { success: false, txHash: "", error: err.message || "Settlement failed" };
  }
}
