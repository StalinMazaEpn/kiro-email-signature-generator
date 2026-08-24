# Desarrollo Local

## Requisitos previos

- **Node.js 20+** (mínimo 18)
- **npm**

No necesitas: cuenta AWS, credenciales cloud, Docker, ni ningún servicio externo para desarrollo básico.

## Setup

```powershell
# Clonar el repositorio
git clone <repo-url>
cd HackatonKiro

# Instalar dependencias del backend
cd lambda
npm install

# Configurar entorno
cd ..
Copy-Item .env.example .env
```

Edita `.env` si quieres habilitar IA real o image-tools (ver sección abajo).

## Arrancar el servidor

```powershell
cd lambda
npm run dev
```

Resultado:

```
🚀 Email Signature Generator - Dev Server
   Mode:         local
   AI Provider:  azure
   Port:         3005

   Frontend:     http://localhost:3005/
   API Base:     http://localhost:3005/
   Health:       http://localhost:3005/health
   Storage:      http://localhost:3005/storage/
```

El servidor Express:
- Expone los mismos endpoints que Lambda + API Gateway
- Sirve el frontend en la raíz `/`
- Sirve imágenes generadas en `/storage/`
- Acepta bodies de hasta 15MB (para imágenes base64)

## Qué funciona sin configuración extra

| Feature | Estado | Notas |
|---------|--------|-------|
| Frontend completo | ✅ | Formulario, preview, generación, copiar HTML |
| Preview de firma | ✅ | Muestra imagen seleccionada como data URL |
| Generación completa | ✅ | Imagen se guarda en `lambda/local-storage/` |
| Listar plantillas | ✅ | 3 plantillas con metadata |
| Variables de plantilla | ✅ | Endpoint por template |
| Extracción IA (mock) | ✅ | Usa regex básico — funciona sin credenciales |
| Panel admin | ✅ | Login + validador de templates |
| Datos de ejemplo | ✅ | Botón para prueba rápida |
| Recorte con Cropper.js | ✅ | Foto de perfil + fondo personalizado |
| Extracción IA (real) | ⚠️ | Necesita credenciales Azure OpenAI en .env |
| Image-tools (real) | ⚠️ | Necesita servicio externo corriendo + `IMAGE_TOOLS_URL` |

## Configurar IA real en local

### Opción A: Azure OpenAI

Agrega estas variables al `.env`:

```env
AI_PROVIDER=azure
AZURE_OPENAI_ENDPOINT=https://tu-recurso.openai.azure.com
AZURE_OPENAI_KEY=tu-api-key-aqui
AZURE_OPENAI_DEPLOYMENT=gpt-5.2         # el deployment (o modelo) real
AZURE_OPENAI_API_STYLE=auto             # auto | legacy | openai
AZURE_OPENAI_API_VERSION=2024-10-21     # versión que soporte tu región/modelo
AZURE_OPENAI_API_TYPE=chat              # chat | responses
```

El valor de `AZURE_OPENAI_ENDPOINT` depende del formato de tu recurso:

- **Antiguo (por recurso):** `https://<nombre>.openai.azure.com` → normalmente `apiType=chat` (estilo `legacy`).
- **Nuevo (AI Services):** `https://<nombre>.services.ai.azure.com/openai/v1` → sirve Chat Completions (`apiType=chat`) o la **Responses API con streaming** (`apiType=responses`).

> `AZURE_OPENAI_API_TYPE=responses` solo funciona con el endpoint nuevo (termina en `/openai/v1`). Con `apiStyle=auto` el código detecta el formato según el sufijo del endpoint.

Con esto, `POST /extract-fields` usará IA real para extraer campos del texto libre.

### Opción B: AWS Bedrock

Para usar Amazon Bedrock en su lugar:

```env
AI_PROVIDER=bedrock
BEDROCK_MODEL_ID=anthropic.claude-3-haiku-20240307-v1:0
BEDROCK_REGION=us-east-1
```

> Bedrock usa las credenciales/roles de AWS (`aws configure` o IAM); no requiere API key propia en `.env`.

## Configurar image-tools en local

Si tienes el servicio image-tools corriendo (composición de persona sobre fondo):

```env
IMAGE_TOOLS_URL=http://localhost:3006/api/v1/image/image-process
IMAGE_TOOLS_API_KEY=tu-api-key
BACKGROUND_TEMPLATE_URL=https://tu-bucket.s3.amazonaws.com/backgrounds/template.png
```

Si `IMAGE_TOOLS_URL` está configurado pero el servicio no responde, el sistema automáticamente usa la imagen original como banner (fallback). La respuesta incluye `usedFallback: true` para que el frontend informe al usuario.

## Generar password hash para admin

El panel admin requiere un hash SHA-256 configurado en la variable `ADMIN_PASSWORD_HASH`:

```powershell
node scripts/generate-hash.js miPasswordSeguro123
```

Salida:

```
  Password:   miPasswordSeguro123
  SHA-256:    a1b2c3d4e5f6...

  Agrega esto a tu .env:
  ADMIN_PASSWORD_HASH=a1b2c3d4e5f6...
```

Copia el hash generado a tu `.env`:

```env
ADMIN_PASSWORD_HASH=a1b2c3d4e5f6...
```

## Estructura de archivos locales

Cuando generas una firma en modo local, las imágenes se guardan en:

```
lambda/local-storage/
├── originals/        # Fotos originales subidas
│   └── 1719000000-carlos_mendez.png
├── banners/          # Banners procesados (o copia del original)
│   └── 1719000000-carlos_mendez-banner.png
└── backgrounds/      # Fondos personalizados subidos
    └── 1719000000-carlos_mendez-bg.png
```

Esta carpeta está en `.gitignore`. El dev server las sirve en `/storage/...`.

## Tests

```powershell
cd lambda

# Correr todos los tests con coverage
npm test

# Modo watch para desarrollo
npm run test:watch
```

70 tests cubriendo:

| Suite | Qué valida |
|-------|-----------|
| `config.test.js` | Lectura de env vars, modo local/aws |
| `validation.test.js` | Validación de requests (campos requeridos, formatos, tamaños) |
| `templateEngine.test.js` | Renderizado, variables, compatibilidad email |
| `storageService.test.js` | Upload local, generación de keys |
| `aiProvider.test.js` | Factory de providers |
| `handlers.test.js` | Estructura de respuestas exitosas y errores |
| `previewSignature.test.js` | Preview usa placeholder sin procesamiento |

## Probar endpoints con PowerShell

### Health check

```powershell
Invoke-RestMethod -Uri "http://localhost:3005/health"
```

### Listar plantillas

```powershell
Invoke-RestMethod -Uri "http://localhost:3005/templates"
```

### Variables de una plantilla

```powershell
Invoke-RestMethod -Uri "http://localhost:3005/templates/corporativa/variables"
```

### Preview de firma

```powershell
$body = @{
    nombre = "Carlos Méndez"
    cargo = "Tech Lead"
    email = "carlos@empresa.com"
    telefono = "+593991234567"
    website = "https://miempresa.com"
    templateId = "corporativa"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3005/preview-signature" -Method Post -Body $body -ContentType "application/json"
```

### Extracción de campos (mock o real según config)

```powershell
$body = @{
    text = "Carlos Méndez, carlos@empresa.com, Tech Lead en TechCorp, +593991234567, https://miempresa.com"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3005/extract-fields" -Method Post -Body $body -ContentType "application/json"
```

### Generación completa (con imagen base64)

```powershell
# Convertir una imagen a base64
$imageBytes = [System.IO.File]::ReadAllBytes("C:\ruta\a\foto.png")
$imageBase64 = [Convert]::ToBase64String($imageBytes)

$body = @{
    nombre = "Carlos Méndez"
    cargo = "Tech Lead"
    email = "carlos@empresa.com"
    telefono = "+593991234567"
    templateId = "corporativa"
    image = $imageBase64
    compositionParams = @{
        scalePercent = 94
        horizontalAlign = "center"
        verticalAlign = "bottom"
    }
} | ConvertTo-Json -Depth 3

Invoke-RestMethod -Uri "http://localhost:3005/generate-signature" -Method Post -Body $body -ContentType "application/json"
```

## Probar con curl (Git Bash / WSL)

```bash
# Health check
curl http://localhost:3005/health

# Preview
curl -X POST http://localhost:3005/preview-signature \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Carlos Méndez","cargo":"Tech Lead","email":"carlos@empresa.com","telefono":"+593991234567","templateId":"minimalista"}'

# Extracción de campos
curl -X POST http://localhost:3005/extract-fields \
  -H "Content-Type: application/json" \
  -d '{"text":"Carlos Méndez, carlos@empresa.com, Tech Lead, +593991234567"}'
```

## Probar el panel admin

1. Genera un hash: `node scripts/generate-hash.js tuPassword`
2. Agrega `ADMIN_PASSWORD_HASH=<hash>` a `.env`
3. Reinicia el servidor
4. Navega a `http://localhost:3005/admin.html`
5. Ingresa tu password → accede al validador de templates

El validador ejecuta 8 reglas sobre el HTML de un template:
- **4 errores:** style blocks, scripts, external images, variables requeridas faltantes
- **4 warnings:** ancho excesivo, tablas anidadas profundas, media queries, links sin protocolo

## Troubleshooting

| Problema | Solución |
|----------|----------|
| `Cannot find module` | Ejecuta `cd lambda && npm install` |
| Puerto 3005 ocupado | Cambia `PORT=3006` en `.env` |
| AI extraction retorna mock | Configura `AZURE_OPENAI_ENDPOINT` y `AZURE_OPENAI_KEY` en `.env` |
| `Azure OpenAI error (400): API version not supported` | Tu recurso no acepta esa `api-version`. Corre `node scripts/diagnose-azure.js` para ver cuál versión responde OK y fíjala en `AZURE_OPENAI_API_VERSION`. Activa `AZURE_OPENAI_DEBUG=true` para ver la URL exacta en el log |
| Imagen no se genera | Verifica que `lambda/local-storage/` existe (se crea automáticamente) |
| Admin no permite login | Verifica que `ADMIN_PASSWORD_HASH` está en `.env` y reinicia el server |
| image-tools falla | Normal en local — el sistema usa fallback automático |

## Storage personalizado por plantilla (banner)

Cada plantilla vive en `lambda/templates/{id}/template.mustache` (las privadas, en `lambda/templates/private/{id}/`). Junto al `.mustache` puedes agregar un `config.json` opcional para que **solo el banner ya procesado** de esa plantilla se suba a un FTP/SFTP propio en vez del storage global (`STORAGE_PROVIDER`). La imagen original que sube el usuario nunca se ve afectada por esto.

```json
{
  "banner": {
    "storage": {
      "enabled": true,
      "type": "ftp",
      "host": "ftp.clienteX.com",
      "port": 21,
      "secure": false,
      "remotePath": "/public_html/banners",
      "publicBaseUrl": "https://clienteX.com/banners"
    },
    "filenamePattern": "{nombre}-{timestamp}.{ext}"
  }
}
```

- `remotePath` (ruta del lado FTP) y `publicBaseUrl` (prefijo HTTP que ya sabes que sirve esos archivos) son independientes — el segundo no se deriva del primero.
- `filenamePattern` soporta estos placeholders (con `nombre: "María López"`, `email: "maria.lopez@empresa.com"` de ejemplo):

  | Placeholder | Resultado | Nota |
  |---|---|---|
  | `{nombre}` | `mar_a_l_pez` | saneo total: todo lo que no sea letra/número queda como `_`, **incluidos los acentos** (se pierden, no se transliteran) |
  | `{nombreDot}` | `maria.lopez` | pensado para nombres de archivo tipo "firstname.lastname": quita acentos (á→a) en vez de perderlos, minúsculas, palabras unidas con `.` |
  | `{email}` | `maria_lopez_empresa_com` | saneo total del email completo, incluye `@` y el dominio |
  | `{emailUser}` | `maria.lopez` | **solo la parte antes del `@`**, conservando los puntos — úsalo si quieres armar tú el dominio/sufijo a mano en el pattern (ej. `"{emailUser}@miempresa.it.{ext}"`) |
  | `{cargo}` | saneo total, igual que `{nombre}` | |
  | `{timestamp}` | `1755780000000` (`Date.now()`) | evita que se sobrescriba el mismo archivo entre generaciones |
  | `{ext}` | `png`/`jpg`/`webp` | según el `contentType` real del banner generado |

  Regla rápida: si necesitas literales como `@` o `.` en el resultado (ej. `nombre@dominio.png`), usa `{emailUser}`/`{nombreDot}` para la parte variable — `{email}`/`{nombre}` siempre los reemplazan por `_`.
- **Nunca pongas credenciales en `config.json`** (se commitea con la plantilla). Van en `.env` como `FTP_<ID_EN_MAYUS>_USER` / `FTP_<ID_EN_MAYUS>_PASSWORD`.
- Si la plantilla no tiene `config.json`, o no tiene `banner.storage`, o pones `"enabled": false`, se usa el storage global de siempre — sin cambios.
- Si `enabled` es `true` (o lo omites) pero faltan credenciales o la subida FTP/SFTP falla, la generación de la firma **falla con un error claro** (no hay fallback silencioso a otra URL, para no entregar una firma con un banner roto).

### Título personalizado (`<title>`) por plantilla

Cuando el usuario descarga o abre la firma en una ventana nueva, el frontend envuelve el HTML en un documento completo con un `<title>`. Por defecto es `"Firma de Email"` para todas las plantillas, pero puedes personalizarlo en el mismo `config.json`:

```json
{
  "head": {
    "titlePattern": "Firma de {nombre} - contoso"
  }
}
```

- Acepta los mismos placeholders que los fields del formulario: `{nombre}`, `{cargo}`, `{email}`, `{telefono}`, `{website}`, `{linkedin}`.
- El backend lo resuelve y lo devuelve como `pageTitle` en la respuesta de `/generate-signature` y `/preview-signature`; el frontend lo usa al armar el documento descargable. Si la plantilla no tiene `config.json` o no define `head.titlePattern`, se mantiene el título por defecto de siempre.

### Banner con esquinas redondeadas (cápsula/círculo)

El servicio externo `image-tools` acepta un parámetro `cornerRadiusPercent` (0-50) para redondear las esquinas de la imagen final; 50 da una forma de cápsula/píldora (o círculo perfecto si el banner es cuadrado). En vez de exponer ese número directamente, el `config.json` de la plantilla usa un simple booleano:

```json
{
  "banner": {
    "round": true
  }
}
```

- `round: true` → se envía `cornerRadiusPercent: 50` a image-tools.
- `round: false` (o el campo ausente) → `cornerRadiusPercent: 0`, sin cambios (comportamiento de siempre).
- Solo aplica cuando el banner se procesa vía el servicio remoto `image-tools` (requiere `IMAGE_TOOLS_URL` configurado y funcionando). En el fallback local (sin `image-tools`, que simplemente copia la foto original) no hay redondeo posible, porque ese camino nunca procesa píxeles — es una limitación del fallback, no un bug.

## Hacer un commit con otra identidad (sin tocar tu config global)

Funciona igual en Windows (Git Bash, PowerShell o CMD). Usa `-c` para aplicar `user.name`/`user.email` solo a ese comando, sin cambiar la configuración global ni la del repo:

```bash
git -c user.name="Juan Pérez" -c user.email="juan@example.com" commit -m "feat: ..."
```

Para comprobar qué identidad usaría un commit antes de hacerlo:

```bash
git var GIT_AUTHOR_IDENT
git var GIT_COMMITTER_IDENT
```

Salida esperada: `Juan Pérez <juan@example.com> 1755780000 -0500`.

> Importante: esto solo cambia la identidad del commit (autor/committer), no las credenciales del `push`. Puedes commitear con el email de una cuenta y luego hacer `push` autenticado con otra.

## Hacer push con un PAT usando una cuenta específica

Para forzar que el `push` se autentique con una cuenta concreta (distinta a la que tengas guardada en el credential manager), pasa el usuario y el PAT (Personal Access Token) directamente en la URL remota, solo para ese comando:

```bash
git push https://<usuario>:<PAT>@github.com/<org>/<repo>.git <branch>
```

Ejemplo:

```bash
git push https://juanperez:ghp_xxxxxxxxxxxxxxxxxxxx@github.com/contoso/kiro-email-signature-generator.git main
```

No modifica el `remote origin` guardado (`git remote -v` sigue igual) — es válido solo para ese push. Si prefieres no escribir el PAT en cada comando, puedes crear un remoto alterno una sola vez:

```bash
git remote add con-pat https://<usuario>:<PAT>@github.com/<org>/<repo>.git
git push con-pat main
```

> Cuidado: la URL con el PAT queda en texto plano en `.git/config` si usas `remote add`, y en el historial de la shell si la escribes inline — no la compartas ni la pegues en logs. Genera el PAT con el mínimo scope necesario (`repo`) y con expiración.
