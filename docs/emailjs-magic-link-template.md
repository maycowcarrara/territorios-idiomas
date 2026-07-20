# Template EmailJS para link mágico

Use este HTML no template do EmailJS. Ele espera as variáveis enviadas pelo app:

- `to_email`
- `app_name`
- `app_subtitle`
- `app_icon_url`
- `app_url`
- `subject`
- `intro_text`
- `button_label`
- `hint_text`
- `footer_text`
- `magic_link`

Assunto sugerido no EmailJS:

```text
{{subject}}
```

Destino sugerido no EmailJS:

```text
{{to_email}}
```

HTML sugerido:

```html
<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">{{subject}} está pronto.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;">
            <tr>
              <td style="padding:0 0 16px 0;text-align:center;color:#64748b;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">
                Acesso seguro
              </td>
            </tr>
            <tr>
              <td style="background:linear-gradient(135deg,#0f172a 0%,#1e3a8a 100%);border-radius:28px 28px 0 0;padding:28px 28px 24px;text-align:center;">
                <img
                  src="{{app_icon_url}}"
                  alt="Logo {{app_name}}"
                  width="72"
                  height="72"
                  style="display:block;margin:0 auto 16px;border-radius:20px;background:#ffffff;padding:6px;box-shadow:0 10px 25px rgba(15,23,42,0.25);"
                />
                <h1 style="margin:0;color:#ffffff;font-size:28px;line-height:34px;">{{app_name}}</h1>
                <p style="margin:8px 0 0;color:#cbd5e1;font-size:14px;line-height:20px;">{{app_subtitle}}</p>
              </td>
            </tr>
            <tr>
              <td style="background:#ffffff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 28px 28px;padding:32px 28px;">
                <p style="margin:0 0 16px;font-size:16px;line-height:26px;color:#334155;">Olá,</p>
                <p style="margin:0 0 18px;font-size:16px;line-height:26px;color:#334155;">
                  <strong style="color:#2563eb;">{{intro_text}}</strong>
                </p>
                <div style="margin:0 0 22px;padding:18px 18px 18px 20px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:18px;">
                  <p style="margin:0;font-size:14px;line-height:22px;color:#1e3a8a;">
                    {{hint_text}}
                  </p>
                </div>
                <div style="text-align:center;margin:0 0 22px;">
                  <a
                    href="{{magic_link}}"
                    style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;line-height:20px;padding:14px 22px;border-radius:14px;box-shadow:0 10px 24px rgba(15,23,42,0.18);"
                  >
                    {{button_label}}
                  </a>
                </div>
                <p style="margin:0 0 12px;font-size:14px;line-height:22px;color:#475569;">
                  Se o botão não abrir, copie e cole este link no navegador:
                </p>
                <div style="margin:0 0 24px;padding:14px 16px;border:1px dashed #cbd5e1;border-radius:14px;background:#f8fafc;word-break:break-all;">
                  <a href="{{magic_link}}" style="color:#2563eb;text-decoration:none;font-size:13px;line-height:22px;">{{magic_link}}</a>
                </div>
                <p style="margin:0 0 10px;font-size:13px;line-height:21px;color:#64748b;">
                  Se você não pediu esse acesso, pode ignorar esta mensagem.
                </p>
                <p style="margin:0 0 20px;font-size:13px;line-height:21px;color:#64748b;">
                  {{footer_text}}
                </p>
                <div style="padding-top:18px;border-top:1px solid #e2e8f0;text-align:center;">
                  <p style="margin:0 0 6px;font-size:12px;line-height:18px;color:#94a3b8;">Abrir no navegador</p>
                  <a href="{{app_url}}" style="color:#2563eb;text-decoration:none;font-size:12px;line-height:18px;">{{app_url}}</a>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```
