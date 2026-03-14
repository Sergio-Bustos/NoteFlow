<div align="center">

# 📝 NoteFlow

**Sistema web de gestión de notas personales — Proyecto SENA**

[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-2.x-000000?style=for-the-badge&logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/es/docs/Web/JavaScript)

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

| Área | Tecnologías |
|------|-------------|
| Frontend | HTML5, CSS3, JavaScript (ES6+), Fetch API |
| Backend | Python, Flask, Jinja2 |
| Base de datos | PostgreSQL 15 |
| Autenticación | Google OAuth 2.0, Flask-Mail |
| Infraestructura | Docker, Docker Compose |
| Diseño y documentación | Draw.io, Word |
| Gestión del proyecto | SCRUM (Backlog, Sprints, Historias de Usuario) |
| Control de versiones | Git / GitHub |

---

## 🚀 Instalación y puesta en marcha

### Requisitos previos

- [Git](https://git-scm.com/)
- [Docker](https://www.docker.com/) y Docker Compose

### 1. Clonar el repositorio

```bash
git clone https://github.com/NoteFlow/NoteFlow.git
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

Esto levantará automáticamente el backend (Flask), la base de datos (PostgreSQL) y el panel de administración (pgAdmin).

### 4. Acceder a la aplicación

| Servicio | URL |
|----------|-----|
| 🌐 Aplicación principal | `http://127.0.0.1:5000` |
| 🗄️ pgAdmin (gestión BD) | `http://localhost:5050` |

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

Asegúrate de que PostgreSQL esté corriendo y de que el puerto `5432` esté expuesto correctamente en Docker. Puedes verificar el estado del contenedor con:

```bash
docker ps
docker logs <nombre-contenedor-db>
```

---

## 📁 Estructura del proyecto

```
NoteFlow/
├── app.py                  # Aplicación principal Flask
├── docker-compose.yml      # Configuración de servicios Docker
├── .env                    # Variables de entorno (no incluido en el repo)
├── static/
│   ├── css/                # Hojas de estilo
│   ├── js/                 # Lógica de cada editor (audio, video, imagen, etc.)
│   └── uploads/            # Archivos subidos por los usuarios
├── templates/              # Plantillas HTML (Jinja2)
│   ├── dashboard.html
│   ├── notas.html
│   ├── editoraudio.html
│   ├── editorvideo.html
│   ├── editorimagen.html
│   ├── editortexto.html
│   └── dibujo.html
└── requirements.txt        # Dependencias Python
```

---

## 📌 Estado del proyecto

| Funcionalidad | Estado |
|---------------|--------|
| Registro / Login | ✅ Completo |
| Login con Google | ✅ Completo |
| Recuperación de contraseña | ✅ Completo |
| Editor de texto | ✅ Completo |
| Editor de imagen | ✅ Completo |
| Editor de dibujo | ✅ Completo |
| Editor de audio | ✅ Completo |
| Editor de video | 🔧 En desarrollo |
| Carpetas y etiquetas | ✅ Completo |
| Papelera de reciclaje | ✅ Completo |
| Búsqueda avanzada | 🔧 En desarrollo |
| Modo claro / oscuro | ✅ Completo |

---

## 📜 Licencia

Proyecto académico desarrollado en el **SENA — Servicio Nacional de Aprendizaje**.  
Uso educativo. Todos los derechos reservados por el equipo de desarrollo.

---

<div align="center">
  Hecho con 💜 por el equipo NoteFlow · SENA 2025
</div>
