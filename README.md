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
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/es/docs/Web/JavaScript)
[![Fetch API](https://img.shields.io/badge/Fetch_API-Async-FF6B35?style=for-the-badge&logo=javascript&logoColor=white)](https://developer.mozilla.org/es/docs/Web/API/Fetch_API)
[![Web Audio API](https://img.shields.io/badge/Web_Audio_API-Waveform-8B5CF6?style=for-the-badge&logo=audiomack&logoColor=white)](https://developer.mozilla.org/es/docs/Web/API/Web_Audio_API)
[![Google OAuth](https://img.shields.io/badge/Google-OAuth_2.0-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://developers.google.com/identity)
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
| Fetch API | Comunicación asíncrona con el backend (sin recargar página) |
| Web Audio API | Decodificación y visualización de forma de onda en el editor de audio |
| MediaRecorder API | Grabación de audio y video desde el micrófono/cámara del usuario |
| Canvas API | Editor de dibujo e imagen con trazos, filtros y transformaciones |

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
| Docker | Contenedorización del backend (Flask) |
| Docker Compose | Orquestación de los contenedores locales de la aplicación |
| Supabase Dashboard | Panel en la nube para la gestión de base de datos y almacenamiento |

### 🛠️ Herramientas y metodología

| Herramienta | Uso |
|------------|-----|
| Git / GitHub | Control de versiones y colaboración del equipo |
| Draw.io | Diagramas de casos de uso, flujo y base de datos |
| SCRUM | Metodología ágil — Backlog, Sprints, Historias de Usuario |
| Word | Documentación técnica y requerimientos |
| ngrok | Dominio para uso de telefonos y tablets |

---

## 🚀 Instalación y puesta en marcha

### Requisitos previos

- [Git](https://git-scm.com/)
- [Docker](https://www.docker.com/) y Docker Compose
- [NGrok](https://apps.microsoft.com/detail/9mvs1j51gmk6?hl=es-ES&gl=ES)

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

```bash
docker-compose up --build
```

Esto levantará automáticamente el backend local (Flask) contenedorizado en el puerto `5000`, conectándose de forma segura a Supabase.

### 4. Dominio de ngrok

Primero asegúrate de estar autenticado con tu cuenta en ese otro equipo.
Instala Ngrok y luego ejecuta ⚡: 

```bash
ngrok config add-authtoken TU_TOKEN
```
Ese token es el que conecta ese computador con tu cuenta (y con ese dominio que ya tienes)💻.

Usa:

```bash
ngrok http --domain=stergimatic-shirlee-mollifiable.ngrok-free.dev 5000
```

Eso es lo que evita que cambie.
Si no pones --domain, Ngrok siempre genera uno aleatorio ✅.

Para usar ngrok tienes que tener si o si docker encendido para que el dominio asignado funcione 🐳.

### 5. Acceder a la aplicación

| Servicio | URL |
|----------|-----|
| 🌐 Aplicación principal | `http://127.0.0.1:5000` |
| 🗄️ Consola de Supabase | `https://supabase.com/dashboard` |

### 6. Acceso en red local

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
Para usar Google o inicio de sesion en Moviles o tablets tener el Ngrok para sincronizarlo con el google la API 

Lo iniciamos en segundo plano
```
ngrok http 5000
```
Lo dejamos en la terminal de visual o terminal de ngrok en segundo plano funcionando 


### 7. Verificar la base de datos

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

