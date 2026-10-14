# Workflows

## Publicar pedido
`createDraft` → `publish_request` (valida data futura, categoria ativa, usuário ACTIVE; status OPEN; rate limit) → notificação "novo pedido compatível" para ajudantes compatíveis (matching) .

## Proposta
`INSERT help_request_offers` (UNIQUE request_id+helper_id; bloqueios impedem) → notifica solicitante.

## Aceitar ajudante (`accept_offer` RPC, atômica)
Trava o pedido (`FOR UPDATE`), confere dono e status OPEN, aceita a proposta, rejeita as demais, `selected_helper_id`, status ASSIGNED→AWAITING_CONFIRMATION, cria conversa + participantes + mensagem SYSTEM, notifica todos os envolvidos.

## Confirmação / Conclusão
`confirm_start` (cada parte confirma; ambas → IN_PROGRESS). `mark_done` (ambas → COMPLETED). `report_problem` → DISPUTED + registro de disputa.

## Avaliação / Reputação
Só participantes de pedido COMPLETED; uma por avaliador/pedido. Reputação calculada em `lib/reputation` e view `profile_stats`.

## Bloqueio / Denúncia / Admin
Bloqueio impede mensagens e propostas (RLS + função). Denúncia notifica admins. Toda ação admin grava `audit_logs`.
