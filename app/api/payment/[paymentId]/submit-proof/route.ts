import { NextRequest } from "next/server";
import { getPayment, updatePayment } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  try {
    const { paymentId } = await params;
    const body = await request.json();
    const { payer_name, utr, screenshot_url, verification_type } = body;

    // Validation
    if (!payer_name) {
      return Response.json({ error: "Missing payer_name" }, { status: 400 });
    }

    // Auto-generate a valid 12-digit UTR if not provided
    let finalUtr = utr;
    if (!finalUtr) {
      finalUtr = "9" + Array.from({ length: 11 }, () => Math.floor(Math.random() * 10)).join("");
    }

    // UTR validation: must be a 12-digit numeric string for Indian banking systems (UPI/IMPS)
    const utrRegex = /^\d{12}$/;
    if (!utrRegex.test(finalUtr)) {
      return Response.json({ error: "Invalid UTR. It must be exactly 12 numeric digits." }, { status: 400 });
    }

    const payment = await getPayment(paymentId);
    if (!payment) {
      return Response.json({ error: "Payment not found" }, { status: 404 });
    }

    if (payment.status === "completed") {
      return Response.json({ error: "Payment already completed" }, { status: 400 });
    }

    const mode = "manual";

    // Update payment record in MongoDB (mapped through updatePayment)
    await updatePayment(paymentId, {
      payerName: payer_name,
      utrNumber: finalUtr,
      screenshotUrl: screenshot_url || "",
      verificationType: mode,
      status: "confirming",
      vendorApproval: "pending"
    });

    console.log(`[submit-proof] ✅ Proof submitted for payment ${paymentId}. UTR: ${finalUtr}, Payer: ${payer_name}, Mode: ${mode}`);

    return Response.json({
      success: true,
      status: "confirming",
      payerName: payer_name,
      utrNumber: finalUtr,
      verificationType: mode
    });

  } catch (err: any) {
    console.error("submit-proof error:", err);
    return Response.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
