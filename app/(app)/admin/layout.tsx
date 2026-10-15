import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: { default: "Administração", template: "%s · Admin" }, robots: { index: false, follow: false } };

const links = [
  { href: "/admin", label: "Painel" },
  { href: "/admin/usuarios", label: "Usuários" },
  { href: "/admin/pedidos", label: "Pedidos" },
  { href: "/admin/denuncias", label: "Denúncias" },
  { href: "/admin/disputas", label: "Disputas" },
  { href: "/admin/categorias", label: "Categorias" },
  { href: "/admin/auditoria", label: "Auditoria" },
];

/** Qualquer rota /admin responde 404 para quem não é admin. As RPCs/RLS são a defesa real. */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();
  return (
    <div className="space-y-5">
      <nav aria-label="Administração" className="-mx-4 flex gap-2 overflow-x-auto px-4">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-line bg-white px-4 text-sm font-semibold hover:bg-slate-50">
            {l.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
