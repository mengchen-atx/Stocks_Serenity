import { redirect } from "next/navigation";

// 首页直接跳转 dashboard（未登录时 dashboard 自动跳登录页）
export default function RootPage() {
  redirect("/dashboard");
}
