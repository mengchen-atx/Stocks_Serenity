import Link from "next/link";

export default async function AuthErrorPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const errorMessage = ERROR_MESSAGES[params.error ?? ""] ?? "登录时发生未知错误。";

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="mb-4 text-4xl">⚠️</div>
        <h2 className="text-2xl font-bold mb-3">登录失败</h2>
        <p className="text-gray-400 text-sm leading-relaxed mb-6">{errorMessage}</p>
        <Link
          href="/auth/signin"
          className="inline-block rounded-lg bg-teal-600 px-6 py-3 text-sm font-semibold text-white hover:bg-teal-500 transition-colors"
        >
          重新登录
        </Link>
      </div>
    </div>
  );
}

const ERROR_MESSAGES: Record<string, string> = {
  Configuration: "服务器配置错误，请联系管理员。",
  AccessDenied: "访问被拒绝。",
  Verification: "验证链接已过期或已使用，请重新发送。",
  Default: "发生了未知错误，请重试。"
};
