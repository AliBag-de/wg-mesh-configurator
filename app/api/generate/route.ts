import { NextRequest } from "next/server";
import { generateZip } from "../../../lib/generate";
import { GeneratePayload } from "../../../lib/types";

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as GeneratePayload;
    const { content, filename } = await generateZip(payload);
    return new Response(content, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`
      }
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Bilinmeyen hata.";
    return new Response(message, { status: 400 });
  }
}
