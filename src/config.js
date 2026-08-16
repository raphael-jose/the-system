// ---------------------------------------------------------------------------
// Web Push — notificações com o app FECHADO.
//
// Para ativar (uma vez só):
//   1) Gere o par de chaves:
//        npx web-push generate-vapid-keys
//   2) Cole a CHAVE PÚBLICA (application server key) na constante abaixo.
//   3) Siga o PUSH_SETUP.md para guardar as chaves e a inscrição nos
//      secrets do GitHub — o workflow push-reminders.yml dispara os
//      lembretes no horário, mesmo com o app fechado.
//
// Enquanto estiver vazia, o app mostra "configurar" no Perfil, sem quebrar
// as notificações de app-aberto (que continuam funcionando normalmente).
// ---------------------------------------------------------------------------
export const VAPID_PUBLIC_KEY = "";
