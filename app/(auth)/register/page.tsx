import bcrypt from "bcryptjs";
import Link from "next/link";
import { redirect } from "next/navigation";

import { signIn } from "@/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { prisma } from "@/lib/db";

async function registerAction(formData: FormData) {
  "use server";

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password || password.length < 8) {
    redirect("/register?error=Provide%20a%20name,%20email,%20and%20an%208%2B%20character%20password.");
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existing) {
    redirect("/register?error=That%20email%20is%20already%20registered.");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const workspace = await prisma.workspace.create({
    data: {
      name: `${name || email} Workspace`,
    },
  });

  const user = await prisma.user.create({
    data: {
      email,
      name: name || email,
      passwordHash,
      memberships: {
        create: {
          workspaceId: workspace.id,
          role: "admin",
        },
      },
    },
  });

  await signIn("credentials", {
    email: user.email,
    password,
    redirectTo: "/",
  });
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const error = Array.isArray(resolvedSearchParams.error)
    ? resolvedSearchParams.error[0]
    : resolvedSearchParams.error;

  return (
    <Card className="border-primary/15 bg-card/95 backdrop-blur">
      <CardHeader className="space-y-4">
        <Badge className="w-fit rounded-full px-3 py-1 text-xs uppercase tracking-[0.18em]">
          New workspace
        </Badge>
        <div className="space-y-2">
          <CardTitle className="font-display text-3xl">Register QBR Agent</CardTitle>
          <CardDescription>
            Create a tenant-scoped workspace with admin access and credentials login.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form action={registerAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" minLength={8} required />
          </div>
          {error ? (
            <p className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="w-full">
            Create workspace
          </Button>
        </form>
        <p className="mt-6 text-sm text-muted-foreground">
          Already registered?{" "}
          <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
