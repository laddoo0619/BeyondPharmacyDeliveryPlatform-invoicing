"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Circles from "@/components/ui/Circles";
import logo from "@/assets/beyond-pharmacy-logo.png";
import { cn, ctaShadow, input, label, primaryButtonFull } from "@/lib/portalStyles";
import { BANNER_CLASSES } from "@/lib/statusTheme";
import { login } from "./actions";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    startTransition(async () => {
      const result = await login(email, password);
      if (result?.error) {
        setError(result.error);
      }
    });
  };

  return (
    <div className="circle-host min-h-screen overflow-x-clip flex items-center justify-center bg-white">
      <Circles variant="hero" />
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-card border border-hairline shadow-lift">
        <div className="text-center">
          <h1 className="drop-in">
            <Image src={logo} alt="Beyond Pharmacy" priority className="mx-auto h-8 w-auto" />
          </h1>
          <p className="drop-in drop-in--2 mt-3 text-sm font-medium text-ink">
            Delivery Platform
          </p>
        </div>

        <form onSubmit={handleSubmit} className="drop-in drop-in--3 mt-8 space-y-6">
          {error && (
            <div className={cn("px-4 py-3 rounded-row text-sm", BANNER_CLASSES.error)}>
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className={label}>
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={cn(input, "mt-1 block")}
                placeholder="you@pharmacy.com"
              />
            </div>

            <div>
              <label htmlFor="password" className={label}>
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={cn(input, "mt-1 block")}
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className={cn(primaryButtonFull, ctaShadow)}
          >
            {isPending ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
