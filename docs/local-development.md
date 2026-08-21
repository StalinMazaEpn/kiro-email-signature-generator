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
git push https://juanperez:ghp_xxxxxxxxxxxxxxxxxxxx@github.com/handytec/kiro-email-signature-generator.git main
```

No modifica el `remote origin` guardado (`git remote -v` sigue igual) — es válido solo para ese push. Si prefieres no escribir el PAT en cada comando, puedes crear un remoto alterno una sola vez:

```bash
git remote add con-pat https://<usuario>:<PAT>@github.com/<org>/<repo>.git
git push con-pat main
```

> Cuidado: la URL con el PAT queda en texto plano en `.git/config` si usas `remote add`, y en el historial de la shell si la escribes inline — no la compartas ni la pegues en logs. Genera el PAT con el mínimo scope necesario (`repo`) y con expiración.
