import { Logo } from "@/components/layout/logo";
import { LinkButton } from "@/components/ui/button";

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-4">
        <Logo />
        <LinkButton href="/entrar" variant="ghost" size="sm">Entrar</LinkButton>
      </header>
      <main id="conteudo" className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16">{children}</main>
    </>
  );
}
