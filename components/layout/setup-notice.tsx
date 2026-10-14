import { Logo } from "@/components/layout/logo";
import { Notice } from "@/components/ui/display";

/** Exibido quando o Supabase ainda não foi configurado (evita telas quebradas em dev). */
export function SetupNotice() {
  return (
    <main id="conteudo" className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-4 px-4 py-10">
      <Logo />
      <Notice tone="warning" title="Falta configurar o Supabase">
        <ol className="list-decimal space-y-1 pl-5">
          <li>Crie um projeto em supabase.com (ou rode <code>supabase start</code>).</li>
          <li>Aplique as migrations de <code>supabase/migrations</code>.</li>
          <li>Copie <code>.env.example</code> para <code>.env.local</code> e preencha URL e chaves.</li>
          <li>Reinicie <code>npm run dev</code>.</li>
        </ol>
      </Notice>
    </main>
  );
}
