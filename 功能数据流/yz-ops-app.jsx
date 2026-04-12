import { useState } from "react";

/* ═══════════════════════════════════════════
   NAVIGATION
   ═══════════════════════════════════════════ */

const NAV_ITEMS = [
  { id: "overview", label: "账号总览",   icon: "📊", type: "page"     },
  { id: "chat",     label: "Chat",       icon: "💬", type: "page"     },
  { id: "mattress", label: "沙发床垫",   icon: "🛏", type: "category" },
  { id: "pump",     label: "充气泵",     icon: "🔧", type: "category" },
  { id: "scooter",  label: "电动滑板车", icon: "🛴", type: "category" },
];

const FUNC_TABS = [
  { id: "kpi",       label: "KPI 汇总", icon: "📈" },
  { id: "alerts",    label: "每日告警", icon: "🚨" },
  { id: "ads",       label: "广告优化", icon: "🎯" },
  { id: "inventory", label: "库存看板", icon: "📦" },
];

const MODELS = ["claude-sonnet-4-6", "claude-opus-4-6"];

/* ═══════════════════════════════════════════
   CONTEXT FOLDER  —  single source of truth
   All features read from these files.
   ═══════════════════════════════════════════ */

const UPLOADED_FILES = [
  { name: "产品报表",     file: "product_2026-04-09.xlsx",    date: "04-09", status: "fresh" },
  { name: "关键词监控",   file: "keyword_2026-04-10.xlsx",    date: "04-10", status: "fresh" },
  { name: "库存报表",     file: "inventory_2026-04-08.xlsx",  date: "04-08", status: "ok"    },
  { name: "搜索词重构",   file: "search_terms_30d.xlsx",      date: "04-06", status: "ok"    },
  { name: "广告活动重构", file: "campaign_3m.xlsx",           date: "04-08", status: "ok"    },
  { name: "US广告活动",   file: "us_campaign_30d.xlsx",       date: "04-06", status: "ok"    },
  { name: "广告位报表",   file: "placement_us_30d.xlsx",      date: "04-06", status: "ok"    },
  { name: "成本管理",     file: "cost_mgmt.xlsx",             date: "04-06", status: "ok"    },
  { name: "ABA搜索词",    file: "aba_search_compare.xlsx",    date: "01-19", status: "stale" },
];

/* ═══════════════════════════════════════════
   DATA
   ═══════════════════════════════════════════ */

const OVERVIEW_DATA = {
  gmv30d: 8426, adSpend30d: 2974, tacos: 35.3, sellable: 1769, orders30d: 86,
  categories: [
    { name: "沙发床垫",   red: 3, yellow: 3, asins: 2  },
    { name: "充气泵",     red: 0, yellow: 1, asins: 1  },
    { name: "电动滑板车", red: 0, yellow: 0, asins: 1  },
    { name: "未分类",     red: 0, yellow: 3, asins: 30 },
  ],
};

const MATTRESS_KPI = {
  gmv7d: 2184, adSpend7d: 694, tacos: 31.8, acos: 46.9, orders7d: 16,
  asins: [
    { asin: "B0GD7BF2TZ", title: "Queen 4\" 沙发床垫", price: 129, rating: 5.0, gmvYesterday: 218, acos: 82.4, sellable: 123, adSpend30d: 1697 },
    { asin: "B0GD7K1TC9", title: "Full 4\" 沙发床垫",  price: 119, rating: 5.0, gmvYesterday: 99,  acos: 60.2, sellable: 153, adSpend30d: 1275 },
  ],
};

const MATTRESS_ALERTS = [
  { level: "red",    asin: "B0GD7BF2TZ", metric: "ACOS",           value: "82.4%", tip: "否定无效词；零成交词(>15次点击)暂停" },
  { level: "red",    asin: "B0GD7BF2TZ", metric: "广告超预算",     value: "超42%", tip: "暂停最高花费广泛组，降出价10-15%" },
  { level: "red",    asin: "B0GD7K1TC9", metric: "ACOS",           value: "60.2%", tip: "高ACOS词出价降30-40%" },
  { level: "yellow", asin: "B0GD7BF2TZ", metric: "BSR小类",        value: "#516",  tip: "提高核心词出价争取曝光" },
  { level: "yellow", asin: "B0GD7K1TC9", metric: "广告花费利用率", value: "超18%", tip: "优化出价结构" },
  { level: "yellow", asin: "B0GD7K1TC9", metric: "BSR小类",        value: "#516",  tip: "提高出价争取曝光" },
];

// asin field added; overlap row shows both ASINs
const MATTRESS_ADS = [
  { priority: "P0",      asin: "B0GD7BF2TZ",     term: "foam mattress thick",       match: "广泛",    clicks: 22,   orders: 0,    spend: 31.4, acos: null,  action: "暂停 + 否定" },
  { priority: "P0",      asin: "B0GD7BF2TZ",     term: "sofa replacement cushion",  match: "广泛",    clicks: 18,   orders: 0,    spend: 24.8, acos: null,  action: "精确否定" },
  { priority: "P1",      asin: "B0GD7BF2TZ",     term: "sofa mattress replacement", match: "精确",    clicks: 38,   orders: 3,    spend: 68.2, acos: "92%", action: "出价降30-40%" },
  { priority: "P1",      asin: "B0GD7K1TC9",     term: "pull out couch mattress",   match: "广泛",    clicks: 42,   orders: 4,    spend: 55.1, acos: "87%", action: "出价降30%" },
  { priority: "P2",      asin: "B0GD7K1TC9",     term: "mattress for sleeper sofa", match: "精确",    clicks: 44,   orders: 5,    spend: 52.3, acos: "28%", action: "出价提15-20%" },
  { priority: "overlap", asin: "BF2TZ / K1TC9",  term: "sofa mattress（广泛）",     match: "内部竞争", clicks: null, orders: null, spend: null, acos: null,  action: "在Full款否定该词" },
];

const MATTRESS_INV = [
  { asin: "B0GD7BF2TZ", sku: "U5A4Q01", title: "Queen 4\"", sellable: 123, inbound: 0, daysOfSupply: "—", fulfillment: "FBM" },
  { asin: "B0GD7K1TC9", sku: "U5A4F01", title: "Full 4\"",  sellable: 153, inbound: 0, daysOfSupply: "—", fulfillment: "FBM" },
];

const CAT_KPI    = { mattress: MATTRESS_KPI };
const CAT_ALERTS = { mattress: MATTRESS_ALERTS };
const CAT_ADS    = { mattress: MATTRESS_ADS };
const CAT_INV    = { mattress: MATTRESS_INV };

const CHAT_SUGGESTIONS = [
  "账号整体 TACoS 趋势如何？",
  "哪个品类最需要关注？",
  "床垫 ACOS 为什么这么高？",
  "Queen 和 Full 哪个表现更好？",
  "广告优化该先做什么？",
  "库存断货风险有哪些？",
];

/* ═══════════════════════════
   STYLES
   ═══════════════════════════ */

const C = {
  bg: "#f5f6f8",
  sidebar: "#ffffff",
  sidebarHover: "#f0f1f5",
  sidebarActive: "rgba(59,91,219,0.07)",
  sidebarText: "#5c6070",
  sidebarTextActive: "#3b5bdb",
  funcBar: "#ffffff",
  funcBorder: "#ecedf1",
  text: "#1a1d28",
  textSec: "#5c6070",
  textDim: "#969bb0",
  accent: "#3b5bdb",
  accentSoft: "rgba(59,91,219,0.07)",
  red: "#d63031",
  redBg: "rgba(214,48,49,0.06)",
  yellow: "#e17f00",
  yellowBg: "rgba(225,127,0,0.06)",
  green: "#0ca678",
  border: "#e8e9ee",
  radius: 10,
};

/* ═══════════════════════════
   PANELS
   ═══════════════════════════ */

function OverviewPanel() {
  const statusMeta = {
    fresh: { l: "新鲜", c: C.green   },
    ok:    { l: "正常", c: C.textDim },
    stale: { l: "过期", c: C.red     },
  };
  return (
    <div style={{ padding: 28 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 20px", color: C.text }}>
        账号总览
        <span style={{ fontSize: 12, fontWeight: 400, color: C.textDim, marginLeft: 8 }}>Nordhive · US · 2026-04-09</span>
      </h2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "总 GMV (30d)",   value: `$${OVERVIEW_DATA.gmv30d.toLocaleString()}`,    color: C.accent },
          { label: "广告花费 (30d)",  value: `$${OVERVIEW_DATA.adSpend30d.toLocaleString()}` },
          { label: "TACoS (30d)",    value: `${OVERVIEW_DATA.tacos}%`, color: OVERVIEW_DATA.tacos > 20 ? C.red : C.green },
          { label: "FBA可售库存",    value: `${OVERVIEW_DATA.sellable.toLocaleString()} 件` },
        ].map((k, i) => (
          <div key={i} style={{ background: C.bg, borderRadius: C.radius, padding: "14px 16px", borderLeft: `3px solid ${k.color || C.border}` }}>
            <div style={{ fontSize: 11, color: C.textDim, marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: k.color || C.text, letterSpacing: "-0.02em" }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* File freshness — sourced from UPLOADED_FILES */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>数据源新鲜度</div>
          {UPLOADED_FILES.map((f, i) => {
            const sm = statusMeta[f.status];
            return (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 13, color: C.text }}>{f.name}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, color: C.textDim }}>{f.date}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: sm.c, background: f.status === "stale" ? C.redBg : "transparent", padding: "1px 6px", borderRadius: 4 }}>{sm.l}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Category health */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>品类健康状态</div>
          {OVERVIEW_DATA.categories.map((cat, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: `1px solid ${C.border}` }}>
              <div>
                <span style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{cat.name}</span>
                <span style={{ fontSize: 11, color: C.textDim, marginLeft: 6 }}>{cat.asins} ASINs</span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {cat.red > 0    && <span style={{ fontSize: 10, fontWeight: 600, color: C.red,    background: C.redBg,    padding: "1px 7px", borderRadius: 8 }}>{cat.red}红</span>}
                {cat.yellow > 0 && <span style={{ fontSize: 10, fontWeight: 600, color: C.yellow, background: C.yellowBg, padding: "1px 7px", borderRadius: 8 }}>{cat.yellow}黄</span>}
                {cat.red === 0 && cat.yellow === 0 && <span style={{ fontSize: 10, color: C.green }}>✓ 正常</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function KPIPanel({ catId }) {
  const d = CAT_KPI[catId] || { gmv7d: 0, adSpend7d: 0, tacos: 0, acos: 0, orders7d: 0, asins: [] };
  return (
    <div style={{ padding: 28 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 18px", color: C.text }}>KPI 汇总 · 7天</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 24 }}>
        {[
          { l: "GMV",     v: `$${d.gmv7d.toLocaleString()}` },
          { l: "广告花费", v: `$${d.adSpend7d}` },
          { l: "TACoS",   v: `${d.tacos}%`, c: d.tacos > 20 ? C.red : C.green },
          { l: "ACOS",    v: `${d.acos}%`,  c: d.acos > 55 ? C.red : d.acos > 45 ? C.yellow : C.green },
          { l: "订单量",  v: d.orders7d },
        ].map((k, i) => (
          <div key={i} style={{ background: C.bg, borderRadius: 8, padding: "12px 14px" }}>
            <div style={{ fontSize: 10, color: C.textDim }}>{k.l}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: k.c || C.text, marginTop: 2 }}>{k.v}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>ASIN 明细</div>
      <div style={{ borderRadius: 8, border: `1px solid ${C.border}`, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 56px 56px 70px 80px 80px 70px", padding: "8px 12px", background: C.bg, fontSize: 10, color: C.textDim, fontWeight: 600 }}>
          <div>ASIN</div><div>标题</div><div style={{textAlign:"right"}}>价格</div><div style={{textAlign:"right"}}>评分</div><div style={{textAlign:"right"}}>昨日GMV</div><div style={{textAlign:"right"}}>30d ACOS</div><div style={{textAlign:"right"}}>30d花费</div><div style={{textAlign:"right"}}>库存</div>
        </div>
        {d.asins.map((a, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "120px 1fr 56px 56px 70px 80px 80px 70px", padding: "10px 12px", borderTop: `1px solid ${C.border}`, fontSize: 12, alignItems: "center" }}>
            <div style={{ fontFamily: "monospace", fontSize: 11, color: C.accent, fontWeight: 600 }}>{a.asin}</div>
            <div style={{ color: C.text, fontWeight: 500 }}>{a.title}</div>
            <div style={{ textAlign: "right" }}>${a.price}</div>
            <div style={{ textAlign: "right" }}>★{a.rating}</div>
            <div style={{ textAlign: "right" }}>${a.gmvYesterday}</div>
            <div style={{ textAlign: "right", fontWeight: 600, color: a.acos > 55 ? C.red : a.acos > 45 ? C.yellow : C.green }}>{a.acos}%</div>
            <div style={{ textAlign: "right" }}>${a.adSpend30d.toLocaleString()}</div>
            <div style={{ textAlign: "right" }}>{a.sellable}件</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AlertsPanel({ catId }) {
  const alerts  = CAT_ALERTS[catId] || [];
  const reds    = alerts.filter(a => a.level === "red");
  const yellows = alerts.filter(a => a.level === "yellow");
  const Section = ({ title, items, color, bg, icon }) => (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color, marginBottom: 8 }}>{icon} {title}（{items.length}）</div>
      {items.map((a, i) => (
        <div key={i} style={{ background: bg, borderRadius: 8, padding: "12px 14px", marginBottom: 6, borderLeft: `3px solid ${color}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{a.metric} <span style={{ fontWeight: 400, color: C.textSec }}>{a.value}</span></span>
            <span style={{ fontSize: 10, fontFamily: "monospace", color: C.textDim }}>{a.asin}</span>
          </div>
          <div style={{ fontSize: 11, color: C.textSec }}>💡 {a.tip}</div>
        </div>
      ))}
    </div>
  );
  return (
    <div style={{ padding: 28 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 18px", color: C.text }}>每日告警看板</h2>
      <Section title="需立即处理" items={reds}    color={C.red}    bg={C.redBg}    icon="🔴" />
      <Section title="需关注"     items={yellows} color={C.yellow} bg={C.yellowBg} icon="🟡" />
    </div>
  );
}

function AdsPanel({ catId }) {
  const ads    = CAT_ADS[catId] || [];
  const pColor = { P0: C.red, P1: C.yellow, P2: C.green, overlap: "#7c3aed" };
  const pLabel = { P0: "止血", P1: "优化", P2: "扩量", overlap: "内部竞争" };
  // show last 5 chars of ASIN for brevity; overlap rows show both
  const asinShort = (asin) => asin ? (asin.length > 6 ? asin.slice(-5) : asin) : "—";

  return (
    <div style={{ padding: 28 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 18px", color: C.text }}>广告优化行动清单</h2>
      <div style={{ borderRadius: 8, border: `1px solid ${C.border}`, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "64px 56px 1fr 52px 44px 44px 60px 1fr", padding: "8px 12px", background: C.bg, fontSize: 10, color: C.textDim, fontWeight: 600 }}>
          <div>优先级</div>
          <div>ASIN</div>
          <div>搜索词</div>
          <div>匹配</div>
          <div style={{textAlign:"right"}}>点击</div>
          <div style={{textAlign:"right"}}>成交</div>
          <div style={{textAlign:"right"}}>花费</div>
          <div>建议操作</div>
        </div>
        {ads.map((a, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "64px 56px 1fr 52px 44px 44px 60px 1fr", padding: "10px 12px", borderTop: `1px solid ${C.border}`, fontSize: 12, alignItems: "center" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: pColor[a.priority], background: `${pColor[a.priority]}18`, padding: "2px 6px", borderRadius: 4, textAlign: "center" }}>
              {a.priority === "overlap" ? "内竞" : a.priority} {a.priority !== "overlap" && pLabel[a.priority]}
            </span>
            <div style={{ fontFamily: "monospace", fontSize: 10, color: a.priority === "overlap" ? "#7c3aed" : C.textDim, fontWeight: 500 }}>
              {asinShort(a.asin)}
            </div>
            <div style={{ color: C.text, fontWeight: 500, paddingRight: 8 }}>{a.term}</div>
            <div style={{ fontSize: 10, color: C.textDim }}>{a.match}</div>
            <div style={{ textAlign: "right" }}>{a.clicks ?? "—"}</div>
            <div style={{ textAlign: "right", color: a.orders === 0 ? C.red : C.text, fontWeight: a.orders === 0 ? 600 : 400 }}>{a.orders ?? "—"}</div>
            <div style={{ textAlign: "right" }}>{a.spend ? `$${a.spend}` : "—"}</div>
            <div style={{ fontSize: 11, color: C.accent, fontWeight: 500 }}>{a.action}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InventoryPanel({ catId }) {
  const rows = CAT_INV[catId] || [];
  return (
    <div style={{ padding: 28 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 18px", color: C.text }}>库存健康看板</h2>
      <div style={{ borderRadius: 8, border: `1px solid ${C.border}`, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 72px 72px 80px 72px", padding: "8px 12px", background: C.bg, fontSize: 10, color: C.textDim, fontWeight: 600 }}>
          <div>ASIN</div><div>SKU / 标题</div><div style={{textAlign:"right"}}>可售</div><div style={{textAlign:"right"}}>在途</div><div style={{textAlign:"right"}}>可售天数</div><div>配送</div>
        </div>
        {rows.map((r, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "120px 1fr 72px 72px 80px 72px", padding: "10px 12px", borderTop: `1px solid ${C.border}`, fontSize: 12, alignItems: "center" }}>
            <div style={{ fontFamily: "monospace", fontSize: 11, color: C.accent, fontWeight: 600 }}>{r.asin}</div>
            <div><span style={{ fontWeight: 500 }}>{r.title}</span> <span style={{ fontSize: 10, color: C.textDim }}>{r.sku}</span></div>
            <div style={{ textAlign: "right", fontWeight: 600 }}>{r.sellable}件</div>
            <div style={{ textAlign: "right", color: r.inbound === 0 ? C.textDim : C.text }}>{r.inbound}</div>
            <div style={{ textAlign: "right", color: C.textDim }}>{r.daysOfSupply}</div>
            <div style={{ fontSize: 10, color: C.textDim }}>{r.fulfillment}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: C.textDim, marginTop: 10 }}>
        注：当前两个ASIN均为FBM配送，可售天数需基于FBA库存计算。
      </div>
    </div>
  );
}

function ChatPanel() {
  const [messages, setMessages] = useState([]);
  const [input,    setInput]    = useState("");

  const sendMessage = (text) => {
    const msg = text || input;
    if (!msg.trim()) return;
    setMessages(prev => [
      ...prev,
      { role: "user",      text: msg },
      { role: "assistant", text: generateResponse(msg) },
    ]);
    setInput("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "16px 24px 0" }}>
        <div style={{ fontSize: 11, color: C.textDim, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ background: C.accentSoft, color: C.accent, padding: "2px 8px", borderRadius: 4, fontWeight: 600 }}>账号级</span>
          运营手册 SOP · 全部已上传报表
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "16px 24px" }}>
        {messages.length === 0 ? (
          <div style={{ paddingTop: 40, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>💬</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 4 }}>Chat</div>
            <div style={{ fontSize: 12, color: C.textSec, maxWidth: 360, margin: "0 auto 24px" }}>
              基于已上传的全部报表和运营手册规则，分析任意品类或 ASIN
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
              {CHAT_SUGGESTIONS.map((s, i) => (
                <button key={i} onClick={() => sendMessage(s)} style={{
                  background: C.bg, border: `1px solid ${C.border}`, borderRadius: 20,
                  padding: "7px 14px", fontSize: 12, color: C.textSec, cursor: "pointer",
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.border;  e.currentTarget.style.color = C.textSec; }}
                >{s}</button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} style={{ marginBottom: 16, display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
              <div style={{
                maxWidth: "80%", background: m.role === "user" ? C.accent : C.bg,
                color: m.role === "user" ? "#fff" : C.text,
                borderRadius: 12, padding: "10px 14px", fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap",
              }}>{m.text}</div>
            </div>
          ))
        )}
      </div>

      <div style={{ padding: "12px 24px 16px", borderTop: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendMessage()}
            placeholder="输入问题，可涉及任何品类或 ASIN..."
            style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, outline: "none", color: C.text, background: C.bg }}
          />
          <button onClick={() => sendMessage()} style={{
            background: C.accent, color: "#fff", border: "none",
            borderRadius: 8, padding: "0 18px", fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>发送</button>
        </div>
      </div>
    </div>
  );
}

function generateResponse(question) {
  if (question.includes("ACOS") || question.includes("为什么")) {
    return `基于搜索词重构报表（30天数据），Queen款ACOS为82.4%，主要原因：

1. 广泛匹配「sofa mattress」活动花费$889，ACOS 228%，是最大花费黑洞
2. 30天内22个搜索词累计点击≥15次但0成交（触发P0规则）
3. SD竞品详情页拦截活动ACOS 106%，转化效率低

建议按P0优先级立即执行：
• 暂停零成交高点击词（预计每周节省$30-90/词）
• 降低「sofa mattress」广泛组出价10-15%
• 考虑暂停SD竞品拦截活动，预算转移到精确词组`;
  }
  if (question.includes("Queen") && question.includes("Full")) {
    return `对比两款（30天数据）：

           Queen (B0GD7BF2TZ)   Full (B0GD7K1TC9)
广告花费    $1,697               $1,275
广告销售额  $2,061               $2,119
ACOS        82.4%                60.2%
广告订单    19单                 21单

Full款效率明显优于Queen款：ACOS低22个百分点，广告订单更多。
建议将部分预算从Queen广泛词转移到Full精确词。`;
  }
  if (question.includes("广告") && question.includes("先做")) {
    return `按优先级排序的本周广告优化清单：

P0 止血（立即）：
• 否定22个零成交高点击词 → 预计止血$200+/月
• 精确否定无效搜索词（花费>$20且0成交）

P1 当日优化：
• 「sofa mattress replacement」精确词ACOS 92% → 出价从$1.80降至$1.08-1.26
• 排查CTR<0.2%的高曝光词 → 检查主图和定价竞争力

P2 本周内：
• 「mattress for sleeper sofa」ACOS 28%、CVR高 → 出价提15-20%扩量
• 处理65组品类内部竞争词 → 在低效ASIN否定`;
  }
  if (question.includes("库存") || question.includes("断货")) {
    return `当前库存状态：
• Queen (U5A4Q01)：可售123件，在途0件，FBM配送
• Full (U5A4F01)：可售153件，在途0件，FBM配送

两款均为FBM配送，库存由卖家自行管理。
日均约0.5单/天，当前库存充足，暂无断货风险。`;
  }
  if (question.includes("品类") && question.includes("关注")) {
    return `按告警优先级排序：

1. 沙发床垫 — 3红3黄，ACOS超标 + 广告超预算，需立即处理
2. 充气泵 — 1黄，需关注但不紧急
3. 电动滑板车 — 无告警，正常

建议优先处理沙发床垫的P0广告优化，预计可止血$200+/月。`;
  }
  return `已收到您的问题。基于已上传的全部报表（产品报表、搜索词重构、广告活动报表、库存报表等）和运营手册SOP规则，正在分析中...`;
}

/* ═══════════════════════════════════════════
   CONTEXT PANEL  —  right sidebar, collapsible
   Mirrors the context/ folder contents.
   Users can add / delete files from here.
   ═══════════════════════════════════════════ */

function ContextPanel({ isOpen, onToggle }) {
  const [files, setFiles] = useState(UPLOADED_FILES);
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const removeFile = (i) => setFiles(prev => prev.filter((_, idx) => idx !== i));

  const statusColor = { fresh: C.green, ok: C.textDim, stale: C.red };
  const statusLabel = { fresh: "新鲜", ok: "正常", stale: "过期" };
  const getExt = (filename) => filename.split(".").pop().toUpperCase();

  /* ── Collapsed strip ── */
  if (!isOpen) {
    return (
      <div style={{
        width: 28, background: C.sidebar, borderLeft: `1px solid ${C.funcBorder}`,
        display: "flex", flexDirection: "column", alignItems: "center",
        flexShrink: 0, cursor: "pointer",
      }} onClick={onToggle}>
        <div style={{ padding: "14px 0 8px", color: C.textDim, fontSize: 12 }}>‹</div>
        <div style={{
          writingMode: "vertical-rl", transform: "rotate(180deg)",
          fontSize: 9, fontWeight: 600, color: C.textDim,
          letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 4,
        }}>Context</div>
      </div>
    );
  }

  /* ── Expanded panel ── */
  return (
    <div style={{
      width: 256, background: "#f9f9fb", borderLeft: `1px solid ${C.funcBorder}`,
      display: "flex", flexDirection: "column", flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{
        padding: "14px 14px 10px", borderBottom: `1px solid ${C.funcBorder}`,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Context</div>
          <div style={{ fontSize: 10, color: C.textDim, fontFamily: "monospace", marginTop: 1 }}>
            ./context/ · {files.length} 个文件
          </div>
        </div>
        <div onClick={onToggle} style={{ cursor: "pointer", color: C.textDim, fontSize: 13, padding: "4px 6px" }}>›</div>
      </div>

      {/* File cards grid */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 10px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, alignContent: "start" }}>
        {files.map((f, i) => (
          <div
            key={i}
            style={{
              background: "#fff",
              border: `1px solid ${hoveredIdx === i ? C.border : "#e4e5ea"}`,
              borderRadius: 10,
              padding: "10px 10px 8px",
              position: "relative",
              cursor: "default",
              boxShadow: hoveredIdx === i ? "0 1px 6px rgba(0,0,0,0.06)" : "none",
              transition: "box-shadow 0.12s",
            }}
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            {/* × delete button */}
            {hoveredIdx === i && (
              <span
                onClick={() => removeFile(i)}
                style={{
                  position: "absolute", top: 5, right: 7,
                  fontSize: 13, color: C.textDim, cursor: "pointer", lineHeight: 1,
                }}
                onMouseEnter={e => e.currentTarget.style.color = C.red}
                onMouseLeave={e => e.currentTarget.style.color = C.textDim}
              >×</span>
            )}

            {/* File name */}
            <div style={{
              fontSize: 11, fontWeight: 600, color: C.text,
              lineHeight: 1.35, marginBottom: 4, paddingRight: 10,
              wordBreak: "break-all",
            }}>{f.name}</div>

            {/* Date + status */}
            <div style={{ fontSize: 9, color: statusColor[f.status], marginBottom: 7 }}>
              {f.date} · {statusLabel[f.status]}
            </div>

            {/* Type badge */}
            <div style={{
              display: "inline-flex", alignItems: "center",
              fontSize: 9, fontWeight: 600,
              background: "#f0f1f5", color: C.textSec,
              borderRadius: 4, padding: "2px 6px",
              border: `1px solid ${C.border}`,
            }}>{getExt(f.file)}</div>
          </div>
        ))}
      </div>

      {/* Add file button */}
      <div style={{ padding: "10px 10px 12px", borderTop: `1px solid ${C.funcBorder}` }}>
        <button
          onClick={() => alert("上传文件到 context/ 文件夹")}
          style={{
            width: "100%", padding: "8px 0", borderRadius: 8,
            border: `1.5px dashed ${C.border}`, background: "transparent",
            fontSize: 11, color: C.textDim, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
            transition: "all 0.12s",
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = C.border;  e.currentTarget.style.color = C.textDim; }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> 添加文件
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════
   MAIN APP
   ═══════════════════════════ */

export default function App() {
  const [activeNav,    setActiveNav]    = useState("mattress");
  const [activeFunc,   setActiveFunc]   = useState("kpi");
  const [model,        setModel]        = useState(MODELS[0]);
  const [modelOpen,    setModelOpen]    = useState(false);
  const [contextOpen,  setContextOpen]  = useState(true);

  const activeItem = NAV_ITEMS.find(n => n.id === activeNav);
  const isCategory = activeItem?.type === "category";

  const handleNavClick = (item) => {
    setActiveNav(item.id);
    if (item.type === "category") setActiveFunc("kpi");
  };

  const renderContent = () => {
    if (activeNav === "overview") return <OverviewPanel />;
    if (activeNav === "chat")     return <ChatPanel />;
    switch (activeFunc) {
      case "kpi":       return <KPIPanel       catId={activeNav} />;
      case "alerts":    return <AlertsPanel    catId={activeNav} />;
      case "ads":       return <AdsPanel       catId={activeNav} />;
      case "inventory": return <InventoryPanel catId={activeNav} />;
      default:          return <KPIPanel       catId={activeNav} />;
    }
  };

  const breadcrumb = () => {
    if (activeNav === "overview") return "账号总览";
    if (activeNav === "chat")     return "Chat";
    const cat  = NAV_ITEMS.find(n => n.id === activeNav);
    const func = FUNC_TABS.find(t => t.id === activeFunc);
    return `${cat?.label} › ${func?.label}`;
  };

  return (
    <div style={{
      fontFamily: "'Geist', 'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif",
      display: "flex", height: "100vh", width: "100vw", overflow: "hidden", background: C.bg,
      position: "fixed", inset: 0,
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* ── Left sidebar ── */}
      <div style={{
        width: 180, background: C.sidebar, display: "flex", flexDirection: "column",
        flexShrink: 0, borderRight: `1px solid ${C.funcBorder}`,
      }}>
        <div style={{ padding: "20px 16px 16px", borderBottom: `1px solid ${C.funcBorder}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 7,
              background: "linear-gradient(135deg, #3b5bdb, #7c3aed)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 700, color: "#fff",
            }}>N</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, lineHeight: 1.1 }}>YZ-Ops</div>
              <div style={{ fontSize: 9, color: C.textDim, letterSpacing: "0.08em" }}>AI · Nordhive</div>
            </div>
          </div>
        </div>

        {/* Pages */}
        <div style={{ padding: "10px 8px 0" }}>
          {NAV_ITEMS.filter(n => n.type === "page").map(item => {
            const active = activeNav === item.id;
            return (
              <div key={item.id} onClick={() => handleNavClick(item)} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 12px", borderRadius: 8, marginBottom: 2, cursor: "pointer",
                background: active ? C.sidebarActive : "transparent",
                color: active ? C.sidebarTextActive : C.sidebarText,
                fontSize: 13, fontWeight: active ? 600 : 400, transition: "all 0.12s",
              }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = C.sidebarHover; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ fontSize: 16, width: 20, textAlign: "center" }}>{item.icon}</span>
                <span>{item.label}</span>
              </div>
            );
          })}
        </div>

        {/* Categories */}
        <div style={{ padding: "8px 8px" }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: C.textDim, letterSpacing: "0.08em", padding: "4px 12px", textTransform: "uppercase" }}>品类</div>
          {NAV_ITEMS.filter(n => n.type === "category").map(item => {
            const active = activeNav === item.id;
            return (
              <div key={item.id} onClick={() => handleNavClick(item)} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 12px", borderRadius: 8, marginBottom: 2, cursor: "pointer",
                background: active ? C.sidebarActive : "transparent",
                color: active ? C.sidebarTextActive : C.sidebarText,
                fontSize: 13, fontWeight: active ? 600 : 400, transition: "all 0.12s",
              }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = C.sidebarHover; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ fontSize: 16, width: 20, textAlign: "center" }}>{item.icon}</span>
                <span>{item.label}</span>
              </div>
            );
          })}
        </div>

        <div style={{ flex: 1 }} />
        <div style={{ padding: "12px 16px", borderTop: `1px solid ${C.funcBorder}`, fontSize: 10, color: C.textDim }}>
          数据截至 2026-04-09
        </div>
      </div>

      {/* ── Function tabs (category only) ── */}
      {isCategory && (
        <div style={{
          width: 150, background: C.funcBar, borderRight: `1px solid ${C.funcBorder}`,
          display: "flex", flexDirection: "column", flexShrink: 0,
        }}>
          <div style={{ padding: "16px 12px 8px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.textDim, letterSpacing: "0.03em", padding: "0 8px" }}>功能模块</div>
          </div>
          <div style={{ padding: "0 8px", flex: 1 }}>
            {FUNC_TABS.map(tab => {
              const active = activeFunc === tab.id;
              return (
                <div key={tab.id} onClick={() => setActiveFunc(tab.id)} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "9px 10px", borderRadius: 7, marginBottom: 1, cursor: "pointer",
                  background: active ? C.accentSoft : "transparent",
                  color: active ? C.accent : C.textSec,
                  fontSize: 12, fontWeight: active ? 600 : 400, transition: "all 0.12s",
                }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = C.bg; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
                >
                  <span style={{ fontSize: 14 }}>{tab.icon}</span>
                  <span>{tab.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Top bar */}
        <div style={{
          height: 48, background: C.funcBar, borderBottom: `1px solid ${C.funcBorder}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 20px", flexShrink: 0,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{breadcrumb()}</div>
          <div style={{ position: "relative" }}>
            <div onClick={() => setModelOpen(!modelOpen)} style={{
              display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 6,
              border: `1px solid ${C.border}`, cursor: "pointer", fontSize: 11, color: C.textSec, background: C.bg,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.green }} />
              {model}
              <span style={{ fontSize: 9, opacity: 0.5 }}>▼</span>
            </div>
            {modelOpen && (
              <div style={{
                position: "absolute", top: "100%", right: 0, marginTop: 4,
                background: "#fff", border: `1px solid ${C.border}`, borderRadius: 8,
                boxShadow: "0 4px 16px rgba(0,0,0,0.08)", overflow: "hidden", zIndex: 100, minWidth: 200,
              }}>
                {MODELS.map(m => (
                  <div key={m} onClick={() => { setModel(m); setModelOpen(false); }} style={{
                    padding: "8px 14px", fontSize: 12, cursor: "pointer",
                    color: m === model ? C.accent : C.text,
                    background: m === model ? C.accentSoft : "transparent",
                    fontWeight: m === model ? 600 : 400,
                  }}
                    onMouseEnter={e => { if (m !== model) e.currentTarget.style.background = C.bg; }}
                    onMouseLeave={e => { if (m !== model) e.currentTarget.style.background = "transparent"; }}
                  >{m}</div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ flex: 1, overflow: "auto", background: "#fff" }}>
          {renderContent()}
        </div>
      </div>

      {/* ── Context panel (right, collapsible, persistent) ── */}
      <ContextPanel isOpen={contextOpen} onToggle={() => setContextOpen(o => !o)} />
    </div>
  );
}
