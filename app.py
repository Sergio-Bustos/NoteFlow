# -*- coding: utf-8 -*-

# ==============================================================================
# IMPORTACIONES
# ==============================================================================
from flask import Flask, jsonify, render_template, request, redirect, url_for, session
from flask_mail import Mail, Message
import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2.pool import ThreadedConnectionPool
from google_auth_oauthlib.flow import Flow
from functools import wraps
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv
from datetime import datetime, timedelta
import requests
import os
import sys
import uuid as _uuid
import secrets
import re
import random
from flask_talisman import Talisman
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_wtf.csrf import CSRFProtect
import bleach
import logging
from logging.handlers import RotatingFileHandler
from supabase import create_client, Client
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
import threading

load_dotenv()

# Inicializar Supabase Client
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase_client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ==============================================================================
# CONFIGURACIÓN — OAuth, Flask, Base de datos y Correo
# ==============================================================================

# OAuth (desarrollo en HTTP local)
if os.getenv("FLASK_ENV") == "development":
    os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"
GOOGLE_CLIENT_ID     = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI  = os.getenv("GOOGLE_REDIRECT_URI")

# Flask
app = Flask(__name__)
# Usar una clave secreta segura desde .env, o generar una aleatoria si no existe (no recomendado para producción real pero mejor que un fallback fijo)
app.secret_key = os.getenv("FLASK_SECRET_KEY", secrets.token_hex(32))
app.static_folder = "static"
app.static_url_path = "/static"
app.config["MAX_CONTENT_LENGTH"] = 2 * 1024 * 1024 * 1024  # 2 GB
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SECURE"] = False  # Cambiar a True si se usa HTTPS
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"

# Configuración de Flask-WTF CSRF
app.config["WTF_CSRF_CHECK_DEFAULT"] = True   # Activar CSRF global
app.config["WTF_CSRF_HEADERS"] = ["X-CSRFToken", "X-CSRF-Token"]  # Leer token de cabeceras AJAX
app.config["WTF_CSRF_TIME_LIMIT"] = 3600      # Token válido por 1 hora

# Inicializar CSRF
csrf = CSRFProtect(app)

# Inicializar Limiter
limiter = Limiter(
    key_func=get_remote_address,
    app=app,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://",
)

# Configuración de Logging de Seguridad
security_logger = logging.getLogger('security')
security_logger.setLevel(logging.INFO)
_sec_handler = RotatingFileHandler('security_audit.log', maxBytes=1_000_000, backupCount=5)
_sec_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
security_logger.addHandler(_sec_handler)

# Inicializar Talisman (Seguridad de cabeceras HTTP)
# Nota: CSP está relajado para permitir la carga de recursos locales y Google OAuth. 
# En producción se debe ajustar estrictamente.
csp = {
    'default-src': '\'self\'',
    'script-src': [
        '\'self\'',
        '\'unsafe-inline\'',
        'https://accounts.google.com',
        'https://checkout.epayco.co',
        'https://secure.epayco.co',
        'https://ejs.epayco.co',
        'https://code.jquery.com',
        'https://cdn.jsdelivr.net',
        'https://cdnjs.cloudflare.com'
    ],
    'style-src': [
        '\'self\'',
        '\'unsafe-inline\'',
        'https://fonts.googleapis.com',
        'https://cdn.jsdelivr.net',
        'https://cdnjs.cloudflare.com',
        'https://checkout.epayco.co'
    ],
    'img-src': ['\'self\'', 'data:', 'blob:', 'https:', 'http:', 'https://randomuser.me', 'https://*.epayco.co'],
    'font-src': [
        '\'self\'', 
        'https://fonts.gstatic.com', 
        'https://cdn.jsdelivr.net',
        'https://cdnjs.cloudflare.com'
    ],
    'connect-src': [
        '\'self\'',
        'https://randomuser.me',
        'https://*.epayco.co',
        'https://*.epayco.io',
        'https://*.supabase.co'
    ],
    'frame-src': [
        '\'self\'', 
        'https://accounts.google.com', 
        'https://checkout.epayco.co',
        'https://secure.epayco.co'
    ],
    # Permite reproducir video/audio desde blob:, data: y Supabase
    'media-src': ['\'self\'', 'blob:', 'data:', 'https://*.supabase.co'],
    # Permite Web Workers y OfflineAudioContext (usado en el editor de audio)
    'worker-src': ['\'self\'', 'blob:'],
}
talisman = Talisman(app, content_security_policy=csp, force_https=False)

# Rutas base del servidor
BASE_DIR = os.path.abspath(os.path.dirname(__file__))

# Base de datos PostgreSQL
DB_CONFIG = {
    "host":     os.getenv("DB_HOST",     "localhost"),
    "database": os.getenv("DB_NAME",     "dbnoteflow"),
    "user":     os.getenv("DB_USER",     "postgres"),
    "password": os.getenv("DB_PASSWORD", "123456"),
    "port":     int(os.getenv("DB_PORT", 5432)),
}

# Correo (Flask-Mail)
app.config["MAIL_SERVER"]         = os.getenv("MAIL_SERVER")
app.config["MAIL_PORT"]           = int(os.getenv("MAIL_PORT"))
app.config["MAIL_USE_TLS"]        = os.getenv("MAIL_USE_TLS") == "True"
app.config["MAIL_USE_SSL"]        = os.getenv("MAIL_USE_SSL") == "True"
app.config["MAIL_USERNAME"]       = os.getenv("MAIL_USERNAME")
app.config["MAIL_PASSWORD"]       = os.getenv("MAIL_PASSWORD")
app.config["MAIL_DEFAULT_SENDER"] = os.getenv("MAIL_USERNAME")
app.config["MAIL_DEFAULT_CHARSET"]= "utf-8"
mail = Mail(app)

# ==============================================================================
# CARPETAS DE UPLOADS Y CONSTANTES DE ARCHIVOS
# ==============================================================================

# Fotos de perfil
PROFILE_UPLOAD_FOLDER = os.path.join(BASE_DIR, "static", "uploads", "profile")
ALLOWED_EXTENSIONS_FOTO = {"png", "jpg", "jpeg", "gif", "webp"}

# Dibujos
DIBUJO_UPLOAD_FOLDER = os.path.join(BASE_DIR, "static", "uploads", "dibujos")

# Imágenes
IMAGEN_UPLOAD_FOLDER = os.path.join(BASE_DIR, "static", "uploads", "imagenes")

# Textos (sin archivos físicos, solo referencia)
TEXTO_UPLOAD_FOLDER = os.path.join(BASE_DIR, "static", "uploads", "textos")

# Audios
AUDIO_UPLOAD_FOLDER          = os.path.join(BASE_DIR, "static", "uploads", "audios")
AUDIO_EXTENSIONES_PERMITIDAS = {".mp3", ".aac", ".ogg", ".wav", ".flac", ".wma", ".m4a", ".webm"}
AUDIO_TIPOS_MIME_PERMITIDOS  = {
    "audio/mpeg", "audio/mp3", "audio/aac", "audio/ogg", "audio/wav",
    "audio/flac", "audio/x-flac", "audio/wma", "audio/x-ms-wma",
    "audio/mp4", "audio/x-m4a", "audio/webm", "video/webm",
}
AUDIO_MAX_BYTES = 200 * 1024 * 1024  # 200 MB

# Videos
VIDEO_UPLOAD_FOLDER = os.path.join(BASE_DIR, "static", "uploads", "videos")
VIDEO_EXTENSIONES   = {".mp4", ".webm", ".ogg", ".mkv", ".wmv", ".mov", ".avi"}
VIDEO_MAX_BYTES     = 2 * 1024 * 1024 * 1024  # 2 GB

# Nota mixta — carpetas y reglas por tipo de archivo
MIXTA_CARPETAS = {
    "imagenes": os.path.join(BASE_DIR, "static", "uploads", "imagenes"),
    "audios":   os.path.join(BASE_DIR, "static", "uploads", "audios"),
    "videos":   os.path.join(BASE_DIR, "static", "uploads", "videos"),
}
MIXTA_REGLAS = {
    "imagenes": {
        "exts":      {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".pntg", ".wmf"},
        "max_bytes": 200 * 1024 * 1024,
        "prefijo":   "img",
    },
    "audios": {
        "exts":      {".mp3", ".aac", ".ogg", ".wav", ".flac", ".wma", ".m4a", ".webm"},
        "max_bytes": 200 * 1024 * 1024,
        "prefijo":   "aud",
    },
    "videos": {
        "exts":      {".mp4", ".webm", ".ogg", ".mkv", ".wmv", ".mov", ".avi"},
        "max_bytes": 2 * 1024 * 1024 * 1024,
        "prefijo":   "vid",
    },
}

# Crear carpetas si no existen
for _carpeta in [
    PROFILE_UPLOAD_FOLDER, DIBUJO_UPLOAD_FOLDER, IMAGEN_UPLOAD_FOLDER,
    TEXTO_UPLOAD_FOLDER, AUDIO_UPLOAD_FOLDER, VIDEO_UPLOAD_FOLDER,
] + list(MIXTA_CARPETAS.values()):
    if not os.path.exists(_carpeta):
        os.makedirs(_carpeta)

# ==============================================================================
# MANEJADORES DE ERROR
# ==============================================================================

@app.errorhandler(413)
def archivo_demasiado_grande(e):
    """El archivo supera el MAX_CONTENT_LENGTH configurado (2 GB)."""
    return jsonify({"error": "El archivo supera el límite de 2 GB"}), 413


@app.errorhandler(400)
def solicitud_invalida(e):
    """Maneja errores 400, incluyendo fallos de validación CSRF."""
    descripcion = str(e.description) if hasattr(e, 'description') else str(e)
    if 'csrf' in descripcion.lower() or 'token' in descripcion.lower():
        security_logger.warning(f"Fallo de CSRF desde {request.remote_addr}: {descripcion}")
        return jsonify({"error": "Token de seguridad inválido. Refresca la página e intenta de nuevo."}), 400
    return jsonify({"error": descripcion}), 400


@app.errorhandler(429)
def demasiadas_solicitudes(e):
    """Rate limit excedido — devuelve JSON para que el toast lo muestre."""
    security_logger.warning(f"Rate limit excedido desde {request.remote_addr} en {request.path}")
    return jsonify({"error": "Demasiados intentos. Por favor espera un momento antes de volver a intentarlo."}), 429


@app.errorhandler(404)
def pagina_no_encontrada(e):
    return render_template("errors/404.html"), 404


@app.errorhandler(500)
def error_interno_servidor(e):
    return render_template("errors/500.html"), 500


# ==============================================================================
# UTILIDADES Y DECORADORES
# ==============================================================================

DB_POOL = None

def init_db_pool():
    global DB_POOL
    if DB_POOL is None:
        try:
            config = DB_CONFIG.copy()
            config["sslmode"] = "require"
            DB_POOL = ThreadedConnectionPool(
                minconn=2,
                maxconn=40,
                **config
            )
            print("Database connection pool initialized successfully.")
        except Exception as e:
            sys.stderr.write(f"CRITICAL: Failed to initialize DB connection pool: {e}\n")
            sys.stderr.flush()

def conectar_db(dict_cursor=False):
    """Crea y devuelve una conexión a PostgreSQL desde el pool (Compatible con Supabase)."""
    global DB_POOL
    retries = 3
    while retries > 0:
        try:
            if DB_POOL is None:
                init_db_pool()
            
            if DB_POOL:
                conexion = DB_POOL.getconn()
                if conexion.closed != 0:
                    DB_POOL.putconn(conexion, close=True)
                    retries -= 1
                    continue
                
                conexion.cursor_factory = RealDictCursor if dict_cursor else None
                conexion.set_client_encoding("UTF8")
                return conexion
            return None
        except psycopg2.InterfaceError as e:
            # Si la conexión estaba cerrada a nivel de red, la descartamos
            if "connection already closed" in str(e).lower() or "connection closed" in str(e).lower():
                try:
                    DB_POOL.putconn(conexion, close=True)
                except:
                    pass
                retries -= 1
                continue
            error_msg = f"CRITICAL: ERROR DE CONEXIÓN A POSTGRESQL: {type(e).__name__}: {e}\n"
            sys.stderr.write(error_msg)
            sys.stderr.flush()
            return None
        except Exception as e:
            error_msg = f"CRITICAL: ERROR DE CONEXIÓN A POSTGRESQL: {type(e).__name__}: {e}\n"
            sys.stderr.write(error_msg)
            sys.stderr.flush()
            return None
            
    return None



def cerrar_db(cursor, conexion):
    """Cierra el cursor y devuelve la conexión al pool de base de datos."""
    if cursor:
        try:
            cursor.close()
        except Exception:
            pass
    if conexion:
        global DB_POOL
        if DB_POOL:
            try:
                DB_POOL.putconn(conexion)
            except Exception:
                try:
                    conexion.close()
                except Exception:
                    pass
        else:
            try:
                conexion.close()
            except Exception:
                pass


def verificar_sesion():
    """Verifica si hay sesión activa. Retorna redirección si no la hay."""
    if "usuario_id" not in session:
        return redirect(url_for("mostrar_login"))
    return None

def es_admin(user_id):
    """Comprueba de forma segura si un ID de cuenta tiene privilegios administrativos en la base de datos."""
    if not user_id:
        return False
    conexion = conectar_db(dict_cursor=True)
    if not conexion:
        return False
    try:
        cur = conexion.cursor()

        
        cur.execute('SELECT "Es_admin" FROM public."Cuentas" WHERE "ID_Cuenta" = %s', (user_id,))
        res = cur.fetchone()
        cerrar_db(cur, conexion)
        return bool(res and res.get("Es_admin", False))
    except Exception as e:
        print(f"Error en es_admin: {e}")
        return False

def obtener_proximo_id(tabla, columna, cursor=None):
    """Busca el ID más pequeño disponible en una tabla abriendo su propia conexión.
    ADVERTENCIA: no debe usarse dentro de transacciones abiertas porque no ve
    las filas pendientes de commit. Usa _next_id(cursor, ...) en su lugar.
    """
    if cursor:
        return _next_id(cursor, tabla, columna)
        
    conexion = conectar_db()
    cursor = conexion.cursor()
    try:
        query = f"""
            SELECT COALESCE(MIN(t1."{columna}" + 1), 1)
            FROM public."{tabla}" t1
            LEFT JOIN public."{tabla}" t2 ON t1."{columna}" + 1 = t2."{columna}"
            WHERE t2."{columna}" IS NULL
        """
        cursor.execute(query)
        res = cursor.fetchone()[0]
        # Si el 1 no existe, empezamos por el 1
        cursor.execute(f'SELECT "{columna}" FROM public."{tabla}" WHERE "{columna}" = 1')
        if not cursor.fetchone():
            return 1
        return res
    except:
        return 1
    finally:
        cerrar_db(cursor, conexion)

def _next_id(cursor, tabla, columna):
    """Calcula el próximo ID disponible usando el cursor de la transacción activa.
    Al reutilizar el mismo cursor, la consulta SÍ ve las filas insertadas pero
    aún no confirmadas (within-transaction visibility), evitando colisiones de clave.
    """
    cursor.execute(f'SELECT COALESCE(MAX("{columna}"), 0) + 1 FROM public."{tabla}"')
    return cursor.fetchone()[0]

def subir_a_supabase(archivo, carpeta, nombre_archivo):
    """Sube un archivo a Supabase Storage y retorna la ruta pública."""
    try:
        archivo.seek(0)
        file_data = archivo.read()
        bucket = "NoteFlow"
        path = f"{carpeta}/{nombre_archivo}"
        
        import mimetypes
        content_type = getattr(archivo, "content_type", None)
        if not content_type:
            content_type = mimetypes.guess_type(nombre_archivo)[0] or "application/octet-stream"
        
        # Subir archivo
        supabase_client.storage.from_(bucket).upload(
            path=path,
            file=file_data,
            file_options={"content-type": content_type}
        )
        
        # Retornar la URL pública
        res = supabase_client.storage.from_(bucket).get_public_url(path)
        return res
    except Exception as e:
        print(f"Error subiendo a Supabase: {e}")
        try:
            buckets = supabase_client.storage.list_buckets()
            print(f"Buckets disponibles en tu proyecto: {[b.name for b in buckets]}")
        except Exception as e2:
            print(f"No se pudieron listar los buckets: {e2}")
        return None


def eliminar_archivo_de_supabase_por_ruta(ruta_publica):
    """Elimina un archivo del bucket de Supabase dada su URL pública."""
    if not ruta_publica:
        return
    try:
        if "/public/NoteFlow/" in ruta_publica:
            path_to_remove = ruta_publica.split("/public/NoteFlow/")[1]
            if path_to_remove:
                supabase_client.storage.from_("NoteFlow").remove([path_to_remove])
                print(f"Archivo eliminado de Supabase con éxito: {path_to_remove}")
    except Exception as e:
        print(f"Error al eliminar archivo de Supabase ({ruta_publica}): {e}")


# ==============================================================================
# CONTEXT PROCESSORS (Globales para plantillas)
# ==============================================================================

@app.context_processor
def inject_globals():
    def get_file_url(path):
        """Retorna la URL correcta: local o de Supabase."""
        if not path:
            return url_for('static', filename='default_profile.png')
        if path.startswith('http'):
            return path
        # Fallback para archivos locales antiguos
        return url_for('static', filename=path)
    return dict(get_file_url=get_file_url)


def login_required(f):
    """Decorador que requiere sesión activa para acceder a la ruta."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "usuario_id" not in session:
            return redirect(url_for("mostrar_login"))
        return f(*args, **kwargs)
    return decorated_function


def sanitizar_html(html_sucio):
    """
    Limpia el HTML permitiendo solo etiquetas seguras para las notas.
    Previene inyección de scripts (XSS).
    """
    if not html_sucio:
        return ""
    
    tags_permitidos = [
        'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3',
        'ul', 'ol', 'li', 'blockquote', 'span', 'div',
        'font', 's', 'strike', 'b', 'i',  # execCommand genera estas etiquetas
    ]
    attrs_permitidos = {
        '*':    ['style', 'class', 'align', 'dir'],
        'a':    ['href', 'title'],
        'div':  ['style', 'class', 'align', 'dir'],
        'p':    ['style', 'class', 'align', 'dir'],
        'font': ['size', 'color', 'face'],  # execCommand('fontSize') genera <font size="N">
    }
    styles_permitidos = [
        'color', 'background-color', 'text-align',
        'font-size', 'font-weight', 'font-style', 'text-decoration',
    ]
    

    try:
        from bleach.css_sanitizer import CSSSanitizer
        css_sanitizer = CSSSanitizer(allowed_css_properties=styles_permitidos)
        return bleach.clean(
            html_sucio,
            tags=tags_permitidos,
            attributes=attrs_permitidos,
            css_sanitizer=css_sanitizer,
            strip=True
        )
    except ImportError:
        # Fallback para versiones antiguas de bleach
        return bleach.clean(
            html_sucio,
            tags=tags_permitidos,
            attributes=attrs_permitidos,
            styles=styles_permitidos,
            strip=True
        )

def limpiar_datos_formulario(datos, campos):
    """Limpia y retorna un diccionario con los campos del formulario."""
    return {campo: datos.get(campo, "").strip() for campo in campos}



def construir_email_html(titulo: str, cuerpo_html: str) -> str:
    """
    Genera el HTML completo de un correo con branding NoteFlow.
    
    Parámetros:
        titulo      — Título principal del correo (ej. "Tu código de verificación")
        cuerpo_html — Contenido interno en HTML (párrafos, código, botones, etc.)
    """
    return f"""
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>{titulo}</title>
    </head>
    <body style="margin:0;padding:0;background-color:#f4f6f8;font-family:'Segoe UI',Arial,sans-serif;">

      <!-- Wrapper -->
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f8;padding:40px 0;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0"
                   style="background:#ffffff;border-radius:12px;overflow:hidden;
                          box-shadow:0 4px 20px rgba(0,0,0,0.08);max-width:600px;width:100%;">

              <!-- HEADER con logo -->
              <tr>
                <td style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);
                           padding:32px 40px;text-align:center;">
                  <!-- Si tienes el logo en /static/img/logo.png, referencia la URL pública -->
                  <!-- <img src="https://tudominio.com/static/img/logo.png" alt="NoteFlow" height="48"> -->
                  <h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:700;
                             letter-spacing:-0.5px;">📝 NoteFlow</h1>
                  <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:13px;">
                    Tu espacio para organizar ideas
                  </p>
                </td>
              </tr>

              <!-- CUERPO -->
              <tr>
                <td style="padding:40px 48px;">
                  <h2 style="color:#1e1b4b;font-size:22px;margin:0 0 16px;font-weight:600;">
                    {titulo}
                  </h2>
                  {cuerpo_html}
                </td>
              </tr>

              <!-- FOOTER -->
              <tr>
                <td style="background:#f8f7ff;border-top:1px solid #e5e7eb;
                           padding:24px 48px;text-align:center;">
                  <p style="color:#6b7280;font-size:12px;margin:0 0 6px;">
                    Este correo fue enviado por <strong>NoteFlow</strong>.
                    Si no realizaste esta acción, puedes ignorarlo.
                  </p>
                  <p style="color:#9ca3af;font-size:11px;margin:0;">
                    © {datetime.now().year} NoteFlow · Todos los derechos reservados
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>

    </body>
    </html>
    """

def allowed_file(filename):
    """Verifica si la extensión del archivo es válida para fotos de perfil."""
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS_FOTO


def obtener_etiquetas_nota(nota_id, cursor):
    """Retorna la lista de etiquetas asociadas a una nota."""
    cursor.execute("""
        SELECT e."ID_Etiqueta", e."Nombre_etiqueta"
        FROM public."Notas_etiquetas" ne
        JOIN public."Etiquetas" e ON ne."ID_Etiqueta" = e."ID_Etiqueta"
        WHERE ne."ID_Nota" = %s
        ORDER BY e."Nombre_etiqueta" ASC
    """, (nota_id,))
    rows = cursor.fetchall()
    if rows and isinstance(rows[0], dict):
        return rows
    return [{"ID_Etiqueta": r[0], "Nombre_etiqueta": r[1]} for r in rows]


def verificar_adjuntos_nota(nota_id, cursor):
    """Retorna True si la nota tiene al menos un adjunto."""
    cursor.execute("""
        SELECT COUNT(*) AS total
        FROM public."Adjuntos"
        WHERE "ID_Nota" = %s
    """, (nota_id,))
    row = cursor.fetchone()
    total = row.get("total", 0) if isinstance(row, dict) else row[0]
    return int(total) > 0


def _insertar_etiquetas(etiquetas_raw, nota_id, cursor):
    """
    Inserta etiquetas y las vincula a la nota indicada.
    Reutiliza etiquetas existentes y evita duplicados en la tabla puente.
    """
    etiquetas = [e.strip()[:20] for e in etiquetas_raw.split(",") if e.strip()]
    for nombre in etiquetas:
        cursor.execute("""
            SELECT "ID_Etiqueta" FROM public."Etiquetas"
            WHERE LOWER("Nombre_etiqueta") = LOWER(%s)
        """, (nombre,))
        row = cursor.fetchone()
        if row:
            id_etiqueta = row[0] if not isinstance(row, dict) else row["ID_Etiqueta"]
        else:
            cursor.execute('SELECT COALESCE(MAX("ID_Etiqueta"), 0) + 1 FROM public."Etiquetas"')
            id_etiqueta = cursor.fetchone()[0]
            cursor.execute("""
                INSERT INTO public."Etiquetas" ("ID_Etiqueta", "Nombre_etiqueta")
                VALUES (%s, %s)
            """, (id_etiqueta, nombre))

        cursor.execute("""
            SELECT 1 FROM public."Notas_etiquetas"
            WHERE "ID_Nota" = %s AND "ID_Etiqueta" = %s
        """, (nota_id, id_etiqueta))
        if not cursor.fetchone():
            cursor.execute("""
                INSERT INTO public."Notas_etiquetas" ("ID_Nota", "ID_Etiqueta")
                VALUES (%s, %s)
            """, (nota_id, id_etiqueta))
# ==============================================================================
# 1. BIENVENIDA
# ==============================================================================

@app.route("/")
def inicio():
    """Página de bienvenida pública (antes de autenticarse)."""
    return render_template("bienvenidoalapagina.html")


@app.route("/caracteristicas.html")
def caracteristicas():
    """Página de características del producto."""
    return render_template("caracteristicas.html")

# ==============================================================================
# 2. REGISTRO DE CUENTA
#    Flujo: formulario → envío de código por correo → verificación → creación
# ==============================================================================

@app.route("/registro.html")
def mostrar_registro():
    """Muestra el formulario de registro."""
    return render_template("registro.html")


@app.route("/cuenta-no-registrada")
def cuenta_no_registrada():
    """Página informativa cuando el correo de Google no está registrado."""
    return render_template("cuenta_no_registrada.html")


@app.route("/procesar-registro", methods=["POST"])
@limiter.limit("5 per minute")
def procesar_registro():
    """
    Paso 1 del registro: valida los datos, genera un código de 6 dígitos,
    lo almacena en sesión y lo envía al correo. La cuenta NO se crea todavía.
    """
    conexion = None
    cursor   = None
    try:
        conexion = conectar_db()
        if conexion is None:
            return jsonify({"error": "No se pudo conectar a la base de datos"}), 500

        campos = ["nombre", "apellido", "telefono", "correo", "usuario", "contraseña"]
        datos  = limpiar_datos_formulario(request.form, campos)

        nombres    = datos["nombre"]
        apellidos  = datos["apellido"]
        telefono   = datos["telefono"]
        correo     = datos["correo"]
        usuario    = datos["usuario"]
        contraseña = datos["contraseña"]
        color      = request.form.get("color_principal", "Blanco").strip()

        if not all([nombres, apellidos, telefono, correo, usuario, contraseña]):
            return jsonify({"error": "Todos los campos son obligatorios"}), 400

        if not re.match(r"^\+?[0-9]{7,15}$", telefono):
            return jsonify({"error": "El teléfono debe contener entre 7 y 15 dígitos"}), 400

        cursor = conexion.cursor()
        cursor.execute("""
            SELECT "ID_Cuenta" FROM public."Cuentas"
            WHERE "Usuario" = %s OR "Correo" = %s
        """, (usuario, correo))

        if cursor.fetchone():
            return jsonify({"error": "El usuario o correo ya está registrado en NoteFlow"}), 409

        # Sanitizar entradas de texto si es necesario (nombre/usuario)
        nombres = bleach.clean(nombres, tags=[], strip=True)
        apellidos = bleach.clean(apellidos, tags=[], strip=True)
        usuario = bleach.clean(usuario, tags=[], strip=True)
        confirmar_contrasena = request.form.get("confirmar_contrasena", "").strip()

        # Validación de coincidencia de contraseñas
        if contraseña != confirmar_contrasena:
            return jsonify({"error": "Las contraseñas no coinciden"}), 400

        # Validación estricta de correo electrónico
        if not re.match(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$", correo):
            return jsonify({"error": "El formato del correo electrónico no es válido"}), 400

        # Validación de fortaleza de contraseña
        # Mínimo 8 caracteres, al menos una letra y un número
        if len(contraseña) < 8 or not re.search(r"[A-Za-z]", contraseña) or not re.search(r"[0-9]", contraseña):
            return jsonify({"error": "La contraseña debe tener al menos 8 caracteres, incluyendo letras y números"}), 400

        codigo = str(random.randint(100000, 999999))
        expira = datetime.now() + timedelta(minutes=15)

        session["registro_pendiente"] = {
            "nombres":    nombres,
            "apellidos":  apellidos,
            "telefono":   telefono,
            "correo":     correo,
            "usuario":    usuario,
            "contraseña": generate_password_hash(contraseña),
            "color":      color,
            "codigo":     codigo,
            "expira":     expira.isoformat(),
        }

        # DESPUÉS
        msg      = Message(subject="Tu código de verificación NoteFlow", recipients=[correo])
        msg.body = f"Hola {nombres}, tu código de verificación es: {codigo}. Expira en 15 minutos."
        msg.html = construir_email_html(
            titulo=f"Hola {nombres}, verifica tu cuenta 👋",
            cuerpo_html=f"""
            <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 24px;">
                Gracias por registrarte en NoteFlow. Usa el siguiente código
                para completar tu registro:
            </p>
            <div style="background:#f3f0ff;border:2px dashed #7c3aed;border-radius:10px;
                        padding:20px;text-align:center;margin:0 0 24px;">
                <span style="font-size:36px;font-weight:800;letter-spacing:10px;color:#4f46e5;">
                    {codigo}
                </span>
            </div>
            <p style="color:#6b7280;font-size:13px;margin:0;">
                ⏰ Este código expira en <strong>15 minutos</strong>.
            </p>
            """
        )

        try:
            mail.send(msg)
        except Exception as mail_e:
            print(f"Error al enviar correo: {mail_e}")
            return jsonify({"error": "Error al enviar el correo de verificación."}), 500

        return jsonify({"success": True, "mensaje": "Código enviado", "redirect": "/verificar-registro"}), 200

    except Exception as e:
        if conexion:
            conexion.rollback()
        security_logger.error(f"Error en registro para {request.form.get('correo')}: {str(e)}")
        print(f"Error al iniciar registro: {e}")
        return jsonify({"error": "Error al procesar la solicitud"}), 500

    finally:
        cerrar_db(cursor, conexion)


@app.route("/verificar-registro")
def mostrar_verificacion():
    """Muestra el formulario para ingresar el código de verificación."""
    if "registro_pendiente" not in session:
        return redirect(url_for("mostrar_registro"))
    correo = session["registro_pendiente"].get("correo", "")
    return render_template("verificar_registro.html", correo=correo)


@app.route("/procesar-verificacion", methods=["POST"])
def procesar_verificacion():
    """
    Paso 2 del registro: valida el código recibido por correo
    y crea la cuenta si es correcto.
    """
    pendiente = session.get("registro_pendiente")
    if not pendiente:
        return jsonify({"error": "Sesión expirada. Por favor regístrate de nuevo."}), 400

    codigo_ingresado = request.form.get("codigo", "").strip()
    expira           = datetime.fromisoformat(pendiente["expira"])

    if datetime.now() > expira:
        session.pop("registro_pendiente", None)
        return jsonify({"error": "El código ha expirado. Por favor regístrate de nuevo."}), 400

    if codigo_ingresado != pendiente["codigo"]:
        return jsonify({"error": "Código incorrecto. Inténtalo de nuevo."}), 401

    conexion = None
    cursor   = None
    try:
        conexion = conectar_db()
        if conexion is None:
            return jsonify({"error": "No se pudo conectar a la base de datos"}), 500

        cursor = conexion.cursor()

        cursor.execute("""
            SELECT "ID_Cuenta" FROM public."Cuentas"
            WHERE "Usuario" = %s OR "Correo" = %s
        """, (pendiente["usuario"], pendiente["correo"]))

        if cursor.fetchone():
            session.pop("registro_pendiente", None)
            return jsonify({"error": "El usuario o correo ya fue registrado."}), 409

        cursor.execute('SELECT COALESCE(MAX("ID_Cuenta"), 0) + 1 FROM public."Cuentas"')
        nuevo_id = cursor.fetchone()[0]

        cursor.execute("""
            INSERT INTO public."Cuentas"
                ("ID_Cuenta", "Usuario", "Contraseña", "Nombres", "Apellidos",
                 "Telefono", "Correo", "Color_principal")
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING "ID_Cuenta"
        """, (
            nuevo_id,
            pendiente["usuario"],
            pendiente["contraseña"],
            pendiente["nombres"],
            pendiente["apellidos"],
            pendiente["telefono"],
            pendiente["correo"],
            pendiente["color"],
        ))

        cuenta_id = cursor.fetchone()[0]
        conexion.commit()

        session.pop("registro_pendiente", None)
        session["usuario_id"]     = cuenta_id
        session["usuario_nombre"] = pendiente["usuario"]
        session["es_premium"]     = False  # Nuevas cuentas no son premium por defecto

        return jsonify({"success": True, "mensaje": "¡Cuenta creada exitosamente!", "redirect": "/dashboard"}), 201

    except Exception as e:
        if conexion:
            conexion.rollback()
        print(f"Error al crear la cuenta: {e}")
        return jsonify({"error": "Error al crear la cuenta"}), 500

    finally:
        cerrar_db(cursor, conexion)


@app.route("/reenviar-codigo", methods=["POST"])
def reenviar_codigo():
    """Genera un nuevo código de verificación y lo reenvía al correo."""
    pendiente = session.get("registro_pendiente")
    if not pendiente:
        return jsonify({"error": "Sesión expirada. Por favor regístrate de nuevo."}), 400

    codigo = str(random.randint(100000, 999999))
    expira = datetime.now() + timedelta(minutes=15)

    session["registro_pendiente"]["codigo"] = codigo
    session["registro_pendiente"]["expira"] = expira.isoformat()
    session.modified = True

    msg      = Message(subject="Tu nuevo código de verificación NoteFlow", recipients=[pendiente["correo"]])
    msg.body = f"Tu nuevo código es: {codigo}. Expira en 15 minutos."
    msg.html = construir_email_html(
        titulo="Nuevo código de verificación",
        cuerpo_html=f"""
        <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 24px;">
            Hola <strong>{pendiente['nombres']}</strong>, aquí está tu nuevo código:
        </p>
        <div style="background:#f3f0ff;border:2px dashed #7c3aed;border-radius:10px;
                    padding:20px;text-align:center;margin:0 0 24px;">
            <span style="font-size:36px;font-weight:800;letter-spacing:10px;color:#4f46e5;">
                {codigo}
            </span>
        </div>
        <p style="color:#6b7280;font-size:13px;margin:0;">
            ⏰ Expira en <strong>15 minutos</strong>.
        </p>
        """
    )

    try:
        mail.send(msg)
    except Exception as e:
        print(f"Error al reenviar correo: {e}")
        return jsonify({"error": "Error al reenviar el correo"}), 500

    return jsonify({"success": True, "mensaje": "Nuevo código enviado"}), 200
# ==============================================================================
# 3. INICIO DE SESIÓN
# ==============================================================================

@app.route("/iniciarsesion.html")
def mostrar_login():
    """Muestra el formulario de inicio de sesión."""
    return render_template("iniciarsesion.html")


@app.route("/procesar-login", methods=["POST"])
@limiter.limit("10 per minute")
def procesar_login():
    sys.stderr.write("INFO: Iniciando proceso de login...\n")
    sys.stderr.flush()
    """
    Valida las credenciales del usuario y abre la sesión.
    Si la contraseña está en texto plano (cuentas antiguas), la migra a hash.
    """
    conexion = None
    cursor   = None
    try:
        conexion = conectar_db()
        if conexion is None:
            return jsonify({"error": "No se pudo conectar a la base de datos"}), 500

        datos      = limpiar_datos_formulario(request.form, ["usuario", "contraseña"])
        usuario    = datos["usuario"]
        contraseña = datos["contraseña"]

        if not usuario or not contraseña:
            return jsonify({"error": "Usuario y contraseña son obligatorios"}), 400

        cursor = conexion.cursor(cursor_factory=RealDictCursor)
        cursor.execute("""
            SELECT "ID_Cuenta", "Usuario", "Contraseña", "Nombres", "Apellidos", "Color_principal"
            FROM public."Cuentas"
            WHERE "Usuario" = %s
        """, (usuario,))
        cuenta = cursor.fetchone()

        if not cuenta:
            return jsonify({"error": "Este usuario no está registrado en NoteFlow"}), 404

        password_guardado = cuenta["Contraseña"]
        login_exitoso     = False

        if password_guardado.startswith("pbkdf2:sha256:") or password_guardado.startswith("scrypt:"):
            login_exitoso = check_password_hash(password_guardado, contraseña)
        else:
            if password_guardado == contraseña:
                login_exitoso = True
                # Migrar contraseña en texto plano a hash
                try:
                    nuevo_hash   = generate_password_hash(contraseña)
                    cur_temp     = conexion.cursor()
                    cur_temp.execute("""
                        UPDATE public."Cuentas" SET "Contraseña" = %s WHERE "ID_Cuenta" = %s
                    """, (nuevo_hash, cuenta["ID_Cuenta"]))
                    conexion.commit()
                    cur_temp.close()
                    print(f"Contraseña migrada a hash para usuario: {usuario}")
                except Exception as e:
                    print(f"Error al migrar contraseña: {e}")

        if login_exitoso:
            # Prevenir Session Fixation limpiando la sesión vieja
            session.clear()
            session["usuario_id"]     = cuenta["ID_Cuenta"]
            session["usuario_nombre"] = cuenta["Usuario"]
            
            # Registrar el último acceso
            try:
                cur_temp = conexion.cursor()
                cur_temp.execute('UPDATE public."Cuentas" SET "Ultimo_acceso" = NOW() WHERE "ID_Cuenta" = %s', (cuenta["ID_Cuenta"],))
                conexion.commit()
                cur_temp.close()
            except Exception as e:
                print(f"Error actualizando Ultimo_acceso: {e}")
                
            security_logger.info(f"Login exitoso: {usuario} desde {request.remote_addr}")
            
            # ... resto del código de premium ...
            cursor_temp = conexion.cursor(cursor_factory=RealDictCursor)
            cursor_temp.execute('SELECT "Es_premium", "Premium_vence", "Plan_premium", "Avatar_plan" FROM public."Cuentas" WHERE "ID_Cuenta" = %s', (cuenta["ID_Cuenta"],))
            res_premium = cursor_temp.fetchone()
            
            es_p_db = res_premium["Es_premium"] if res_premium else False
            vence   = res_premium["Premium_vence"] if res_premium else None
            plan    = res_premium["Plan_premium"] if res_premium else "gratis"
            avatar_plan = res_premium["Avatar_plan"] if res_premium else None
            
            # Guardar en sesión
            session["es_premium"]   = es_p_db
            session["plan_premium"] = plan
            session["avatar_plan"]  = avatar_plan if avatar_plan else plan
            
            # Cargar estado de administrador en sesión
            cursor_temp2 = conexion.cursor(cursor_factory=RealDictCursor)
            cursor_temp2.execute('SELECT "Es_admin" FROM public."Cuentas" WHERE "ID_Cuenta" = %s', (cuenta["ID_Cuenta"],))
            res_admin = cursor_temp2.fetchone()
            session["es_admin"] = bool(res_admin and res_admin.get("Es_admin", False))
            cursor_temp2.close()
            
            # Verificar expiración de forma segura
            if es_p_db and vence:
                ahora = datetime.now(vence.tzinfo) if vence.tzinfo else datetime.now()
                if ahora > vence:
                    cursor_temp.execute('UPDATE public."Cuentas" SET "Es_premium" = FALSE, "Plan_premium" = \'gratis\', "Avatar_plan" = \'ninguno\' WHERE "ID_Cuenta" = %s', (cuenta["ID_Cuenta"],))
                    conexion.commit()
                    session["es_premium"]   = False
                    session["plan_premium"] = "gratis"
                    session["avatar_plan"]  = "ninguno"
            
            cursor_temp.close()
            return jsonify({"success": True, "mensaje": "Inicio de sesión exitoso", "redirect": "/dashboard"}), 200

        security_logger.warning(f"Intento de login fallido: {usuario} (contraseña incorrecta) desde {request.remote_addr}")
        return jsonify({"error": "Contraseña incorrecta"}), 401

    except Exception as e:
        print(f"Error al iniciar sesión: {e}")
        return jsonify({"error": "Error al procesar la solicitud"}), 500

    finally:
        cerrar_db(cursor, conexion)


# ==============================================================================
# 4. INICIO DE SESIÓN CON GOOGLE (OAuth 2.0)
# ==============================================================================

def _google_flow(state=None):
    host = request.headers.get("X-Forwarded-Host") or request.host

    if "127.0.0.1" in host or "localhost" in host:
        redirect_url = "http://127.0.0.1:5000/google/callback"
    else:
        redirect_url = os.getenv("GOOGLE_REDIRECT_URI", "http://127.0.0.1:5000/google/callback")
    

    """Crea y retorna el objeto Flow de Google OAuth configurado."""
    client_config = {
        "web": {
            "client_id":                   os.getenv("GOOGLE_CLIENT_ID"),
            "project_id":                  "note-flow",
            "auth_uri":                    "https://accounts.google.com/o/oauth2/auth",
            "token_uri":                   "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "client_secret":               os.getenv("GOOGLE_CLIENT_SECRET"),
            "redirect_uris":               [redirect_url],
        }
    }
    scopes = [
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
        "openid",
    ]
    kwargs = {"state": state} if state else {}
    return Flow.from_client_config(
        client_config, scopes=scopes,
        redirect_uri=redirect_url, **kwargs
    )


@app.route("/google/login")
def google_login():
    """Redirige al proveedor de Google para autenticación."""
    flow = _google_flow()
    authorization_url, state = flow.authorization_url(
        access_type="offline", include_granted_scopes="true", prompt="consent"
    )
    session["state"] = state
    # Guardar el code_verifier para PKCE (vulnerabilidad de 'Missing code verifier')
    if hasattr(flow, 'code_verifier'):
        session["code_verifier"] = flow.code_verifier
        
    return redirect(authorization_url)


@app.route("/google/callback")
def google_callback():
    """Procesa la respuesta de Google y abre la sesión si el correo está registrado."""
    flow = _google_flow(state=session.get("state"))
    
    # Restaurar el code_verifier para validar el intercambio de token
    if "code_verifier" in session:
        flow.code_verifier = session.get("code_verifier")

    # Asegurar que la URL de respuesta use HTTPS si estamos en ngrok/producción
    authorization_response = request.url
    if "https://" in os.getenv("GOOGLE_REDIRECT_URI", "") and authorization_response.startswith("http://"):
        authorization_response = authorization_response.replace("http://", "https://", 1)

    flow.fetch_token(authorization_response=authorization_response)

    user_info = requests.get(
        "https://www.googleapis.com/oauth2/v1/userinfo",
        params={"alt": "json", "access_token": flow.credentials.token},
    ).json()

    email = user_info.get("email")
    if not email:
        return "No se pudo obtener el correo desde Google.", 400

    conexion = None
    cursor   = None
    try:
        conexion = conectar_db()
        if conexion is None:
            return "Error de conexión con la base de datos", 500

        cursor = conexion.cursor()
        cursor.execute("""
            SELECT "ID_Cuenta", "Es_premium", "Plan_premium", "Premium_vence"
            FROM public."Cuentas" WHERE "Correo" = %s
        """, (email,))
        row = cursor.fetchone()

        if not row:
            return redirect(url_for("cuenta_no_registrada"))

        id_cuenta    = int(row[0])
        es_premium   = row[1] if row[1] is not None else False
        plan_premium = row[2] if row[2] else 'gratis'
        vence        = row[3]

        # Verificar si el premium expiró
        if es_premium and vence:
            ahora = datetime.now(vence.tzinfo) if vence.tzinfo else datetime.now()
            if ahora > vence:
                cursor.execute("""
                    UPDATE public."Cuentas"
                    SET "Es_premium" = FALSE, "Plan_premium" = 'gratis'
                    WHERE "ID_Cuenta" = %s
                """, (id_cuenta,))
                conexion.commit()
                es_premium   = False
                plan_premium = 'gratis'

        colores = {"quincenal": "#a29bfe", "mensual": "#f1c40f", "anual": "#00d2d3"}

        session["usuario_id"]     = id_cuenta
        session["usuario_nombre"] = user_info.get("name") or email
        session["es_premium"]     = es_premium
        session["plan_premium"]   = plan_premium
        session["premium_color"]  = colores.get(plan_premium, "#f1c40f")

        # Registrar el último acceso
        try:
            cursor.execute('UPDATE public."Cuentas" SET "Ultimo_acceso" = NOW() WHERE "ID_Cuenta" = %s', (id_cuenta,))
            conexion.commit()
        except Exception as e:
            print(f"Error actualizando Ultimo_acceso en google login: {e}")

        return redirect("/dashboard")

    except Exception as e:
        print("Error en google_callback:", e)
        return "Error interno al procesar login con Google.", 500

    finally:
        cerrar_db(cursor, conexion)


# ==============================================================================
# 5. RECUPERAR CONTRASEÑA
#    Flujo: solicitud por correo → enlace con token → formulario → actualización
# ==============================================================================

@app.route("/olvide-contrasena")
def mostrar_olvide_contrasena():
    """Muestra el formulario para solicitar el restablecimiento de contraseña."""
    return render_template("olvide_contrasena.html")


@app.route("/procesar-olvide-contrasena", methods=["POST"])
@limiter.limit("3 per minute")
def procesar_olvide_contrasena():
    """Genera un token de restablecimiento y envía el enlace al correo."""
    conexion = None
    cursor   = None
    correo   = request.form.get("correo", "").strip()

    if not correo:
        return jsonify({"error": "El correo es obligatorio"}), 400

    try:
        conexion = conectar_db()
        if conexion is None:
            return jsonify({"error": "Error de conexión a la base de datos"}), 500

        cursor = conexion.cursor()
        cursor.execute('SELECT "ID_Cuenta", "Usuario" FROM public."Cuentas" WHERE "Correo" = %s', (correo,))
        row = cursor.fetchone()

        if not row:
            return jsonify({
                "error": "Este correo no está registrado en NoteFlow. Por favor verifica o regístrate primero."
            }), 404

        usuario_id     = row[0]
        usuario_nombre = row[1]
        token          = secrets.token_urlsafe(32)
        expira         = datetime.now() + timedelta(hours=1)

        cursor.execute("""
            UPDATE public."Cuentas"
            SET "reset_token" = %s, "reset_token_expira" = %s
            WHERE "ID_Cuenta" = %s
        """, (token, expira, usuario_id))
        conexion.commit()

        reset_url = url_for("mostrar_restablecer_contrasena", token=token, _external=True)
        msg      = Message("Restablecimiento de Contraseña NoteFlow", recipients=[correo])
        msg.body = f"Hola {usuario_nombre}, restablece tu contraseña aquí: {reset_url}"
        msg.html = construir_email_html(
            titulo="¿Olvidaste tu contraseña?",
            cuerpo_html=f"""
            <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 24px;">
                Hola <strong>{usuario_nombre}</strong>, recibimos una solicitud para
                restablecer la contraseña de tu cuenta NoteFlow.
            </p>
            <div style="text-align:center;margin:0 0 28px;">
                <a href="{reset_url}"
                style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);
                        color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;
                        font-weight:600;font-size:15px;">
                    🔑 Restablecer contraseña
                </a>
            </div>
            <p style="color:#6b7280;font-size:13px;margin:0 0 8px;">
                ⏰ Este enlace expira en <strong>1 hora</strong>.
            </p>
            <p style="color:#9ca3af;font-size:12px;margin:0;">
                Si no solicitaste este cambio, puedes ignorar este correo.
                Tu contraseña no será modificada.
            </p>
            """
        )

        try:
            mail.send(msg)
        except Exception as mail_e:
            print(f"Error al enviar correo: {mail_e}")
            return jsonify({"error": "Error al enviar el correo, revisa la configuración del MAIL."}), 500

        return jsonify({
            "success": True,
            "mensaje": "Si tu correo está registrado, recibirás un enlace de restablecimiento en breve.",
        }), 200

    except Exception as e:
        if conexion:
            conexion.rollback()
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500

    finally:
        cerrar_db(cursor, conexion)


@app.route("/restablecer-contrasena/<token>")
def mostrar_restablecer_contrasena(token):
    """Valida el token y muestra el formulario para ingresar la nueva contraseña."""
    conexion = None
    cursor   = None
    try:
        conexion = conectar_db()
        if conexion is None:
            return redirect(url_for("mostrar_login"))

        cursor = conexion.cursor(cursor_factory=RealDictCursor)
        cursor.execute("""
            SELECT "ID_Cuenta" FROM public."Cuentas"
            WHERE "reset_token" = %s AND "reset_token_expira" > %s
        """, (token, datetime.now()))

        if cursor.fetchone():
            return render_template("restablecer_contrasena.html", token=token, error=None)

        return render_template(
            "restablecer_contrasena.html", token=None,
            error="El enlace de restablecimiento no es válido o ha expirado."
        )

    except Exception as e:
        print(f"Error al verificar token: {e}")
        return render_template("restablecer_contrasena.html", token=None, error="Error interno al procesar la solicitud.")

    finally:
        cerrar_db(cursor, conexion)


@app.route("/procesar-restablecer-contrasena", methods=["POST"])
def procesar_restablecer_contrasena():
    """Actualiza la contraseña del usuario si el token es válido."""
    conexion          = None
    cursor            = None
    token             = request.form.get("token",             "").strip()
    nueva_contrasena  = request.form.get("nueva_contrasena",  "").strip()

    if not token or not nueva_contrasena:
        return jsonify({"error": "Faltan datos obligatorios."}), 400

    # Validación de fortaleza de nueva contraseña
    if len(nueva_contrasena) < 8 or not re.search(r"[A-Za-z]", nueva_contrasena) or not re.search(r"[0-9]", nueva_contrasena):
        return jsonify({"error": "La contraseña debe tener al menos 8 caracteres, incluyendo letras y números"}), 400

    try:
        conexion = conectar_db()
        if conexion is None:
            return jsonify({"error": "Error de conexión a la base de datos."}), 500

        cursor = conexion.cursor()
        cursor.execute("""
            SELECT "ID_Cuenta" FROM public."Cuentas"
            WHERE "reset_token" = %s AND "reset_token_expira" > %s
        """, (token, datetime.now()))
        row = cursor.fetchone()

        if not row:
            return jsonify({"error": "El enlace ha expirado o es inválido."}), 401

        cursor.execute("""
            UPDATE public."Cuentas"
            SET "Contraseña" = %s, "reset_token" = NULL, "reset_token_expira" = NULL
            WHERE "ID_Cuenta" = %s
        """, (generate_password_hash(nueva_contrasena), row[0]))
        conexion.commit()
        security_logger.info(f"Contraseña restablecida exitosamente para ID de cuenta: {row[0]}")

        return jsonify({
            "success": True,
            "mensaje":  "Contraseña restablecida con éxito. Redirigiendo a Iniciar Sesión.",
            "redirect": url_for("mostrar_login"),
        }), 200

    except Exception as e:
        if conexion:
            conexion.rollback()
        security_logger.error(f"Error al restablecer contraseña con token: {str(e)}")
        print(f"Error al restablecer contraseña: {e}")
        return jsonify({"error": "Error interno al procesar la solicitud."}), 500

    finally:
        cerrar_db(cursor, conexion)


# ==============================================================================
# 6. CERRAR SESIÓN
# ==============================================================================

@app.route("/logout")
def cerrar_sesion():
    """Cierra la sesión y redirige a la página de bienvenida."""
    usuario_id = session.get("usuario_id")
    if usuario_id:
        limpiar_soporte_db(usuario_id)
    session.clear()
    return redirect(url_for("inicio"))


@app.route("/perfil/cerrar-sesion")
@login_required
def cerrar_sesion_perfil():
    """Cierra la sesión desde la página de perfil y redirige al login."""
    usuario_id = session.get("usuario_id")
    if usuario_id:
        limpiar_soporte_db(usuario_id)
    session.clear()
    return redirect(url_for("mostrar_login"))

# ==============================================================================
# REPORTE DE USUARIO
# ==============================================================================

@app.route("/reporte")
@login_required
def reporte_usuario():
    """Muestra estadísticas y reporte detallado del usuario."""
    user_id = session.get("usuario_id")
    conexion = conectar_db(dict_cursor=True)
    if not conexion:
        return "Error de conexión a la base de datos", 500
        
    try:
        cur = conexion.cursor()
        
        # 1. Datos básicos del usuario (Último acceso, plan, etc.)
        cur.execute("""
            SELECT "Nombres", "Foto", "Color_principal", "Es_premium", "Plan_premium", "Es_admin", "Ultimo_acceso"
            FROM public."Cuentas" WHERE "ID_Cuenta" = %s
        """, (user_id,))
        usuario = cur.fetchone()
        
        if not usuario:
            session.clear()
            cerrar_db(cur, conexion)
            return redirect(url_for("mostrar_login"))
            
        # 2. Estadísticas de notas (totales vs eliminadas)
        cur.execute("""
            SELECT 
                COUNT(*) FILTER (WHERE "Estado" = 'Activa') as activas,
                COUNT(*) FILTER (WHERE LOWER("Estado") = 'papelera') as eliminadas
            FROM public."Notas"
            WHERE "ID_Cuenta" = %s
        """, (user_id,))
        stats_notas = cur.fetchone()
        
        # 3. Archivo más reciente modificado
        cur.execute("""
            SELECT "Titulo", "Fecha_deedicion", "Formato"
            FROM public."Notas"
            WHERE "ID_Cuenta" = %s
            ORDER BY "Fecha_deedicion" DESC
            LIMIT 1
        """, (user_id,))
        ultima_nota = cur.fetchone()
        
        # 4. Distribución por formato
        cur.execute("""
            SELECT "Formato", COUNT(*) as cantidad
            FROM public."Notas"
            WHERE "ID_Cuenta" = %s AND "Estado" = 'Activa'
            GROUP BY "Formato"
            ORDER BY cantidad DESC
        """, (user_id,))
        formatos = cur.fetchall()
        
        # 5. Resumen de carpetas
        cur.execute("""
            SELECT COUNT(*) as total_carpetas
            FROM public."Carpetas"
            WHERE "ID_Cuenta" = %s AND "Estado" = 'Activa'
        """, (user_id,))
        carpetas_info = cur.fetchone()

        # 6. Horas totales en NoteFlow
        cur.execute("""
            SELECT SUM("Tiempo_segundos") as total_segundos
            FROM public."Actividad_Usuario"
            WHERE "ID_Cuenta" = %s
        """, (user_id,))
        actividad_total = cur.fetchone()
        horas_totales = round((actividad_total['total_segundos'] or 0) / 3600, 2)

        # 7. Notas más usadas en el mes actual
        cur.execute("""
            SELECT 
                n."Titulo",
                SUM(a."Tiempo_segundos") as tiempo_segundos,
                SUM(a."Visitas") as visitas
            FROM public."Actividad_Usuario" a
            JOIN public."Notas" n ON a."ID_Nota" = n."ID_Nota"
            WHERE a."ID_Cuenta" = %s 
              AND EXTRACT(MONTH FROM a."Fecha") = EXTRACT(MONTH FROM CURRENT_DATE)
              AND EXTRACT(YEAR FROM a."Fecha") = EXTRACT(YEAR FROM CURRENT_DATE)
            GROUP BY n."ID_Nota", n."Titulo"
            ORDER BY tiempo_segundos DESC
            LIMIT 5
        """, (user_id,))
        notas_mas_usadas = cur.fetchall()
        
        cerrar_db(cur, conexion)
        
        return render_template("reporte.html", 
                             usuario=usuario, 
                             stats_notas=stats_notas, 
                             ultima_nota=ultima_nota, 
                             formatos=formatos,
                             carpetas_info=carpetas_info,
                             horas_totales=horas_totales,
                             notas_mas_usadas=notas_mas_usadas)
    except Exception as e:
        print(f"Error en reporte_usuario: {e}")
        return "Error interno del servidor", 500

@app.route("/ping-actividad", methods=["POST"])
@login_required
def ping_actividad():
    """Recibe pings periódicos para calcular tiempo de uso."""
    user_id = session.get("usuario_id")
    tiempo = request.form.get("tiempo_segundos", type=int, default=0)
    nota_id = request.form.get("nota_id", type=int)

    if tiempo <= 0 or tiempo > 300: # Ignorar pings maliciosos o muy largos
        return jsonify({"status": "ok"})

    conexion = conectar_db()
    if not conexion:
        return jsonify({"error": "db"}), 500

    try:
        cur = conexion.cursor()
        # Insertar o actualizar la actividad del día
        cur.execute("""
            INSERT INTO public."Actividad_Usuario" ("ID_Cuenta", "ID_Nota", "Fecha", "Tiempo_segundos", "Visitas")
            VALUES (%s, %s, CURRENT_DATE, %s, 1)
            ON CONFLICT ("ID_Cuenta", "ID_Nota", "Fecha")
            DO UPDATE SET 
                "Tiempo_segundos" = "Actividad_Usuario"."Tiempo_segundos" + EXCLUDED."Tiempo_segundos",
                "Visitas" = "Actividad_Usuario"."Visitas" + 1
        """, (user_id, nota_id, tiempo))
        conexion.commit()
        cerrar_db(cur, conexion)
        return jsonify({"status": "ok"})
    except Exception as e:
        print("Error en ping_actividad:", e)
        if conexion:
            conexion.rollback()
            cerrar_db(conexion.cursor(), conexion)
        return jsonify({"error": "server"}), 500

# ==============================================================================
# 7. DASHBOARD
# ==============================================================================

@app.route("/dashboard")
@login_required
def dashboard():
    """
    Página principal del usuario.
    Muestra estadísticas generales y las 6 notas activas más recientes.
    """
    user_id  = session["usuario_id"]
    conexion = None
    cursor   = None
    try:
        conexion = conectar_db()
        cursor   = conexion.cursor(cursor_factory=RealDictCursor)

        cursor.execute("""
            SELECT "Nombres",
                   COALESCE(NULLIF(TRIM("Color_principal"), ''), 'Blanco') AS "Color_principal",
                   "Foto", "Es_premium", "Plan_premium", "Premium_vence", "Es_admin",
                   COALESCE("Veces_premium", 0) AS "Veces_premium",
                   COALESCE("Avatar_plan", "Plan_premium", 'quincenal') AS "Avatar_plan"
            FROM public."Cuentas"
            WHERE "ID_Cuenta" = %s
        """, (user_id,))
        usuario_row = cursor.fetchone()

        if not usuario_row:
            session.clear()
            return redirect(url_for("mostrar_login"))

        # Verificar y actualizar estado premium si expiró
        es_premium = usuario_row.get("Es_premium", False)
        vence      = usuario_row.get("Premium_vence")
        plan       = usuario_row.get("Plan_premium") or "gratis"
        
        if es_premium and vence:
            ahora = datetime.now(vence.tzinfo) if vence.tzinfo else datetime.now()
            if ahora > vence:
                cursor.execute("""
                    UPDATE public."Cuentas"
                    SET "Es_premium" = FALSE, "Plan_premium" = 'gratis'
                    WHERE "ID_Cuenta" = %s
                """, (user_id,))
                conexion.commit()
                es_premium = False
                plan       = "gratis"

        # =======================================================
        # VALIDACIÓN INMEDIATA REDIRECT EPAYCO (Para localhost)
        # =======================================================
        ref_payco = request.args.get("ref_payco")
        if ref_payco:
            try:
                import requests
                resp_epayco = requests.get(f"https://secure.epayco.co/validation/v1/reference/{ref_payco}")
                if resp_epayco.status_code == 200:
                    data_tx = resp_epayco.json().get("data", {})
                    estado = data_tx.get("x_response")
                    if estado == "Aceptada":
                        plan_comprado = data_tx.get("x_extra2", "mensual").lower()
                        dias = {"quincenal": 15, "mensual": 30, "anual": 365}.get(plan_comprado, 30)
                        
                        expira = datetime.now() + timedelta(days=dias)
                        
                        cursor.execute("""
                            UPDATE public."Cuentas"
                            SET "Es_premium" = TRUE, "Premium_vence" = %s, "Plan_premium" = %s,
                                "Veces_premium" = COALESCE("Veces_premium", 0) + 1,
                                "Avatar_plan" = %s
                            WHERE "ID_Cuenta" = %s
                        """, (expira, plan_comprado, plan_comprado, user_id))
                        conexion.commit()
                        es_premium = True
                        plan = plan_comprado
            except Exception as e:
                print(f"Error verificando ref_payco en dashboard: {e}")
        usuario = {
            "Nombres":         usuario_row.get("Nombres"),
            "Color_principal": usuario_row.get("Color_principal") or "Blanco",
            "Foto":            usuario_row.get("Foto") or "default_profile.png",
            "Es_premium":      es_premium,
            "Plan_premium":    plan,
            "Es_admin":        bool(usuario_row.get("Es_admin", False))
        }
        
        # El avatar_plan de la fila puede estar desincronizado si el pago acaba de ocurrir
        # Usar el plan_comprado si fue actualizado, si no usar el del row
        avatar_plan_actual = usuario_row.get("Avatar_plan")
        
        # Si es premium y el avatar_plan está VACÍO o tiene un valor inválido ('gratis'),
        # sincronizarlo automáticamente con el plan comprado.
        # IMPORTANTE: 'ninguno' es una elección válida del usuario, no se toca.
        planes_orden = {"quincenal": 1, "mensual": 2, "anual": 3}
        if es_premium and plan in planes_orden:
            nivel_avatar = planes_orden.get(avatar_plan_actual, -1)
            if avatar_plan_actual in (None, "gratis") or (nivel_avatar < 0 and avatar_plan_actual not in ("ninguno", "cosmico")):
                avatar_plan_actual = plan
                # Actualizar en BD silenciosamente
                try:
                    cursor.execute(
                        'UPDATE public."Cuentas" SET "Avatar_plan" = %s WHERE "ID_Cuenta" = %s',
                        (plan, user_id)
                    )
                    conexion.commit()
                except Exception:
                    pass
        
        colores = {"quincenal": "#a29bfe", "mensual": "#f1c40f", "anual": "#00d2d3"}
        session["es_premium"]    = es_premium
        session["plan_premium"]  = plan
        session["premium_color"] = colores.get(plan, "#f1c40f")
        session["avatar_plan"]   = avatar_plan_actual
        session["es_admin"]      = bool(usuario_row.get("Es_admin", False))

        cursor.execute("""
            SELECT COUNT(*) AS total FROM public."Notas"
            WHERE "ID_Cuenta" = %s AND LOWER("Estado") = 'activa'
        """, (user_id,))
        total_notas = cursor.fetchone()["total"]

        cursor.execute("""
            SELECT COUNT(*) AS total FROM public."Carpetas"
            WHERE "ID_Cuenta" = %s
        """, (user_id,))
        total_carpetas = cursor.fetchone()["total"]

        cursor.execute("""
            SELECT COUNT(*) AS total FROM public."Notas"
            WHERE "ID_Cuenta" = %s AND LOWER("Estado") = 'papelera'
        """, (user_id,))
        notas_papelera = cursor.fetchone()["total"]

        cursor.execute("""
            SELECT "ID_Nota", "Titulo", "Descripcion", "Fecha_deedicion", "Formato"
            FROM public."Notas"
            WHERE "ID_Cuenta" = %s AND LOWER("Estado") = 'activa'
            ORDER BY "Fecha_deedicion" DESC NULLS LAST
            LIMIT 6
        """, (user_id,))
        notas_raw = cursor.fetchall()

        notas_recientes = []
        for nota in notas_raw:
            nota_id = nota["ID_Nota"]
            notas_recientes.append({
                "ID_Nota":        nota_id,
                "Titulo":         nota.get("Titulo"),
                "Descripcion":    nota.get("Descripcion"),
                "Fecha_deedicion":nota.get("Fecha_deedicion"),
                "Formato":        nota.get("Formato") or "",
                "Etiquetas":      obtener_etiquetas_nota(nota_id, cursor),
                "Has_Adjuntos":   verificar_adjuntos_nota(nota_id, cursor),
                "tipo":           "nota",
            })

        # Obtener carpetas recientes (limit 6, ordenadas por fecha de edición)
        cursor.execute("""
            SELECT c."ID_Carpeta", c."Nombre_carpeta",
                   COALESCE(c."Fecha_edicion", c."Fecha_creacion") AS "Fecha_edicion",
                   COUNT(n."ID_Nota") AS total_notas
            FROM public."Carpetas" c
            LEFT JOIN public."Notas" n ON n."ID_Carpeta" = c."ID_Carpeta" AND n."Estado" = 'Activa'
            WHERE c."ID_Cuenta" = %s
            GROUP BY c."ID_Carpeta", c."Nombre_carpeta", c."Fecha_edicion", c."Fecha_creacion"
            ORDER BY COALESCE(c."Fecha_edicion", c."Fecha_creacion") DESC NULLS LAST
            LIMIT 6
        """, (user_id,))
        carpetas_raw = cursor.fetchall()

        carpetas_recientes = []
        for carpeta in carpetas_raw:
            carpetas_recientes.append({
                "ID_Carpeta":     carpeta["ID_Carpeta"],
                "Nombre_carpeta": carpeta["Nombre_carpeta"],
                "Fecha_edicion": carpeta.get("Fecha_edicion"),
                "total_notas":   carpeta["total_notas"],
                "tipo":          "carpeta",
            })

        # Carpetas primero (max 3) por fecha desc, luego notas (max 3) por fecha desc
        from datetime import date as _date
        def _fecha_segura(val):
            if val is None:
                return _date.min
            if hasattr(val, "date"):
                return val.date()
            return val
        todos_recientes = carpetas_recientes + notas_recientes
        todos_recientes.sort(
            key=lambda x: _fecha_segura(x.get("Fecha_edicion") if "Fecha_edicion" in x else x.get("Fecha_deedicion")),
            reverse=True
        )
        recientes = todos_recientes[:3]

        veces_premium = usuario_row.get("Veces_premium", 0)

        return render_template(
            "dashboard.html",
            usuario=usuario,
            total_notas=total_notas,
            total_carpetas=total_carpetas,
            notas_papelera=notas_papelera,
            notas_recientes=recientes,
            veces_premium=veces_premium,
        )

    except Exception as e:
        import traceback; traceback.print_exc()
        return f"Error al cargar dashboard: {str(e)}", 500

    finally:
        cerrar_db(cursor, conexion)


# ==============================================================================
# 8. PERFIL
#    Incluye: ver perfil, cambiar tema, cambiar contraseña,
#             subir foto y eliminar foto.
# ==============================================================================

@app.route("/perfil")
@login_required
def perfil():
    """Muestra la página de perfil con los datos del usuario."""
    user_id  = session["usuario_id"]
    conexion = None
    cursor   = None
    try:
        conexion = conectar_db(dict_cursor=True)
        cursor   = conexion.cursor()

        # Crear columna Avatar_plan si no existe (migración automática)
        cursor.execute('ALTER TABLE public."Cuentas" ADD COLUMN IF NOT EXISTS "Avatar_plan" VARCHAR(20)')
        conexion.commit()

        cursor.execute("""
            SELECT "ID_Cuenta", "Usuario", "Nombres", "Apellidos",
                   "Correo", "Telefono", "Foto", "Color_principal", "Es_premium", "Plan_premium",
                   COALESCE("Avatar_plan", "Plan_premium", 'quincenal') AS "Avatar_plan",
                   "Premium_vence"
            FROM public."Cuentas"
            WHERE "ID_Cuenta" = %s
        """, (user_id,))
        usuario = cursor.fetchone()

        if not usuario:
            session.clear()
            return redirect(url_for("mostrar_login"))

        # Calcular tiempo restante del plan
        tiempo_restante = None
        if usuario.get("Es_premium") and usuario.get("Premium_vence"):
            ahora = datetime.now(tz=usuario["Premium_vence"].tzinfo)
            delta = usuario["Premium_vence"] - ahora
            dias = delta.days
            if dias < 0:
                tiempo_restante = "Plan vencido"
            elif dias == 0:
                horas = delta.seconds // 3600
                tiempo_restante = f"{horas} hora{'s' if horas != 1 else ''} restante{'s' if horas != 1 else ''}"
            elif dias == 1:
                tiempo_restante = "1 día restante"
            elif dias < 7:
                tiempo_restante = f"{dias} días restantes"
            elif dias < 31:
                semanas = dias // 7
                tiempo_restante = f"{semanas} semana{'s' if semanas != 1 else ''} restante{'s' if semanas != 1 else ''}"
            elif dias < 365:
                meses = dias // 30
                tiempo_restante = f"{meses} mes{'es' if meses != 1 else ''} restante{'s' if meses != 1 else ''}"
            else:
                anios = dias // 365
                tiempo_restante = f"{anios} año{'s' if anios != 1 else ''} restante{'s' if anios != 1 else ''}"

        return render_template("perfil.html", usuario=usuario, tiempo_restante=tiempo_restante)

    except Exception as e:
        print(f"Error al cargar perfil: {e}")
        return "Error al cargar el perfil", 500

    finally:
        cerrar_db(cursor, conexion)


@app.route("/perfil/cambiar-avatar", methods=["POST"])
@login_required
def cambiar_avatar():
    """Guarda el marco de avatar elegido por el usuario premium."""
    data = request.get_json()
    avatar_plan = data.get("avatar_plan", "quincenal")
    plan_actual = session.get("plan_premium", "gratis")
    
    # El marco cósmico es exclusivo para admins
    if avatar_plan == "cosmico":
        if not session.get("es_admin"):
            return jsonify({"error": "El marco cósmico es exclusivo para administradores."}), 403
    else:
        # Validar que el plan tenga acceso a ese marco
        permisos = {
            "gratis":    ["ninguno"],
            "quincenal": ["quincenal", "ninguno"],
            "mensual":   ["quincenal", "mensual", "ninguno"],
            "anual":     ["quincenal", "mensual", "anual", "ninguno"],
        }
        if avatar_plan not in permisos.get(plan_actual, []):
            return jsonify({"error": "Tu plan no tiene acceso a ese marco."}), 403
    
    user_id  = session["usuario_id"]
    conexion = None
    cursor   = None
    try:
        conexion = conectar_db()
        cursor   = conexion.cursor()
        # Intentar actualizar. Si la columna no existe, la creamos.
        try:
            cursor.execute("""
                UPDATE public."Cuentas" SET "Avatar_plan" = %s WHERE "ID_Cuenta" = %s
            """, (avatar_plan, user_id))
        except Exception:
            conexion.rollback()
            cursor.execute('ALTER TABLE public."Cuentas" ADD COLUMN IF NOT EXISTS "Avatar_plan" VARCHAR(20)')
            cursor.execute("""
                UPDATE public."Cuentas" SET "Avatar_plan" = %s WHERE "ID_Cuenta" = %s
            """, (avatar_plan, user_id))
        conexion.commit()
        session["avatar_plan"] = avatar_plan
        return jsonify({"success": True})
    except Exception as e:
        if conexion: conexion.rollback()
        print(f"Error al cambiar avatar: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        cerrar_db(cursor, conexion)

@app.route("/eliminar-cuenta", methods=["POST"])
@login_required
def eliminar_cuenta():
    """Elimina permanentemente la cuenta del usuario y todos sus datos asociados."""
    user_id = session.get("usuario_id")
    conexion = conectar_db()
    if not conexion:
        return jsonify({"error": "Error de conexión a la base de datos"}), 500

    try:
        cur = conexion.cursor()
        
        # Eliminar relaciones en cascada manual
        
        # 1. Obtener los IDs de las notas del usuario
        cur.execute('SELECT "ID_Nota" FROM public."Notas" WHERE "ID_Cuenta" = %s', (user_id,))
        notas = cur.fetchall()
        notas_ids = [n[0] for n in notas]

        if notas_ids:
            # 2. Eliminar de Notas_etiquetas
            cur.execute('DELETE FROM public."Notas_etiquetas" WHERE "ID_Nota" = ANY(%s)', (notas_ids,))
            
            # 3. Eliminar Adjuntos (opcional: eliminar archivos del filesystem o S3 si los hubiera)
            cur.execute('DELETE FROM public."Adjuntos" WHERE "ID_Nota" = ANY(%s)', (notas_ids,))

        # 4. Eliminar Actividad
        cur.execute('DELETE FROM public."Actividad_Usuario" WHERE "ID_Cuenta" = %s', (user_id,))

        # 5. Eliminar Notas
        cur.execute('DELETE FROM public."Notas" WHERE "ID_Cuenta" = %s', (user_id,))

        # 6. Eliminar Carpetas
        cur.execute('DELETE FROM public."Carpetas" WHERE "ID_Cuenta" = %s', (user_id,))

        # 7. Eliminar Soporte
        cur.execute('DELETE FROM public."Soporte" WHERE "ID_Cuenta" = %s', (user_id,))

        # 8. Finalmente, eliminar Cuenta
        cur.execute('DELETE FROM public."Cuentas" WHERE "ID_Cuenta" = %s', (user_id,))
        
        conexion.commit()
        session.clear()
        return jsonify({"success": True, "redirect": url_for('bienvenidoalapagina')})
        
    except Exception as e:
        conexion.rollback()
        print(f"Error al eliminar cuenta: {e}")
        return jsonify({"error": "No se pudo eliminar la cuenta. Contacte soporte."}), 500
    finally:
        cerrar_db(cur, conexion)

@app.route("/perfil/cambiar-tema", methods=["POST"])
@login_required
def cambiar_tema():
    """Guarda el tema elegido (claro/oscuro) en la base de datos y en la sesión."""
    tema = request.form.get("tema")
    if tema not in ["claro", "oscuro"]:
        return jsonify({"error": "Tema inválido"}), 400

    color_db = {"claro": "Blanco", "oscuro": "Negro"}[tema]
    user_id  = session["usuario_id"]
    conexion = None
    cursor   = None

    try:
        conexion = conectar_db()
        cursor   = conexion.cursor()
        cursor.execute("""
            UPDATE public."Cuentas" SET "Color_principal" = %s WHERE "ID_Cuenta" = %s
        """, (color_db, user_id))
        conexion.commit()

        session["color_principal"] = color_db
        session["Color_principal"] = color_db

        return jsonify({
            "success":  True,
            "mensaje":  f"Tema cambiado a {tema}",
            "tema_db":  color_db,
            "color_db": color_db,
        }), 200

    except Exception as e:
        if conexion:
            conexion.rollback()
        print(f"Error al cambiar tema: {e}")
        return jsonify({"error": "Error al actualizar tema"}), 500

    finally:
        cerrar_db(cursor, conexion)


@app.route("/perfil/cambiar-password", methods=["POST"])
@login_required
def cambiar_password():
    """Valida la contraseña actual y actualiza a la nueva."""
    user_id = session["usuario_id"]
    datos   = limpiar_datos_formulario(request.form, ["password_actual", "password_nueva", "password_confirmacion"])

    actual  = datos["password_actual"]
    nueva   = datos["password_nueva"]
    confirm = datos["password_confirmacion"]

    if not all([actual, nueva, confirm]):
        return jsonify({"error": "Todos los campos son obligatorios"}), 400
    if nueva != confirm:
        return jsonify({"error": "Las nuevas contraseñas no coinciden"}), 400
    if len(nueva) < 6:
        return jsonify({"error": "La contraseña debe tener al menos 6 caracteres"}), 400
    if len(nueva) > 15:
        return jsonify({"error": "La contraseña no puede superar 15 caracteres"}), 400

    conexion = None
    cursor   = None
    try:
        conexion = conectar_db(dict_cursor=True)
        cursor   = conexion.cursor()
        cursor.execute('SELECT "Contraseña" FROM public."Cuentas" WHERE "ID_Cuenta" = %s', (user_id,))
        user = cursor.fetchone()

        if not user:
            return jsonify({"error": "Usuario no encontrado"}), 404

        password_guardado = user["Contraseña"]
        es_hash           = password_guardado.startswith("pbkdf2:sha256:") or password_guardado.startswith("scrypt:")
        actual_correcto   = check_password_hash(password_guardado, actual) if es_hash else password_guardado == actual

        if not actual_correcto:
            return jsonify({"error": "La contraseña actual es incorrecta"}), 401

        misma = check_password_hash(password_guardado, nueva) if es_hash else password_guardado == nueva
        if misma:
            return jsonify({"error": "La nueva contraseña debe ser diferente"}), 400

        cursor.execute("""
            UPDATE public."Cuentas" SET "Contraseña" = %s WHERE "ID_Cuenta" = %s
        """, (generate_password_hash(nueva), user_id))
        conexion.commit()

        return jsonify({"success": True, "mensaje": "Contraseña actualizada exitosamente"}), 200

    except Exception as e:
        if conexion:
            conexion.rollback()
        print(f"Error al cambiar contraseña: {e}")
        return jsonify({"error": "Error al procesar la solicitud"}), 500

    finally:
        cerrar_db(cursor, conexion)


@app.route("/perfil/subir-foto", methods=["POST"])
@login_required
def subir_foto():
    """Guarda la nueva foto de perfil y elimina la anterior si existía."""
    archivo = request.files.get("foto")
    if not archivo or archivo.filename == "":
        return jsonify({"error": "No se seleccionó ninguna imagen"}), 400
    if not allowed_file(archivo.filename):
        return jsonify({"error": "Formato no permitido. Usa: PNG, JPG, JPEG, GIF o WEBP"}), 400

    archivo.seek(0, 2)
    file_size = archivo.tell()
    archivo.seek(0)
    
    max_mb = 100 if session.get("es_premium", False) else 5
    if file_size > max_mb * 1024 * 1024:
        return jsonify({"error": f"La foto supera el límite de {max_mb}MB"}), 400

    user_id = session["usuario_id"]
    conexion = None
    cursor   = None

    try:
        ext              = os.path.splitext(archivo.filename)[1].lower()
        filename         = f"user_{user_id}_{_uuid.uuid4().hex}{ext}"
        
        # SUBIR A SUPABASE en la carpeta 'profile'
        url_publica = subir_a_supabase(archivo, "profile", filename)
        
        if not url_publica:
            return jsonify({"error": "No se pudo subir la imagen a la nube"}), 500

        conexion = conectar_db(dict_cursor=True)
        cursor   = conexion.cursor()
        cursor.execute('SELECT "Foto" FROM public."Cuentas" WHERE "ID_Cuenta" = %s', (user_id,))
        result       = cursor.fetchone()
        foto_anterior = result.get("Foto") if result else None

        # Guardamos la URL completa en la base de datos
        cursor.execute('UPDATE public."Cuentas" SET "Foto" = %s WHERE "ID_Cuenta" = %s', (url_publica, user_id))
        conexion.commit()

        # Si había una foto anterior, la borramos del bucket si ningún otro usuario la usa
        if foto_anterior and "/storage/v1/object/public/NoteFlow/" in foto_anterior:
            cursor.execute('SELECT COUNT(*) AS total FROM public."Cuentas" WHERE "Foto" = %s', (foto_anterior,))
            en_uso = cursor.fetchone()["total"] > 0
            if not en_uso:
                eliminar_archivo_de_supabase_por_ruta(foto_anterior)

        return jsonify({
            "success":   True,
            "mensaje":   "Foto de perfil actualizada",
            "nueva_foto": url_publica,
        }), 200

    except Exception as e:
        if conexion:
            conexion.rollback()
        print(f"Error al subir foto: {e}")
        return jsonify({"error": "Error al guardar en base de datos"}), 500

    finally:
        cerrar_db(cursor, conexion)


@app.route("/perfil/eliminar-foto", methods=["POST"])
@login_required
def eliminar_foto_perfil():
    """
    Elimina la foto de perfil del usuario:
    borra el archivo del bucket de Supabase si no está en uso y pone NULL en la base de datos.
    """
    user_id  = session["usuario_id"]
    conexion = None
    cursor   = None

    try:
        conexion = conectar_db(dict_cursor=True)
        if conexion is None:
            return jsonify({"error": "Error de conexión a la base de datos"}), 500

        cursor = conexion.cursor()
        cursor.execute('SELECT "Foto" FROM public."Cuentas" WHERE "ID_Cuenta" = %s', (user_id,))
        row = cursor.fetchone()
        if not row:
            return jsonify({"error": "Usuario no encontrado"}), 404

        foto_anterior = row.get("Foto")

        cursor.execute('UPDATE public."Cuentas" SET "Foto" = NULL WHERE "ID_Cuenta" = %s', (user_id,))
        conexion.commit()

        # Si había una foto anterior, la borramos del bucket si ningún otro usuario la usa
        if foto_anterior and "/storage/v1/object/public/NoteFlow/" in foto_anterior:
            cursor.execute('SELECT COUNT(*) AS total FROM public."Cuentas" WHERE "Foto" = %s', (foto_anterior,))
            en_uso = cursor.fetchone()["total"] > 0
            if not en_uso:
                eliminar_archivo_de_supabase_por_ruta(foto_anterior)

        return jsonify({
            "success":      True,
            "mensaje":      "Foto de perfil eliminada correctamente",
            "foto_default": url_for("static", filename="default_profile.png"),
        }), 200

    except Exception as e:
        if conexion:
            conexion.rollback()
        print(f"Error al eliminar foto de perfil: {e}")
        return jsonify({"error": "Error al eliminar la foto de perfil"}), 500

    finally:
        cerrar_db(cursor, conexion)
# ==============================================================================
# 9. MIS NOTAS
# ==============================================================================

@app.route("/notas")
@login_required
def mostrar_notas():
    """
    Muestra la página de Mis Notas.
    Solo carga los datos del usuario para el encabezado.
    Las notas y carpetas se cargan vía AJAX.
    """
    user_id  = session["usuario_id"]
    conexion = None
    cursor   = None
    try:
        conexion = conectar_db(dict_cursor=True)
        cursor   = conexion.cursor()
        cursor.execute("""
            SELECT "Nombres", "Foto", "Color_principal", "Es_premium", "Plan_premium", "Es_admin"
            FROM public."Cuentas" WHERE "ID_Cuenta" = %s
        """, (user_id,))
        usuario = cursor.fetchone()

        if not usuario:
            session.clear()
            return redirect(url_for("mostrar_login"))

        return render_template("notas.html", notas=[], carpetas=[], usuario=usuario)

    except Exception as e:
        import traceback; traceback.print_exc()
        return f"Error al cargar la página de notas: {str(e)}", 500

    finally:
        cerrar_db(cursor, conexion)

# ==============================================================================
# 9.2 Agregar Notas a Mis notas
# ==============================================================================

@app.route("/api/mis-notas")
@login_required
def api_mis_notas():
    """
    Devuelve las notas activas del usuario en formato JSON.
    Acepta filtros opcionales por query params:
      - q        : texto en título o contenido
      - formato  : texto, imagen, audio, video, dibujo, mixta
      - carpeta  : nombre de carpeta
      - desde    : fecha de creación desde (YYYY-MM-DD)
      - hasta    : fecha de edición hasta (YYYY-MM-DD)
      - etiquetas: etiquetas separadas por coma
      - orden    : reciente, antiguo, az, za
    """
    user_id  = session["usuario_id"]
    conexion = None
    cursor   = None
    try:
        conexion = conectar_db(dict_cursor=True)
        cursor   = conexion.cursor()

        # Leer filtros
        q         = request.args.get("q",         "").strip()
        formato   = request.args.get("formato",   "").strip()
        carpeta   = request.args.get("carpeta",   "").strip()
        desde     = request.args.get("desde",     "").strip()
        hasta     = request.args.get("hasta",     "").strip()
        etiquetas = request.args.get("etiquetas", "").strip()
        orden     = request.args.get("orden",     "reciente").strip()

        # Base de la consulta
        sql    = """
            SELECT
                n."ID_Nota",
                n."Titulo",
                n."Descripcion",
                n."Formato",
                n."Fecha_decreacion",
                n."Fecha_deedicion",
                c."Nombre_carpeta"
            FROM public."Notas" n
            LEFT JOIN public."Carpetas" c ON n."ID_Carpeta" = c."ID_Carpeta"
            WHERE n."ID_Cuenta" = %s AND n."Estado" = 'Activa'
        """
        params = [user_id]

        # Filtro texto
        if q:
            sql    += ' AND (LOWER(n."Titulo") LIKE %s OR LOWER(n."Contenido") LIKE %s)'
            params += [f"%{q.lower()}%", f"%{q.lower()}%"]

        # Filtro formato
        if formato:
            sql    += ' AND LOWER(n."Formato") = %s'
            params += [formato.lower()]

        # Filtro carpeta (exact match)
        if carpeta:
            sql    += ' AND c."Nombre_carpeta" = %s'
            params += [carpeta]

        # Filtro fecha desde (creación)
        if desde:
            sql    += ' AND n."Fecha_decreacion" >= %s'
            params += [desde]

        # Filtro fecha hasta (edición)
        if hasta:
            sql    += ' AND n."Fecha_deedicion" <= %s'
            params += [hasta]

        # Filtro etiquetas
        etiquetas_lista = [e.strip().lower() for e in etiquetas.split(",") if e.strip()]
        if etiquetas_lista:
            for tag in etiquetas_lista:
                sql += """
                    AND EXISTS (
                        SELECT 1 FROM public."Notas_etiquetas" ne
                        JOIN public."Etiquetas" e ON ne."ID_Etiqueta" = e."ID_Etiqueta"
                        WHERE ne."ID_Nota" = n."ID_Nota"
                        AND LOWER(e."Nombre_etiqueta") = %s
                    )
                """
                params += [tag]

        # Orden
        ordenes = {
            "reciente": 'n."Fecha_deedicion" DESC',
            "antiguo":  'n."Fecha_deedicion" ASC',
            "az":       'n."Titulo" ASC',
            "za":       'n."Titulo" DESC',
        }
        sql += f' ORDER BY {ordenes.get(orden, ordenes["reciente"])}'

        cursor.execute(sql, params)
        filas = cursor.fetchall()

        notas = []
        for n in filas:
            etiquetas_nota = obtener_etiquetas_nota(n["ID_Nota"], cursor)
            notas.append({
                "id":          n["ID_Nota"],
                "titulo":      n["Titulo"],
                "descripcion": n["Descripcion"],
                "formato":     n["Formato"],
                "creacion":    str(n["Fecha_decreacion"]),
                "edicion":     str(n["Fecha_deedicion"]),
                "carpeta":     n["Nombre_carpeta"],
                "etiquetas":   [e["Nombre_etiqueta"] for e in etiquetas_nota],
            })

        return jsonify({"success": True, "notas": notas}), 200

    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"error": "Error al obtener las notas"}), 500

    finally:
        cerrar_db(cursor, conexion)


# ==============================================================================
# 9.2.2 API Mis Notas y Carpetas (ordenado: carpetas primero, luego notas)
# ==============================================================================
@app.route("/api/mis-notas-y-carpetas")
@login_required
def api_mis_notas_y_carpetas():
    """
    Devuelve carpetas y notas activas del usuario ordenadas.
    Primero carpetas (por fecha de edición), luego notas (por fecha de edición).
    """
    user_id  = session["usuario_id"]
    conexion = None
    cursor   = None
    try:
        conexion = conectar_db(dict_cursor=True)
        cursor   = conexion.cursor()

        # Obtener carpetas
        cursor.execute("""
            SELECT
                c."ID_Carpeta",
                c."Nombre_carpeta",
                c."Fecha_creacion",
                c."Fecha_edicion",
                COUNT(n."ID_Nota") AS total_notas
            FROM public."Carpetas" c
            LEFT JOIN public."Notas" n ON n."ID_Carpeta" = c."ID_Carpeta" AND n."Estado" = 'Activa'
            WHERE c."ID_Cuenta" = %s AND c."Estado" = 'Activa'
            GROUP BY c."ID_Carpeta", c."Nombre_carpeta", c."Fecha_creacion", c."Fecha_edicion"
            ORDER BY c."Fecha_edicion" DESC NULLS LAST
        """, (user_id,))
        carpetas_raw = cursor.fetchall()

        carpetas = [{
            "id":          c["ID_Carpeta"],
            "nombre":      c["Nombre_carpeta"],
            "creacion":    str(c["Fecha_creacion"]) if c["Fecha_creacion"] else "",
            "edicion":     str(c["Fecha_edicion"]) if c["Fecha_edicion"] else "",
            "total_notas": c["total_notas"],
            "tipo":        "carpeta",
        } for c in carpetas_raw]

        # Obtener notas ordenadas
        cursor.execute("""
            SELECT
                n."ID_Nota",
                n."Titulo",
                n."Descripcion",
                n."Formato",
                n."Fecha_decreacion",
                n."Fecha_deedicion",
                c."Nombre_carpeta"
            FROM public."Notas" n
            LEFT JOIN public."Carpetas" c ON n."ID_Carpeta" = c."ID_Carpeta"
            WHERE n."ID_Cuenta" = %s AND n."Estado" = 'Activa' AND n."ID_Carpeta" IS NULL
            ORDER BY n."Fecha_deedicion" DESC NULLS LAST
        """, (user_id,))
        notas_raw = cursor.fetchall()

        notas = []
        for n in notas_raw:
            etiquetas_nota = obtener_etiquetas_nota(n["ID_Nota"], cursor)
            notas.append({
                "id":          n["ID_Nota"],
                "titulo":      n["Titulo"],
                "descripcion": n["Descripcion"],
                "formato":     n["Formato"],
                "creacion":    str(n["Fecha_decreacion"]),
                "edicion":     str(n["Fecha_deedicion"]),
                "carpeta":     n["Nombre_carpeta"],
                "etiquetas":   [e["Nombre_etiqueta"] for e in etiquetas_nota],
                "tipo":        "nota",
            })

        return jsonify({"success": True, "carpetas": carpetas, "notas": notas}), 200

    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"error": "Error al obtener notas y carpetas"}), 500

    finally:
        cerrar_db(cursor, conexion)

# ==============================================================================
# 9.3 Notas Ruta eliminar papelera
# ==============================================================================
@app.route("/papelera/mover/<int:nota_id>", methods=["POST"])
@login_required
def mover_a_papelera(nota_id):
    """Mueve una nota al estado 'Papelera' (eliminación suave)."""
    user_id  = session["usuario_id"]
    conexion = None
    cursor   = None
    try:
        conexion = conectar_db()
        cursor   = conexion.cursor()
        # Verifica que la nota pertenezca al usuario
        cursor.execute("""
            UPDATE public."Notas"
            SET "Estado" = 'Papelera', "Fecha_deedicion" = %s
            WHERE "ID_Nota" = %s AND "ID_Cuenta" = %s AND "Estado" = 'Activa'
        """, (datetime.now(), nota_id, user_id))

        if cursor.rowcount == 0:
            return jsonify({"error": "Nota no encontrada o sin permisos"}), 404

        conexion.commit()
        return jsonify({"success": True}), 200

    except Exception as e:
        if conexion: conexion.rollback()
        return jsonify({"error": "Error interno"}), 500

    finally:
        cerrar_db(cursor, conexion)        

# ==============================================================================
# 9.4 API Mis Carpetas en mis notas para mostrar el filtro de carpetas dinámicamente
# ==============================================================================

@app.route("/api/mis-carpetas")
@login_required
def api_mis_carpetas():
    """Devuelve las carpetas del usuario con filtros opcionales."""
    user_id  = session["usuario_id"]
    conexion = None
    cursor   = None
    try:
        conexion = conectar_db(dict_cursor=True)
        cursor   = conexion.cursor()

        q         = request.args.get("q",         "").strip()
        orden     = request.args.get("orden",     "az").strip()
        min_notas = request.args.get("min_notas", "").strip()

        # Detectar si la tabla tiene columnas de fecha
        cursor.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'Carpetas'
        """)
        cols_carpeta = [r["column_name"] for r in cursor.fetchall()]
        tiene_fechas = "Fecha_creacion" in cols_carpeta and "Fecha_edicion" in cols_carpeta

        if tiene_fechas:
            select_fechas = 'c."Fecha_creacion", c."Fecha_edicion",'
            group_fechas  = ', c."Fecha_creacion", c."Fecha_edicion"'
        else:
            select_fechas = ''
            group_fechas  = ''

        sql = f"""
            SELECT
                c."ID_Carpeta",
                c."Nombre_carpeta",
                {select_fechas}
                COUNT(n."ID_Nota") AS total_notas
            FROM public."Carpetas" c
            LEFT JOIN public."Notas" n
                ON n."ID_Carpeta" = c."ID_Carpeta" AND n."Estado" = 'Activa'
            WHERE c."ID_Cuenta" = %s AND c."Estado" = 'Activa'
        """
        params = [user_id]

        if q:
            sql    += ' AND LOWER(c."Nombre_carpeta") LIKE %s'
            params += [f"%{q.lower()}%"]

        sql += f' GROUP BY c."ID_Carpeta", c."Nombre_carpeta"{group_fechas}'

        if min_notas:
            try:
                sql += ' HAVING COUNT(n."ID_Nota") >= %s'
                params += [int(min_notas)]
            except ValueError:
                pass

        if tiene_fechas:
            ordenes = {
                "reciente":      'c."Fecha_edicion" DESC',
                "antiguo":       'c."Fecha_edicion" ASC',
                "creacion_desc": 'c."Fecha_creacion" DESC',
                "creacion_asc":  'c."Fecha_creacion" ASC',
                "az":            'c."Nombre_carpeta" ASC',
                "za":            'c."Nombre_carpeta" DESC',
            }
        else:
            ordenes = {
                "reciente":      'c."Nombre_carpeta" ASC',
                "antiguo":       'c."Nombre_carpeta" ASC',
                "creacion_desc": 'c."Nombre_carpeta" ASC',
                "creacion_asc":  'c."Nombre_carpeta" ASC',
                "az":            'c."Nombre_carpeta" ASC',
                "za":            'c."Nombre_carpeta" DESC',
            }
        sql += f' ORDER BY {ordenes.get(orden, ordenes["az"])}'

        cursor.execute(sql, params)
        filas = cursor.fetchall()

        carpetas = [{
            "id":          f["ID_Carpeta"],
            "nombre":      f["Nombre_carpeta"],
            "total_notas": f["total_notas"],
            "creacion":    str(f.get("Fecha_creacion", "")),
            "edicion":     str(f.get("Fecha_edicion",  "")),
        } for f in filas]

        return jsonify({"success": True, "carpetas": carpetas}), 200

    except Exception:
        import traceback; traceback.print_exc()
        return jsonify({"error": "Error al obtener carpetas"}), 500
    finally:
        cerrar_db(cursor, conexion)


# ==============================================================================
# 9.5 Asignar / quitar carpeta de una nota (drag & drop y modal agregar notas)
# ==============================================================================

@app.route("/api/notas/<int:nota_id>/carpeta", methods=["PUT"])
@login_required
def api_asignar_carpeta_nota(nota_id):
    """
    Asigna o desasigna una carpeta a una nota del usuario.
    Body JSON:
        carpeta_id — int | null   (null = quitar carpeta)
    """
    user_id    = session["usuario_id"]
    data       = request.get_json(silent=True) or {}
    carpeta_id = data.get("carpeta_id")   # puede ser None para quitar

    conexion = None
    cursor   = None
    try:
        conexion = conectar_db(dict_cursor=True)
        cursor   = conexion.cursor()

        # Verificar que la nota le pertenece al usuario
        cursor.execute(
            'SELECT "ID_Nota" FROM public."Notas" WHERE "ID_Nota"=%s AND "ID_Cuenta"=%s AND "Estado"=\'Activa\'',
            (nota_id, user_id)
        )
        if not cursor.fetchone():
            return jsonify({"success": False, "error": "Nota no encontrada"}), 404

        # Si se pasa carpeta_id, verificar que también pertenece al usuario
        if carpeta_id is not None:
            cursor.execute(
                'SELECT "ID_Carpeta" FROM public."Carpetas" WHERE "ID_Carpeta"=%s AND "ID_Cuenta"=%s',
                (carpeta_id, user_id)
            )
            if not cursor.fetchone():
                return jsonify({"success": False, "error": "Carpeta no encontrada"}), 404

        cursor.execute(
            'UPDATE public."Notas" SET "ID_Carpeta"=%s, "Fecha_deedicion"=%s WHERE "ID_Nota"=%s',
            (carpeta_id, datetime.now(), nota_id)
        )
        conexion.commit()
        return jsonify({"success": True}), 200

    except Exception:
        if conexion: conexion.rollback()
        import traceback; traceback.print_exc()
        return jsonify({"error": "Error al asignar carpeta"}), 500
    finally:
        cerrar_db(cursor, conexion)


@app.route("/api/carpetas", methods=["POST"])
@login_required
def api_crear_carpeta():
    """Crea una nueva carpeta para el usuario."""
    user_id = session["usuario_id"]
    data    = request.get_json(silent=True) or {}
    nombre  = (data.get("nombre") or "").strip()[:60]
    if not nombre:
        return jsonify({"success": False, "error": "El nombre no puede estar vacío"}), 400

    conexion = None
    cursor   = None
    try:
        conexion = conectar_db(dict_cursor=True)
        cursor   = conexion.cursor()

        # Verificar duplicado (solo activas)
        cursor.execute(
            'SELECT 1 FROM public."Carpetas" WHERE "ID_Cuenta"=%s AND LOWER("Nombre_carpeta")=LOWER(%s) AND "Estado"=\'Activa\'',
            (user_id, nombre)
        )
        if cursor.fetchone():
            return jsonify({"success": False, "error": "Ya tienes una carpeta con ese nombre"}), 409

        # Obtener columnas reales de la tabla para insertar correctamente
        cursor.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'Carpetas'
        """)
        columnas = [r["column_name"] for r in cursor.fetchall()]

        ahora = datetime.now()

        # Construir INSERT dinámicamente según columnas disponibles
        cursor.execute('SELECT COALESCE(MAX("ID_Carpeta"), 0) + 1 AS nuevo_id FROM public."Carpetas"')
        nuevo_id = cursor.fetchone()["nuevo_id"]

        cols = ['"ID_Carpeta"', '"ID_Cuenta"', '"Nombre_carpeta"']
        vals = [nuevo_id, user_id, nombre]

        if "Fecha_creacion" in columnas:
            cols.append('"Fecha_creacion"'); vals.append(ahora)
        if "Fecha_edicion" in columnas:
            cols.append('"Fecha_edicion"');  vals.append(ahora)
        if "Estado" in columnas:
            cols.append('"Estado"');          vals.append("Activa")

        placeholders = ", ".join(["%s"] * len(vals))
        sql = f'INSERT INTO public."Carpetas" ({", ".join(cols)}) VALUES ({placeholders}) RETURNING "ID_Carpeta"'

        cursor.execute(sql, vals)
        nuevo_id = cursor.fetchone()["ID_Carpeta"]
        conexion.commit()
        return jsonify({"success": True, "id": nuevo_id, "nombre": nombre}), 201

    except Exception as e:
        if conexion: conexion.rollback()
        import traceback; traceback.print_exc()
        return jsonify({"error": f"Error al crear la carpeta: {str(e)}"}), 500
    finally:
        cerrar_db(cursor, conexion)


@app.route("/api/carpetas/<int:carpeta_id>", methods=["PUT"])
@login_required
def api_editar_carpeta(carpeta_id):
    """Renombra una carpeta del usuario."""
    user_id = session["usuario_id"]
    data    = request.get_json(silent=True) or {}
    nombre  = (data.get("nombre") or "").strip()[:60]
    if not nombre:
        return jsonify({"success": False, "error": "El nombre no puede estar vacío"}), 400

    conexion = None
    cursor   = None
    try:
        conexion = conectar_db(dict_cursor=True)
        cursor   = conexion.cursor()

        cursor.execute(
            'SELECT 1 FROM public."Carpetas" WHERE "ID_Carpeta"=%s AND "ID_Cuenta"=%s',
            (carpeta_id, user_id)
        )
        if not cursor.fetchone():
            return jsonify({"success": False, "error": "Carpeta no encontrada"}), 404

        cursor.execute(
            'UPDATE public."Carpetas" SET "Nombre_carpeta"=%s, "Fecha_edicion"=%s WHERE "ID_Carpeta"=%s',
            (nombre, datetime.now(), carpeta_id)
        )
        conexion.commit()
        return jsonify({"success": True}), 200

    except Exception:
        if conexion: conexion.rollback()
        import traceback; traceback.print_exc()
        return jsonify({"error": "Error al editar la carpeta"}), 500
    finally:
        cerrar_db(cursor, conexion)


@app.route("/api/carpetas/<int:carpeta_id>", methods=["DELETE", "POST"])
@login_required
def api_eliminar_carpeta(carpeta_id):
    """Mueve una carpeta y sus notas a la papelera (eliminación suave)."""
    user_id  = session["usuario_id"]
    conexion = None
    cursor   = None
    try:
        conexion = conectar_db(dict_cursor=True)
        cursor   = conexion.cursor()

        cursor.execute(
            'SELECT 1 FROM public."Carpetas" WHERE "ID_Carpeta"=%s AND "ID_Cuenta"=%s',
            (carpeta_id, user_id)
        )
        if not cursor.fetchone():
            return jsonify({"success": False, "error": "Carpeta no encontrada"}), 404

        ahora = datetime.now()
        # Mover carpeta a papelera
        cursor.execute(
            'UPDATE public."Carpetas" SET "Estado"=\'Papelera\', "Fecha_edicion"=%s WHERE "ID_Carpeta"=%s',
            (ahora, carpeta_id)
        )
        # Mover todas las notas de esa carpeta a papelera
        cursor.execute(
            'UPDATE public."Notas" SET "Estado"=\'Papelera\', "Fecha_deedicion"=%s WHERE "ID_Carpeta"=%s AND "ID_Cuenta"=%s',
            (ahora, carpeta_id, user_id)
        )
        
        conexion.commit()
        return jsonify({"success": True, "mensaje": "Carpeta y sus notas movidas a la papelera"}), 200

    except Exception:
        if conexion: conexion.rollback()
        import traceback; traceback.print_exc()
        return jsonify({"error": "Error al eliminar la carpeta"}), 500
    finally:
        cerrar_db(cursor, conexion)


# ==============================================================================
# 10. PAPELERA
#     Incluye: vista principal, restaurar, eliminar y vaciar.
# ==============================================================================

@app.route("/papelera")
@login_required
def papelera():
    """
    Muestra las notas en estado papelera del usuario.
    Elimina automáticamente las que llevan más de 30 días,
    incluyendo sus archivos físicos y registros relacionados.
    """
    user_id  = session["usuario_id"]
    conexion = None
    cursor   = None
    try:
        conexion = conectar_db(dict_cursor=True)
        if conexion is None:
            return "Error de conexión a la base de datos", 500
        cursor = conexion.cursor()

        cursor.execute("""
            SELECT "Nombres", "Foto", "Color_principal", "Es_premium", "Plan_premium", "Es_admin"
            FROM public."Cuentas" WHERE "ID_Cuenta" = %s
        """, (user_id,))
        usuario = cursor.fetchone()
        if not usuario:
            session.clear()
            return redirect(url_for("mostrar_login"))

        # Limpieza automática de notas con más de 30 días en papelera
        cursor.execute("""
            SELECT n."ID_Nota", a."Ruta_archivo"
            FROM public."Notas" n
            LEFT JOIN public."Adjuntos" a ON n."ID_Nota" = a."ID_Nota"
            WHERE n."ID_Cuenta" = %s
              AND LOWER(n."Estado") = 'papelera'
              AND n."Fecha_deedicion" <= (CURRENT_TIMESTAMP - INTERVAL '30 days')
        """, (user_id,))
        notas_vencidas = cursor.fetchall()

        if notas_vencidas:
            ids_vencidos = list({
                fila.get("ID_Nota") if isinstance(fila, dict) else fila[0]
                for fila in notas_vencidas
            })
            # 1. Limpieza de notas antiguas
            cursor.execute('DELETE FROM public."Adjuntos"        WHERE "ID_Nota" = ANY(%s)', (ids_vencidos,))
            cursor.execute('DELETE FROM public."Notas_etiquetas" WHERE "ID_Nota" = ANY(%s)', (ids_vencidos,))
            cursor.execute("""
                DELETE FROM public."Notas"
                WHERE "ID_Cuenta" = %s AND LOWER("Estado") = 'papelera'
                  AND "Fecha_deedicion" <= (CURRENT_TIMESTAMP - INTERVAL '30 days')
            """, (user_id,))
            conexion.commit()

        # 2. Limpieza de carpetas antiguas
        cursor.execute("""
            DELETE FROM public."Carpetas"
            WHERE "ID_Cuenta" = %s AND LOWER("Estado") = 'papelera'
              AND "Fecha_edicion" <= (CURRENT_TIMESTAMP - INTERVAL '30 days')
        """, (user_id,))
        conexion.commit()

        # Obtener carpetas en papelera
        cursor.execute("""
            SELECT "ID_Carpeta", "Nombre_carpeta", "Fecha_edicion", "Fecha_creacion"
            FROM public."Carpetas"
            WHERE "ID_Cuenta" = %s AND LOWER("Estado") = 'papelera'
            ORDER BY "Fecha_edicion" DESC NULLS LAST
        """, (user_id,))
        carpetas_papelera = cursor.fetchall()

        cursor.execute("""
            SELECT n."ID_Nota", n."Titulo", n."Descripcion",
                   n."Fecha_deedicion", n."Fecha_decreacion", n."Formato",
                   c."Nombre_carpeta"
            FROM public."Notas" n
            LEFT JOIN public."Carpetas" c ON c."ID_Carpeta" = n."ID_Carpeta"
            WHERE n."ID_Cuenta" = %s AND LOWER(n."Estado") = 'papelera'
            ORDER BY n."Fecha_deedicion" DESC NULLS LAST
        """, (user_id,))
        notas_papelera = cursor.fetchall()

        return render_template(
            "papelera.html",
            notas_papelera=notas_papelera,
            carpetas_papelera=carpetas_papelera,
            usuario=usuario,
            now=datetime.now(),
            timedelta=timedelta,
        )

    except Exception as e:
        import traceback; traceback.print_exc()
        return f"Error al cargar la papelera: {str(e)}", 500

    finally:
        cerrar_db(cursor, conexion)


@app.route("/papelera/restaurar-carpeta/<int:carpeta_id>", methods=["POST"])
@login_required
def restaurar_carpeta(carpeta_id):
    """Restaura una carpeta y sus notas de la papelera."""
    user_id  = session["usuario_id"]
    conexion = None
    cursor   = None
    try:
        conexion = conectar_db()
        cursor = conexion.cursor()

        # Verificar que la carpeta pertenece al usuario y está en papelera
        cursor.execute("""
            SELECT "ID_Carpeta" FROM public."Carpetas"
            WHERE "ID_Carpeta" = %s AND "ID_Cuenta" = %s AND LOWER("Estado") = 'papelera'
        """, (carpeta_id, user_id))
        if not cursor.fetchone():
            return jsonify({"error": "Carpeta no encontrada"}), 404

        ahora = datetime.now()
        # Restaurar carpeta
        cursor.execute('UPDATE public."Carpetas" SET "Estado" = \'Activa\', "Fecha_edicion" = %s WHERE "ID_Carpeta" = %s', (ahora, carpeta_id))
        
        # Restaurar notas que pertenezcan a esa carpeta y estén en papelera
        cursor.execute('UPDATE public."Notas" SET "Estado" = \'Activa\', "Fecha_deedicion" = %s WHERE "ID_Carpeta" = %s AND "Estado" = \'Papelera\'', (ahora, carpeta_id))

        conexion.commit()
        return jsonify({"success": True, "mensaje": "Carpeta restaurada correctamente"}), 200

    except Exception as e:
        if conexion: conexion.rollback()
        return jsonify({"error": "Error al restaurar carpeta"}), 500
    finally:
        cerrar_db(cursor, conexion)


@app.route("/papelera/restaurar/<int:nota_id>", methods=["POST"])
@login_required
def restaurar_nota(nota_id):
    """Cambia el estado de la nota de papelera a Activa."""
    user_id  = session["usuario_id"]
    conexion = None
    cursor   = None
    try:
        conexion = conectar_db()
        if conexion is None:
            return jsonify({"error": "Error de conexión a la base de datos"}), 500
        cursor = conexion.cursor()

        cursor.execute("""
            SELECT "ID_Nota" FROM public."Notas"
            WHERE "ID_Nota" = %s AND "ID_Cuenta" = %s AND LOWER("Estado") = 'papelera'
        """, (nota_id, user_id))
        if not cursor.fetchone():
            return jsonify({"error": "Nota no encontrada o sin permiso para restaurarla"}), 404

        cursor.execute("""
            UPDATE public."Notas"
            SET "Estado" = 'Activa', "Fecha_deedicion" = CURRENT_TIMESTAMP
            WHERE "ID_Nota" = %s AND "ID_Cuenta" = %s
        """, (nota_id, user_id))
        conexion.commit()

        return jsonify({"success": True, "mensaje": "Nota restaurada correctamente"}), 200

    except Exception as e:
        if conexion:
            conexion.rollback()
        print(f"Error al restaurar nota {nota_id}: {e}")
        return jsonify({"error": "Error al restaurar la nota"}), 500

    finally:
        cerrar_db(cursor, conexion)


@app.route("/papelera/eliminar-carpeta/<int:carpeta_id>", methods=["POST"])
@login_required
def eliminar_carpeta_definitivo(carpeta_id):
    """Elimina permanentemente una carpeta y todas sus notas."""
    user_id  = session["usuario_id"]
    conexion = None
    cursor   = None
    try:
        conexion = conectar_db(dict_cursor=True)
        cursor = conexion.cursor()

        # Verificar carpeta
        cursor.execute('SELECT "ID_Carpeta" FROM public."Carpetas" WHERE "ID_Carpeta"=%s AND "ID_Cuenta"=%s AND "Estado"=\'Papelera\'', (carpeta_id, user_id))
        if not cursor.fetchone():
            return jsonify({"error": "Carpeta no encontrada"}), 404

        # Obtener IDs de notas en la carpeta
        cursor.execute('SELECT "ID_Nota" FROM public."Notas" WHERE "ID_Carpeta"=%s', (carpeta_id,))
        notas = cursor.fetchall()
        ids_notas = [n["ID_Nota"] for n in notas]

        if ids_notas:
            # Obtener rutas de archivos para borrar de Supabase
            cursor.execute('SELECT "Ruta_archivo" FROM public."Adjuntos" WHERE "ID_Nota" = ANY(%s)', (ids_notas,))
            rutas = [f["Ruta_archivo"] for f in cursor.fetchall()]
            
            if rutas:
                try:
                    paths_to_remove = []
                    for r in rutas:
                        if "/public/NoteFlow/" in r:
                            paths_to_remove.append(r.split("/public/NoteFlow/")[1])
                    
                    if paths_to_remove:
                        supabase_client.storage.from_("NoteFlow").remove(paths_to_remove)
                        print(f"Archivos de la carpeta {carpeta_id} eliminados de Storage: {paths_to_remove}")
                except Exception as st_err:
                    print(f"Error borrando de Storage (carpeta {carpeta_id}): {st_err}")

            # Eliminar adjuntos, etiquetas y notas
            cursor.execute('DELETE FROM public."Adjuntos" WHERE "ID_Nota" = ANY(%s)', (ids_notas,))
            cursor.execute('DELETE FROM public."Notas_etiquetas" WHERE "ID_Nota" = ANY(%s)', (ids_notas,))
            cursor.execute('DELETE FROM public."Notas" WHERE "ID_Nota" = ANY(%s)', (ids_notas,))

        # Eliminar carpeta
        cursor.execute('DELETE FROM public."Carpetas" WHERE "ID_Carpeta"=%s', (carpeta_id,))
        
        conexion.commit()
        return jsonify({"success": True, "mensaje": "Carpeta y sus notas eliminadas permanentemente"}), 200

    except Exception as e:
        if conexion: conexion.rollback()
        return jsonify({"error": "Error al eliminar carpeta"}), 500
    finally:
        cerrar_db(cursor, conexion)


@app.route("/papelera/eliminar/<int:nota_id>", methods=["POST"])
@login_required
def eliminar_nota_definitivo(nota_id):
    """
    Elimina permanentemente una nota que está en la papelera:
    borra los archivos físicos, los registros de adjuntos y etiquetas, y la nota.
    Solo el propietario puede ejecutar esta acción.
    """
    user_id  = session["usuario_id"]
    conexion = None
    cursor   = None
    try:
        conexion = conectar_db(dict_cursor=True)
        if conexion is None:
            return jsonify({"error": "Error de conexión a la base de datos"}), 500
        cursor = conexion.cursor()

        cursor.execute("""
            SELECT "ID_Nota" FROM public."Notas"
            WHERE "ID_Nota" = %s AND "ID_Cuenta" = %s AND LOWER("Estado") = 'papelera'
        """, (nota_id, user_id))
        if not cursor.fetchone():
            return jsonify({"error": "Nota no encontrada o sin permiso para eliminarla"}), 404

        # 1. Obtener rutas de archivos adjuntos para borrar de Storage
        cursor.execute('SELECT "Ruta_archivo" FROM public."Adjuntos" WHERE "ID_Nota" = %s', (nota_id,))
        rutas = [f["Ruta_archivo"] for f in cursor.fetchall()]
        
        if rutas:
            try:
                paths_to_remove = []
                for r in rutas:
                    if "/public/NoteFlow/" in r:
                        paths_to_remove.append(r.split("/public/NoteFlow/")[1])
                
                if paths_to_remove:
                    supabase_client.storage.from_("NoteFlow").remove(paths_to_remove)
                    print(f"Archivos eliminados de Storage para nota {nota_id}: {paths_to_remove}")
            except Exception as st_err:
                print(f"Error borrando de Storage (nota {nota_id}): {st_err}")

        # 2. Borrar de la base de datos
        cursor.execute('DELETE FROM public."Adjuntos"        WHERE "ID_Nota" = %s', (nota_id,))
        cursor.execute('DELETE FROM public."Notas_etiquetas" WHERE "ID_Nota" = %s', (nota_id,))
        cursor.execute('DELETE FROM public."Notas" WHERE "ID_Nota" = %s AND "ID_Cuenta" = %s', (nota_id, user_id))
        conexion.commit()

        return jsonify({"success": True, "mensaje": "Nota y archivos eliminados definitivamente"}), 200

    except Exception as e:
        if conexion:
            conexion.rollback()
        print(f"Error al eliminar nota {nota_id}: {e}")
        return jsonify({"error": "Error al eliminar la nota"}), 500

    finally:
        cerrar_db(cursor, conexion)


@app.route("/papelera/vaciar", methods=["POST"])
@login_required
def vaciar_papelera():
    """Elimina permanentemente TODAS las notas y carpetas en papelera del usuario."""
    user_id  = session["usuario_id"]
    conexion = None
    cursor   = None
    try:
        conexion = conectar_db(dict_cursor=True)
        if conexion is None:
            return jsonify({"error": "Error de conexión a la base de datos"}), 500
        cursor = conexion.cursor()

        # 1. Obtener todas las notas en papelera
        cursor.execute('SELECT "ID_Nota" FROM public."Notas" WHERE "ID_Cuenta" = %s AND LOWER("Estado") = \'papelera\'', (user_id,))
        ids_notas = [f["ID_Nota"] for f in cursor.fetchall()]

        # 2. Eliminar adjuntos y archivos físicos de esas notas
        if ids_notas:
            # Obtener rutas de archivos para borrar de Supabase
            cursor.execute('SELECT "Ruta_archivo" FROM public."Adjuntos" WHERE "ID_Nota" = ANY(%s)', (ids_notas,))
            rutas = [f["Ruta_archivo"] for f in cursor.fetchall()]
            
            if rutas:
                try:
                    # Extraer solo la parte del path relativa al bucket
                    # Las rutas son: https://.../storage/v1/object/public/NoteFlow/audios/filename
                    # Necesitamos: audios/filename
                    paths_to_remove = []
                    for r in rutas:
                        if "/public/NoteFlow/" in r:
                            paths_to_remove.append(r.split("/public/NoteFlow/")[1])
                    
                    if paths_to_remove:
                        supabase_client.storage.from_("NoteFlow").remove(paths_to_remove)
                except Exception as st_err:
                    print(f"Error borrando de Storage: {st_err}")

            cursor.execute('DELETE FROM public."Adjuntos"        WHERE "ID_Nota" = ANY(%s)', (ids_notas,))
            cursor.execute('DELETE FROM public."Notas_etiquetas" WHERE "ID_Nota" = ANY(%s)', (ids_notas,))
            cursor.execute('DELETE FROM public."Notas"           WHERE "ID_Nota" = ANY(%s)', (ids_notas,))

        # 3. Eliminar carpetas en papelera
        cursor.execute('DELETE FROM public."Carpetas" WHERE "ID_Cuenta" = %s AND LOWER("Estado") = \'papelera\'', (user_id,))

        conexion.commit()
        return jsonify({"success": True, "mensaje": "Papelera vaciada correctamente"}), 200

    except Exception as e:
        if conexion:
            conexion.rollback()
        print(f"Error al vaciar papelera del usuario {user_id}: {e}")
        return jsonify({"error": "Error al vaciar la papelera"}), 500

    finally:
        cerrar_db(cursor, conexion)
# ==============================================================================
# 11. CREAR Y EDITAR NOTAS — Vistas de los editores
# ==============================================================================

@app.route("/crear-nota")
@login_required
def crear_nota():
    """Página genérica de creación de nota (en desarrollo)."""
    return render_template("fasededesarrollo.html")


@app.route("/editar-nota/<int:nota_id>")
@login_required
def editar_nota(nota_id):
    """
    Ruta central para cargar el editor correspondiente a una nota existente.
    Redirige segÃºn el formato de la nota (texto, imagen, audio, video, mixta, dibujo).
    """
    user_id  = session["usuario_id"]
    conexion = None
    cursor   = None
    try:
        conexion = conectar_db(dict_cursor=True)
        cursor   = conexion.cursor()
        cursor.execute("""
            SELECT "ID_Nota", "Titulo", "Descripcion", "Contenido", "Formato", "ID_Carpeta"
            FROM public."Notas"
            WHERE "ID_Nota" = %s AND "ID_Cuenta" = %s AND "Estado" = 'Activa'
        """, (nota_id, user_id))
        nota = cursor.fetchone()

        if not nota:
            return "La nota no existe o no tienes permiso para editarla.", 404

        # Obtener adjuntos si hay (para imagen, audio, video, mixta)
        cursor.execute('SELECT * FROM public."Adjuntos" WHERE "ID_Nota" = %s', (nota_id,))
        adjuntos = cursor.fetchall()
        
        # Obtener etiquetas
        etiquetas = obtener_etiquetas_nota(nota_id, cursor)
        etiquetas_str = ", ".join([e["Nombre_etiqueta"] for e in etiquetas])

        formato = (nota["Formato"] or "texto").lower().strip()
        
        templates = {
            "texto":  "editortexto.html",
            "imagen": "editorimagen.html",
            "audio":  "editoraudio.html",
            "video":  "editorvideo.html",
            "dibujo": "dibujo.html",
            "mixta":  "editormixta.html"
        }
        
        template = templates.get(formato, "editortexto.html")
        return render_template(template, nota=nota, adjuntos=adjuntos, etiquetas=etiquetas_str, edit_mode=True)

    except Exception as e:
        import traceback; traceback.print_exc()
        return f"Error al abrir el editor: {str(e)}", 500
    finally:
        cerrar_db(cursor, conexion)


@app.route("/crear-nota-texto")
@login_required
def crear_nota_texto():
    """Editor de notas de texto enriquecido."""
    return render_template("editortexto.html", edit_mode=False)


@app.route("/crear-nota-imagen")
@login_required
def crear_nota_imagen():
    """Editor de notas de imagen. Solo disponible para usuarios Premium."""
    if not session.get("es_premium"):
        return redirect(url_for("planes"))
    return render_template("editorimagen.html", edit_mode=False)


@app.route("/bloc-dibujo")
@login_required
def bloc_dibujo():
    """Bloc de dibujo libre."""
    return render_template("dibujo.html", edit_mode=False)


@app.route("/crear-nota-audio")
@login_required
def crear_nota_audio():
    """Editor de notas de audio. Solo disponible para usuarios Premium."""
    if not session.get("es_premium"):
        return redirect(url_for("planes"))
    return render_template("editoraudio.html", edit_mode=False)


@app.route("/crear-nota-video")
@login_required
def crear_nota_video():
    """Editor de notas de video. Solo disponible para usuarios Premium."""
    if not session.get("es_premium"):
        return redirect(url_for("planes"))
    return render_template("editorvideo.html", edit_mode=False)


@app.route("/crear-nota-mixta")
@login_required
def crear_nota_mixta():
    """Editor de notas mixtas. Solo disponible para usuarios Premium."""
    if not session.get("es_premium"):
        return redirect(url_for("planes"))
    return render_template("editormixta.html", edit_mode=False)



# ==============================================================================
# 12. GUARDAR NOTA DE TEXTO
#     El contenido HTML del editor se almacena directamente en la base de datos.
#     No genera archivo físico.
# ==============================================================================

@app.route("/guardar-nota-texto", methods=["POST"])
@login_required
def guardar_nota_texto():
    """
    Recibe el HTML del editor de texto y crea una nota de tipo texto en la BD.

    Campos:
        titulo       — str (obligatorio)
        descripcion  — str (opcional)
        contenido    — str HTML (obligatorio)
        etiquetas    — str separadas por coma (opcional)
    """
    user_id  = session["usuario_id"]
    conexion = None
    cursor   = None
    try:
        titulo        = bleach.clean(request.form.get("titulo", "").strip() or "Nota sin título", tags=[], strip=True)
        descripcion   = request.form.get("descripcion", "").strip() or f"Nota de texto: {titulo}"
        contenido     = sanitizar_html(request.form.get("contenido",   "").strip())
        etiquetas_raw = request.form.get("etiquetas",   "").strip()

        if not contenido:
            return jsonify({"error": "El contenido de la nota está vacío"}), 400

        # Sanitizar el contenido HTML de la nota para prevenir XSS
        contenido = sanitizar_html(contenido)
        titulo = bleach.clean(titulo, tags=[], strip=True) # Título siempre texto plano

        conexion = conectar_db()
        if conexion is None:
            return jsonify({"error": "Error de conexión a la base de datos"}), 500

        cursor = conexion.cursor()
        hoy    = datetime.now()

        # Garantizar que el formato existe en Tipos (FK requerida)
        cursor.execute("""
            INSERT INTO public."Tipos" ("Formato") VALUES ('texto') ON CONFLICT ("Formato") DO NOTHING
        """)

        nuevo_id = _next_id(cursor, "Notas", "ID_Nota")
        cursor.execute("""
            INSERT INTO public."Notas"
                ("ID_Nota", "Titulo", "Descripcion", "Contenido",
                 "Fecha_decreacion", "Fecha_deedicion", "Estado", "Formato", "ID_Cuenta", "ID_Carpeta")
            VALUES (%s, %s, %s, %s, %s, %s, 'Activa', 'texto', %s, NULL)
        """, (nuevo_id, titulo, descripcion, contenido, hoy, hoy, user_id))
        nota_id = nuevo_id

        if etiquetas_raw:
            _insertar_etiquetas(etiquetas_raw, nota_id, cursor)

        conexion.commit()
        return jsonify({"success": True, "mensaje": "Nota de texto guardada correctamente", "nota_id": nota_id, "redirect": "/notas"}), 201

    except Exception as e:
        if conexion:
            conexion.rollback()
        import traceback; traceback.print_exc()
        return jsonify({"error": "Error al guardar la nota de texto"}), 500

    finally:
        cerrar_db(cursor, conexion)


@app.route("/actualizar-nota-texto/<int:nota_id>", methods=["POST"])
@login_required
def actualizar_nota_texto(nota_id):
    """
    Actualiza el contenido y metadatos de una nota de texto existente.
    """
    user_id  = session["usuario_id"]
    conexion = None
    cursor   = None
    try:
        titulo        = bleach.clean(request.form.get("titulo", "").strip(), tags=[], strip=True)
        descripcion   = request.form.get("descripcion", "").strip()
        contenido     = sanitizar_html(request.form.get("contenido", "").strip())
        etiquetas     = request.form.get("etiquetas",   "").strip()

        if not titulo or not contenido:
            return jsonify({"error": "El título y contenido son obligatorios"}), 400

        # Sanitización centralizada
        contenido = sanitizar_html(contenido)
        titulo = bleach.clean(titulo, tags=[], strip=True)

        conexion = conectar_db()
        cursor = conexion.cursor()

        # Verificar propiedad
        cursor.execute('SELECT "ID_Nota" FROM public."Notas" WHERE "ID_Nota" = %s AND "ID_Cuenta" = %s', (nota_id, user_id))
        if not cursor.fetchone():
            return jsonify({"error": "No tienes permiso para editar esta nota"}), 403

        # Actualizar base
        cursor.execute("""
            UPDATE public."Notas"
            SET "Titulo" = %s, "Descripcion" = %s, "Contenido" = %s, "Fecha_deedicion" = %s
            WHERE "ID_Nota" = %s
        """, (titulo, descripcion, contenido, datetime.now(), nota_id))

        # Actualizar etiquetas (borrar y re-insertar para simplicidad)
        cursor.execute('DELETE FROM public."Notas_etiquetas" WHERE "ID_Nota" = %s', (nota_id,))
        if etiquetas:
            _insertar_etiquetas(etiquetas, nota_id, cursor)

        conexion.commit()
        return jsonify({"success": True, "mensaje": "Nota actualizada correctamente", "redirect": "/notas"}), 200

    except Exception as e:
        if conexion: conexion.rollback()
        import traceback; traceback.print_exc()
        return jsonify({"error": f"Error al actualizar: {str(e)}"}), 500
    finally:
        cerrar_db(cursor, conexion)



# ==============================================================================
# 13. GUARDAR NOTA DE IMAGEN
#     Guarda el archivo PNG/JPG procesado por el editor de canvas.
# ==============================================================================

@app.route("/guardar-nota-audio", methods=["POST"])
@login_required
def guardar_nota_audio():
    """Recibe un archivo de audio y lo guarda en Supabase."""
    user_id  = session["usuario_id"]
    conexion = None
    cursor   = None
    try:
        titulo      = request.form.get("titulo", "").strip() or "Audio sin título"
        descripcion = request.form.get("descripcion", "").strip() or "Nota de audio"
        archivo     = request.files.get("audio")
        etiquetas   = request.form.get("etiquetas", "").strip()

        if not archivo:
            return jsonify({"error": "No se recibió el audio"}), 400

        ext = os.path.splitext(archivo.filename)[1].lower()
        filename = f"aud_{user_id}_{_uuid.uuid4().hex}{ext}"
        
        # SUBIR A SUPABASE
        url_publica = subir_a_supabase(archivo, "audios", filename)
        if not url_publica:
            return jsonify({"error": "Error al subir a Supabase"}), 500

        conexion = conectar_db()
        cursor = conexion.cursor()
        hoy = datetime.now()

        nuevo_id = _next_id(cursor, "Notas", "ID_Nota")
        cursor.execute("""
            INSERT INTO public."Notas"
                ("ID_Nota", "Titulo", "Descripcion", "Contenido",
                 "Fecha_decreacion", "Fecha_deedicion", "Estado", "Formato", "ID_Cuenta")
            VALUES (%s, %s, %s, '', %s, %s, 'Activa', 'audio', %s)
        """, (nuevo_id, titulo, descripcion, hoy, hoy, user_id))

        cursor.execute("""
            INSERT INTO public."Adjuntos" ("ID_Nota", "Nombre_archivo", "Ruta_archivo", "Formato")
            VALUES (%s, %s, %s, 'audio')
        """, (nuevo_id, filename, url_publica))

        if etiquetas:
            _insertar_etiquetas(etiquetas, nuevo_id, cursor)

        conexion.commit()
        return jsonify({"success": True, "mensaje": "Audio guardado en la nube", "redirect": "/notas"}), 201

    except Exception as e:
        if conexion: conexion.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cerrar_db(cursor, conexion)

@app.route("/guardar-nota-imagen", methods=["POST"])
@login_required
def guardar_nota_imagen():
    """Recibe la imagen editada y la guarda en Supabase."""
    user_id  = session["usuario_id"]
    conexion = None
    cursor   = None
    try:
        titulo      = request.form.get("titulo", "").strip() or "Imagen sin título"
        descripcion = request.form.get("descripcion", "").strip() or "Nota de imagen"
        archivo     = request.files.get("imagen")
        etiquetas   = request.form.get("etiquetas", "").strip()

        if not archivo:
            return jsonify({"error": "No se recibió la imagen"}), 400

        ext = os.path.splitext(archivo.filename)[1].lower()
        filename = f"img_{user_id}_{_uuid.uuid4().hex}{ext}"
        
        # SUBIR A SUPABASE
        url_publica = subir_a_supabase(archivo, "imagenes", filename)
        if not url_publica:
            return jsonify({"error": "Error al subir a la nube"}), 500

        conexion = conectar_db()
        cursor = conexion.cursor()
        hoy = datetime.now()

        nuevo_id = _next_id(cursor, "Notas", "ID_Nota")
        cursor.execute("""
            INSERT INTO public."Notas"
                ("ID_Nota", "Titulo", "Descripcion", "Contenido",
                 "Fecha_decreacion", "Fecha_deedicion", "Estado", "Formato", "ID_Cuenta")
            VALUES (%s, %s, %s, '', %s, %s, 'Activa', 'imagen', %s)
        """, (nuevo_id, titulo, descripcion, hoy, hoy, user_id))

        cursor.execute("""
            INSERT INTO public."Adjuntos" ("ID_Nota", "Nombre_archivo", "Ruta_archivo", "Formato")
            VALUES (%s, %s, %s, 'imagen')
        """, (nuevo_id, filename, url_publica))

        if etiquetas:
            _insertar_etiquetas(etiquetas, nuevo_id, cursor)

        conexion.commit()
        return jsonify({"success": True, "mensaje": "Imagen guardada en Supabase", "redirect": "/notas"}), 201

    except Exception as e:
        if conexion: conexion.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cerrar_db(cursor, conexion)


@app.route("/actualizar-nota-imagen/<int:nota_id>", methods=["POST"])
@login_required
def actualizar_nota_imagen(nota_id):
    """Actualiza una nota de imagen existente."""
    user_id  = session["usuario_id"]
    conexion = None
    cursor   = None
    try:
        titulo        = request.form.get("titulo",      "").strip()
        descripcion   = request.form.get("descripcion", "").strip()
        etiquetas_raw = request.form.get("etiquetas",   "").strip()
        archivo       = request.files.get("imagen")

        conexion = conectar_db()
        cursor = conexion.cursor()

        # Verificar propiedad
        cursor.execute('SELECT "ID_Nota" FROM public."Notas" WHERE "ID_Nota" = %s AND "ID_Cuenta" = %s', (nota_id, user_id))
        if not cursor.fetchone():
            return jsonify({"error": "No tienes permiso para editar esta nota"}), 403

        # Actualizar base de datos (Metadatos)
        cursor.execute("""
            UPDATE public."Notas"
            SET "Titulo" = %s, "Descripcion" = %s, "Fecha_deedicion" = %s
            WHERE "ID_Nota" = %s
        """, (titulo, descripcion, datetime.now(), nota_id))

        # Si se sube una nueva
        if archivo and archivo.filename != "":
            ext = os.path.splitext(archivo.filename)[1].lower()
            if ext in {".png", ".jpg", ".jpeg", ".webp"}:
                # Obtener la ruta del archivo anterior
                cursor.execute('SELECT "Ruta_archivo" FROM public."Adjuntos" WHERE "ID_Nota" = %s', (nota_id,))
                fila_adjunto = cursor.fetchone()
                old_path = fila_adjunto[0] if (fila_adjunto and fila_adjunto[0]) else None

                # SUBIR A SUPABASE
                filename = f"img_rev_{user_id}_{_uuid.uuid4().hex}{ext}"
                url_publica = subir_a_supabase(archivo, "imagenes", filename)
                
                if url_publica:
                    cursor.execute("""
                        UPDATE public."Adjuntos" 
                        SET "Nombre_archivo" = %s, "Formato" = %s, "Ruta_archivo" = %s
                        WHERE "ID_Nota" = %s
                    """, (filename, ext.lstrip("."), url_publica, nota_id))
                    
                    if old_path:
                        eliminar_archivo_de_supabase_por_ruta(old_path)

        # Etiquetas
        cursor.execute('DELETE FROM public."Notas_etiquetas" WHERE "ID_Nota" = %s', (nota_id,))
        if etiquetas_raw:
            _insertar_etiquetas(etiquetas_raw, nota_id, cursor)

        conexion.commit()
        return jsonify({"success": True, "mensaje": "Imagen actualizada correctamente", "redirect": "/notas"}), 200

    except Exception as e:
        if conexion: conexion.rollback()
        import traceback; traceback.print_exc()
        return jsonify({"error": f"Error al actualizar imagen: {str(e)}"}), 500
    finally:
        cerrar_db(cursor, conexion)




@app.route("/guardar-nota-dibujo", methods=["POST"])
@login_required
def guardar_nota_dibujo():
    """Recibe la imagen base64 o blob del canvas y crea la nota de dibujo."""
    user_id  = session["usuario_id"]
    conexion = None
    cursor   = None
    try:
        titulo        = request.form.get("titulo",      "").strip() or "Dibujo sin título"
        descripcion   = request.form.get("descripcion", "").strip() or f"Nota de dibujo: {titulo}"
        etiquetas_raw = request.form.get("etiquetas",   "").strip()
        archivo       = request.files.get("imagen")

        if not archivo or archivo.filename == "":
            return jsonify({"error": "No se recibió ninguna imagen de dibujo"}), 400

        # Subir a Supabase
        filename    = f"dibujo_{user_id}_{_uuid.uuid4().hex}.png"
        url_publica = subir_a_supabase(archivo, "dibujos", filename)

        if not url_publica:
            return jsonify({"error": "Error al subir el dibujo a Supabase"}), 500

        conexion = conectar_db()
        cursor   = conexion.cursor()
        hoy      = datetime.now()

        cursor.execute('INSERT INTO public."Tipos" ("Formato") VALUES (%s) ON CONFLICT DO NOTHING', ("png",))

        nuevo_id = _next_id(cursor, "Notas", "ID_Nota")
        cursor.execute("""
            INSERT INTO public."Notas"
                ("ID_Nota", "Titulo", "Descripcion", "Contenido", "Fecha_decreacion", "Fecha_deedicion", "Estado", "Formato", "ID_Cuenta")
            VALUES (%s, %s, %s, '', %s, %s, 'Activa', 'dibujo', %s)
        """, (nuevo_id, titulo, descripcion, hoy, hoy, user_id))

        nuevo_id_adj = _next_id(cursor, "Adjuntos", "ID_Adjunto")
        cursor.execute("""
            INSERT INTO public."Adjuntos" ("ID_Adjunto", "Nombre_archivo", "Formato", "Ruta_archivo", "ID_Nota")
            VALUES (%s, %s, 'png', %s, %s)
        """, (nuevo_id_adj, filename, url_publica, nuevo_id))

        if etiquetas_raw:
            _insertar_etiquetas(etiquetas_raw, nuevo_id, cursor)

        conexion.commit()
        return jsonify({"success": True, "mensaje": "Dibujo guardado correctamente", "redirect": "/notas"}), 201

    except Exception as e:
        if conexion: conexion.rollback()
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        cerrar_db(cursor, conexion)

@app.route("/actualizar-nota-dibujo/<int:nota_id>", methods=["POST"])
@login_required
def actualizar_nota_dibujo(nota_id):
    """Actualiza una nota de dibujo existente."""
    user_id  = session["usuario_id"]
    conexion = None
    cursor   = None
    try:
        titulo        = request.form.get("titulo",      "").strip()
        descripcion   = request.form.get("descripcion", "").strip()
        etiquetas_raw = request.form.get("etiquetas",   "").strip()
        archivo       = request.files.get("imagen")

        conexion = conectar_db()
        cursor = conexion.cursor()

        # Verificar propiedad
        cursor.execute('SELECT "ID_Nota" FROM public."Notas" WHERE "ID_Nota" = %s AND "ID_Cuenta" = %s', (nota_id, user_id))
        if not cursor.fetchone():
            return jsonify({"error": "No tienes permiso para editar esta nota"}), 403

        # Actualizar base de datos (Metadatos)
        cursor.execute("""
            UPDATE public."Notas"
            SET "Titulo" = %s, "Descripcion" = %s, "Fecha_deedicion" = %s
            WHERE "ID_Nota" = %s
        """, (titulo, descripcion, datetime.now(), nota_id))

        # Si se sube un nuevo dibujo
        if archivo and archivo.filename != "":
            ext = os.path.splitext(archivo.filename)[1].lower()
            if ext in {".png", ".jpg", ".jpeg", ".webp"}:
                # Obtener la ruta del archivo anterior
                cursor.execute('SELECT "Ruta_archivo" FROM public."Adjuntos" WHERE "ID_Nota" = %s', (nota_id,))
                fila_adjunto = cursor.fetchone()
                old_path = fila_adjunto[0] if (fila_adjunto and fila_adjunto[0]) else None

                # SUBIR A SUPABASE
                filename = f"dib_rev_{user_id}_{_uuid.uuid4().hex}{ext}"
                url_publica = subir_a_supabase(archivo, "dibujos", filename)
                
                if url_publica:
                    cursor.execute("""
                        UPDATE public."Adjuntos" 
                        SET "Nombre_archivo" = %s, "Formato" = %s, "Ruta_archivo" = %s
                        WHERE "ID_Nota" = %s
                    """, (filename, ext.lstrip("."), url_publica, nota_id))
                    
                    if old_path:
                        eliminar_archivo_de_supabase_por_ruta(old_path)

        # Actualizar etiquetas
        cursor.execute('DELETE FROM public."Notas_etiquetas" WHERE "ID_Nota" = %s', (nota_id,))
        if etiquetas_raw:
            _insertar_etiquetas(etiquetas_raw, nota_id, cursor)

        conexion.commit()
        return jsonify({"success": True, "mensaje": "Dibujo actualizado correctamente", "redirect": "/notas"}), 200

    finally:
        cerrar_db(cursor, conexion)








@app.route("/actualizar-nota-audio/<int:nota_id>", methods=["POST"])
@login_required
def actualizar_nota_audio(nota_id):
    """Actualiza una nota de audio existente."""
    user_id  = session["usuario_id"]
    conexion = None
    cursor   = None
    try:
        titulo        = request.form.get("titulo",      "").strip()
        descripcion   = request.form.get("descripcion", "").strip()
        etiquetas_raw = request.form.get("etiquetas",   "").strip()
        archivo       = request.files.get("audio")

        conexion = conectar_db()
        cursor = conexion.cursor()

        cursor.execute('SELECT "ID_Nota" FROM public."Notas" WHERE "ID_Nota" = %s AND "ID_Cuenta" = %s', (nota_id, user_id))
        if not cursor.fetchone():
            return jsonify({"error": "No tienes permiso"}), 403

        cursor.execute("""
            UPDATE public."Notas"
            SET "Titulo" = %s, "Descripcion" = %s, "Fecha_deedicion" = %s
            WHERE "ID_Nota" = %s
        """, (titulo, descripcion, datetime.now(), nota_id))

        if archivo and archivo.filename != "":
            ext = os.path.splitext(archivo.filename)[1].lower()
            if ext in AUDIO_EXTENSIONES_PERMITIDAS:
                # Obtener la ruta del archivo anterior
                cursor.execute('SELECT "Ruta_archivo" FROM public."Adjuntos" WHERE "ID_Nota" = %s', (nota_id,))
                fila_adjunto = cursor.fetchone()
                old_path = fila_adjunto[0] if (fila_adjunto and fila_adjunto[0]) else None

                filename = f"aud_rev_{user_id}_{_uuid.uuid4().hex}{ext}"
                url_publica = subir_a_supabase(archivo, "audios", filename)
                if url_publica:
                    cursor.execute("""
                        UPDATE public."Adjuntos" 
                        SET "Nombre_archivo" = %s, "Formato" = %s, "Ruta_archivo" = %s
                        WHERE "ID_Nota" = %s
                    """, (filename, ext.lstrip("."), url_publica, nota_id))

                    if old_path:
                        eliminar_archivo_de_supabase_por_ruta(old_path)

        cursor.execute('DELETE FROM public."Notas_etiquetas" WHERE "ID_Nota" = %s', (nota_id,))
        if etiquetas_raw: _insertar_etiquetas(etiquetas_raw, nota_id, cursor)

        conexion.commit()
        return jsonify({"success": True, "mensaje": "Audio actualizado", "redirect": "/notas"}), 200
    except Exception as e:
        if conexion: conexion.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cerrar_db(cursor, conexion)



# ==============================================================================
# 16. GUARDAR NOTA DE VIDEO
#     Acepta archivos de hasta 2 GB. Se lee en chunks para no saturar la RAM.
# ==============================================================================

@app.route("/guardar-nota-video", methods=["POST"])
@login_required
def guardar_nota_video():
    """
    Recibe el archivo de video y crea una nota de tipo video en la BD.
    La lectura se hace en chunks de 4 MB para soportar archivos de hasta 2 GB.

    Campos:
        titulo      — str (opcional)
        descripcion — str (opcional)
        etiquetas   — str separadas por coma (opcional, máx 20 chars c/u)
        video       — File (MP4, WebM, OGG, MKV, WMV, MOV, AVI; máx 2 GB)
    """
    user_id  = session["usuario_id"]
    conexion = None
    cursor   = None
    ruta_fisica_guardada = None  # para rollback físico si falla la BD

    try:
        titulo        = request.form.get("titulo",      "").strip() or "Video sin título"
        descripcion   = request.form.get("descripcion", "").strip() or f"Nota de video: {titulo}"
        etiquetas_raw = request.form.get("etiquetas",   "").strip()
        filtros       = request.form.get("filtros",     "").strip()

        archivo = request.files.get("video")
        if not archivo or archivo.filename == "":
            return jsonify({"error": "No se recibió ningún archivo de video"}), 400

        ext = os.path.splitext(archivo.filename)[1].lower()
        if ext not in VIDEO_EXTENSIONES:
            return jsonify({"error": f"Formato no permitido ({ext}). Usa: MP4, WebM, OGG, MKV, WMV, MOV o AVI"}), 400

        content_length = request.content_length
        if content_length and content_length > VIDEO_MAX_BYTES:
            return jsonify({"error": "El archivo supera el límite de 2 GB"}), 400

        filename      = f"video_{user_id}_{_uuid.uuid4().hex}{ext}"
        ruta_completa = os.path.join(VIDEO_UPLOAD_FOLDER, filename)
        ruta_db       = f"uploads/videos/{filename}"

        CHUNK_SIZE     = 4 * 1024 * 1024  # 4 MB por chunk
        bytes_escritos = 0

        with open(ruta_completa, "wb") as f:
            while True:
                chunk = archivo.stream.read(CHUNK_SIZE)
                if not chunk:
                    break
                bytes_escritos += len(chunk)
                if bytes_escritos > VIDEO_MAX_BYTES:
                    f.close()
                    os.remove(ruta_completa)
                    return jsonify({"error": "El archivo supera el límite de 2 GB"}), 400
                f.write(chunk)

        if bytes_escritos == 0:
            os.remove(ruta_completa)
            return jsonify({"error": "El archivo de video está vacío"}), 400

        ruta_fisica_guardada = ruta_completa

        # SUBIR A SUPABASE desde el disco temporal
        url_publica = None
        try:
            with open(ruta_completa, "rb") as f_in:
                url_publica = subir_a_supabase(f_in, "videos", filename)
        except Exception as st_err:
            print(f"Error subiendo video a Supabase: {st_err}")

        # Borrar el archivo local temporal de inmediato
        if os.path.exists(ruta_completa):
            try: os.remove(ruta_completa)
            except: pass
        ruta_fisica_guardada = None

        if not url_publica:
            return jsonify({"error": "Error al subir el video a la nube"}), 500

        conexion    = conectar_db()
        if conexion is None:
            return jsonify({"error": "Error de conexión a la base de datos"}), 500

        cursor      = conexion.cursor()
        hoy         = datetime.now()
        formato_adj = ext.lstrip(".")

        cursor.execute("""
            INSERT INTO public."Tipos" ("Formato") VALUES (%s) ON CONFLICT ("Formato") DO NOTHING
        """, (formato_adj,))

        nuevo_id = _next_id(cursor, "Notas", "ID_Nota")
        cursor.execute("""
            INSERT INTO public."Notas"
                ("ID_Nota", "Titulo", "Descripcion", "Contenido",
                 "Fecha_decreacion", "Fecha_deedicion", "Estado", "Formato", "ID_Cuenta", "ID_Carpeta")
            VALUES (%s, %s, %s, %s, %s, %s, 'Activa', 'video', %s, NULL)
        """, (nuevo_id, titulo, descripcion, filtros, hoy, hoy, user_id))
        nota_id = nuevo_id

        nuevo_id_adj = _next_id(cursor, "Adjuntos", "ID_Adjunto")
        cursor.execute("""
            INSERT INTO public."Adjuntos" ("ID_Adjunto", "Nombre_archivo", "Formato", "Ruta_archivo", "ID_Nota")
            VALUES (%s, %s, %s, %s, %s)
        """, (nuevo_id_adj, filename, formato_adj, url_publica, nota_id))

        if etiquetas_raw:
            _insertar_etiquetas(etiquetas_raw, nota_id, cursor)

        conexion.commit()
        ruta_fisica_guardada = None  # todo OK

        return jsonify({"success": True, "mensaje": "Nota de video guardada correctamente", "nota_id": int(nota_id), "redirect": "/notas"}), 201

    except Exception as e:
        if conexion:
            conexion.rollback()
        import traceback; traceback.print_exc()
        return jsonify({"error": f"Error interno: {str(e)}"}), 500

    finally:
        if ruta_fisica_guardada and os.path.exists(ruta_fisica_guardada):
            try: os.remove(ruta_fisica_guardada)
            except: pass
        cerrar_db(cursor, conexion)


@app.route("/actualizar-nota-video/<int:nota_id>", methods=["POST"])
@login_required
def actualizar_nota_video(nota_id):
    """Actualiza una nota de video existente."""
    user_id  = session["usuario_id"]
    conexion = None
    cursor   = None
    ruta_fisica_guardada = None
    try:
        titulo        = request.form.get("titulo",      "").strip()
        descripcion   = request.form.get("descripcion", "").strip()
        etiquetas_raw = request.form.get("etiquetas",   "").strip()
        filtros       = request.form.get("filtros",     "").strip()
        archivo       = request.files.get("video")

        conexion = conectar_db()
        cursor = conexion.cursor()

        cursor.execute('SELECT "ID_Nota" FROM public."Notas" WHERE "ID_Nota" = %s AND "ID_Cuenta" = %s', (nota_id, user_id))
        if not cursor.fetchone():
            return jsonify({"error": "No tienes permiso"}), 403

        cursor.execute("""
            UPDATE public."Notas"
            SET "Titulo" = %s, "Descripcion" = %s, "Contenido" = %s, "Fecha_deedicion" = %s
            WHERE "ID_Nota" = %s
        """, (titulo, descripcion, filtros, datetime.now(), nota_id))

        if archivo and archivo.filename != "":
            ext = os.path.splitext(archivo.filename)[1].lower()
            if ext in VIDEO_EXTENSIONES:
                # Obtener la ruta del archivo anterior
                cursor.execute('SELECT "Ruta_archivo" FROM public."Adjuntos" WHERE "ID_Nota" = %s', (nota_id,))
                fila_adjunto = cursor.fetchone()
                old_path = fila_adjunto[0] if (fila_adjunto and fila_adjunto[0]) else None

                filename = f"vid_rev_{user_id}_{_uuid.uuid4().hex}{ext}"
                url_publica = subir_a_supabase(archivo, "videos", filename)
                
                if url_publica:
                    cursor.execute("""
                        UPDATE public."Adjuntos" 
                        SET "Nombre_archivo" = %s, "Formato" = %s, "Ruta_archivo" = %s
                        WHERE "ID_Nota" = %s
                    """, (filename, ext.lstrip("."), url_publica, nota_id))

                    if old_path:
                        eliminar_archivo_de_supabase_por_ruta(old_path)

        cursor.execute('DELETE FROM public."Notas_etiquetas" WHERE "ID_Nota" = %s', (nota_id,))
        if etiquetas_raw: _insertar_etiquetas(etiquetas_raw, nota_id, cursor)

        conexion.commit()
        return jsonify({"success": True, "mensaje": "Video actualizado", "redirect": "/notas"}), 200
    except Exception as e:
        if conexion: conexion.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cerrar_db(cursor, conexion)



# ==============================================================================
# 17. GUARDAR NOTA MIXTA
#     Combina texto HTML con archivos de imagen, audio y/o video.
#     Cada archivo genera un registro en Adjuntos con su formato real.
# ==============================================================================
# ==============================================================================
# API NOTA MIXTA — Devuelve contenido y adjuntos para cargar en el editor
# ==============================================================================
@app.route("/api/nota-mixta/<int:nota_id>")
@login_required
def api_nota_mixta(nota_id):
    """Devuelve el contenido y adjuntos de una nota mixta para cargar en el editor."""
    user_id  = session["usuario_id"]
    conexion = None
    cursor   = None
    try:
        conexion = conectar_db(dict_cursor=True)
        cursor   = conexion.cursor()

        cursor.execute("""
            SELECT "Contenido" FROM public."Notas"
            WHERE "ID_Nota" = %s AND "ID_Cuenta" = %s AND "Estado" = 'Activa'
        """, (nota_id, user_id))
        nota = cursor.fetchone()
        if not nota:
            return jsonify({"success": False, "error": "Nota no encontrada"}), 404

        cursor.execute("""
            SELECT "ID_Adjunto", "Nombre_archivo", "Formato", "Ruta_archivo"
            FROM public."Adjuntos"
            WHERE "ID_Nota" = %s
        """, (nota_id,))
        adjuntos_raw = cursor.fetchall()

        TIPOS_IMAGEN = {'png','jpg','jpeg','gif','webp','svg','pntg','wmf'}
        TIPOS_AUDIO  = {'mp3','aac','ogg','wav','flac','wma','m4a','webm'}
        TIPOS_VIDEO  = {'mp4','mkv','wmv','mov','avi'}

        adjuntos = []
        for adj in adjuntos_raw:
            fmt = (adj["Formato"] or "").lower().strip(".")
            if fmt in TIPOS_IMAGEN:   tipo = "imagen"
            elif fmt in TIPOS_AUDIO:  tipo = "audio"
            elif fmt in TIPOS_VIDEO:  tipo = "video"
            else:                     tipo = "otro"

            adjuntos.append({
                "id":      adj["ID_Adjunto"],
                "nombre":  adj["Nombre_archivo"],
                "formato": fmt,
                "ruta":    adj["Ruta_archivo"],
                "tipo":    tipo,
            })

        return jsonify({
            "success":   True,
            "contenido": nota["Contenido"] or "",
            "adjuntos":  adjuntos,
        }), 200

    except Exception:
        import traceback; traceback.print_exc()
        return jsonify({"success": False, "error": "Error al cargar la nota"}), 500
    finally:
        cerrar_db(cursor, conexion)


@app.route("/guardar-nota-mixta", methods=["POST"])
@login_required
def guardar_nota_mixta():
    """
    Recibe texto más archivos multimedia y crea una nota de tipo mixta en la BD.

    Campos:
        titulo      — str (obligatorio)
        descripcion — str (opcional)
        etiquetas   — str separadas por coma (opcional, máx 20 chars c/u)
        contenido   — str HTML del editor de texto (puede estar vacío)
        imagenes    — File[] (opcional; JPG, PNG, GIF, WEBP, SVG; máx 200 MB c/u)
        audios      — File[] (opcional; MP3, AAC, OGG, WAV, FLAC, WMA, M4A; máx 200 MB c/u)
        videos      — File[] (opcional; MP4, WebM, OGG, MKV, WMV, MOV, AVI; máx 2 GB c/u)

    Debe existir al menos un campo con contenido real.
    """
    user_id  = session["usuario_id"]
    conexion = None
    cursor   = None
    archivos_guardados = []  # para rollback físico si falla la BD

    try:
        contenido     = sanitizar_html(request.form.get("contenido", "").strip())
        titulo        = bleach.clean(request.form.get("titulo", "").strip(), tags=[], strip=True)
        descripcion   = bleach.clean(request.form.get("descripcion", "").strip(), tags=[], strip=True)
        etiquetas_raw = bleach.clean(request.form.get("etiquetas", "").strip(), tags=[], strip=True)

        if not titulo:
            return jsonify({"error": "El título de la nota es obligatorio"}), 400
        if not descripcion:
            descripcion = f"Nota mixta: {titulo}"

        archivos_por_tipo = {
            "imagenes": request.files.getlist("imagenes"),
            "audios":   request.files.getlist("audios"),
            "videos":   request.files.getlist("videos"),
        }

        tiene_contenido = bool(contenido) or any(
            f.filename != "" for lista in archivos_por_tipo.values() for f in lista
        )
        if not tiene_contenido:
            return jsonify({"error": "La nota debe tener al menos un tipo de contenido"}), 400

        # ── Validar límite de adjuntos según plan ─────────────────────
        total_nuevos = sum(
            1 for lista in archivos_por_tipo.values()
            for f in lista if f.filename != ""
        )
        if total_nuevos > 0:
            conexion_plan = conectar_db(dict_cursor=True)
            if conexion_plan:
                cur_plan = conexion_plan.cursor()
                cur_plan.execute('SELECT "Plan_premium" FROM public."Cuentas" WHERE "ID_Cuenta" = %s', (user_id,))
                row = cur_plan.fetchone()
                cerrar_db(cur_plan, conexion_plan)
                plan_usuario = (row.get("Plan_premium") or "gratis").lower() if row else "gratis"
            else:
                plan_usuario = "gratis"

            MAX_ADJUNTOS_MIXTA = {"gratis": 3, "quincenal": 6, "mensual": 15, "anual": 50}
            max_adj = MAX_ADJUNTOS_MIXTA.get(plan_usuario, 3)
            if total_nuevos > max_adj:
                plan_nombre = plan_usuario.capitalize()
                return jsonify({"error": f"Tu plan {plan_nombre} permite máximo {max_adj} archivos por nota mixta. Intentaste subir {total_nuevos}."}), 400

        adjuntos_a_insertar = []

        for tipo, lista in archivos_por_tipo.items():
            reglas  = MIXTA_REGLAS[tipo]
            carpeta = MIXTA_CARPETAS[tipo]

            for archivo in lista:
                if not archivo or archivo.filename == "":
                    continue

                ext = os.path.splitext(archivo.filename)[1].lower()
                if ext not in reglas["exts"]:
                    return jsonify({"error": f"Formato no permitido para {tipo}: {ext}"}), 400

                filename      = f"{reglas['prefijo']}_{user_id}_{_uuid.uuid4().hex}{ext}"
                ruta_completa = os.path.join(carpeta, filename)
                ruta_db       = f"uploads/{tipo}/{filename}"

                if tipo == "videos":
                    CHUNK    = 4 * 1024 * 1024
                    escritos = 0
                    with open(ruta_completa, "wb") as f:
                        while True:
                            chunk = archivo.stream.read(CHUNK)
                            if not chunk:
                                break
                            escritos += len(chunk)
                            if escritos > reglas["max_bytes"]:
                                f.close()
                                os.remove(ruta_completa)
                                return jsonify({"error": "Un video supera el límite de 2 GB"}), 400
                            f.write(chunk)
                    if escritos == 0:
                        os.remove(ruta_completa)
                        continue
                else:
                    data = archivo.read()
                    if len(data) > reglas["max_bytes"]:
                        return jsonify({"error": f"Un archivo de {tipo} supera el límite de 200 MB"}), 400
                    if len(data) == 0:
                        continue
                    with open(ruta_completa, "wb") as f:
                        f.write(data)

                # SUBIR A SUPABASE
                url_publica = None
                try:
                    with open(ruta_completa, "rb") as f_in:
                        url_publica = subir_a_supabase(f_in, tipo, filename)
                except Exception as st_err:
                    print(f"Error en mixta -> Supabase ({tipo}): {st_err}")

                # Borrar local de inmediato
                if os.path.exists(ruta_completa):
                    try: os.remove(ruta_completa)
                    except: pass

                if not url_publica:
                    return jsonify({"error": f"Error al subir {tipo} a la nube"}), 500

                adjuntos_a_insertar.append({
                    "filename": filename,
                    "ext":      ext.lstrip("."),
                    "url":      url_publica,
                })

        conexion = conectar_db()
        if conexion is None:
            return jsonify({"error": "Error de conexión a la base de datos"}), 500

        cursor = conexion.cursor()
        hoy    = datetime.now()

        for fmt_val in {a["ext"] for a in adjuntos_a_insertar} | {"mixta"}:
            cursor.execute("""
                INSERT INTO public."Tipos" ("Formato") VALUES (%s) ON CONFLICT ("Formato") DO NOTHING
            """, (fmt_val,))

        nuevo_id = _next_id(cursor, "Notas", "ID_Nota")
        cursor.execute("""
            INSERT INTO public."Notas"
                ("ID_Nota", "Titulo", "Descripcion", "Contenido",
                 "Fecha_decreacion", "Fecha_deedicion", "Estado", "Formato", "ID_Cuenta", "ID_Carpeta")
            VALUES (%s, %s, %s, %s, %s, %s, 'Activa', 'mixta', %s, NULL)
        """, (nuevo_id, titulo, descripcion, contenido, hoy, hoy, user_id))
        nota_id = nuevo_id

        for adj in adjuntos_a_insertar:
            nuevo_id_adj = _next_id(cursor, "Adjuntos", "ID_Adjunto")
            cursor.execute("""
                INSERT INTO public."Adjuntos" ("ID_Adjunto", "Nombre_archivo", "Formato", "Ruta_archivo", "ID_Nota")
                VALUES (%s, %s, %s, %s, %s)
            """, (nuevo_id_adj, adj["filename"], adj["ext"], adj["url"], nota_id))

        if etiquetas_raw:
            _insertar_etiquetas(etiquetas_raw, nota_id, cursor)

        conexion.commit()
        archivos_guardados.clear()  # todo OK

        return jsonify({"success": True, "mensaje": "Nota mixta guardada correctamente", "nota_id": int(nota_id), "redirect": "/notas"}), 201

    except Exception as e:
        if conexion:
            conexion.rollback()
        import traceback; traceback.print_exc()
        return jsonify({"error": "Error interno al guardar la nota mixta"}), 500

    finally:
        for ruta in archivos_guardados:
            try:
                if os.path.exists(ruta):
                    os.remove(ruta)
            except Exception:
                pass
        cerrar_db(cursor, conexion)


@app.route("/actualizar-nota-mixta/<int:nota_id>", methods=["POST"])
@login_required
def actualizar_nota_mixta(nota_id):
    """Actualiza una nota mixta existente."""
    user_id  = session["usuario_id"]
    conexion = None
    cursor   = None
    archivos_guardados = []
    try:
        titulo        = bleach.clean(request.form.get("titulo", "").strip(), tags=[], strip=True)
        descripcion   = request.form.get("descripcion", "").strip()
        contenido     = sanitizar_html(request.form.get("contenido", "").strip())
        etiquetas_raw = request.form.get("etiquetas",   "").strip()
        nuevos_archivos = request.files.getlist("archivos")

        conexion = conectar_db()
        cursor = conexion.cursor()

        cursor.execute('SELECT "ID_Nota" FROM public."Notas" WHERE "ID_Nota" = %s AND "ID_Cuenta" = %s', (nota_id, user_id))
        if not cursor.fetchone():
            return jsonify({"error": "No tienes permiso"}), 403

        cursor.execute("""
            UPDATE public."Notas"
            SET "Titulo" = %s, "Descripcion" = %s, "Contenido" = %s, "Fecha_deedicion" = %s
            WHERE "ID_Nota" = %s
        """, (titulo, descripcion, contenido, datetime.now(), nota_id))

        if nuevos_archivos and any(f.filename != "" for f in nuevos_archivos):
            # En notas mixtas, añadimos los nuevos adjuntos.
            for archivo in nuevos_archivos:
                if archivo and archivo.filename != "":
                    ext = os.path.splitext(archivo.filename)[1].lower()
                    
                    # Determinar carpeta según extensión
                    tipo = "imagenes"
                    if ext in MIXTA_REGLAS["audios"]["exts"]: tipo = "audios"
                    if ext in MIXTA_REGLAS["videos"]["exts"]: tipo = "videos"
                    
                    carpeta = MIXTA_CARPETAS[tipo]
                    filename = f"mixta_rev_{user_id}_{_uuid.uuid4().hex}{ext}"
                    ruta_completa = os.path.join(carpeta, filename)
                    archivo.save(ruta_completa)
                    archivos_guardados.append(ruta_completa)

                    # SUBIR A SUPABASE
                    url_publica = None
                    try:
                        with open(ruta_completa, "rb") as f_in:
                            url_publica = subir_a_supabase(f_in, tipo, filename)
                    except Exception as st_err:
                        print(f"Error en actualizar mixta -> Supabase ({tipo}): {st_err}")

                    # Borrar local inmediato
                    if os.path.exists(ruta_completa):
                        try: os.remove(ruta_completa)
                        except: pass
                    if ruta_completa in archivos_guardados:
                        archivos_guardados.remove(ruta_completa)

                    if url_publica:
                        cursor.execute('SELECT COALESCE(MAX("ID_Adjunto"), 0) + 1 FROM public."Adjuntos"')
                        nuevo_id_adj = cursor.fetchone()[0]
                        cursor.execute("""
                            INSERT INTO public."Adjuntos" ("ID_Adjunto", "Nombre_archivo", "Formato", "Ruta_archivo", "ID_Nota")
                            VALUES (%s, %s, %s, %s, %s)
                        """, (nuevo_id_adj, filename, ext.lstrip("."), url_publica, nota_id))

        cursor.execute('DELETE FROM public."Notas_etiquetas" WHERE "ID_Nota" = %s', (nota_id,))
        if etiquetas_raw: _insertar_etiquetas(etiquetas_raw, nota_id, cursor)

        conexion.commit()
        archivos_guardados.clear()
        return jsonify({"success": True, "mensaje": "Nota mixta actualizada", "redirect": "/notas"}), 200
    except Exception as e:
        if conexion: conexion.rollback()
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        for ruta in archivos_guardados:
            try: os.remove(ruta)
            except: pass
        cerrar_db(cursor, conexion)





# ==============================================================================
# 18. PLANES PREMIUM
# ==============================================================================

@app.route("/planes")
@login_required
def planes():
    """Landing page que muestra los planes de suscripción Premium."""
    return render_template("planes.html")


# ==============================================================================
# 19. PASARELA DE PAGOS
# ==============================================================================

@app.route("/pasarela")
@login_required
def pasarela():
    """
    Página de pasarela de pagos.
    Recibe por query params:
        plan    — quincenal | mensual | anual
        precio  — precio en COP (sin puntos)
    """
    plan   = request.args.get("plan",   "mensual")
    precio = request.args.get("precio", "24900")

    # Validación básica — solo planes reconocidos
    planes_validos = {
        "quincenal": "14900",
        "mensual":   "24900",
        "anual":     "199900",
    }
    if plan not in planes_validos:
        plan = "mensual"
    # Usa el precio canónico del servidor, ignora lo que venga en la URL
    precio = planes_validos[plan]

    return render_template(
        "pasarela.html",
        plan=plan,
        precio=precio,
        epayco_public_key=os.getenv("EPAYCO_PUBLIC_KEY", "")
    )


@app.route("/procesar-pago", methods=["POST"])
@login_required
def procesar_pago():
    """
    Endpoint para procesar el pago.
    Por ahora registra la intención en sesión.
    Aquí conectarás tu pasarela real (Wompi, PayU, Epayco, etc.).

    Recibe JSON o form:
        plan         — quincenal | mensual | anual
        precio       — int en COP
        metodo       — bancolombia | nequi | daviplata | efecty
        nombre       — str
        correo       — str
    """
    user_id = session["usuario_id"]
    datos   = request.get_json(silent=True) or request.form

    plan   = datos.get("plan",   "mensual").lower()
    precio = datos.get("precio", "24900")
    metodo = datos.get("metodo", "")
    nombre = datos.get("nombre", "").strip()
    correo = datos.get("correo", "").strip()

    if not all([plan, metodo, nombre, correo]):
        return jsonify({"error": "Faltan datos del pago"}), 400

    # ─── TODO: Integrar aquí tu SDK de pasarela real ───────────────
    # Ejemplo con Wompi:
    #   response = wompi.crear_transaccion(monto=precio, moneda="COP", ...)
    #   if response.ok: ...
    # ───────────────────────────────────────────────────────────────

    # Por ahora: simula aprobación y guarda en sesión y en la BASE DE DATOS
    from datetime import datetime, timedelta
    duraciones = {"quincenal": 15, "mensual": 30, "anual": 365}
    dias       = duraciones.get(plan, 30)
    expira     = datetime.now() + timedelta(days=dias)

    session["plan_premium"]        = plan
    session["plan_premium_expira"] = expira.isoformat()
    session["es_premium"]          = True
    colores = {"quincenal": "#a29bfe", "mensual": "#f1c40f", "anual": "#00d2d3"}
    session["premium_color"]      = colores.get(plan, "#f1c40f")
    session.modified               = True

    # Actualizar la BD para que el premium persista
    conexion = None
    cursor   = None
    try:
        conexion = conectar_db()
        cursor = conexion.cursor()
        cursor.execute("""
            UPDATE public."Cuentas"
            SET "Es_premium" = TRUE, "Premium_vence" = %s, "Plan_premium" = %s, "Avatar_plan" = %s
            WHERE "ID_Cuenta" = %s
        """, (expira, plan, plan, user_id))
        conexion.commit()
    except Exception as e:
        print(f"Error al guardar premium en BD: {e}")
    finally:
        cerrar_db(cursor, conexion)

    return jsonify({
        "success": True,
        "mensaje": f"Pago con {metodo.capitalize()} verificado. Plan {plan} activado hasta {expira.strftime('%d/%m/%Y')}",
        "redirect": "/dashboard",
    }), 200



# ==============================================================================
# RUTAS DE SOPORTE (Chat Interno)
# ==============================================================================

def enviar_correo_asincrono(app_instance, msg):
    with app_instance.app_context():
        try:
            mail.send(msg)
        except Exception as mail_err:
            print(f"Error al enviar correo de soporte asíncrono: {mail_err}")

@app.route("/api/enviar-soporte", methods=["POST"])
@login_required
def enviar_soporte():
    """Recibe un mensaje de soporte del usuario y lo guarda en la BD."""
    data = request.get_json()
    mensaje = data.get("mensaje")
    usuario_id = session.get("usuario_id")
    
    if not mensaje:
        return jsonify({"error": "Mensaje vacío"}), 400
        
    conexion = conectar_db(dict_cursor=True)
    if not conexion:
        return jsonify({"error": "Error de base de datos"}), 500
        
    try:
        cur = conexion.cursor()
        
        # Obtener info del usuario para el correo
        cur.execute("SELECT \"Nombres\", \"Telefono\", \"Correo\" FROM public.\"Cuentas\" WHERE \"ID_Cuenta\" = %s", (usuario_id,))
        user_info = cur.fetchone()
        
        cur.execute("""
            INSERT INTO public."Soporte" ("ID_Cuenta", "Mensaje", "Remitente")
            VALUES (%s, %s, %s)
        """, (usuario_id, mensaje, 'usuario'))
        conexion.commit()
        
        # ENVIAR NOTIFICACIÓN POR CORREO AL ADMIN (ID 1) DE FORMA ASÍNCRONA
        try:
            admin_email = "miniyonminerat2@gmail.com" # El correo del administrador
            msg = Message(
                subject=f"🔔 Nuevo Mensaje de Soporte: {user_info['Nombres']}",
                recipients=[admin_email],
                body=f"Hola Admin,\n\nTienes un nuevo mensaje de soporte en NoteFlow.\n\n"
                     f"Usuario: {user_info['Nombres']}\n"
                     f"Correo: {user_info['Correo']}\n"
                     f"Teléfono: {user_info['Telefono']}\n"
                     f"Mensaje: {mensaje}\n\n"
                     f"Puedes responder desde el panel de administración."
            )
            from threading import Thread
            Thread(target=enviar_correo_asincrono, args=(app, msg)).start()
        except Exception as mail_err:
            print(f"Error al iniciar hilo para correo de soporte: {mail_err}")
            
        cerrar_db(cur, conexion)
        return jsonify({"success": True})
    except Exception as e:
        print(f"Error en enviar_soporte: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/soporte-admin")
@login_required
def soporte_admin():
    """Renderiza el panel de administración de soporte (Solo para Cuentas con privilegios Es_admin)."""
    user_id = session.get("usuario_id")
    
    conexion = conectar_db(dict_cursor=True)
    if not conexion:
        return "Error de conexión a la base de datos", 500
        
    cursor = None
    try:
        cursor = conexion.cursor()
        
        # Migración al vuelo: Asegurar la columna "Es_admin"
        cursor.execute('ALTER TABLE public."Cuentas" ADD COLUMN IF NOT EXISTS "Es_admin" BOOLEAN DEFAULT FALSE;')
        cursor.execute('UPDATE public."Cuentas" SET "Es_admin" = TRUE WHERE "ID_Cuenta" = 1;')
        conexion.commit()
        
        # Consultar datos y rol del usuario
        cursor.execute("""
            SELECT "Nombres", "Foto", "Color_principal", "Es_premium", "Plan_premium", "Es_admin", "Avatar_plan"
            FROM public."Cuentas" WHERE "ID_Cuenta" = %s
        """, (user_id,))
        usuario = cursor.fetchone()
        
        if not usuario:
            session.clear()
            cerrar_db(cursor, conexion)
            return redirect(url_for("mostrar_login"))
            
        # Validar si tiene permisos de administración
        if not usuario.get("Es_admin", False):
            cerrar_db(cursor, conexion)
            return redirect(url_for("dashboard"))
            
        # Guardar es_admin en sesión para que el template lo pueda usar
        session["es_admin"] = bool(usuario.get("Es_admin", False))
        
        cerrar_db(cursor, conexion)
        # Renderiza el index.html compilado de React (ubicado en templates)
        return render_template("soporte_admin_react.html", usuario=usuario)
    except Exception as e:
        print(f"Error en soporte_admin: {e}")
        if cursor:
            cerrar_db(cursor, conexion)
        return f"Error interno: {str(e)}", 500
    finally:
        cerrar_db(cursor, conexion)

@app.route("/api/soporte-admin/chats")
@limiter.exempt
@login_required
def obtener_chats_admin():
    """Obtiene la lista de usuarios que han enviado mensajes de soporte."""
    if not es_admin(session.get("usuario_id")):
        return jsonify({"error": "No autorizado"}), 403
        
    conexion = conectar_db(dict_cursor=True)
    try:
        cur = conexion.cursor()
        # Seleccionar usuarios únicos que tienen mensajes, incluyendo su plan
        cur.execute("""
            SELECT * FROM (
                SELECT DISTINCT ON (s."ID_Cuenta") 
                    c."ID_Cuenta", c."Nombres", c."Foto", c."Plan_premium", s."Mensaje" as "Ultimo_Mensaje", s."Fecha"
                FROM public."Soporte" s
                JOIN public."Cuentas" c ON s."ID_Cuenta" = c."ID_Cuenta"
                ORDER BY s."ID_Cuenta", s."Fecha" DESC
            ) sub
            ORDER BY sub."Fecha" DESC
        """)
        chats = cur.fetchall()
        cerrar_db(cur, conexion)
        return jsonify(chats)
    except Exception as e:
        print(f"Error en obtener_chats_admin: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/soporte-admin/mensajes/<int:user_id>")
@limiter.exempt
@login_required
def obtener_mensajes_admin(user_id):
    """Obtiene el historial de chat con un usuario específico."""
    if not es_admin(session.get("usuario_id")):
        return jsonify({"error": "No autorizado"}), 403
        
    conexion = conectar_db(dict_cursor=True)
    try:
        cur = conexion.cursor()
        cur.execute("""
            SELECT "Mensaje", "Remitente", "Fecha"
            FROM public."Soporte"
            WHERE "ID_Cuenta" = %s
            ORDER BY "Fecha" ASC
        """, (user_id,))
        mensajes = cur.fetchall()
        for msg in mensajes:
            msg["Fecha"] = msg["Fecha"].strftime("%H:%M")
        cerrar_db(cur, conexion)
        return jsonify(mensajes)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/soporte-admin/responder", methods=["POST"])
@login_required
def responder_soporte():
    """Envía una respuesta de soporte a un usuario."""
    if not es_admin(session.get("usuario_id")):
        return jsonify({"error": "No autorizado"}), 403
        
    data = request.get_json()
    user_id = data.get("user_id")
    mensaje = data.get("mensaje")
    
    if not user_id or not mensaje:
        return jsonify({"error": "Datos incompletos"}), 400
        
    conexion = conectar_db()
    try:
        cur = conexion.cursor()
        cur.execute("""
            INSERT INTO public."Soporte" ("ID_Cuenta", "Mensaje", "Remitente")
            VALUES (%s, %s, %s)
        """, (user_id, mensaje, 'soporte'))
        conexion.commit()
        cerrar_db(cur, conexion)
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/soporte-admin/resolver", methods=["POST"])
@login_required
def resolver_soporte():
    """Resuelve un chat de soporte, limpia el historial y notifica al usuario."""
    if not es_admin(session.get("usuario_id")):
        return jsonify({"error": "No autorizado"}), 403
        
    data = request.get_json()
    user_id = data.get("user_id")
    
    if not user_id:
        return jsonify({"error": "Falta user_id"}), 400
        
    conexion = conectar_db(dict_cursor=True)
    if not conexion:
         return jsonify({"error": "Error de base de datos"}), 500
         
    try:
        cur = conexion.cursor()
        
        # Obtener correo del usuario
        cur.execute('SELECT "Correo", "Nombres" FROM public."Cuentas" WHERE "ID_Cuenta" = %s', (user_id,))
        user_info = cur.fetchone()
        
        if user_info and user_info.get("Correo"):
            correo = user_info["Correo"]
            nombres = user_info["Nombres"]
            
            # Enviar correo de resolución
            try:
                from flask_mail import Message
                import threading
                msg = Message(
                    subject="✅ Tu consulta de soporte ha sido resuelta - NoteFlow",
                    recipients=[correo],
                    body=f"Hola {nombres},\n\nTu consulta de soporte reciente ha sido marcada como resuelta por nuestro equipo.\n\nEsperamos haberte sido de gran ayuda. Si tienes alguna otra duda, no dudes en contactarnos nuevamente abriendo un nuevo chat de soporte.\n\n¡Gracias por usar NoteFlow!"
                )
                threading.Thread(target=enviar_correo_asincrono, args=(app, msg)).start()
            except Exception as mail_err:
                print(f"Error preparando correo de resolución: {mail_err}")
        
        # Limpiar el historial de soporte de ese usuario
        cur.execute('DELETE FROM public."Soporte" WHERE "ID_Cuenta" = %s', (user_id,))
        conexion.commit()
        
        cerrar_db(cur, conexion)
        return jsonify({"success": True, "mensaje": "Chat resuelto y usuario notificado"})
    except Exception as e:
        print(f"Error al resolver soporte: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/mensajes-soporte")
@login_required
def obtener_mensajes_soporte():
    """Obtiene el historial de chat de soporte para el usuario actual."""
    usuario_id = session.get("usuario_id")
    conexion = conectar_db(dict_cursor=True)
    if not conexion:
        return jsonify({"error": "Error de base de datos"}), 500
        
    try:
        cur = conexion.cursor()
        cur.execute("""
            SELECT "Mensaje", "Remitente", "Fecha"
            FROM public."Soporte"
            WHERE "ID_Cuenta" = %s
            ORDER BY "Fecha" ASC
        """, (usuario_id,))
        mensajes = cur.fetchall()
        
        # Formatear la respuesta
        for msg in mensajes:
            # Convertir timestamp a string legible
            msg["Fecha"] = msg["Fecha"].strftime("%H:%M")
            
        cerrar_db(cur, conexion)
        return jsonify(mensajes)
    except Exception as e:
        print(f"Error en obtener_mensajes_soporte: {e}")
        return jsonify({"error": str(e)}), 500
def limpiar_soporte_db(usuario_id):
    """Limpia el historial de soporte para un usuario específico."""
    conexion = conectar_db()
    if not conexion:
        return False
    try:
        cur = conexion.cursor()
        cur.execute('DELETE FROM public."Soporte" WHERE "ID_Cuenta" = %s', (usuario_id,))
        conexion.commit()
        cerrar_db(cur, conexion)
        return True
    except Exception as e:
        print(f"Error al limpiar soporte: {e}")
        return False

@app.route("/api/limpiar-soporte", methods=["POST"])
@login_required
def api_limpiar_soporte():
    """Endpoint para limpiar el chat de soporte del usuario actual."""
    usuario_id = session.get("usuario_id")
    if limpiar_soporte_db(usuario_id):
        return jsonify({"success": True, "mensaje": "Chat reiniciado"})
    else:
        return jsonify({"error": "No se pudo limpiar el chat"}), 500


# ==============================================================================
# 19. ENDPOINTS DE ADMINISTRACIÓN (Gestión de Usuarios y Estadísticas)
# ==============================================================================

@app.route("/api/admin/reporte-mensual")
@limiter.exempt
@login_required
def api_admin_reporte_mensual():
    """Obtiene datos de los últimos 30 días para los gráficos y el reporte mensual."""
    if not es_admin(session.get("usuario_id")):
        return jsonify({"error": "No autorizado"}), 403

    conexion = conectar_db(dict_cursor=True)
    if not conexion:
        return jsonify({"error": "Error de conexión a la base de datos"}), 500

    try:
        cur = conexion.cursor()
        
        query = """
        WITH RECURSIVE dias AS (
            SELECT current_date - 29 AS fecha
            UNION ALL
            SELECT fecha + 1 FROM dias WHERE fecha < current_date
        ),
        notas_diarias AS (
            SELECT "Fecha_decreacion"::date as fecha, COUNT(*) as cant_notas
            FROM public."Notas"
            WHERE "Fecha_decreacion" >= current_date - 30
            GROUP BY "Fecha_decreacion"::date
        ),
        cuentas_diarias AS (
            SELECT "Fecha_creacion"::date as fecha, COUNT(*) as cant_cuentas
            FROM public."Cuentas"
            WHERE "Fecha_creacion" >= current_date - 30
            GROUP BY "Fecha_creacion"::date
        ),
        compras_estimadas AS (
            SELECT 
                CASE 
                    WHEN "Plan_premium" = 'quincenal' THEN ("Premium_vence" - INTERVAL '15 days')::date
                    WHEN "Plan_premium" = 'mensual' THEN ("Premium_vence" - INTERVAL '1 month')::date
                    WHEN "Plan_premium" = 'anual' THEN ("Premium_vence" - INTERVAL '1 year')::date
                    ELSE NULL
                END as fecha,
                COUNT(*) as cant_compras,
                SUM(CASE 
                    WHEN "Plan_premium" = 'quincenal' THEN 14900
                    WHEN "Plan_premium" = 'mensual' THEN 24900
                    WHEN "Plan_premium" = 'anual' THEN 199900
                    ELSE 0
                END) as ingresos
            FROM public."Cuentas"
            WHERE "Es_premium" = TRUE AND "Premium_vence" IS NOT NULL
            GROUP BY 1
        )
        SELECT 
            d.fecha,
            COALESCE(n.cant_notas, 0) as notas,
            COALESCE(c.cant_cuentas, 0) as cuentas,
            COALESCE(co.cant_compras, 0) as compras,
            COALESCE(co.ingresos, 0) as ingresos
        FROM dias d
        LEFT JOIN notas_diarias n ON d.fecha = n.fecha
        LEFT JOIN cuentas_diarias c ON d.fecha = c.fecha
        LEFT JOIN compras_estimadas co ON d.fecha = co.fecha
        ORDER BY d.fecha ASC;
        """
        cur.execute(query)
        rows = cur.fetchall()
        cerrar_db(cur, conexion)
        
        # Generar un pequeño análisis de texto
        total_notas = sum(r["notas"] for r in rows)
        total_cuentas = sum(r["cuentas"] for r in rows)
        total_ingresos = sum(r["ingresos"] for r in rows)
        
        analisis_texto = f"En los últimos 30 días, se han creado {total_notas} notas nuevas y {total_cuentas} cuentas de usuario. Los ingresos estimados generados en este periodo son de ${total_ingresos:,.0f} COP."
        
        return jsonify({
            "datos": [{
                "fecha": r["fecha"].strftime("%Y-%m-%d"),
                "notas": r["notas"],
                "cuentas": r["cuentas"],
                "compras": r["compras"],
                "ingresos": r["ingresos"]
            } for r in rows],
            "resumen": {
                "total_notas": total_notas,
                "total_cuentas": total_cuentas,
                "total_ingresos": total_ingresos,
                "texto": analisis_texto
            }
        })
    except Exception as e:
        print(f"Error en api_admin_reporte_mensual: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/admin/estadisticas")
@limiter.exempt
@login_required
def api_admin_estadisticas():
    """Obtiene estadísticas detalladas para las tarjetas del panel."""
    if not es_admin(session.get("usuario_id")):
        return jsonify({"error": "No autorizado"}), 403

    conexion = conectar_db(dict_cursor=True)
    if not conexion:
        return jsonify({"error": "Error de conexión a la base de datos"}), 500

    try:
        cur = conexion.cursor()
        
        # 1. Total Registrados
        cur.execute('SELECT COUNT(*) as count FROM public."Cuentas"')
        total_registrados = cur.fetchone()["count"]
        
        # 2. Premium
        cur.execute('SELECT COUNT(*) as count FROM public."Cuentas" WHERE "Es_premium" = TRUE')
        premium = cur.fetchone()["count"]
        
        # 3. Gratis
        cur.execute('SELECT COUNT(*) as count FROM public."Cuentas" WHERE "Es_premium" = FALSE OR "Es_premium" IS NULL')
        gratis = cur.fetchone()["count"]
        
        # 4. Activos 30 días
        cur.execute("""
            SELECT COUNT(DISTINCT u."ID_Cuenta") as count FROM public."Cuentas" u
            LEFT JOIN public."Notas" n ON u."ID_Cuenta" = n."ID_Cuenta" AND (n."Fecha_deedicion" >= CURRENT_DATE - 30 OR n."Fecha_decreacion" >= CURRENT_DATE - 30)
            LEFT JOIN public."Carpetas" c ON u."ID_Cuenta" = c."ID_Cuenta" AND (c."Fecha_edicion" >= CURRENT_DATE - 30 OR c."Fecha_creacion" >= CURRENT_DATE - 30)
            LEFT JOIN public."Soporte" s ON u."ID_Cuenta" = s."ID_Cuenta" AND s."Fecha" >= NOW() - INTERVAL '30 days'
            WHERE n."ID_Nota" IS NOT NULL OR c."ID_Carpeta" IS NOT NULL OR s."ID_Mensaje" IS NOT NULL OR u."ID_Cuenta" = 1
        """)
        activos = cur.fetchone()["count"]
        
        # 5. Ingresos Totales
        cur.execute("""
            SELECT 
                SUM(CASE 
                    WHEN "Plan_premium" = 'quincenal' THEN 14900
                    WHEN "Plan_premium" = 'mensual' THEN 24900
                    WHEN "Plan_premium" = 'anual' THEN 199900
                    ELSE 0
                END) as count
            FROM public."Cuentas"
            WHERE "Es_premium" = TRUE
        """)
        ingresos = cur.fetchone()["count"] or 0
        
        # 6. Notas Creadas (total)
        cur.execute('SELECT COUNT(*) as count FROM public."Notas"')
        notas_creadas = cur.fetchone()["count"]
        
        # 7. Notas Este Mes
        cur.execute('SELECT COUNT(*) as count FROM public."Notas" WHERE "Fecha_decreacion" >= date_trunc(\'month\', CURRENT_DATE)')
        notas_este_mes = cur.fetchone()["count"]
        
        # 8. Notas Mes Pasado
        cur.execute('SELECT COUNT(*) as count FROM public."Notas" WHERE "Fecha_decreacion" >= date_trunc(\'month\', CURRENT_DATE) - INTERVAL \'1 month\' AND "Fecha_decreacion" < date_trunc(\'month\', CURRENT_DATE)')
        notas_mes_pasado = cur.fetchone()["count"]
        
        # 9. Total Carpetas
        cur.execute('SELECT COUNT(*) as count FROM public."Carpetas"')
        total_carpetas = cur.fetchone()["count"]
        
        # 10. Notas en Papelera
        cur.execute('SELECT COUNT(*) as count FROM public."Notas" WHERE LOWER("Estado") = \'papelera\'')
        notas_papelera = cur.fetchone()["count"]
        
        # 11. Total compras acumuladas (suma de Veces_premium)
        cur.execute('SELECT COALESCE(SUM("Veces_premium"), 0) as count FROM public."Cuentas"')
        total_compras = cur.fetchone()["count"]
        
        cerrar_db(cur, conexion)
        
        return jsonify({
            "total_registrados": total_registrados,
            "premium": premium,
            "gratis": gratis,
            "activos": activos,
            "ingresos": ingresos,
            "notas_creadas": notas_creadas,
            "notas_este_mes": notas_este_mes,
            "notas_mes_pasado": notas_mes_pasado,
            "total_carpetas": total_carpetas,
            "notas_papelera": notas_papelera,
            "total_compras": total_compras
        })
    except Exception as e:
        print(f"Error en api_admin_estadisticas: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/admin/usuarios")
@limiter.exempt
@login_required
def api_admin_usuarios():
    """Obtiene la lista completa de usuarios registrados."""
    user_id = session.get("usuario_id")
    conexion = conectar_db(dict_cursor=True)
    if not conexion:
        return jsonify({"error": "Error de conexión a la base de datos"}), 500

    try:
        cur = conexion.cursor()
        
        # Validar si el usuario tiene privilegios
        cur.execute('SELECT "Es_admin" FROM public."Cuentas" WHERE "ID_Cuenta" = %s', (user_id,))
        res = cur.fetchone()
        if not res or not res.get("Es_admin", False):
            cerrar_db(cur, conexion)
            return jsonify({"error": "No autorizado"}), 403

        cur.execute("""
            SELECT "ID_Cuenta", "Usuario", "Contraseña", "Nombres", "Apellidos", "Telefono", "Correo", "Foto", "Es_premium", "Plan_premium", "Es_admin", "Avatar_plan"
            FROM public."Cuentas"
            ORDER BY "ID_Cuenta" ASC
        """)
        usuarios = cur.fetchall()
        
        # Formatear números a string para evitar desbordamiento en JS
        for u in usuarios:
            u["Telefono"] = str(u["Telefono"]) if u.get("Telefono") else ""
            
        cerrar_db(cur, conexion)
        response = jsonify(usuarios)
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        return response
    except Exception as e:
        print(f"Error en api_admin_usuarios: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/admin/usuarios/<int:target_user_id>/detalles")
@limiter.exempt
@login_required
def api_admin_usuario_detalles(target_user_id):
    """Obtiene los detalles de un usuario, todas sus notas y carpetas en tiempo real."""
    user_id = session.get("usuario_id")
    conexion = conectar_db(dict_cursor=True)
    if not conexion:
        return jsonify({"error": "Error de conexión a la base de datos"}), 500

    try:
        cur = conexion.cursor()
        
        # Validar si el usuario logueado es admin
        cur.execute('SELECT "Es_admin" FROM public."Cuentas" WHERE "ID_Cuenta" = %s', (user_id,))
        res = cur.fetchone()
        if not res or not res.get("Es_admin", False):
            cerrar_db(cur, conexion)
            return jsonify({"error": "No autorizado"}), 403
            
        # 1. Obtener datos de la cuenta
        cur.execute("""
            SELECT "ID_Cuenta", "Usuario", "Nombres", "Apellidos", "Telefono", "Correo", "Foto", "Es_premium", "Plan_premium", "Es_admin", "Avatar_plan"
            FROM public."Cuentas"
            WHERE "ID_Cuenta" = %s
        """, (target_user_id,))
        usuario = cur.fetchone()
        
        if not usuario:
            cerrar_db(cur, conexion)
            return jsonify({"error": "Usuario no encontrado"}), 404
            
        usuario["Telefono"] = str(usuario["Telefono"]) if usuario.get("Telefono") else ""
        
        # 2. Obtener todas las notas del usuario (con nombre de carpeta correcto en PostgreSQL)
        cur.execute("""
            SELECT 
                n."ID_Nota", 
                n."Titulo", 
                n."Contenido", 
                n."Fecha_decreacion", 
                n."Fecha_deedicion", 
                n."Formato",
                c."Nombre_carpeta" as "Nombre_Carpeta"
            FROM public."Notas" n
            LEFT JOIN public."Carpetas" c ON n."ID_Carpeta" = c."ID_Carpeta"
            WHERE n."ID_Cuenta" = %s AND n."Estado" = 'Activa'
            ORDER BY n."Fecha_deedicion" DESC
        """, (target_user_id,))
        notas = cur.fetchall()
        
        # Obtener todos los adjuntos de las notas de este usuario
        if notas:
            ids_notas = [n["ID_Nota"] for n in notas]
            cur.execute("""
                SELECT "ID_Nota", "ID_Adjunto", "Nombre_archivo", "Formato", "Ruta_archivo"
                FROM public."Adjuntos"
                WHERE "ID_Nota" = ANY(%s)
            """, (ids_notas,))
            adjuntos_all = cur.fetchall()
        else:
            adjuntos_all = []

        # Agrupar adjuntos por ID_Nota
        adjuntos_por_nota = {}
        for adj in adjuntos_all:
            id_nota = adj["ID_Nota"]
            if id_nota not in adjuntos_por_nota:
                adjuntos_por_nota[id_nota] = []
            
            fmt = (adj["Formato"] or "").lower().strip(".")
            TIPOS_IMAGEN = {'png','jpg','jpeg','gif','webp','svg','pntg','wmf'}
            TIPOS_AUDIO  = {'mp3','aac','ogg','wav','flac','wma','m4a','webm'}
            TIPOS_VIDEO  = {'mp4','mkv','wmv','mov','avi'}
            if fmt in TIPOS_IMAGEN:   tipo = "imagen"
            elif fmt in TIPOS_AUDIO:  tipo = "audio"
            elif fmt in TIPOS_VIDEO:  tipo = "video"
            else:                     tipo = "otro"

            adjuntos_por_nota[id_nota].append({
                "id":      adj["ID_Adjunto"],
                "nombre":  adj["Nombre_archivo"],
                "formato": fmt,
                "ruta":    adj["Ruta_archivo"],
                "tipo":    tipo
            })
            
        # Construir notas como dicts planos con adjuntos incluidos
        TIPOS_IMAGEN = {'png','jpg','jpeg','gif','webp','svg','pntg','wmf'}
        TIPOS_AUDIO  = {'mp3','aac','ogg','wav','flac','wma','m4a','webm'}
        TIPOS_VIDEO  = {'mp4','mkv','wmv','mov','avi'}

        notas_serializadas = []
        for nota in notas:
            id_nota = nota["ID_Nota"]
            adj_list = adjuntos_por_nota.get(id_nota, [])

            contenido = nota.get("Contenido") or ""
            # Para formatos de un solo archivo, usar la ruta del adjunto como contenido si está vacío
            if nota.get("Formato") in ["audio", "video", "dibujo", "imagen"] and not contenido and adj_list:
                contenido = adj_list[0]["ruta"] or ""

            notas_serializadas.append({
                "ID_Nota":        id_nota,
                "Titulo":         nota.get("Titulo") or "",
                "Contenido":      contenido,
                "Formato":        nota.get("Formato") or "texto",
                "Nombre_Carpeta": nota.get("Nombre_Carpeta"),
                "Fecha_decreacion": nota["Fecha_decreacion"].strftime("%d/%m/%Y %H:%M") if nota.get("Fecha_decreacion") else "",
                "Fecha_deedicion":  nota["Fecha_deedicion"].strftime("%d/%m/%Y %H:%M")  if nota.get("Fecha_deedicion")  else "",
                "adjuntos": adj_list,
            })

        # 3. Obtener todas las carpetas del usuario
        cur.execute("""
            SELECT "ID_Carpeta", "Nombre_carpeta", "Fecha_creacion"
            FROM public."Carpetas"
            WHERE "ID_Cuenta" = %s AND "Estado" = 'Activa'
            ORDER BY "Fecha_creacion" DESC
        """, (target_user_id,))
        carpetas_raw = cur.fetchall()

        carpetas_serializadas = []
        for carp in carpetas_raw:
            carpetas_serializadas.append({
                "ID_Carpeta":    carp["ID_Carpeta"],
                "Nombre":        carp.get("Nombre_carpeta") or "",
                "Fecha_creacion": carp["Fecha_creacion"].strftime("%d/%m/%Y %H:%M") if carp.get("Fecha_creacion") else "",
            })

        cerrar_db(cur, conexion)

        return jsonify({
            "usuario": dict(usuario),
            "notes":   notas_serializadas,
            "carpetas": carpetas_serializadas,
        })
    except Exception as e:
        print(f"Error en api_admin_usuario_detalles: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/admin/usuarios/<int:target_user_id>/toggle-admin", methods=["POST"])
@login_required
def api_admin_toggle_admin(target_user_id):
    """Permite a los administradores otorgar/quitar privilegios de panel de control a otros usuarios."""
    if not es_admin(session.get("usuario_id")):
        return jsonify({"error": "No autorizado para cambiar privilegios administrativos"}), 403

    if target_user_id == 1:
        return jsonify({"error": "El Administrador Principal no puede ser modificado"}), 400

    conexion = conectar_db(dict_cursor=True)
    if not conexion:
        return jsonify({"error": "Error de conexión a la base de datos"}), 500

    try:
        cur = conexion.cursor()
        
        # Consultar estado actual
        cur.execute('SELECT "Es_admin" FROM public."Cuentas" WHERE "ID_Cuenta" = %s', (target_user_id,))
        user = cur.fetchone()
        if not user:
            cerrar_db(cur, conexion)
            return jsonify({"error": "Usuario no encontrado"}), 404
            
        nuevo_estado = not user.get("Es_admin", False)
        
        # Actualizar rol de admin y resetear/asignar el avatar cósmico
        if nuevo_estado:
            # Si se le da admin, asignarle automáticamente el marco cósmico
            cur.execute('UPDATE public."Cuentas" SET "Es_admin" = %s, "Avatar_plan" = %s WHERE "ID_Cuenta" = %s', (nuevo_estado, 'cosmico', target_user_id))
        else:
            # Si se le quita admin, regresarlo a su marco según su plan premium, o a ninguno si es gratis
            cur.execute('''
                UPDATE public."Cuentas" 
                SET "Es_admin" = %s,
                    "Avatar_plan" = CASE 
                        WHEN "Plan_premium" IN (\'quincenal\', \'mensual\', \'anual\') THEN "Plan_premium"
                        ELSE \'ninguno\'
                    END
                WHERE "ID_Cuenta" = %s
            ''', (nuevo_estado, target_user_id))
        
        conexion.commit()
        
        cerrar_db(cur, conexion)
        return jsonify({
            "success": True,
            "es_admin": nuevo_estado,
            "message": f"Acceso al panel {'otorgado' if nuevo_estado else 'revocado'} correctamente."
        })
    except Exception as e:
        print(f"Error en api_admin_toggle_admin: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/admin/usuarios/eliminar/<int:target_user_id>", methods=["POST"])
@login_required
def api_admin_eliminar_usuario(target_user_id):
    """Elimina permanentemente la cuenta de un usuario y todos sus datos en cascada."""
    if not es_admin(session.get("usuario_id")):
        return jsonify({"error": "No autorizado"}), 403

    if target_user_id == 1:
        return jsonify({"error": "No es posible eliminar la cuenta del Administrador principal"}), 400

    conexion = conectar_db(dict_cursor=True)
    if not conexion:
        return jsonify({"error": "Error de conexión a la base de datos"}), 500

    cursor = None
    try:
        cursor = conexion.cursor()

        # 1. Obtener notas del usuario
        cursor.execute('SELECT "ID_Nota" FROM public."Notas" WHERE "ID_Cuenta" = %s', (target_user_id,))
        notas = cursor.fetchall()
        ids_notas = [n["ID_Nota"] for n in notas]

        if ids_notas:
            # 2. Obtener adjuntos de las notas del usuario y eliminarlos de Supabase Storage
            cursor.execute('SELECT "Ruta_archivo" FROM public."Adjuntos" WHERE "ID_Nota" = ANY(%s)', (ids_notas,))
            adjuntos = cursor.fetchall()
            for adj in adjuntos:
                ruta = adj["Ruta_archivo"]
                if ruta:
                    eliminar_archivo_de_supabase_por_ruta(ruta)

            # 3. Eliminar registros de Adjuntos
            cursor.execute('DELETE FROM public."Adjuntos" WHERE "ID_Nota" = ANY(%s)', (ids_notas,))

            # 4. Eliminar etiquetas de las notas
            cursor.execute('DELETE FROM public."Notas_etiquetas" WHERE "ID_Nota" = ANY(%s)', (ids_notas,))

            # 5. Eliminar notas
            cursor.execute('DELETE FROM public."Notas" WHERE "ID_Cuenta" = %s', (target_user_id,))

        # 6. Eliminar carpetas del usuario
        cursor.execute('DELETE FROM public."Carpetas" WHERE "ID_Cuenta" = %s', (target_user_id,))

        # 7. Eliminar mensajes de soporte del usuario
        cursor.execute('DELETE FROM public."Soporte" WHERE "ID_Cuenta" = %s', (target_user_id,))

        # 8. Obtener foto de perfil y borrarla si está en Supabase Storage si ningún otro usuario la usa
        cursor.execute('SELECT "Foto" FROM public."Cuentas" WHERE "ID_Cuenta" = %s', (target_user_id,))
        cuenta = cursor.fetchone()
        if cuenta and cuenta.get("Foto"):
            foto_path = cuenta["Foto"]
            if foto_path and "/storage/v1/object/public/NoteFlow/" in foto_path:
                cursor.execute('SELECT COUNT(*) AS total FROM public."Cuentas" WHERE "Foto" = %s', (foto_path,))
                en_uso = cursor.fetchone()["total"] > 1
                if not en_uso:
                    eliminar_archivo_de_supabase_por_ruta(foto_path)

        # 9. Eliminar cuenta
        cursor.execute('DELETE FROM public."Cuentas" WHERE "ID_Cuenta" = %s', (target_user_id,))

        conexion.commit()
        print(f"Cuenta de usuario {target_user_id} y todos sus datos en cascada eliminados correctamente.")
        return jsonify({"success": True, "mensaje": "Cuenta de usuario eliminada exitosamente"})

    except Exception as e:
        if conexion:
            conexion.rollback()
        print(f"Error al eliminar usuario {target_user_id}: {e}")
        return jsonify({"error": f"Error interno: {str(e)}"}), 500
    finally:
        cerrar_db(cursor, conexion)


def init_indexes():
    """Crea índices para optimizar las consultas de notas, carpetas y soporte en la base de datos."""
    conexion = conectar_db()
    if conexion:
        try:
            cur = conexion.cursor()
            # Índices para la tabla Soporte
            cur.execute('CREATE INDEX IF NOT EXISTS "idx_soporte_id_cuenta" ON public."Soporte" ("ID_Cuenta");')
            cur.execute('CREATE INDEX IF NOT EXISTS "idx_soporte_fecha" ON public."Soporte" ("Fecha");')
            
            # Índices para la tabla Notas
            cur.execute('CREATE INDEX IF NOT EXISTS "idx_notas_id_cuenta" ON public."Notas" ("ID_Cuenta");')
            cur.execute('CREATE INDEX IF NOT EXISTS "idx_notas_estado" ON public."Notas" ("Estado");')
            
            # Índices para la tabla Carpetas
            cur.execute('CREATE INDEX IF NOT EXISTS "idx_carpetas_id_cuenta" ON public."Carpetas" ("ID_Cuenta");')
            cur.execute('CREATE INDEX IF NOT EXISTS "idx_carpetas_estado" ON public."Carpetas" ("Estado");')
            
            conexion.commit()
            print("Database indexes checked and created successfully.")
        except Exception as e:
            print(f"Error al inicializar índices: {e}")
        finally:
            cerrar_db(cur, conexion)


# ==============================================================================
# TAREA PROGRAMADA — Correo de aviso 7 días antes del vencimiento del plan
# ==============================================================================

def verificar_vencimientos_plan():
    """
    Revisa diariamente si algún usuario premium vence en exactamente 7 días
    y le envía un correo de aviso para que renueve su plan.
    """
    print("[Scheduler] Verificando vencimientos de planes...")
    conexion = None
    cursor = None
    try:
        conexion = conectar_db(dict_cursor=True)
        if not conexion:
            print("[Scheduler] Error: no se pudo conectar a la BD.")
            return
        cursor = conexion.cursor()

        # Buscar usuarios cuyo plan vence entre 6 días 23h y 7 días 1h desde ahora
        cursor.execute("""
            SELECT "ID_Cuenta", "Nombres", "Correo", "Plan_premium", "Premium_vence"
            FROM public."Cuentas"
            WHERE "Es_premium" = TRUE
              AND "Premium_vence" BETWEEN NOW() + INTERVAL '6 days 22 hours'
                                       AND NOW() + INTERVAL '7 days 2 hours'
        """)
        usuarios_por_vencer = cursor.fetchall()

        print(f"[Scheduler] Usuarios con plan por vencer en 7 días: {len(usuarios_por_vencer)}")

        for u in usuarios_por_vencer:
            nombre   = u.get("Nombres", "Usuario")
            correo   = u.get("Correo")
            plan     = (u.get("Plan_premium") or "premium").capitalize()
            vence    = u.get("Premium_vence")
            fecha_str = vence.strftime("%d de %B de %Y") if vence else "pronto"

            if not correo:
                continue

            cuerpo = f"""
            <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px;">
                Hola <strong>{nombre}</strong>, 👋
            </p>
            <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px;">
                Queremos recordarte que tu plan <strong>{plan}</strong> en NoteFlow
                vencerá el <strong>{fecha_str}</strong>, es decir, en aproximadamente <strong>7 días</strong>.
            </p>
            <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 24px;">
                Para seguir disfrutando de todas las funciones premium sin interrupciones,
                renueva tu plan desde el dashboard.
            </p>
            <div style="text-align:center;margin:0 0 24px;">
                <a href="https://noteflow.com/dashboard"
                   style="background:linear-gradient(135deg,#4f46e5,#7c3aed);
                          color:#fff;text-decoration:none;padding:14px 32px;
                          border-radius:8px;font-weight:700;font-size:15px;
                          display:inline-block;">
                    🔄 Renovar mi plan
                </a>
            </div>
            <p style="color:#6b7280;font-size:13px;margin:0;">
                Si ya realizaste tu renovación, puedes ignorar este mensaje.
            </p>
            """

            html_body = construir_email_html("⏰ Tu plan vence en 7 días", cuerpo)

            try:
                msg = Message(
                    subject="⏰ Tu plan NoteFlow vence pronto",
                    recipients=[correo],
                    html=html_body,
                    sender=app.config.get("MAIL_DEFAULT_SENDER", "NoteFlow <no-reply@noteflow.com>")
                )
                t = threading.Thread(target=enviar_correo_asincrono, args=(app, msg))
                t.daemon = True
                t.start()
                print(f"[Scheduler] Correo de aviso enviado a {correo}")
            except Exception as e_mail:
                print(f"[Scheduler] Error al enviar correo a {correo}: {e_mail}")

    except Exception as e:
        print(f"[Scheduler] Error en verificar_vencimientos_plan: {e}")
    finally:
        if cursor and conexion:
            cerrar_db(cursor, conexion)


# Iniciar el scheduler solo una vez (evitar duplicados con el reloader de Flask)
_scheduler_iniciado = False

def iniciar_scheduler():
    global _scheduler_iniciado
    if _scheduler_iniciado:
        return
    _scheduler_iniciado = True
    scheduler = BackgroundScheduler(timezone="UTC")
    # Ejecutar todos los días a las 9:00 AM UTC
    scheduler.add_job(verificar_vencimientos_plan, CronTrigger(hour=9, minute=0))
    scheduler.start()
    print("[Scheduler] Programador de vencimientos iniciado — verifica diariamente a las 09:00 UTC.")


# Arrancar el scheduler con el servidor
with app.app_context():
    init_indexes()
    iniciar_scheduler()


if __name__ == "__main__":
    app.run(port=5000)