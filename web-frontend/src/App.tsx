import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster, toast } from "sonner";
import { Button } from "@/components/ui/button";
import { queryClient } from "@/lib/query-client";
import { useAuthStore } from "@/store/auth-store";

// Placeholder tạm cho W1 — xác nhận Tailwind tokens/shadcn/Zustand/TanStack Query
// đều wire đúng. Routing/layout thật (3 cột, auth guard) làm ở W3-W4.
function SetupCheckPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
      <h1 className="text-2xl font-semibold text-primary">Zahuu Web — W1 project setup</h1>
      <p className="text-muted-foreground">isAuthenticated: {String(isAuthenticated)}</p>
      <Button onClick={() => toast("Hello từ sonner")}>Test button (shadcn + sonner)</Button>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<SetupCheckPage />} />
        </Routes>
      </BrowserRouter>
      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  );
}

export default App;
