import { NextRequest } from "next/server";
import { interfaceNameSchema } from "@/lib/provisioning/contracts";
import { apiError, apiOk } from "@/lib/provisioning/response";
import { getInterfaceDetails } from "@/lib/provisioning/service";

export const dynamic = "force-dynamic";

type Params = { params: { name: string } };

export async function GET(_request: NextRequest, { params }: Params) {
  const parsedName = interfaceNameSchema.safeParse(params.name);
  if (!parsedName.success) {
    return apiError(400, {
      code: "VALIDATION_ERROR",
      message: "Invalid interface name",
      details: parsedName.error.flatten()
    });
  }

  try {
    const details = await getInterfaceDetails(parsedName.data);
    return apiOk(details);
  } catch (error) {
    return apiError(500, {
      code: "INTERNAL_ERROR",
      message: error instanceof Error ? error.message : "Failed to read interface"
    });
  }
}

