📝 NoteFlow:

NoteFlow es un sistema web de gestión de notas personales que permite crear, organizar y personalizar notas mediante diferentes formatos (texto, imágenes, audios, videos y dibujos), con la posibilidad de agruparlas en carpetas, asignar etiquetas, y elegir entre modo claro u oscuro.
El proyecto está desarrollado bajo la metodología SCRUM, integrando frontend, backend y base de datos PostgreSQL.

⌛ Historia y funcion:
Proyecto del Tecnico en Programacion de Software - SENA,demostrando y evidenciando los aprendizajes logrados en conjunto de las clases del SENA e investigaciones propias por parte del equipo;

👥 Equipo:

- Javier Steven Solis Ruiz
- Johan Sebastian Jojoa Meneses
- Juan Diego Monsalve Martinez
- Sergio Andres Bustos Mondragon
- Juan Alejandro Tamayo Manzano

🧩 Características principales:

- Registro e inicio de sesión con validaciones (correo, alias, contraseña).
- Modo claro/oscuro personalizable por usuario.
- Creación de notas con varios formatos (texto, imagen, video, audio, dibujo).
- Gestión de carpetas, etiquetas y categorías (pública/privada).
- Papelera de reciclaje y restauración automática.
- Búsqueda avanzada (por notas o carpetas, con filtros dinámicos).
- Backend con API REST y base de datos PostgreSQL.
- Documentación técnica completa bajo metodología SCRUM.

Configuracion Para Su Funcionamiento ⚙️⚙️:

1. Clonar el repositorio de Noteflow:

   ```bash
   git clone https://github.com/NoteFlow/NoteFlow.git
   ```
2. Descargar .env para que tengas acceso ala base de datos de Noteflow y funcione de manera correcta en tu docker (Link Aqui) 👉 https://drive.google.com/drive/folders/1j6oWPRPDeAs3kQf88-q5krcMAhVzE79K?usp=sharing

Solo personas con acceso ala carpeta (Programadores Oficiales de Noteflow) pueden descargar el archivo .env y usarlo para configurar la base de datos de Noteflow en el docker y el proyecto.

3. Configurar el entorno de desarrollo: 

   - Instalar Docker y Docker Compose en tu máquina.
   - Navegar al directorio del proyecto y ejecutar:

     ```bash
     docker-compose up --build
     ```
   - Esto levantará los servicios necesarios (backend, frontend, base de datos) en contenedores Docker. 
   - Acceder a la aplicación en tu navegador web:

     ```
     127.0.0.1:5000 🌐
     ```

Si ya quieres que otras personas se conecten mediante la red a tu pagina web usa ipconfig y copia la ip de tu computadora. un ejemplo de eso seria 

```
192.168.1.100:5000
```

con el puerto asignado en Noteflow de la pagina que es 5000 y la ip de tu computadora. 

4. Asegurarse que la base de datos PostgreSQL esté funcionando y accesible desde el contenedor de Docker.

Para verificar esto se debe tener en cuenta que la base de datos PostgreSQL debe estar configurada correctamente en el archivo .env y que el puerto 5432 de la base de datos PostgreSQL debe estar expuesto en el contenedor de Docker. 

Con esto se creara una pagina local donde la URL seria "localhost:5050" y ahi se podra acceder para que puedas conectar la base de datos y verificar que todo funcione correctamente. ✅

5. Disfruta de Noteflow y Organiza tus Notas de manera eficiente y personalizada.

⚙️ Tecnologías utilizadas:

---

| Área                    | Tecnologías                                               |
| ------------------------ | ---------------------------------------------------------- |
| Frontend                 | HTML5, CSS3, Bootstrap + Fetch JavaScript                  |
| Backend                  | Flask + Jinja2 en Python                                   |
| Base de datos            | PostgreSQL                                                 |
| Diseño y documentación | Draw.io, Word                                              |
| Gestión del proyecto    | SCRUM (Product Backlog, Sprints, Historias de Usuario,etc) |
| Control de versiones     | Git / GitHub                                               |

---
