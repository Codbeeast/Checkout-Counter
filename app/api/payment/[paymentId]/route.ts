import { getPayment } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  const { paymentId } = await params;
  const payment = await getPayment(paymentId);

  if (!payment) {
    return Response.json({ error: "Payment not found" }, { status: 404 });
  }

  return Response.json(payment);
}