# Email Signature Generator & Asset CDN

Aplicación web self-service para generar firmas de correo corporativas. El usuario sube su foto, llena sus datos (manual o con IA), selecciona una plantilla y obtiene su firma HTML lista para copiar.

## Quick Start (desarrollo local)

```bash
# 1. Instalar dependencias
cd lambda && npm install

# 2. Crear archivo de configuración
cp .env.example .env

# 3. Levantar servidor de desarrollo
npm run dev
# o desde la raíz:
cd .. && npm run dev
```

El servidor arranca en `http://localhost:3000` con modo local (no necesita AWS).

## Probar ahora

| Qué probar | Cómo |
|------------|------|
| Health check | `GET http://localhost:3000/health` |
| Listar plantillas | `GET http://localhost:3000/templates` |
| Preview de firma | `POST /preview-signature` con JSON (ver abajo) |
| Generar firma completa | `POST /generate-signature` con imagen base64 |
| Extracción IA (mock) | `POST /extract-fields` con texto libre |

### Ejemplo: Preview de firma

```bash
curl -X POST http://localhost:3000/preview-signature \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Jonathan Arana","cargo":"Tech Lead","email":"jonathan@contoso.com","telefono":"+593996666193","templateId":"corporativa"}'
```

### Ejemplo: Extracción de campos (mock sin IA)

```bash
curl -X POST http://localhost:3000/extract-fields \
  -H "Content-Type: application/json" \
  -d '{"text":"Jonathan Arana, jonathan@contoso.com, Tech Lead, +593996666193"}'
```

## Tests

```bash
cd lambda && npm test
```

57 tests unitarios cubriendo config, validación, template engine, storage y AI provider.

## Estructura del proyecto

```
/
├── frontend/          # UI estática (Vanilla JS + Tailwind CDN)
├── lambda/            # Backend Node.js (Lambda handlers + dev server)
│   ├── src/
│   │   ├── handlers/  # Lambda handlers (en progreso)
│   │   ├── services/  # Template engine, storage, image-tools
│   │   ├── providers/ # AI providers (Azure OpenAI, Bedrock)
│   │   └── utils/     # Config, validation
│   ├── tests/         # Jest unit tests
│   └── dev-server.js  # Servidor Express para desarrollo local
├── templates/         # Plantillas Mustache (3 variantes)
├── docs/              # Documentación extendida
└── .kiro/specs/       # Spec del proyecto (requirements, design, tasks)
```

## Tecnologías

- **Frontend:** HTML/JS vanilla + Tailwind CDN
- **Backend:** Node.js 20, Express (dev) / AWS Lambda (prod)
- **Templates:** Mustache
- **AI:** Azure OpenAI / AWS Bedrock (patrón provider)
- **Storage:** Local filesystem (dev) / AWS S3 (prod)
- **Infra:** AWS SAM (pendiente)

## Documentación

Ver `docs/` para:
- [Arquitectura](docs/architecture.md)
- [API Reference](docs/api-reference.md)
- [Desarrollo local](docs/local-development.md)

## Estado del proyecto

Ver `.kiro/specs/email-signature-generator/tasks.md` para el progreso completo.
