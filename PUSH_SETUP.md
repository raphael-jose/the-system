# Alertas com o app fechado (Web Push)

O navegador **não permite** agendar notificação local quando o app está
fechado — por isso o SYSTEM usa **Web Push**: o celular recebe a mensagem
via serviço de push e o service worker mostra a notificação mesmo com o app
morto. O "servidor" que dispara no horário é o **GitHub Actions** do próprio
repositório (gratuito, sem backend externo).

Ativação única (~5 minutos):

1. **Gere o par de chaves** (uma vez):

   ```bash
   npx web-push generate-vapid-keys
   ```

2. **Cole a chave pública** em `src/config.js` (constante `VAPID_PUBLIC_KEY`)
   e publique o app (push na `main` → deploy automático no Pages).

3. **No celular**: abra o app → Perfil → **Alertas com o app fechado** →
   ative o interruptor (o navegador pede permissão) → **Exportar inscrição**
   e copie o JSON gerado.

4. **Guarde os secrets no GitHub** (Settings → Secrets and variables →
   Actions → New repository secret):

   | Secret               | Valor                                    |
   |----------------------|------------------------------------------|
   | `VAPID_PUBLIC_KEY`   | chave pública gerada no passo 1          |
   | `VAPID_PRIVATE_KEY`  | chave privada gerada no passo 1          |
   | `PUSH_SUBSCRIPTION`  | JSON exportado no passo 3                |

5. **Pronto** — o workflow `push-reminders.yml` roda sozinho nos horários
   configurados (12:00 e 20:00 no fuso do Brasil; ajuste os `cron` no
   arquivo se quiser outros horários — lembrando que o cron roda em UTC).

## Observações

- **Aviso**: o push só chega com o aparelho online (o serviço de push usa a
  rede). Com o app **aberto**, os lembretes continuam funcionando offline e
  personalizados (resumo do meio-dia com seu progresso real).
- **Se reinstalar o app / trocar de celular**: a inscrição muda — repita o
  passo 3 e atualize o secret `PUSH_SUBSCRIPTION`.
- **iPhone**: Web Push funciona a partir do iOS 16.4, com o app adicionado à
  tela inicial (Adicionar à tela inicial → abrir → ativar o push).
- **Teste manual** do envio (no seu computador):
  ```bash
  node scripts/send-push.mjs --subscription-file ./subscription.json --body "Teste do Sistema"
  ```
  com `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY` definidas no ambiente.
