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

export function isSudoPasswordError(message: string): boolean {
  if (!message) return false;
  const lowerMsg = message.toLowerCase();
  return (
    lowerMsg.includes("sudo: a password is required") ||
    lowerMsg.includes("a terminal is required to read the password") ||
    lowerMsg.includes("sudo: no tty present")
  );
}

export function getSudoInstruction(user?: string): string {
  const targetUser = user || "<your-user>";
  return `
[!] ERROR: Sudo password required.
Automated systems cannot enter a password interactively.
Please configure passwordless sudo for '${targetUser}' on the target system:
1. Run: sudo visudo
2. Add this line: ${targetUser} ALL=(ALL) NOPASSWD: ALL
`.trim();
}

/**
 * Creates a JSON response for an error.
 * Automatically appends sudo instructions if a sudo password error is detected.
 */
export function apiError(
  status: number,
  body: ErrorPayload,
  originalError?: any
) {
  let message = body.message;
  let instructions = originalError?.instructions;

  // Check for sudo password error in original error or message
  const errorText = originalError?.stderr || originalError?.message || message;
  if (isSudoPasswordError(errorText)) {
    const sudoInstr = getSudoInstruction();
    if (!instructions) {
      instructions = sudoInstr;
    } else {
      instructions = `${instructions}\n\n${sudoInstr}`;
    }
  } else if (originalError && "stderr" in originalError && originalError.stderr && !instructions) {
    message += `\n\n[Stderr]: ${originalError.stderr}`;
  }

  return NextResponse.json(
    {
      ok: false,
      error: {
        ...body,
        message,
        instructions
      }
    },
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

