import { Logo } from "@/components/layout/logo";
import { Notice } from "@/components/ui/display";
import { isSupabaseConfigured } from "@/lib/env";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main id="conteudo" className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-8">
      <div className="mb-6 flex justify-center">
        <Logo tagline />
      </div>
      {!isSupabaseConfigured() && (
        <div className="mb-4">
          <Notice tone="warning" title="Ambiente sem Supabase">
            Copie <code>.env.example</code> para <code>.env.local</code> e preencha as chaves do Supabase para ativar login e cadastro.
          </Notice>
        </div>
      )}
      <div className="rounded-[var(--radius-card)] border border-line bg-white p-6 shadow-sm">{children}</div>
    </main>
  );
}
