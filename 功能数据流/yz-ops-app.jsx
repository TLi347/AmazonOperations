import { useState } from "react";

/* ═══════════════════════════════════════════
   DATA — extracted from real Nordhive reports
   ═══════════════════════════════════════════ */

const CATEGORIES = [
  { id: "overview", label: "账号总览", icon: "📊", en: "Overview" },
  { id: "mattress", label: "沙发床垫", icon: "🛏", en: "Sofa Mattress" },
  { id: "pump", label: "充气泵", icon: "🔧", en: "Air Pump" },
  { id: "scooter", label: "电动滑板车", icon: "🛴", en: "E-Scooter" },
];

const FUNC_TABS = [
  { id: "chat", label: "Chat", icon: "💬" },
  { id: "kpi", label: "KPI 汇总", icon: "📈" },
  { id: "alerts", label: "每日告警", icon: "🚨" },
  { id: "ads", label: "广告优化", icon: "🎯" },
  { id: "inventory", label: "库存看板", icon: "📦" },
];

const MODELS = ["claude-sonnet-4-6", "claude-opus-4-6"];

const OVERVIEW_DATA = {
  gmv30d: 8426, adSpend30d: 2974, tacos: 35.3, sellable: 1769, orders30d: 86,
  sources: [
    { name: "产品报表", date: "04-09", status: "fresh" },
    { name: "关键词监控", date: "04-10", status: "fresh" },
    { name: "库存报表", date: "04-08", status: "ok" },
    { name: "搜索词重构", date: "04-06", status: "ok" },
    { name: "广告活动重构", date: "04-08", status: "ok" },
    { name: "US广告活动", date: "04-06", status: "ok" },
    { name: "广告位报表", date: "04-06", status: "ok" },
    { name: "成本管理", date: "04-06", status: "ok" },
    { name: "ABA搜索词", date: "01-19", status: "stale" },
  ],
  categories: [
    { name: "沙发床垫", red: 3, yellow: 3, gmv: 2184, asins: 2 },
    { name: "充气泵", red: 0, yellow: 1, gmv: 0, asins: 1 },
    { name: "电动滑板车", red: 0, yellow: 0, gmv: 0, asins: 1 },
    { name: "未分类", red: 0, yellow: 3, gmv: 0, asins: 30 },
  ],
};

const MATTRESS_KPI = {
  gmv7d: 2184, adSpend7d: 694, tacos: 31.8, acos: 46.9, orders7d: 16,
  asins: [
    { asin: "B0GD7BF2TZ", title: "Queen 4\" 沙发床垫", price: 129, rating: 5.0, reviews: 11, gmvYesterday: 218, acos: 82.4, sellable: 123, adSpend30d: 1697 },
    { asin: "B0GD7K1TC9", title: "Full 4\" 沙发床垫", price: 119, rating: 5.0, reviews: 11, gmvYesterday: 99, acos: 60.2, sellable: 153, adSpend30d: 1275 },
  ],
};

const MATTRESS_ALERTS = [
  { level: "red", asin: "B0GD7BF2TZ", metric: "ACOS", value: "82.4%", threshold: ">55%", tip: "否定无效词；零成交词(>15次点击)暂停" },
  { level: "red", asin: "B0GD7BF2TZ", metric: "广告超预算", value: "超42%", threshold: "不超日预算", tip: "暂停最高花费广泛组，降出价10-15%" },
  { level: "red", asin: "B0GD7K1TC9", metric: "ACOS", value: "60.2%", threshold: ">55%", tip: "高ACOS词出价降30-40%" },
  { level: "yellow", asin: "B0GD7BF2TZ", metric: "BSR小类", value: "#516", threshold: "偏低", tip: "提高核心词出价争取曝光" },
  { level: "yellow", asin: "B0GD7K1TC9", metric: "广告花费利用率", value: "超18%", threshold: "接近上限", tip: "优化出价结构" },
  { level: "yellow", asin: "B0GD7K1TC9", metric: "BSR小类", value: "#516", threshold: "偏低", tip: "提高出价争取曝光" },
];

const MATTRESS_ADS = [
  { priority: "P0", term: "foam mattress thick", match: "广泛", clicks: 22, orders: 0, spend: 31.4, action: "暂停 + 否定" },
  { priority: "P0", term: "sofa replacement cushion", match: "广泛", clicks: 18, orders: 0, spend: 24.8, action: "精确否定" },
  { priority: "P1", term: "sofa mattress replacement", match: "精确", clicks: 38, orders: 3, spend: 68.2, acos: "92%", action: "出价降30-40%" },
  { priority: "P1", term: "pull out couch mattress", match: "广泛", clicks: 42, orders: 4, spend: 55.1, acos: "87%", action: "出价降30%" },
  { priority: "P2", term: "mattress for sleeper sofa", match: "精确", clicks: 44, orders: 5, spend: 52.3, acos: "28%", action: "出价提15-20%" },
  { priority: "overlap", term: "sofa mattress（广泛）", match: "内部竞争", clicks: null, orders: null, spend: null, action: "在Full款否定该词" },
];

const MATTRESS_INV = [
  { asin: "B0GD7BF2TZ", sku: "U5A4Q01", title: "Queen 4\"", sellable: 123, inbound: 0, daysOfSupply: "—", fulfillment: "FBM" },
  { asin: "B0GD7K1TC9", sku: "U5A4F01", title: "Full 4\"", sellable: 153, inbound: 0, daysOfSupply: "—", fulfillment: "FBM" },
];

const CHAT_SUGGESTIONS = {
  overview: ["账号整体表现如何？", "哪个品类最需要关注？", "本月TACoS趋势"],
  mattress: ["ACOS为什么这么高？", "Queen和Full哪个表现更好？", "广告优化该先做什么？", "库存够撑多久？"],
  pump: ["充气泵广告表现如何？", "当前库存状态"],
  scooter: ["滑板车CTR偏低的原因？", "新品期广告策略建议"],
};

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
  main: "#ffffff",
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
  greenBg: "rgba(12,166,120,0.06)",
  border: "#e8e9ee",
  radius: 10,
};

/* ═══════════════════════════
   CONTENT PANELS
   ═══════════════════════════ */

function OverviewPanel() {
  return (
    <div style={{ padding: 28 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 20px", color: C.text }}>
        账号总览
        <span style={{ fontSize: 12, fontWeight: 400, color: C.textDim, marginLeft: 8 }}>Nordhive · US · 2026-04-09</span>
      </h2>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "总 GMV (30d)", value: `$${(OVERVIEW_DATA.gmv30d).toLocaleString()}`, color: C.accent },
          { label: "广告花费 (30d)", value: `$${OVERVIEW_DATA.adSpend30d.toLocaleString()}` },
          { label: "TACoS (30d)", value: `${OVERVIEW_DATA.tacos}%`, color: OVERVIEW_DATA.tacos > 20 ? C.red : C.green },
          { label: "FBA可售库存", value: `${OVERVIEW_DATA.sellable.toLocaleString()} 件` },
        ].map((k, i) => (
          <div key={i} style={{
            background: C.bg, borderRadius: C.radius, padding: "14px 16px",
            borderLeft: `3px solid ${k.color || C.border}`,
          }}>
            <div style={{ fontSize: 11, color: C.textDim, marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: k.color || C.text, letterSpacing: "-0.02em" }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Two columns */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Data sources */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>数据源新鲜度</div>
          {OVERVIEW_DATA.sources.map((s, i) => {
            const sc = { fresh: { l: "新鲜", c: C.green }, ok: { l: "正常", c: C.textDim }, stale: { l: "过期", c: C.red } }[s.status];
            return (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 13, color: C.text }}>{s.name}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, color: C.textDim }}>{s.date}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: sc.c, background: s.status === "stale" ? C.redBg : "transparent", padding: "1px 6px", borderRadius: 4 }}>{sc.l}</span>
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
                {cat.red > 0 && <span style={{ fontSize: 10, fontWeight: 600, color: C.red, background: C.redBg, padding: "1px 7px", borderRadius: 8 }}>{cat.red}红</span>}
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

const CAT_KPI = { mattress: MATTRESS_KPI };
const CAT_ALERTS = { mattress: MATTRESS_ALERTS };
const CAT_ADS = { mattress: MATTRESS_ADS };
const CAT_INV = { mattress: MATTRESS_INV };

function KPIPanel({ catId }) {
  const d = CAT_KPI[catId] || { gmv7d: 0, adSpend7d: 0, tacos: 0, acos: 0, orders7d: 0, asins: [] };
  return (
    <div style={{ padding: 28 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 18px", color: C.text }}>KPI 汇总 · 7天</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 24 }}>
        {[
          { l: "GMV", v: `$${d.gmv7d.toLocaleString()}` },
          { l: "广告花费", v: `$${d.adSpend7d}` },
          { l: "TACoS", v: `${d.tacos}%`, c: d.tacos > 20 ? C.red : C.green },
          { l: "ACOS", v: `${d.acos}%`, c: d.acos > 55 ? C.red : d.acos > 45 ? C.yellow : C.green },
          { l: "订单量", v: d.orders7d },
        ].map((k, i) => (
          <div key={i} style={{ background: C.bg, borderRadius: 8, padding: "12px 14px" }}>
            <div style={{ fontSize: 10, color: C.textDim }}>{k.l}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: k.c || C.text, marginTop: 2 }}>{k.v}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>ASIN 明细</div>
      <div style={{ borderRadius: 8, border: `1px solid ${C.border}`, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 60px 60px 56px 80px 80px 70px", padding: "8px 12px", background: C.bg, fontSize: 10, color: C.textDim, fontWeight: 600 }}>
          <div>ASIN</div><div>标题</div><div style={{textAlign:"right"}}>价格</div><div style={{textAlign:"right"}}>评分</div><div style={{textAlign:"right"}}>昨日GMV</div><div style={{textAlign:"right"}}>30d ACOS</div><div style={{textAlign:"right"}}>30d花费</div><div style={{textAlign:"right"}}>库存</div>
        </div>
        {d.asins.map((a, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "120px 1fr 60px 60px 56px 80px 80px 70px", padding: "10px 12px", borderTop: `1px solid ${C.border}`, fontSize: 12, alignItems: "center" }}>
            <div style={{ fontFamily: "monospace", fontSize: 11, color: C.accent, fontWeight: 600 }}>{a.asin}</div>
            <div style={{ color: C.text, fontWeight: 500 }}>{a.title}</div>
            <div style={{ textAlign: "right", color: C.text }}>${a.price}</div>
            <div style={{ textAlign: "right", color: C.text }}>★{a.rating}</div>
            <div style={{ textAlign: "right", color: C.text }}>${a.gmvYesterday}</div>
            <div style={{ textAlign: "right", fontWeight: 600, color: a.acos > 55 ? C.red : a.acos > 45 ? C.yellow : C.green }}>{a.acos}%</div>
            <div style={{ textAlign: "right", color: C.text }}>${a.adSpend30d.toLocaleString()}</div>
            <div style={{ textAlign: "right", color: C.text }}>{a.sellable}件</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AlertsPanel({ catId }) {
  const alerts = CAT_ALERTS[catId] || [];
  const reds = alerts.filter(a => a.level === "red");
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
      <Section title="需立即处理" items={reds} color={C.red} bg={C.redBg} icon="🔴" />
      <Section title="需关注" items={yellows} color={C.yellow} bg={C.yellowBg} icon="🟡" />
    </div>
  );
}

function AdsPanel({ catId }) {
  const ads = CAT_ADS[catId] || [];
  const pColor = { P0: C.red, P1: C.yellow, P2: C.green, overlap: "#7c3aed" };
  const pLabel = { P0: "止血", P1: "优化", P2: "扩量", overlap: "内部竞争" };
  return (
    <div style={{ padding: 28 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 18px", color: C.text }}>广告优化行动清单</h2>
      <div style={{ borderRadius: 8, border: `1px solid ${C.border}`, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "56px 1fr 60px 56px 50px 65px 120px", padding: "8px 12px", background: C.bg, fontSize: 10, color: C.textDim, fontWeight: 600 }}>
          <div>优先级</div><div>搜索词</div><div>匹配</div><div style={{textAlign:"right"}}>点击</div><div style={{textAlign:"right"}}>成交</div><div style={{textAlign:"right"}}>花费</div><div>建议操作</div>
        </div>
        {ads.map((a, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "56px 1fr 60px 56px 50px 65px 120px", padding: "10px 12px", borderTop: `1px solid ${C.border}`, fontSize: 12, alignItems: "center" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: pColor[a.priority], background: `${pColor[a.priority]}11`, padding: "2px 6px", borderRadius: 4, textAlign: "center" }}>{a.priority} {pLabel[a.priority]}</span>
            <div style={{ color: C.text, fontWeight: 500 }}>{a.term}</div>
            <div style={{ fontSize: 10, color: C.textDim }}>{a.match}</div>
            <div style={{ textAlign: "right", color: C.text }}>{a.clicks ?? "—"}</div>
            <div style={{ textAlign: "right", color: a.orders === 0 ? C.red : C.text, fontWeight: a.orders === 0 ? 600 : 400 }}>{a.orders ?? "—"}</div>
            <div style={{ textAlign: "right", color: C.text }}>{a.spend ? `$${a.spend}` : "—"}</div>
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
        <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 80px 80px 80px 80px", padding: "8px 12px", background: C.bg, fontSize: 10, color: C.textDim, fontWeight: 600 }}>
          <div>ASIN</div><div>SKU / 标题</div><div style={{textAlign:"right"}}>可售</div><div style={{textAlign:"right"}}>在途</div><div style={{textAlign:"right"}}>可售天数</div><div>配送</div>
        </div>
        {rows.map((r, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "120px 1fr 80px 80px 80px 80px", padding: "10px 12px", borderTop: `1px solid ${C.border}`, fontSize: 12, alignItems: "center" }}>
            <div style={{ fontFamily: "monospace", fontSize: 11, color: C.accent, fontWeight: 600 }}>{r.asin}</div>
            <div><span style={{ color: C.text, fontWeight: 500 }}>{r.title}</span> <span style={{ fontSize: 10, color: C.textDim }}>{r.sku}</span></div>
            <div style={{ textAlign: "right", fontWeight: 600, color: C.text }}>{r.sellable}件</div>
            <div style={{ textAlign: "right", color: r.inbound === 0 ? C.textDim : C.text }}>{r.inbound}</div>
            <div style={{ textAlign: "right", color: C.textDim }}>{r.daysOfSupply}</div>
            <div style={{ fontSize: 10, color: C.textDim }}>{r.fulfillment}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: C.textDim, marginTop: 10, lineHeight: 1.6 }}>
        注：当前两个ASIN均为FBM配送，可售天数需基于FBA库存计算。FBM模式下由卖家自行管理库存和配送。
      </div>
    </div>
  );
}

function ChatPanel({ catId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const suggestions = CHAT_SUGGESTIONS[catId] || CHAT_SUGGESTIONS.overview;
  const contextLabel = catId === "overview" ? "账号级" : CATEGORIES.find(c => c.id === catId)?.label + " 品类级";

  const sendMessage = (text) => {
    const msg = text || input;
    if (!msg.trim()) return;
    setMessages(prev => [
      ...prev,
      { role: "user", text: msg },
      { role: "assistant", text: generateResponse(msg, catId) },
    ]);
    setInput("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Context badge */}
      <div style={{ padding: "16px 24px 0" }}>
        <div style={{ fontSize: 11, color: C.textDim, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ background: C.accentSoft, color: C.accent, padding: "2px 8px", borderRadius: 4, fontWeight: 600 }}>{contextLabel}</span>
          上下文已注入 · 运营手册SOP + 已上传报表数据
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflow: "auto", padding: "16px 24px" }}>
        {messages.length === 0 ? (
          <div style={{ paddingTop: 40, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>💬</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 4 }}>
              {catId === "overview" ? "账号级 Chat" : `${CATEGORIES.find(c=>c.id===catId)?.label} · Chat`}
            </div>
            <div style={{ fontSize: 12, color: C.textSec, marginBottom: 24, maxWidth: 360, margin: "0 auto 24px" }}>
              基于已上传数据和运营手册规则分析，回答"为什么"和"怎么办"
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
              {suggestions.map((s, i) => (
                <button key={i} onClick={() => sendMessage(s)} style={{
                  background: C.bg, border: `1px solid ${C.border}`, borderRadius: 20,
                  padding: "7px 14px", fontSize: 12, color: C.textSec, cursor: "pointer",
                  transition: "all 0.15s",
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textSec; }}
                >{s}</button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} style={{
              marginBottom: 16,
              display: "flex",
              justifyContent: m.role === "user" ? "flex-end" : "flex-start",
            }}>
              <div style={{
                maxWidth: "80%",
                background: m.role === "user" ? C.accent : C.bg,
                color: m.role === "user" ? "#fff" : C.text,
                borderRadius: 12,
                padding: "10px 14px",
                fontSize: 13, lineHeight: 1.6,
                whiteSpace: "pre-wrap",
              }}>
                {m.text}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <div style={{ padding: "12px 24px 16px", borderTop: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendMessage()}
            placeholder="输入问题..."
            style={{
              flex: 1, padding: "10px 14px", borderRadius: 8,
              border: `1px solid ${C.border}`, fontSize: 13,
              outline: "none", color: C.text, background: C.bg,
            }}
          />
          <button onClick={() => sendMessage()} style={{
            background: C.accent, color: "#fff", border: "none",
            borderRadius: 8, padding: "0 18px", fontSize: 13, fontWeight: 600,
            cursor: "pointer",
          }}>发送</button>
        </div>
      </div>
    </div>
  );
}

function generateResponse(question, catId) {
  if (question.includes("ACOS") || question.includes("为什么")) {
    return `基于搜索词重构报表（30天数据），Queen款ACOS为82.4%，主要原因：

1. 广泛匹配「sofa mattress」活动花费$889，ACOS高达228%，是最大的花费黑洞
2. 30天内有22个搜索词累计点击≥15次但0成交（触发P0规则）
3. SD竞品详情页拦截活动ACOS 106%，转化效率低

建议按P0优先级立即执行：
• 暂停零成交高点击词（预计每周节省$30-90/词）
• 降低「sofa mattress」广泛组出价10-15%
• 考虑暂停SD竞品拦截活动，将预算转移到精确词组`;
  }
  if (question.includes("Queen") && question.includes("Full")) {
    return `对比两款（30天数据）：

           Queen(B0GD7BF2TZ)    Full(B0GD7K1TC9)
广告花费    $1,697              $1,275
广告销售额  $2,061              $2,119
ACOS       82.4%               60.2%
广告订单    19单                21单
搜索词数    555个               392个

Full款效率明显优于Queen款：ACOS低22个百分点，且广告订单更多。
建议：将部分预算从Queen广泛词转移到Full精确词，特别是内部竞争词应优先保留在Full款。`;
  }
  if (question.includes("广告") && question.includes("先做")) {
    return `按优先级排序的本周广告优化清单：

P0 止血（立即）:
• 否定22个零成交高点击词 → 预计止血$200+/月
• 精确否定无效搜索词（花费>$20且0成交）

P1 当日优化:
• 「sofa mattress replacement」精确词ACOS 92% → 出价从$1.80降至$1.08-1.26
• 排查CTR<0.2%的高曝光词 → 检查主图和定价竞争力

P2 本周内:
• 「mattress for sleeper sofa」ACOS 28%、CVR高 → 出价提15-20%扩量
• 处理65组品类内部竞争词 → 在低效ASIN否定`;
  }
  if (question.includes("库存")) {
    return `当前库存状态：
• Queen (U5A4Q01): 可售123件，在途0件，FBM配送
• Full (U5A4F01): 可售153件，在途0件，FBM配送

由于两款均为FBM配送模式，库存由卖家自行管理，不涉及FBA仓储费和库龄问题。
补货建议需参考近30天日均销量计算，当前日均约0.5单/天，库存充足。`;
  }
  return `已收到您的问题。基于当前已上传的报表数据和运营手册SOP规则，我会调用相关工具查询数据后给出分析建议。

当前可用数据源：产品报表（04-09）、搜索词重构（30天）、广告活动报表、库存报表、关键词监控。

请稍后，正在分析中...`;
}

/* ═══════════════════════════
   MAIN APP
   ═══════════════════════════ */

export default function App() {
  const [activeCat, setActiveCat] = useState("mattress");
  const [activeFunc, setActiveFunc] = useState("chat");
  const [model, setModel] = useState(MODELS[0]);
  const [modelOpen, setModelOpen] = useState(false);

  const isOverview = activeCat === "overview";

  const renderContent = () => {
    if (isOverview) return <OverviewPanel />;
    switch (activeFunc) {
      case "kpi": return <KPIPanel catId={activeCat} />;
      case "alerts": return <AlertsPanel catId={activeCat} />;
      case "ads": return <AdsPanel catId={activeCat} />;
      case "inventory": return <InventoryPanel catId={activeCat} />;
      case "chat": return <ChatPanel catId={activeCat} />;
      default: return <ChatPanel catId={activeCat} />;
    }
  };

  return (
    <div style={{
      fontFamily: "'Geist', 'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif",
      display: "flex", height: "100vh", overflow: "hidden",
      background: C.bg,
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* ── Left sidebar: Categories ── */}
      <div style={{
        width: 180, background: C.sidebar, display: "flex", flexDirection: "column",
        flexShrink: 0, borderRight: `1px solid ${C.funcBorder}`,
      }}>
        {/* Logo */}
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

        {/* Nav items */}
        <div style={{ padding: "12px 8px", flex: 1 }}>
          {CATEGORIES.map(cat => {
            const active = activeCat === cat.id;
            return (
              <div
                key={cat.id}
                onClick={() => { setActiveCat(cat.id); if (cat.id !== "overview") setActiveFunc("chat"); }}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 12px", borderRadius: 8, marginBottom: 2,
                  cursor: "pointer",
                  background: active ? C.sidebarActive : "transparent",
                  color: active ? C.sidebarTextActive : C.sidebarText,
                  fontSize: 13, fontWeight: active ? 600 : 400,
                  transition: "all 0.12s",
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = C.sidebarHover; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ fontSize: 16, width: 20, textAlign: "center" }}>{cat.icon}</span>
                <span>{cat.label}</span>
              </div>
            );
          })}
        </div>

        {/* Bottom */}
        <div style={{ padding: "12px 16px", borderTop: `1px solid ${C.funcBorder}`, fontSize: 10, color: C.textDim }}>
          数据截至 2026-04-09
        </div>
      </div>

      {/* ── Second column: Function tabs (hidden on overview) ── */}
      {!isOverview && (
        <div style={{
          width: 150, background: C.funcBar, borderRight: `1px solid ${C.funcBorder}`,
          display: "flex", flexDirection: "column", flexShrink: 0,
        }}>
          <div style={{ padding: "16px 12px 8px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.textDim, letterSpacing: "0.03em", padding: "0 8px" }}>
              功能模块
            </div>
          </div>
          <div style={{ padding: "0 8px", flex: 1 }}>
            {FUNC_TABS.map(tab => {
              const active = activeFunc === tab.id;
              return (
                <div
                  key={tab.id}
                  onClick={() => setActiveFunc(tab.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "9px 10px", borderRadius: 7, marginBottom: 1,
                    cursor: "pointer",
                    background: active ? C.accentSoft : "transparent",
                    color: active ? C.accent : C.textSec,
                    fontSize: 12, fontWeight: active ? 600 : 400,
                    transition: "all 0.12s",
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

      {/* ── Main content area ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Top bar */}
        <div style={{
          height: 48, background: C.funcBar, borderBottom: `1px solid ${C.funcBorder}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 20px", flexShrink: 0,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
            {isOverview ? "账号总览" : `${CATEGORIES.find(c => c.id === activeCat)?.label} › ${FUNC_TABS.find(t => t.id === activeFunc)?.label}`}
          </div>

          {/* Model selector */}
          <div style={{ position: "relative" }}>
            <div
              onClick={() => setModelOpen(!modelOpen)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "5px 12px", borderRadius: 6,
                border: `1px solid ${C.border}`, cursor: "pointer",
                fontSize: 11, color: C.textSec, background: C.bg,
              }}
            >
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
                  <div key={m}
                    onClick={() => { setModel(m); setModelOpen(false); }}
                    style={{
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

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", background: isOverview || activeFunc !== "chat" ? "#fff" : "#fff" }}>
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
