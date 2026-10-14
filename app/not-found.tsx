import { Logo } from "@/components/layout/logo";
import { LinkButton } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="conteudo" className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <Logo />
      <h1 className="text-3xl font-extrabold">Página não encontrada</h1>
      <p className="text-ink-muted">O endereço pode estar incorreto, ou você não tem acesso a este conteúdo.</p>
      <LinkButton href="/">Voltar ao início</LinkButton>
    </main>
  );
}
