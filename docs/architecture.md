# Arquitectura

## Diagrama del sistema

```mermaid
graph TD
    subgraph Frontend ["Frontend (S3 Static / localhost)"]
        UI[Formulario + Live Preview]
        CROP[Cropper.js<br/>Recorte foto + fondo]
        AI_INPUT[Input IA: texto libre → campos]
        ADMIN[Admin: Validador de Templates]
    end

    subgraph Backend ["Backend (Lambda / Express dev)"]
        APIGW[API Gateway HTTP / Express]
        GEN[POST /generate-signature]
        PREV[POST /preview-signature]
        EXTRACT[POST /extract-fields]
        TPLS[GET /templates]
        HEALTH[GET /health]
    end

    subgraph Services ["Servicios Internos"]
        TMPL[Template Engine<br/>Mustache - 3 plantillas]
        STORE[Storage Service<br/>S3 / Local FS]
        IMGCLI[Image-Tools Client<br/>Composición con fallback]
        AIPROV[AI Provider Factory]
    end

    subgraph External ["Servicios Externos"]
        S3[AWS S3 Bucket<br/>/originals/ /banners/ /backgrounds/]
        IMGTOOLS[image-tools API<br/>Composición persona + fondo]
        AZURE[Azure OpenAI<br/>gpt-4o-mini]
        BEDROCK[AWS Bedrock<br/>Claude Haiku]
    end

    UI -->|POST JSON| APIGW
    CROP -->|base64| UI
    AI_INPUT -->|POST texto| APIGW
    APIGW --> GEN
    APIGW --> PREV
    APIGW --> EXTRACT
    APIGW --> TPLS
    APIGW --> HEALTH

    GEN --> STORE
    GEN --> IMGCLI
    GEN --> TMPL
    PREV --> TMPL
    EXTRACT --> AIPROV

    STORE --> S3
    IMGCLI --> IMGTOOLS
    AIPROV -->|AI_PROVIDER=azure| AZURE
    AIPROV -->|AI_PROVIDER=bedrock| BEDROCK
```

## Flujos de datos

### Flujo A: Generación manual completa

```mermaid
sequenceDiagram
    participant U as Usuario
    participant F as Frontend
    participant B as Backend
    participant S as Storage (S3/local)
    participant IT as image-tools
    participant T as Template Engine

    U->>F: Llena formulario + sube foto
    U->>F: (Opcional) Sube fondo personalizado
    U->>F: (Opcional) Recorta foto/fondo con Cropper.js
    U->>F: Selecciona preset de composición
    F->>B: POST /generate-signature (datos + imagen base64 + fondo base64)
    B->>B: Valida campos requeridos + formato
    B->>S: Upload foto original → /originals/
    B->>S: (Si hay fondo) Upload fondo → /backgrounds/
    B->>IT: POST composición (originalUrl + backgroundUrl + params)
    IT-->>B: download_url del banner procesado
    B->>S: Download banner → Upload a /banners/
    B->>T: Render plantilla Mustache con campos + bannerUrl
    T-->>B: HTML de la firma
    B-->>F: { html, bannerUrl, usedFallback: false }
    F->>U: Muestra firma + botones (Copiar Outlook, Gmail, Descargar, Abrir)
```

### Flujo B: Extracción con IA

```mermaid
sequenceDiagram
    participant U as Usuario
    participant F as Frontend
    participant B as Backend
    participant AI as AI Provider

    U->>F: Pega texto libre en textarea
    F->>B: POST /extract-fields { text }
    B->>B: Valida texto (max 2000 chars)
    alt Credenciales IA disponibles
        B->>AI: Prompt con texto del usuario
        AI-->>B: JSON con campos extraídos
        B-->>F: { fields: { nombre, cargo, email, ... } }
    else Sin credenciales (mock)
        B->>B: Extracción regex básica
        B-->>F: { fields: {...}, _mock: true }
    end
    F->>U: Pre-llena formulario con campos
    U->>F: Revisa/edita → continúa Flujo A
```

### Flujo C: Preview rápido

```mermaid
sequenceDiagram
    participant U as Usuario
    participant F as Frontend
    participant B as Backend
    participant T as Template Engine

    U->>F: Llena campos (manual o post-IA)
    F->>B: POST /preview-signature (campos sin imagen)
    B->>T: Render plantilla con placeholder banner
    T-->>B: HTML preview
    B-->>F: { html }
    F->>U: Muestra preview en iframe (con foto local como data URL)
```

## Componentes principales

### Frontend

| Archivo | Responsabilidad |
|---------|----------------|
| `index.html` | Página principal: formulario, preview, generación |
| `admin.html` | Panel admin: login + validador de templates |
| `js/app.js` | Orquestación: form handling, AI extract, generate, copy/download |
| `js/api.js` | Cliente HTTP para todos los endpoints |
| `js/cropper-handler.js` | Cropper.js: recorte de foto de perfil y fondo personalizado |
| `js/fieldConfig.js` | Configuración de campos + tamaños de imagen por plantilla |
| `js/preview.js` | Renderizado de preview en iframe con auto-height |
| `js/auth.js` | Autenticación admin (SHA-256 client-side) |
| `js/validator.js` | Validador de templates (8 reglas: 4 errores + 4 warnings) |

### Backend

| Módulo | Responsabilidad |
|--------|----------------|
| `handlers/generateSignature.js` | Lambda: validar → upload → crear banner → render HTML |
| `handlers/previewSignature.js` | Lambda: render con placeholder sin procesar imagen |
| `handlers/extractFields.js` | Lambda: enviar a IA → parsear → retornar campos |
| `services/templateEngine.js` | Cargar y renderizar plantillas Mustache |
| `services/storageService.js` | Abstracción storage: S3 (prod) / filesystem (dev) |
| `services/imageToolsClient.js` | Cliente image-tools con fallback local |
| `providers/aiProvider.js` | Factory: selecciona provider según `AI_PROVIDER` |
| `providers/azureOpenAIProvider.js` | Implementación Azure OpenAI REST |
| `providers/bedrockProvider.js` | Implementación AWS Bedrock SDK |
| `utils/config.js` | Lectura centralizada de env vars |
| `utils/validation.js` | Validación de requests (campos, formatos, tamaños) |

### Templates Mustache

| Plantilla | Tamaño imagen | Descripción |
|-----------|---------------|-------------|
| `corporativa` | 130×160px | Portrait clásico, diseño conservador |
| `moderna-banner` | 180×210px | Portrait grande, diseño con banner destacado |
| `minimalista` | 56×56px | Foto cuadrada pequeña, diseño limpio |

### Image-Tools Client

El servicio `imageToolsClient.js` maneja la composición de persona sobre fondo:

- **Modo producción (aws):** Llama al servicio externo siempre
- **Modo local:** Intenta el servicio real si `IMAGE_TOOLS_URL` está configurado; si falla o no existe, copia la imagen original como banner (fallback)
- **Parámetros de composición:** `scalePercent`, `horizontalAlign`, `verticalAlign`, `paddingPercent`, `offsetX`, `offsetY`
- **Respuesta incluye:** `{ url, usedFallback, fallbackReason }` para que el frontend informe al usuario

## Modo local vs producción

| Componente | Local (`APP_MODE=local`) | Producción (`APP_MODE=aws`) |
|------------|--------------------------|------------------------------|
| Servidor | Express en localhost:3000 | Lambda + API Gateway HTTP |
| Storage | Filesystem `lambda/local-storage/` | S3 bucket público |
| URLs de imagen | `http://localhost:3000/storage/...` | `https://<bucket>.s3.amazonaws.com/...` |
| Image-tools | Intenta real si configurado → fallback copia original | Llama API externa (error si falla) |
| AI Provider | Azure OpenAI real (si hay creds) / Mock regex | Bedrock o Azure según config |
| Frontend hosting | Servido por Express estático | S3 Static Website |
| Autenticación admin | SHA-256 client-side (misma lógica) | SHA-256 client-side (misma lógica) |

## Patrón Provider (IA)

```
aiProvider.js (factory → getAIProvider())
├── azureOpenAIProvider.js  → Azure OpenAI REST API (gpt-4o-mini)
└── bedrockProvider.js      → AWS SDK v3 InvokeModel (Claude Haiku)
```

Selección via `AI_PROVIDER` env var. Ambos implementan `callModel(prompt) → string`.

Si no hay credenciales configuradas en modo local, el endpoint `/extract-fields` retorna una extracción regex básica con flag `_mock: true`.

## Seguridad

- **Admin:** Autenticación SHA-256 client-side comparando hash ingresado vs `ADMIN_PASSWORD_HASH`
- **CORS:** Habilitado globalmente (`Access-Control-Allow-Origin: *`)
- **Validación:** Todos los inputs validados server-side (campos requeridos, formato email, tamaño imagen ≤ 15MB, tipos permitidos)
- **API Keys:** `IMAGE_TOOLS_API_KEY` se envía como header `X-API-KEY`

## Infraestructura AWS (SAM)

El archivo `template.yaml` define:

- 1 HTTP API Gateway con CORS
- 3 Lambda functions (Node.js 20, 512MB RAM, 60s timeout)
- 1 S3 bucket para assets (acceso público lectura)
- 1 S3 bucket para frontend (static website)
- IAM roles con permisos mínimos (S3 PutObject, Bedrock InvokeModel)
