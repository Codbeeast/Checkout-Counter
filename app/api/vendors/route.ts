import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { settleP2PPayment } from "@/lib/settle_p2p";
import { updatePayment, getPayment } from "@/lib/db";
import { ObjectId } from "mongodb";

export async function GET(_request: NextRequest) {
  try {
    const { db } = await connectToDatabase();

    const ads = await db.collection("advertisements").find({}).toArray();
    const resolvedVendors = [];

    for (const ad of ads) {
      const vendorIdStr = ad.vendorId.toString();
      const cleanId = vendorIdStr.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10);
      const walletAddress = `TStubVendorAddress_${cleanId || "Default"}`;
      
      // Simulated wallet balance (USDT/TRX)
      const balance = 1000;

      // Get payment methods
      const pmIds = (ad.paymentMethods || []).map((id: any) => new ObjectId(id));
      const methods = await db.collection("paymentmethods")
        .find({ _id: { $in: pmIds } })
        .toArray();

      resolvedVendors.push({
        vendorId: vendorIdStr,
        adId: ad.adId,
        fixedPrice: ad.fixedPrice,
        minLimit: ad.minLimit,
        maxLimit: ad.maxLimit,
        terms: ad.terms,
        walletAddress,
        walletBalance: balance,
        paymentMethods: methods.map((m) => ({
          id: m._id.toString(),
          type: m.type,
          title: m.title,
          accountHolderName: m.accountHolderName,
          upiId: m.upiId,
          bankName: m.bankName,
          accountNumber: m.accountNumber,
          ifscCode: m.ifscCode,
          qrCodeUrl: m.qrCodeUrl
        }))
      });
    }

    return Response.json(resolvedVendors);

  } catch (err: any) {
    console.error("[API/Vendors] GET error:", err);
    return Response.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { paymentId, approve } = body;

    if (!paymentId) {
      return Response.json({ error: "Missing paymentId" }, { status: 400 });
    }

    const payment = await getPayment(paymentId);
    if (!payment) {
      return Response.json({ error: "Payment not found" }, { status: 404 });
    }

    if (payment.status === "completed") {
      return Response.json({ error: "Payment already completed" }, { status: 400 });
    }

    if (approve) {
      console.log(`[API/Vendors] Vendor manually APPROVED payment: ${paymentId}`);
      
      // Execute the P2P Settlement sweep
      const result = await settleP2PPayment(paymentId);

      if (!result.success) {
        return Response.json({ error: result.error || "Settlement failed" }, { status: 500 });
      }

      return Response.json({
        success: true,
        status: "completed",
        txHash: result.txHash
      });
    } else {
      console.log(`[API/Vendors] Vendor manually REJECTED payment: ${paymentId}`);

      // Cancel order and flag rejection
      await updatePayment(paymentId, {
        status: "cancelled",
        vendorApproval: "rejected"
      });

      return Response.json({
        success: true,
        status: "cancelled"
      });
    }

  } catch (err: any) {
    console.error("[API/Vendors] POST error:", err);
    return Response.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
