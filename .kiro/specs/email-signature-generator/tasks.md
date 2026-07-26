# Implementation Plan: Email Signature Generator & Asset CDN

## Overview

Implement a serverless email signature generator as a monorepo with Vanilla JS frontend, Node.js Lambda backend, Mustache templates, AI provider abstraction, and SAM infrastructure. Tasks are ordered to build foundational layers first (config, services, templates) then wire them into handlers, frontend, and infrastructure.

## Progress Summary

| Phase | Status | Tests |
|-------|--------|-------|
| 1. Project structure & utilities | ✅ Done | 32 tests |
| 2. Templates & engine | ✅ Done | 15 tests |
| 3. Storage & image-tools | ✅ Done | 6 tests |
| 4. AI provider abstraction | ✅ Done | 4 tests |
| Bonus: Local dev server | ✅ Done | — |
| 5. Lambda handlers | ✅ Done | 13 tests |
| 6. Checkpoint | ✅ Done | 70 total |
| 7. Frontend | ✅ Done | — |
| 7.5 Enhancement: Download/Open signature | ⬜ Pending | — |
| 7.6 Enhancement: AI extraction UX + field config | ⬜ Pending | — |
| 8. Admin panel | ⬜ Pending | — |
| 9. Checkpoint | ⬜ Pending | — |
| 10. Infra & docs | ⬜ Pending | — |
| 11. Final checkpoint | ⬜ Pending | — |

**Total tests passing: 70**

## Tasks

- [x] 1. Set up project structure and core utilities ✅
  - [x] 1.1 Create monorepo directory structure and initialize Lambda package
    - Created `/frontend/js/`, `/frontend/css/`, `/lambda/src/handlers/`, `/lambda/src/services/`, `/lambda/src/providers/`, `/lambda/src/utils/`, `/lambda/tests/unit/`, `/templates/` directories
    - Created `lambda/package.json` with dependencies: mustache, @aws-sdk/client-s3, @aws-sdk/client-bedrock-runtime
    - Added dev dependencies: jest, express, cors, multer, dotenv
    - _Requirements: 10.2_

  - [x] 1.2 Implement configuration module
    - Created `lambda/src/utils/config.js` with `getConfig()` and `isLocalMode()`
    - Supports `APP_MODE=local` for development without AWS dependencies
    - _Requirements: 7.1, 3.4_

  - [x] 1.3 Implement request validation module
    - Created `lambda/src/utils/validation.js` with `validateGenerateRequest()`, `validatePreviewRequest()`, `validateExtractRequest()`
    - _Requirements: 1.2_

  - [x]* 1.4 Write unit tests for config and validation
    - 28 tests passing covering all validation scenarios
    - **Validates: Requirements 1.2**

- [x] 2. Implement Mustache templates and template engine ✅
  - [x] 2.1 Create the three Mustache template files
    - Created `templates/corporativa.mustache` — 2-column table, 550px, photo left + data right
    - Created `templates/moderna-banner.mustache` — 600px banner on top, centered data below
    - Created `templates/minimalista.mustache` — 480px single row, circular avatar + inline data
    - All use `<table>` layout, inline styles, triple-braces `{{{url}}}` for unescaped URLs
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 2.2 Implement template engine service
    - Created `lambda/src/services/templateEngine.js` with `render()`, `loadTemplate()`, `getTemplateList()`, `getTemplateVariables()`
    - _Requirements: 5.1, 5.2, 5.3_

  - [x]* 2.3 Write unit tests for template engine
    - 15 tests: rendering, optional fields, table layout, no style/script blocks, img dimensions
    - **Validates: Requirements 1.5, 5.3**

- [x] 3. Implement storage and image-tools services ✅
  - [x] 3.1 Implement storage service (with local mock)
    - Created `lambda/src/services/storageService.js` with dual mode:
      - **Local**: writes to `lambda/local-storage/` filesystem, returns `http://localhost:PORT/storage/{key}`
      - **AWS**: uploads to S3, returns public S3 URL
    - _Requirements: 6.1, 6.3_

  - [x] 3.2 Implement image-tools client service (with local mock)
    - Created `lambda/src/services/imageToolsClient.js` with dual mode:
      - **Local**: copies original as banner (no external service needed)
      - **AWS**: calls real image-tools API, downloads result, uploads to S3
    - _Requirements: 7.1, 7.2, 7.3_

  - [x]* 3.3 Write unit tests for storage service
    - 6 tests covering local upload, directory creation, key generation
    - **Validates: Requirements 1.3, 1.4, 6.1, 6.2**

- [x] 4. Implement AI provider abstraction ✅
  - [x] 4.1 Implement AI provider factory and provider implementations
    - Created `lambda/src/providers/aiProvider.js` with `getAIProvider()` factory
    - Created `lambda/src/providers/bedrockProvider.js` (Claude Haiku via AWS SDK v3)
    - Created `lambda/src/providers/azureOpenAIProvider.js` (Azure OpenAI REST API)
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x]* 4.2 Write unit tests for AI provider factory
    - 4 tests covering provider selection and unknown provider error
    - **Validates: Requirements 2.3, 3.5**

- [x] BONUS: Local development server ✅
  - Created `lambda/dev-server.js` (Express) that exposes ALL endpoints locally
  - Serves frontend static files and local-storage images
  - Includes mock field extraction (regex) when no AI credentials configured
  - Endpoints: POST /generate-signature, /preview-signature, /extract-fields, GET /templates, /health

- [x] 5. Implement Lambda handlers ✅
  - [x] 5.1 Implement generateSignature handler
    - Created `lambda/src/handlers/generateSignature.js` — parse body, validate, upload original, create banner, render template, return `{ success, html, bannerUrl }`
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6_

  - [x] 5.2 Implement previewSignature handler
    - Created `lambda/src/handlers/previewSignature.js` — parse body, render template with placeholder banner URL, return `{ success, html }`
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 5.3 Implement extractFields handler
    - Created `lambda/src/handlers/extractFields.js` — parse body, get AI provider, send prompt, parse JSON, return `{ success, fields }`
    - _Requirements: 2.2, 2.3, 2.4_

  - [x]* 5.4 Write property test for preview placeholder behavior
    - 4 tests: placeholder in HTML, no image required, all templates, no bannerUrl in response
    - **Validates: Requirements 4.2, 4.3**

  - [x]* 5.5 Write property test for successful response structure
    - 9 tests: status codes, headers, body structure, error response consistency
    - **Validates: Requirements 1.6, 2.4**

- [x] 6. Checkpoint - All Lambda tests pass ✅
  - 70 tests passing across 7 test suites
  - Coverage: handlers 87.93%, services 87.03%, utils 93.93%

- [x] 7. Implement frontend ✅
  - [x] 7.1 Create main HTML page and styling
    - Created `frontend/index.html` with Tailwind CDN, form (nombre, cargo, email, telefono, website, linkedin, template selector, image upload), AI text area, preview iframe, output area
    - Created `frontend/css/styles.css` with spinner animation, status classes, iframe styling
    - _Requirements: 1.1, 2.1_

  - [x] 7.2 Implement API client module
    - Created `frontend/js/api.js` with fetch wrappers for generateSignature, previewSignature, extractFields, getTemplates
    - Auto-resolves base URL from window.location.origin
    - _Requirements: 1.2, 2.2, 4.1_

  - [x] 7.3 Implement main app logic and form handling
    - Created `frontend/js/app.js` — form submission, base64 image conversion, AI extract button, copy-to-clipboard, pre-fill form from extracted fields
    - Preview shows uploaded image as data URL (no broken placeholder)
    - _Requirements: 1.7, 2.5, 2.6_

  - [x] 7.4 Implement preview rendering logic
    - Created `frontend/js/preview.js` — iframe rendering with auto-height, separate preview/output areas
    - _Requirements: 4.1_

- [ ] 7.5 Enhancement: Download and open generated signature
  - [ ] 7.5.1 Add "Download HTML" button to output section
    - Generate a downloadable `.html` file from the generated signature HTML
    - Use Blob + URL.createObjectURL for client-side download
  - [ ] 7.5.2 Add "Open in new window" button to output section
    - Open the generated HTML in a new browser tab/window using window.open + document.write

- [ ] 7.6 Enhancement: AI extraction UX improvements and field config
  - [ ] 7.6.1 Create project field configuration file
    - Create `frontend/js/fieldConfig.js` with a centralized config object defining which fields are required/optional, their labels, and placeholder text
    - This file is the single source of truth: changing required fields here propagates to validation, form rendering, and AI extraction feedback without touching app code
  - [ ] 7.6.2 Clear form before pre-filling from AI extraction
    - When "Extraer campos con IA" succeeds, first clear ALL form fields, then populate with extracted values
    - This ensures stale data from a previous extraction is removed and user sees exactly what the AI found
  - [ ] 7.6.3 Show missing required fields feedback after AI extraction
    - After pre-filling, check extracted fields against required fields from `fieldConfig.js`
    - If any required field is missing (null/empty), show a warning message below the AI input listing which fields are missing
    - Include a helpful suggestion on how to include those fields in the text (e.g. "Intenta incluir tu email en el texto, por ejemplo: 'mi correo es usuario@empresa.com'")
    - Non-required missing fields should NOT trigger warnings
    - Fields that WERE extracted successfully still populate the form normally

- [ ] 8. Implement admin panel
  - [ ] 8.1 Create admin HTML page and authentication module
    - Create `frontend/admin.html` with login form and admin content area (template validator input and results display)
    - Create `frontend/js/auth.js` with SHA-256 hash comparison, sessionStorage session management, login/logout functions
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ] 8.2 Implement template validator (client-side)
    - Create `frontend/js/validator.js` implementing all 8 validation rules — 4 ERROR rules (required vars, style blocks, script tags, div with flex/grid) and 4 WARNING rules (img dimensions, max width 600px, Outlook-incompatible CSS, external fonts)
    - Wire validator into admin panel UI with results display
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8_

  - [ ]* 8.3 Write property test for template validator ERROR rules
    - **Property 6: Template validator detects ERROR violations**
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4**

  - [ ]* 8.4 Write property test for template validator WARNING rules
    - **Property 7: Template validator detects WARNING violations**
    - **Validates: Requirements 9.5, 9.6, 9.7, 9.8**

  - [ ]* 8.5 Write property test for SHA-256 authentication
    - **Property 9: SHA-256 password authentication correctness**
    - **Validates: Requirements 8.2**

- [ ] 9. Checkpoint - Ensure all frontend and validator tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Infrastructure and documentation
  - [ ] 10.1 Create SAM template.yaml
    - Define all Lambda functions (generateSignature, previewSignature, extractFields) with Node.js 20.x runtime
    - Define HttpApi with CORS AllowOrigins *, POST methods
    - Define AssetsBucket with public access policy and FrontendBucket with static website hosting
    - Define parameters for ImageToolsUrl and AIProvider
    - Define Outputs for ApiUrl, FrontendUrl, AssetsBucketName
    - _Requirements: 10.1, 10.3, 10.4_

  - [ ] 10.2 Create README with architecture diagram and demo script
    - Write README.md with Mermaid diagram showing Frontend → API Gateway → Lambda → S3/image-tools/AI flow
    - Include setup instructions, environment variable reference, and deployment steps
    - Include 3-minute video demo script covering manual flow, AI flow, preview, and admin validation
    - _Requirements: 11.1, 11.2_

- [ ] 11. Final checkpoint - Ensure all tests pass and project is complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at logical breaks
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The frontend uses Tailwind CDN with no build step, so no bundler setup is needed
- Templates must be bundled with the Lambda deployment (SAM CodeUri: lambda/ with templates accessible via relative path)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "2.1"] },
    { "id": 2, "tasks": ["1.4", "2.2", "4.1"] },
    { "id": 3, "tasks": ["2.3", "3.1", "3.2"] },
    { "id": 4, "tasks": ["3.3", "3.4", "4.2", "5.1", "5.2", "5.3"] },
    { "id": 5, "tasks": ["5.4", "5.5"] },
    { "id": 6, "tasks": ["7.1", "7.2", "8.1", "10.1"] },
    { "id": 7, "tasks": ["7.3", "7.4", "8.2", "10.2"] },
    { "id": 8, "tasks": ["7.5", "8.3", "8.4", "8.5"] }
  ]
}
```
