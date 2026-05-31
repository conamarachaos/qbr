import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthError } from "@auth/core/errors";

import { signIn } from "@/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

async function loginAction(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const callbackUrl = String(formData.get("callbackUrl") ?? "/");

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: callbackUrl || "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      const message = encodeURIComponent("Invalid email or password.");
      const next = encodeURIComponent(callbackUrl || "/");
      redirect(`/login?error=${message}&callbackUrl=${next}`);
    }
    throw error;
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const error = Array.isArray(resolvedSearchParams.error)
    ? resolvedSearchParams.error[0]
    : resolvedSearchParams.error;
  const callbackUrl = Array.isArray(resolvedSearchParams.callbackUrl)
    ? resolvedSearchParams.callbackUrl[0]
    : resolvedSearchParams.callbackUrl;

  return (
    <Card className="border-primary/15 bg-card/95 backdrop-blur">
      <CardHeader className="space-y-4">
        <Badge className="w-fit rounded-full px-3 py-1 text-xs uppercase tracking-[0.18em]">
          Product login
        </Badge>
        <div className="space-y-2">
          <CardTitle className="font-display text-3xl">Sign in to QBR Agent</CardTitle>
          <CardDescription>
            Use the seeded demo users or your own registered workspace account.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form action={loginAction} className="space-y-4">
          <input type="hidden" name="callbackUrl" value={callbackUrl || "/"} />
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" defaultValue="am@demo" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" defaultValue="demo1234" required />
          </div>
          {error ? (
            <p className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="w-full">
            Sign in
          </Button>
        </form>
        <p className="mt-6 text-sm text-muted-foreground">
          Need a new workspace?{" "}
          <Link href="/register" className="font-medium text-primary underline-offset-4 hover:underline">
            Register
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
