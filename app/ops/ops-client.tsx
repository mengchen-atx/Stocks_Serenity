"use client";

import { useState, useEffect } from "react";

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
  subscriberCount?: number;
  hasAccess?: boolean;
};

function ChannelAccessManager() {
  const [channels, setChannels] = useState<ChannelInfo[]>([]);
  const [lookupUid, setLookupUid] = useState("");
  const [newUid, setNewUid] = useState("");
  const [selectedSlug, setSelectedSlug] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [userChannels, setUserChannels] = useState<ChannelInfo[] | null>(null);

  useEffect(() => {
    fetch("/api/admin/channel-access")
      .then((r) => r.json())
      .then((d) => { setChannels(d.channels ?? []); if (d.channels?.[0]) setSelectedSlug(d.channels[0].slug); })
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

  async function grant() {
    if (!newUid.trim() || !selectedSlug) return;
    setLoading(true);
    const r = await fetch("/api/admin/channel-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid: newUid.trim(), channelSlug: selectedSlug }),
    });
    const d = await r.json();
    setMsg(d.ok ? `✅ 已授权 ${newUid.trim()} → ${selectedSlug}` : `❌ ${d.error}`);
    setLoading(false);
    if (d.ok) { setNewUid(""); refreshChannels(); if (lookupUid) lookupUser(); }
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

  function refreshChannels() {
    fetch("/api/admin/channel-access")
      .then((r) => r.json())
      .then((d) => setChannels(d.channels ?? []))
      .catch(() => {});
  }

  return (
    <div style={{ marginTop: 40, paddingTop: 32, borderTop: "2px solid #e0e0e0" }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>📡 频道权限管理</h2>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>授权/撤销用户对各频道的访问权限</p>

      {/* 频道总览 */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        {channels.map((c) => (
          <div key={c.slug} style={{ padding: "10px 16px", borderRadius: 8, background: "#f5f5f5", border: "1px solid #ddd", minWidth: 140 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{c.name}</div>
            <div style={{ color: "#888", fontSize: 12 }}>@{c.slug}</div>
            <div style={{ color: "#444", fontSize: 13, marginTop: 4 }}>👥 {c.subscriberCount ?? 0} 人</div>
          </div>
        ))}
      </div>

      {/* 查询用户权限 */}
      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>🔍 查询用户权限（输入 WxPusher UID）</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={lookupUid} onChange={(e) => setLookupUid(e.target.value)} placeholder="UID_xxxxxxxxxxxx"
            style={{ ...inputStyle, flex: 1 }} onKeyDown={(e) => e.key === "Enter" && lookupUser()} />
          <button onClick={lookupUser} disabled={loading} style={btnStyle}>查询</button>
        </div>
        {userChannels && (
          <div style={{ marginTop: 12, padding: "12px 14px", background: "#f9f9f9", borderRadius: 8, border: "1px solid #e0e0e0" }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>UID: {lookupUid}</div>
            {userChannels.length === 0 ? (
              <div style={{ color: "#888", fontSize: 13 }}>无任何频道权限</div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {userChannels.map((c) => (
                  <div key={c.slug} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 20, background: c.hasAccess ? "#c6f6d5" : "#fed7d7", fontSize: 13 }}>
                    {c.hasAccess ? "✅" : "❌"} {c.name}
                    {c.hasAccess && (
                      <button onClick={() => revoke(lookupUid, c.slug)} style={{ background: "none", border: "none", cursor: "pointer", color: "#742a2a", fontWeight: 700, fontSize: 14, padding: "0 2px" }}>×</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 授权表单 */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={labelStyle}>WxPusher UID</label>
          <input value={newUid} onChange={(e) => setNewUid(e.target.value)} placeholder="UID_xxxxxxxxxxxx" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>频道</label>
          <select value={selectedSlug} onChange={(e) => setSelectedSlug(e.target.value)} style={{ ...inputStyle, width: "auto" }}>
            {channels.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
        </div>
        <button onClick={grant} disabled={loading || !newUid.trim()} style={{ ...btnStyle, background: "#276749", marginBottom: 0 }}>
          ✅ 授权
        </button>
      </div>

      {msg && (
        <div style={{ marginTop: 12, padding: "8px 14px", borderRadius: 6, background: msg.startsWith("✅") ? "#c6f6d5" : "#fed7d7", fontSize: 13 }}>
          {msg}
        </div>
      )}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "10px 18px", background: "#1a1a1a", color: "#fff",
  border: "none", borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: "pointer",
};

export function OpsClient() {
  const [secret, setSecret] = useState("");
  const [content, setContent] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [tweetDate, setTweetDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [history, setHistory] = useState<Array<{ snippet: string; result: AnalyzeResult }>>([]);

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
          secret: secret.trim() || undefined
        })
      });

      const data = (await res.json()) as AnalyzeResult;
      setResult(data);

      if (data.ok) {
        setHistory((prev) => [
          { snippet: content.slice(0, 80) + (content.length > 80 ? "…" : ""), result: data },
          ...prev.slice(0, 19)
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

  const statusBadge = (r: AnalyzeResult) => {
    if (r.error) return <span className="badge badge-error">❌ {r.error}</span>;
    if (r.skipped) return <span className="badge badge-skip">⏭ 已存在，跳过推送</span>;
    if (r.pushed) return <span className="badge badge-ok">✅ 已推送到微信</span>;
    return <span className="badge badge-warn">⚠️ 分析完成，推送失败</span>;
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 16px", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
        🔍 Serenity 手动分析
      </h1>
      <p style={{ color: "#666", marginBottom: 24, fontSize: 14 }}>
        粘贴推文内容 → AI 分析 → 推送到微信。相同内容不会重复推送。
      </p>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Secret */}
        <div>
          <label style={labelStyle}>🔑 访问密钥</label>
          <input
            type="password"
            placeholder="CRON_SECRET 的值"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Tweet content */}
        <div>
          <label style={labelStyle}>📝 推文内容 <span style={{ color: "red" }}>*</span></label>
          <textarea
            placeholder="粘贴推文原文（英文）…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            rows={6}
            style={{ ...inputStyle, resize: "vertical", minHeight: 120 }}
          />
        </div>

        {/* Source URL */}
        <div>
          <label style={labelStyle}>🔗 推文链接（选填）</label>
          <input
            type="url"
            placeholder="https://x.com/..."
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Tweet date */}
        <div>
          <label style={labelStyle}>📅 发推时间（选填，历史推文填写）</label>
          <input
            type="datetime-local"
            value={tweetDate}
            onChange={(e) => setTweetDate(e.target.value)}
            style={{ ...inputStyle, width: "auto" }}
          />
        </div>

        <button
          type="submit"
          disabled={loading || !content.trim()}
          style={{
            padding: "12px 24px",
            background: loading ? "#ccc" : "#1a1a1a",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 15,
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            alignSelf: "flex-start"
          }}
        >
          {loading ? "⏳ 分析中…" : "🚀 分析并推送"}
        </button>
      </form>

      {/* Result */}
      {result && (
        <div style={{
          marginTop: 20,
          padding: "16px",
          borderRadius: 8,
          background: result.error ? "#fff0f0" : result.skipped ? "#fffbea" : "#f0fff4",
          border: `1px solid ${result.error ? "#ffcccc" : result.skipped ? "#ffe08a" : "#9ae6b4"}`
        }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>分析结果</div>
          {statusBadge(result)}
          {result.tweetId && (
            <div style={{ marginTop: 8, fontSize: 12, color: "#888" }}>
              tweetId: <code>{result.tweetId}</code>
            </div>
          )}
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
            📜 本次会话记录（{history.length} 条）
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {history.map((item, i) => (
              <div key={i} style={{
                padding: "10px 14px",
                borderRadius: 6,
                background: "#f9f9f9",
                border: "1px solid #e0e0e0",
                fontSize: 13
              }}>
                <div style={{ color: "#333", marginBottom: 4 }}>{item.snippet}</div>
                <div style={{ color: "#888" }}>{statusBadge(item.result)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 13px; font-weight: 500; }
        .badge-ok    { background: #c6f6d5; color: #276749; }
        .badge-skip  { background: #fefcbf; color: #744210; }
        .badge-warn  { background: #feebc8; color: #7b341e; }
        .badge-error { background: #fed7d7; color: #742a2a; }
      `}</style>

      <ChannelAccessManager />
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "#333",
  marginBottom: 4
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 6,
  border: "1px solid #d0d0d0",
  fontSize: 14,
  boxSizing: "border-box",
  outline: "none"
};
