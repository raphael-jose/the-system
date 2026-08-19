#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Envia um Web Push para a inscrição salva do jogador — usado pelo GitHub
// Actions (workflow push-reminders.yml) para disparar lembretes com o app
// FECHADO. Sem servidor externo: o Actions roda no horário e entrega.
//
// Uso:
//   node scripts/send-push.mjs --body "mensagem" [--title "SYSTEM"] [--tag x]
//
// Lê de variáveis de ambiente (secrets do GitHub):
//   VAPID_PUBLIC_KEY   — chave pública VAPID
//   VAPID_PRIVATE_KEY  — chave privada VAPID
//   PUSH_SUBSCRIPTION  — JSON exportado no app (Perfil → Alertas com o app
//                        fechado → Exportar inscrição)
//
// Alternativa local: --subscription-file ./subscription.json + env das chaves.
// ---------------------------------------------------------------------------
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith("--")) {
    const next = process.argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      args[a.slice(2)] = next;
      i += 1;
    } else {
      args[a.slice(2)] = true;
    }
  }
}

const pub = process.env.VAPID_PUBLIC_KEY;
const priv = process.env.VAPID_PRIVATE_KEY;
const subRaw = args["subscription-file"]
  ? await import("node:fs").then((fs) =>
      fs.readFileSync(args["subscription-file"], "utf8")
    )
  : process.env.PUSH_SUBSCRIPTION;

if (!pub || !priv) {
  // Chaves não configuradas — aviso silencioso (exit 0) para não spammar
  // o email do dono com erros do GitHub Actions.
  console.warn(
    "AVISO: faltam VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY no ambiente. " +
      "Configure os secrets no GitHub (Settings → Secrets → Actions). " +
      "Veja PUSH_SETUP.md."
  );
  process.exit(0);
}
if (!subRaw) {
  console.warn(
    "AVISO: falta PUSH_SUBSCRIPTION — nenhuma inscrição de push registrada. " +
      "Ative no app (Perfil → Alertas com o app fechado → Exportar inscrição) " +
      "e adicione o JSON como secret PUSH_SUBSCRIPTION no GitHub."
  );
  process.exit(0);
}

let subscription;
try {
  subscription = JSON.parse(subRaw);
  if (!subscription?.endpoint || !subscription?.keys?.p256dh) {
    throw new Error("inscrição sem endpoint/keys");
  }
} catch (e) {
  console.warn("AVISO: PUSH_SUBSCRIPTION inválido —", e.message);
  process.exit(0);
}

// web-push é devDependency — carregado só aqui (fora do bundle do PWA)
// (módulo CJS: com ESM dinâmico a API sai em .default)
const webpush = (await import("web-push")).default;
webpush.setVapidDetails(
  "mailto:raphael@users.noreply.github.com",
  pub,
  priv
);

const payload = JSON.stringify({
  title: args.title || "SYSTEM",
  body: args.body || "O Sistema observa.",
  tag: args.tag || "system",
});

try {
  const res = await webpush.sendNotification(subscription, payload);
  console.log(`Push enviado (HTTP ${res.statusCode}): ${args.body || ""}`);
} catch (e) {
  const msg = e.message || String(e);
  // 404 = inscrição expirada/revogada, 410 = endpoint eliminado
  // São erros de "assinatura inválida" — o dono precisa reativar o push
  // no app. Sai com 0 para não gerar email de erro no GitHub.
  if (msg.includes("404") || msg.includes("410") || msg.includes("push subscription")) {
    console.warn(
      "AVISO: inscrição de push expirada ou inválida (HTTP " +
        (msg.includes("404") ? "404" : msg.includes("410") ? "410" : "?") +
        "). O usuário precisa reativar o push no app: " +
        "Perfil → Alertas com o app fechado → ativar novamente."
    );
    process.exit(0);
  }
  // Outro erro de rede pode ser temporário — ainda assim sai 0 para
  // evitar spam de email. O push pode falhar vez ou outra por rede.
  console.warn("AVISO: falha ao enviar push —", msg);
  process.exit(0);
}
