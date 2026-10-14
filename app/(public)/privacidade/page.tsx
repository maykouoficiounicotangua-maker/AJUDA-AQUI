import type { Metadata } from "next";
import { LEGAL_VERSIONS, SUPPORT_EMAIL } from "@/lib/legal";

export const metadata: Metadata = { title: "Política de Privacidade" };

export default function PrivacyPage() {
  return (
    <article className="space-y-4 leading-relaxed [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-bold [&_ul]:list-disc [&_ul]:pl-6">
      <h1 className="text-3xl font-extrabold">Política de Privacidade</h1>
      <p className="text-sm text-ink-muted">Versão {LEGAL_VERSIONS.privacy}. Texto-modelo (LGPD): revise com assessoria jurídica antes de operar em produção.</p>
      <h2>Dados que coletamos</h2>
      <ul>
        <li>Cadastro: nome, e-mail, telefone, cidade e região.</li>
        <li>Uso: pedidos, propostas, mensagens, avaliações e notificações.</li>
        <li>Técnicos: dados do navegador necessários para notificações push, quando você as ativa.</li>
      </ul>
      <h2>Como protegemos sua localização</h2>
      <p>Seu endereço e coordenadas exatas nunca são públicos. Outras pessoas veem apenas cidade, região e distância aproximada. O endereço é liberado somente ao ajudante escolhido, depois que ele confirma a ajuda.</p>
      <h2>Telefone</h2>
      <p>Seu telefone só é visível para a pessoa com quem você tem uma ajuda em andamento.</p>
      <h2>Seus direitos</h2>
      <p>Você pode acessar, corrigir e solicitar a exclusão dos seus dados, além de ajustar a privacidade do perfil nas Configurações. Escreva para <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>
      <h2>Compartilhamento</h2>
      <p>Não vendemos seus dados. Usamos provedores de infraestrutura (hospedagem e banco de dados) estritamente para operar a plataforma.</p>
    </article>
  );
}
