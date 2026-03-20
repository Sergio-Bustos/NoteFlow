# -*- coding: utf-8 -*-

# ==============================================================================
# IMPORTACIONES
# ==============================================================================
from flask import Flask, jsonify, render_template, request, redirect, url_for, session
from flask_mail import Mail, Message
import psycopg2
from psycopg2.extras import RealDictCursor
from google_auth_oauthlib.flow import Flow
from functools import wraps
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv
from datetime import datetime, timedelta
import requests
import os
import uuid as _uuid
import secrets
import re
import random

load_dotenv()

# ==============================================================================
# CONFIGURACIÓN — OAuth, Flask, Base de datos y Correo
# ==============================================================================

# OAuth (desarrollo en HTTP local)
os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"
GOOGLE_CLIENT_ID     = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI  = os.getenv("GOOGLE_REDIRECT_URI")

# Flask
app = Flask(__name__)
app.secret_key          = os.getenv("FLASK_SECRET_KEY", "tu_clave_secreta_aqui_cambiala")
app.static_folder       = "static"
app.static_url_path     = "/static"
app.config["MAX_CONTENT_LENGTH"] = 2 * 1024 * 1024 * 1024  # 2 GB — necesario para subir videos

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

# ==============================================================================
# UTILIDADES Y DECORADORES
# ==============================================================================

def conectar_db(dict_cursor=False):
    """Crea y devuelve una conexión a PostgreSQL."""
    try:
        cursor_factory = RealDictCursor if dict_cursor else None
        conexion = psycopg2.connect(cursor_factory=cursor_factory, **DB_CONFIG)
        conexion.set_client_encoding("UTF8")
        return conexion
    except psycopg2.Error as e:
        print(f"ERROR DE CONEXIÓN A POSTGRESQL: {e}")
        return None


def cerrar_db(cursor, conexion):
    """Cierra el cursor y la conexión a la base de datos."""
    if cursor:
        cursor.close()
    if conexion:
        conexion.close()


def verificar_sesion():
    """Verifica si hay sesión activa. Retorna redirección si no la hay."""
    if "usuario_id" not in session:
        return redirect(url_for("mostrar_login"))
    return None


def login_required(f):
    """Decorador que requiere sesión activa para acceder a la ruta."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "usuario_id" not in session:
            return redirect(url_for("mostrar_login"))
        return f(*args, **kwargs)
    return decorated_function


def limpiar_datos_formulario(datos, campos):
    """Limpia y retorna un diccionario con los campos del formulario."""
    return {campo: datos.get(campo, "").strip() for campo in campos}


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

        msg      = Message(subject="Tu código de verificación NoteFlow", recipients=[correo])
        msg.body = (
            f"Hola {nombres},\n\n"
            f"Tu código de verificación para NoteFlow es:\n\n"
            f"    {codigo}\n\n"
            f"Este código expira en 15 minutos.\n\n"
            f"Si no fuiste tú, ignora este correo.\n\n"
            f"Equipo NoteFlow"
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
    msg.body = (
        f"Hola {pendiente['nombres']},\n\n"
        f"Tu nuevo código de verificación para NoteFlow es:\n\n"
        f"    {codigo}\n\n"
        f"Este código expira en 15 minutos.\n\n"
        f"Si no fuiste tú, ignora este correo.\n\n"
        f"Equipo NoteFlow"
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
def procesar_login():
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
            session["usuario_id"]     = cuenta["ID_Cuenta"]
            session["usuario_nombre"] = cuenta["Usuario"]
            return jsonify({"success": True, "mensaje": "Inicio de sesión exitoso", "redirect": "/dashboard"}), 200

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
    """Crea y retorna el objeto Flow de Google OAuth configurado."""
    client_config = {
        "web": {
            "client_id":                   os.getenv("GOOGLE_CLIENT_ID"),
            "project_id":                  "note-flow",
            "auth_uri":                    "https://accounts.google.com/o/oauth2/auth",
            "token_uri":                   "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "client_secret":               os.getenv("GOOGLE_CLIENT_SECRET"),
            "redirect_uris":               [os.getenv("GOOGLE_REDIRECT_URI")],
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
        redirect_uri=os.getenv("GOOGLE_REDIRECT_URI"), **kwargs
    )


@app.route("/google/login")
def google_login():
    """Redirige al proveedor de Google para autenticación."""
    flow = _google_flow()
    authorization_url, state = flow.authorization_url(
        access_type="offline", include_granted_scopes="true", prompt="consent"
    )
    session["state"] = state
    return redirect(authorization_url)


@app.route("/google/callback")
def google_callback():
    """Procesa la respuesta de Google y abre la sesión si el correo está registrado."""
    flow = _google_flow(state=session.get("state"))
    flow.fetch_token(authorization_response=request.url)

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
        cursor.execute('SELECT "ID_Cuenta" FROM public."Cuentas" WHERE "Correo" = %s', (email,))
        row = cursor.fetchone()

        if not row:
            return redirect(url_for("cuenta_no_registrada"))

        session["usuario_id"]     = int(row[0])
        session["usuario_nombre"] = user_info.get("name") or email
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
        msg       = Message("Restablecimiento de Contraseña NoteFlow", recipients=[correo])
        msg.body  = (
            f"Hola {usuario_nombre},\n\n"
            f"Has solicitado restablecer tu contraseña para NoteFlow.\n\n"
            f"Haz clic en el siguiente enlace para completar el proceso:\n\n"
            f"{reset_url}\n\n"
            f"Este enlace expirará en 1 hora.\n\n"
            f"Si no solicitaste este cambio, ignora este correo.\n\n"
            f"Equipo NoteFlow"
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

        return jsonify({
            "success": True,
            "mensaje":  "Contraseña restablecida con éxito. Redirigiendo a Iniciar Sesión.",
            "redirect": url_for("mostrar_login"),
        }), 200

    except Exception as e:
        if conexion:
            conexion.rollback()
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
    session.clear()
    return redirect(url_for("inicio"))


@app.route("/perfil/cerrar-sesion")
@login_required
def cerrar_sesion_perfil():
    """Cierra la sesión desde la página de perfil y redirige al login."""
    session.clear()
    return redirect(url_for("mostrar_login"))
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
                   "Foto"
            FROM public."Cuentas"
            WHERE "ID_Cuenta" = %s
        """, (user_id,))
        usuario_row = cursor.fetchone()

        if not usuario_row:
            session.clear()
            return redirect(url_for("mostrar_login"))

        usuario = {
            "Nombres":         usuario_row.get("Nombres"),
            "Color_principal": usuario_row.get("Color_principal") or "Blanco",
            "Foto":            usuario_row.get("Foto") or "default_profile.png",
        }

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
            SELECT "ID_Nota", "Titulo", "Descripcion", "Fecha_deedicion"
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
                "Etiquetas":      obtener_etiquetas_nota(nota_id, cursor),
                "Has_Adjuntos":   verificar_adjuntos_nota(nota_id, cursor),
            })

        return render_template(
            "dashboard.html",
            usuario=usuario,
            total_notas=total_notas,
            total_carpetas=total_carpetas,
            notas_papelera=notas_papelera,
            notas_recientes=notas_recientes,
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
        cursor.execute("""
            SELECT "ID_Cuenta", "Usuario", "Nombres", "Apellidos",
                   "Correo", "Telefono", "Foto", "Color_principal"
            FROM public."Cuentas"
            WHERE "ID_Cuenta" = %s
        """, (user_id,))
        usuario = cursor.fetchone()

        if not usuario:
            session.clear()
            return redirect(url_for("mostrar_login"))

        return render_template("perfil.html", usuario=usuario)

    except Exception as e:
        print(f"Error al cargar perfil: {e}")
        return "Error al cargar el perfil", 500

    finally:
        cerrar_db(cursor, conexion)


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

    user_id = session["usuario_id"]
    conexion = None
    cursor   = None

    try:
        ext              = os.path.splitext(archivo.filename)[1].lower()
        filename         = f"user_{user_id}_{_uuid.uuid4().hex}{ext}"
        ruta_completa    = os.path.join(PROFILE_UPLOAD_FOLDER, filename)
        archivo.save(ruta_completa)
        ruta_db          = f"uploads/profile/{filename}"

        conexion = conectar_db()
        cursor   = conexion.cursor()
        cursor.execute('SELECT "Foto" FROM public."Cuentas" WHERE "ID_Cuenta" = %s', (user_id,))
        result       = cursor.fetchone()
        foto_anterior = result[0] if result else None

        cursor.execute('UPDATE public."Cuentas" SET "Foto" = %s WHERE "ID_Cuenta" = %s', (ruta_db, user_id))
        conexion.commit()

        if foto_anterior and foto_anterior != "uploads/profile/default_profile.png":
            try:
                ruta_ant = os.path.join(BASE_DIR, "static", foto_anterior)
                if os.path.exists(ruta_ant):
                    os.remove(ruta_ant)
            except Exception as e:
                print(f"No se pudo eliminar foto anterior: {e}")

        return jsonify({
            "success":   True,
            "mensaje":   "Foto de perfil actualizada",
            "nueva_foto": url_for("static", filename=ruta_db),
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
    borra el archivo físico del servidor y pone NULL en la base de datos.
    """
    user_id  = session["usuario_id"]
    conexion = None
    cursor   = None

    try:
        conexion = conectar_db()
        if conexion is None:
            return jsonify({"error": "Error de conexión a la base de datos"}), 500

        cursor = conexion.cursor()
        cursor.execute('SELECT "Foto" FROM public."Cuentas" WHERE "ID_Cuenta" = %s', (user_id,))
        row = cursor.fetchone()
        if not row:
            return jsonify({"error": "Usuario no encontrado"}), 404

        foto_actual    = row[0] if row else None
        fotos_default  = {None, "", "img/default_profile.png", "uploads/profile/default_profile.png"}

        if foto_actual and foto_actual not in fotos_default:
            ruta_fisica = os.path.join(BASE_DIR, "static", foto_actual)
            try:
                if os.path.exists(ruta_fisica):
                    os.remove(ruta_fisica)
                    print(f"Foto eliminada del servidor: {ruta_fisica}")
            except Exception as e:
                print(f"No se pudo eliminar el archivo físico: {e}")

        cursor.execute('UPDATE public."Cuentas" SET "Foto" = NULL WHERE "ID_Cuenta" = %s', (user_id,))
        conexion.commit()

        return jsonify({
            "success":      True,
            "mensaje":      "Foto de perfil eliminada correctamente",
            "foto_default": url_for("static", filename="img/default_profile.png"),
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
            SELECT "Nombres", "Foto", "Color_principal"
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
            SELECT "Nombres", "Foto", "Color_principal"
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
            for fila in notas_vencidas:
                ruta = fila.get("Ruta_archivo") if isinstance(fila, dict) else fila[1]
                if ruta:
                    ruta_completa = os.path.join(BASE_DIR, "static", ruta)
                    try:
                        if os.path.exists(ruta_completa):
                            os.remove(ruta_completa)
                    except Exception as e:
                        print(f"No se pudo eliminar archivo {ruta_completa}: {e}")

            ids_vencidos = list({
                fila.get("ID_Nota") if isinstance(fila, dict) else fila[0]
                for fila in notas_vencidas
            })
            cursor.execute('DELETE FROM public."Adjuntos"        WHERE "ID_Nota" = ANY(%s)', (ids_vencidos,))
            cursor.execute('DELETE FROM public."Notas_etiquetas" WHERE "ID_Nota" = ANY(%s)', (ids_vencidos,))
            cursor.execute("""
                DELETE FROM public."Notas"
                WHERE "ID_Cuenta" = %s AND LOWER("Estado") = 'papelera'
                  AND "Fecha_deedicion" <= (CURRENT_TIMESTAMP - INTERVAL '30 days')
            """, (user_id,))
            conexion.commit()

        cursor.execute("""
            SELECT "ID_Nota", "Titulo", "Descripcion",
                   "Fecha_deedicion", "Fecha_decreacion", "Formato"
            FROM public."Notas"
            WHERE "ID_Cuenta" = %s AND LOWER("Estado") = 'papelera'
            ORDER BY "Fecha_deedicion" DESC NULLS LAST
        """, (user_id,))
        notas_papelera = cursor.fetchall()

        return render_template(
            "papelera.html",
            notas_papelera=notas_papelera,
            usuario=usuario,
            now=datetime.now(),
            timedelta=timedelta,
        )

    except Exception as e:
        import traceback; traceback.print_exc()
        return f"Error al cargar la papelera: {str(e)}", 500

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

        cursor.execute('SELECT "Ruta_archivo" FROM public."Adjuntos" WHERE "ID_Nota" = %s', (nota_id,))
        for adj in cursor.fetchall():
            ruta = adj.get("Ruta_archivo") if isinstance(adj, dict) else adj[0]
            if ruta:
                ruta_completa = os.path.join(BASE_DIR, "static", ruta)
                try:
                    if os.path.exists(ruta_completa):
                        os.remove(ruta_completa)
                except Exception as e:
                    print(f"No se pudo eliminar archivo {ruta_completa}: {e}")

        cursor.execute('DELETE FROM public."Adjuntos"        WHERE "ID_Nota" = %s', (nota_id,))
        cursor.execute('DELETE FROM public."Notas_etiquetas" WHERE "ID_Nota" = %s', (nota_id,))
        cursor.execute('DELETE FROM public."Notas" WHERE "ID_Nota" = %s AND "ID_Cuenta" = %s', (nota_id, user_id))
        conexion.commit()

        return jsonify({"success": True, "mensaje": "Nota eliminada definitivamente"}), 200

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
    """Elimina permanentemente TODAS las notas en papelera del usuario."""
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
            WHERE "ID_Cuenta" = %s AND LOWER("Estado") = 'papelera'
        """, (user_id,))
        ids = [f["ID_Nota"] if isinstance(f, dict) else f[0] for f in cursor.fetchall()]

        if not ids:
            return jsonify({"success": True, "mensaje": "La papelera ya estaba vacía"}), 200

        cursor.execute('SELECT "Ruta_archivo" FROM public."Adjuntos" WHERE "ID_Nota" = ANY(%s)', (ids,))
        for adj in cursor.fetchall():
            ruta = adj.get("Ruta_archivo") if isinstance(adj, dict) else adj[0]
            if ruta:
                ruta_completa = os.path.join(BASE_DIR, "static", ruta)
                try:
                    if os.path.exists(ruta_completa):
                        os.remove(ruta_completa)
                except Exception as e:
                    print(f"No se pudo eliminar archivo {ruta_completa}: {e}")

        cursor.execute('DELETE FROM public."Adjuntos"        WHERE "ID_Nota" = ANY(%s)', (ids,))
        cursor.execute('DELETE FROM public."Notas_etiquetas" WHERE "ID_Nota" = ANY(%s)', (ids,))
        cursor.execute("""
            DELETE FROM public."Notas"
            WHERE "ID_Cuenta" = %s AND LOWER("Estado") = 'papelera'
        """, (user_id,))
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
# 11. CREAR NOTAS — Vistas de los editores
# ==============================================================================

@app.route("/crear-nota")
@login_required
def crear_nota():
    """Página genérica de creación de nota (en desarrollo)."""
    return render_template("fasededesarrollo.html")


@app.route("/crear-nota-texto")
@login_required
def crear_nota_texto():
    """Editor de notas de texto enriquecido."""
    return render_template("editortexto.html")


@app.route("/crear-nota-imagen")
@login_required
def crear_nota_imagen():
    """Editor de notas de imagen."""
    return render_template("editorimagen.html")


@app.route("/bloc-dibujo")
@login_required
def bloc_dibujo():
    """Bloc de dibujo libre."""
    return render_template("dibujo.html")


@app.route("/crear-nota-audio")
@login_required
def crear_nota_audio():
    """Editor de notas de audio."""
    return render_template("editoraudio.html")


@app.route("/crear-nota-video")
@login_required
def crear_nota_video():
    """Editor de notas de video."""
    return render_template("editorvideo.html")


@app.route("/crear-nota-mixta")
@login_required
def crear_nota_mixta():
    """Editor de notas mixtas (texto + archivos multimedia)."""
    return render_template("editormixta.html")


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
        titulo        = request.form.get("titulo",      "").strip() or "Nota sin título"
        descripcion   = request.form.get("descripcion", "").strip() or f"Nota de texto: {titulo}"
        contenido     = request.form.get("contenido",   "").strip()
        etiquetas_raw = request.form.get("etiquetas",   "").strip()

        if not contenido:
            return jsonify({"error": "El contenido de la nota está vacío"}), 400

        conexion = conectar_db()
        if conexion is None:
            return jsonify({"error": "Error de conexión a la base de datos"}), 500

        cursor = conexion.cursor()
        hoy    = datetime.now()

        cursor.execute('SELECT COALESCE(MAX("ID_Nota"), 0) + 1 FROM public."Notas"')
        nuevo_id = cursor.fetchone()[0]

        cursor.execute("""
            INSERT INTO public."Notas"
                ("ID_Nota", "Titulo", "Descripcion", "Contenido",
                 "Fecha_decreacion", "Fecha_deedicion", "Estado", "Formato", "ID_Cuenta", "ID_Carpeta")
            VALUES (%s, %s, %s, %s, %s, %s, 'Activa', 'texto', %s, NULL)
            RETURNING "ID_Nota"
        """, (nuevo_id, titulo, descripcion, contenido, hoy, hoy, user_id))
        nota_id = cursor.fetchone()[0]

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


# ==============================================================================
# 13. GUARDAR NOTA DE IMAGEN
#     Guarda el archivo PNG/JPG procesado por el editor de canvas.
# ==============================================================================

@app.route("/guardar-nota-imagen", methods=["POST"])
@login_required
def guardar_nota_imagen():
    """
    Recibe la imagen editada (PNG/JPG) y crea una nota de tipo imagen en la BD.

    Campos:
        titulo      — str (opcional)
        descripcion — str (opcional)
        etiquetas   — str separadas por coma (opcional)
        imagen      — File (PNG, JPG, JPEG, WEBP)
    """
    user_id  = session["usuario_id"]
    conexion = None
    cursor   = None
    try:
        titulo        = request.form.get("titulo",      "").strip() or "Imagen sin título"
        descripcion   = request.form.get("descripcion", "").strip() or f"Nota de imagen: {titulo}"
        etiquetas_raw = request.form.get("etiquetas",   "").strip()

        archivo = request.files.get("imagen")
        if not archivo or archivo.filename == "":
            return jsonify({"error": "No se recibió ninguna imagen"}), 400

        ext = os.path.splitext(archivo.filename)[1].lower()
        if ext not in {".png", ".jpg", ".jpeg", ".webp"}:
            return jsonify({"error": "Formato de imagen no permitido"}), 400

        filename      = f"imagen_{user_id}_{_uuid.uuid4().hex}{ext}"
        ruta_completa = os.path.join(IMAGEN_UPLOAD_FOLDER, filename)
        archivo.save(ruta_completa)
        ruta_db       = f"uploads/imagenes/{filename}"

        conexion = conectar_db()
        if conexion is None:
            return jsonify({"error": "Error de conexión a la base de datos"}), 500

        cursor = conexion.cursor()
        hoy    = datetime.now()

        cursor.execute('SELECT COALESCE(MAX("ID_Nota"), 0) + 1 FROM public."Notas"')
        nuevo_id = cursor.fetchone()[0]

        cursor.execute("""
            INSERT INTO public."Notas"
                ("ID_Nota", "Titulo", "Descripcion", "Contenido",
                 "Fecha_decreacion", "Fecha_deedicion", "Estado", "Formato", "ID_Cuenta", "ID_Carpeta")
            VALUES (%s, %s, %s, %s, %s, %s, 'Activa', 'imagen', %s, NULL)
            RETURNING "ID_Nota"
        """, (nuevo_id, titulo, descripcion, "", hoy, hoy, user_id))
        nota_id = cursor.fetchone()[0]

        cursor.execute('SELECT COALESCE(MAX("ID_Adjunto"), 0) + 1 FROM public."Adjuntos"')
        nuevo_id_adj = cursor.fetchone()[0]
        cursor.execute("""
            INSERT INTO public."Adjuntos" ("ID_Adjunto", "Nombre_archivo", "Formato", "Ruta_archivo", "ID_Nota")
            VALUES (%s, %s, %s, %s, %s)
        """, (nuevo_id_adj, filename, ext.lstrip("."), ruta_db, nota_id))

        if etiquetas_raw:
            _insertar_etiquetas(etiquetas_raw, nota_id, cursor)

        conexion.commit()
        return jsonify({"success": True, "mensaje": "Nota de imagen guardada correctamente", "nota_id": nota_id, "redirect": "/notas"}), 201

    except Exception as e:
        if conexion:
            conexion.rollback()
        import traceback; traceback.print_exc()
        return jsonify({"error": "Error al guardar la nota de imagen"}), 500

    finally:
        cerrar_db(cursor, conexion)


# ==============================================================================
# 14. GUARDAR NOTA DE DIBUJO
#     Guarda la imagen exportada del bloc de dibujo.
# ==============================================================================

@app.route("/guardar-nota-dibujo", methods=["POST"])
@login_required
def guardar_nota_dibujo():
    """
    Recibe la imagen del bloc de dibujo y crea una nota de tipo dibujo en la BD.

    Campos:
        titulo      — str (opcional)
        descripcion — str (opcional)
        etiquetas   — str separadas por coma (opcional)
        imagen      — File (PNG, JPG, JPEG, WEBP)
    """
    user_id  = session["usuario_id"]
    conexion = None
    cursor   = None
    try:
        titulo        = request.form.get("titulo",      "").strip() or "Dibujo sin título"
        descripcion   = request.form.get("descripcion", "").strip() or f"Nota de dibujo: {titulo}"
        etiquetas_raw = request.form.get("etiquetas",   "").strip()

        archivo = request.files.get("imagen")
        if not archivo or archivo.filename == "":
            return jsonify({"error": "No se recibió ninguna imagen"}), 400

        ext = os.path.splitext(archivo.filename)[1].lower()
        if ext not in {".png", ".jpg", ".jpeg", ".webp"}:
            return jsonify({"error": "Formato de imagen no permitido"}), 400

        filename      = f"dibujo_{user_id}_{_uuid.uuid4().hex}{ext}"
        ruta_completa = os.path.join(DIBUJO_UPLOAD_FOLDER, filename)
        archivo.save(ruta_completa)
        ruta_db       = f"uploads/dibujos/{filename}"

        conexion = conectar_db()
        if conexion is None:
            return jsonify({"error": "Error de conexión a la base de datos"}), 500

        cursor = conexion.cursor()
        hoy    = datetime.now()

        cursor.execute('SELECT COALESCE(MAX("ID_Nota"), 0) + 1 FROM public."Notas"')
        nuevo_id = cursor.fetchone()[0]

        cursor.execute("""
            INSERT INTO public."Notas"
                ("ID_Nota", "Titulo", "Descripcion", "Contenido",
                 "Fecha_decreacion", "Fecha_deedicion", "Estado", "Formato", "ID_Cuenta", "ID_Carpeta")
            VALUES (%s, %s, %s, %s, %s, %s, 'Activa', 'dibujo', %s, NULL)
            RETURNING "ID_Nota"
        """, (nuevo_id, titulo, descripcion, "", hoy, hoy, user_id))
        nota_id = cursor.fetchone()[0]

        cursor.execute('SELECT COALESCE(MAX("ID_Adjunto"), 0) + 1 FROM public."Adjuntos"')
        nuevo_id_adj = cursor.fetchone()[0]
        cursor.execute("""
            INSERT INTO public."Adjuntos" ("ID_Adjunto", "Nombre_archivo", "Formato", "Ruta_archivo", "ID_Nota")
            VALUES (%s, %s, %s, %s, %s)
        """, (nuevo_id_adj, filename, ext.lstrip("."), ruta_db, nota_id))

        if etiquetas_raw:
            _insertar_etiquetas(etiquetas_raw, nota_id, cursor)

        conexion.commit()
        return jsonify({"success": True, "mensaje": "Nota de dibujo guardada correctamente", "nota_id": nota_id, "redirect": "/notas"}), 201

    except Exception as e:
        if conexion:
            conexion.rollback()
        import traceback; traceback.print_exc()
        return jsonify({"error": "Error al guardar la nota de dibujo"}), 500

    finally:
        cerrar_db(cursor, conexion)


# ==============================================================================
# 15. GUARDAR NOTA DE AUDIO
#     Acepta archivos de hasta 200 MB en los formatos de audio más comunes.
# ==============================================================================

@app.route("/guardar-nota-audio", methods=["POST"])
@login_required
def guardar_nota_audio():
    """
    Recibe el archivo de audio y crea una nota de tipo audio en la BD.

    Campos:
        titulo      — str (opcional)
        descripcion — str (opcional)
        etiquetas   — str separadas por coma (opcional)
        audio       — File (MP3, AAC, OGG, WAV, FLAC, WMA, M4A, WEBM; máx 200 MB)
    """
    user_id  = session["usuario_id"]
    conexion = None
    cursor   = None
    try:
        titulo        = request.form.get("titulo",      "").strip() or "Audio sin título"
        descripcion   = request.form.get("descripcion", "").strip() or f"Nota de audio: {titulo}"
        etiquetas_raw = request.form.get("etiquetas",   "").strip()

        archivo = request.files.get("audio")
        if not archivo or archivo.filename == "":
            return jsonify({"error": "No se recibió ningún archivo de audio"}), 400

        ext = os.path.splitext(archivo.filename)[1].lower()
        if ext not in AUDIO_EXTENSIONES_PERMITIDAS:
            return jsonify({"error": f"Formato no permitido ({ext}). Usa: MP3, AAC, OGG, WAV, FLAC, WMA, M4A"}), 400

        audio_bytes = archivo.read()
        if len(audio_bytes) > AUDIO_MAX_BYTES:
            return jsonify({"error": "El archivo supera el límite de 200 MB"}), 400

        filename      = f"audio_{user_id}_{_uuid.uuid4().hex}{ext}"
        ruta_completa = os.path.join(AUDIO_UPLOAD_FOLDER, filename)
        with open(ruta_completa, "wb") as f:
            f.write(audio_bytes)
        ruta_db = f"uploads/audios/{filename}"

        conexion = conectar_db()
        if conexion is None:
            try: os.remove(ruta_completa)
            except: pass
            return jsonify({"error": "Error de conexión a la base de datos"}), 500

        cursor     = conexion.cursor()
        hoy        = datetime.now()
        formato_adj = ext.lstrip(".")

        cursor.execute("""
            INSERT INTO public."Tipos" ("Formato") VALUES (%s) ON CONFLICT ("Formato") DO NOTHING
        """, (formato_adj,))

        cursor.execute('SELECT COALESCE(MAX("ID_Nota"), 0) + 1 FROM public."Notas"')
        nuevo_id = cursor.fetchone()[0]

        cursor.execute("""
            INSERT INTO public."Notas"
                ("ID_Nota", "Titulo", "Descripcion", "Contenido",
                 "Fecha_decreacion", "Fecha_deedicion", "Estado", "Formato", "ID_Cuenta", "ID_Carpeta")
            VALUES (%s, %s, %s, %s, %s, %s, 'Activa', 'audio', %s, NULL)
            RETURNING "ID_Nota"
        """, (nuevo_id, titulo, descripcion, "", hoy, hoy, user_id))
        nota_id = cursor.fetchone()[0]

        cursor.execute('SELECT COALESCE(MAX("ID_Adjunto"), 0) + 1 FROM public."Adjuntos"')
        nuevo_id_adj = cursor.fetchone()[0]
        cursor.execute("""
            INSERT INTO public."Adjuntos" ("ID_Adjunto", "Nombre_archivo", "Formato", "Ruta_archivo", "ID_Nota")
            VALUES (%s, %s, %s, %s, %s)
        """, (nuevo_id_adj, filename, formato_adj, ruta_db, nota_id))

        if etiquetas_raw:
            _insertar_etiquetas(etiquetas_raw, nota_id, cursor)

        conexion.commit()
        return jsonify({"success": True, "mensaje": "Nota de audio guardada correctamente", "nota_id": nota_id, "redirect": "/notas"}), 201

    except Exception as e:
        if conexion:
            conexion.rollback()
        import traceback; traceback.print_exc()
        return jsonify({"error": "Error al guardar la nota de audio"}), 500

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

        conexion    = conectar_db()
        if conexion is None:
            return jsonify({"error": "Error de conexión a la base de datos"}), 500

        cursor      = conexion.cursor()
        hoy         = datetime.now()
        formato_adj = ext.lstrip(".")

        cursor.execute("""
            INSERT INTO public."Tipos" ("Formato") VALUES (%s) ON CONFLICT ("Formato") DO NOTHING
        """, (formato_adj,))

        cursor.execute('SELECT COALESCE(MAX("ID_Nota"), 0) + 1 FROM public."Notas"')
        nuevo_id = cursor.fetchone()[0]

        cursor.execute("""
            INSERT INTO public."Notas"
                ("ID_Nota", "Titulo", "Descripcion", "Contenido",
                 "Fecha_decreacion", "Fecha_deedicion", "Estado", "Formato", "ID_Cuenta", "ID_Carpeta")
            VALUES (%s, %s, %s, %s, %s, %s, 'Activa', 'video', %s, NULL)
            RETURNING "ID_Nota"
        """, (nuevo_id, titulo, descripcion, "", hoy, hoy, user_id))
        nota_id = cursor.fetchone()[0]

        cursor.execute('SELECT COALESCE(MAX("ID_Adjunto"), 0) + 1 FROM public."Adjuntos"')
        nuevo_id_adj = cursor.fetchone()[0]
        cursor.execute("""
            INSERT INTO public."Adjuntos" ("ID_Adjunto", "Nombre_archivo", "Formato", "Ruta_archivo", "ID_Nota")
            VALUES (%s, %s, %s, %s, %s)
        """, (nuevo_id_adj, filename, formato_adj, ruta_db, nota_id))

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


# ==============================================================================
# 17. GUARDAR NOTA MIXTA
#     Combina texto HTML con archivos de imagen, audio y/o video.
#     Cada archivo genera un registro en Adjuntos con su formato real.
# ==============================================================================

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
        titulo        = request.form.get("titulo",      "").strip()
        descripcion   = request.form.get("descripcion", "").strip()
        etiquetas_raw = request.form.get("etiquetas",   "").strip()
        contenido     = request.form.get("contenido",   "").strip()

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

                archivos_guardados.append(ruta_completa)
                adjuntos_a_insertar.append({
                    "filename": filename,
                    "ext":      ext.lstrip("."),
                    "ruta_db":  ruta_db,
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

        cursor.execute('SELECT COALESCE(MAX("ID_Nota"), 0) + 1 FROM public."Notas"')
        nuevo_id = cursor.fetchone()[0]

        cursor.execute("""
            INSERT INTO public."Notas"
                ("ID_Nota", "Titulo", "Descripcion", "Contenido",
                 "Fecha_decreacion", "Fecha_deedicion", "Estado", "Formato", "ID_Cuenta", "ID_Carpeta")
            VALUES (%s, %s, %s, %s, %s, %s, 'Activa', 'mixta', %s, NULL)
            RETURNING "ID_Nota"
        """, (nuevo_id, titulo, descripcion, contenido, hoy, hoy, user_id))
        nota_id = cursor.fetchone()[0]

        for adj in adjuntos_a_insertar:
            cursor.execute('SELECT COALESCE(MAX("ID_Adjunto"), 0) + 1 FROM public."Adjuntos"')
            nuevo_id_adj = cursor.fetchone()[0]
            cursor.execute("""
                INSERT INTO public."Adjuntos" ("ID_Adjunto", "Nombre_archivo", "Formato", "Ruta_archivo", "ID_Nota")
                VALUES (%s, %s, %s, %s, %s)
            """, (nuevo_id_adj, adj["filename"], adj["ext"], adj["ruta_db"], nota_id))

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


# # ==============================================================================
# # PUNTO DE ENTRADA
# # ==============================================================================

# if __name__ == "__main__":
#     app.run(port=5000)

# ==============================================================================
# 18. MODELOS SQLALCHEMY — Solo para Docker
#     Descomentar cuando se use con SQLAlchemy en lugar de psycopg2 directo.
# ==============================================================================

from flask_sqlalchemy import SQLAlchemy
app.config["SQLALCHEMY_DATABASE_URI"] = "postgresql://postgres:123456@db:5432/dbnoteflow"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db = SQLAlchemy(app)

class Cuentas(db.Model):
    __tablename__ = "Cuentas"
    ID_Cuenta          = db.Column(db.Integer, primary_key=True)
    Usuario            = db.Column(db.Text, nullable=False)
    Contraseña         = db.Column(db.Text, nullable=False)
    Nombres            = db.Column(db.Text, nullable=False)
    Apellidos          = db.Column(db.Text, nullable=False)
    Telefono           = db.Column(db.Numeric(15, 0), nullable=False)
    Correo             = db.Column(db.Text, nullable=False)
    Color_principal    = db.Column(db.Text, nullable=False)
    reset_token        = db.Column(db.Text)
    reset_token_expira = db.Column(db.DateTime(timezone=True))
    Foto               = db.Column(db.Text)
    notas              = db.relationship("Notas",    backref="cuenta", lazy=True)
    carpetas           = db.relationship("Carpetas", backref="cuenta", lazy=True)

class Carpetas(db.Model):
    __tablename__  = "Carpetas"
    ID_Carpeta     = db.Column(db.Integer, primary_key=True)
    Nombre_carpeta = db.Column(db.Text, nullable=False)
    ID_Cuenta      = db.Column(db.Integer, db.ForeignKey("Cuentas.ID_Cuenta"), nullable=False)
    Estado         = db.Column(db.Text, nullable=False)
    notas          = db.relationship("Notas", backref="carpeta", lazy=True)

class Notas(db.Model):
    __tablename__    = "Notas"
    ID_Nota          = db.Column(db.Integer, primary_key=True)
    Fecha_decreacion = db.Column(db.Date, nullable=False)
    Contenido        = db.Column(db.Text, nullable=False)
    Descripcion      = db.Column(db.Text, nullable=False)
    Titulo           = db.Column(db.Text, nullable=False)
    Fecha_deedicion  = db.Column(db.Date, nullable=False)
    Estado           = db.Column(db.Text, nullable=False)
    Formato          = db.Column(db.Text, nullable=False)
    ID_Carpeta       = db.Column(db.Integer, db.ForeignKey("Carpetas.ID_Carpeta"))
    ID_Cuenta        = db.Column(db.Integer, db.ForeignKey("Cuentas.ID_Cuenta"), nullable=False)
    adjuntos         = db.relationship("Adjuntos", backref="nota", lazy=True)

class Etiquetas(db.Model):
    __tablename__   = "Etiquetas"
    ID_Etiqueta     = db.Column(db.Integer, primary_key=True)
    Nombre_etiqueta = db.Column(db.Text)
    notas           = db.relationship("Notas_etiquetas", backref="etiqueta", lazy=True)

class Notas_etiquetas(db.Model):
    __tablename__ = "Notas_etiquetas"
    ID_Nota       = db.Column(db.Integer, db.ForeignKey("Notas.ID_Nota"),       primary_key=True)
    ID_Etiqueta   = db.Column(db.Integer, db.ForeignKey("Etiquetas.ID_Etiqueta"), primary_key=True)

class Adjuntos(db.Model):
    __tablename__  = "Adjuntos"
    ID_Adjunto     = db.Column(db.Integer, primary_key=True)
    Nombre_archivo = db.Column(db.Text, nullable=False)
    Formato        = db.Column(db.Text, nullable=False)
    Ruta_archivo   = db.Column(db.Text, nullable=False)
    ID_Nota        = db.Column(db.Integer, db.ForeignKey("Notas.ID_Nota"), nullable=False)

class Tipos(db.Model):
    __tablename__ = "Tipos"
    Formato       = db.Column(db.Text, primary_key=True)

with app.app_context():
    print("ATENCIÓN: CREANDO TABLAS")
    db.create_all()
