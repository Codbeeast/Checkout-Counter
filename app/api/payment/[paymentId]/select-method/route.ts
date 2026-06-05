import { NextRequest } from "next/server";
import { getPayment, updatePayment } from "@/lib/db";
import { findBestVendorForOrder } from "@/lib/matching";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  try {
    const { paymentId } = await params;
    const body = await request.json();
    const { payment_method } = body;

    if (!payment_method) {
      return Response.json({ error: "Missing payment_method" }, { status: 400 });
    }

    const payment = await getPayment(paymentId);
    if (!payment) {
      return Response.json({ error: "Payment not found" }, { status: 404 });
    }

    if (payment.status === "completed") {
      return Response.json({ error: "Payment already completed" }, { status: 400 });
    }

    

    // Run matching engine
    const matched = await findBestVendorForOrder(payment.amountINR, payment_method);
    if (!matched) {
      return Response.json({
        error: `No active vendors found supporting limit sizes of ₹${payment.amountINR} INR via ${payment_method}`
      }, { status: 404 });
    }


    // Calculate dynamic USDT amount based on vendor's specific exchange rate
    const amountUSDT = parseFloat((payment.amountINR / matched.exchangeRate).toFixed(2));

    const updates = {
      paymentMethod: payment_method,
      adId: matched.adId,
      vendorId: matched.vendorId,
      vendorName: matched.accountHolderName,
      vendorUpiId: matched.upiId || "",
      vendorBankName: matched.bankName || "",
      vendorAccountHolder: matched.accountHolderName,
      vendorAccountNumber: matched.accountNumber || "",
      vendorIfscCode: matched.ifscCode || "",
      vendorQrCode: matched.qrCodeUrl || "",
      amountUSDT: amountUSDT,
      exchangeRate: matched.exchangeRate,
      liquidityLocked: true,
      status: "pending" as const
    };


    // Update payment record in MongoDB
    await updatePayment(paymentId, updates);

    // Verify database record has been updated
    const verified = await getPayment(paymentId);


    return Response.json({
      success: true,
      paymentMethod: payment_method,
      vendorName: matched.accountHolderName,
      vendorUpiId: matched.upiId || "",
      vendorBankName: matched.bankName || "",
      vendorAccountHolder: matched.accountHolderName,
      vendorAccountNumber: matched.accountNumber || "",
      vendorIfscCode: matched.ifscCode || "",
      vendorQrCode: matched.qrCodeUrl || "",
      amountUSDT,
      exchangeRate: matched.exchangeRate
    });

  } catch (err: any) {
    console.error("select-method error:", err);
    return Response.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
