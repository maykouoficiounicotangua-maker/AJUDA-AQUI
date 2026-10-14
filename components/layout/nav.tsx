"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Compass, FileText, HandHeart, Home, MessageCircle, PlusCircle, User } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const items = [
  { href: "/inicio", label: "Início", icon: Home },
  { href: "/explorar", label: "Explorar", icon: Compass },
  { href: "/pedido/novo", label: "Criar pedido", icon: PlusCircle, primary: true },
  { href: "/mensagens", label: "Mensagens", icon: MessageCircle, badgeKey: "messages" as const },
  { href: "/perfil", label: "Perfil", icon: User },
];

function isActive(pathname: string, href: string) {
  if (href === "/pedido/novo") return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

export function BottomNav({ unreadMessages }: { unreadMessages: number }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {items.map(({ href, label, icon: Icon, primary, badgeKey }) => {
          const active = isActive(pathname, href);
          const count = badgeKey === "messages" ? unreadMessages : 0;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-16 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-semibold",
                  active ? "text-brand-700" : "text-ink-muted",
                )}
              >
                {primary ? (
                  <span className="-mt-6 grid size-14 place-items-center rounded-full bg-warm-700 text-white shadow-lg">
                    <Icon className="size-7" aria-hidden />
                  </span>
                ) : (
                  <Icon className={cn("size-6", active && "stroke-[2.5]")} aria-hidden />
                )}
                <span>{label}</span>
                {count > 0 && (
                  <span className="absolute top-1.5 right-1/4 grid min-w-5 place-items-center rounded-full bg-danger-600 px-1 text-[10px] font-bold text-white">
                    <span className="sr-only">{count} não lidas</span>
                    <span aria-hidden>{count > 9 ? "9+" : count}</span>
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function SideNav({ unreadMessages, isAdmin }: { unreadMessages: number; isAdmin: boolean }) {
  const pathname = usePathname();
  const all = [
    ...items,
    { href: "/meus-pedidos", label: "Meus pedidos", icon: FileText },
    { href: "/minhas-ajudas", label: "Minhas ajudas", icon: HandHeart },
    { href: "/notificacoes", label: "Notificações", icon: Bell },
  ];
  return (
    <nav aria-label="Navegação principal" className="flex flex-1 flex-col gap-1">
      {all.map(({ href, label, icon: Icon, primary, ...rest }) => {
        const active = isActive(pathname, href);
        const count = "badgeKey" in rest && rest.badgeKey === "messages" ? unreadMessages : 0;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-12 items-center gap-3 rounded-2xl px-4 font-semibold",
              primary
                ? "mb-2 bg-warm-700 text-white hover:bg-orange-800"
                : active
                  ? "bg-brand-50 text-brand-800"
                  : "text-ink-muted hover:bg-slate-100",
            )}
          >
            <Icon className="size-5" aria-hidden />
            <span className="flex-1">{label}</span>
            {count > 0 && <span className="rounded-full bg-danger-600 px-2 text-xs font-bold text-white">{count}</span>}
          </Link>
        );
      })}
      {isAdmin && (
        <Link
          href="/admin"
          className="mt-auto flex min-h-12 items-center gap-3 rounded-2xl px-4 font-semibold text-ink-muted hover:bg-slate-100"
        >
          Painel administrativo
        </Link>
      )}
    </nav>
  );
}
