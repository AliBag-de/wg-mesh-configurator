import { apiError, apiOk } from "@/lib/provisioning/response";
import { listInterfaces } from "@/lib/provisioning/service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const interfaces = await listInterfaces();
    return apiOk({ interfaces });
  } catch (error) {
    return apiError(500, {
      code: "INTERNAL_ERROR",
      message: error instanceof Error ? error.message : "Failed to list interfaces"
    });
  }
}

