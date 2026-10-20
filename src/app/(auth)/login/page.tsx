import { AuthForm } from "@/components/auth/auth-form";
import { isDemoLoginEnabled } from "@/lib/features";

export const metadata = { title: "Masuk" };

export default function LoginPage() {
  return <AuthForm mode="login" demoEnabled={isDemoLoginEnabled()} />;
}
