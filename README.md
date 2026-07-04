<div align="center">
  
## NoteFlow: Bloc de notas

  
<img src="static/logocircular.png" width="100" alt="Logo NoteFlow">
&nbsp;&nbsp;&nbsp;&nbsp;

<hr>


</div>

**Sistema web de gestión de notas personales — Proyecto SENA**

[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-2.x-000000?style=for-the-badge&logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![Jinja2](https://img.shields.io/badge/Jinja2-Templates-B41717?style=for-the-badge&logo=jinja&logoColor=white)](https://jinja.palletsprojects.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Supabase](https://img.shields.io/badge/Supabase-DB_%26_Storage-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/es/docs/Web/JavaScript)
[![Fetch API](https://img.shields.io/badge/Fetch_API-Async-FF6B35?style=for-the-badge&logo=javascript&logoColor=white)](https://developer.mozilla.org/es/docs/Web/API/Fetch_API)
[![Web Audio API](https://img.shields.io/badge/Web_Audio_API-Waveform-8B5CF6?style=for-the-badge&logo=audiomack&logoColor=white)](https://developer.mozilla.org/es/docs/Web/API/Web_Audio_API)
[![Canvas API](https://img.shields.io/badge/Canvas_API-Drawing-E34F26?style=for-the-badge&logo=html5&logoColor=white)](https://developer.mozilla.org/es/docs/Web/API/Canvas_API)
[![MediaRecorder](https://img.shields.io/badge/MediaRecorder-Recording-FF5722?style=for-the-badge&logo=javascript&logoColor=white)](https://developer.mozilla.org/es/docs/Web/API/MediaRecorder)
[![Google OAuth](https://img.shields.io/badge/Google-OAuth_2.0-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://developers.google.com/identity)
[![Railway](https://img.shields.io/badge/Railway-Deployed-0B0D0E?style=for-the-badge&logo=railway&logoColor=white)](https://railway.app/)
[![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-CI/CD-2088FF?style=for-the-badge&logo=githubactions&logoColor=white)](https://github.com/features/actions)
[![HTML5](https://img.shields.io/badge/HTML5-Semántico-E34F26?style=for-the-badge&logo=html5&logoColor=white)](https://developer.mozilla.org/es/docs/Web/HTML)
[![CSS3](https://img.shields.io/badge/CSS3-Custom_Design-1572B6?style=for-the-badge&logo=css3&logoColor=white)](https://developer.mozilla.org/es/docs/Web/CSS)

</div>

---

## 📖 ¿Qué es NoteFlow?

NoteFlow es una aplicación web de gestión de notas personales que permite crear, organizar y personalizar notas en múltiples formatos: **texto, imágenes, audios, videos y dibujos**. Los usuarios pueden agruparlas en carpetas, asignarles etiquetas y elegir entre modo claro u oscuro según sus preferencias.

> Proyecto desarrollado como evidencia de aprendizaje del **Técnico en Programación de Software** en el SENA, integrando conocimientos de frontend, backend y base de datos bajo la metodología **SCRUM**.

---

## 👥 Equipo de desarrollo

| Nombre | Rol |
|--------|-----|
| Javier Steven Solís Ruiz | Desarrollador |
| Johan Sebastian Jojoa Meneses | Desarrollador |
| Juan Diego Monsalve Martínez | Desarrollador |
| Sergio Andrés Bustos Mondragón | Líder funcional |
| Juan Alejandro Tamayo Manzano | Documentador |

---

## 🧩 Características principales

- 🔐 **Autenticación** — Registro e inicio de sesión con validaciones de correo, alias y contraseña. Verificación por código al registrarse. Login con Google OAuth.
- 🌙 **Temas** — Modo claro / oscuro personalizable por usuario.
- 📝 **Notas multiformat** — Texto enriquecido, imágenes editables, audios con forma de onda, videos con reproductor, y dibujos en pizarra interactiva.
- 🗂️ **Organización** — Carpetas, etiquetas personalizadas y categorías.
- 🗑️ **Papelera** — Eliminación segura con restauración y vaciado automático a los 30 días.
- 🔍 **Búsqueda avanzada** — Por notas o carpetas, con filtros dinámicos.
- 🌐 **API REST** — Backend con Flask y comunicación vía Fetch API.
- 📄 **Documentación SCRUM** — Product Backlog, Sprints e Historias de Usuario.

---

## ⚙️ Tecnologías utilizadas

### 🖥️ Frontend

| Tecnología | Uso |
|------------|-----|
| HTML5 | Estructura semántica de todas las vistas |
| CSS3 | Sistema de diseño propio con variables y animaciones |
| JavaScript ES6+ | Lógica de cada editor, validaciones y eventos |
| React 18 | Panel administrativo con componentes reutilizables (admin-react) |
| Vite 5 | Empaquetado del panel administrativo React |
| Fetch API | Comunicación asíncrona con el backend (sin recargar página) |
| Web Audio API | Decodificación y visualización de forma de onda en el editor de audio |
| MediaRecorder API | Grabación de audio y video desde el micrófono/cámara del usuario |
| Canvas API | Editor de dibujo e imagen con trazos, filtros y transformaciones |
| Recharts | Gráficos y estadísticas en el panel de administración |
| Lucide React | Iconografía del panel React |

### ⚙️ Backend

| Tecnología | Uso |
|------------|-----|
| Python 3.10+ | Lenguaje principal del servidor |
| Flask 2.x | Framework web — rutas, sesiones y API REST |
| Jinja2 | Motor de plantillas HTML renderizadas desde el servidor |
| psycopg2 | Driver Python para conectar y operar con PostgreSQL |
| Flask-Mail | Envío de correos (verificación de cuenta, recuperación de contraseña) |
| Werkzeug | Hashing seguro de contraseñas y utilidades HTTP |
| python-dotenv | Carga de variables de entorno desde el archivo `.env` |
| APScheduler | Tareas programadas en segundo plano (limpieza, seguridad) |
| Bleach | Sanitización de HTML para prevenir XSS |
| Flask-Talisman | Cabeceras de seguridad HTTP (CSP, HSTS) |
| Flask-Limiter | Límite de peticiones para prevenir abusos |
| Flask-WTF | Protección CSRF en formularios |
| google-api-python-client | Envío de correos mediante Gmail API (OAuth, sin SMTP) |

### 🔐 Autenticación

| Tecnología | Uso |
|------------|-----|
| Google OAuth 2.0 | Inicio de sesión con cuenta Google |
| google-auth-oauthlib | Manejo del flujo OAuth desde Flask |
| Códigos de verificación | Validación del correo al registrarse (6 dígitos, expira en 15 min) |
| Tokens de reset | Recuperación segura de contraseña con enlace de un solo uso |

### 🗄️ Base de datos e infraestructura

| Tecnología | Uso |
|------------|-----|
| Supabase DB | Base de datos relacional (PostgreSQL administrado en la nube con SSL) |
| Supabase Storage | Almacenamiento seguro en la nube para audios, videos, fotos y dibujos |
| Supabase Dashboard | Panel en la nube para la gestión de base de datos y almacenamiento |
| Docker | Contenedorización del backend (Flask) |
| Docker Compose | Orquestación de los contenedores locales de la aplicación |
| Railway | Plataforma de despliegue en producción |
| GitHub Container Registry | Registro de imágenes Docker publicadas automáticamente |
| GitHub Actions | CI/CD — build y push de imagen Docker en cada push a `main` |

### 🛠️ Herramientas y metodología

| Herramienta | Uso |
|------------|-----|
| Git / GitHub | Control de versiones y colaboración del equipo |
| Pytest | Pruebas automatizadas del backend (rutas, configuraciones, utilidades) |
| Draw.io | Diagramas de casos de uso, flujo y base de datos |
| SCRUM | Metodología ágil — Backlog, Sprints, Historias de Usuario |
| Word | Documentación técnica y requerimientos |

---

## 🚀 Instalación y puesta en marcha

### Requisitos previos

- [Git](https://git-scm.com/)
- [Docker](https://www.docker.com/) y Docker Compose

### 1. Clonar el repositorio

```bash
git clone https://github.com/Sergio-Bustos/NoteFlow
cd NoteFlow
```

### 2. Obtener el archivo `.env`

El archivo `.env` contiene las credenciales de la base de datos y configuración del entorno. Solo los programadores oficiales del proyecto tienen acceso.

> 🔒 **Acceso restringido:** [Descargar `.env` desde Google Drive](https://drive.google.com/drive/folders/1j6oWPRPDeAs3kQf88-q5krcMAhVzE79K?usp=sharing)

Coloca el archivo `.env` en la raíz del proyecto una vez descargado.

### 3. Levantar los servicios con Docker

**Opción A — Build local (tradicional):**

```bash
docker-compose up --build
```

**Opción B — Imagen ya empaquetada (más rápido):**

```bash
git clone https://github.com/Sergio-Bustos/NoteFlow
cd NoteFlow
docker pull ghcr.io/sergio-bustos/noteflow:latest
docker run -p 5000:5000 --env-file .env ghcr.io/sergio-bustos/noteflow
```

> ⚠️ El `--env-file` usa una ruta **desde donde ejecutas el comando**. Debes ejecutarlo desde la raíz del proyecto (donde está el `.env`). Sin el `.env` la imagen no podrá conectarse a la base de datos.

La imagen se actualiza automáticamente con cada push a `main`. Cualquiera de las dos opciones levanta Flask en el puerto `5000` conectándose a Supabase.


### 4. Acceder a la aplicación

| Servicio | URL |
|----------|-----|
| 🖥️ Aplicativo principal local | `http://127.0.0.1:5000` |
| 🗄️ Consola de Supabase | `https://supabase.com/dashboard` |
| 🌐 Aplicativo principal web | `https://noteflow-production-a5ed.up.railway.app`|

### 5. Acceso en red local

Para que otros dispositivos en tu red puedan acceder, obtén tu IP local:

```bash
# Windows
ipconfig

# Linux / macOS
ip addr
```

Luego accede desde cualquier dispositivo con:

```
http://<tu-ip-local>:5000
# Ejemplo: http://192.168.1.100:5000
```


### 6. Verificar la base de datos

Asegúrate de que el contenedor de Flask esté corriendo correctamente y de que las credenciales de Supabase en el archivo `.env` estén bien configuradas. Puedes verificar el estado con:

```bash
docker ps
docker logs "noteflow-app"
```

---


## 📁 Estructura del proyecto

```
NoteFlow/
├── app.py                      # Aplicación principal Flask
├── Dockerfile                  # Build de Docker
├── docker-compose.yml          # Servicios Docker
├── requirements.txt            # Dependencias Python
├── .env                        # Variables de entorno (no incluido en el repo)
├── .gitignore                  # Ignorados de Git
│
├── admin-react/                # Panel admin en React (Vite)
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── index.css
│       └── components/
│           ├── AnalyticsReport.jsx
│           ├── DashboardStats.jsx
│           ├── NfModal.jsx
│           ├── SupportChat.jsx
│           ├── UserActivityModal.jsx
│           └── UsersManagement.jsx
│
├── init-db/
│   └── schema.sql              # Schema de la base de datos
│
├── scratch/
│   └── cleanup_storage.py      # Limpieza de archivos huérfanos en Supabase
│
├── Manuales-NoteFlow/          # Documentación PDF
│   ├── Manual de Instalacion - NoteFlow- V01.pdf
│   ├── Manual de Usuario - NoteFlow - V01.pdf
│   └── Manual Tecnico - NoteFlow - V01.pdf
│
├── static/
│   ├── admin-react/dist/       # Build del panel React
│   ├── css/                    # Hojas de estilo
│   ├── js/                     # Lógica de cada editor
│   ├── images/                 # Assets gráficos
│   ├── video/                  # Videos promocionales
│   ├── perfil/                 # Fotos de perfil
│   └── uploads/                # Archivos subidos por usuarios
│       ├── audios/
│       ├── dibujos/
│       ├── imagenes/
│       ├── textos/
│       ├── videos/
│       └── profile/
│
├── templates/                  # Plantillas HTML (Jinja2)
│   ├── partials/
│   │   ├── head_design.html
│   │   └── support_widget.html
│   ├── errors/
│   │   ├── 404.html
│   │   └── 500.html
│   ├── dashboard.html
│   ├── notas.html
│   ├── editoraudio.html
│   ├── editorvideo.html
│   ├── editorimagen.html
│   ├── editortexto.html
│   ├── editormixta.html
│   ├── dibujo.html
│   ├── papalera.html
│   ├── pasarela.html
│   ├── perfil.html
│   ├── planes.html
│   └── ... (+ otros)
│
└── tests/                      # Pruebas automatizadas
    ├── conftest.py
    ├── test_config.py
    ├── test_rutas.py
    └── test_utilidades.py
```

---

## 📜 Licencia

Proyecto académico desarrollado en el **SENA — Servicio Nacional de Aprendizaje**.  
Uso educativo. Todos los derechos reservados por el equipo de desarrollo.

---
<div align="center">
  <span style="font-weight: 900; font-size: 1.1em;">"NoteFlow... la solución de tu desorden digital, próximamente en la web..."</span>
  <br>
  Hecho con 💜 por el equipo NoteFlow · SENA 2025
</div>

