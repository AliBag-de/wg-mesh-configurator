import { NextRequest } from "next/server";
import {
  interfaceNameSchema,
  toggleInterfaceRequestSchema
} from "@/lib/provisioning/contracts";
import { apiError, apiOk, parseJsonBody } from "@/lib/provisioning/response";
import { toggleInterfaceState } from "@/lib/provisioning/service";

export const dynamic = "force-dynamic";

type Params = { params: { name: string } };

export async function POST(request: NextRequest, { params }: Params) {
  const parsedName = interfaceNameSchema.safeParse(params.name);
  if (!parsedName.success) {
    return apiError(400, {
      code: "VALIDATION_ERROR",
      message: "Invalid interface name",
      details: parsedName.error.flatten()
    });
  }

  const bodyResult = await parseJsonBody(request, toggleInterfaceRequestSchema);
  if (!bodyResult.success) {
    return bodyResult.response;
  }

  try {
    const result = await toggleInterfaceState(parsedName.data, bodyResult.data);
    return apiOk(result);
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code: unknown }).code)
        : "INTERNAL_ERROR";
    const details =
      error && typeof error === "object" && "details" in error
        ? (error as { details: unknown }).details
        : undefined;

    if (code === "REVISION_CONFLICT") {
      return apiError(409, {
        code: "REVISION_CONFLICT",
        message: error instanceof Error ? error.message : "Revision mismatch",
        details
      });
    }

    return apiError(500, {
      code: "APPLY_FAILED",
      message: error instanceof Error ? error.message : "Failed to toggle interface",
      details
    });
  }
}

