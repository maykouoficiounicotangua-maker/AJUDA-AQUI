import type { Metadata } from "next";
import { LEGAL_VERSIONS } from "@/lib/legal";

export const metadata: Metadata = { title: "Termos de Uso" };

export default function TermsPage() {
  return (
    <article className="space-y-4 leading-relaxed [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-bold [&_ul]:list-disc [&_ul]:pl-6">
      <h1 className="text-3xl font-extrabold">Termos de Uso</h1>
      <p className="text-sm text-ink-muted">Versão {LEGAL_VERSIONS.terms}. Texto-modelo: revise com assessoria jurídica antes de operar em produção.</p>
      <h2>1. O que é o Ajuda Aqui</h2>
      <p>Plataforma que conecta pessoas que precisam de pequenas ajudas a pessoas dispostas a ajudar. Não somos parte da combinação entre os usuários, nem empregadores, contratantes ou intermediadores de serviços profissionais.</p>
      <h2>2. Cadastro</h2>
      <ul>
        <li>Você deve fornecer informações verdadeiras e manter sua senha em sigilo.</li>
        <li>Uma mesma conta pode pedir e oferecer ajuda.</li>
        <li>Contas podem ser suspensas ou bloqueadas em caso de violação destes termos.</li>
      </ul>
      <h2>3. Condutas proibidas</h2>
      <ul>
        <li>Golpes, assédio, ameaças, discriminação ou qualquer atividade ilegal.</li>
        <li>Publicar informações falsas ou dados pessoais de terceiros.</li>
        <li>Usar a plataforma para spam ou para contornar medidas de segurança.</li>
      </ul>
      <h2>4. Pagamentos</h2>
      <p>Nesta versão a plataforma não processa pagamentos. Valores combinados são acertados diretamente entre as pessoas, sob sua responsabilidade.</p>
      <h2>5. Responsabilidade</h2>
      <p>Cada usuário é responsável por suas decisões e atitudes. Recomendamos seguir as <a className="underline" href="/seguranca">orientações de segurança</a>.</p>
      <h2>6. Alterações</h2>
      <p>Podemos atualizar estes termos. Quando houver nova versão, pediremos um novo aceite.</p>
    </article>
  );
}
