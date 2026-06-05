import { getAllPayments } from "@/lib/db";

export async function GET(_request: Request) {
  // TODO: Add authentication check
  const payments = await getAllPayments();
  
  return Response.json(payments);
}