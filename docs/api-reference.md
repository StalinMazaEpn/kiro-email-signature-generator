# API Reference

Base URL:
- Local: `http://localhost:3000`
- Producción: `https://{api-id}.execute-api.{region}.amazonaws.com`

---

## POST /generate-signature

Genera la firma completa: sube imagen, procesa banner, compila HTML.

**Request:**
```json
{
  "nombre": "Jonathan Arana",
  "cargo": "Tech Lead",
  "email": "jonathan@contoso.com",
  "telefono": "+593996666193",
  "website": "https://jonathan.dev",
  "linkedin": "https://linkedin.com/in/jonathan-arana",
  "templateId": "corporativa",
  "image": "iVBORw0KGgo... (base64)"
}
```

| Campo | Tipo | Requerido | Notas |
|-------|------|-----------|-------|
| nombre | string | Sí | |
| cargo | string | Sí | |
| email | string | Sí | Formato email válido |
| telefono | string | Sí | |
| website | string | No | URL completa |
| linkedin | string | No | URL completa |
| templateId | string | Sí | `corporativa`, `moderna-banner`, `minimalista` |
| image | string | Sí | Base64 encoded, max ~10MB |

**Response (200):**
```json
{
  "success": true,
  "html": "<table>...</table>",
  "bannerUrl": "http://localhost:3000/storage/banners/1234-jonathan_arana-banner.png"
}
```

**Response (400):**
```json
{
  "success": false,
  "error": "Missing required field: templateId"
}
```

---

## POST /preview-signature

Preview rápido sin procesar imagen. Usa un banner placeholder.

**Request:**
```json
{
  "nombre": "Jonathan Arana",
  "cargo": "Tech Lead",
  "email": "jonathan@contoso.com",
  "telefono": "+593996666193",
  "templateId": "moderna-banner"
}
```

| Campo | Tipo | Requerido |
|-------|------|-----------|
| nombre | string | Sí |
| cargo | string | Sí |
| email | string | Sí |
| telefono | string | No |
| website | string | No |
| linkedin | string | No |
| templateId | string | Sí |

**Response (200):**
```json
{
  "success": true,
  "html": "<table>...</table>"
}
```

---

## POST /extract-fields

Extrae campos de contacto de un texto libre usando IA.

**Request:**
```json
{
  "text": "Jonathan Arana, jonathan@contoso.com, Tech Lead en Contoso, +593996666193, https://jonathan.dev"
}
```

| Campo | Tipo | Requerido | Notas |
|-------|------|-----------|-------|
| text | string | Sí | Max 2000 caracteres |

**Response (200) — con IA real:**
```json
{
  "success": true,
  "fields": {
    "nombre": "Jonathan Arana",
    "cargo": "Tech Lead en Contoso",
    "email": "jonathan@contoso.com",
    "telefono": "+593996666193",
    "website": "https://jonathan.dev",
    "linkedin": null
  }
}
```

**Response (200) — modo mock (sin credenciales IA):**
```json
{
  "success": true,
  "fields": { "nombre": "Jonathan Arana", "cargo": "Tech Lead", ... },
  "_mock": true,
  "_message": "AI credentials not configured. Using basic regex extraction."
}
```

---

## GET /templates

Lista las plantillas disponibles.

**Response:**
```json
{
  "success": true,
  "templates": [
    { "id": "corporativa", "name": "Corporativa", "description": "..." },
    { "id": "moderna-banner", "name": "Moderna con Banner", "description": "..." },
    { "id": "minimalista", "name": "Minimalista", "description": "..." }
  ]
}
```

---

## GET /templates/:id/variables

Variables usadas en una plantilla específica.

**Response:**
```json
{
  "success": true,
  "variables": ["nombre", "cargo", "email", "telefono", "website", "linkedin", "bannerUrl"]
}
```

---

## GET /health

Health check del servidor.

**Response:**
```json
{
  "status": "ok",
  "mode": "local",
  "aiProvider": "azure",
  "hasAICredentials": false
}
```

---

## Errores comunes

| Status | Error | Causa |
|--------|-------|-------|
| 400 | Missing required field: X | Campo obligatorio vacío o ausente |
| 400 | Invalid templateId: X | templateId no es uno de los 3 válidos |
| 400 | Invalid email format | Email no cumple formato básico |
| 400 | Text exceeds maximum length | Texto > 2000 caracteres en /extract-fields |
| 500 | IMAGE_TOOLS_URL not configured | Intentar generar firma sin image-tools (modo AWS) |
| 500 | Azure OpenAI credentials not configured | AI_PROVIDER=azure pero sin ENDPOINT/KEY |
| 500 | Image processing failed | image-tools retornó error |
