import { Sparkle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Nav() {
  return (
    <header className="sticky top-0 z-20 px-8 py-3">
      <div className="flex justify-between">
        <Link className="flex items-center gap-2" href="/">
          <Sparkle className="rotate-45" />
          <span className="text-lg">Project</span>
        </Link>
        <Link href="/sign-in">
          <Button size="sm" variant="outline">
            Sign In
          </Button>
        </Link>
      </div>
    </header>
  );
}
