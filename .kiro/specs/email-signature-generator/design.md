# Design Document

## Overview

The Email Signature Generator is a serverless web application following a three-tier architecture: static frontend on S3, Lambda functions behind API Gateway for business logic, and S3 for asset storage. The system uses Mustache templates for email-compatible HTML rendering, an abstracted AI provider for text extraction, and integrates with an external image-tools service for photo processing.

## Architecture

```
┌─────────────────┐       ┌──────────────────────────┐       ┌─────────────────┐
│   Frontend      │       │     API Gateway          │       │    S3 Storage   │
│  (S3 Static)    │──────▶│  POST /generate-signature│──────▶│  /originals/    │
│  Vanilla JS     │       │  POST /preview-signature │       │  /banners/      │
│  Tailwind CDN   │       │  POST /extract-fields    │       └─────────────────┘
└─────────────────┘       └──────────┬───────────────┘              ▲
                                     │                              │
                                     ▼                              │
                          ┌──────────────────────┐                  │
                          │   Lambda Functions   │──────────────────┘
                          │   (Node.js)          │
                          └───┬──────────┬───────┘
                              │          │
                              ▼          ▼
                    ┌──────────────┐  ┌──────────────────┐
                    │  image-tools │  │  AI Provider     │
                    │  (External)  │  │  (Azure/Bedrock) │
                    └──────────────┘  └──────────────────┘
```

## Directory Structure

```
/
├── frontend/
│   ├── index.html          # Main signature generator page
│   ├── admin.html          # Admin panel page
│   ├── js/
│   │   ├── app.js          # Main app logic, form handling
│   │   ├── api.js          # API client (fetch wrappers)
│   │   ├── preview.js      # Preview rendering logic
│   │   ├── auth.js         # Admin authentication (SHA-256)
│   │   └── validator.js    # Template validator (client-side)
│   └── css/
│       └── styles.css      # Minimal custom styles (Tailwind via CDN)
├── lambda/
│   ├── src/
│   │   ├── handlers/
│   │   │   ├── generateSignature.js
│   │   │   ├── previewSignature.js
│   │   │   └── extractFields.js
│   │   ├── services/
│   │   │   ├── templateEngine.js
│   │   │   ├── storageService.js
│   │   │   └── imageToolsClient.js
│   │   ├── providers/
│   │   │   ├── aiProvider.js        # Interface + factory
│   │   │   ├── bedrockProvider.js
│   │   │   └── azureOpenAIProvider.js
│   │   └── utils/
│   │       ├── validation.js
│   │       └── config.js
│   ├── package.json
│   └── tests/
│       ├── unit/
│       └── property/
├── templates/
│   ├── corporativa.mustache
│   ├── moderna-banner.mustache
│   └── minimalista.mustache
├── template.yaml              # SAM IaC
└── README.md
```

## Components

### 1. Frontend (Static S3 Website)

**Responsibilities:**
- Render the signature generation form with all required fields
- Send API requests to Lambda endpoints
- Display signature preview and final output
- Provide copy-to-clipboard functionality
- Handle admin authentication (client-side SHA-256)
- Run template validator for admin panel

**Technology:** Vanilla HTML/JS, Tailwind CSS via CDN, no build step.

### 2. Lambda Handlers

#### generateSignature Handler

```javascript
// lambda/src/handlers/generateSignature.js
const { storageService } = require('../services/storageService');
const { imageToolsClient } = require('../services/imageToolsClient');
const { templateEngine } = require('../services/templateEngine');
const { validateGenerateRequest } = require('../utils/validation');

exports.handler = async (event) => {
  const body = JSON.parse(event.body);
  const validation = validateGenerateRequest(body);
  if (!validation.valid) {
    return { statusCode: 400, body: JSON.stringify({ success: false, error: validation.error }) };
  }

  const { nombre, cargo, email, telefono, website, linkedin, templateId, image } = body;
  const imageBuffer = Buffer.from(image, 'base64');
  const imageKey = `originals/${Date.now()}-${nombre.replace(/\s/g, '_')}.png`;

  // Upload original
  const originalUrl = await storageService.upload(imageKey, imageBuffer, 'image/png');

  // Process banner via image-tools
  const bannerKey = `banners/${Date.now()}-${nombre.replace(/\s/g, '_')}-banner.png`;
  const bannerUrl = await imageToolsClient.createBanner(originalUrl, bannerKey);

  // Render template
  const fields = { nombre, cargo, email, telefono, website, linkedin, bannerUrl };
  const html = templateEngine.render(templateId, fields);

  return {
    statusCode: 200,
    headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true, html, bannerUrl })
  };
};
```

#### previewSignature Handler

```javascript
// lambda/src/handlers/previewSignature.js
const { templateEngine } = require('../services/templateEngine');

exports.handler = async (event) => {
  const { nombre, cargo, email, telefono, website, linkedin, templateId } = JSON.parse(event.body);

  const placeholderBanner = 'https://via.placeholder.com/600x100?text=Banner+Preview';
  const fields = { nombre, cargo, email, telefono, website, linkedin, bannerUrl: placeholderBanner };
  const html = templateEngine.render(templateId, fields);

  return {
    statusCode: 200,
    headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true, html })
  };
};
```

#### extractFields Handler

```javascript
// lambda/src/handlers/extractFields.js
const { getAIProvider } = require('../providers/aiProvider');

exports.handler = async (event) => {
  const { text } = JSON.parse(event.body);
  const provider = getAIProvider();

  const systemPrompt = `Extract contact information from the following text. Return ONLY a JSON object with these fields: nombre, cargo, email, telefono, website, linkedin. Use null for any field not found.`;

  const response = await provider.callModel(`${systemPrompt}\n\nText: ${text}`);
  const fields = JSON.parse(response);

  return {
    statusCode: 200,
    headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true, fields })
  };
};
```

### 3. Services

#### Template Engine

```javascript
// lambda/src/services/templateEngine.js
const Mustache = require('mustache');
const fs = require('fs');
const path = require('path');

const TEMPLATES = {
  corporativa: 'corporativa.mustache',
  'moderna-banner': 'moderna-banner.mustache',
  minimalista: 'minimalista.mustache'
};

function loadTemplate(templateId) {
  const filename = TEMPLATES[templateId];
  if (!filename) throw new Error(`Unknown template: ${templateId}`);
  return fs.readFileSync(path.join(__dirname, '../../../templates', filename), 'utf8');
}

function render(templateId, fields) {
  const template = loadTemplate(templateId);
  return Mustache.render(template, fields);
}

module.exports = { render, loadTemplate, TEMPLATES };
```

#### Storage Service

```javascript
// lambda/src/services/storageService.js
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getConfig } = require('../utils/config');

const s3 = new S3Client({});

async function upload(key, body, contentType) {
  const { bucketName } = getConfig();
  await s3.send(new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: body,
    ContentType: contentType
  }));
  return `https://${bucketName}.s3.amazonaws.com/${key}`;
}

module.exports = { upload };
```

#### Image-Tools Client

```javascript
// lambda/src/services/imageToolsClient.js
const { getConfig } = require('../utils/config');

async function createBanner(sourceImageUrl, targetKey) {
  const { imageToolsUrl, bucketName } = getConfig();
  if (!imageToolsUrl) {
    throw new Error('IMAGE_TOOLS_URL environment variable is not configured');
  }

  const response = await fetch(imageToolsUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceUrl: sourceImageUrl, targetKey, bucket: bucketName })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Image processing failed: ${response.status} - ${errorBody}`);
  }

  const result = await response.json();
  return result.bannerUrl;
}

module.exports = { createBanner };
```

### 4. AI Provider Abstraction

```javascript
// lambda/src/providers/aiProvider.js

/**
 * @typedef {Object} AIProvider
 * @property {(prompt: string) => Promise<string>} callModel
 */

function getAIProvider() {
  const provider = process.env.AI_PROVIDER || 'bedrock';
  switch (provider) {
    case 'azure':
      return require('./azureOpenAIProvider');
    case 'bedrock':
      return require('./bedrockProvider');
    default:
      throw new Error(`Unknown AI_PROVIDER: ${provider}`);
  }
}

module.exports = { getAIProvider };
```

```javascript
// lambda/src/providers/bedrockProvider.js
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

const client = new BedrockRuntimeClient({});

async function callModel(prompt) {
  const command = new InvokeModelCommand({
    modelId: process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-haiku-20240307-v1:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  const response = await client.send(command);
  const body = JSON.parse(new TextDecoder().decode(response.body));
  return body.content[0].text;
}

module.exports = { callModel };
```

```javascript
// lambda/src/providers/azureOpenAIProvider.js
async function callModel(prompt) {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;

  const response = await fetch(
    `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=2024-02-01`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1024
      })
    }
  );

  if (!response.ok) throw new Error(`Azure OpenAI error: ${response.status}`);
  const data = await response.json();
  return data.choices[0].message.content;
}

module.exports = { callModel };
```

### 5. Template Validator (Frontend)

```javascript
// frontend/js/validator.js

const REQUIRED_VARS = ['nombre', 'cargo', 'email', 'bannerUrl'];
const OUTLOOK_INCOMPATIBLE = ['flex', 'grid', 'position:absolute', 'position:relative', 'position:fixed'];

function validate(templateHtml) {
  const results = [];

  // Rule 1: Required variables
  for (const v of REQUIRED_VARS) {
    if (!templateHtml.includes(`{{${v}}}`)) {
      results.push({ level: 'ERROR', rule: 'required-var', message: `Missing required variable: {{${v}}}` });
    }
  }

  // Rule 2: Style blocks or linked stylesheets
  if (/<style[\s>]/i.test(templateHtml) || /<link[^>]*rel=["']stylesheet/i.test(templateHtml)) {
    results.push({ level: 'ERROR', rule: 'no-style-blocks', message: 'External or block styles detected' });
  }

  // Rule 3: Script tags
  if (/<script[\s>]/i.test(templateHtml)) {
    results.push({ level: 'ERROR', rule: 'no-scripts', message: 'Script tags detected' });
  }

  // Rule 4: Div with flex/grid
  if (/<div[^>]*style=["'][^"']*(?:display\s*:\s*(?:flex|grid))/i.test(templateHtml)) {
    results.push({ level: 'ERROR', rule: 'table-layout', message: 'Div with flex/grid layout detected' });
  }

  // Rule 5: Img missing dimensions
  const imgTags = templateHtml.match(/<img[^>]*>/gi) || [];
  for (const img of imgTags) {
    if (!/width=/i.test(img) || !/height=/i.test(img)) {
      results.push({ level: 'WARNING', rule: 'img-dimensions', message: 'Image missing explicit width/height' });
    }
  }

  // Rule 6: Max width > 600px
  const widthMatches = templateHtml.match(/width\s*[:=]\s*["']?(\d+)/gi) || [];
  for (const m of widthMatches) {
    const val = parseInt(m.match(/(\d+)/)[1]);
    if (val > 600) {
      results.push({ level: 'WARNING', rule: 'max-width', message: `Width ${val}px exceeds 600px maximum` });
    }
  }

  // Rule 7: Outlook-incompatible inline styles
  const styleAttrs = templateHtml.match(/style=["'][^"']*["']/gi) || [];
  for (const attr of styleAttrs) {
    for (const prop of OUTLOOK_INCOMPATIBLE) {
      if (attr.toLowerCase().includes(prop)) {
        results.push({ level: 'WARNING', rule: 'outlook-compat', message: `Outlook-incompatible CSS: ${prop}` });
      }
    }
  }

  // Rule 8: @import or external fonts
  if (/@import/i.test(templateHtml) || /<link[^>]*href=["'][^"']*font/i.test(templateHtml)) {
    results.push({ level: 'WARNING', rule: 'no-external-fonts', message: 'External font import detected' });
  }

  return results;
}

module.exports = { validate, REQUIRED_VARS };
```

### 6. Configuration

```javascript
// lambda/src/utils/config.js
function getConfig() {
  return {
    bucketName: process.env.S3_BUCKET_NAME,
    imageToolsUrl: process.env.IMAGE_TOOLS_URL,
    aiProvider: process.env.AI_PROVIDER || 'bedrock'
  };
}

module.exports = { getConfig };
```

### 7. Request Validation

```javascript
// lambda/src/utils/validation.js
const REQUIRED_FIELDS = ['nombre', 'cargo', 'email', 'telefono', 'templateId', 'image'];
const VALID_TEMPLATES = ['corporativa', 'moderna-banner', 'minimalista'];

function validateGenerateRequest(body) {
  for (const field of REQUIRED_FIELDS) {
    if (!body[field] || (typeof body[field] === 'string' && body[field].trim() === '')) {
      return { valid: false, error: `Missing required field: ${field}` };
    }
  }
  if (!VALID_TEMPLATES.includes(body.templateId)) {
    return { valid: false, error: `Invalid templateId: ${body.templateId}` };
  }
  return { valid: true };
}

module.exports = { validateGenerateRequest, REQUIRED_FIELDS, VALID_TEMPLATES };
```

## Interfaces

### API Endpoints

| Endpoint | Method | Request Body | Response |
|----------|--------|-------------|----------|
| `/generate-signature` | POST | `{ nombre, cargo, email, telefono, website?, linkedin?, templateId, image (base64) }` | `{ success: true, html, bannerUrl }` |
| `/preview-signature` | POST | `{ nombre, cargo, email, telefono?, website?, linkedin?, templateId }` | `{ success: true, html }` |
| `/extract-fields` | POST | `{ text }` | `{ success: true, fields: { nombre, cargo, email, telefono, website, linkedin } }` |

### Error Response Format

```json
{
  "success": false,
  "error": "Descriptive error message"
}
```

### AI Provider Interface

```typescript
interface AIProvider {
  callModel(prompt: string): Promise<string>;
}
```

### Template Engine Interface

```typescript
function render(templateId: string, fields: SignatureFields): string;
function loadTemplate(templateId: string): string;
```

### Storage Service Interface

```typescript
function upload(key: string, body: Buffer, contentType: string): Promise<string>;
```

## Data Models

### SignatureFields

```javascript
{
  nombre: string,       // Required
  cargo: string,        // Required
  email: string,        // Required
  telefono: string,     // Required
  website: string|null, // Optional
  linkedin: string|null,// Optional
  bannerUrl: string     // Generated by system
}
```

### ValidatorResult

```javascript
{
  level: 'ERROR' | 'WARNING',
  rule: string,
  message: string
}
```

### GenerateSignatureRequest

```javascript
{
  nombre: string,
  cargo: string,
  email: string,
  telefono: string,
  website?: string,
  linkedin?: string,
  templateId: 'corporativa' | 'moderna-banner' | 'minimalista',
  image: string  // base64 encoded
}
```

## Error Handling

| Scenario | Handler | Response |
|----------|---------|----------|
| Missing required fields | validation.js | 400: `{ success: false, error: "Missing required field: X" }` |
| Invalid templateId | validation.js | 400: `{ success: false, error: "Invalid templateId: X" }` |
| IMAGE_TOOLS_URL not configured | imageToolsClient.js | 500: `{ success: false, error: "IMAGE_TOOLS_URL environment variable is not configured" }` |
| image-tools returns error | imageToolsClient.js | 500: `{ success: false, error: "Image processing failed: STATUS - BODY" }` |
| AI provider returns invalid JSON | extractFields.js | 500: `{ success: false, error: "Failed to parse AI response" }` |
| Unknown AI_PROVIDER value | aiProvider.js | 500: `{ success: false, error: "Unknown AI_PROVIDER: X" }` |
| S3 upload failure | storageService.js | 500: `{ success: false, error: "Storage upload failed: MESSAGE" }` |

## SAM Template Structure

```yaml
# template.yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Globals:
  Function:
    Runtime: nodejs20.x
    Timeout: 30
    MemorySize: 256
    Environment:
      Variables:
        S3_BUCKET_NAME: !Ref AssetsBucket
        IMAGE_TOOLS_URL: !Ref ImageToolsUrl
        AI_PROVIDER: !Ref AIProvider

Parameters:
  ImageToolsUrl:
    Type: String
  AIProvider:
    Type: String
    Default: bedrock

Resources:
  SignatureApi:
    Type: AWS::Serverless::HttpApi
    Properties:
      CorsConfiguration:
        AllowOrigins: ["*"]
        AllowMethods: ["POST", "OPTIONS"]
        AllowHeaders: ["Content-Type"]

  GenerateSignatureFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: src/handlers/generateSignature.handler
      CodeUri: lambda/
      Events:
        Api:
          Type: HttpApi
          Properties:
            ApiId: !Ref SignatureApi
            Path: /generate-signature
            Method: POST

  PreviewSignatureFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: src/handlers/previewSignature.handler
      CodeUri: lambda/
      Events:
        Api:
          Type: HttpApi
          Properties:
            ApiId: !Ref SignatureApi
            Path: /preview-signature
            Method: POST

  ExtractFieldsFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: src/handlers/extractFields.handler
      CodeUri: lambda/
      Events:
        Api:
          Type: HttpApi
          Properties:
            ApiId: !Ref SignatureApi
            Path: /extract-fields
            Method: POST

  AssetsBucket:
    Type: AWS::S3::Bucket
    Properties:
      PublicAccessBlockConfiguration:
        BlockPublicAcls: false
        BlockPublicPolicy: false
        IgnorePublicAcls: false
        RestrictPublicBuckets: false

  AssetsBucketPolicy:
    Type: AWS::S3::BucketPolicy
    Properties:
      Bucket: !Ref AssetsBucket
      PolicyDocument:
        Statement:
          - Effect: Allow
            Principal: "*"
            Action: s3:GetObject
            Resource: !Sub "${AssetsBucket.Arn}/*"

  FrontendBucket:
    Type: AWS::S3::Bucket
    Properties:
      WebsiteConfiguration:
        IndexDocument: index.html
      PublicAccessBlockConfiguration:
        BlockPublicAcls: false
        BlockPublicPolicy: false
        IgnorePublicAcls: false
        RestrictPublicBuckets: false

Outputs:
  ApiUrl:
    Value: !Sub "https://${SignatureApi}.execute-api.${AWS::Region}.amazonaws.com"
  FrontendUrl:
    Value: !GetAtt FrontendBucket.WebsiteURL
  AssetsBucketName:
    Value: !Ref AssetsBucket
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Storage path invariant

*For any* image uploaded via generate-signature, the original SHALL be stored under a key starting with `originals/` and the processed banner SHALL be stored under a key starting with `banners/`.

**Validates: Requirements 1.3, 1.4, 6.1, 6.2**

### Property 2: Template rendering includes all provided fields

*For any* valid set of signature fields and any valid templateId, the rendered HTML output SHALL contain the values of nombre, cargo, and email from the input fields.

**Validates: Requirements 1.5, 5.3**

### Property 3: Preview uses placeholder banner without image processing

*For any* preview-signature request with valid fields and templateId, the rendered HTML SHALL contain a placeholder banner URL and the image-tools service SHALL NOT be invoked.

**Validates: Requirements 4.2, 4.3**

### Property 4: Successful response structure

*For any* successful Lambda response from generate-signature, preview-signature, or extract-fields, the response body SHALL contain `success: true` and the endpoint-specific payload (html+bannerUrl, html, or fields respectively).

**Validates: Requirements 1.6, 2.4**

### Property 5: AI extraction returns all required field keys

*For any* text input to the extract-fields endpoint, the AI provider response when parsed SHALL contain all keys: nombre, cargo, email, telefono, website, linkedin (with null for unfound fields).

**Validates: Requirements 2.3, 3.5**

### Property 6: Template validator detects ERROR violations

*For any* template HTML that contains a `<style>` block, `<link rel="stylesheet">`, `<script>` tag, div with flex/grid layout, or is missing a required variable (nombre, cargo, email, bannerUrl), the validator SHALL return at least one result with level `ERROR` identifying the violation.

**Validates: Requirements 9.1, 9.2, 9.3, 9.4**

### Property 7: Template validator detects WARNING violations

*For any* template HTML that contains an `<img>` without explicit width/height, a width exceeding 600px, Outlook-incompatible inline CSS (flex, grid, position), or @import/external font references, the validator SHALL return at least one result with level `WARNING` identifying the violation.

**Validates: Requirements 9.5, 9.6, 9.7, 9.8**

### Property 8: External service error propagation

*For any* request where the image-tools service is unavailable or returns an error, the Lambda response SHALL contain `success: false` and an error message that describes the image processing failure including the service response status or unavailability reason.

**Validates: Requirements 6.4, 7.3**

### Property 9: SHA-256 password authentication correctness

*For any* password string, computing its SHA-256 hash and comparing against the stored hash SHALL return true if and only if the password matches the original password used to generate the stored hash.

**Validates: Requirements 8.2**

### Property 10: Form pre-fill from extracted fields

*For any* extracted fields object returned by the AI provider, all non-null field values SHALL be populated into the corresponding form inputs when the Frontend receives the response.

**Validates: Requirements 2.5**

### Property 11: Request validation rejects invalid input

*For any* generate-signature request body missing one or more required fields (nombre, cargo, email, telefono, templateId, image) or containing an invalid templateId, the handler SHALL return a 400 status with `success: false` and a descriptive error message.

**Validates: Requirements 1.2**
