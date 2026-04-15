import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { PaymentFlowController } from "@/controllers/payment-flow-controller";

const paymentFlowRoute = new OpenAPIHono();
const controller = new PaymentFlowController();

/* ------------------------------------------------------------------ */
/*  Schemas                                                            */
/* ------------------------------------------------------------------ */

const GenerateRequestSchema = z
  .object({
    description: z.string().min(1).openapi({
      description: "Text description of the payment flow (meeting notes, verbal explanation, etc.)",
      example:
        "A customer pays at a merchant using a credit card, routed through the card network to the issuer for approval",
    }),
    model: z.string().optional().default("claude-sonnet-4-6").openapi({
      description: "LLM model to use",
    }),
  })
  .openapi("PaymentFlowGenerateRequest");

const FlowNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum(["entity", "process", "decision", "compliance"]),
  x: z.number().optional(),
  y: z.number().optional(),
});

const FlowEdgeSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  label: z.string(),
});

const FlowStructureSchema = z.object({
  nodes: z.array(FlowNodeSchema),
  edges: z.array(FlowEdgeSchema),
}).openapi("FlowStructure");

const PatchRequestSchema = z
  .object({
    current_xml: z.string().optional().openapi({
      description: "Current draw.io XML (optional, flow structure preferred)",
    }),
    current_flow: FlowStructureSchema.optional().openapi({
      description: "Current flow structure (nodes/edges) for agentic patching",
    }),
    feedback: z.string().min(1).openapi({
      description: "Revision feedback (e.g. Add a compliance review step)",
      example: "Add a compliance review step between the issuer and card network",
    }),
    model: z.string().optional().default("claude-sonnet-4-6").openapi({
      description: "LLM model to use",
    }),
  })
  .openapi("PaymentFlowPatchRequest");

const ComplianceItemSchema = z
  .object({
    category: z.enum(["risk", "question", "regulation"]).openapi({
      description: "Type of compliance note",
    }),
    severity: z.enum(["high", "medium", "low"]).openapi({
      description: "Severity level: high (blocking), medium (important), low (informational)",
    }),
    title: z.string().openapi({
      description: "Short title",
    }),
    detail: z.string().openapi({
      description: "Detailed explanation",
    }),
  })
  .openapi("ComplianceItem");

const FlowResponseSchema = z
  .object({
    drawio_xml: z.string().openapi({
      description: "Flowchart in draw.io XML format",
    }),
    summary: z.string().openapi({
      description: "Summary of the flow",
    }),
    entities: z.array(z.string()).openapi({
      description: "List of entities in the flow",
    }),
    model: z.string().openapi({
      description: "Model used",
    }),
    patch_description: z.string().optional().openapi({
      description: "Description of changes applied in patch",
    }),
    compliance_notes: z.array(ComplianceItemSchema).openapi({
      description: "Compliance risks, client questions, and applicable regulations",
    }),
    flow_structure: FlowStructureSchema.optional().openapi({
      description: "Structured flow data (nodes/edges) for subsequent patches",
    }),
  })
  .openapi("PaymentFlowResponse");

const ErrorSchema = z
  .object({
    error: z.string(),
    details: z.string().optional(),
  })
  .openapi("PaymentFlowError");

/* ------------------------------------------------------------------ */
/*  POST /generate — Initial generation                                */
/* ------------------------------------------------------------------ */

const generateRoute = createRoute({
  method: "post",
  path: "/generate",
  tags: ["payment-flow"],
  summary: "Generate payment flow diagram",
  description:
    "AI analyzes a text description and generates a draw.io XML diagram of the payment flow",
  request: {
    body: {
      content: { "application/json": { schema: GenerateRequestSchema } },
    },
  },
  responses: {
    200: {
      description: "Success",
      content: { "application/json": { schema: FlowResponseSchema } },
    },
    400: {
      description: "Validation error",
      content: { "application/json": { schema: ErrorSchema } },
    },
    500: {
      description: "Server error",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

paymentFlowRoute.openapi(generateRoute, async (c) => {
  try {
    const body = c.req.valid("json");
    const response = await controller.generate(body);
    return c.json(response, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isBadRequest =
      message.toLowerCase().includes("required") ||
      message.toLowerCase().includes("invalid");
    return c.json(
      {
        error: isBadRequest ? "Bad Request" : "Internal server error",
        details: message,
      },
      isBadRequest ? 400 : 500,
    );
  }
});

/* ------------------------------------------------------------------ */
/*  POST /patch — Agentic patch                                        */
/* ------------------------------------------------------------------ */

const patchRoute = createRoute({
  method: "post",
  path: "/patch",
  tags: ["payment-flow"],
  summary: "Agentic revision of payment flow diagram",
  description:
    "Receives existing draw.io XML and feedback, AI applies revisions and returns updated XML",
  request: {
    body: {
      content: { "application/json": { schema: PatchRequestSchema } },
    },
  },
  responses: {
    200: {
      description: "Success",
      content: { "application/json": { schema: FlowResponseSchema } },
    },
    400: {
      description: "Validation error",
      content: { "application/json": { schema: ErrorSchema } },
    },
    500: {
      description: "Server error",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

paymentFlowRoute.openapi(patchRoute, async (c) => {
  try {
    const body = c.req.valid("json");
    const response = await controller.patch(body);
    return c.json(response, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isBadRequest =
      message.toLowerCase().includes("required") ||
      message.toLowerCase().includes("invalid");
    return c.json(
      {
        error: isBadRequest ? "Bad Request" : "Internal server error",
        details: message,
      },
      isBadRequest ? 400 : 500,
    );
  }
});

export default paymentFlowRoute;
