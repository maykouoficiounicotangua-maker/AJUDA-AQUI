import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { LinkButton } from "@/components/ui/button";
import { VisitorBottomNav } from "@/components/layout/nav";

/** Shell para quem ainda não entrou: navega livremente; login só quando for agir. */
export function VisitorShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2">
          <Logo />
          <nav aria-label="Principal" className="hidden items-center gap-1 md:flex">
            <Link href="/explorar" className="rounded-xl px-3 py-2 font-semibold text-ink-muted hover:bg-slate-100">Ver pedidos</Link>
            <Link href="/pedido/novo" className="rounded-xl px-3 py-2 font-semibold text-ink-muted hover:bg-slate-100">Pedir ajuda</Link>
            <Link href="/#como-funciona" className="rounded-xl px-3 py-2 font-semibold text-ink-muted hover:bg-slate-100">Como funciona</Link>
          </nav>
          <div className="flex items-center gap-2">
            {/* no celular "Entrar" já está na barra inferior */}
            <LinkButton href="/entrar" variant="ghost" size="sm" className="hidden whitespace-nowrap sm:inline-flex">Entrar</LinkButton>
            <LinkButton href="/cadastrar" size="sm" className="whitespace-nowrap">Criar conta</LinkButton>
          </div>
        </div>
      </header>
      <main id="conteudo" className="pb-nav mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
      <VisitorBottomNav />
    </div>
  );
}
