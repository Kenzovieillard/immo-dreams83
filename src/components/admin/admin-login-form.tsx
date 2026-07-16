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
    <main className="flex min-h-dvh items-center justify-center bg-[#111111] px-4 py-12">
      <Card className="w-full max-w-md border-white/10 bg-white text-[#111111] shadow-2xl">
        <CardHeader className="gap-3">
          <Badge className="w-fit border-0 bg-orange-100 text-orange-800">Accès sécurisé V3</Badge>
          <KeyRound className="size-9 text-orange-600" />
          <CardTitle className="text-2xl font-black">Connexion CRM</CardTitle>
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
              >
                {feedback.message}
              </p>
            ) : null}
            <Button disabled={loading} className="h-11 bg-orange-500 text-white hover:bg-orange-600">
              <LogIn className="size-4" />
              {loading ? "Connexion..." : "Se connecter"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
