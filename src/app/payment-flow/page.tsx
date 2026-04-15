"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Box,
  Button,
  Container,
  Heading,
  Input,
  VStack,
  HStack,
  Text,
  Spinner,
  Textarea,
} from "@chakra-ui/react";
import { apiClient } from "@/lib/api-client";

/* ------------------------------------------------------------------ */
/*  Sample Inputs — tailored to embedded payments / BaaS / fintech     */
/* ------------------------------------------------------------------ */

const SAMPLE_INPUTS = [
  {
    label: "-- Select a sample flow --",
    value: "",
  },
  {
    label: "Embedded Payments via BaaS Platform (Newline-style)",
    value:
      "A fintech partner integrates with an embedded payments platform (BaaS provider) via API to offer payment services to their end users. The fintech's end user initiates a payment through the fintech's app. The fintech sends the payment instruction to the BaaS platform's API gateway. The BaaS platform validates the request, performs KYC/AML screening through its compliance engine, and routes the payment to the appropriate rail — ACH for standard transfers, RTP for real-time, or Wire for high-value. The BaaS platform's sponsor bank settles the transaction. The compliance team at the sponsor bank monitors for suspicious activity. Transaction status is pushed back to the fintech via webhook, and the fintech notifies the end user. The BaaS platform also handles reconciliation and regulatory reporting on behalf of the fintech.",
  },
  {
    label: "Push-to-Card Instant Payout (Visa Direct / Mastercard Send)",
    value:
      "A gig economy platform needs to pay out earnings to drivers instantly. The platform calls the embedded payments API to initiate a push-to-card transaction. The BaaS provider validates the request and checks the driver's linked debit card eligibility via the card network (Visa Direct or Mastercard Send). The transaction is routed through the card network to the receiving issuer bank. The issuer credits the driver's account in real-time. If the card is ineligible for real-time push, the system falls back to next-day ACH. The platform receives a webhook confirmation with the transaction status. Fraud screening runs at both the BaaS platform level and the card network level. The sponsor bank handles settlement with the card network at end of day.",
  },
  {
    label: "Cross-Border Payment via Correspondent Banking (SWIFT)",
    value:
      "A corporate client initiates a USD-to-EUR cross-border wire from their account at the originating bank in New York. The bank's RM reviews the payment details and ensures the client's documentation is complete. The originating bank performs OFAC screening and AML compliance checks. A SWIFT MT103 message is generated and sent to the correspondent bank that holds the nostro/vostro accounts. The correspondent bank performs its own sanctions screening, converts the currency via its FX desk, and forwards the payment to the beneficiary's bank in Europe. The beneficiary bank runs local compliance checks (EU AML Directive) and credits the beneficiary's account. Each node in the chain sends status updates back. The RM translates the flow for internal compliance and risk partners to ensure everyone understands the construct.",
  },
  {
    label: "Fintech Onboarding & Sponsor Bank Underwriting",
    value:
      "A new fintech applies to integrate with an embedded payments platform for BaaS services. The platform collects the fintech's business documents, KYB (Know Your Business) information, and intended use case. Automated screening runs: Secretary of State verification, OFAC/sanctions check, MATCH list screening, and beneficial ownership verification. The BaaS provider's risk team reviews the application and assigns a risk tier (low/medium/high). The sponsor bank's compliance team performs an independent review of the fintech's compliance program, BSA/AML policies, and consumer protection controls. Once approved, the platform provisions API credentials, sets transaction limits, configures fee schedules, and enables the fintech on a sandbox environment. After successful test transactions, the fintech is promoted to production. Ongoing monitoring includes transaction velocity checks and periodic compliance reviews.",
  },
  {
    label: "Real-Time Payment (RTP / FedNow) via Embedded Platform",
    value:
      'A software company integrates real-time payments into their invoicing product using a BaaS platform\'s RTP API. When an invoice recipient clicks "Pay Now," the software company\'s backend calls the BaaS API with payment details. The BaaS platform validates the request, checks the sender\'s account balance, and submits the payment message to The Clearing House RTP network (or FedNow). The RTP network validates the message format, performs real-time fraud screening, and routes the message to the receiver\'s bank. The receiver\'s bank credits the beneficiary\'s account instantly and sends a confirmation back through the network. The BaaS platform receives the confirmation and pushes a webhook to the software company, which updates the invoice status to "Paid" in real-time. Settlement between the sponsor bank and receiver\'s bank occurs through the Federal Reserve master accounts.',
  },
  {
    label: "Digital Wallet Funding & Virtual Card Issuance",
    value:
      "A fintech offers a digital wallet with a virtual debit card to consumers. The consumer signs up through the fintech's app, which triggers KYC verification via the BaaS platform's identity API (document verification + database checks). Once approved, the BaaS platform's sponsor bank opens a virtual account (FBO structure) and the card processor issues a virtual Visa/Mastercard debit card with a unique PAN. The consumer funds the wallet via ACH pull from their external bank account — the BaaS platform initiates the ACH debit through the sponsor bank to the consumer's bank via the ACH network (Federal Reserve or EPN). Once funds settle (or with prefunding for instant availability), the wallet balance is updated. The consumer can now spend using the virtual card — transactions route through the card network to merchants. The BaaS platform handles transaction authorization, fraud monitoring, and regulatory compliance (Reg E, EFTA). The sponsor bank manages BSA/AML obligations and FDIC pass-through insurance.",
  },
  {
    label: "Commercial Card Program (Brex-style Bank Partnership)",
    value:
      "A bank partners with a fintech to launch a commercial card program. The fintech provides the technology platform (expense management, AI-powered controls, receipt matching) while the bank serves as the card issuer. A corporate client applies through the fintech's platform. The fintech collects business information and forwards it to the bank for credit underwriting. The bank's credit team evaluates the company's financials and assigns a credit limit. Once approved, virtual cards are issued via the card network (Visa/Mastercard). Employees make purchases — transactions are authorized in real-time through the fintech's policy engine (department budgets, merchant category restrictions, approval workflows). The card network routes the authorization to the issuing bank, which approves based on available credit. At end of day, the bank settles with the card network. The fintech's platform handles expense categorization, receipt matching via AI, and integrates with the company's ERP/accounting system. The bank manages regulatory compliance, credit risk, and capital requirements.",
  },
] as const;

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ComplianceItem {
  category: "risk" | "question" | "regulation";
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
}

interface HistoryEntry {
  id: string;
  role: "user" | "system";
  content: string;
  timestamp: Date;
}

interface FlowStructure {
  nodes: unknown[];
  edges: unknown[];
}

interface FlowState {
  xml: string;
  summary: string;
  entities: string[];
  complianceNotes: ComplianceItem[];
  flowStructure?: FlowStructure;
}

/* ------------------------------------------------------------------ */
/*  draw.io viewer component using embed URL                           */
/* ------------------------------------------------------------------ */

function DrawioViewer({ xml }: { xml: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      try {
        const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (data.event === "init") {
          setReady(true);
        }
      } catch {
        // ignore non-json messages
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  useEffect(() => {
    if (ready && iframeRef.current?.contentWindow && xml) {
      const msg = JSON.stringify({
        action: "load",
        autosave: 0,
        xml,
      });
      iframeRef.current.contentWindow.postMessage(msg, "*");
    }
  }, [ready, xml]);

  return (
    <iframe
      ref={iframeRef}
      src="https://embed.diagrams.net/?embed=1&proto=json&spin=1&ui=kennedy&noSaveBtn=1&noExitBtn=1"
      style={{
        width: "100%",
        height: "100%",
        border: "none",
        borderRadius: "8px",
      }}
      title="draw.io viewer"
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Compliance Notes Table with Accordion Rows                         */
/* ------------------------------------------------------------------ */

const CATEGORY_CONFIG = {
  risk: { color: "#E53E3E", bg: "#FFF5F5", label: "Risk" },
  question: { color: "#DD6B20", bg: "#FFFAF0", label: "Ask Client" },
  regulation: { color: "#3182CE", bg: "#EBF8FF", label: "Regulation" },
} as const;

const SEVERITY_CONFIG = {
  high: { color: "#E53E3E", bg: "#FED7D7", label: "High" },
  medium: { color: "#DD6B20", bg: "#FEFCBF", label: "Medium" },
  low: { color: "#38A169", bg: "#C6F6D5", label: "Low" },
} as const;

function ComplianceTable({ notes }: { notes: ComplianceItem[] }) {
  const [openRows, setOpenRows] = useState<Set<number>>(new Set());

  const toggle = (i: number) => {
    setOpenRows((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const grouped = {
    risk: notes.filter((n) => n.category === "risk"),
    question: notes.filter((n) => n.category === "question"),
    regulation: notes.filter((n) => n.category === "regulation"),
  };

  // Sort: high first, then medium, then low
  const severityOrder = { high: 0, medium: 1, low: 2 };
  const allNotes = [...grouped.risk, ...grouped.question, ...grouped.regulation]
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return (
    <Box borderWidth="1px" borderRadius="lg" overflow="hidden" bg="white">
      <HStack
        px={4}
        py={2}
        bg="gray.50"
        borderBottom="1px"
        borderBottomColor="gray.200"
        justify="space-between"
      >
        <Text fontWeight="bold" fontSize="sm" color="gray.700">
          Compliance Review Notes
        </Text>
        <HStack gap={3}>
          {(["risk", "question", "regulation"] as const).map((cat) => (
            <HStack key={cat} gap={1}>
              <Box
                w={2}
                h={2}
                borderRadius="full"
                bg={CATEGORY_CONFIG[cat].color}
              />
              <Text fontSize="xs" color="gray.500">
                {CATEGORY_CONFIG[cat].label} ({grouped[cat].length})
              </Text>
            </HStack>
          ))}
        </HStack>
      </HStack>

      {/* Table Header */}
      <Box
        display="grid"
        gridTemplateColumns="100px 80px 1fr 40px"
        px={4}
        py={2}
        bg="gray.50"
        borderBottom="1px"
        borderBottomColor="gray.200"
        fontSize="xs"
        fontWeight="bold"
        color="gray.500"
        textTransform="uppercase"
        letterSpacing="wider"
      >
        <Text>Type</Text>
        <Text>Severity</Text>
        <Text>Finding</Text>
        <Text />
      </Box>

      {/* Rows */}
      {allNotes.map((note, i) => {
        const catConfig = CATEGORY_CONFIG[note.category];
        const sevConfig = SEVERITY_CONFIG[note.severity] || SEVERITY_CONFIG.medium;
        const isOpen = openRows.has(i);
        return (
          <Box key={`${note.category}-${i}`}>
            <Box
              display="grid"
              gridTemplateColumns="100px 80px 1fr 40px"
              px={4}
              py={2.5}
              borderBottom="1px"
              borderBottomColor="gray.100"
              cursor="pointer"
              _hover={{ bg: "gray.50" }}
              onClick={() => toggle(i)}
              transition="background 0.15s"
              alignItems="center"
            >
              <Box>
                <Text
                  as="span"
                  px={2}
                  py={0.5}
                  borderRadius="full"
                  fontSize="xs"
                  fontWeight="bold"
                  color={catConfig.color}
                  bg={catConfig.bg}
                >
                  {catConfig.label}
                </Text>
              </Box>
              <Box>
                <Text
                  as="span"
                  px={2}
                  py={0.5}
                  borderRadius="full"
                  fontSize="xs"
                  fontWeight="bold"
                  color={sevConfig.color}
                  bg={sevConfig.bg}
                >
                  {sevConfig.label}
                </Text>
              </Box>
              <Text fontSize="sm" fontWeight="medium" color="gray.800">
                {note.title}
              </Text>
              <Text
                fontSize="sm"
                color="gray.400"
                textAlign="center"
                transition="transform 0.2s"
                transform={isOpen ? "rotate(180deg)" : "rotate(0deg)"}
              >
                ▾
              </Text>
            </Box>
            {isOpen && (
              <Box
                px={4}
                py={3}
                pl="196px"
                bg={catConfig.bg}
                borderBottom="1px"
                borderBottomColor="gray.100"
              >
                <Text fontSize="sm" color="gray.700" lineHeight="tall">
                  {note.detail}
                </Text>
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function PaymentFlowPage() {
  const [description, setDescription] = useState("");
  const [feedback, setFeedback] = useState("");
  const [flow, setFlow] = useState<FlowState | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPatching, setIsPatching] = useState(false);
  const [model, setModel] = useState("claude-sonnet-4-6");
  const [patchCount, setPatchCount] = useState(0);
  const historyEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    historyEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [history, scrollToBottom]);

  const addHistory = useCallback(
    (role: "user" | "system", content: string) => {
      setHistory((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role, content, timestamp: new Date() },
      ]);
    },
    [],
  );

  /* ---------- Generate ---------- */

  const handleGenerate = useCallback(async () => {
    if (!description.trim() || isGenerating) return;

    setIsGenerating(true);
    addHistory("user", description);
    setDescription("");

    try {
      const { data } = await apiClient.post("/api/payment-flow/generate", {
        description,
        model,
      });

      setFlow({
        xml: data.drawio_xml,
        summary: data.summary,
        entities: data.entities,
        complianceNotes: data.compliance_notes || [],
        flowStructure: data.flow_structure,
      });
      setPatchCount(0);
      addHistory(
        "system",
        `Flow diagram generated.\n\n${data.summary}\n\nEntities: ${data.entities.join(", ")}`,
      );
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : "An error occurred";
      addHistory("system", `Error: ${msg}`);
    } finally {
      setIsGenerating(false);
    }
  }, [description, isGenerating, model, addHistory]);

  /* ---------- Agentic Patch ---------- */

  const handlePatch = useCallback(async () => {
    if (!feedback.trim() || !flow || isPatching) return;

    setIsPatching(true);
    addHistory("user", `Revision: ${feedback}`);
    const currentFeedback = feedback;
    setFeedback("");

    try {
      const { data } = await apiClient.post("/api/payment-flow/patch", {
        current_xml: flow.xml,
        current_flow: flow.flowStructure,
        feedback: currentFeedback,
        model,
      });

      setFlow({
        xml: data.drawio_xml,
        summary: data.summary,
        entities: data.entities.length > 0 ? data.entities : flow.entities,
        complianceNotes: data.compliance_notes?.length > 0 ? data.compliance_notes : flow.complianceNotes,
        flowStructure: data.flow_structure || flow.flowStructure,
      });
      setPatchCount((prev) => prev + 1);
      addHistory(
        "system",
        `Patch #${patchCount + 1} applied.\n\n${data.patch_description || data.summary}`,
      );
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : "An error occurred";
      addHistory("system", `Patch error: ${msg}`);
    } finally {
      setIsPatching(false);
    }
  }, [feedback, flow, isPatching, model, patchCount, addHistory]);

  /* ---------- Download .drawio ---------- */

  const handleDownload = useCallback(() => {
    if (!flow) return;
    const blob = new Blob([flow.xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "payment-flow.drawio";
    a.click();
    URL.revokeObjectURL(url);
  }, [flow]);

  /* ---------- Download .pptx ---------- */

  const handleDownloadPptx = useCallback(async () => {
    if (!flow?.flowStructure) return;
    const PptxGenJS = (await import("pptxgenjs")).default;
    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_WIDE";

    const { nodes, edges } = flow.flowStructure as {
      nodes: { id: string; label: string; type: string; x?: number; y?: number }[];
      edges: { from: string; to: string; label: string }[];
    };

    // --- Slide 1: Flow Diagram ---
    const slide = pptx.addSlide();
    slide.addText("Payment Flow Diagram", {
      x: 0.5, y: 0.2, w: 12, h: 0.5,
      fontSize: 22, fontFace: "Arial", bold: true, color: "333333",
    });

    const typeColors: Record<string, { fill: string; border: string }> = {
      entity: { fill: "DAE8FC", border: "6C8EBF" },
      process: { fill: "D5E8D4", border: "82B366" },
      decision: { fill: "FFF2CC", border: "D6B656" },
      compliance: { fill: "F8CECC", border: "B85450" },
    };

    // Calculate scale to fit all nodes in slide area (13.33 x 7.5 inches)
    const slideW = 12;
    const slideH = 5.5;
    const offsetY = 1.0;
    const offsetX = 0.5;
    const allX = nodes.map((n) => n.x ?? 0);
    const allY = nodes.map((n) => n.y ?? 0);
    const minX = Math.min(...allX);
    const maxX = Math.max(...allX) + 170;
    const minY = Math.min(...allY);
    const maxY = Math.max(...allY) + 60;
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    const scaleX = slideW / rangeX;
    const scaleY = slideH / rangeY;
    const scale = Math.min(scaleX, scaleY, 0.012);
    const nodeW = 170 * scale;
    const nodeH = 60 * scale;

    const nodePositions: Record<string, { cx: number; cy: number }> = {};

    for (const node of nodes) {
      const nx = (((node.x ?? 0) - minX) * scale) + offsetX;
      const ny = (((node.y ?? 0) - minY) * scale) + offsetY;
      const colors = typeColors[node.type] || typeColors.entity;
      nodePositions[node.id] = { cx: nx + nodeW / 2, cy: ny + nodeH / 2 };

      const isDecision = node.type === "decision";
      slide.addShape(isDecision ? "diamond" as never : "roundRect" as never, {
        x: nx, y: ny,
        w: isDecision ? nodeH * 1.2 : nodeW,
        h: nodeH,
        fill: { color: colors.fill },
        line: { color: colors.border, width: 1.5 },
        shadow: { type: "outer", blur: 3, offset: 2, color: "CCCCCC", opacity: 0.3 },
        rectRadius: isDecision ? undefined : 0.1,
      });
      slide.addText(node.label, {
        x: nx, y: ny,
        w: isDecision ? nodeH * 1.2 : nodeW,
        h: nodeH,
        fontSize: 9, fontFace: "Arial", bold: true,
        color: "333333", align: "center", valign: "middle",
      });
    }

    // Draw edges as lines
    for (const edge of edges) {
      const src = nodePositions[edge.from];
      const tgt = nodePositions[edge.to];
      if (!src || !tgt) continue;

      slide.addShape("line" as never, {
        x: src.cx, y: src.cy,
        w: tgt.cx - src.cx, h: tgt.cy - src.cy,
        line: { color: "666666", width: 1.5, dashType: "solid" as never, endArrowType: "triangle" as never },
      });

      // Edge label at midpoint
      if (edge.label) {
        const mx = (src.cx + tgt.cx) / 2 - 0.5;
        const my = (src.cy + tgt.cy) / 2 - 0.1;
        slide.addText(edge.label, {
          x: mx, y: my, w: 1.2, h: 0.22,
          fontSize: 6, fontFace: "Arial", color: "666666",
          align: "center", fill: { color: "FFFFFF" },
        });
      }
    }

    // Legend
    const legendY = 6.8;
    const legendItems = [
      { label: "Entity", color: "DAE8FC", border: "6C8EBF" },
      { label: "Process", color: "D5E8D4", border: "82B366" },
      { label: "Decision", color: "FFF2CC", border: "D6B656" },
      { label: "Compliance", color: "F8CECC", border: "B85450" },
    ];
    for (let i = 0; i < legendItems.length; i++) {
      const lx = 0.5 + i * 2.2;
      slide.addShape("rect" as never, {
        x: lx, y: legendY, w: 0.2, h: 0.2,
        fill: { color: legendItems[i].color },
        line: { color: legendItems[i].border, width: 1 },
      });
      slide.addText(legendItems[i].label, {
        x: lx + 0.25, y: legendY, w: 1.5, h: 0.2,
        fontSize: 8, fontFace: "Arial", color: "666666",
      });
    }

    // --- Slide 2: Compliance Notes ---
    if (flow.complianceNotes.length > 0) {
      const slide2 = pptx.addSlide();
      slide2.addText("Compliance Review Notes", {
        x: 0.5, y: 0.2, w: 12, h: 0.5,
        fontSize: 22, fontFace: "Arial", bold: true, color: "333333",
      });

      const sevColors = { high: "E53E3E", medium: "DD6B20", low: "38A169" };
      const catLabels = { risk: "Risk", question: "Ask Client", regulation: "Regulation" };

      const tableRows: Array<Array<{ text: string; options?: Record<string, unknown> }>> = [
        [
          { text: "Type", options: { bold: true, fontSize: 10, fill: { color: "F7FAFC" } } },
          { text: "Severity", options: { bold: true, fontSize: 10, fill: { color: "F7FAFC" } } },
          { text: "Finding", options: { bold: true, fontSize: 10, fill: { color: "F7FAFC" } } },
          { text: "Detail", options: { bold: true, fontSize: 10, fill: { color: "F7FAFC" } } },
        ],
      ];

      for (const note of flow.complianceNotes) {
        tableRows.push([
          { text: catLabels[note.category] || note.category, options: { fontSize: 9 } },
          { text: (note.severity || "medium").toUpperCase(), options: { fontSize: 9, bold: true, color: sevColors[note.severity] || sevColors.medium } },
          { text: note.title, options: { fontSize: 9, bold: true } },
          { text: note.detail, options: { fontSize: 8 } },
        ]);
      }

      slide2.addTable(tableRows as never, {
        x: 0.5, y: 1.0, w: 12,
        border: { type: "solid", color: "CCCCCC", pt: 0.5 },
        colW: [1.5, 1.0, 3.0, 6.5],
        rowH: 0.4,
        fontSize: 9,
        fontFace: "Arial",
      });
    }

    pptx.writeFile({ fileName: "payment-flow.pptx" });
  }, [flow]);

  /* ---------- Render ---------- */

  const isLoading = isGenerating || isPatching;

  return (
    <Container maxW="100%" py={6} px={6}>
      <VStack gap={4} align="stretch">
        <HStack justify="space-between" align="center">
          <Box>
            <Heading size="lg">Payment Flow Visualizer</Heading>
            <Text fontSize="sm" color="gray.500" mt={1}>
              Turn client payment descriptions into compliance-ready diagrams.
              No more back-and-forth — AI structures the flow so your
              compliance & risk partners get it the first time.
            </Text>
          </Box>
          <HStack>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                border: "1px solid #ccc",
                fontSize: "14px",
              }}
            >
              <optgroup label="Claude">
                <option value="claude-opus-4-6">Claude Opus 4.6</option>
                <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
                <option value="claude-haiku-4-5">Claude Haiku 4.5</option>
              </optgroup>
              <optgroup label="OpenAI">
                <option value="gpt-5.4-2026-03-05">GPT-5.4</option>
              </optgroup>
            </select>
            {flow && (
              <>
                <Button size="sm" onClick={handleDownload} variant="outline">
                  .drawio
                </Button>
                <Button size="sm" onClick={handleDownloadPptx} variant="outline">
                  .pptx
                </Button>
              </>
            )}
          </HStack>
        </HStack>

        {/* Main Layout: Diagram + Chat side by side */}
        <Box display="flex" gap={4} h="calc(100vh - 200px)" minH="500px">
          {/* Left: Diagram */}
          <Box
            flex="1"
            borderWidth="1px"
            borderRadius="lg"
            overflow="hidden"
            bg="white"
            position="relative"
          >
            {flow ? (
              <DrawioViewer xml={flow.xml} />
            ) : (
              <Box
                display="flex"
                alignItems="center"
                justifyContent="center"
                h="100%"
                color="gray.400"
              >
                <VStack gap={4}>
                  <Text fontSize="4xl">📊</Text>
                  <Text fontSize="lg" fontWeight="medium">
                    From client conversation to compliance-ready diagram
                  </Text>
                  <Text fontSize="sm" color="gray.400" textAlign="center" maxW="520px">
                    Paste what the client told you about their payment
                    construct. AI will produce a clear, structured diagram
                    that compliance and risk partners can review without
                    needing you to translate.
                  </Text>
                  <Box
                    mt={2}
                    p={3}
                    bg="blue.50"
                    borderRadius="md"
                    fontSize="xs"
                    color="blue.700"
                    maxW="520px"
                  >
                    <Text fontWeight="bold" mb={1}>How it works:</Text>
                    <Text>1. Paste client notes or pick a sample scenario</Text>
                    <Text>2. AI generates a compliance-ready draw.io diagram</Text>
                    <Text>3. Refine with feedback — &quot;simplify this&quot;, &quot;add OFAC screening&quot;, &quot;highlight the risk nodes&quot;</Text>
                    <Text>4. Download the .drawio file and share with your team</Text>
                  </Box>
                </VStack>
              </Box>
            )}
            {flow && (
              <Box
                position="absolute"
                top={2}
                right={2}
                bg="white"
                px={3}
                py={1}
                borderRadius="md"
                boxShadow="sm"
                fontSize="xs"
                color="gray.500"
              >
                Revisions: {patchCount}
              </Box>
            )}
          </Box>

          {/* Right: Chat Panel */}
          <Box
            w="400px"
            borderWidth="1px"
            borderRadius="lg"
            display="flex"
            flexDirection="column"
            bg="white"
          >
            {/* Chat History */}
            <Box flex="1" overflowY="auto" p={3}>
              <VStack gap={3} align="stretch">
                {history.length === 0 && (
                  <Box p={4} textAlign="center" color="gray.400">
                    <Text fontSize="sm">
                      Select a sample scenario or describe a payment flow.
                      <br />
                      After generation, refine with natural-language feedback.
                    </Text>
                  </Box>
                )}
                {history.map((entry) => (
                  <Box
                    key={entry.id}
                    p={2}
                    borderRadius="md"
                    bg={entry.role === "user" ? "blue.50" : "gray.50"}
                    borderLeft="3px solid"
                    borderLeftColor={
                      entry.role === "user" ? "blue.400" : "green.400"
                    }
                  >
                    <Text
                      fontSize="xs"
                      color="gray.400"
                      mb={1}
                      fontWeight="bold"
                    >
                      {entry.role === "user" ? "You" : "AI"}
                    </Text>
                    <Text fontSize="sm" whiteSpace="pre-wrap">
                      {entry.content}
                    </Text>
                  </Box>
                ))}
                {isLoading && (
                  <Box p={2} borderRadius="md" bg="gray.50">
                    <HStack>
                      <Spinner size="xs" />
                      <Text fontSize="sm" color="gray.500">
                        {isGenerating
                          ? "Generating diagram..."
                          : "Applying revision..."}
                      </Text>
                    </HStack>
                  </Box>
                )}
                <div ref={historyEndRef} />
              </VStack>
            </Box>

            {/* Input Area */}
            <Box
              p={3}
              borderTop="1px"
              borderTopColor="gray.200"
              bg="gray.50"
              borderBottomRadius="lg"
            >
              {!flow ? (
                /* Initial generation input */
                <VStack gap={2}>
                  <select
                    onChange={(e) => {
                      if (e.target.value) setDescription(e.target.value);
                    }}
                    style={{
                      width: "100%",
                      padding: "6px 8px",
                      borderRadius: "6px",
                      border: "1px solid #ccc",
                      fontSize: "13px",
                      color: "#555",
                    }}
                    value=""
                  >
                    {SAMPLE_INPUTS.map((sample) => (
                      <option key={sample.label} value={sample.value}>
                        {sample.label}
                      </option>
                    ))}
                  </select>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the payment flow, paste meeting notes, or a client's explanation of their money movement construct..."
                    size="sm"
                    rows={5}
                    disabled={isGenerating}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        handleGenerate();
                      }
                    }}
                  />
                  <Button
                    onClick={handleGenerate}
                    loading={isGenerating}
                    colorPalette="blue"
                    w="100%"
                    size="sm"
                  >
                    Generate Diagram
                  </Button>
                </VStack>
              ) : (
                /* Patch feedback input */
                <VStack gap={2}>
                  <Input
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="e.g. Add OFAC screening before the correspondent bank"
                    size="sm"
                    disabled={isPatching}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handlePatch();
                      }
                    }}
                  />
                  <HStack w="100%">
                    <Button
                      onClick={handlePatch}
                      loading={isPatching}
                      colorPalette="blue"
                      flex="1"
                      size="sm"
                    >
                      Apply Revision
                    </Button>
                    <Button
                      onClick={() => {
                        setFlow(null);
                        setHistory([]);
                        setPatchCount(0);
                      }}
                      variant="outline"
                      size="sm"
                    >
                      New Flow
                    </Button>
                  </HStack>
                </VStack>
              )}
            </Box>
          </Box>
        </Box>

        {/* Compliance Notes Table */}
        {flow && flow.complianceNotes.length > 0 && (
          <ComplianceTable notes={flow.complianceNotes} />
        )}

        {/* Legend */}
        {flow && (
          <HStack gap={6} px={2} flexWrap="wrap">
            <HStack gap={1}>
              <Box w={3} h={3} bg="#dae8fc" borderRadius="sm" border="1px solid #6c8ebf" />
              <Text fontSize="xs" color="gray.500">
                Entity / Organization
              </Text>
            </HStack>
            <HStack gap={1}>
              <Box w={3} h={3} bg="#d5e8d4" borderRadius="sm" border="1px solid #82b366" />
              <Text fontSize="xs" color="gray.500">
                Process Step
              </Text>
            </HStack>
            <HStack gap={1}>
              <Box w={3} h={3} bg="#fff2cc" borderRadius="sm" border="1px solid #d6b656" />
              <Text fontSize="xs" color="gray.500">
                Decision Point
              </Text>
            </HStack>
            <HStack gap={1}>
              <Box w={3} h={3} bg="#f8cecc" borderRadius="sm" border="1px solid #b85450" />
              <Text fontSize="xs" color="gray.500">
                Compliance / Risk
              </Text>
            </HStack>
            <Text fontSize="xs" color="gray.400">
              | Entities: {flow.entities.join(", ")}
            </Text>
          </HStack>
        )}
      </VStack>
    </Container>
  );
}
