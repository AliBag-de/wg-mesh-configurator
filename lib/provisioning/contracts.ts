import { z } from "zod";

export const interfaceNameSchema = z
  .string()
  .min(1)
  .max(32)
  .regex(/^[a-zA-Z0-9_.-]+$/, "Invalid interface name");

export const revisionSchema = z.number().int().min(0);

export const peerSchema = z.object({
  peerId: z.string().uuid(),
  name: z.string().min(1).max(128),
  publicKey: z.string().min(8),
  privateKey: z.string().min(8).optional(),
  allowedIps: z.array(z.string().min(3)).min(1),
  endpoint: z.string().min(3).optional(),
  persistentKeepalive: z.number().int().min(0).max(65535).optional(),
  isActive: z.boolean(),
  interface: z.string().min(1).max(32).optional() // Scope peer to interface
});

export const applyAddOperationSchema = z.object({
  op: z.literal("add"),
  peer: peerSchema
});

export const applyUpdateOperationSchema = z.object({
  op: z.literal("update"),
  peerId: z.string().uuid(),
  patch: z
    .object({
      name: z.string().min(1).max(128).optional(),
      allowedIps: z.array(z.string().min(3)).min(1).optional(),
      endpoint: z.string().min(3).optional(),
      persistentKeepalive: z.number().int().min(0).max(65535).optional()
    })
    .refine((value) => Object.keys(value).length > 0, {
      message: "patch cannot be empty"
    })
});

export const applyToggleOperationSchema = z.object({
  op: z.literal("toggle"),
  peerId: z.string().uuid(),
  isActive: z.boolean()
});

export const applyRemoveOperationSchema = z.object({
  op: z.literal("remove"),
  peerId: z.string().uuid()
});

export const applyOperationSchema = z.discriminatedUnion("op", [
  applyAddOperationSchema,
  applyUpdateOperationSchema,
  applyToggleOperationSchema,
  applyRemoveOperationSchema
]);

export const applyPeersRequestSchema = z.object({
  revision: revisionSchema,
  dryRun: z.boolean().default(false),
  operations: z.array(applyOperationSchema).min(1)
});

export const toggleInterfaceRequestSchema = z.object({
  revision: revisionSchema,
  isUp: z.boolean(),
  dryRun: z.boolean().default(false)
});

export const reconcileRequestSchema = z.object({
  revision: revisionSchema,
  mode: z.enum(["runtime_to_state", "state_to_runtime"])
});

export const auditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().min(1).optional()
});

export type Peer = z.infer<typeof peerSchema>;
export type ApplyPeersRequest = z.infer<typeof applyPeersRequestSchema>;
export type ToggleInterfaceRequest = z.infer<typeof toggleInterfaceRequestSchema>;
export type ReconcileRequest = z.infer<typeof reconcileRequestSchema>;
export type AuditQuery = z.infer<typeof auditQuerySchema>;

export const apiErrorCodeSchema = z.enum([
  "VALIDATION_ERROR",
  "INTERFACE_NOT_FOUND",
  "REVISION_CONFLICT",
  "LOCKED",
  "APPLY_FAILED",
  "INTERNAL_ERROR"
]);

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

