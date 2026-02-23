import { Hero } from "@/components/landing-page/hero";
import { Nav } from "@/components/landing-page/nav";

export default function Home() {
  return (
    <main className="relative flex justify-center">
      <div className="relative mx-auto w-full max-w-7xl">
        <Nav />
        <Hero />
      </div>
    </main>
  );
}
