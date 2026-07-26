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

70 tests unitarios cubriendo config, validación, template engine, storage, AI provider y Lambda handlers.

## Estructura del proyecto

```
/
├── frontend/              # UI estática (Vanilla JS + Tailwind CDN)
│   ├── index.html         # Página principal (formulario + preview + AI)
│   ├── admin.html         # Panel admin (pendiente: validador de templates)
│   ├── css/styles.css     # Estilos custom (spinner, status, iframes)
│   └── js/
│       ├── api.js         # Cliente fetch para todos los endpoints
│       ├── app.js         # Lógica principal: form, AI extract, generate, copy
│       └── preview.js     # Renderizado en iframe con auto-height
├── lambda/                # Backend Node.js (Lambda handlers + dev server)
│   ├── src/
│   │   ├── handlers/      # Lambda handlers (generateSignature, preview, extract)
│   │   ├── services/      # Template engine, storage, image-tools client
│   │   ├── providers/     # AI providers (Azure OpenAI, Bedrock)
│   │   └── utils/         # Config, validation
│   ├── tests/unit/        # Jest unit tests (70 tests)
│   ├── local-storage/     # Imágenes generadas en dev (gitignored)
│   └── dev-server.js      # Servidor Express para desarrollo local
├── templates/             # Plantillas Mustache (3 variantes)
├── docs/                  # Documentación extendida
└── .kiro/specs/           # Spec del proyecto (requirements, design, tasks)
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

| Fase | Estado |
|------|--------|
| 1. Estructura y utilidades | ✅ Completo |
| 2. Templates y engine | ✅ Completo |
| 3. Storage e image-tools | ✅ Completo |
| 4. AI provider abstraction | ✅ Completo |
| 5. Lambda handlers | ✅ Completo |
| 6. Checkpoint (70 tests) | ✅ Completo |
| 7. Frontend | ✅ Completo |
| 8. Admin panel | ⬜ Pendiente |
| 9. Checkpoint frontend | ⬜ Pendiente |
| 10. Infra y docs finales | ⬜ Pendiente |

**Funcionalidades operativas ahora:**
- Formulario con todos los campos + selector de plantilla + subida de imagen
- Extracción de campos con IA (Azure OpenAI) que pre-llena el formulario
- Vista previa instantánea (muestra la imagen seleccionada sin esperar procesamiento)
- Generación completa de firma con procesamiento de banner via image-tools
- Copiar HTML al clipboard
- 3 plantillas: Corporativa, Moderna con Banner, Minimalista

**Pendiente:**
- Panel admin con validador de templates
- SAM template (infraestructura AWS)
- Documentación final con diagrama y demo script

Ver `.kiro/specs/email-signature-generator/tasks.md` para el progreso detallado.
