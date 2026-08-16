// ---------------------------------------------------------------------------
// Web Push — notificações com o app FECHADO.
//
// Chave VAPID PÚBLICA (application server key) — é segura para ficar aqui,
// ela vai embutida no app e é pública por design.
//
// A PRIVADA NÃO pode ser commitada: ela vive apenas no secret
// VAPID_PRIVATE_KEY do GitHub (Settings → Secrets and variables → Actions),
// junto com VAPID_PUBLIC_KEY e PUSH_SUBSCRIPTION — veja PUSH_SETUP.md.
// ---------------------------------------------------------------------------
export const VAPID_PUBLIC_KEY =
  "BP8YzdwZQtYWaj4i0JLINZdo7COeyUgc3x18YK2fb3_-NfrY1wBLreXW0RHlWpx8s-nOhuNHc6Siwgn-Nv4dkzM";
