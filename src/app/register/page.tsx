import { AuthPage } from "@/components/auth-page";
import { currentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
export const metadata = { title: "Join the fund" };
export default async function Register() {
  if (await currentUser()) redirect("/dashboard");
  return <AuthPage mode="register" />;
}
