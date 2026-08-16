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
  console.error(
    "ERRO: faltam VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY no ambiente (secrets do GitHub)."
  );
  process.exit(1);
}
if (!subRaw) {
  console.error(
    "ERRO: falta PUSH_SUBSCRIPTION (ou --subscription-file) com o JSON exportado no app."
  );
  process.exit(1);
}

let subscription;
try {
  subscription = JSON.parse(subRaw);
  if (!subscription?.endpoint || !subscription?.keys?.p256dh) {
    throw new Error("inscrição sem endpoint/keys");
  }
} catch (e) {
  console.error("ERRO: PUSH_SUBSCRIPTION inválido —", e.message);
  process.exit(1);
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
  console.error("Falha ao enviar:", e.message);
  process.exit(1);
}
