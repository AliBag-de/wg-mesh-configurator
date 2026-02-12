import { ZodError, ZodSchema } from "zod";
import { NextResponse } from "next/server";
import { ApiErrorCode } from "./contracts";

type ErrorPayload = {
  code: ApiErrorCode;
  message: string;
  details?: unknown;
};

export function apiOk<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function apiError(status: number, error: ErrorPayload) {
  return NextResponse.json(
    { ok: false, error },
    { status }
  );
}

export async function parseJsonBody<T>(
  request: Request,
  schema: ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; response: NextResponse }> {
  try {
    const json = await request.json();
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return {
        success: false,
        response: apiError(400, {
          code: "VALIDATION_ERROR",
          message: "Invalid request body",
          details: parsed.error.flatten()
        })
      };
    }
    return { success: true, data: parsed.data };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        success: false,
        response: apiError(400, {
          code: "VALIDATION_ERROR",
          message: "Invalid request body",
          details: error.flatten()
        })
      };
    }
    return {
      success: false,
      response: apiError(400, {
        code: "VALIDATION_ERROR",
        message: "Request body is not valid JSON"
      })
    };
  }
}

export function parseSearchParams<T>(
  params: URLSearchParams,
  schema: ZodSchema<T>
): { success: true; data: T } | { success: false; response: NextResponse } {
  const raw: Record<string, string> = {};
  params.forEach((value, key) => {
    raw[key] = value;
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      response: apiError(400, {
        code: "VALIDATION_ERROR",
        message: "Invalid query params",
        details: parsed.error.flatten()
      })
    };
  }
  return { success: true, data: parsed.data };
}

