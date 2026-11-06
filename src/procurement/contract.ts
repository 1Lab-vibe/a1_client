import { z } from "zod";

export const VERSION = "procurement.v1" as const;
const decimal = z.string().regex(/^\d+(\.\d+)?$/);
const money = z.object({ amount: decimal, currency: z.literal("RUB") });
const issue = z.object({
  code: z.string(),
  message: z.string(),
  severity: z.enum(["info", "warning", "error"]),
  field: z.string().optional(),
});
const source = z.object({
  file_name: z.string(),
  sheet: z.string(),
  row: z.number().int(),
  observed_at: z.string().nullable().default(null),
});
const scalar = z.union([z.string(), z.number(), z.boolean()]);
const attribute = z.object({
  key: z.string(),
  label: z.string(),
  unit: z.string().nullable(),
  value: scalar.nullable(),
  status: z.enum(["known", "unknown", "conflicting"]),
  source_values: z.array(scalar).optional(),
});
const category = z.object({ id: z.string(), label: z.string() });
const parsedIssue = z.union([
  issue,
  z.string().transform((message) => ({
    code: "PARSE_WARNING",
    message,
    severity: "warning" as const,
  })),
]);
const facetCategories = z.union([
  z.array(z.object({ path: z.array(category) })),
  z
    .array(category.extend({ parent_id: z.string().nullable() }))
    .transform((categories) =>
      categories.map((entry) => {
        const path: z.infer<typeof category>[] = [];
        const seen = new Set<string>();
        let current: typeof entry | undefined = entry;
        while (current && !seen.has(current.id)) {
          seen.add(current.id);
          path.unshift({ id: current.id, label: current.label });
          const parent: string | null = current.parent_id;
          current = categories.find((item) => item.id === parent);
        }
        return { path };
      }),
    ),
]);
const offer = z.object({
  offer_id: z.string(),
  source_id: z.string(),
  source_name: z.string(),
  article: z.string(),
  price: money.nullable(),
  price_role: z.string(),
  unit: z.string().nullable(),
  pack_quantity: decimal.nullable(),
  vat_basis: z.string().nullable(),
  comparable_unit_price: money.nullable(),
  comparison_status: z.enum(["comparable", "needs_review", "unavailable"]),
  stock: z.object({
    quantity: decimal.nullable(),
    unit: z.string().nullable(),
    as_of: z.string().nullable(),
  }),
  source_ref: source,
  issues: z.array(issue),
});
const product = z.object({
  product_id: z.string(),
  name: z.string().nullable(),
  article: z.string(),
  brand: z.string().nullable(),
  category_paths: z.array(z.array(category)),
  attributes: z.array(attribute),
  offer,
  issues: z.array(issue),
  match_type: z.literal("analog").optional(),
  compatibility: z.enum(["confirmed", "needs_review"]).optional(),
  match_explanation: z.string().optional(),
  differences: z
    .array(
      z.object({
        attribute: z.string(),
        requested: z.string().nullable(),
        offered: z.string().nullable(),
        acceptable: z.boolean().nullable(),
      }),
    )
    .optional(),
});
const candidate = z.object({
  product_id: z.string(),
  name: z.string().nullable(),
  article: z.string(),
  offer,
  match_type: z.enum(["exact", "analog"]),
  compatibility: z.enum(["confirmed", "needs_review"]),
  explanation: z.string(),
  differences: z.array(
    z.object({
      attribute: z.string(),
      requested: z.string().nullable(),
      offered: z.string().nullable(),
      acceptable: z.boolean().nullable(),
    }),
  ),
  line_total: money.nullable(),
  price_deviation_percent: z.string().nullable(),
});
const webOffer = z.object({
  article: z.string(), name: z.string(), brand: z.string(), seller: z.string(), url: z.string(),
  price: money.nullable(), unit: z.string().nullable(), vat_basis: z.string(), available: z.boolean(),
  condition: z.string(), match_type: z.enum(["exact", "analog"]), explanation: z.string(), observed_at: z.string(),
});
const marketVariant = z.object({ article: z.string(), brand: z.string(), status: z.string(), mean_price: money.nullable(), independent_source_count: z.number() });
const intelligence = z.object({ status: z.enum(["pending", "busy", "completed", "partial", "unavailable"]), web_enabled: z.boolean(),
  candidate_count: z.number(), shortlist_limited: z.boolean(), checked_at: z.string().nullable(),
  requirements: z.array(z.object({label: z.string(), value: z.string(), evidence: z.string()})), search_queries: z.array(z.string()) });
export type WebOffer = z.infer<typeof webOffer>;
export type MarketVariant = z.infer<typeof marketVariant>;
export const rowStatus = z.enum([
  "exact_found",
  "analog_found",
  "needs_review",
  "not_found",
]);
const analysisRow = z.object({
  web_offers: z.array(webOffer).optional(),
  market_references: z.array(marketVariant).optional(),
  intelligence: intelligence.nullable().optional(),
  line_id: z.string(),
  position: z.number(),
  original_text: z.string(),
  quantity: decimal.nullable(),
  unit: z.string().nullable(),
  status: rowStatus,
  selected: candidate.nullable(),
  alternatives: z.array(candidate),
  market_reference: z.object({
    status: z.enum([
      "available",
      "insufficient_sources",
      "needs_identification",
      "not_requested",
      "unavailable",
    ]),
    original_product_name: z.string().nullable(),
    mean_price: money.nullable(),
    unit: z.string().nullable(),
    independent_source_count: z.number(),
    checked_at: z.string().nullable(),
    sources: z.array(
      z.object({
        seller: z.string(),
        url: z.string(),
        price: money,
        observed_at: z.string(),
        included: z.boolean(),
        exclusion_reason: z.string().nullable(),
      }),
    ),
  }),
  issues: z.array(issue),
  explanation: z.string(),
});
const attributeFilter = z.object({
  key: z.string(),
  operator: z.enum(["eq", "in", "gte", "lte"]),
  value: z.union([scalar, z.array(scalar)]),
});
export const lineSchema = z.object({
  line_id: z.string(),
  position: z.number().int(),
  original_text: z.string(),
  article: z.string().nullable(),
  brand: z.string().nullable(),
  quantity: decimal.nullable(),
  unit: z.string().nullable(),
  required_attributes: z.array(attributeFilter),
  source_ref: source.nullable(),
  comment: z.string(),
  parse_issues: z.array(parsedIssue).optional(),
});
const page = z.object({
  limit: z.number().int().min(1).max(100),
  cursor: z.string().nullable(),
});
const pageResult = z.object({
  limit: z.number(),
  next_cursor: z.string().nullable(),
  total: z.number().nullable(),
});
const filters = z.object({
  category_ids: z.array(z.string()),
  brands: z.array(z.string()),
  source_ids: z.array(z.string()),
  price: z.object({
    min: decimal.nullable(),
    max: decimal.nullable(),
    currency: z.literal("RUB"),
  }),
  stock_known: z.boolean().nullable(),
  attributes: z.array(attributeFilter),
});
const summary = z.object({
  total_lines: z.number(),
  exact_found: z.number(),
  analog_found: z.number(),
  needs_review: z.number(),
  not_found: z.number(),
  priced_lines: z.number(),
  unpriced_lines: z.number(),
  priced_total: money.nullable(),
});
const jobType = z.enum(["parse", "analysis", "export"]);
const jobStatus = z.enum(["queued", "running", "completed", "failed"]);
export const errorSchema = z.object({
  code: z.string(),
  message: z.string(),
  retryable: z.boolean(),
  correlation_id: z.string().optional(),
  details: z
    .array(
      z.object({
        line_id: z.string().optional(),
        field: z.string(),
        reason: z.string(),
      }),
    )
    .optional(),
});
const parsed = z.object({
  draft_id: z.string(),
  revision: z.number(),
  title: z.string(),
  notes: z.string().default(""),
  lines: z.array(lineSchema),
  warnings: z.array(parsedIssue),
});
const accepted = z.object({
  kind: z.literal("job.accepted"),
  job_id: z.string(),
  job_type: jobType,
  status: jobStatus,
  poll_after_ms: z.number(),
});
export const payloadSchemas = {
  "catalog.facets": z.object({ query: z.string(), filters }),
  "catalog.search": z.object({
    query: z.string(),
    mode: z.enum(["intelligent", "catalog"]).optional(),
    web_enabled: z.boolean().optional(),
    filters,
    sort: z.object({
      field: z.literal("comparable_unit_price"),
      direction: z.literal("asc"),
    }),
    page,
  }),
  "catalog.get": z.object({ product_id: z.string() }),
  "request.parse": z
    .object({
      text: z.string().optional(),
      file_ids: z.array(z.string()).optional(),
      title: z.string().optional(),
    })
    .refine(
      (p) => !!p.text?.trim() !== !!p.file_ids?.length,
      "Укажите текст или файл",
    ),
  "analysis.start": z.object({
    draft_id: z.string().optional(),
    revision: z.number().int().positive(),
    title: z.string().min(1),
    notes: z.string().optional(),
    lines: z.array(lineSchema).min(1),
    options: z.object({
      allow_analogs_when_no_exact: z.boolean(),
      market_reference_enabled: z.boolean(),
      max_absolute_price_deviation_percent: decimal.nullable(),
      sort: z.literal("comparable_unit_price_asc"),
    }),
  }),
  "job.get": z.object({ job_id: z.string() }),
  "analysis.result": z.object({
    analysis_id: z.string(),
    page,
    status_filter: rowStatus.optional(),
  }),
  "analysis.history": z.object({ page }),
  "analysis.export": z.object({
    analysis_id: z.string(),
    format: z.enum(["xlsx", "csv"]),
    result_revision: z.number(),
  }),
};
export const resultSchemas = {
  "catalog.facets": z.object({
    kind: z.literal("catalog.facets"),
    categories: facetCategories,
    brands: z.array(z.string()),
    sources: z.array(
      z.union([
        category,
        z
          .object({ id: z.string(), name: z.string() })
          .transform(({ id, name }) => ({ id, label: name })),
      ]),
    ),
    attributes: z.array(
      z.object({
        key: z.string(),
        label: z.string(),
        type: z.enum(["number", "string", "boolean"]),
        unit: z.string().nullable(),
        operators: z.array(z.enum(["eq", "in", "gte", "lte"])),
        values: z.array(scalar).optional(),
      }),
    ),
    capabilities: z.object({
      catalog_search: z.boolean(),
      request_parse: z.boolean(),
      analysis: z.boolean(),
      market_reference: z.boolean(),
      export: z.boolean(),
      upload: z.object({
        enabled: z.boolean(),
        extensions: z.array(z.string()),
        max_size_bytes: z.number(),
        max_files: z.number(),
      }),
      unavailable_reasons: z.union([
        z.record(z.string(), z.string()),
        z
          .array(z.string())
          .transform((reasons) => ({ market_reference: reasons.join(". ") })),
      ]),
    }),
  }),
  "catalog.search": z.object({
    kind: z.literal("catalog.search"),
    search_mode: z.enum(["catalog", "analogs", "intelligent"]).optional(),
    intelligence: intelligence.optional(),
    web_offers: z.array(webOffer).optional(),
    market_references: z.array(marketVariant).optional(),
    reference_status: z.enum(["pending"]).optional(),
    reference: z
      .object({
        name: z.string(),
        category: z.string(),
        source_url: z.string().optional(),
      })
      .optional(),
    items: z.array(product),
    page: pageResult,
    interpreted_query: z.object({ summary: z.string() }),
    warnings: z.array(issue),
  }),
  "catalog.get": z.preprocess(
    (raw) => {
      if (raw && typeof raw === "object" && !("product" in raw))
        return { ...raw, product: raw };
      return raw;
    },
    z.object({
      kind: z.literal("catalog.get"),
      product,
      offers: z.array(offer),
      attributes: z.array(attribute),
      source_refs: z.array(source),
      issues: z.array(issue),
    }),
  ),
  "request.parse": accepted,
  "analysis.start": accepted,
  "job.get": z.object({
    kind: z.literal("job.status"),
    job_id: z.string(),
    job_type: jobType,
    status: jobStatus,
    stage: z
      .enum([
        "parsing",
        "normalization",
        "exact_search",
        "analog_search",
        "market_reference",
        "finalizing",
        "export",
      ])
      .nullable(),
    progress: z
      .object({
        processed_lines: z.number(),
        total_lines: z.number().nullable(),
      })
      .nullable()
      .transform((value) => value ?? { processed_lines: 0, total_lines: null }),
    analysis_id: z.string().optional(),
    partial_result_available: z.boolean(),
    poll_after_ms: z.number(),
    error: errorSchema.nullable(),
    parsed_request: parsed.optional(),
    download: z
      .object({
        url: z.string(),
        expires_at: z.string(),
        filename: z.string(),
        content_type: z.string(),
      })
      .optional(),
  }),
  "analysis.result": z.object({
    kind: z.literal("analysis.result"),
    analysis_id: z.string(),
    summary,
    rows: z.array(analysisRow),
    page: pageResult,
    complete: z.boolean(),
    result_revision: z.number(),
  }),
  "analysis.history": z.object({
    kind: z.literal("analysis.history"),
    items: z.array(
      z.object({
        job_id: z.string(),
        analysis_id: z.string().optional(),
        title: z.string(),
        created_at: z.string(),
        status: jobStatus,
        summary: summary.nullable(),
      }),
    ),
    page: pageResult,
  }),
  "analysis.export": accepted,
};
export type Action = keyof typeof payloadSchemas;
export type Payload<A extends Action> = z.infer<(typeof payloadSchemas)[A]>;
export type Result<A extends Action> = z.infer<(typeof resultSchemas)[A]>;
export type Command<A extends Action = Action> = {
  contract_version: typeof VERSION;
  request_id: string;
  company_id: string;
  action: A;
  payload: Payload<A>;
};
export type Money = z.infer<typeof money>;
export type Issue = z.infer<typeof issue>;
export type Attribute = z.infer<typeof attribute>;
export type Offer = z.infer<typeof offer>;
export type Product = z.infer<typeof product>;
export type Candidate = z.infer<typeof candidate>;
export type AnalysisRow = z.infer<typeof analysisRow>;
export type Line = z.infer<typeof lineSchema>;
export type Filters = z.infer<typeof filters>;
export type Job = Result<"job.get">;
export type ApiError = z.infer<typeof errorSchema>;
export type Upload = {
  file_id: string;
  name: string;
  size_bytes: number;
  status: "uploaded";
};
export interface ProcurementClient {
  readonly mode: "mock" | "live";
  command<A extends Action>(
    command: Command<A>,
    signal?: AbortSignal,
  ): Promise<Result<A>>;
  upload(file: File, signal?: AbortSignal): Promise<Upload>;
}
export const emptyFilters = (): Filters => ({
  category_ids: [],
  brands: [],
  source_ids: [],
  price: { min: null, max: null, currency: "RUB" },
  stock_known: null,
  attributes: [],
});
export function command<A extends Action>(
  company: string,
  action: A,
  payload: Payload<A>,
): Command<A> {
  return {
    contract_version: VERSION,
    request_id: crypto.randomUUID(),
    company_id: company,
    action,
    payload,
  };
}
export function validateLines(lines: Line[]): ApiError["details"] {
  return lines.flatMap((line) => [
    ...(!line.original_text.trim()
      ? [
          {
            line_id: line.line_id,
            field: "original_text",
            reason: "Укажите описание",
          },
        ]
      : []),
    ...(!line.quantity ||
    !/^\d+(\.\d+)?$/.test(line.quantity) ||
    Number(line.quantity) <= 0
      ? [
          {
            line_id: line.line_id,
            field: "quantity",
            reason: "Укажите положительное количество",
          },
        ]
      : []),
    ...(!line.unit?.trim()
      ? [
          {
            line_id: line.line_id,
            field: "unit",
            reason: "Подтвердите единицу",
          },
        ]
      : []),
  ]);
}
