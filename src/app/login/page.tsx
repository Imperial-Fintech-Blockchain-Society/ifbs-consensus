import { AuthPage } from "@/components/auth-page";
import { currentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
export const metadata = { title: "Log in" };
export default async function Login() {
  if (await currentUser()) redirect("/dashboard");
  return <AuthPage mode="login" />;
}
