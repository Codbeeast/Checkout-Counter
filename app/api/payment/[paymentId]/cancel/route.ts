import { getPayment, updatePayment } from "@/lib/db";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  const { paymentId } = await params;
  const payment = await getPayment(paymentId);

  if (!payment) {
    return Response.json({ error: "Payment not found" }, { status: 404 });
  }

  if (payment.status === "completed") {
    return Response.json({ error: "Cannot cancel completed payment" }, { status: 400 });
  }

  await updatePayment(paymentId, { status: "cancelled", adId: "" });

  return Response.json({ success: true, status: "cancelled" });
}