"use client";

import { Loader } from "lucide-react";
import { useState } from "react";
import { GitHubIcon, GoogleIcon } from "@/app/(auth)/components/auth-icons";
import { Button } from "@/components/ui/button";
import { signIn } from "@/lib/auth-client";

export function AuthButton({
  provider,
  children,
}: {
  provider: "google" | "github";
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(false);
  return (
    <Button
      className="w-full"
      onClick={() => {
        setLoading(true);
        signIn.social({ provider, callbackURL: "/dashboard" });
      }}
      variant="outline"
    >
      {loading ? <Loader className="size-4 animate-spin" /> : null}
      {provider === "google" ? <GoogleIcon /> : <GitHubIcon />}
      {children}
    </Button>
  );
}
