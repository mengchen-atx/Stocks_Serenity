import { redirect } from "next/navigation";

// NextAuth /auth/signin 不再使用，统一跳转到 WxPusher UID 登录
export default function SignInPage() {
  redirect("/auth/wxpusher");
}
