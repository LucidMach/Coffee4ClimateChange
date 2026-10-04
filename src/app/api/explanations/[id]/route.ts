import { NextResponse } from "next/server";
import { apiError, getSession } from "@/lib/server";
import { getStore, DomainError } from "@/lib/store";
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const session = await getSession();
    const explanation = getStore().explanation(id);
    if (
      !explanation ||
      session.role !== "cafe" ||
      session.businessId !== explanation.supplierId
    )
      throw new DomainError(
        "Explanation not found in this supplier workspace.",
        404,
      );
    return NextResponse.json(
      { explanation },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
