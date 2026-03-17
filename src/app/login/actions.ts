"use server";

import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";

export async function login(email: string, password: string) {
  try {
    await signIn("credentials", { email, password, redirectTo: "/" });
  } catch (error) {
    if (error instanceof AuthError) {
      // Log the actual error type for debugging
      console.error("Auth error:", error.type, error.message);
      if (error.type === "CredentialsSignin") {
        return { error: "Invalid email or password" };
      }
      return { error: `Authentication error: ${error.type}` };
    }
    // Successful login throws a NEXT_REDIRECT — re-throw it
    throw error;
  }
}
