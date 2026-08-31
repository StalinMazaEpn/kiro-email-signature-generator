# API Reference

## Base URL

| Entorno | URL |
|---------|-----|
| Local | `http://localhost:3005` |
| Producción | `https://{api-id}.execute-api.{region}.amazonaws.com` |

---

## POST /generate-signature

Genera la firma completa: sube imagen, procesa banner con image-tools, compila HTML.

### Request

```json
{
  "nombre": "Carlos Méndez",
  "cargo": "Tech Lead",
  "email": "carlos@empresa.com",
  "telefono": "+593991234567",
  "website": "https://miempresa.com",
  "linkedin": "https://linkedin.com/in/carlos-mendez",
  "templateId": "corporativa",
  "image": "iVBORw0KGgo... (base64)",
  "compositionParams": {
    "scalePercent": 94,
    "horizontalAlign": "center",
    "verticalAlign": "center",
    "paddingPercent": 0,
    "offsetX": 0,
    "offsetY": 0
  },
  "backgroundImage": "iVBORw0KGgo... (base64, opcional)"
}
```

| Campo | Tipo | Requerido | Notas |
|-------|------|-----------|-------|
| `nombre` | string | Sí | Nombre completo |
| `cargo` | string | Sí | Puesto/cargo |
| `email` | string | Sí | Formato email válido |
| `telefono` | string | Sí | Número de teléfono |
| `website` | string | No | URL completa con protocolo |
| `linkedin` | string | No | URL completa del perfil |
| `templateId` | string | Sí | `corporativa`, `moderna-banner` o `minimalista` |
| `image` | string | Sí | Imagen base64, máx ~15MB decodificado, PNG/JPG/WebP |
| `compositionParams` | object | No | Parámetros de composición de imagen |
| `backgroundImage` | string | No | Fondo personalizado en base64 (override del default) |

**compositionParams:**

| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `scalePercent` | number | 94 | Escala de la persona sobre el fondo (%) |
| `horizontalAlign` | string | `"center"` | Alineación horizontal: `left`, `center`, `right` |
| `verticalAlign` | string | `"center"` | Alineación vertical: `top`, `center`, `bottom` |
| `paddingPercent` | number | 0 | Padding respecto al borde (%) |
| `offsetX` | number | 0 | Desplazamiento horizontal en px |
| `offsetY` | number | 0 | Desplazamiento vertical en px |

**Modos rápidos del formulario (equivalentes en "Modo avanzado"):**

En el formulario, "Centrado" y "Inferior" (75% centro-abajo) son atajos que fijan estos mismos `compositionParams`. Si se quiere partir de ahí y ajustar manualmente en "Modo avanzado", estos son los valores que hay que cargar en cada campo:

| Modo rápido | `scalePercent` | `horizontalAlign` | `verticalAlign` | `paddingPercent` |
|-------------|----------------|--------------------|------------------|-------------------|
| Centrado | `100` | `center` | `center` | `0` |
| Inferior (75% centro-abajo) | `75` | `center` | `bottom` | `0` |

Fuente: `frontend/js/app.js` (`getCompositionParams`).

### Response (200)

```json
{
  "success": true,
  "html": "<table cellpadding=\"0\" cellspacing=\"0\">...</table>",
  "bannerUrl": "http://localhost:3005/storage/banners/1719000000-carlos_mendez-banner.png",
  "usedFallback": false,
  "fallbackReason": null
}
```

Cuando image-tools no está disponible (fallback):

```json
{
  "success": true,
  "html": "<table>...</table>",
  "bannerUrl": "http://localhost:3005/storage/banners/1719000000-carlos_mendez-banner.png",
  "usedFallback": true,
  "fallbackReason": "IMAGE_TOOLS_URL not configured"
}
```

### Response (400)

```json
{
  "success": false,
  "error": "Missing required field: templateId"
}
```

---

## POST /preview-signature

Preview rápido sin procesar imagen. Renderiza template con un banner placeholder.

### Request

```json
{
  "nombre": "Carlos Méndez",
  "cargo": "Tech Lead",
  "email": "carlos@empresa.com",
  "telefono": "+593991234567",
  "website": "https://miempresa.com",
  "linkedin": "https://linkedin.com/in/carlos-mendez",
  "templateId": "moderna-banner"
}
```

| Campo | Tipo | Requerido |
|-------|------|-----------|
| `nombre` | string | Sí |
| `cargo` | string | Sí |
| `email` | string | Sí |
| `telefono` | string | No |
| `website` | string | No |
| `linkedin` | string | No |
| `templateId` | string | Sí |

### Response (200)

```json
{
  "success": true,
  "html": "<table cellpadding=\"0\" cellspacing=\"0\">...</table>"
}
```

---

## POST /extract-fields

Extrae campos de contacto de un texto libre usando IA (o regex mock si no hay credenciales).

**Providers soportados:**
- **Azure OpenAI**: Usa `gpt-4o-mini` (o el deployment configurado) via REST API
  - Soporta dos formatos de endpoint:
    - **Legacy** (por recurso): `https://<nombre>.openai.azure.com`
    - **Nuevo** (AI Services): `https://<nombre>.services.ai.azure.com/openai/v1`
  - Dos APIs disponibles:
    - `chat`: Chat Completions API (funciona con ambos formatos)
    - `responses`: Responses API con streaming (solo endpoint nuevo)
- **AWS Bedrock**: Usa Claude Haiku via SDK nativo
- **Mock (fallback)**: Extracción por regex si no hay credenciales configuradas

> 💡 Si tienes problemas con Azure OpenAI (error 400 "API version not supported"), usa el script de diagnóstico: `node scripts/diagnose-azure.js`

### Request

```json
{
  "text": "Soy Carlos Méndez, trabajo como Tech Lead en TechCorp. Mi correo es carlos@empresa.com y mi teléfono +593991234567. Mi perfil: linkedin.com/in/cmendez"
}
```

| Campo | Tipo | Requerido | Notas |
|-------|------|-----------|-------|
| `text` | string | Sí | Máximo 2000 caracteres |

### Response (200) — Con IA real

```json
{
  "success": true,
  "fields": {
    "nombre": "Carlos Méndez",
    "cargo": "Tech Lead en TechCorp",
    "email": "carlos@empresa.com",
    "telefono": "+593991234567",
    "website": null,
    "linkedin": "https://linkedin.com/in/cmendez"
  }
}
```

### Response (200) — Modo mock (sin credenciales IA)

```json
{
  "success": true,
  "fields": {
    "nombre": "Carlos Méndez",
    "cargo": "Tech Lead en TechCorp",
    "email": "carlos@empresa.com",
    "telefono": "+593991234567",
    "website": null,
    "linkedin": "linkedin.com/in/cmendez"
  },
  "_mock": true,
  "_message": "AI credentials not configured. Using basic regex extraction."
}
```

---

## GET /templates

Lista las plantillas disponibles con metadata.

**Nota**: Este endpoint solo retorna las 3 plantillas públicas (`corporativa`, `moderna-banner`, `minimalista`). Las plantillas privadas (`signature-business`, `signature-company`) existen en el sistema pero no se exponen en este listado para mantenerlas como templates especiales para clientes específicos.

### Response (200)

```json
{
  "success": true,
  "templates": [
    {
      "id": "corporativa",
      "name": "Corporativa",
      "description": "Diseño profesional clásico con foto portrait (130×160px)"
    },
    {
      "id": "moderna-banner",
      "name": "Moderna con Banner",
      "description": "Diseño moderno con banner destacado (180×210px)"
    },
    {
      "id": "minimalista",
      "name": "Minimalista",
      "description": "Diseño limpio con foto cuadrada pequeña (56×56px)"
    }
  ]
}
```

---

## GET /templates/:id/variables

Retorna las variables Mustache usadas en una plantilla específica.

### Request

```
GET /templates/corporativa/variables
```

### Response (200)

```json
{
  "success": true,
  "variables": ["nombre", "cargo", "email", "telefono", "website", "linkedin", "bannerUrl"]
}
```

### Response (404)

```json
{
  "success": false,
  "error": "Template not found: invalid-id"
}
```

---

## GET /health

Health check del servidor. Útil para verificar configuración.

### Response (200)

```json
{
  "status": "ok",
  "mode": "local",
  "aiProvider": "azure",
  "hasAICredentials": false
}
```

---

## Códigos de error

| Status | Error | Causa |
|--------|-------|-------|
| 400 | `Missing required field: X` | Campo obligatorio vacío o ausente |
| 400 | `Invalid templateId: X` | templateId no es `corporativa`, `moderna-banner` o `minimalista` |
| 400 | `Invalid email format` | Email no cumple formato básico |
| 400 | `Text exceeds maximum length` | Texto > 2000 caracteres en `/extract-fields` |
| 400 | `Image exceeds maximum size (15MB)` | Imagen decodificada supera 15MB |
| 400 | `Invalid image format` | Formato no es PNG, JPG o WebP |
| 404 | `Template not found: X` | templateId no existe en `/templates/:id/variables` |
| 500 | `IMAGE_TOOLS_URL environment variable is not configured` | Modo aws sin IMAGE_TOOLS_URL |
| 500 | `No background configured` | Sin BACKGROUND_TEMPLATE_URL ni fondo custom |
| 500 | `Azure OpenAI credentials not configured` | AI_PROVIDER=azure sin endpoint/key |
| 500 | `Image-tools service unreachable at X` | image-tools no responde |
| 500 | `Image processing failed (status): body` | image-tools retornó error HTTP |
| 500 | `No se pudo interpretar la respuesta de la IA` | IA retornó JSON inválido |

---

## Headers

Todas las respuestas incluyen:

```
Content-Type: application/json
Access-Control-Allow-Origin: *
```

El body de requests debe enviarse como:

```
Content-Type: application/json
```

Límite de body: 15MB (para soportar imágenes base64).

---

## Límites y validaciones

### Tamaños y formatos

| Límite | Valor | Validación |
|--------|-------|------------|
| Tamaño máximo imagen | 15MB decodificado | Server-side: rechaza con 400 si excede |
| Formatos permitidos | PNG, JPG, WebP | Server-side: valida MIME type |
| Texto máximo (extract) | 2000 caracteres | Server-side: rechaza con 400 si excede |
| Timeout Lambda (generate) | 60s | AWS: termina ejecución, retorna últimos logs |
| Timeout Lambda (otros) | 30s | AWS: termina ejecución, retorna últimos logs |

### Campos requeridos por endpoint

**POST /generate-signature:**
- `nombre`, `cargo`, `email`, `telefono`, `templateId`, `image`

**POST /preview-signature:**
- `nombre`, `cargo`, `email`, `templateId`

**POST /extract-fields:**
- `text`

### Formato de email

El validador acepta cualquier string que cumpla el patrón básico:
```regex
/^[^\s@]+@[^\s@]+\.[^\s@]+$/
```

Ejemplos válidos:
- `carlos@empresa.com`
- `maria.lopez@tech-corp.io`
- `admin+test@example.co.uk`

Ejemplos inválidos (retornan 400):
- `carlos@empresa` (falta dominio de nivel superior)
- `@empresa.com` (falta parte local)
- `carlos @empresa.com` (espacios no permitidos)
