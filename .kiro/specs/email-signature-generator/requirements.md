# Requirements Document

## Introduction

Self-service web application that enables employees to generate corporate email signatures. The application supports two input flows: manual field entry and AI-assisted extraction from free text. Users select from three HTML templates, upload a profile photo, and receive a ready-to-use HTML signature with assets hosted on AWS S3. An admin panel provides template validation and basic authentication.

## Glossary

- **Signature_App**: The complete email signature generator system including frontend, Lambda backend, and S3 storage
- **Frontend**: Vanilla HTML/JS + Tailwind CDN static website hosted on S3
- **Lambda_Backend**: AWS Lambda Node.js functions deployed via AWS SAM behind API Gateway
- **S3_Storage**: AWS S3 bucket with public access containing `/originals/` and `/banners/` folders
- **Template_Engine**: Mustache-based HTML template renderer for email signatures
- **AI_Provider**: Abstracted AI service (Azure OpenAI or Bedrock) for field extraction from free text
- **Template_Validator**: Admin tool that checks templates against 8 email-compatibility rules
- **Employee**: End user who generates their email signature
- **Admin**: Authenticated user who manages and validates templates
- **image-tools**: External image processing service with URL configured via environment variable

## Requirements

### Requirement 1: Manual Signature Generation

**User Story:** As an Employee, I want to fill in my contact details manually and upload my photo, so that I can generate a corporate email signature without relying on AI.

#### Acceptance Criteria

1. THE Frontend SHALL display a form with fields for nombre, cargo, email, telefono, website (optional), linkedin (optional), template selection, and image upload.
2. WHEN the Employee submits the form with all required fields and an image, THE Lambda_Backend SHALL process the request via POST /generate-signature endpoint.
3. WHEN the Lambda_Backend receives a valid generate-signature request, THE Lambda_Backend SHALL upload the image to S3_Storage under the `/originals/` folder.
4. WHEN the image is uploaded successfully, THE Lambda_Backend SHALL invoke image-tools to produce a banner and store the result in S3_Storage under the `/banners/` folder.
5. WHEN the banner is stored, THE Template_Engine SHALL render the selected template with the provided fields and the public banner URL.
6. WHEN rendering is complete, THE Lambda_Backend SHALL return a JSON response containing success status, rendered HTML, and bannerUrl.
7. WHEN the Employee receives the generated signature HTML, THE Frontend SHALL display the rendered signature and provide a copy-to-clipboard action.

### Requirement 2: AI-Assisted Field Extraction

**User Story:** As an Employee, I want to paste free-form text and have AI extract my contact details, so that I can generate my signature faster without filling each field manually.

#### Acceptance Criteria

1. THE Frontend SHALL provide a text area where the Employee can paste free-form text describing their contact information.
2. WHEN the Employee submits free text, THE Frontend SHALL send a POST /extract-fields request to the Lambda_Backend with the text payload.
3. WHEN the Lambda_Backend receives an extract-fields request, THE AI_Provider SHALL parse the free text and return extracted fields (nombre, cargo, email, telefono, website, linkedin) as a JSON object.
4. WHEN the AI_Provider returns extracted fields, THE Lambda_Backend SHALL respond with a JSON object containing success status and the fields object.
5. WHEN the Frontend receives extracted fields, THE Frontend SHALL pre-fill the signature form with the extracted values.
6. WHEN the form is pre-filled, THE Employee SHALL be able to review, edit, or complete any fields before generating the signature.

### Requirement 3: AI Provider Abstraction

**User Story:** As a developer, I want to switch AI providers via environment variable, so that the system can use Azure OpenAI for development and Bedrock for demos without code changes.

#### Acceptance Criteria

1. THE Lambda_Backend SHALL define an AI provider interface with a single method callModel(prompt) that returns a string response.
2. THE Lambda_Backend SHALL include two provider implementations: bedrockProvider.js and azureOpenAIProvider.js.
3. WHEN the environment variable AI_PROVIDER is set to "azure", THE Lambda_Backend SHALL use azureOpenAIProvider for field extraction.
4. WHEN the environment variable AI_PROVIDER is set to "bedrock", THE Lambda_Backend SHALL use bedrockProvider for field extraction.
5. THE AI_Provider SHALL send a system prompt for field extraction and the user text as input, expecting a JSON-only response.

### Requirement 4: Signature Preview

**User Story:** As an Employee, I want to preview my signature before uploading an image, so that I can verify the layout and content quickly.

#### Acceptance Criteria

1. WHEN the Employee requests a preview, THE Frontend SHALL send a POST /preview-signature request with form fields and templateId but without image data.
2. WHEN the Lambda_Backend receives a preview-signature request, THE Template_Engine SHALL render the selected template with provided fields and a placeholder for the banner.
3. WHEN rendering is complete, THE Lambda_Backend SHALL return a JSON response containing success status and rendered HTML without performing image processing.

### Requirement 5: Template System

**User Story:** As an Employee, I want to choose from three distinct email signature templates, so that I can select the style that best fits my needs.

#### Acceptance Criteria

1. THE Template_Engine SHALL support three templates: Corporativa, Moderna con Banner, and Minimalista.
2. THE Template_Engine SHALL use Mustache syntax for variable interpolation in templates.
3. THE Template_Engine SHALL require the variables {{nombre}}, {{cargo}}, {{email}}, and {{bannerUrl}} in every template.
4. THE Template_Engine SHALL render templates using table-based layout with all styles inline for email client compatibility.

### Requirement 6: Image Storage

**User Story:** As an Employee, I want my uploaded photo to be stored reliably and served via a public URL, so that my email signature displays correctly in all email clients.

#### Acceptance Criteria

1. WHEN the Lambda_Backend receives an image via generate-signature, THE Lambda_Backend SHALL store the original image in S3_Storage under the `/originals/` path.
2. WHEN the original image is stored, THE Lambda_Backend SHALL produce a processed banner and store the result in S3_Storage under the `/banners/` path.
3. THE S3_Storage SHALL serve stored images via direct public URLs without authentication.
4. IF the image-tools service is unavailable, THEN THE Lambda_Backend SHALL return a clear error message indicating image processing failure.

### Requirement 7: Image-Tools Integration

**User Story:** As a developer, I want image-tools URL to be configurable via environment variable, so that the service endpoint can change between environments without code changes.

#### Acceptance Criteria

1. THE Lambda_Backend SHALL read the image-tools service URL from an environment variable.
2. WHEN the image-tools environment variable is not configured, THE Lambda_Backend SHALL fail with a clear error message indicating the missing configuration.
3. IF the image-tools service returns an error, THEN THE Lambda_Backend SHALL propagate a descriptive error to the Frontend.

### Requirement 8: Admin Authentication

**User Story:** As an Admin, I want to access the admin panel with basic authentication, so that only authorized users can manage templates.

#### Acceptance Criteria

1. THE Frontend SHALL display a login form for admin access.
2. WHEN the Admin submits credentials, THE Frontend SHALL validate the password by comparing its SHA-256 hash against the stored hash in JavaScript.
3. WHEN authentication succeeds, THE Frontend SHALL store the session in sessionStorage and grant access to admin features.
4. WHEN authentication fails, THE Frontend SHALL display an error message and deny access to admin features.

### Requirement 9: Template Validator

**User Story:** As an Admin, I want to validate templates against email compatibility rules, so that I can ensure signatures render correctly across email clients.

#### Acceptance Criteria

1. THE Template_Validator SHALL check for required variables ({{nombre}}, {{cargo}}, {{email}}, {{bannerUrl}}) and report missing variables as ERROR.
2. THE Template_Validator SHALL detect `<style>` blocks or `<link rel="stylesheet">` tags and report them as ERROR.
3. THE Template_Validator SHALL detect `<script>` tags and report them as ERROR.
4. THE Template_Validator SHALL verify table-based layout and report usage of div with flex or grid as ERROR.
5. THE Template_Validator SHALL check that `<img>` elements include explicit width and height attributes and report missing dimensions as WARNING.
6. THE Template_Validator SHALL verify maximum width does not exceed 600px and report violations as WARNING.
7. THE Template_Validator SHALL detect CSS properties incompatible with Outlook (flexbox, grid, position) in inline styles and report them as WARNING.
8. THE Template_Validator SHALL detect @import rules or `<link>` to external fonts and report them as WARNING.

### Requirement 10: Infrastructure and Deployment

**User Story:** As a developer, I want the application deployed via AWS SAM, so that infrastructure is reproducible and version-controlled.

#### Acceptance Criteria

1. THE Signature_App SHALL be defined in a SAM template.yaml file describing Lambda functions, API Gateway, and S3 bucket resources.
2. THE Signature_App SHALL organize source code in a monorepo with `/frontend`, `/lambda`, and `/templates` directories.
3. WHEN deployed via SAM, THE Lambda_Backend SHALL be accessible through API Gateway with the defined endpoints (POST /generate-signature, POST /preview-signature, POST /extract-fields).
4. WHEN deployed via SAM, THE Frontend SHALL be hosted as an S3 Static Website.

### Requirement 11: Documentation

**User Story:** As a developer or stakeholder, I want comprehensive documentation with architecture diagrams, so that the system is understandable and presentable.

#### Acceptance Criteria

1. THE Signature_App SHALL include a README file with a Mermaid architecture diagram showing system components and data flow.
2. THE Signature_App SHALL include a 3-minute video demo script documenting the key user flows and features.
