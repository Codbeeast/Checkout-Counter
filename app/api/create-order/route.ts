import { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { savePayment } from "@/lib/db";
import { connectToDatabase } from "@/lib/mongodb";

const EXCHANGE_RATE = parseFloat(process.env.USDT_INR_RATE || "86.8");
const PAYMENT_TTL_MS = 15 * 60 * 1000; // 15 minutes

async function validateApiKey(apiKey: string | null): Promise<boolean> {
  if (!apiKey) return false;

  // Allow fallback bypass only for standard 'test' in development/sandbox testing
  if (apiKey === "test" && process.env.NODE_ENV !== "production") {
    return true;
  }

  try {
    const { db } = await connectToDatabase();
    const merchant = await db.collection("merchants").findOne({
      apiKey: apiKey,
      accountStatus: "APPROVED"
    });
    return !!merchant;
  } catch (err) {
    console.error("[API KEY VALIDATION ERROR]", err);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get("x-api-key");

    if (!(await validateApiKey(apiKey))) {
      return Response.json({ error: "Invalid API key" }, { status: 401 });
    }

    const body = await request.json();
    const { amount_inr, currency, order_id, customer_details, callback_url, cancel_url } = body;

    // Basic validation
    if (!amount_inr || !order_id || !customer_details || !callback_url) {
      return Response.json(
        { error: "Missing required fields: amount_inr, order_id, customer_details, callback_url" },
        { status: 400 }
      );
    }

    // Generate payment ID
    const paymentId = `pay_${uuidv4().replace(/-/g, "").slice(0, 16)}`;

    // Calculate USDT amount
    const amountUSDT = parseFloat((amount_inr / EXCHANGE_RATE).toFixed(2));

    const now = Date.now();

    // Save payment to MongoDB
    const merchantUserId = customer_details.merchant_user_id || body.merchant_user_id || body.merchant_userId || "";

    await savePayment({
      paymentId,
      orderId: order_id,
      amountINR: amount_inr,
      amountUSDT,
      exchangeRate: EXCHANGE_RATE,
      currency: currency || "INR",
      customerName: customer_details.name || "",
      customerEmail: customer_details.email || "",
      customerPhone: customer_details.phone || "",
      merchantUserId: merchantUserId,
      callbackUrl: callback_url,
      cancelUrl: cancel_url || "",
      merchantApiKey: apiKey || "test",
      status: "pending",
      createdAt: now,
      expiresAt: now + PAYMENT_TTL_MS,
    });

    // Build the checkout URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;
    const checkoutUrl = `${baseUrl}/pay/${paymentId}`;

    return Response.json({
      success: true,
      payment_id: paymentId,
      checkout_url: checkoutUrl,
      amount_usdt: amountUSDT,
      exchange_rate: EXCHANGE_RATE,
      expires_at: new Date(now + PAYMENT_TTL_MS).toISOString(),
    });
  } catch (err: any) {
    console.error("create-order error:", err);
    return Response.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}