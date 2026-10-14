import Link from "next/link";
import { LogOut, Settings, ShieldAlert } from "lucide-react";
import { Avatar, Notice } from "@/components/ui/display";
import { Logo } from "@/components/layout/logo";
import { BottomNav, SideNav } from "@/components/layout/nav";
import { NotificationBell } from "@/components/notifications/realtime-notifications";
import { signOutAction } from "@/app/actions/auth";
import { isAdminProfile } from "@/lib/auth/session";
import type { Profile } from "@/types";

export function AppShell({
  profile,
  unreadNotifications,
  unreadMessages,
  children,
}: {
  profile: Profile;
  unreadNotifications: number;
  unreadMessages: number;
  children: React.ReactNode;
}) {
  const admin = isAdminProfile(profile);
  return (
    <div className="flex min-h-full flex-1">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-4 border-r border-line bg-white p-4 lg:flex">
        <Logo href="/inicio" />
        <SideNav unreadMessages={unreadMessages} isAdmin={admin} />
        <div className="border-t border-line pt-3">
          <Link href="/configuracoes" className="flex min-h-11 items-center gap-3 rounded-xl px-3 font-semibold text-ink-muted hover:bg-slate-100">
            <Settings className="size-5" aria-hidden /> Configurações
          </Link>
          <form action={signOutAction}>
            <button type="submit" className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 font-semibold text-ink-muted hover:bg-slate-100">
              <LogOut className="size-5" aria-hidden /> Sair
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-white/90 px-4 py-2 backdrop-blur lg:justify-end">
          <div className="lg:hidden"><Logo href="/inicio" /></div>
          <div className="flex items-center gap-1">
            <NotificationBell userId={profile.id} initialUnread={unreadNotifications} />
            <Link href="/perfil" aria-label="Meu perfil" className="rounded-full">
              <Avatar name={profile.full_name} src={profile.avatar_url} size={40} />
            </Link>
            <Link href="/configuracoes" aria-label="Configurações" className="grid size-11 place-items-center rounded-full text-ink-muted hover:bg-slate-100 lg:hidden">
              <Settings className="size-6" aria-hidden />
            </Link>
          </div>
        </header>

        <main id="conteudo" className="pb-nav mx-auto w-full max-w-5xl flex-1 px-4 py-6">
          {profile.status !== "ACTIVE" && (
            <div className="mb-5">
              <Notice tone="danger" title="Sua conta está com restrições">
                <span className="inline-flex items-center gap-2">
                  <ShieldAlert className="size-4" aria-hidden />
                  Você não pode publicar pedidos, enviar propostas ou mensagens. Se acha que houve engano, fale com o suporte.
                </span>
              </Notice>
            </div>
          )}
          {children}
        </main>
      </div>
      <BottomNav unreadMessages={unreadMessages} />
    </div>
  );
}
