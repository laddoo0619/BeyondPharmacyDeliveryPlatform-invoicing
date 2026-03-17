"use server";

import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";

export async function login(email: string, password: string) {
  try {
    await signIn("credentials", { email, password, redirectTo: "/" });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid email or password" };
    }
    // Successful login throws a NEXT_REDIRECT — re-throw it
    throw error;
  }
}
