import { Suspense } from "react";
import { SignInForm } from "@/components/SignInForm";

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0a0f1a] text-white flex items-center justify-center">
          <p className="text-gray-400">加载中...</p>
        </div>
      }
    >
      <SignInForm />
    </Suspense>
  );
}
