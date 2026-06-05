"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

// ─── 颜色常量（深色主题）────────────────────────────────────────────────────
const C = {
  bg:         "#070d1a",
  card:       "#0d1628",
  cardAlt:    "#0a111e",
  border:     "#1e293b",
  borderMid:  "#334155",
  text:       "#e2e8f0",
  textSub:    "#94a3b8",
  textMuted:  "#64748b",
  heading:    "#f1f5f9",
  // 状态色
  green:      "#34d399",
  greenBg:    "#022c22",
  red:        "#f87171",
  redBg:      "#2d0a0a",
  orange:     "#fb923c",
  orangeBg:   "#1c1000",
  blue:       "#60a5fa",
  blueBg:     "#0c1a2e",
  yellow:     "#fbbf24",
  yellowBg:   "#1a1400",
  // 按钮
  btnPrimary: "#2563eb",
  btnGreen:   "#059669",
  btnRed:     "#dc2626",
} as const;

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: C.textSub,
  marginBottom: 4,
  letterSpacing: "0.02em",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: 6,
  border: "1px solid #334155",
  fontSize: 14,
  boxSizing: "border-box",
  outline: "none",
  background: "#f8fafc",
  color: "#0f172a",
  WebkitTextFillColor: "#0f172a",
};

const btnStyle: React.CSSProperties = {
  padding: "9px 18px",
  background: C.btnPrimary,
  color: "#fff",
  border: "none",
  borderRadius: 6,
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};

const cardStyle: React.CSSProperties = {
  background: C.card,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  padding: "12px 14px",
};

const sectionStyle: React.CSSProperties = {
  marginTop: 40,
  paddingTop: 32,
  borderTop: `1px solid ${C.border}`,
};

// ─── 类型 ────────────────────────────────────────────────────────────────────

type AnalyzeResult = {
  ok?: boolean;
  tweetId?: string;
  analyzed?: boolean;
  pushed?: boolean;
  skipped?: boolean;
  error?: string;
};

type ChannelInfo = {
  id: string;
  slug: string;
  name: string;
  wxpusherTopicId?: string | null;
  subscriberCount?: number;
  hasAccess?: boolean;
  expiresAt?: string | null;
  grantedManually?: boolean;
  pushEnabled?: boolean;
  isTopicSubscriber?: boolean;
  canReceivePush?: boolean;
  pushExpiresAt?: string | null;
};

type ChannelGrantRow = { dashboardDays: number | null; pushDays: number | null };

type SalesRecord = {
  uid: string;
  channelSlug: string;
  channelName: string;
  grantedAt: string;
  expiresAt: string | null;
  pushEnabled: boolean;
};

type AdminSalesStat = {
  adminUid: string;
  total: number;
  uniqueUsers: number;
  active: number;
  expired: number;
  recent: SalesRecord[];
};

const GRANT_DAY_OPTIONS = [
  { label: "不开启", value: null },
  { label: "7 天",   value: 7 },
  { label: "14 天",  value: 14 },
  { label: "30 天",  value: 30 },
  { label: "90 天",  value: 90 },
  { label: "180 天", value: 180 },
  { label: "365 天", value: 365 },
  { label: "永久",   value: 0 },
];

const DAY_OPTIONS = [
  { label: "7 天",   value: 7 },
  { label: "14 天",  value: 14 },
  { label: "30 天",  value: 30 },
  { label: "90 天",  value: 90 },
  { label: "180 天", value: 180 },
  { label: "365 天", value: 365 },
  { label: "永久",   value: 0 },
];

const DEFAULT_DAYS = 30;

// ─── ExpiryDisplay ───────────────────────────────────────────────────────────

function ExpiryDisplay({ isoDate, prefix }: { isoDate: string | null | undefined; prefix?: string }) {
  if (!isoDate) return <span style={{ color: C.green, fontSize: 12 }}>{prefix}永久</span>;
  const d = new Date(isoDate);
  const days = Math.ceil((d.getTime() - Date.now()) / 86400_000);
  if (days < 0) return <span style={{ color: C.red, fontSize: 12 }}>{prefix}已过期</span>;
  return (
    <span style={{ color: days <= 7 ? C.orange : C.textSub, fontSize: 12 }}>
      {prefix}{d.toLocaleDateString("zh-CN")}（剩 {days} 天）
    </span>
  );
}

// ─── ChannelAccessManager ────────────────────────────────────────────────────

function ChannelAccessManager() {
  const [channels, setChannels] = useState<ChannelInfo[]>([]);
  const [lookupUid, setLookupUid] = useState("");
  const [userChannels, setUserChannels] = useState<ChannelInfo[] | null>(null);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [grantUid, setGrantUid] = useState("");
  const [grantRows, setGrantRows] = useState<Record<string, ChannelGrantRow>>({});
  const [welcomeSent, setWelcomeSent] = useState<Record<string, boolean>>({});
  const [editOpen, setEditOpen] = useState<Record<string, { dash?: boolean; push?: boolean }>>({});
  const [editDays, setEditDays] = useState<Record<string, { dash: number; push: number }>>({});

  useEffect(() => {
    fetch("/api/admin/channel-access")
      .then((r) => r.json())
      .then((d: { channels?: ChannelInfo[] }) => {
        const chs = d.channels ?? [];
        setChannels(chs);
        const rows: Record<string, ChannelGrantRow> = {};
        chs.forEach((c) => { rows[c.slug] = { dashboardDays: null, pushDays: null }; });
        setGrantRows(rows);
      })
      .catch(() => {});
  }, []);

  async function lookupUser() {
    if (!lookupUid.trim()) return;
    setLoading(true);
    const r = await fetch(`/api/admin/channel-access?uid=${encodeURIComponent(lookupUid.trim())}`);
    const d = await r.json();
    setUserChannels(d.channels ?? []);
    setLoading(false);
  }

  async function submitGrant() {
    if (!grantUid.trim()) return;
    const grants = channels.map((c) => {
      const row = grantRows[c.slug] ?? { dashboardDays: null, pushDays: null };
      return { slug: c.slug, dashboardDays: row.dashboardDays, pushDays: row.pushDays };
    }).filter((g) => g.dashboardDays !== null || g.pushDays !== null);

    if (grants.length === 0) { setMsg("❌ 请至少为一个频道开启 Dashboard 或推送"); return; }
    setLoading(true);
    const r = await fetch("/api/admin/channel-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid: grantUid.trim(), grants }),
    });
    const d = await r.json();
    setMsg(d.ok ? `✅ 已为 ${grantUid.trim()} 配置权限（${grants.length} 个频道）` : `❌ ${d.error}`);
    setLoading(false);
    if (d.ok) {
      setGrantUid("");
      const rows: Record<string, ChannelGrantRow> = {};
      channels.forEach((c) => { rows[c.slug] = { dashboardDays: null, pushDays: null }; });
      setGrantRows(rows);
      refreshChannels();
      if (lookupUid) lookupUser();
    }
  }

  async function sendWelcome(uid: string) {
    setLoading(true);
    const r = await fetch("/api/admin/send-welcome", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid }),
    });
    const d = await r.json();
    setMsg(d.ok ? `✅ 欢迎消息已发送给 ${uid}` : `❌ ${d.error}`);
    if (d.ok) setWelcomeSent((prev) => ({ ...prev, [uid]: true }));
    setLoading(false);
  }

  async function revoke(uid: string, slug: string) {
    setLoading(true);
    const r = await fetch("/api/admin/channel-access", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid, channelSlug: slug }),
    });
    const d = await r.json();
    setMsg(d.ok ? `✅ 已撤权 ${uid} ← ${slug}` : `❌ ${d.error}`);
    setLoading(false);
    if (d.ok) { refreshChannels(); if (lookupUid) lookupUser(); }
  }

  function toggleEdit(slug: string, field: "dash" | "push") {
    setEditOpen((prev) => ({ ...prev, [slug]: { ...prev[slug], [field]: !prev[slug]?.[field] } }));
    setEditDays((prev) => {
      const existing = prev[slug] ?? {};
      return { ...prev, [slug]: { dash: existing.dash ?? 30, push: existing.push ?? 30 } };
    });
  }

  async function updateDashExpiry(uid: string, slug: string) {
    const days = editDays[slug]?.dash ?? 30;
    setLoading(true);
    const r = await fetch("/api/admin/channel-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid, channelSlug: slug, days }),
    });
    const d = await r.json();
    const label = days === 0 ? "永久" : `${days} 天`;
    setMsg(d.ok ? `✅ ${slug} Dashboard → ${label}` : `❌ ${d.error}`);
    setLoading(false);
    if (d.ok) { toggleEdit(slug, "dash"); if (lookupUid) lookupUser(); }
  }

  async function updatePushExpiry(uid: string, slug: string) {
    const days = editDays[slug]?.push ?? 30;
    setLoading(true);
    const r = await fetch("/api/admin/channel-access", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid, channelSlug: slug, pushDays: days }),
    });
    const d = await r.json();
    const label = days === 0 ? "永久" : `${days} 天`;
    setMsg(d.ok ? `✅ ${slug} 推送 → ${label}` : `❌ ${d.error}`);
    setLoading(false);
    if (d.ok) { toggleEdit(slug, "push"); if (lookupUid) lookupUser(); }
  }

  function refreshChannels() {
    fetch("/api/admin/channel-access")
      .then((r) => r.json())
      .then((d: { channels?: ChannelInfo[] }) => setChannels(d.channels ?? []))
      .catch(() => {});
  }

  function updateRow(slug: string, field: keyof ChannelGrantRow, value: number | null) {
    setGrantRows((prev) => ({ ...prev, [slug]: { ...prev[slug], [field]: value } }));
  }

  const selectStyle: React.CSSProperties = {
    ...inputStyle, width: "auto", fontSize: 12, padding: "5px 8px",
  };

  const inlineEditStyle: React.CSSProperties = {
    marginTop: 8,
    display: "flex",
    gap: 6,
    alignItems: "center",
    padding: "8px 10px",
    background: C.blueBg,
    borderRadius: 6,
    border: `1px solid #1d4ed8`,
  };

  return (
    <div style={sectionStyle}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: C.heading }}>📡 WxPusher UID 权限管理</h2>
      <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 20 }}>为 WxPusher UID 授权频道 Dashboard 和推送权限（分频道、分项独立设置）</p>

      {/* 频道总览 */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        {channels.map((c) => (
          <div key={c.slug} style={{ ...cardStyle, minWidth: 140 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{c.name}</div>
            <div style={{ color: C.textMuted, fontSize: 12 }}>@{c.slug}</div>
            <div style={{ color: C.textSub, fontSize: 13, marginTop: 4 }}>👥 {c.subscriberCount ?? 0} 人</div>
          </div>
        ))}
      </div>

      {/* 查询用户权限 */}
      <div style={{ marginBottom: 28 }}>
        <label style={labelStyle}>🔍 查询用户权限（输入 WxPusher UID）</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={lookupUid} onChange={(e) => setLookupUid(e.target.value)}
            placeholder="UID_xxxxxxxxxxxx"
            style={{ ...inputStyle, flex: 1 }}
            onKeyDown={(e) => e.key === "Enter" && lookupUser()} />
          <button onClick={lookupUser} disabled={loading} style={btnStyle}>查询</button>
        </div>

        {userChannels && (
          <div style={{ marginTop: 12, ...cardStyle, padding: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>
                UID: <span style={{ fontFamily: "monospace", color: C.blue }}>{lookupUid}</span>
              </div>
              <button
                onClick={() => sendWelcome(lookupUid)}
                disabled={loading || !!welcomeSent[lookupUid]}
                style={{
                  padding: "5px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                  cursor: welcomeSent[lookupUid] ? "default" : "pointer", border: "none",
                  background: welcomeSent[lookupUid] ? C.greenBg : C.btnPrimary,
                  color: welcomeSent[lookupUid] ? C.green : "#fff",
                }}
              >
                {welcomeSent[lookupUid] ? "✅ 已发送" : "📨 发欢迎消息"}
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {userChannels.map((c) => {
                const expiry = c.expiresAt ? new Date(c.expiresAt) : null;
                const daysLeft = expiry ? Math.ceil((expiry.getTime() - Date.now()) / 86400_000) : null;
                const expiryLabel = expiry === null
                  ? <span style={{ color: C.green, fontWeight: 600 }}>永久</span>
                  : daysLeft !== null && daysLeft < 0
                    ? <span style={{ color: C.red, fontWeight: 600 }}>已过期</span>
                    : <span style={{ color: daysLeft !== null && daysLeft <= 7 ? C.orange : C.textSub }}>
                        {expiry.toLocaleDateString("zh-CN")}（剩 {daysLeft} 天）
                      </span>;

                const dashOpen = !!editOpen[c.slug]?.dash;
                const pushOpen = !!editOpen[c.slug]?.push;
                const curDashDays = editDays[c.slug]?.dash ?? 30;
                const curPushDays = editDays[c.slug]?.push ?? 30;

                return (
                  <div key={c.slug} style={{
                    background: C.cardAlt,
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    padding: "12px 14px",
                    opacity: (!c.hasAccess && !c.canReceivePush) ? 0.5 : 1,
                  }}>
                    {/* 频道名 + 撤权 */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: C.text }}>📺 {c.name}</span>
                      {(c.hasAccess || c.canReceivePush) && (
                        <button onClick={() => revoke(lookupUid, c.slug)}
                          style={{ padding: "3px 10px", background: "none", border: `1px solid ${C.red}`, color: C.red, borderRadius: 6, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                          撤权
                        </button>
                      )}
                    </div>

                    {/* Dashboard 行 */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, marginBottom: 4, flexWrap: "wrap" }}>
                      <span style={{ color: C.textSub, minWidth: 80 }}>🖥 Dashboard</span>
                      {c.hasAccess
                        ? <><span style={{ color: C.green }}>✅ 有权限</span>
                            <span style={{ color: C.textMuted, margin: "0 4px" }}>·</span>
                            {expiryLabel}
                            {c.grantedManually && <span style={{ fontSize: 11, background: C.blueBg, color: C.blue, borderRadius: 10, padding: "1px 7px", marginLeft: 2 }}>手动</span>}
                          </>
                        : <span style={{ color: C.textMuted }}>— 未授权</span>}
                      <button onClick={() => toggleEdit(c.slug, "dash")}
                        style={{ marginLeft: "auto", padding: "2px 8px", background: dashOpen ? C.blueBg : "none", border: `1px solid ${dashOpen ? "#2563eb" : C.borderMid}`, color: dashOpen ? C.blue : C.textSub, borderRadius: 6, fontSize: 11, cursor: "pointer" }}>
                        {dashOpen ? "收起" : c.hasAccess ? "✏️ 改期" : "＋ 授权"}
                      </button>
                    </div>
                    {dashOpen && (
                      <div style={inlineEditStyle}>
                        <select value={curDashDays}
                          onChange={(e) => setEditDays((prev) => ({ ...prev, [c.slug]: { ...prev[c.slug], dash: Number(e.target.value) } }))}
                          style={{ ...selectStyle }}>
                          {DAY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        <button onClick={() => updateDashExpiry(lookupUid, c.slug)} disabled={loading}
                          style={{ padding: "4px 12px", background: C.btnPrimary, color: "#fff", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                          确认
                        </button>
                        <button onClick={() => toggleEdit(c.slug, "dash")}
                          style={{ padding: "4px 10px", background: "none", border: `1px solid ${C.border}`, color: C.textSub, borderRadius: 6, fontSize: 12, cursor: "pointer" }}>
                          取消
                        </button>
                      </div>
                    )}

                    {/* 推送行 */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, flexWrap: "wrap", marginTop: 4 }}>
                      <span style={{ color: C.textSub, minWidth: 80 }}>📲 推送</span>
                      {/* 管理员手动授权的推送（我们的 UID 推送） */}
                      {c.canReceivePush
                        ? <><span style={{ color: C.green }}>✅ 已授权</span>
                            <span style={{ fontSize: 11, background: C.yellowBg, color: C.yellow, borderRadius: 10, padding: "1px 7px" }}>手动</span>
                          </>
                        : <span style={{ color: C.textMuted }}>— 未授权</span>}
                      {/* WxPusher 话题付费订阅（平台自动广播，与上面独立） */}
                      {c.isTopicSubscriber && (
                        <span style={{ fontSize: 11, background: C.greenBg, color: C.green, borderRadius: 10, padding: "1px 7px" }}>
                          📡 话题订阅（{c.pushExpiresAt ? new Date(c.pushExpiresAt).toLocaleDateString("zh-CN") + "到期" : "永久"}）
                        </span>
                      )}
                      {c.canReceivePush && <ExpiryDisplay isoDate={c.pushExpiresAt} prefix="· " />}
                      <button onClick={() => toggleEdit(c.slug, "push")}
                        style={{ marginLeft: "auto", padding: "2px 8px", background: pushOpen ? C.greenBg : "none", border: `1px solid ${pushOpen ? "#16a34a" : C.borderMid}`, color: pushOpen ? C.green : C.textSub, borderRadius: 6, fontSize: 11, cursor: "pointer" }}>
                        {pushOpen ? "收起" : c.canReceivePush ? "✏️ 改期" : "＋ 开启"}
                      </button>
                    </div>
                    {pushOpen && (
                      <div style={{ ...inlineEditStyle, background: C.greenBg, border: "1px solid #166534" }}>
                        <select value={curPushDays}
                          onChange={(e) => setEditDays((prev) => ({ ...prev, [c.slug]: { ...prev[c.slug], push: Number(e.target.value) } }))}
                          style={{ ...selectStyle }}>
                          {DAY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        <button onClick={() => updatePushExpiry(lookupUid, c.slug)} disabled={loading}
                          style={{ padding: "4px 12px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                          确认
                        </button>
                        <button onClick={() => toggleEdit(c.slug, "push")}
                          style={{ padding: "4px 10px", background: "none", border: `1px solid ${C.border}`, color: C.textSub, borderRadius: 6, fontSize: 12, cursor: "pointer" }}>
                          取消
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 授权表单 */}
      <div style={{ background: C.cardAlt, border: `1px solid ${C.border}`, borderRadius: 10, padding: "20px" }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, marginTop: 0, color: C.heading }}>✅ 新增授权</h3>
        <p style={{ color: C.textMuted, fontSize: 12, marginBottom: 16, marginTop: 0 }}>
          为每个频道分别配置 Dashboard 有效期和推送有效期，选&ldquo;不开启&rdquo;即跳过该项
        </p>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>WxPusher UID</label>
          <input value={grantUid} onChange={(e) => setGrantUid(e.target.value)}
            placeholder="UID_xxxxxxxxxxxx" style={{ ...inputStyle, maxWidth: 380 }} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "160px 1fr 1fr", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>频道</span>
            <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>🖥 Dashboard 有效期</span>
            <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>📲 推送有效期</span>
          </div>
          {channels.map((c) => {
            const row = grantRows[c.slug] ?? { dashboardDays: null, pushDays: null };
            return (
              <div key={c.slug} style={{ display: "grid", gridTemplateColumns: "160px 1fr 1fr", gap: 8, alignItems: "center", background: C.card, padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.border}` }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: C.text }}>{c.name}</span>
                <select
                  value={row.dashboardDays === null ? "null" : String(row.dashboardDays)}
                  onChange={(e) => updateRow(c.slug, "dashboardDays", e.target.value === "null" ? null : Number(e.target.value))}
                  style={selectStyle}
                >
                  {GRANT_DAY_OPTIONS.map((o) => (
                    <option key={String(o.value)} value={o.value === null ? "null" : String(o.value)}>{o.label}</option>
                  ))}
                </select>
                <select
                  value={row.pushDays === null ? "null" : String(row.pushDays)}
                  onChange={(e) => updateRow(c.slug, "pushDays", e.target.value === "null" ? null : Number(e.target.value))}
                  style={selectStyle}
                >
                  {GRANT_DAY_OPTIONS.map((o) => (
                    <option key={String(o.value)} value={o.value === null ? "null" : String(o.value)}>{o.label}</option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>

        <button onClick={submitGrant} disabled={loading || !grantUid.trim()} style={{ ...btnStyle, background: C.btnGreen }}>
          ✅ 确认授权
        </button>
      </div>

      {msg && (
        <div style={{ marginTop: 12, padding: "8px 14px", borderRadius: 6, fontSize: 13,
          background: msg.startsWith("✅") ? C.greenBg : C.redBg,
          color: msg.startsWith("✅") ? C.green : C.red,
          border: `1px solid ${msg.startsWith("✅") ? "#166534" : "#7f1d1d"}`,
        }}>
          {msg}
        </div>
      )}
    </div>
  );
}

// ─── PasswordUserManager ─────────────────────────────────────────────────────

type ChannelAccess = { slug: string; name: string; expiresAt: string | null };
type PwdChannelInfo = { id: string; slug: string; name: string };
type PwdUser = {
  uid: string;
  username: string;
  note: string | null;
  createdAt: string;
  channels: ChannelAccess[];
};
type ChannelResult = { slug: string; expiresAt: string };
type NewUserResult = { username: string; password: string; uid: string; channels: ChannelResult[] };
type ChannelDaysMap = Record<string, number>;

function PasswordUserManager() {
  const [users, setUsers] = useState<PwdUser[]>([]);
  const [allChannels, setAllChannels] = useState<PwdChannelInfo[]>([]);
  const [newUsername, setNewUsername] = useState("");
  const [channelDays, setChannelDays] = useState<ChannelDaysMap>({});
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<NewUserResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState("");
  const [extendDays, setExtendDays] = useState<Record<string, number>>({});
  const [extendOpen, setExtendOpen] = useState<Record<string, boolean>>({});

  const loadUsers = useCallback(async () => {
    const r = await fetch("/api/admin/password-users");
    const d = await r.json() as { users: PwdUser[] };
    setUsers(d.users ?? []);
  }, []);

  useEffect(() => {
    loadUsers();
    fetch("/api/admin/channel-access")
      .then((r) => r.json())
      .then((d: { channels?: PwdChannelInfo[] }) => setAllChannels(d.channels ?? []))
      .catch(() => {});
  }, [loadUsers]);

  function toggleChannel(slug: string) {
    setChannelDays((prev) => {
      if (slug in prev) {
        const next = { ...prev };
        delete next[slug];
        return next;
      }
      return { ...prev, [slug]: DEFAULT_DAYS };
    });
  }

  function setDaysForSlug(slug: string, days: number) {
    setChannelDays((prev) => ({ ...prev, [slug]: days }));
  }

  const selectedSlugs = Object.keys(channelDays);

  async function createUser() {
    if (!newUsername.trim()) return;
    if (selectedSlugs.length === 0) { setMsg("❌ 请至少选择一个频道"); return; }
    setLoading(true);
    setCreated(null);
    setMsg("");
    try {
      const channels = selectedSlugs.map((slug) => ({ slug, days: channelDays[slug] ?? DEFAULT_DAYS }));
      const r = await fetch("/api/admin/password-users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: newUsername.trim(), channels }),
      });
      const d = await r.json() as NewUserResult & { error?: string };
      if (!r.ok) { setMsg(`❌ ${d.error}`); return; }
      setCreated(d);
      setNewUsername("");
      setChannelDays({});
      loadUsers();
    } finally {
      setLoading(false);
    }
  }

  function extendKey(uid: string, slug: string) { return `${uid}:${slug}`; }

  function toggleExtend(uid: string, slug: string) {
    const key = extendKey(uid, slug);
    setExtendOpen((prev) => ({ ...prev, [key]: !prev[key] }));
    setExtendDays((prev) => ({ ...prev, [key]: prev[key] ?? DEFAULT_DAYS }));
  }

  async function applyExtend(uid: string, slug: string) {
    const key = extendKey(uid, slug);
    const days = extendDays[key] ?? DEFAULT_DAYS;
    setLoading(true);
    const r = await fetch("/api/admin/password-users/extend", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid, channelSlug: slug, days }),
    });
    const d = await r.json() as { ok?: boolean; error?: string };
    if (d.ok) {
      setExtendOpen((prev) => ({ ...prev, [key]: false }));
      setMsg("✅ 已更新有效期");
      loadUsers();
    } else {
      setMsg(`❌ ${d.error}`);
    }
    setLoading(false);
  }

  async function deleteUser(uid: string, username: string) {
    if (!confirm(`确定删除用户「${username}」？此操作不可撤销。`)) return;
    const r = await fetch("/api/admin/password-users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid }),
    });
    const d = await r.json() as { ok?: boolean; error?: string };
    setMsg(d.ok ? `✅ 已删除 ${username}` : `❌ ${d.error}`);
    if (d.ok) loadUsers();
  }

  function copyCredentials() {
    if (!created) return;
    const lines = created.channels.map((ch) => {
      const name = allChannels.find((c) => c.slug === ch.slug)?.name ?? ch.slug;
      const expiry = ch.expiresAt === "永久"
        ? "永久有效"
        : `有效期至 ${new Date(ch.expiresAt).toLocaleDateString("zh-CN")}`;
      return `  · ${name}（${expiry}）`;
    });
    const text = [
      `登录地址：https://www.alphaline.fit/auth/wxpusher`,
      `用户名：${created.username}`,
      `密码：${created.password}`,
      `开放频道：`,
      ...lines,
    ].join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function formatExpiry(iso: string | null) {
    if (!iso) return <span style={{ color: C.green }}>永久</span>;
    const d = new Date(iso);
    const diff = Math.ceil((d.getTime() - Date.now()) / 86400_000);
    const label = d.toLocaleDateString("zh-CN");
    if (diff < 0) return <span style={{ color: C.red }}>{label}（已过期）</span>;
    if (diff <= 7) return <span style={{ color: C.orange }}>{label}（剩 {diff} 天）</span>;
    return <span style={{ color: C.textSub }}>{label}（剩 {diff} 天）</span>;
  }

  return (
    <div style={sectionStyle}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: C.heading }}>🔐 账号密码用户管理</h2>
      <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 20 }}>为不使用 WxPusher 的客户生成登录账号，每个频道可单独设置有效期</p>

      {/* 创建新用户 */}
      <div style={{ background: C.cardAlt, border: `1px solid ${C.border}`, borderRadius: 10, padding: "20px 20px 16px", marginBottom: 24 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14, color: C.heading }}>➕ 新建用户</div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>用户名</label>
          <input value={newUsername} onChange={(e) => setNewUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createUser()}
            placeholder="如：alice 或 张先生"
            style={{ ...inputStyle, maxWidth: 300 }} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>开放频道 &amp; 有效期（点击频道名选择，选中后可设置天数）</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            {allChannels.map((c) => {
              const isSelected = c.slug in channelDays;
              return (
                <div key={c.slug} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button type="button" onClick={() => toggleChannel(c.slug)}
                    style={{
                      minWidth: 140, padding: "7px 14px", borderRadius: 20,
                      border: `2px solid ${isSelected ? C.blue : C.borderMid}`,
                      background: isSelected ? C.blueBg : "transparent",
                      color: isSelected ? C.blue : C.textSub,
                      fontWeight: isSelected ? 700 : 400,
                      fontSize: 13, cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                    }}>
                    {isSelected ? "✓ " : ""}{c.name}
                  </button>
                  {isSelected && (
                    <select value={channelDays[c.slug] ?? DEFAULT_DAYS}
                      onChange={(e) => setDaysForSlug(c.slug, Number(e.target.value))}
                      style={{ ...inputStyle, width: "auto", padding: "6px 10px", fontSize: 13 }}>
                      {DAY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <button onClick={createUser} disabled={loading || !newUsername.trim() || selectedSlugs.length === 0}
          style={{ ...btnStyle, background: C.btnPrimary, whiteSpace: "nowrap" }}>
          {loading ? "生成中…" : "生成账号"}
        </button>

        {/* 生成结果 */}
        {created && (
          <div style={{ marginTop: 16, background: C.blueBg, border: "1px solid #1d4ed8", borderRadius: 8, padding: "14px 16px" }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: C.blue, marginBottom: 10 }}>✅ 账号已生成，发给客户：</div>
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 16px", fontSize: 14 }}>
              <span style={{ color: C.textSub }}>用户名</span>
              <span style={{ fontFamily: "monospace", fontWeight: 600, color: C.text }}>{created.username}</span>
              <span style={{ color: C.textSub }}>密　码</span>
              <span style={{ fontFamily: "monospace", fontWeight: 600, color: C.text }}>{created.password}</span>
              <span style={{ color: C.textSub, verticalAlign: "top", paddingTop: 2 }}>频道权限</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {created.channels.map((ch) => {
                  const name = allChannels.find((c) => c.slug === ch.slug)?.name ?? ch.slug;
                  return (
                    <div key={ch.slug} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 600, color: C.text }}>{name}</span>
                      <span style={{ fontSize: 12, color: C.textSub }}>
                        {ch.expiresAt === "永久"
                          ? <span style={{ color: C.green }}>永久</span>
                          : `有效期至 ${new Date(ch.expiresAt).toLocaleDateString("zh-CN")}`}
                      </span>
                    </div>
                  );
                })}
              </div>
              <span style={{ color: C.textSub }}>登录地址</span>
              <a href="https://www.alphaline.fit/auth/wxpusher" target="_blank" rel="noreferrer"
                style={{ color: C.blue, fontSize: 13 }}>
                alphaline.fit/auth/wxpusher
              </a>
            </div>
            <button onClick={copyCredentials}
              style={{ marginTop: 12, padding: "8px 18px", background: copied ? C.btnGreen : C.btnPrimary, color: "#fff", border: "none", borderRadius: 6, fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
              {copied ? "✅ 已复制" : "📋 一键复制（发给客户）"}
            </button>
          </div>
        )}

        {msg && (
          <div style={{ marginTop: 12, padding: "8px 14px", borderRadius: 6, fontSize: 13,
            background: msg.startsWith("✅") ? C.greenBg : C.redBg,
            color: msg.startsWith("✅") ? C.green : C.red,
            border: `1px solid ${msg.startsWith("✅") ? "#166534" : "#7f1d1d"}`,
          }}>
            {msg}
          </div>
        )}
      </div>

      {/* 用户列表 */}
      {users.length === 0 ? (
        <p style={{ color: C.textMuted, fontSize: 14 }}>暂无账号密码用户</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {users.map((u) => (
            <div key={u.uid} style={{ padding: "12px 16px", borderRadius: 8, background: C.card, border: `1px solid ${C.border}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 120px" }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{u.username}</div>
                  <div style={{ color: C.textMuted, fontSize: 12 }}>创建于 {new Date(u.createdAt).toLocaleDateString("zh-CN")}</div>
                </div>
                <button onClick={() => deleteUser(u.uid, u.username)}
                  style={{ padding: "5px 12px", background: "none", border: `1px solid ${C.red}`, color: C.red, borderRadius: 6, fontSize: 12, cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}>
                  删除账号
                </button>
              </div>

              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                {u.channels.length === 0 ? (
                  <span style={{ color: C.red, fontSize: 13 }}>无频道权限</span>
                ) : u.channels.map((c) => {
                  const key = extendKey(u.uid, c.slug);
                  const isOpen = !!extendOpen[key];
                  return (
                    <div key={c.slug}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 600, fontSize: 13, minWidth: 100, color: C.text }}>{c.name}</span>
                        <span style={{ fontSize: 12 }}>{formatExpiry(c.expiresAt)}</span>
                        <button onClick={() => toggleExtend(u.uid, c.slug)}
                          style={{
                            padding: "2px 10px", borderRadius: 12,
                            border: `1px solid ${isOpen ? C.blue : C.borderMid}`,
                            background: isOpen ? C.blueBg : "transparent",
                            color: C.blue, fontSize: 11, fontWeight: 600, cursor: "pointer",
                          }}>
                          {isOpen ? "取消" : "修改有效期"}
                        </button>
                      </div>
                      {isOpen && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, marginLeft: 108, flexWrap: "wrap" }}>
                          <select value={extendDays[key] ?? DEFAULT_DAYS}
                            onChange={(e) => setExtendDays((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                            style={{ ...inputStyle, width: "auto", padding: "5px 10px", fontSize: 12 }}>
                            {DAY_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                          <span style={{ fontSize: 11, color: C.textMuted }}>从今天起</span>
                          <button onClick={() => applyExtend(u.uid, c.slug)} disabled={loading}
                            style={{ padding: "5px 14px", borderRadius: 6, background: C.btnPrimary, color: "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                            确认修改
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── AccessLogViewer ─────────────────────────────────────────────────────────

type AccessStat = {
  uid: string;
  label: string | null;
  count: number;
  perHour: number;
  firstSeen: string | null;
  lastSeen: string | null;
  recent: { path: string; time: string }[];
};

// ─── SalesSummary ─────────────────────────────────────────────────────────────

function SalesSummary({ currentUid }: { currentUid: string }) {
  const [stats, setStats] = useState<AdminSalesStat[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/admin/sales-summary");
    const d = await r.json();
    setStats(d.summary ?? []);
    setLoading(false);
  }

  function shortUid(uid: string) {
    if (uid === "unknown") return "未知";
    return uid.length > 20 ? uid.slice(0, 10) + "…" + uid.slice(-6) : uid;
  }

  function label(uid: string) {
    if (uid === currentUid) return "我";
    if (uid === "unknown") return "历史记录（未追踪）";
    return shortUid(uid);
  }

  const statColors = [C.blue, C.orange, C.green, C.yellow];

  return (
    <div style={sectionStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: C.heading }}>📊 销售统计</h2>
          <p style={{ color: C.textMuted, fontSize: 13, margin: 0 }}>各管理员手动授权记录汇总</p>
        </div>
        <button onClick={load} disabled={loading}
          style={{ ...btnStyle, background: C.card, border: `1px solid ${C.borderMid}`, color: C.text, fontSize: 13 }}>
          {loading ? "加载中…" : stats ? "🔄 刷新" : "📥 加载统计"}
        </button>
      </div>

      {stats && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {stats.map((s, i) => {
            const isMe = s.adminUid === currentUid;
            const color = statColors[i % statColors.length];
            const isOpen = expanded === s.adminUid;

            return (
              <div key={s.adminUid} style={{
                background: C.card,
                border: `1px solid ${isMe ? color : C.border}`,
                borderRadius: 10,
                overflow: "hidden",
              }}>
                {/* 头部 */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 16px", borderBottom: isOpen ? `1px solid ${C.border}` : "none",
                  cursor: "pointer",
                }} onClick={() => setExpanded(isOpen ? null : s.adminUid)}>
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%",
                    background: color + "22", display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 16, flexShrink: 0,
                  }}>
                    {isMe ? "👑" : s.adminUid === "unknown" ? "❓" : "👤"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>
                      {label(s.adminUid)}
                      {isMe && <span style={{ fontSize: 11, marginLeft: 6, color: color }}>（当前账号）</span>}
                    </div>
                    <div style={{ fontSize: 11, color: C.textMuted, fontFamily: "monospace", marginTop: 2 }}>
                      {s.adminUid !== "unknown" ? s.adminUid : "grantedBy 为空的历史记录"}
                    </div>
                  </div>
                  {/* 核心数字 */}
                  <div style={{ display: "flex", gap: 16, flexShrink: 0 }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color }}>{s.uniqueUsers}</div>
                      <div style={{ fontSize: 11, color: C.textMuted }}>独立用户</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: C.green }}>{s.active}</div>
                      <div style={{ fontSize: 11, color: C.textMuted }}>有效</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: C.textMuted }}>{s.expired}</div>
                      <div style={{ fontSize: 11, color: C.textMuted }}>已过期</div>
                    </div>
                  </div>
                  <div style={{ color: C.textMuted, fontSize: 16, flexShrink: 0 }}>{isOpen ? "▲" : "▼"}</div>
                </div>

                {/* 展开：最近授权记录 */}
                {isOpen && (
                  <div style={{ padding: "12px 16px" }}>
                    <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>最近 {s.recent.length} 条授权记录</div>
                    {s.recent.length === 0
                      ? <div style={{ color: C.textMuted, fontSize: 13 }}>暂无记录</div>
                      : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {s.recent.map((r, j) => {
                            const expiry = r.expiresAt ? new Date(r.expiresAt) : null;
                            const daysLeft = expiry ? Math.ceil((expiry.getTime() - Date.now()) / 86400_000) : null;
                            const expired = daysLeft !== null && daysLeft < 0;
                            return (
                              <div key={j} style={{
                                display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
                                padding: "6px 10px", background: C.cardAlt, borderRadius: 6,
                                opacity: expired ? 0.6 : 1,
                              }}>
                                <span style={{ fontFamily: "monospace", fontSize: 12, color: C.blue, flex: "0 0 auto" }}>
                                  {r.uid.slice(0, 14)}…
                                </span>
                                <span style={{ fontSize: 11, background: C.blueBg, color: C.blue, borderRadius: 10, padding: "1px 7px" }}>
                                  {r.channelName}
                                </span>
                                {r.pushEnabled && (
                                  <span style={{ fontSize: 11, background: C.greenBg, color: C.green, borderRadius: 10, padding: "1px 7px" }}>
                                    📲 推送
                                  </span>
                                )}
                                <span style={{ fontSize: 11, color: C.textMuted }}>
                                  授权于 {new Date(r.grantedAt).toLocaleDateString("zh-CN")}
                                </span>
                                {expired
                                  ? <span style={{ fontSize: 11, color: C.red }}>已过期</span>
                                  : expiry
                                    ? <span style={{ fontSize: 11, color: daysLeft! <= 7 ? C.orange : C.textSub }}>
                                        剩 {daysLeft} 天
                                      </span>
                                    : <span style={{ fontSize: 11, color: C.green }}>永久</span>}
                              </div>
                            );
                          })}
                        </div>
                      )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── AccessLogViewer ──────────────────────────────────────────────────────────

function AccessLogViewer() {
  const [hours, setHours] = useState(24);
  const [stats, setStats] = useState<AccessStat[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const r = await fetch(`/api/admin/access-logs?hours=${hours}`);
    const d = await r.json() as { stats?: AccessStat[] };
    setStats(d.stats ?? []);
    setLoading(false);
  }

  function riskLevel(perHour: number): { label: string; color: string; bg: string } {
    if (perHour >= 60) return { label: "🚨 高度可疑", color: C.red,    bg: C.redBg };
    if (perHour >= 20) return { label: "⚠️ 异常频繁", color: C.orange, bg: C.orangeBg };
    return                    { label: "✅ 正常",     color: C.green,  bg: C.greenBg };
  }

  function fmtTime(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div style={sectionStyle}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: C.heading }}>🕵️ 访问日志 / 爬虫检测</h2>
      <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>
        统计各 UID 的 Dashboard 访问频次。每小时 &gt;20 次视为异常，&gt;60 次高度可疑。
      </p>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <label style={{ fontSize: 13, color: C.textSub }}>时间范围：</label>
        {[1, 6, 24, 72, 168].map((h) => (
          <button key={h} onClick={() => setHours(h)}
            style={{ padding: "5px 12px", borderRadius: 6,
              border: `1px solid ${hours === h ? C.btnPrimary : C.border}`,
              background: hours === h ? C.blueBg : "transparent",
              color: hours === h ? C.blue : C.textSub,
              fontWeight: hours === h ? 700 : 400, fontSize: 12, cursor: "pointer" }}>
            {h < 24 ? `${h}h` : `${h / 24}天`}
          </button>
        ))}
        <button onClick={load} disabled={loading}
          style={{ ...btnStyle, padding: "6px 16px", fontSize: 13 }}>
          {loading ? "加载中…" : "查询"}
        </button>
      </div>

      {stats === null ? (
        <p style={{ color: C.textMuted, fontSize: 14 }}>点击「查询」加载数据</p>
      ) : stats.length === 0 ? (
        <p style={{ color: C.textMuted, fontSize: 14 }}>暂无访问记录</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {stats.map((s) => {
            const risk = riskLevel(s.perHour);
            const isOpen = expanded === s.uid;
            return (
              <div key={s.uid} style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                  background: C.card, flexWrap: "wrap", cursor: "pointer" }}
                  onClick={() => setExpanded(isOpen ? null : s.uid)}>
                  <span style={{ padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 700,
                    background: risk.bg, color: risk.color, whiteSpace: "nowrap" }}>
                    {risk.label}
                  </span>
                  <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                    <div style={{ fontFamily: "monospace", fontSize: 12, color: C.blue,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.uid}
                    </div>
                    {s.label && <div style={{ fontSize: 11, color: C.textMuted }}>{s.label}</div>}
                  </div>
                  <div style={{ display: "flex", gap: 16, fontSize: 13, flexShrink: 0 }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontWeight: 700, fontSize: 16, color: C.text }}>{s.count}</div>
                      <div style={{ color: C.textMuted, fontSize: 11 }}>总请求</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontWeight: 700, fontSize: 16, color: risk.color }}>{s.perHour}</div>
                      <div style={{ color: C.textMuted, fontSize: 11 }}>次/小时</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 12, color: C.textSub }}>{fmtTime(s.lastSeen)}</div>
                      <div style={{ color: C.textMuted, fontSize: 11 }}>最近访问</div>
                    </div>
                  </div>
                  <span style={{ color: C.textMuted, fontSize: 12 }}>{isOpen ? "▲" : "▼"}</span>
                </div>

                {isOpen && (
                  <div style={{ padding: "12px 14px", borderTop: `1px solid ${C.border}`, background: C.cardAlt }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.textSub, marginBottom: 8 }}>
                      最近访问记录（最多10条）
                    </div>
                    {s.recent.length === 0 ? (
                      <p style={{ color: C.textMuted, fontSize: 12 }}>暂无明细</p>
                    ) : (
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <tbody>
                          {s.recent.map((r, i) => (
                            <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                              <td style={{ padding: "4px 8px", color: C.textMuted, width: 140 }}>{fmtTime(r.time)}</td>
                              <td style={{ padding: "4px 8px", fontFamily: "monospace", color: C.textSub }}>{r.path}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    <div style={{ marginTop: 10 }}>
                      <span style={{ fontSize: 11, color: C.textMuted }}>首次访问：{fmtTime(s.firstSeen)}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── OpsClient（主入口）──────────────────────────────────────────────────────

export function OpsClient({ uid }: { uid: string }) {
  const [secret, setSecret] = useState("");
  const [content, setContent] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [tweetDate, setTweetDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [history, setHistory] = useState<Array<{ snippet: string; result: AnalyzeResult }>>([]);

  // 将 uid 传入备用（预留给后续功能）
  void uid;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          sourceUrl: sourceUrl.trim() || undefined,
          tweetDate: tweetDate || undefined,
          secret: secret.trim() || undefined,
        }),
      });
      const data = (await res.json()) as AnalyzeResult;
      setResult(data);
      if (data.ok) {
        setHistory((prev) => [
          { snippet: content.slice(0, 80) + (content.length > 80 ? "…" : ""), result: data },
          ...prev.slice(0, 19),
        ]);
        setContent("");
        setSourceUrl("");
        setTweetDate("");
      }
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(false);
    }
  }

  function statusBadge(r: AnalyzeResult) {
    if (r.error)   return <span style={badge("red")}>❌ {r.error}</span>;
    if (r.skipped) return <span style={badge("yellow")}>⏭ 已存在，跳过推送</span>;
    if (r.pushed)  return <span style={badge("green")}>✅ 已推送到微信</span>;
    return                 <span style={badge("orange")}>⚠️ 分析完成，推送失败</span>;
  }

  function badge(color: "green" | "red" | "yellow" | "orange"): React.CSSProperties {
    const map = {
      green:  { bg: C.greenBg,  text: C.green },
      red:    { bg: C.redBg,    text: C.red },
      yellow: { bg: C.yellowBg, text: C.yellow },
      orange: { bg: C.orangeBg, text: C.orange },
    };
    return {
      display: "inline-block", padding: "3px 10px", borderRadius: 12,
      fontSize: 13, fontWeight: 500,
      background: map[color].bg, color: map[color].text,
    };
  }

  const resultBg = result?.error ? C.redBg : result?.skipped ? C.yellowBg : C.greenBg;
  const resultBorder = result?.error ? "#7f1d1d" : result?.skipped ? "#78350f" : "#166534";

  return (
    <div id="ops-root" style={{ maxWidth: 720, margin: "0 auto", padding: "32px 16px", fontFamily: "system-ui, sans-serif", background: C.bg, color: C.text, minHeight: "100vh" }}>

      {/* ── 页头 ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
        <Link href="/dashboard/serenity"
          style={{ fontSize: 13, color: C.textMuted, textDecoration: "none", padding: "4px 10px", border: `1px solid ${C.border}`, borderRadius: 6 }}
        >
          ← 返回 Dashboard
        </Link>
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, color: C.heading }}>
        ⚙️ 后台管理
      </h1>
      <p style={{ color: C.textMuted, marginBottom: 28, fontSize: 14 }}>
        手动分析推文 · 权限管理 · 用户管理 · 访问日志
      </p>

      {/* ── 手动分析表单 ── */}
      <div style={{ ...cardStyle, padding: "20px" }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, marginTop: 0, color: C.heading }}>🔍 手动分析推文</h2>
        <p style={{ color: C.textMuted, marginBottom: 16, fontSize: 13, marginTop: 0 }}>
          粘贴推文内容 → AI 分析 → 推送到微信。相同内容不会重复推送。
        </p>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={labelStyle}>🔑 访问密钥</label>
            <input type="password" placeholder="CRON_SECRET 的值"
              value={secret} onChange={(e) => setSecret(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>📝 推文内容 <span style={{ color: C.red }}>*</span></label>
            <textarea placeholder="粘贴推文原文（英文）…"
              value={content} onChange={(e) => setContent(e.target.value)}
              required rows={6}
              style={{ ...inputStyle, resize: "vertical", minHeight: 120 }} />
          </div>
          <div>
            <label style={labelStyle}>🔗 推文链接（选填）</label>
            <input type="url" placeholder="https://x.com/..."
              value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>📅 发推时间（选填，历史推文填写）</label>
            <input type="datetime-local" value={tweetDate}
              onChange={(e) => setTweetDate(e.target.value)}
              style={{ ...inputStyle, width: "auto" }} />
          </div>
          <button type="submit" disabled={loading || !content.trim()}
            style={{ ...btnStyle, background: loading ? C.borderMid : C.btnPrimary, cursor: loading ? "not-allowed" : "pointer", alignSelf: "flex-start" }}>
            {loading ? "⏳ 分析中…" : "🚀 分析并推送"}
          </button>
        </form>

        {result && (
          <div style={{ marginTop: 20, padding: "16px", borderRadius: 8, background: resultBg, border: `1px solid ${resultBorder}` }}>
            <div style={{ fontWeight: 600, marginBottom: 8, color: C.text }}>分析结果</div>
            {statusBadge(result)}
            {result.tweetId && (
              <div style={{ marginTop: 8, fontSize: 12, color: C.textMuted }}>
                tweetId: <code style={{ color: C.blue }}>{result.tweetId}</code>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 历史记录 */}
      {history.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: C.textSub }}>
            📜 本次会话记录（{history.length} 条）
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {history.map((item, i) => (
              <div key={i} style={{ padding: "10px 14px", borderRadius: 6, background: C.card, border: `1px solid ${C.border}`, fontSize: 13 }}>
                <div style={{ color: C.textSub, marginBottom: 4 }}>{item.snippet}</div>
                <div>{statusBadge(item.result)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <ChannelAccessManager />
      <PasswordUserManager />
      <SalesSummary currentUid={uid} />

      <AccessLogViewer />

    </div>
  );
}
