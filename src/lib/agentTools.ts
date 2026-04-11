/**
 * Agent tool definitions + client-side executors.
 *
 * Tools are defined as Anthropic tool schemas (sent to Claude).
 * Executors run locally in the browser against Zustand state
 * — no server-side DB required.
 */

// ── Tool name enum ─────────────────────────────────────────────────────────────

export type ToolName =
  | "get_metrics"
  | "get_acos_history"
  | "get_inventory"
  | "get_ad_campaigns"
  | "get_search_terms"
  | "get_alerts"
  | "list_uploaded_files"
  | "get_file_data";

// ── Tool definitions for Anthropic API ────────────────────────────────────────

export const AGENT_TOOLS = [
  {
    name: "get_metrics" as const,
    description:
      "查询产品的 KPI 指标快照，包含 GMV、订单量、ACoS、ROAS、CTR、CPC、CVR、广告花费。" +
      "可查询：今日(today)、昨日(yesterday)、近7日(w7)、近14日(w14)、近30日(d30)。" +
      "需要分析多个时间段时请多次调用此工具。",
    input_schema: {
      type: "object" as const,
      properties: {
        time_window: {
          type: "string",
          enum: ["today", "yesterday", "w7", "w14", "d30"],
          description: "时间窗口",
        },
      },
      required: ["time_window"],
    },
  },
  {
    name: "get_acos_history" as const,
    description:
      "查询 ACoS + GMV 日趋势历史数组，用于分析广告效率趋势。" +
      "每条记录含 date(YYYY-MM-DD)、acos(%)、gmv($)。",
    input_schema: {
      type: "object" as const,
      properties: {
        days: {
          type: "number",
          description: "返回最近 N 天；不填则返回全部历史",
        },
      },
    },
  },
  {
    name: "get_inventory" as const,
    description:
      "查询产品库存状况。返回各 SKU/市场 的可售库存、在途库存、可售天数、日均销量、建议补货量。",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "get_ad_campaigns" as const,
    description:
      "查询广告活动维度数据。每条记录含：活动名、状态、花费、销售额、预算、ACoS、ROAS、CTR、CVR。" +
      "filter 参数可按高ACoS、超预算、花费最高过滤。",
    input_schema: {
      type: "object" as const,
      properties: {
        filter: {
          type: "string",
          enum: ["all", "high_acos", "over_budget", "top_spend"],
          description:
            "all=全部 | high_acos=ACoS>55% | over_budget=花费超预算10%+ | top_spend=花费最高前10",
        },
        limit: {
          type: "number",
          description: "最多返回 N 条，默认 20",
        },
      },
    },
  },
  {
    name: "get_search_terms" as const,
    description:
      "查询搜索词（关键词）粒度的广告表现。每条记录含：搜索词、匹配类型、花费、订单、ACoS、CVR、CTR、CPC。" +
      "filter 参数可按零转化、优质词、高ACoS、高花费过滤。",
    input_schema: {
      type: "object" as const,
      properties: {
        filter: {
          type: "string",
          enum: ["all", "zero_conv", "winner", "high_acos", "high_spend"],
          description:
            "all=全部 | zero_conv=点击≥10无成交 | winner=ACoS≤35%且CVR≥4% | high_acos=ACoS>60% | high_spend=花费最高",
        },
        limit: {
          type: "number",
          description: "最多返回 N 条，默认 30",
        },
      },
    },
  },
  {
    name: "get_alerts" as const,
    description:
      "查询告警引擎已触发的告警列表（来自上传的广告活动/搜索词报表自动检测）。" +
      "含优先级(P0-P3)、告警标题、描述、建议动作。",
    input_schema: {
      type: "object" as const,
      properties: {
        priority: {
          type: "string",
          enum: ["all", "P0", "P1", "P2", "P3"],
          description: "all=全部 | P0=立即处理 | P1=24h内 | P2=本周 | P3=下周期",
        },
      },
    },
  },
  {
    name: "list_uploaded_files" as const,
    description:
      "列出当前产品已上传的报表文件列表，用于判断哪些数据维度已有数据可查询。",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "get_file_data" as const,
    description:
      "按文件类型读取已上传报表的完整解析数据。适用于所有文件类型，包括：" +
      "nordhive_sku_report（SKU视图指标）、" +
      "nordhive_ad_placement（广告位分布）、" +
      "nordhive_ad_restructure（广告活动重构）、" +
      "nordhive_cost_mgmt（成本管理/毛利率）、" +
      "single_product_archive（单品归档）、" +
      "aba_search_compare（ABA搜索词竞品对比）。" +
      "也可用于读取 nordhive_asin_report / nordhive_ad_campaign / nordhive_search_term 的原始行数据。" +
      "先调用 list_uploaded_files 确认文件类型再调用此工具。",
    input_schema: {
      type: "object" as const,
      properties: {
        file_type: {
          type: "string",
          description:
            "文件类型标识，如 nordhive_sku_report / nordhive_cost_mgmt / aba_search_compare 等",
        },
        limit: {
          type: "number",
          description: "最多返回 N 条记录，默认 50",
        },
      },
      required: ["file_type"],
    },
  },
] as const;

// ── Agent state (read-only snapshot from Zustand) ─────────────────────────────

export interface AgentState {
  productId: string;
  metrics?: {
    today?: Record<string, number>;
    yesterday?: Record<string, number>;
    w7?: Record<string, number>;
    w14?: Record<string, number>;
    d30?: Record<string, number>;
    acosHistory?: Array<{ date: string; acos: number; gmv?: number }>;
  };
  inventory?: unknown[];
  adData?: {
    campaigns: Record<string, unknown>[];
    searchTerms: Record<string, unknown>[];
  };
  alerts?: Array<{ priority: string; status: string; [key: string]: unknown }>;
  files?: Array<{ fileName: string; fileType: string; timeWindow: string }>;
  /** All parsed file data keyed by fileType — covers every uploaded file type */
  parsedFileData?: Record<string, Record<string, unknown>[]>;
}

// ── Tool display labels (shown in UI during tool calls) ───────────────────────

export const TOOL_LABELS: Record<ToolName, string> = {
  get_metrics:        "KPI 指标",
  get_acos_history:   "ACoS 趋势",
  get_inventory:      "库存数据",
  get_ad_campaigns:   "广告活动",
  get_search_terms:   "搜索词数据",
  get_alerts:         "当前告警",
  list_uploaded_files: "已上传文件",
  get_file_data:      "报表数据",
};

// ── Client-side tool executors ─────────────────────────────────────────────────

type ToolInput = Record<string, unknown>;

export function executeToolCall(
  name: ToolName,
  input: ToolInput,
  state: AgentState
): unknown {
  switch (name) {
    // ── get_metrics ──────────────────────────────────────────────────────────
    case "get_metrics": {
      const tw = input.time_window as string;
      const windowMap: Record<string, keyof NonNullable<AgentState["metrics"]>> = {
        today:     "today",
        yesterday: "yesterday",
        w7:        "w7",
        w14:       "w14",
        d30:       "d30",
      };
      const key = windowMap[tw];
      if (!key) return { error: `未知时间窗口: ${tw}` };
      const snap = state.metrics?.[key];
      if (!snap) {
        return {
          error: `暂无「${tw}」时间窗口的数据。` +
            (tw === "today" || tw === "yesterday"
              ? "请上传单日(daily)的 ASIN 报表。"
              : tw === "w7"
              ? "请上传近7天的 weekly ASIN 报表。"
              : tw === "w14"
              ? "请上传近14天的 biweekly ASIN 报表。"
              : "请上传近30天的 monthly ASIN 报表。"),
        };
      }
      return { time_window: tw, ...snap };
    }

    // ── get_acos_history ─────────────────────────────────────────────────────
    case "get_acos_history": {
      const hist = state.metrics?.acosHistory ?? [];
      if (!hist.length) {
        return { error: "暂无 ACoS 历史数据，请依次上传多天 daily ASIN 报表。" };
      }
      const days = input.days as number | undefined;
      return days ? hist.slice(-days) : hist;
    }

    // ── get_inventory ─────────────────────────────────────────────────────────
    case "get_inventory": {
      const inv = state.inventory ?? [];
      if (!inv.length) return { error: "暂无库存数据，请上传库存报表。" };
      return inv;
    }

    // ── get_ad_campaigns ─────────────────────────────────────────────────────
    case "get_ad_campaigns": {
      const campaigns = state.adData?.campaigns ?? [];
      if (!campaigns.length) {
        return { error: "暂无广告活动数据，请上传「系统-Nordhive-*-广告活动*.xlsx」。" };
      }

      const filter = (input.filter as string) || "all";
      const limit  = (input.limit  as number) || 20;

      let result = [...campaigns] as Array<Record<string, unknown>>;

      if (filter === "high_acos") {
        result = result.filter((c) => ((c.acos as number) ?? 0) > 55);
      } else if (filter === "over_budget") {
        result = result.filter((c) => {
          const spend  = (c.spend  as number) ?? 0;
          const budget = (c.budget as number) ?? 0;
          return budget > 0 && spend > budget * 1.1;
        });
      } else if (filter === "top_spend") {
        result = result
          .slice()
          .sort((a, b) => ((b.spend as number) ?? 0) - ((a.spend as number) ?? 0));
      }

      // Strip rawJson to keep tool result concise
      return result.slice(0, limit).map(({ rawJson: _rawJson, ...rest }) => rest);
    }

    // ── get_search_terms ─────────────────────────────────────────────────────
    case "get_search_terms": {
      const terms = state.adData?.searchTerms ?? [];
      if (!terms.length) {
        return { error: "暂无搜索词数据，请上传「系统-Nordhive-*-搜索词重构*.xlsx」。" };
      }

      const filter = (input.filter as string) || "all";
      const limit  = (input.limit  as number) || 30;

      let result = [...terms] as Array<Record<string, unknown>>;

      if (filter === "zero_conv") {
        result = result.filter(
          (t) => ((t.clicks as number) ?? 0) >= 10 && ((t.orders as number) ?? 0) === 0
        );
      } else if (filter === "winner") {
        result = result.filter(
          (t) => ((t.acos as number) ?? 999) <= 35 && ((t.cvr as number) ?? 0) >= 4
        );
      } else if (filter === "high_acos") {
        result = result.filter((t) => ((t.acos as number) ?? 0) > 60);
      } else if (filter === "high_spend") {
        result = result
          .slice()
          .sort((a, b) => ((b.spend as number) ?? 0) - ((a.spend as number) ?? 0));
      }

      return result.slice(0, limit);
    }

    // ── get_alerts ───────────────────────────────────────────────────────────
    case "get_alerts": {
      const alerts = state.alerts ?? [];
      const priority = (input.priority as string) || "all";
      const open = alerts.filter((a) => a.status === "open");
      const filtered =
        priority === "all"
          ? open
          : open.filter((a) => a.priority === priority);
      if (!filtered.length) {
        return { message: priority === "all" ? "当前无告警" : `当前无 ${priority} 级别告警` };
      }
      return filtered;
    }

    // ── list_uploaded_files ───────────────────────────────────────────────────
    case "list_uploaded_files": {
      const files = state.files ?? [];
      if (!files.length) return { message: "当前产品暂无已上传文件" };
      return files.map((f) => ({
        fileName:   f.fileName,
        fileType:   f.fileType,
        timeWindow: f.timeWindow,
      }));
    }

    // ── get_file_data ─────────────────────────────────────────────────────────
    case "get_file_data": {
      const fileType = input.file_type as string;
      const limit    = (input.limit as number) || 50;

      if (!fileType) return { error: "缺少 file_type 参数" };

      // Fallback hints for types with dedicated tools
      if (fileType === "nordhive_asin_report") {
        const hasMetrics = state.metrics && (
          state.metrics.today || state.metrics.w7 || state.metrics.w14 || state.metrics.d30
        );
        if (hasMetrics) {
          return {
            hint: "ASIN报表数据请使用 get_metrics(time_window) 和 get_acos_history() 工具获取，数据已就绪。",
            available_windows: Object.entries(state.metrics ?? {})
              .filter(([k, v]) => k !== "acosHistory" && v != null)
              .map(([k]) => k),
          };
        }
      }
      if (fileType === "nordhive_ad_campaign") {
        const rows = state.adData?.campaigns ?? [];
        if (rows.length) return { hint: "广告活动数据请使用 get_ad_campaigns() 工具获取，数据已就绪。", count: rows.length };
      }
      if (fileType === "nordhive_search_term") {
        const rows = state.adData?.searchTerms ?? [];
        if (rows.length) return { hint: "搜索词数据请使用 get_search_terms() 工具获取，数据已就绪。", count: rows.length };
      }
      if (fileType === "nordhive_inventory") {
        const rows = state.inventory ?? [];
        if (rows.length) return { hint: "库存数据请使用 get_inventory() 工具获取，数据已就绪。", count: rows.length };
      }

      // General lookup from parsedFileData
      const rows = state.parsedFileData?.[fileType];
      if (!rows || rows.length === 0) {
        const available = Object.keys(state.parsedFileData ?? {});
        return {
          error: `未找到 ${fileType} 的数据，该文件可能未上传或需要重新上传。`,
          available_types: available.length ? available : [],
          tip: "请确认已通过左侧栏「上传文件」按钮上传了对应报表。",
        };
      }

      return {
        file_type:   fileType,
        total_rows:  rows.length,
        returned:    Math.min(limit, rows.length),
        rows:        rows.slice(0, limit),
      };
    }

    default:
      return { error: `未知工具: ${name as string}` };
  }
}
