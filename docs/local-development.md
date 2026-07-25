# Desarrollo Local

## Requisitos previos

- Node.js 18+ (recomendado 20)
- npm

**No necesitas:** cuenta AWS, credenciales cloud, Docker, ni ningún servicio externo.

## Setup

```bash
# Clonar e instalar
git clone <repo-url>
cd HackatonKiro
cd lambda && npm install

# Copiar configuración
cd ..
cp .env.example .env
```

## Arrancar el servidor

```bash
npm run dev
```

Esto levanta un servidor Express en `http://localhost:3000` que:
- Expone los mismos endpoints que Lambda + API Gateway
- Sirve los archivos frontend en la raíz `/`
- Sirve las imágenes locales en `/storage/`
- **No requiere AWS** — todo funciona con mocks locales

## Qué funciona sin configuración extra

| Feature | Funciona local | Notas |
|---------|---------------|-------|
| Preview de firma | ✅ | Todas las plantillas, preview instantáneo |
| Generación completa | ✅ | Imagen se guarda en `lambda/local-storage/` |
| Listar plantillas | ✅ | |
| Extracción IA (mock) | ✅ | Usa regex básico, no IA real |
| Extracción IA (real) | ⚠️ Necesita credenciales | Configurar Azure OpenAI en .env |
| Image-tools (real) | ⚠️ Necesita servicio externo | En local se salta, usa original como banner |

## Usar IA real en local

Si tienes credenciales de Azure OpenAI:

```env
AI_PROVIDER=azure
AZURE_OPENAI_ENDPOINT=https://tu-recurso.openai.azure.com
AZURE_OPENAI_KEY=tu-api-key
AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini
```

Con esto, `/extract-fields` usará IA real para extraer campos del texto libre.

## Estructura de archivos locales

Cuando generas una firma en modo local, las imágenes se guardan en:

```
lambda/local-storage/
├── originals/        # Fotos originales subidas
│   └── 1719000000-jonathan_arana.png
└── banners/          # Banners procesados (copia del original en local)
    └── 1719000000-jonathan_arana-banner.png
```

Esta carpeta está en `.gitignore`. El dev server las sirve en `/storage/...`.

## Tests

```bash
cd lambda
npm test            # Correr todos los tests (57 tests)
npm run test:watch  # Modo watch para desarrollo
```

Los tests cubren:
- **config.test.js** — Lectura de env vars, modo local/aws
- **validation.test.js** — Validación de requests (campos requeridos, formatos)
- **templateEngine.test.js** — Renderizado, variables, compatibilidad email
- **storageService.test.js** — Upload local, generación de keys
- **aiProvider.test.js** — Factory de providers

## Variables de entorno

| Variable | Default | Descripción |
|----------|---------|-------------|
| `APP_MODE` | `local` | `local` = mocks, `aws` = servicios reales |
| `PORT` | `3000` | Puerto del dev server |
| `AI_PROVIDER` | `azure` | `azure` o `bedrock` |
| `AZURE_OPENAI_ENDPOINT` | — | URL de tu recurso Azure OpenAI |
| `AZURE_OPENAI_KEY` | — | API key de Azure OpenAI |
| `AZURE_OPENAI_DEPLOYMENT` | `gpt-4o-mini` | Nombre del deployment |
| `S3_BUCKET_NAME` | `signature-generator-assets` | Solo para modo aws |
| `IMAGE_TOOLS_URL` | — | URL de image-tools externo |
| `IMAGE_TOOLS_API_KEY` | — | API key para image-tools |
| `BACKGROUND_TEMPLATE_URL` | — | URL del fondo para banners |

## Probar con PowerShell

```powershell
# Health check
Invoke-RestMethod -Uri "http://localhost:3000/health"

# Listar plantillas
Invoke-RestMethod -Uri "http://localhost:3000/templates"

# Preview
$body = @{
  nombre = "Jonathan Arana"
  cargo = "Tech Lead"
  email = "jonathan@contoso.com"
  telefono = "+593996666193"
  templateId = "corporativa"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/preview-signature" -Method Post -Body $body -ContentType "application/json"

# Extracción de campos (mock)
$body = @{ text = "Jonathan Arana, jonathan@contoso.com, Tech Lead, +593996666193" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3000/extract-fields" -Method Post -Body $body -ContentType "application/json"
```

## Probar con curl

```bash
# Preview
curl -X POST http://localhost:3000/preview-signature \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Jonathan Arana","cargo":"Tech Lead","email":"jonathan@contoso.com","telefono":"+593","templateId":"minimalista"}'

# Extracción
curl -X POST http://localhost:3000/extract-fields \
  -H "Content-Type: application/json" \
  -d '{"text":"Jonathan Arana, jonathan@contoso.com, Tech Lead"}'
```

## Siguiente paso: Frontend

Los archivos `frontend/index.html` y `frontend/admin.html` están creados como placeholder. Cuando se implementen (Tasks 7-8), se servirán automáticamente por el dev server en `http://localhost:3000/`.
