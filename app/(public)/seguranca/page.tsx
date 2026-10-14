import type { Metadata } from "next";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { Card, Notice } from "@/components/ui/display";

export const metadata: Metadata = {
  title: "Segurança no Ajuda Aqui",
  description: "Orientações para pedir e oferecer ajuda com segurança.",
};

const tips = [
  ["Não compartilhe senhas", "Nunca informe suas senhas, códigos de verificação ou dados de acesso a ninguém — nem à equipe do Ajuda Aqui."],
  ["Proteja seus dados bancários", "Não publique dados bancários ou cartão em pedidos, propostas ou perfil."],
  ["Documentos só quando necessário", "Evite enviar fotos de documentos. Se for indispensável, compartilhe o mínimo e apenas com quem foi escolhido."],
  ["Confirme a identidade", "Confira o nome e o perfil da pessoa pelo app antes de abrir a porta ou entregar algo."],
  ["Evite locais isolados", "Prefira lugares movimentados e à luz do dia para os primeiros encontros."],
  ["Avise alguém de confiança", "Conte a um familiar ou amigo para onde vai e com quem vai se encontrar."],
  ["Cancele se algo parecer estranho", "Confie na sua intuição. Se o comportamento for suspeito, cancele a ajuda."],
  ["Denuncie situações inadequadas", "Use o botão Denunciar na conversa ou no perfil. Nossa equipe analisa cada caso."],
];

export default function SafetyPage() {
  return (
    <article>
      <h1 className="mb-2 flex items-center gap-3 text-3xl font-extrabold">
        <ShieldCheck className="size-8 text-brand-700" aria-hidden /> Segurança no Ajuda Aqui
      </h1>
      <p className="mb-6 text-lg text-ink-muted">Pequenos cuidados que tornam toda ajuda mais tranquila.</p>
      <ul className="grid gap-3">
        {tips.map(([title, text]) => (
          <li key={title}>
            <Card>
              <h2 className="font-bold">{title}</h2>
              <p className="mt-1 text-ink-muted">{text}</p>
            </Card>
          </li>
        ))}
      </ul>
      <div className="mt-6 space-y-3">
        <Notice tone="warning" title="Importante">
          O Ajuda Aqui conecta pessoas, mas não substitui o seu julgamento pessoal de segurança. Não verificamos a identidade dos usuários
          nesta versão. Em caso de risco imediato, ligue <strong>190</strong> (Polícia) ou <strong>192</strong> (SAMU).
        </Notice>
        <p className="flex items-start gap-2 text-sm text-ink-muted">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          Seu endereço exato nunca é público: ele só é liberado à pessoa escolhida depois que ela confirma a ajuda.
        </p>
      </div>
    </article>
  );
}
