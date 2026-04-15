import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface GenerateRequest {
  description: string;
  model?: string;
}

export interface PatchRequest {
  current_xml: string;
  feedback: string;
  model?: string;
  /** Pass the structured flow so the LLM can patch it instead of raw XML */
  current_flow?: FlowStructure;
}

export interface ComplianceItem {
  category: "risk" | "question" | "regulation";
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
}

export interface FlowNode {
  id: string;
  label: string;
  type: "entity" | "process" | "decision" | "compliance";
  x?: number;
  y?: number;
}

export interface FlowEdge {
  id: string;
  from: string;
  to: string;
  label: string;
}

export interface FlowStructure {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface FlowResponse {
  drawio_xml: string;
  summary: string;
  entities: string[];
  model: string;
  patch_description?: string;
  compliance_notes: ComplianceItem[];
  /** Return the structured flow so the frontend can pass it back for patches */
  flow_structure: FlowStructure;
}

/* ------------------------------------------------------------------ */
/*  Prompts — LLM outputs structured data, NOT raw XML                 */
/* ------------------------------------------------------------------ */

const GENERATE_SYSTEM = `You are an expert in banking payment flow analysis, specializing in producing diagrams that compliance and risk teams can immediately understand.

A Relationship Manager (RM) at a bank has gathered information from a client about their payment flow. Your job is to analyze the input and produce a structured flow description.

## Key Principles
- Make the flow COMPLIANCE-READABLE: clearly show where money moves, who touches it, and where regulatory checkpoints (KYC, AML, OFAC, sanctions screening) occur
- Infer standard compliance/risk steps even if the client didn't mention them (e.g., AML screening is always present in bank-to-bank flows)
- Label every edge clearly so the flow can be followed without explanation

## Node Types (use these exactly)
- "entity": Organizations / people (banks, merchants, customers, networks, fintechs)
- "process": Processing steps (authorization, settlement, routing, reconciliation)
- "decision": Decision / branching points (approve/decline, eligibility check)
- "compliance": Compliance & risk steps (KYC, AML, OFAC, fraud screening, sanctions)

## Response Format
Output ONLY the following JSON (no other text, no markdown fences):
{
  "nodes": [
    {"id": "n1", "label": "Cardholder", "type": "entity"},
    {"id": "n2", "label": "AML Screening", "type": "compliance"}
  ],
  "edges": [
    {"id": "e1", "from": "n1", "to": "n2", "label": "Payment Request"}
  ],
  "summary": "Brief summary of the flow",
  "entities": ["Cardholder", "Merchant", ...],
  "compliance_notes": [
    {"category": "risk", "severity": "high", "title": "Title", "detail": "Detail"},
    {"category": "question", "severity": "medium", "title": "Title", "detail": "Detail"},
    {"category": "regulation", "severity": "low", "title": "Title", "detail": "Detail"}
  ]
}

## compliance_notes Guidelines
- "category": "risk" | "question" | "regulation"
  - "risk": Compliance/regulatory risks (e.g., missing AML screening, sanctions exposure)
  - "question": Questions the RM should ask the client to fill compliance gaps
  - "regulation": Applicable regulations (BSA/AML, OFAC, Reg E, PCI DSS, etc.)
- "severity": "high" | "medium" | "low"
  - "high": Blocking issue, must be resolved before proceeding (e.g., missing mandatory AML/OFAC screening, unlicensed money transmission)
  - "medium": Important concern that should be addressed (e.g., unclear settlement timing, missing fraud controls)
  - "low": Informational or best-practice recommendation (e.g., optional 3D Secure, additional monitoring)
- Include at least 3-5 compliance notes
- Be specific to the actual flow, not generic

## Layout Hints
- Assign x,y coordinates to nodes for a clean layout (optional but helpful)
- Use increments of ~240 for x and ~140 for y
- Keep nodes from overlapping`;

const PATCH_SYSTEM = `You are an expert in banking payment flow analysis.
The user provides the current flow structure (nodes and edges) and feedback describing changes.
Apply the requested changes and return the updated flow structure.

## Rules
- Preserve existing node IDs as much as possible
- Only make changes specified in the feedback
- Handle node additions, deletions, label changes, edge changes, type changes
- Adjust layout (x,y) so nodes don't overlap after changes
- Keep node IDs consistent (e.g., n1, n2, ...) and edge IDs (e.g., e1, e2, ...)

## Node Types
- "entity": Organizations / people
- "process": Processing steps
- "decision": Decision / branching points
- "compliance": Compliance & risk steps

## Response Format
Output ONLY the following JSON (no other text, no markdown fences):
{
  "nodes": [...],
  "edges": [...],
  "summary": "Description of changes",
  "entities": [...],
  "patch_description": "What was changed (1-2 sentences)",
  "compliance_notes": [
    {"category": "risk"|"question"|"regulation", "severity": "high"|"medium"|"low", "title": "...", "detail": "..."}
  ]
}

Update compliance_notes to reflect the revised flow. Assign severity: "high" for blocking issues, "medium" for important concerns, "low" for informational.`;

const FIX_PROMPT = `Your previous response could not be parsed as valid JSON.

## Parse Error
{{ERROR}}

## Your Previous Output (truncated)
{{RAW_OUTPUT}}

Please output ONLY a valid JSON object. No markdown fences, no explanations. Just the raw JSON starting with { and ending with }.`;

/* ------------------------------------------------------------------ */
/*  draw.io XML Builder — deterministic, no LLM involved               */
/* ------------------------------------------------------------------ */

const STYLE_MAP: Record<FlowNode["type"], { style: string; w: number; h: number }> = {
  entity: {
    style: "rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;fontSize=14;fontStyle=1;shadow=1;arcSize=20;",
    w: 170,
    h: 60,
  },
  process: {
    style: "rounded=1;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;fontSize=14;shadow=1;arcSize=20;",
    w: 170,
    h: 60,
  },
  decision: {
    style: "rhombus;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;fontSize=12;shadow=1;",
    w: 150,
    h: 80,
  },
  compliance: {
    style: "rounded=1;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;fontSize=14;fontStyle=1;shadow=1;arcSize=20;",
    w: 170,
    h: 60,
  },
};

function escXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function autoLayout(nodes: FlowNode[]): FlowNode[] {
  // If all nodes already have x,y, keep them
  if (nodes.every((n) => n.x != null && n.y != null)) return nodes;

  const cols = Math.min(nodes.length, 4);
  const xGap = 240;
  const yGap = 140;
  return nodes.map((n, i) => ({
    ...n,
    x: n.x ?? 80 + (i % cols) * xGap,
    y: n.y ?? 80 + Math.floor(i / cols) * yGap,
  }));
}

function buildDrawioXml(flow: FlowStructure): string {
  const nodes = autoLayout(flow.nodes);
  let cells = "";

  for (const node of nodes) {
    const { style, w, h } = STYLE_MAP[node.type] || STYLE_MAP.entity;
    cells += `        <mxCell id="${escXml(node.id)}" value="${escXml(node.label)}" style="${style}" vertex="1" parent="1">
          <mxGeometry x="${node.x}" y="${node.y}" width="${w}" height="${h}" as="geometry"/>
        </mxCell>\n`;
  }

  for (const edge of flow.edges) {
    cells += `        <mxCell id="${escXml(edge.id)}" value="${escXml(edge.label)}" style="edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;html=1;fontSize=11;strokeWidth=2;strokeColor=#333333;fontColor=#333333;labelBackgroundColor=#ffffff;" edge="1" parent="1" source="${escXml(edge.from)}" target="${escXml(edge.to)}">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>\n`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net" type="device">
  <diagram id="payment-flow" name="Payment Flow">
    <mxGraphModel dx="1422" dy="762" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1169" pageHeight="827">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
${cells}      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;
}

/* ------------------------------------------------------------------ */
/*  Controller                                                         */
/* ------------------------------------------------------------------ */

export class PaymentFlowController {
  private openai: OpenAI | null = null;
  private anthropic: Anthropic | null = null;
  private useMock: boolean;

  constructor() {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

    const hasOpenAI = !!openaiApiKey;
    const hasAnthropic = !!anthropicApiKey;

    const isDev = process.env.NODE_ENV !== "production";
    this.useMock =
      process.env.LLM_USE_MOCK === "true" ||
      (isDev && !hasOpenAI && !hasAnthropic);

    if (hasOpenAI && openaiApiKey) {
      this.openai = new OpenAI({ apiKey: openaiApiKey });
    }
    if (hasAnthropic && anthropicApiKey) {
      this.anthropic = new Anthropic({ apiKey: anthropicApiKey });
    }
  }

  /* ---------- Generate ---------- */

  async generate(request: GenerateRequest): Promise<FlowResponse> {
    const { description, model = "claude-sonnet-4-6" } = request;

    if (!description?.trim()) {
      throw new Error("Description is required");
    }

    console.log(`[PaymentFlow:generate] Model: ${model}, len: ${description.length}`);

    if (this.shouldUseMock(model)) {
      return this.mockGenerate(model);
    }

    return this.callWithRetry(GENERATE_SYSTEM, description, model);
  }

  /* ---------- Agentic Patch ---------- */

  async patch(request: PatchRequest): Promise<FlowResponse> {
    const { feedback, model = "claude-sonnet-4-6", current_flow } = request;

    if (!feedback?.trim()) throw new Error("feedback is required");

    console.log(`[PaymentFlow:patch] Model: ${model}, feedback: ${feedback.slice(0, 80)}`);

    if (this.shouldUseMock(model)) {
      return this.mockPatch(feedback, model);
    }

    // Pass the structured flow (not XML) to the LLM for patching
    const flowJson = current_flow
      ? JSON.stringify({ nodes: current_flow.nodes, edges: current_flow.edges }, null, 2)
      : "(no current flow provided)";

    const userMessage = `## Current Flow Structure
\`\`\`json
${flowJson}
\`\`\`

## Feedback
${feedback}`;

    return this.callWithRetry(PATCH_SYSTEM, userMessage, model);
  }

  /* ---------- Agentic Retry Loop ---------- */

  private static readonly MAX_RETRIES = 3;

  private async callWithRetry(
    systemPrompt: string,
    userMessage: string,
    model: string,
  ): Promise<FlowResponse> {
    let lastRaw = "";
    let lastError = "";

    for (let attempt = 1; attempt <= PaymentFlowController.MAX_RETRIES; attempt++) {
      console.log(`[PaymentFlow] Attempt ${attempt}/${PaymentFlowController.MAX_RETRIES}`);

      const prompt =
        attempt === 1
          ? userMessage
          : FIX_PROMPT
              .replace("{{RAW_OUTPUT}}", lastRaw.slice(0, 4000))
              .replace("{{ERROR}}", lastError);

      const raw = await this.callLlm(systemPrompt, prompt, model);
      lastRaw = raw;

      const result = this.tryParse(raw, model);
      if (result) {
        console.log(`[PaymentFlow] Successfully parsed on attempt ${attempt}`);
        return result;
      }

      lastError = this.getParseError(raw);
      console.warn(`[PaymentFlow] Parse failed on attempt ${attempt}: ${lastError}`);
    }

    console.error(`[PaymentFlow] All ${PaymentFlowController.MAX_RETRIES} attempts failed`);
    const fallbackFlow: FlowStructure = {
      nodes: [{ id: "err", label: "Parse error — please try again", type: "process" }],
      edges: [],
    };
    return {
      drawio_xml: buildDrawioXml(fallbackFlow),
      summary: `Parse failed after ${PaymentFlowController.MAX_RETRIES} attempts.`,
      entities: [],
      model,
      compliance_notes: [],
      flow_structure: fallbackFlow,
    };
  }

  /** Try to parse LLM output into a FlowResponse */
  private tryParse(raw: string, model: string): FlowResponse | null {
    try {
      const jsonStr = this.extractJson(raw);
      if (!jsonStr) return null;

      const parsed = JSON.parse(jsonStr);

      // Validate required fields
      if (!Array.isArray(parsed.nodes) || parsed.nodes.length === 0) return null;
      if (!Array.isArray(parsed.edges)) return null;

      const flowStructure: FlowStructure = {
        nodes: parsed.nodes,
        edges: parsed.edges,
      };

      return {
        drawio_xml: buildDrawioXml(flowStructure),
        summary: parsed.summary || "",
        entities: parsed.entities || [],
        model,
        patch_description: parsed.patch_description,
        compliance_notes: parsed.compliance_notes || [],
        flow_structure: flowStructure,
      };
    } catch {
      return null;
    }
  }

  /** Robustly extract JSON from LLM output */
  private extractJson(raw: string): string | null {
    const trimmed = raw.trim();

    // Strategy 1: find outermost { ... } by brace counting (most robust)
    const firstBrace = trimmed.indexOf("{");
    if (firstBrace !== -1) {
      let depth = 0;
      let inString = false;
      let escape = false;
      for (let i = firstBrace; i < trimmed.length; i++) {
        const ch = trimmed[i];
        if (escape) { escape = false; continue; }
        if (ch === "\\") { escape = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (ch === "{") depth++;
        if (ch === "}") { depth--; if (depth === 0) return trimmed.slice(firstBrace, i + 1); }
      }
    }

    return null;
  }

  private getParseError(raw: string): string {
    try {
      const jsonStr = this.extractJson(raw);
      if (!jsonStr) return "Could not find a JSON object in the response";
      const parsed = JSON.parse(jsonStr);
      if (!Array.isArray(parsed.nodes)) return "'nodes' field is missing or not an array";
      if (parsed.nodes.length === 0) return "'nodes' array is empty";
      return "Unknown validation error";
    } catch (e) {
      return e instanceof Error ? e.message : "Unknown JSON parse error";
    }
  }

  /* ---------- LLM call ---------- */

  private async callLlm(
    systemPrompt: string,
    userMessage: string,
    model: string,
  ): Promise<string> {
    const isClaude = model.startsWith("claude-");

    if (isClaude) {
      if (!this.anthropic) throw new Error("Anthropic client is not configured");
      const response = await this.anthropic.messages.create({
        model,
        max_tokens: 8000,
        temperature: 0.3,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      });
      const first = response.content?.[0];
      if (!first || !("text" in first)) return "";
      return first.text ?? "";
    }

    if (!this.openai) throw new Error("OpenAI client is not configured");
    const response = await this.openai.responses.create({
      model,
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_output_tokens: 8000,
    });
    return response.output_text ?? "";
  }

  /* ---------- Mock ---------- */

  private shouldUseMock(model: string): boolean {
    const isClaude = model.startsWith("claude-");
    return this.useMock || (isClaude && !this.anthropic) || (!isClaude && !this.openai);
  }

  private mockGenerate(model: string): FlowResponse {
    const flow = MOCK_FLOW;
    return {
      drawio_xml: buildDrawioXml(flow),
      summary: "[Mock] Basic card payment flow: Cardholder -> Merchant -> Acquirer -> Card Network -> Issuer (with compliance review)",
      entities: ["Cardholder", "Merchant", "Acquirer", "Card Network", "Issuer", "Compliance Review", "Risk Assessment"],
      model,
      compliance_notes: [
        { category: "risk", severity: "high", title: "PCI DSS Compliance", detail: "Card data is transmitted at multiple points. Confirm PCI DSS Level 1 compliance for both merchant and acquirer." },
        { category: "risk", severity: "medium", title: "Chargeback & Dispute Flow Missing", detail: "The diagram does not show the dispute/chargeback reverse flow. This should be documented for risk assessment." },
        { category: "question", severity: "medium", title: "3D Secure Implementation", detail: "Ask the client: Is 3D Secure (SCA) enabled for card-not-present transactions? This affects liability shift." },
        { category: "question", severity: "low", title: "Settlement Timing", detail: "Ask the client: What is the expected settlement cycle? Same-day, T+1, or T+2? This impacts liquidity risk." },
        { category: "regulation", severity: "high", title: "Reg E / EFTA Applicability", detail: "If debit cards are involved, Regulation E consumer protection requirements apply including error resolution procedures." },
      ],
      flow_structure: flow,
    };
  }

  private mockPatch(feedback: string, model: string): FlowResponse {
    const flow = MOCK_FLOW;
    return {
      drawio_xml: buildDrawioXml(flow),
      summary: `[Mock] Received feedback "${feedback.slice(0, 50)}" — changes simulated in mock mode`,
      entities: [],
      model,
      patch_description: `Mock: Simulated changes for "${feedback.slice(0, 40)}"`,
      compliance_notes: [],
      flow_structure: flow,
    };
  }
}

/* ------------------------------------------------------------------ */
/*  Mock Flow                                                          */
/* ------------------------------------------------------------------ */

const MOCK_FLOW: FlowStructure = {
  nodes: [
    { id: "n1", label: "Cardholder", type: "entity", x: 80, y: 80 },
    { id: "n2", label: "Merchant", type: "entity", x: 360, y: 80 },
    { id: "n3", label: "Acquirer", type: "process", x: 640, y: 80 },
    { id: "n4", label: "Card Network", type: "entity", x: 360, y: 260 },
    { id: "n5", label: "Issuer", type: "entity", x: 80, y: 260 },
    { id: "n6", label: "Compliance Review", type: "compliance", x: 640, y: 260 },
    { id: "n7", label: "Risk Assessment", type: "decision", x: 380, y: 420 },
    { id: "n8", label: "Settlement", type: "process", x: 80, y: 440 },
  ],
  edges: [
    { id: "e0", from: "n1", to: "n2", label: "Payment Request" },
    { id: "e1", from: "n2", to: "n3", label: "Auth Request" },
    { id: "e2", from: "n3", to: "n4", label: "Routing" },
    { id: "e3", from: "n4", to: "n5", label: "Auth Inquiry" },
    { id: "e4", from: "n5", to: "n6", label: "Compliance Check" },
    { id: "e5", from: "n6", to: "n7", label: "Review Result" },
    { id: "e6", from: "n7", to: "n4", label: "Approve / Decline" },
    { id: "e7", from: "n4", to: "n8", label: "Result" },
    { id: "e8", from: "n8", to: "n1", label: "Confirmation" },
  ],
};
