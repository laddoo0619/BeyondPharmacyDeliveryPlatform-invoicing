import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth();

  if (session?.user) {
    if (session.user.role === "DRIVER") {
      redirect("/deliveries");
    }
    redirect("/dashboard");
  }

  redirect("/login");
}
