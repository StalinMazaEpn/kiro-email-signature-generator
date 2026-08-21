# Requirements Document

## Introduction

Este documento especifica los requisitos para implementar soporte de plantillas privadas en el generador de firmas de email. El sistema actualmente almacena todas las plantillas en `lambda/templates/` y las commitea al repositorio Git. Esta funcionalidad permitirá a los usuarios extender las plantillas disponibles con plantillas propietarias sin exponerlas en el repositorio público, mientras mantiene un catálogo centralizado de metadatos en `TEMPLATE_CATALOG`.

## Glossary

- **System**: El generador de firmas de email completo
- **Template_Engine**: El servicio `templateEngine.js` responsable de cargar y renderizar plantillas Mustache
- **Template_Catalog**: El objeto `TEMPLATE_CATALOG` en `lambda/src/config/templates.js` que contiene metadatos de todas las plantillas
- **Public_Template**: Plantilla almacenada en `lambda/templates/` y commiteada en Git
- **Private_Template**: Plantilla almacenada en `lambda/templates-private/` y excluida de Git mediante `.gitignore`
- **Template_Metadata**: Objeto con id, file, name, description y requiredFields de una plantilla
- **Template_File**: Archivo físico `.mustache` en el sistema de archivos

## Requirements

### Requirement 1: Separar Plantillas Públicas y Privadas en el Sistema de Archivos

**User Story:** Como usuario del sistema, quiero poder almacenar plantillas privadas en una carpeta separada, para que no se expongan en el repositorio público.

#### Acceptance Criteria

1. THE System SHALL mantener las plantillas públicas en `lambda/templates/`
2. THE System SHALL soportar plantillas privadas en `lambda/templates-private/`
3. THE System SHALL excluir `lambda/templates-private/` del repositorio Git mediante una entrada en `.gitignore`
4. WHEN el directorio `lambda/templates-private/` no existe, THE System SHALL funcionar normalmente usando solo plantillas públicas

### Requirement 2: Centralizar Metadatos de Todas las Plantillas

**User Story:** Como desarrollador del sistema, quiero mantener todos los metadatos de plantillas en `TEMPLATE_CATALOG`, para que exista una única fuente de verdad sobre las plantillas disponibles.

#### Acceptance Criteria

1. THE Template_Catalog SHALL contener metadatos de plantillas públicas y privadas
2. THE Template_Catalog SHALL incluir los campos id, file, name, description y requiredFields para cada plantilla
3. THE Template_Catalog SHALL permanecer en `lambda/src/config/templates.js` y commitearse en Git
4. THE Template_Catalog SHALL NO contener información sensible de las plantillas privadas más allá de los metadatos descriptivos

### Requirement 3: Implementar Búsqueda Priorizada de Plantillas

**User Story:** Como Template_Engine, quiero buscar plantillas en múltiples ubicaciones con prioridad, para que las plantillas privadas puedan sobrescribir las públicas si es necesario.

#### Acceptance Criteria

1. WHEN el Template_Engine carga una plantilla, THE Template_Engine SHALL buscar primero en `lambda/templates-private/`
2. IF el archivo no existe en `lambda/templates-private/`, THEN THE Template_Engine SHALL buscar en `lambda/templates/`
3. IF el archivo no existe en ninguna ubicación, THEN THE Template_Engine SHALL lanzar un error descriptivo indicando las ubicaciones buscadas
4. THE Template_Engine SHALL resolver rutas absolutas correctamente para ambas ubicaciones

### Requirement 4: Validar Existencia Física de Plantillas

**User Story:** Como Template_Engine, quiero verificar que los archivos de plantillas existen antes de intentar cargarlos, para que el sistema falle gracefully cuando una plantilla referenciada no está disponible.

#### Acceptance Criteria

1. WHEN el Template_Engine intenta cargar una plantilla, THE Template_Engine SHALL verificar la existencia del archivo físico antes de leerlo
2. IF el Template_File referenciado en Template_Catalog no existe físicamente, THEN THE Template_Engine SHALL lanzar un error con el mensaje "Template file not found: {templateId} ({filename}). Searched in: {paths}"
3. THE Template_Engine SHALL incluir todas las rutas buscadas en el mensaje de error
4. THE Template_Engine SHALL mantener la compatibilidad con el comportamiento actual para plantillas existentes

### Requirement 5: Mantener Compatibilidad con la API Existente

**User Story:** Como código cliente del Template_Engine, quiero que la API pública no cambie, para que el código existente continúe funcionando sin modificaciones.

#### Acceptance Criteria

1. THE Template_Engine SHALL mantener las funciones exportadas: render, loadTemplate, getTemplateList, getTemplateVariables, TEMPLATES
2. THE Template_Engine SHALL mantener las firmas de las funciones sin cambios
3. THE Template_Engine SHALL seguir leyendo Template_Catalog desde `lambda/src/config/templates.js`
4. THE Template_Engine SHALL mantener la lógica de transformación de datos para plantillas con esquema estándar y legacy

### Requirement 6: Soportar Configuración del Directorio de Plantillas Privadas

**User Story:** Como administrador del sistema, quiero poder configurar la ubicación del directorio de plantillas privadas, para que pueda adaptarse a diferentes entornos de despliegue.

#### Acceptance Criteria

1. THE System SHALL leer la ubicación del directorio de plantillas privadas desde una variable de entorno `PRIVATE_TEMPLATES_DIR`
2. IF `PRIVATE_TEMPLATES_DIR` no está definida, THEN THE System SHALL usar `lambda/templates-private/` como valor por defecto
3. THE System SHALL resolver rutas relativas con respecto al directorio del módulo `templateEngine.js`
4. THE System SHALL funcionar correctamente con rutas absolutas y relativas en `PRIVATE_TEMPLATES_DIR`

### Requirement 7: Documentar el Sistema de Plantillas Privadas

**User Story:** Como desarrollador nuevo en el proyecto, quiero entender cómo funcionan las plantillas privadas, para que pueda añadir mis propias plantillas sin cometer errores.

#### Acceptance Criteria

1. THE System SHALL incluir comentarios en `templateEngine.js` explicando la búsqueda priorizada
2. THE System SHALL incluir comentarios en `templates.js` explicando que puede contener metadatos de plantillas públicas y privadas
3. THE System SHALL documentar en el README o documentación técnica cómo añadir plantillas privadas
4. THE System SHALL incluir un ejemplo de entrada en `.gitignore` para el directorio de plantillas privadas

### Requirement 8: Garantizar Seguridad en el Manejo de Plantillas Privadas

**User Story:** Como administrador de seguridad, quiero asegurarme de que las plantillas privadas no se expongan accidentalmente, para que la información propietaria permanezca confidencial.

#### Acceptance Criteria

1. THE System SHALL verificar que `lambda/templates-private/` está en `.gitignore` durante la inicialización
2. IF `lambda/templates-private/` NO está en `.gitignore` y el directorio existe, THEN THE System SHALL registrar una advertencia en los logs
3. THE System SHALL NO commitear accidentalmente archivos del directorio de plantillas privadas
4. THE Template_Catalog commiteado en Git SHALL NO contener rutas absolutas o información sensible de plantillas privadas
