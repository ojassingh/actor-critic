import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Markdown } from "@/components/ui/ai/markdown";

const HERO_MARKDOWN_PATH = "content/hero.md";

export async function Hero() {
  const markdown = await readFile(
    join(process.cwd(), HERO_MARKDOWN_PATH),
    "utf8"
  );

  return (
    <section className="mx-auto max-w-2xl px-6 py-16">
      <Markdown className="prose prose-slate max-w-none prose-h1:font-medium prose-h2:font-medium prose-h3:font-medium prose-strong:font-medium prose-h1:tracking-tight prose-h2:tracking-tight prose-h3:tracking-tight">
        {markdown}
      </Markdown>
    </section>
  );
}
