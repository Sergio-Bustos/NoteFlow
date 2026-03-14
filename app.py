# -*- coding: utf-8 -*-

# =============================================== IMPORTACIONES =========================================================
from flask import Flask, jsonify, render_template, request, redirect, url_for, session
from flask_mail import Mail, Message
from flask_sqlalchemy import SQLAlchemy
import psycopg2
from psycopg2.extras import RealDictCursor
from google_auth_oauthlib.flow import Flow
import requests
import os
import uuid
from datetime import datetime, timedelta
import secrets
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv
import re
import random
load_dotenv()
# =====================================================================================================================

# ======================== Configuración OAuth en HTTP (desarrollo) ==========================
os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"
GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID')
GOOGLE_CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET')
GOOGLE_REDIRECT_URI = os.getenv('GOOGLE_REDIRECT_URI')
# ============================================================================================

# ======================== Configuración de Flask ==========================
app = Flask(__name__)
app.secret_key = os.getenv('FLASK_SECRET_KEY', 'tu_clave_secreta_aqui_cambiala')
app.static_folder = 'static'
app.static_url_path = '/static'
app.config["SQLALCHEMY_DATABASE_URI"] = "postgresql://postgres:123456@db:5432/dbnoteflow"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False


# Carpetas de uploads
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
PROFILE_UPLOAD_FOLDER = os.path.join(BASE_DIR, "static", "uploads", "profile")

if not os.path.exists(PROFILE_UPLOAD_FOLDER):
    os.makedirs(PROFILE_UPLOAD_FOLDER)

# Extensiones permitidas para fotos de perfil
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

# Configuración de base de datos
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'database': os.getenv('DB_NAME', 'dbnoteflow'),
    'user': os.getenv('DB_USER', 'postgres'),
    'password': os.getenv('DB_PASSWORD', '123456'),
    'port': int(os.getenv('DB_PORT', 5432))
}
# ==========================================================================

# ======================== Configuración de Flask-Mail ==========================
app.config['MAIL_SERVER'] = os.getenv('MAIL_SERVER')
app.config['MAIL_PORT'] = int(os.getenv('MAIL_PORT'))
app.config['MAIL_USE_TLS'] = os.getenv('MAIL_USE_TLS') == 'True'
app.config['MAIL_USE_SSL'] = os.getenv('MAIL_USE_SSL') == 'True'
app.config['MAIL_USERNAME'] = os.getenv('MAIL_USERNAME')
app.config['MAIL_PASSWORD'] = os.getenv('MAIL_PASSWORD')
app.config['MAIL_DEFAULT_SENDER'] = os.getenv('MAIL_USERNAME')
app.config['MAIL_DEFAULT_CHARSET'] = 'utf-8'
mail = Mail(app)
# ===============================================================================

# ======================================================================
# FUNCIONES AUXILIARES
# ======================================================================
def conectar_db(dict_cursor=False):
    """Crea y devuelve una conexión a PostgreSQL."""
    try:
        cursor_factory = RealDictCursor if dict_cursor else None
        conexion = psycopg2.connect(cursor_factory=cursor_factory, **DB_CONFIG)
        conexion.set_client_encoding('UTF8')
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
    """Verifica si el usuario tiene sesión activa. Retorna redirección si no."""
    if 'usuario_id' not in session:
        return redirect(url_for('mostrar_login'))
    return None


# Decorador para proteger rutas
from functools import wraps

def login_required(f):
    """Decorador que requiere inicio de sesión para acceder a la ruta."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'usuario_id' not in session:
            return redirect(url_for('mostrar_login'))
        return f(*args, **kwargs)
    return decorated_function


def limpiar_datos_formulario(datos, campos):
    """Limpia y retorna un diccionario con los campos del formulario."""
    return {campo: datos.get(campo, '').strip() for campo in campos}


def allowed_file(filename):
    """Verifica si la extensión del archivo es válida"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def obtener_etiquetas_nota(nota_id, cursor):
    """Obtiene las etiquetas asociadas a una nota."""
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
    return [{'ID_Etiqueta': r[0], 'Nombre_etiqueta': r[1]} for r in rows]


def verificar_adjuntos_nota(nota_id, cursor):
    """Devuelve True si la nota tiene al menos un adjunto."""
    cursor.execute("""
        SELECT COUNT(*) AS total
        FROM public."Adjuntos"
        WHERE "ID_Nota" = %s
    """, (nota_id,))
    row = cursor.fetchone()
    if isinstance(row, dict):
        total = row.get('total', 0)
    else:
        total = row[0]
    return int(total) > 0


# ==============================================================================
#  1. PÁGINA DE BIENVENIDA
# ==============================================================================
@app.route('/')
def inicio():
    """Página de bienvenida (antes de autenticarse)."""
    return render_template("bienvenidoalapagina.html")


@app.route('/caracteristicas.html')
def caracteristicas():
    """Página de características."""
    return render_template("caracteristicas.html")


# ==============================================================================
#  2. REGISTRARSE
# ==============================================================================
@app.route('/registro.html')
def mostrar_registro():
    """Formulario de registro."""
    return render_template("registro.html")


@app.route('/cuenta-no-registrada')
def cuenta_no_registrada():
    return render_template("cuenta_no_registrada.html")

@app.route('/procesar-registro', methods=['POST'])
# ============================================================
# TROZO 1 — Reemplaza tu /procesar-registro actual
# ============================================================
@app.route('/procesar-registro', methods=['POST'])
def procesar_registro():
    """
    PASO 1: Valida los datos, genera código de 6 dígitos,
    lo guarda en sesión y lo envía al correo.
    NO crea la cuenta todavía.
    """
    conexion = None
    cursor = None
    try:
        conexion = conectar_db()
        if conexion is None:
            return jsonify({'error': 'No se pudo conectar a la base de datos'}), 500

        campos = ['nombre', 'apellido', 'telefono', 'correo', 'usuario', 'contraseña']
        datos_limpios = limpiar_datos_formulario(request.form, campos)

        nombres    = datos_limpios['nombre']
        apellidos  = datos_limpios['apellido']
        telefono   = datos_limpios['telefono']
        correo     = datos_limpios['correo']
        usuario    = datos_limpios['usuario']
        contraseña = datos_limpios['contraseña']
        color_principal = request.form.get('color_principal', 'Blanco').strip()

        if not all([nombres, apellidos, telefono, correo, usuario, contraseña]):
            return jsonify({'error': 'Todos los campos son obligatorios'}), 400

        if not re.match(r'^\+?[0-9]{7,15}$', telefono):
            return jsonify({'error': 'El teléfono debe contener entre 7 y 15 dígitos'}), 400

        cursor = conexion.cursor()
        cursor.execute("""
            SELECT "ID_Cuenta" FROM public."Cuentas"
            WHERE "Usuario" = %s OR "Correo" = %s
        """, (usuario, correo))

        if cursor.fetchone():
            return jsonify({'error': 'El usuario o correo ya está registrado en NoteFlow'}), 409

        # Generar código y guardarlo en sesión (NO inserta en BD todavía)
        codigo = str(random.randint(100000, 999999))
        expira = datetime.now() + timedelta(minutes=15)

        session['registro_pendiente'] = {
            'nombres':    nombres,
            'apellidos':  apellidos,
            'telefono':   telefono,
            'correo':     correo,
            'usuario':    usuario,
            'contraseña': generate_password_hash(contraseña),  # ya hasheada
            'color':      color_principal,
            'codigo':     codigo,
            'expira':     expira.isoformat()
        }

        # Enviar correo con el código
        msg = Message(
            subject='Tu código de verificación NoteFlow',
            recipients=[correo]
        )
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
            return jsonify({'error': 'Error al enviar el correo de verificación.'}), 500

        return jsonify({
            'success': True,
            'mensaje': 'Código enviado',
            'redirect': '/verificar-registro'   # <-- redirige al formulario del código
        }), 200

    except Exception as e:
        if conexion:
            conexion.rollback()
        print(f"Error al iniciar registro: {e}")
        return jsonify({'error': 'Error al procesar la solicitud'}), 500

    finally:
        cerrar_db(cursor, conexion)


# ============================================================
# TROZO 2 — Ruta que muestra el formulario para ingresar el código
#            (necesitas crear la plantilla verificar_registro.html)
# ============================================================
@app.route('/verificar-registro')
def mostrar_verificacion():
    """Muestra el formulario para ingresar el código de verificación."""
    if 'registro_pendiente' not in session:
        return redirect(url_for('mostrar_registro'))
    correo = session['registro_pendiente'].get('correo', '')
    return render_template('verificar_registro.html', correo=correo)


# ============================================================
# TROZO 3 — Valida el código y crea la cuenta si es correcto
# ============================================================
@app.route('/procesar-verificacion', methods=['POST'])
def procesar_verificacion():
    """PASO 2: Valida el código y crea la cuenta si es correcto."""
    pendiente = session.get('registro_pendiente')
    if not pendiente:
        return jsonify({'error': 'Sesión expirada. Por favor regístrate de nuevo.'}), 400

    codigo_ingresado = request.form.get('codigo', '').strip()

    # Verificar expiración
    expira = datetime.fromisoformat(pendiente['expira'])
    if datetime.now() > expira:
        session.pop('registro_pendiente', None)
        return jsonify({'error': 'El código ha expirado. Por favor regístrate de nuevo.'}), 400

    # Verificar código
    if codigo_ingresado != pendiente['codigo']:
        return jsonify({'error': 'Código incorrecto. Inténtalo de nuevo.'}), 401

    # Código correcto → crear la cuenta
    conexion = None
    cursor = None
    try:
        conexion = conectar_db()
        if conexion is None:
            return jsonify({'error': 'No se pudo conectar a la base de datos'}), 500

        cursor = conexion.cursor()

        # Doble chequeo: que no se haya registrado mientras esperaba
        cursor.execute("""
            SELECT "ID_Cuenta" FROM public."Cuentas"
            WHERE "Usuario" = %s OR "Correo" = %s
        """, (pendiente['usuario'], pendiente['correo']))

        if cursor.fetchone():
            session.pop('registro_pendiente', None)
            return jsonify({'error': 'El usuario o correo ya fue registrado.'}), 409

        cursor.execute('SELECT COALESCE(MAX("ID_Cuenta"), 0) + 1 FROM public."Cuentas"')
        nuevo_id = cursor.fetchone()[0]

        cursor.execute("""
            INSERT INTO public."Cuentas"
            ("ID_Cuenta", "Usuario", "Contraseña", "Nombres", "Apellidos",
             "Telefono", "Correo", "Color_principal")
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING "ID_Cuenta";
        """, (
            nuevo_id,
            pendiente['usuario'],
            pendiente['contraseña'],   # ya viene hasheada del paso 1
            pendiente['nombres'],
            pendiente['apellidos'],
            pendiente['telefono'],
            pendiente['correo'],
            pendiente['color']
        ))

        cuenta_id = cursor.fetchone()[0]
        conexion.commit()

        session.pop('registro_pendiente', None)
        session['usuario_id'] = cuenta_id
        session['usuario_nombre'] = pendiente['usuario']

        return jsonify({
            'success': True,
            'mensaje': '¡Cuenta creada exitosamente!',
            'redirect': '/dashboard'
        }), 201

    except Exception as e:
        if conexion:
            conexion.rollback()
        print(f"Error al crear la cuenta: {e}")
        return jsonify({'error': 'Error al crear la cuenta'}), 500

    finally:
        cerrar_db(cursor, conexion)


# ============================================================
# TROZO 4 — Reenviar código (botón "No recibí el código")
# ============================================================
@app.route('/reenviar-codigo', methods=['POST'])
def reenviar_codigo():
    """Genera un nuevo código y lo reenvía al correo."""
    pendiente = session.get('registro_pendiente')
    if not pendiente:
        return jsonify({'error': 'Sesión expirada. Por favor regístrate de nuevo.'}), 400

    codigo = str(random.randint(100000, 999999))
    expira = datetime.now() + timedelta(minutes=15)

    session['registro_pendiente']['codigo'] = codigo
    session['registro_pendiente']['expira'] = expira.isoformat()
    session.modified = True  # importante para que Flask guarde el cambio en sesión

    msg = Message(
        subject='Tu nuevo código de verificación NoteFlow',
        recipients=[pendiente['correo']]
    )
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
        return jsonify({'error': 'Error al reenviar el correo'}), 500

    return jsonify({'success': True, 'mensaje': 'Nuevo código enviado'}), 200


# ==============================================================================
# 3. INICIAR SESIÓN (Usuario/Contraseña)
# ==============================================================================
@app.route('/iniciarsesion.html')
def mostrar_login():
    """Formulario de inicio de sesión."""
    return render_template("iniciarsesion.html")


@app.route('/procesar-login', methods=['POST'])
def procesar_login():
    """Valida credenciales del usuario y crea la sesión."""
    conexion = None
    cursor = None
    try:
        conexion = conectar_db()
        if conexion is None:
            return jsonify({'error': 'No se pudo conectar a la base de datos'}), 500

        # Limpiar datos
        campos = ['usuario', 'contraseña']
        datos_limpios = limpiar_datos_formulario(request.form, campos)
        usuario = datos_limpios['usuario']
        contraseña = datos_limpios['contraseña']

        if not usuario or not contraseña:
            return jsonify({'error': 'Usuario y contraseña son obligatorios'}), 400

        cursor = conexion.cursor(cursor_factory=RealDictCursor)

        cursor.execute("""
            SELECT "ID_Cuenta", "Usuario", "Contraseña", "Nombres", "Apellidos", "Color_principal"
            FROM public."Cuentas"
            WHERE "Usuario" = %s
        """, (usuario,))

        usuario_encontrado = cursor.fetchone()

        if not usuario_encontrado:
            return jsonify({'error': 'Este usuario no está registrado en NoteFlow'}), 404

        password_guardado = usuario_encontrado['Contraseña']
        login_exitoso = False
        
        # Verificar si es hash o texto plano
        if password_guardado.startswith('pbkdf2:sha256:') or password_guardado.startswith('scrypt:'):
            if check_password_hash(password_guardado, contraseña):
                login_exitoso = True
        else:
            if password_guardado == contraseña:
                login_exitoso = True
                # MIGRAR a hash ahora
                try:
                    nuevo_hash = generate_password_hash(contraseña)
                    cursor_temp = conexion.cursor()
                    cursor_temp.execute("""
                        UPDATE public."Cuentas"
                        SET "Contraseña" = %s
                        WHERE "ID_Cuenta" = %s
                    """, (nuevo_hash, usuario_encontrado['ID_Cuenta']))
                    conexion.commit()
                    cursor_temp.close()
                    print(f"Contraseña migrada a hash para usuario: {usuario}")
                except Exception as e:
                    print(f"Error al migrar contraseña: {e}")
        
        if login_exitoso:
            session['usuario_id'] = usuario_encontrado['ID_Cuenta']
            session['usuario_nombre'] = usuario_encontrado['Usuario']
            
            return jsonify({
                'success': True,
                'mensaje': 'Inicio de sesión exitoso',
                'redirect': '/dashboard'
            }), 200
        else:
            return jsonify({'error': 'Contraseña incorrecta'}), 401

    except Exception as e:
        print(f"Error al iniciar sesión: {e}")
        return jsonify({'error': 'Error al procesar la solicitud'}), 500

    finally:
        cerrar_db(cursor, conexion)


# ==============================================================================
# 4. INICIAR SESIÓN CON GOOGLE
# ==============================================================================
@app.route("/google/login")
def google_login():
    client_config = {
        "web": {
            "client_id": os.getenv("GOOGLE_CLIENT_ID"),
            "project_id": "note-flow",
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
            "redirect_uris": [os.getenv("GOOGLE_REDIRECT_URI")]
        }
    }

    flow = Flow.from_client_config(
        client_config,
        scopes=[
            "https://www.googleapis.com/auth/userinfo.email",
            "https://www.googleapis.com/auth/userinfo.profile",
            "openid"
        ],
        redirect_uri=os.getenv("GOOGLE_REDIRECT_URI")
    )

    authorization_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent"
    )

    session["state"] = state
    return redirect(authorization_url)


@app.route("/google/callback")
def google_callback():
    client_config = {
        "web": {
            "client_id": os.getenv("GOOGLE_CLIENT_ID"),
            "project_id": "note-flow",
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
            "redirect_uris": [os.getenv("GOOGLE_REDIRECT_URI")]
        }
    }

    flow = Flow.from_client_config(
        client_config,
        scopes=[
            "https://www.googleapis.com/auth/userinfo.email",
            "https://www.googleapis.com/auth/userinfo.profile",
            "openid"
        ],
        state=session.get("state"),
        redirect_uri=os.getenv("GOOGLE_REDIRECT_URI")
    )

    flow.fetch_token(authorization_response=request.url)
    credentials = flow.credentials

    user_info = requests.get(
        "https://www.googleapis.com/oauth2/v1/userinfo",
        params={"alt": "json", "access_token": credentials.token}
    ).json()

    email = user_info.get("email")
    if not email:
        return "No se pudo obtener el correo desde Google.", 400

    conexion = None
    cursor = None

    try:
        conexion = conectar_db()
        if conexion is None:
            return "Error de conexión con la base de datos", 500
        cursor = conexion.cursor()

        cursor.execute('SELECT "ID_Cuenta" FROM public."Cuentas" WHERE "Correo" = %s', (email,))
        row = cursor.fetchone()

        if not row:
            return redirect(url_for('cuenta_no_registrada'))

        user_id = int(row[0])
        session["usuario_id"] = user_id
        session["usuario_nombre"] = user_info.get("name") or email

        return redirect("/dashboard")

    except Exception as e:
        print("Error en google_callback:", e)
        return "Error interno al procesar login con Google.", 500

    finally:
        cerrar_db(cursor, conexion)


# ==============================================================================
# 5. OLVIDÉ MI CONTRASEÑA (Restablecer)
# ==============================================================================
@app.route('/olvide-contrasena')
def mostrar_olvide_contrasena():
    return render_template('olvide_contrasena.html')


@app.route('/procesar-olvide-contrasena', methods=['POST'])
def procesar_olvide_contrasena():
    conexion = None
    cursor = None
    correo = request.form.get('correo', '').strip()

    if not correo:
        return jsonify({'error': 'El correo es obligatorio'}), 400

    try:
        conexion = conectar_db()
        if conexion is None:
            return jsonify({'error': 'Error de conexión a la base de datos'}), 500

        cursor = conexion.cursor()
        
        cursor.execute('SELECT "ID_Cuenta", "Usuario" FROM public."Cuentas" WHERE "Correo" = %s', (correo,))
        usuario_row = cursor.fetchone()

        if not usuario_row:
            return jsonify({
                'error': 'Este correo no está registrado en NoteFlow. Por favor verifica o regístrate primero.'
            }), 404

        usuario_id = usuario_row[0]
        usuario_nombre = usuario_row[1]

        token = secrets.token_urlsafe(32)
        expira = datetime.now() + timedelta(hours=1)
        
        cursor.execute("""
            UPDATE public."Cuentas" 
            SET "reset_token" = %s, "reset_token_expira" = %s
            WHERE "ID_Cuenta" = %s
        """, (token, expira, usuario_id))

        conexion.commit()

        reset_url = url_for('mostrar_restablecer_contrasena', token=token, _external=True)
         
        msg = Message('Restablecimiento de Contraseña NoteFlow', recipients=[correo])
        msg.body = f"""Hola {usuario_nombre}, 

Has solicitado restablecer tu contraseña para NoteFlow.

Haz clic en el siguiente enlace para completar el proceso:

{reset_url} 

Este enlace expirará en 1 hora.

Si no solicitaste este cambio, por favor ignora este correo.

Saludos,
Equipo NoteFlow
"""
        try:
            mail.send(msg)
        except Exception as mail_e:
            print(f"Error al enviar correo: {mail_e}")
            return jsonify({'error': 'Error al enviar el correo, revisa la configuración del MAIL.'}), 500

        return jsonify({
            'success': True,
            'mensaje': 'Si tu correo está registrado, recibirás un enlace de restablecimiento en breve.'
        }), 200

    except Exception as e:
        if conexion:
            conexion.rollback()
        import traceback
        traceback.print_exc()  # <-- esto imprime el error completo en consola
        return jsonify({'error': str(e)}), 500

    finally:
        cerrar_db(cursor, conexion)


@app.route('/restablecer-contrasena/<token>')
def mostrar_restablecer_contrasena(token):
    conexion = None
    cursor = None
    try:
        conexion = conectar_db()
        if conexion is None:
            return redirect(url_for('mostrar_login'))

        cursor = conexion.cursor(cursor_factory=RealDictCursor)

        cursor.execute("""
            SELECT "ID_Cuenta" 
            FROM public."Cuentas" 
            WHERE "reset_token" = %s AND "reset_token_expira" > %s
        """, (token, datetime.now()))
        
        usuario_row = cursor.fetchone()

        if usuario_row:
            return render_template("restablecer_contrasena.html", token=token, error=None)
        else:
            return render_template("restablecer_contrasena.html", token=None, error="El enlace de restablecimiento no es válido o ha expirado.")

    except Exception as e:
        print(f"Error al verificar token: {e}")
        return render_template("restablecer_contrasena.html", token=None, error="Error interno al procesar la solicitud.")

    finally:
        cerrar_db(cursor, conexion)


@app.route('/procesar-restablecer-contrasena', methods=['POST'])
def procesar_restablecer_contrasena():
    conexion = None
    cursor = None
    
    token = request.form.get('token', '').strip()
    nueva_contrasena = request.form.get('nueva_contrasena', '').strip()
    
    if not token or not nueva_contrasena:
        return jsonify({'error': 'Faltan datos obligatorios.'}), 400

    try:
        conexion = conectar_db()
        if conexion is None:
            return jsonify({'error': 'Error de conexión a la base de datos.'}), 500

        cursor = conexion.cursor()

        cursor.execute("""
            SELECT "ID_Cuenta" 
            FROM public."Cuentas" 
            WHERE "reset_token" = %s AND "reset_token_expira" > %s
        """, (token, datetime.now()))
        
        usuario_id_row = cursor.fetchone()

        if not usuario_id_row:
            return jsonify({'error': 'El enlace ha expirado o es inválido.'}), 401

        usuario_id = usuario_id_row[0]
        password_hash = generate_password_hash(nueva_contrasena)

        cursor.execute("""
            UPDATE public."Cuentas"
            SET "Contraseña" = %s, "reset_token" = NULL, "reset_token_expira" = NULL
            WHERE "ID_Cuenta" = %s
        """, (password_hash, usuario_id))
        
        conexion.commit()

        return jsonify({
            'success': True,
            'mensaje': 'Contraseña restablecida con éxito. Redirigiendo a Iniciar Sesión.',
            'redirect': url_for('mostrar_login')
        }), 200

    except Exception as e:
        if conexion:
            conexion.rollback()
        print(f"Error al restablecer contraseña: {e}")
        return jsonify({'error': 'Error interno al procesar la solicitud.'}), 500

    finally:
        cerrar_db(cursor, conexion)


# ==============================================================================
# 6. CERRAR SESIÓN
# ==============================================================================
@app.route('/logout')
def cerrar_sesion():
    session.clear()
    return redirect(url_for('inicio'))


@app.route("/perfil/cerrar-sesion")
@login_required
def cerrar_sesion_perfil():
    session.clear()
    return redirect(url_for('mostrar_login'))


# ==============================================================================
# 7. DASHBOARD
# ==============================================================================
@app.route('/dashboard')
@login_required
def dashboard():
    user_id = session['usuario_id']
    conexion = None
    cursor = None
    try:
        conexion = conectar_db()
        cursor = conexion.cursor(cursor_factory=RealDictCursor)

        cursor.execute("""
            SELECT "Nombres", "Color_principal", "Foto"
            FROM public."Cuentas"
            WHERE "ID_Cuenta" = %s
        """, (user_id,))
        usuario_row = cursor.fetchone()
        
        if not usuario_row:
            session.clear()
            return redirect(url_for('mostrar_login'))
 
        usuario_para_template = {
            'Nombres': usuario_row.get('Nombres'),
            'Color_principal': usuario_row.get('Color_principal', 'Blanco'),
            'Foto': usuario_row.get('Foto') if usuario_row.get('Foto') else 'default_profile.png',

        }

        cursor.execute("""
            SELECT COUNT(*) AS total_notas FROM public."Notas"
            WHERE "ID_Cuenta" = %s AND LOWER("Estado") = 'activa'
        """, (user_id,))
        total_notas = cursor.fetchone()['total_notas']

        cursor.execute("""
            SELECT COUNT(*) AS total_carpetas FROM public."Carpetas"
            WHERE "ID_Cuenta" = %s
        """, (user_id,))
        total_carpetas = cursor.fetchone()['total_carpetas']

        cursor.execute("""
            SELECT COUNT(*) AS notas_papelera FROM public."Notas"
            WHERE "ID_Cuenta" = %s AND LOWER("Estado") = 'papelera'
        """, (user_id,))
        notas_papelera = cursor.fetchone()['notas_papelera']

        cursor.execute("""
            SELECT
                n."ID_Nota",
                n."Titulo",
                n."Descripcion",
                n."Fecha_deedicion"
            FROM public."Notas" n
            WHERE n."ID_Cuenta" = %s AND LOWER(n."Estado") = 'activa'
            ORDER BY n."Fecha_deedicion" DESC NULLS LAST
            LIMIT 6
        """, (user_id,))
        notas_raw = cursor.fetchall()

        notas_recientes = []
        for nota in notas_raw:
            nota_id = nota['ID_Nota']
            etiquetas = obtener_etiquetas_nota(nota_id, cursor)
            has_adj = verificar_adjuntos_nota(nota_id, cursor)
            notas_recientes.append({
                'ID_Nota': nota_id,
                'Titulo': nota.get('Titulo'),
                'Descripcion': nota.get('Descripcion'),
                'Fecha_deedicion': nota.get('Fecha_deedicion'),
                'Etiquetas': etiquetas,
                'Has_Adjuntos': has_adj
            })

        return render_template(
            'dashboard.html',
            usuario=usuario_para_template,
            total_notas=total_notas,
            total_carpetas=total_carpetas,
            notas_papelera=notas_papelera,
            notas_recientes=notas_recientes
        )
 
    except Exception as e:
        import traceback
        traceback.print_exc()
        return f"Error al cargar dashboard: {str(e)}", 500

    finally:
        cerrar_db(cursor, conexion)


# ==============================================================================
# 8. PERFIL
# ==============================================================================
@app.route('/perfil')
@login_required
def perfil():
    user_id = session['usuario_id']
    conexion = None
    cursor = None

    try:
        conexion = conectar_db(dict_cursor=True)
        cursor = conexion.cursor()

        cursor.execute("""
            SELECT "ID_Cuenta", "Usuario", "Nombres", "Apellidos", 
                   "Correo", "Telefono", "Foto", "Color_principal"
            FROM public."Cuentas"
            WHERE "ID_Cuenta" = %s
        """, (user_id,))

        usuario = cursor.fetchone()

        if not usuario:
            session.clear()
            return redirect(url_for('mostrar_login'))

        return render_template("perfil.html", usuario=usuario)

    except Exception as e:
        print(f"Error al cargar perfil: {e}")
        return "Error al cargar el perfil", 500

    finally:
        cerrar_db(cursor, conexion)


@app.route('/perfil/cambiar-tema', methods=['POST'])
@login_required
def cambiar_tema():
    tema = request.form.get("tema")
     
    if tema not in ["claro", "oscuro"]:
        return jsonify({"error": "Tema inválido"}), 400

    color_map = {"claro": "Blanco", "oscuro": "Negro"}
    color_db = color_map.get(tema)
    user_id = session['usuario_id']
    conexion = None
    cursor = None

    try:
        conexion = conectar_db()
        cursor = conexion.cursor()

        cursor.execute("""
            UPDATE public."Cuentas"
            SET "Color_principal" = %s
            WHERE "ID_Cuenta" = %s
        """, (color_db, user_id))

        conexion.commit()
        session["color_principal"] = color_db

        return jsonify({"success": True, "mensaje": f"Tema cambiado a {tema}", "tema_db": color_db}), 200

    except Exception as e:
        if conexion:
            conexion.rollback()
        print(f"Error al cambiar tema: {e}")
        return jsonify({"error": "Error al actualizar tema"}), 500

    finally:
        cerrar_db(cursor, conexion)


@app.route('/perfil/cambiar-password', methods=['POST'])
@login_required
def cambiar_password():
    user_id = session["usuario_id"]

    campos = ['password_actual', 'password_nueva', 'password_confirmacion']
    datos_limpios = limpiar_datos_formulario(request.form, campos)
    
    actual = datos_limpios['password_actual']
    nueva = datos_limpios['password_nueva']
    confirm = datos_limpios['password_confirmacion']

    if not actual or not nueva or not confirm:
        return jsonify({"error": "Todos los campos son obligatorios"}), 400

    if nueva != confirm:
        return jsonify({"error": "Las nuevas contraseñas no coinciden"}), 400

    if len(nueva) > 15:
        return jsonify({"error": "La contraseña no puede superar 15 caracteres"}), 400

    if len(nueva) < 6:
        return jsonify({"error": "La contraseña debe tener al menos 6 caracteres"}), 400

    conexion = None
    cursor = None

    try:
        conexion = conectar_db(dict_cursor=True)
        cursor = conexion.cursor()

        cursor.execute("""
            SELECT "Contraseña" 
            FROM public."Cuentas" 
            WHERE "ID_Cuenta" = %s
        """, (user_id,))
         
        user = cursor.fetchone()

        if not user:
            return jsonify({"error": "Usuario no encontrado"}), 404

        password_guardado = user["Contraseña"]
        
        password_actual_correcta = False
        if password_guardado.startswith('pbkdf2:sha256:') or password_guardado.startswith('scrypt:'):
            if check_password_hash(password_guardado, actual):
                password_actual_correcta = True
        else:
            if password_guardado == actual:
                password_actual_correcta = True
        
        if not password_actual_correcta:
            return jsonify({"error": "La contraseña actual es incorrecta"}), 401

        if password_guardado.startswith('pbkdf2:sha256:') or password_guardado.startswith('scrypt:'):
            if check_password_hash(password_guardado, nueva):
                return jsonify({"error": "La nueva contraseña debe ser diferente"}), 400
        else:
            if password_guardado == nueva:
                return jsonify({"error": "La nueva contraseña debe ser diferente"}), 400
 
        nuevo_hash = generate_password_hash(nueva)
        
        cursor.execute("""
            UPDATE public."Cuentas"
            SET "Contraseña" = %s
            WHERE "ID_Cuenta" = %s
        """, (nuevo_hash, user_id))

        conexion.commit()

        return jsonify({"success": True, "mensaje": "Contraseña actualizada exitosamente"}), 200

    except Exception as e:
        if conexion:
            conexion.rollback()
        print(f"Error al cambiar contraseña: {e}")
        return jsonify({"error": "Error al procesar la solicitud"}), 500

    finally:
        cerrar_db(cursor, conexion)


@app.route('/perfil/subir-foto', methods=["POST"])
@login_required
def subir_foto():
    archivo = request.files.get("foto")

    if not archivo or archivo.filename == '':
        return jsonify({"error": "No se seleccionó ninguna imagen"}), 400

    if not allowed_file(archivo.filename):
        return jsonify({"error": "Formato no permitido. Usa: PNG, JPG, JPEG, GIF o WEBP"}), 400

    user_id = session["usuario_id"]

    try:
        ext = os.path.splitext(archivo.filename)[1].lower()
        filename_unique = f"user_{user_id}_{uuid.uuid4().hex}{ext}"
        ruta_completa = os.path.join(PROFILE_UPLOAD_FOLDER, filename_unique)
        archivo.save(ruta_completa)
        ruta_db = f"uploads/profile/{filename_unique}"

        conexion = None
        cursor = None

        try:
            conexion = conectar_db()
            cursor = conexion.cursor()

            cursor.execute("""
                SELECT "Foto" FROM public."Cuentas" 
                WHERE "ID_Cuenta" = %s
            """, (user_id,))
             
            result = cursor.fetchone()
            foto_anterior = result[0] if result else None

            cursor.execute("""
                UPDATE public."Cuentas"
                SET "Foto" = %s
                WHERE "ID_Cuenta" = %s
            """, (ruta_db, user_id))

            conexion.commit()

            if foto_anterior and foto_anterior != "uploads/profile/default_profile.png":
                try:
                    ruta_anterior = os.path.join(BASE_DIR, "static", foto_anterior)
                    if os.path.exists(ruta_anterior):
                        os.remove(ruta_anterior)
                except Exception as e:
                    print(f"No se pudo eliminar foto anterior: {e}")

            return jsonify({
                "success": True,
                "mensaje": "Foto de perfil actualizada",
                "nueva_foto": url_for('static', filename=ruta_db)
            }), 200

        except Exception as e:
            if conexion:
                conexion.rollback()
            print(f"Error al actualizar BD: {e}")
            return jsonify({"error": "Error al guardar en base de datos"}), 500

        finally:
            cerrar_db(cursor, conexion)

    except Exception as e:
        print(f"Error al subir archivo: {e}")
        return jsonify({"error": "Error al subir el archivo"}), 500

# 8.1 - Eliminar foto de perfil 
# ==============================================================================
# 8B. ELIMINAR FOTO DE PERFIL
# ==============================================================================

@app.route('/perfil/eliminar-foto', methods=['POST'])
@login_required
def eliminar_foto_perfil():
    """
    Elimina la foto de perfil del usuario:
    - Borra el archivo físico del servidor (si no es la imagen por defecto).
    - Pone NULL (o vacío) en la columna Foto de la BD.
    """
    user_id = session['usuario_id']
    conexion = None
    cursor   = None

    try:
        conexion = conectar_db()
        if conexion is None:
            return jsonify({'error': 'Error de conexión a la base de datos'}), 500

        cursor = conexion.cursor()

        # Obtener la ruta actual de la foto
        cursor.execute("""
            SELECT "Foto" FROM public."Cuentas"
            WHERE "ID_Cuenta" = %s
        """, (user_id,))
        row = cursor.fetchone()

        if not row:
            return jsonify({'error': 'Usuario no encontrado'}), 404

        foto_actual = row[0] if row else None

        # Borrar archivo físico solo si existe y no es la foto por defecto
        fotos_default = {
            None,
            '',
            'img/default_profile.png',
            'uploads/profile/default_profile.png'
        }

        if foto_actual and foto_actual not in fotos_default:
            ruta_fisica = os.path.join(BASE_DIR, 'static', foto_actual)
            try:
                if os.path.exists(ruta_fisica):
                    os.remove(ruta_fisica)
                    print(f"Foto eliminada del servidor: {ruta_fisica}")
            except Exception as e:
                print(f"No se pudo eliminar el archivo físico: {e}")
                # No interrumpimos: igual actualizamos la BD

        # Limpiar la columna Foto en la BD (NULL)
        cursor.execute("""
            UPDATE public."Cuentas"
            SET "Foto" = NULL
            WHERE "ID_Cuenta" = %s
        """, (user_id,))
        conexion.commit()

        # Devolver la ruta de la imagen por defecto para que el JS la ponga
        foto_default_url = url_for('static', filename='img/default_profile.png')

        return jsonify({
            'success': True,
            'mensaje': 'Foto de perfil eliminada correctamente',
            'foto_default': foto_default_url
        }), 200

    except Exception as e:
        if conexion:
            conexion.rollback()
        print(f"Error al eliminar foto de perfil: {e}")
        return jsonify({'error': 'Error al eliminar la foto de perfil'}), 500

    finally:
        cerrar_db(cursor, conexion)
# ==============================================================================
# 9. MIS NOTAS — solo visual, sin consultas de notas/carpetas
# ==============================================================================
@app.route("/notas")
@login_required
def mostrar_notas():
    """
    Página de Mis Notas.
    Solo carga los datos del usuario (para header y tema).
    Las notas y carpetas se cargarán más adelante vía AJAX o consulta real.
    """
    user_id = session['usuario_id']
    conexion = None
    cursor = None

    try:
        conexion = conectar_db(dict_cursor=True)
        cursor = conexion.cursor()

        # Solo se consultan los datos básicos del usuario para el header
        cursor.execute("""
            SELECT "Nombres", "Foto", "Color_principal"
            FROM public."Cuentas"
            WHERE "ID_Cuenta" = %s
        """, (user_id,))
        usuario = cursor.fetchone()

        if not usuario:
            session.clear()
            return redirect(url_for('mostrar_login'))

        # Se pasan listas vacías — el HTML es puramente visual por ahora
        return render_template(
            "notas.html",
            notas=[],
            carpetas=[],
            usuario=usuario
        )

    except Exception as e:
        import traceback
        traceback.print_exc()
        return f"Error al cargar la página de notas: {str(e)}", 500

    finally:
        cerrar_db(cursor, conexion)


# ==============================================================================
# 10. PAPELERA — Vista principal
# ==============================================================================
@app.route('/papelera')
@login_required
def papelera():
    """
    Muestra todas las notas en estado 'papelera' del usuario.
    Además, elimina automáticamente las que llevan más de 30 días,
    incluyendo sus archivos físicos y registros relacionados.
    """
    user_id = session['usuario_id']
    conexion = None
    cursor = None

    try:
        conexion = conectar_db(dict_cursor=True)
        if conexion is None:
            return "Error de conexión a la base de datos", 500
        cursor = conexion.cursor()

        # ── 1. Datos del usuario para el header ───────────────────────────
        cursor.execute("""
            SELECT "Nombres", "Foto", "Color_principal"
            FROM public."Cuentas"
            WHERE "ID_Cuenta" = %s
        """, (user_id,))
        usuario = cursor.fetchone()

        if not usuario:
            session.clear()
            return redirect(url_for('mostrar_login'))

        # ── 2. Limpieza automática: notas con más de 30 días en papelera ──
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
            # Borrar archivos físicos de adjuntos
            for fila in notas_vencidas:
                ruta = fila.get('Ruta_archivo') if isinstance(fila, dict) else fila[1]
                if ruta:
                    ruta_completa = os.path.join(BASE_DIR, 'static', ruta)
                    try:
                        if os.path.exists(ruta_completa):
                            os.remove(ruta_completa)
                    except Exception as e:
                        print(f"No se pudo eliminar archivo {ruta_completa}: {e}")

            # IDs únicos de notas vencidas
            ids_vencidos = list({
                fila.get('ID_Nota') if isinstance(fila, dict) else fila[0]
                for fila in notas_vencidas
            })

            # Eliminar relaciones y la nota
            cursor.execute('DELETE FROM public."Adjuntos"        WHERE "ID_Nota" = ANY(%s)', (ids_vencidos,))
            cursor.execute('DELETE FROM public."Notas_etiquetas" WHERE "ID_Nota" = ANY(%s)', (ids_vencidos,))
            cursor.execute("""
                DELETE FROM public."Notas"
                WHERE "ID_Cuenta" = %s
                  AND LOWER("Estado") = 'papelera'
                  AND "Fecha_deedicion" <= (CURRENT_TIMESTAMP - INTERVAL '30 days')
            """, (user_id,))
            conexion.commit()

        # ── 3. Obtener notas en papelera (ya sin las vencidas) ────────────
        cursor.execute("""
            SELECT
                "ID_Nota",
                "Titulo",
                "Descripcion",
                "Fecha_deedicion",
                "Fecha_decreacion",
                "Formato"
            FROM public."Notas"
            WHERE "ID_Cuenta" = %s
              AND LOWER("Estado") = 'papelera'
            ORDER BY "Fecha_deedicion" DESC NULLS LAST
        """, (user_id,))
        notas_papelera = cursor.fetchall()

        return render_template(
            "papelera.html",
            notas_papelera=notas_papelera,
            usuario=usuario,
            now=datetime.now(),
            timedelta=timedelta
        )

    except Exception as e:
        import traceback
        traceback.print_exc()
        return f"Error al cargar la papelera: {str(e)}", 500

    finally:
        cerrar_db(cursor, conexion)


# ==============================================================================
# 10.1 PAPELERA — Restaurar una nota
# ==============================================================================
@app.route('/papelera/restaurar/<int:nota_id>', methods=['POST'])
@login_required
def restaurar_nota(nota_id):
    """
    Restaura una nota de estado 'papelera' a 'Activa'.
    Solo el propietario de la nota puede restaurarla.
    """
    user_id = session['usuario_id']
    conexion, cursor = None, None

    try:
        conexion = conectar_db()
        if conexion is None:
            return jsonify({'error': 'Error de conexión a la base de datos'}), 500
        cursor = conexion.cursor()

        # Verificar que la nota existe, pertenece al usuario y está en papelera
        cursor.execute("""
            SELECT "ID_Nota" FROM public."Notas"
            WHERE "ID_Nota" = %s
              AND "ID_Cuenta" = %s
              AND LOWER("Estado") = 'papelera'
        """, (nota_id, user_id))

        if not cursor.fetchone():
            return jsonify({'error': 'Nota no encontrada o sin permiso para restaurarla'}), 404

        cursor.execute("""
            UPDATE public."Notas"
            SET "Estado" = 'Activa',
                "Fecha_deedicion" = CURRENT_TIMESTAMP
            WHERE "ID_Nota" = %s
              AND "ID_Cuenta" = %s
        """, (nota_id, user_id))

        conexion.commit()
        return jsonify({'success': True, 'mensaje': 'Nota restaurada correctamente'}), 200

    except Exception as e:
        if conexion:
            conexion.rollback()
        print(f"Error al restaurar nota {nota_id}: {e}")
        return jsonify({'error': 'Error al restaurar la nota'}), 500

    finally:
        cerrar_db(cursor, conexion)


# ==============================================================================
# 10.2 PAPELERA — Eliminar una nota definitivamente
# ==============================================================================
@app.route('/papelera/eliminar/<int:nota_id>', methods=['POST'])
@login_required
def eliminar_nota_definitivo(nota_id):
    """
    Elimina permanentemente una nota que está en la papelera:
    1. Borra los archivos físicos de sus adjuntos del servidor.
    2. Elimina los registros de Adjuntos y Notas_etiquetas.
    3. Elimina la nota de la BD.
    Solo el propietario puede ejecutar esta acción.
    """
    user_id = session['usuario_id']
    conexion, cursor = None, None

    try:
        conexion = conectar_db(dict_cursor=True)
        if conexion is None:
            return jsonify({'error': 'Error de conexión a la base de datos'}), 500
        cursor = conexion.cursor()

        # Verificar propiedad y estado
        cursor.execute("""
            SELECT "ID_Nota" FROM public."Notas"
            WHERE "ID_Nota" = %s
              AND "ID_Cuenta" = %s
              AND LOWER("Estado") = 'papelera'
        """, (nota_id, user_id))

        if not cursor.fetchone():
            return jsonify({'error': 'Nota no encontrada o sin permiso para eliminarla'}), 404

        # Obtener rutas de adjuntos para borrar archivos físicos
        cursor.execute("""
            SELECT "Ruta_archivo" FROM public."Adjuntos"
            WHERE "ID_Nota" = %s
        """, (nota_id,))
        adjuntos = cursor.fetchall()

        for adj in adjuntos:
            ruta = adj.get('Ruta_archivo') if isinstance(adj, dict) else adj[0]
            if ruta:
                ruta_completa = os.path.join(BASE_DIR, 'static', ruta)
                try:
                    if os.path.exists(ruta_completa):
                        os.remove(ruta_completa)
                except Exception as e:
                    print(f"No se pudo eliminar archivo {ruta_completa}: {e}")

        # Limpiar tablas relacionadas y eliminar la nota
        cursor.execute('DELETE FROM public."Adjuntos"        WHERE "ID_Nota" = %s', (nota_id,))
        cursor.execute('DELETE FROM public."Notas_etiquetas" WHERE "ID_Nota" = %s', (nota_id,))
        cursor.execute("""
            DELETE FROM public."Notas"
            WHERE "ID_Nota" = %s AND "ID_Cuenta" = %s
        """, (nota_id, user_id))

        conexion.commit()
        return jsonify({'success': True, 'mensaje': 'Nota eliminada definitivamente'}), 200

    except Exception as e:
        if conexion:
            conexion.rollback()
        print(f"Error al eliminar nota {nota_id}: {e}")
        return jsonify({'error': 'Error al eliminar la nota'}), 500

    finally:
        cerrar_db(cursor, conexion)


# ==============================================================================
# 10.3 PAPELERA — Vaciar toda la papelera
# ==============================================================================
@app.route('/papelera/vaciar', methods=['POST'])
@login_required
def vaciar_papelera():
    """
    Elimina permanentemente TODAS las notas en papelera del usuario,
    incluyendo sus archivos físicos adjuntos y registros relacionados.
    """
    user_id = session['usuario_id']
    conexion, cursor = None, None

    try:
        conexion = conectar_db(dict_cursor=True)
        if conexion is None:
            return jsonify({'error': 'Error de conexión a la base de datos'}), 500
        cursor = conexion.cursor()

        # Obtener IDs de notas en papelera del usuario
        cursor.execute("""
            SELECT "ID_Nota" FROM public."Notas"
            WHERE "ID_Cuenta" = %s AND LOWER("Estado") = 'papelera'
        """, (user_id,))
        filas = cursor.fetchall()
        ids = [f['ID_Nota'] if isinstance(f, dict) else f[0] for f in filas]

        if not ids:
            return jsonify({'success': True, 'mensaje': 'La papelera ya estaba vacía'}), 200

        # Obtener y borrar archivos adjuntos físicos
        cursor.execute("""
            SELECT "Ruta_archivo" FROM public."Adjuntos"
            WHERE "ID_Nota" = ANY(%s)
        """, (ids,))
        adjuntos = cursor.fetchall()

        for adj in adjuntos:
            ruta = adj.get('Ruta_archivo') if isinstance(adj, dict) else adj[0]
            if ruta:
                ruta_completa = os.path.join(BASE_DIR, 'static', ruta)
                try:
                    if os.path.exists(ruta_completa):
                        os.remove(ruta_completa)
                except Exception as e:
                    print(f"No se pudo eliminar archivo {ruta_completa}: {e}")

        # Limpiar tablas relacionadas
        cursor.execute('DELETE FROM public."Adjuntos"        WHERE "ID_Nota" = ANY(%s)', (ids,))
        cursor.execute('DELETE FROM public."Notas_etiquetas" WHERE "ID_Nota" = ANY(%s)', (ids,))

        # Eliminar todas las notas en papelera del usuario
        cursor.execute("""
            DELETE FROM public."Notas"
            WHERE "ID_Cuenta" = %s AND LOWER("Estado") = 'papelera'
        """, (user_id,))

        conexion.commit()
        return jsonify({'success': True, 'mensaje': 'Papelera vaciada correctamente'}), 200

    except Exception as e:
        if conexion:
            conexion.rollback()
        print(f"Error al vaciar papelera del usuario {user_id}: {e}")
        return jsonify({'error': 'Error al vaciar la papelera'}), 500

    finally:
        cerrar_db(cursor, conexion)
# ==============================================================================
# 11. CREAR NOTA
# ==============================================================================

@app.route('/crear-nota')
@login_required
def crear_nota():
    return render_template("fasededesarrollo.html")



# ====================
# 11.1 - CREAR NOTA DE TEXTO
# =====================

@app.route('/crear-nota-texto')
@login_required
def crear_nota_texto():
    return render_template("editortexto.html")

# ==============================================================================
# 11.2 - CREAR NOTA DE IMAGEN
# ==============================================================================

@app.route('/crear-nota-imagen')
@login_required
def crear_nota_imagen():
    return render_template("editorimagen.html")
# ==============================================================================
# 12. Ruta backend de guardar nota de dibujo
# ==============================================================================


import uuid as _uuid

DIBUJO_UPLOAD_FOLDER = os.path.join(BASE_DIR, "static", "uploads", "dibujos")
if not os.path.exists(DIBUJO_UPLOAD_FOLDER):
    os.makedirs(DIBUJO_UPLOAD_FOLDER)


@app.route('/bloc-dibujo')
@login_required
def bloc_dibujo():
    """Página del bloc de dibujo."""
    return render_template("dibujo.html")


@app.route('/guardar-nota-dibujo', methods=['POST'])
@login_required
def guardar_nota_dibujo():
    user_id = session['usuario_id']
    conexion = None
    cursor   = None

    try:
        # ── 1. Validar campos ──────────────────────────────────────────────
        titulo      = request.form.get('titulo',      '').strip() or 'Dibujo sin título'
        descripcion = request.form.get('descripcion', '').strip() or f'Nota de dibujo: {titulo}'
        etiquetas_raw = request.form.get('etiquetas', '').strip()

        archivo = request.files.get('imagen')
        if not archivo or archivo.filename == '':
            return jsonify({'error': 'No se recibió ninguna imagen'}), 400

        ext = os.path.splitext(archivo.filename)[1].lower()
        if ext not in {'.png', '.jpg', '.jpeg', '.webp'}:
            return jsonify({'error': 'Formato de imagen no permitido'}), 400

        # ── 2. Guardar archivo físico ──────────────────────────────────────
        filename      = f"dibujo_{user_id}_{_uuid.uuid4().hex}{ext}"
        ruta_completa = os.path.join(DIBUJO_UPLOAD_FOLDER, filename)
        archivo.save(ruta_completa)
        ruta_db = f"uploads/dibujos/{filename}"

        # ── 3. Conectar BD ─────────────────────────────────────────────────
        conexion = conectar_db()
        if conexion is None:
            return jsonify({'error': 'Error de conexión a la base de datos'}), 500

        cursor = conexion.cursor()
        hoy    = datetime.now()

        # ── 4. Insertar nota ───────────────────────────────────────────────
        cursor.execute('SELECT COALESCE(MAX("ID_Nota"), 0) + 1 FROM public."Notas"')
        nuevo_id_nota = cursor.fetchone()[0]

        cursor.execute("""
            INSERT INTO public."Notas"
                ("ID_Nota", "Titulo", "Descripcion", "Contenido",
                 "Fecha_decreacion", "Fecha_deedicion",
                 "Estado", "Formato", "ID_Cuenta", "ID_Carpeta")
            VALUES (%s, %s, %s, %s, %s, %s, 'Activa', 'dibujo', %s, NULL)
            RETURNING "ID_Nota"
        """, (nuevo_id_nota, titulo, descripcion, '', hoy, hoy, user_id))
        nota_id = cursor.fetchone()[0]

        # ── 5. Registrar adjunto ───────────────────────────────────────────
        cursor.execute('SELECT COALESCE(MAX("ID_Adjunto"), 0) + 1 FROM public."Adjuntos"')
        nuevo_id_adj = cursor.fetchone()[0]

        cursor.execute("""
            INSERT INTO public."Adjuntos"
                ("ID_Adjunto", "Nombre_archivo", "Formato", "Ruta_archivo", "ID_Nota")
            VALUES (%s, %s, %s, %s, %s)
        """, (nuevo_id_adj, filename, ext.lstrip('.'), ruta_db, nota_id))

        # ── 6. Registrar etiquetas ─────────────────────────────────────────
        if etiquetas_raw:
            etiquetas = [e.strip() for e in etiquetas_raw.split(',') if e.strip()]
            for nombre in etiquetas:
                cursor.execute("""
                    SELECT "ID_Etiqueta" FROM public."Etiquetas"
                    WHERE LOWER("Nombre_etiqueta") = LOWER(%s)
                """, (nombre,))
                row = cursor.fetchone()
                if row:
                    id_etiqueta = row[0]
                else:
                    cursor.execute('SELECT COALESCE(MAX("ID_Etiqueta"), 0) + 1 FROM public."Etiquetas"')
                    id_etiqueta = cursor.fetchone()[0]
                    cursor.execute("""
                        INSERT INTO public."Etiquetas" ("ID_Etiqueta", "Nombre_etiqueta")
                        VALUES (%s, %s)
                    """, (id_etiqueta, nombre))
                cursor.execute("""
                    INSERT INTO public."Notas_etiquetas" ("ID_Nota", "ID_Etiqueta")
                    VALUES (%s, %s)
                """, (nota_id, id_etiqueta))

        conexion.commit()

        return jsonify({
            'success': True,
            'mensaje': 'Nota de dibujo guardada correctamente',
            'nota_id': nota_id,
            'redirect': '/notas'
        }), 201

    except Exception as e:
        if conexion:
            conexion.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Error al guardar la nota de dibujo'}), 500

    finally:
        cerrar_db(cursor, conexion)


# ==============================================================================
# 13. Ruta backend de guardar nota de imagen
# ==============================================================================

IMAGEN_UPLOAD_FOLDER = os.path.join(BASE_DIR, "static", "uploads", "imagenes")
if not os.path.exists(IMAGEN_UPLOAD_FOLDER):
    os.makedirs(IMAGEN_UPLOAD_FOLDER)


@app.route('/guardar-nota-imagen', methods=['POST'])
@login_required
def guardar_nota_imagen():
    """
    Recibe la imagen editada (canvas procesado) como PNG (multipart/form-data),
    la guarda en disco y crea una nota de tipo 'imagen' en la BD.
    """
    user_id = session['usuario_id']
    conexion = None
    cursor   = None

    try:
        # ── 1. Validar campos ──────────────────────────────────────────────
        titulo        = request.form.get('titulo',      '').strip() or 'Imagen sin título'
        descripcion   = request.form.get('descripcion', '').strip() or f'Nota de imagen: {titulo}'
        etiquetas_raw = request.form.get('etiquetas',   '').strip()

        archivo = request.files.get('imagen')
        if not archivo or archivo.filename == '':
            return jsonify({'error': 'No se recibió ninguna imagen'}), 400

        ext = os.path.splitext(archivo.filename)[1].lower()
        if ext not in {'.png', '.jpg', '.jpeg', '.webp'}:
            return jsonify({'error': 'Formato de imagen no permitido'}), 400

        # ── 2. Guardar archivo físico ──────────────────────────────────────
        filename      = f"imagen_{user_id}_{_uuid.uuid4().hex}{ext}"
        ruta_completa = os.path.join(IMAGEN_UPLOAD_FOLDER, filename)
        archivo.save(ruta_completa)
        ruta_db = f"uploads/imagenes/{filename}"

        # ── 3. Conectar BD ─────────────────────────────────────────────────
        conexion = conectar_db()
        if conexion is None:
            return jsonify({'error': 'Error de conexión a la base de datos'}), 500

        cursor = conexion.cursor()
        hoy    = datetime.now()

        # ── 4. Insertar nota ───────────────────────────────────────────────
        cursor.execute('SELECT COALESCE(MAX("ID_Nota"), 0) + 1 FROM public."Notas"')
        nuevo_id_nota = cursor.fetchone()[0]

        cursor.execute("""
            INSERT INTO public."Notas"
                ("ID_Nota", "Titulo", "Descripcion", "Contenido",
                 "Fecha_decreacion", "Fecha_deedicion",
                 "Estado", "Formato", "ID_Cuenta", "ID_Carpeta")
            VALUES (%s, %s, %s, %s, %s, %s, 'Activa', 'imagen', %s, NULL)
            RETURNING "ID_Nota"
        """, (nuevo_id_nota, titulo, descripcion, '', hoy, hoy, user_id))
        nota_id = cursor.fetchone()[0]

        # ── 5. Registrar adjunto ───────────────────────────────────────────
        cursor.execute('SELECT COALESCE(MAX("ID_Adjunto"), 0) + 1 FROM public."Adjuntos"')
        nuevo_id_adj = cursor.fetchone()[0]

        cursor.execute("""
            INSERT INTO public."Adjuntos"
                ("ID_Adjunto", "Nombre_archivo", "Formato", "Ruta_archivo", "ID_Nota")
            VALUES (%s, %s, %s, %s, %s)
        """, (nuevo_id_adj, filename, ext.lstrip('.'), ruta_db, nota_id))

        # ── 6. Registrar etiquetas ─────────────────────────────────────────
        if etiquetas_raw:
            etiquetas = [e.strip() for e in etiquetas_raw.split(',') if e.strip()]
            for nombre in etiquetas:
                cursor.execute("""
                    SELECT "ID_Etiqueta" FROM public."Etiquetas"
                    WHERE LOWER("Nombre_etiqueta") = LOWER(%s)
                """, (nombre,))
                row = cursor.fetchone()
                if row:
                    id_etiqueta = row[0]
                else:
                    cursor.execute('SELECT COALESCE(MAX("ID_Etiqueta"), 0) + 1 FROM public."Etiquetas"')
                    id_etiqueta = cursor.fetchone()[0]
                    cursor.execute("""
                        INSERT INTO public."Etiquetas" ("ID_Etiqueta", "Nombre_etiqueta")
                        VALUES (%s, %s)
                    """, (id_etiqueta, nombre))
                cursor.execute("""
                    INSERT INTO public."Notas_etiquetas" ("ID_Nota", "ID_Etiqueta")
                    VALUES (%s, %s)
                """, (nota_id, id_etiqueta))

        conexion.commit()

        return jsonify({
            'success': True,
            'mensaje': 'Nota de imagen guardada correctamente',
            'nota_id': nota_id,
            'redirect': '/notas'
        }), 201

    except Exception as e:
        if conexion:
            conexion.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Error al guardar la nota de imagen'}), 500

    finally:
        cerrar_db(cursor, conexion)
# ==============================================================================
# 14. Ruta backend de guardar nota de TEXTO

# ==============================================================================

TEXTO_UPLOAD_FOLDER = os.path.join(BASE_DIR, "static", "uploads", "textos")
if not os.path.exists(TEXTO_UPLOAD_FOLDER):
    os.makedirs(TEXTO_UPLOAD_FOLDER)


@app.route('/guardar-nota-texto', methods=['POST'])
@login_required
def guardar_nota_texto():
    """
    Recibe el contenido HTML del editor de texto y lo guarda como nota
    de tipo 'texto' en la BD. El HTML se almacena en el campo Contenido.
    No genera adjunto de archivo físico — el contenido vive en la BD.
    """
    user_id  = session['usuario_id']
    conexion = None
    cursor   = None

    try:
        # ── 1. Leer campos ─────────────────────────────────────────────────
        titulo        = request.form.get('titulo',      '').strip() or 'Nota sin título'
        descripcion   = request.form.get('descripcion', '').strip() or f'Nota de texto: {titulo}'
        contenido     = request.form.get('contenido',   '').strip()
        etiquetas_raw = request.form.get('etiquetas',   '').strip()

        if not contenido:
            return jsonify({'error': 'El contenido de la nota está vacío'}), 400

        # ── 2. Conectar BD ─────────────────────────────────────────────────
        conexion = conectar_db()
        if conexion is None:
            return jsonify({'error': 'Error de conexión a la base de datos'}), 500

        cursor = conexion.cursor()
        hoy    = datetime.now()

        # ── 3. Insertar nota ───────────────────────────────────────────────
        cursor.execute('SELECT COALESCE(MAX("ID_Nota"), 0) + 1 FROM public."Notas"')
        nuevo_id_nota = cursor.fetchone()[0]

        cursor.execute("""
            INSERT INTO public."Notas"
                ("ID_Nota", "Titulo", "Descripcion", "Contenido",
                 "Fecha_decreacion", "Fecha_deedicion",
                 "Estado", "Formato", "ID_Cuenta", "ID_Carpeta")
            VALUES (%s, %s, %s, %s, %s, %s, 'Activa', 'texto', %s, NULL)
            RETURNING "ID_Nota"
        """, (nuevo_id_nota, titulo, descripcion, contenido, hoy, hoy, user_id))
        nota_id = cursor.fetchone()[0]

        # ── 4. Registrar etiquetas ─────────────────────────────────────────
        if etiquetas_raw:
            etiquetas = [e.strip() for e in etiquetas_raw.split(',') if e.strip()]
            for nombre in etiquetas:
                cursor.execute("""
                    SELECT "ID_Etiqueta" FROM public."Etiquetas"
                    WHERE LOWER("Nombre_etiqueta") = LOWER(%s)
                """, (nombre,))
                row = cursor.fetchone()
                if row:
                    id_etiqueta = row[0]
                else:
                    cursor.execute('SELECT COALESCE(MAX("ID_Etiqueta"), 0) + 1 FROM public."Etiquetas"')
                    id_etiqueta = cursor.fetchone()[0]
                    cursor.execute("""
                        INSERT INTO public."Etiquetas" ("ID_Etiqueta", "Nombre_etiqueta")
                        VALUES (%s, %s)
                    """, (id_etiqueta, nombre))
                cursor.execute("""
                    INSERT INTO public."Notas_etiquetas" ("ID_Nota", "ID_Etiqueta")
                    VALUES (%s, %s)
                """, (nota_id, id_etiqueta))

        conexion.commit()

        return jsonify({
            'success': True,
            'mensaje': 'Nota de texto guardada correctamente',
            'nota_id': nota_id,
            'redirect': '/notas'
        }), 201

    except Exception as e:
        if conexion:
            conexion.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Error al guardar la nota de texto'}), 500

    finally:
        cerrar_db(cursor, conexion)


# ==============================================================================
# 15 - EDITOR DE AUDIO — Rutas y lógica de backend
# ==============================================================================

# ── Carpeta de uploads de audios ──────────────────────────────────────────────
AUDIO_UPLOAD_FOLDER = os.path.join(BASE_DIR, "static", "uploads", "audios")
if not os.path.exists(AUDIO_UPLOAD_FOLDER):
    os.makedirs(AUDIO_UPLOAD_FOLDER)

# Extensiones y tipos MIME permitidos para audio
AUDIO_EXTENSIONES_PERMITIDAS = {'.mp3', '.aac', '.ogg', '.wav', '.flac', '.wma', '.m4a', '.webm'}
AUDIO_TIPOS_MIME_PERMITIDOS  = {
    'audio/mpeg', 'audio/mp3', 'audio/aac', 'audio/ogg', 'audio/wav',
    'audio/flac', 'audio/x-flac', 'audio/wma', 'audio/x-ms-wma',
    'audio/mp4', 'audio/x-m4a', 'audio/webm', 'video/webm'
}
AUDIO_MAX_BYTES = 200 * 1024 * 1024   # 200 MB


# ── Vista del editor de audio ─────────────────────────────────────────────────
@app.route('/crear-nota-audio')
@login_required
def crear_nota_audio():
    """Página del editor de audio."""
    return render_template("editoraudio.html")


# ── Guardar nota de audio ─────────────────────────────────────────────────────
@app.route('/guardar-nota-audio', methods=['POST'])
@login_required
def guardar_nota_audio():
    """
    Recibe el archivo de audio (multipart/form-data), lo valida,
    lo guarda en disco y crea una nota de tipo 'audio' en la BD.

    Campos del formulario:
        titulo        — str, máx 100 chars
        descripcion   — str, máx 200 chars (opcional)
        etiquetas     — str, separadas por coma (opcional)
        audio         — File

    Respuesta JSON:
        { success: True, nota_id: int, redirect: '/notas' }
        { error: 'mensaje' }
    """
    user_id  = session['usuario_id']
    conexion = None
    cursor   = None

    try:
        # ── 1. Leer campos de texto ────────────────────────────────────────
        titulo        = request.form.get('titulo',      '').strip() or 'Audio sin título'
        descripcion   = request.form.get('descripcion', '').strip() or f'Nota de audio: {titulo}'
        etiquetas_raw = request.form.get('etiquetas',   '').strip()

        # ── 2. Validar archivo ─────────────────────────────────────────────
        archivo = request.files.get('audio')
        if not archivo or archivo.filename == '':
            return jsonify({'error': 'No se recibió ningún archivo de audio'}), 400

        ext = os.path.splitext(archivo.filename)[1].lower()
        if ext not in AUDIO_EXTENSIONES_PERMITIDAS:
            return jsonify({
                'error': f'Formato no permitido ({ext}). '
                          'Usa: MP3, AAC, OGG, WAV, FLAC, WMA, M4A'
            }), 400

        # Leer los bytes para verificar el tamaño real
        audio_bytes = archivo.read()
        if len(audio_bytes) > AUDIO_MAX_BYTES:
            return jsonify({'error': 'El archivo supera el límite de 200 MB'}), 400

        # ── 3. Guardar archivo físico ──────────────────────────────────────
        filename      = f"audio_{user_id}_{_uuid.uuid4().hex}{ext}"
        ruta_completa = os.path.join(AUDIO_UPLOAD_FOLDER, filename)

        with open(ruta_completa, 'wb') as f:
            f.write(audio_bytes)

        ruta_db = f"uploads/audios/{filename}"

        # ── 4. Conectar BD ─────────────────────────────────────────────────
        conexion = conectar_db()
        if conexion is None:
            # Limpiar archivo ya guardado
            try: os.remove(ruta_completa)
            except: pass
            return jsonify({'error': 'Error de conexión a la base de datos'}), 500

        cursor = conexion.cursor()
        hoy    = datetime.now()

        # ── 5. Insertar nota ───────────────────────────────────────────────
        cursor.execute('SELECT COALESCE(MAX("ID_Nota"), 0) + 1 FROM public."Notas"')
        nuevo_id_nota = cursor.fetchone()[0]

        cursor.execute("""
            INSERT INTO public."Notas"
                ("ID_Nota", "Titulo", "Descripcion", "Contenido",
                 "Fecha_decreacion", "Fecha_deedicion",
                 "Estado", "Formato", "ID_Cuenta", "ID_Carpeta")
            VALUES (%s, %s, %s, %s, %s, %s, 'Activa', 'audio', %s, NULL)
            RETURNING "ID_Nota"
        """, (nuevo_id_nota, titulo, descripcion, '', hoy, hoy, user_id))

        nota_id = cursor.fetchone()[0]

        # ── 6. Registrar adjunto ───────────────────────────────────────────
        formato_adj = ext.lstrip('.')   # ej: "ogg", "mp3", "wav"

        # Garantizar que el formato exista en Tipos (FK requerida)
        cursor.execute("""
            INSERT INTO public."Tipos" ("Formato")
            VALUES (%s)
            ON CONFLICT ("Formato") DO NOTHING
        """, (formato_adj,))

        cursor.execute('SELECT COALESCE(MAX("ID_Adjunto"), 0) + 1 FROM public."Adjuntos"')
        nuevo_id_adj = cursor.fetchone()[0]

        cursor.execute("""
            INSERT INTO public."Adjuntos"
                ("ID_Adjunto", "Nombre_archivo", "Formato", "Ruta_archivo", "ID_Nota")
            VALUES (%s, %s, %s, %s, %s)
        """, (nuevo_id_adj, filename, formato_adj, ruta_db, nota_id))

        # ── 7. Registrar etiquetas ─────────────────────────────────────────
        if etiquetas_raw:
            etiquetas = [e.strip() for e in etiquetas_raw.split(',') if e.strip()]
            for nombre in etiquetas:
                cursor.execute("""
                    SELECT "ID_Etiqueta" FROM public."Etiquetas"
                    WHERE LOWER("Nombre_etiqueta") = LOWER(%s)
                """, (nombre,))
                row = cursor.fetchone()
                if row:
                    id_etiqueta = row[0]
                else:
                    cursor.execute(
                        'SELECT COALESCE(MAX("ID_Etiqueta"), 0) + 1 FROM public."Etiquetas"'
                    )
                    id_etiqueta = cursor.fetchone()[0]
                    cursor.execute("""
                        INSERT INTO public."Etiquetas" ("ID_Etiqueta", "Nombre_etiqueta")
                        VALUES (%s, %s)
                    """, (id_etiqueta, nombre))
                cursor.execute("""
                    INSERT INTO public."Notas_etiquetas" ("ID_Nota", "ID_Etiqueta")
                    VALUES (%s, %s)
                """, (nota_id, id_etiqueta))

        conexion.commit()

        return jsonify({
            'success': True,
            'mensaje': 'Nota de audio guardada correctamente',
            'nota_id': nota_id,
            'redirect': '/notas'
        }), 201

    except Exception as e:
        if conexion:
            conexion.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Error al guardar la nota de audio'}), 500

    finally:
        cerrar_db(cursor, conexion)

## ===============================================================================
## 16. Editor de video - Ruta BACK END
## ===============================================================================

@app.route('/crear-nota-video')
@login_required
def crear_nota_video():
    """Página del editor de video."""
    return render_template("editorvideo.html")

# ==============================================================================
# 17. CONFIGURACIÓN DE LA BASE DE DATOS CON SQLALCHEMY (solo modelos para docker)
# ==============================================================================

db = SQLAlchemy(app)

# =========================
# CUENTAS
# =========================
class Cuentas(db.Model):
    __tablename__ = "Cuentas"

    ID_Cuenta = db.Column(db.Integer, primary_key=True)
    Usuario = db.Column(db.Text, nullable=False)
    Contraseña = db.Column(db.Text, nullable=False)
    Nombres = db.Column(db.Text, nullable=False)
    Apellidos = db.Column(db.Text, nullable=False)
    Telefono = db.Column(db.Numeric(15,0), nullable=False)
    Correo = db.Column(db.Text, nullable=False)
    Color_principal = db.Column(db.Text, nullable=False)
    reset_token = db.Column(db.Text)
    reset_token_expira = db.Column(db.DateTime(timezone=True))
    Foto = db.Column(db.Text)

    notas = db.relationship("Notas", backref="cuenta", lazy=True)
    carpetas = db.relationship("Carpetas", backref="cuenta", lazy=True)


# =========================
# CARPETAS
# =========================
class Carpetas(db.Model):
    __tablename__ = "Carpetas"

    ID_Carpeta = db.Column(db.Integer, primary_key=True)
    Nombre_carpeta = db.Column(db.Text, nullable=False)
    ID_Cuenta = db.Column(db.Integer, db.ForeignKey("Cuentas.ID_Cuenta"), nullable=False)
    Estado = db.Column(db.Text, nullable=False)

    notas = db.relationship("Notas", backref="carpeta", lazy=True)


# =========================
# NOTAS
# =========================
class Notas(db.Model):
    __tablename__ = "Notas"

    ID_Nota = db.Column(db.Integer, primary_key=True)
    Fecha_decreacion = db.Column(db.Date, nullable=False)
    Contenido = db.Column(db.Text, nullable=False)
    Descripcion = db.Column(db.Text, nullable=False)
    Titulo = db.Column(db.Text, nullable=False)
    Fecha_deedicion = db.Column(db.Date, nullable=False)
    Estado = db.Column(db.Text, nullable=False)
    Formato = db.Column(db.Text, nullable=False)

    ID_Carpeta = db.Column(db.Integer, db.ForeignKey("Carpetas.ID_Carpeta"))
    ID_Cuenta = db.Column(db.Integer, db.ForeignKey("Cuentas.ID_Cuenta"), nullable=False)


    adjuntos = db.relationship("Adjuntos", backref="nota", lazy=True)


# =========================
# ETIQUETAS
# =========================
class Etiquetas(db.Model):  
    __tablename__ = "Etiquetas"

    ID_Etiqueta = db.Column(db.Integer, primary_key=True)
    Nombre_etiqueta = db.Column(db.Text)

    notas = db.relationship("Notas_etiquetas", backref="etiqueta", lazy=True)


# =========================
# NOTAS_ETIQUETAS (tabla puente)
# =========================
class Notas_etiquetas(db.Model):
    __tablename__ = "Notas_etiquetas"

    ID_Nota = db.Column(db.Integer, db.ForeignKey("Notas.ID_Nota"), primary_key=True)
    ID_Etiqueta = db.Column(db.Integer, db.ForeignKey("Etiquetas.ID_Etiqueta"), primary_key=True)


# =========================
# ADJUNTOS
# =========================
class Adjuntos(db.Model):
    __tablename__ = "Adjuntos"

    ID_Adjunto = db.Column(db.Integer, primary_key=True)
    Nombre_archivo = db.Column(db.Text, nullable=False)
    Formato = db.Column(db.Text, nullable=False)
    Ruta_archivo = db.Column(db.Text, nullable=False)
    ID_Nota = db.Column(db.Integer, db.ForeignKey("Notas.ID_Nota"), nullable=False)


# =========================
# TIPOS
# =========================
class Tipos(db.Model):
    __tablename__ = "Tipos"

    Formato = db.Column(db.Text, primary_key=True)

with app.app_context():
    print("ATENCION: CREANDO TABLAS ")
    db.create_all()
