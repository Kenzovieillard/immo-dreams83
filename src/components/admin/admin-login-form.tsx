"use client";

import { useState } from "react";
import { KeyRound, LogIn } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AdminLoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; message: string } | null>(null);

  async function submitLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setFeedback(null);

    const response = await fetch("/api/admin/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }).catch(() => null);
    const payload = response
      ? ((await response.json().catch(() => null)) as { message?: string; redirectTo?: string } | null)
      : null;

    setLoading(false);

    if (!response?.ok) {
      setFeedback({
        type: "error",
        message: payload?.message ?? "Connexion impossible pour le moment.",
      });
      return;
    }

    setFeedback({ type: "success", message: payload?.message ?? "Connexion réussie." });
    window.location.assign(payload?.redirectTo ?? "/admin");
  }

  return (
    <main className="crm-riviera flex min-h-dvh items-center justify-center bg-[#fbf9f4] px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-5 border-l-4 border-orange-500 pl-4">
          <p className="text-xs font-bold uppercase text-orange-700">IMMO DREAMS · Riviera</p>
          <p className="mt-1 text-sm text-gray-600">Espace réservé à l&apos;équipe de l&apos;agence.</p>
        </div>
        <Card className="w-full rounded-lg border-[#e8e3da] bg-white text-[#111111] shadow-[0_18px_50px_rgb(17_17_17/0.1)]">
          <CardHeader className="gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-[#111111] text-white">
                <KeyRound className="size-5" />
              </div>
              <Badge className="w-fit border-0 bg-[#fff1df] text-orange-800">Accès sécurisé</Badge>
            </div>
            <CardTitle className="text-2xl font-black">Cockpit commercial</CardTitle>
            <p className="text-sm leading-6 text-gray-600">
              Connectez-vous avec un compte autorisé IMMO-DREAMS83.
            </p>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={submitLogin}>
              <div className="grid gap-2">
                <Label htmlFor="admin-email">Email</Label>
                <Input
                  id="admin-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="bg-white text-gray-900 placeholder:text-gray-400"
                  placeholder="prenom@immo-dreams83.fr"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="admin-password">Mot de passe</Label>
                <Input
                  id="admin-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="bg-white text-gray-900 placeholder:text-gray-400"
                  placeholder="Mot de passe Supabase Auth"
                  required
                />
              </div>
              {feedback ? (
                <p
                  className={
                    feedback.type === "success"
                      ? "rounded-md bg-emerald-50 p-3 text-sm font-semibold text-emerald-800"
                      : "rounded-md bg-red-50 p-3 text-sm font-semibold text-red-700"
                  }
                  aria-live="polite"
                >
                  {feedback.message}
                </p>
              ) : null}
              <Button type="submit" disabled={loading} className="h-12 bg-orange-500 font-bold text-white hover:bg-orange-600">
                <LogIn className="size-4" />
                {loading ? "Connexion..." : "Se connecter"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
