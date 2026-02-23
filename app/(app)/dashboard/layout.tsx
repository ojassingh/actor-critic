import { redirect } from "next/navigation";
import { ThemeProvider } from "@/components/theme-provider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { api } from "@/convex/_generated/api";
import { fetchAuthQuery, isAuthenticated } from "@/lib/auth-server";
import { AppSidebar } from "./components/app-sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    redirect("/sign-in");
  }

  const user = await fetchAuthQuery(api.auth.getCurrentUser);

  if (!user) {
    redirect("/sign-in");
  }

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      disableTransitionOnChange
      enableSystem
    >
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <div className="mx-auto w-full">{children}</div>
        </SidebarInset>
      </SidebarProvider>
      <Toaster />
    </ThemeProvider>
  );
}
