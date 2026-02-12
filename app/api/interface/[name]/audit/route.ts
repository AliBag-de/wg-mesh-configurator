import { NextRequest } from "next/server";
import { auditQuerySchema, interfaceNameSchema } from "@/lib/provisioning/contracts";
import { apiError, apiOk, parseSearchParams } from "@/lib/provisioning/response";
import { getAudit } from "@/lib/provisioning/service";

export const dynamic = "force-dynamic";

type Params = { params: { name: string } };

export async function GET(request: NextRequest, { params }: Params) {
  const parsedName = interfaceNameSchema.safeParse(params.name);
  if (!parsedName.success) {
    return apiError(400, {
      code: "VALIDATION_ERROR",
      message: "Invalid interface name",
      details: parsedName.error.flatten()
    });
  }

  const queryResult = parseSearchParams(request.nextUrl.searchParams, auditQuerySchema);
  if (!queryResult.success) {
    return queryResult.response;
  }

  try {
    const data = await getAudit(parsedName.data, queryResult.data);
    return apiOk(data);
  } catch (error) {
    return apiError(500, {
      code: "INTERNAL_ERROR",
      message: error instanceof Error ? error.message : "Failed to read audit log"
    });
  }
}

