# -*- coding: utf-8 -*-

# =============================================== IMPORTACIONES =========================================================
from flask import Flask, jsonify, render_template, request, redirect, url_for, session
from flask_mail import Mail, Message
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


@app.route('/procesar-registro', methods=['POST'])
def procesar_registro():
    """Procesa el registro de un nuevo usuario."""
    conexion = None
    cursor = None
    try:
        conexion = conectar_db()
        if conexion is None:
            return jsonify({'error': 'No se pudo conectar a la base de datos'}), 500

        # Limpiar datos del formulario
        campos = ['nombre', 'apellido', 'telefono', 'correo', 'usuario', 'contraseña']
        datos_limpios = limpiar_datos_formulario(request.form, campos)
        
        nombres = datos_limpios['nombre']
        apellidos = datos_limpios['apellido']
        telefono = datos_limpios['telefono']
        correo = datos_limpios['correo']
        usuario = datos_limpios['usuario']
        contraseña = datos_limpios['contraseña']
        color_principal = request.form.get('color_principal', 'Blanco').strip()

        # Validaciones
        if not all([nombres, apellidos, telefono, correo, usuario, contraseña]):
            return jsonify({'error': 'Todos los campos son obligatorios'}), 400

        if not re.match(r'^\+?[0-9]{7,15}$', telefono):
            return jsonify({'error': 'El teléfono debe contener entre 7 y 15 dígitos'}), 400

        cursor = conexion.cursor()

        # Verificar duplicados
        cursor.execute("""
            SELECT "ID_Cuenta" FROM public."Cuentas"
            WHERE "Usuario" = %s OR "Correo" = %s
        """, (usuario, correo))
        
        if cursor.fetchone():
            return jsonify({'error': 'El usuario o correo ya está registrado en NoteFlow'}), 409

        # Generar nuevo ID_Cuenta
        cursor.execute('SELECT COALESCE(MAX("ID_Cuenta"), 0) + 1 FROM public."Cuentas"')
        nuevo_id = cursor.fetchone()[0]

        # Hashear la contraseña
        password_hash = generate_password_hash(contraseña)

        cursor.execute("""
            INSERT INTO public."Cuentas"
            ("ID_Cuenta", "Usuario", "Contraseña", "Nombres", "Apellidos", "Telefono", "Correo", "Color_principal")
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING "ID_Cuenta";
        """, (nuevo_id, usuario, password_hash, nombres, apellidos, telefono, correo, color_principal))

        cuenta_id = cursor.fetchone()[0]
        conexion.commit()

        # Iniciar sesión automáticamente
        session['usuario_id'] = cuenta_id
        session['usuario_nombre'] = usuario

        return jsonify({
            'success': True,
            'mensaje': 'Registro exitoso',
            'id': cuenta_id,
            'redirect': '/dashboard'
        }), 201

    except Exception as e:
        if conexion:
            conexion.rollback()
        print(f"Error al registrar el usuario: {e}")
        return jsonify({'error': 'Error al procesar la solicitud'}), 500

    finally:
        cerrar_db(cursor, conexion)


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
            # Ya es hash, verificar con check_password_hash
            if check_password_hash(password_guardado, contraseña):
                login_exitoso = True
        else:
            # Es texto plano (usuario viejo), comparar directo
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
                    # No fallar el login por esto
        
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
            # Renderizar la misma página pero con mensaje consistente
            return render_template("cuenta_no_registrada.html")

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
    """Muestra el formulario para ingresar el correo electrónico."""
    return render_template('olvide_contrasena.html')


@app.route('/procesar-olvide-contrasena', methods=['POST'])
def procesar_olvide_contrasena():
    """Genera token, lo guarda y envía el correo."""
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
            'mensaje': 'Si,tu correo está registrado, recibirás un enlace de restablecimiento en breve.'
        }), 200

    except Exception as e:
        if conexion:
            conexion.rollback()
        print(f"Error en procesar-olvide-contrasena: {e}")
        return jsonify({'error': 'Error interno del servidor. Intenta más tarde.'}), 500

    finally:
        cerrar_db(cursor, conexion)


@app.route('/restablecer-contrasena/<token>')
def mostrar_restablecer_contrasena(token):
    """Muestra el formulario de restablecimiento con validación de token"""
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
            return render_template("restablecer_contrasena.html", token=None, error="El enlace de restablecimiento no es válido o ha expirado. Vuelve a solicitar uno.")

    except Exception as e:
        print(f"Error al verificar token: {e}")
        return render_template("restablecer_contrasena.html", token=None, error="Error interno al procesar la solicitud.")

    finally:
        cerrar_db(cursor, conexion)


@app.route('/procesar-restablecer-contrasena', methods=['POST'])
def procesar_restablecer_contrasena():
    """Procesa el cambio de contraseña"""
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
            return jsonify({'error': 'El enlace ha expirado o es inválido. Intenta de nuevo.'}), 401

        usuario_id = usuario_id_row[0]

        # Hashear la nueva contraseña
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
    """Limpia la sesión activa y redirige a la página de inicio."""
    session.clear()
    return redirect(url_for('inicio'))


@app.route("/perfil/cerrar-sesion")
@login_required
def cerrar_sesion_perfil():
    """Cierra la sesión del usuario y redirige al login"""
    session.clear()
    return redirect(url_for('mostrar_login'))


# ==============================================================================
# 7. DASHBOARD CON NOTAS RECIENTES
# ==============================================================================
@app.route('/dashboard')
@login_required
def dashboard():
    """
    Carga página de dashboard con:
      - datos del usuario (Nombres, color_principal, Foto)
      - conteos: notas activas, carpetas, notas en papelera
      - listado de notas recientes (limit 6)
    """
    user_id = session['usuario_id']
  
    conexion = None
    cursor = None
    try:
        conexion = conectar_db()
        cursor = conexion.cursor(cursor_factory=RealDictCursor)

        # Datos del usuario
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
            'nombre': usuario_row.get('Nombres'),
            'color_principal': usuario_row.get('Color_principal', 'Blanco'),
            'foto': usuario_row.get('Foto') if usuario_row.get('Foto') else 'img/default_profile.png'
        }

        # Conteos
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

        # Notas recientes (limit 6)
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
# 8. SECCIÓN PERFIL COMPLETA
# ==============================================================================
@app.route('/perfil')
@login_required
def perfil():
    """Muestra la página de perfil del usuario con toda su información"""
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


# --- CAMBIAR TEMA ---
@app.route('/perfil/cambiar-tema', methods=['POST'])
@login_required
def cambiar_tema():
    """Cambia el tema del usuario entre claro y oscuro"""
    tema = request.form.get("tema")
     
    if tema not in ["claro", "oscuro"]:
        return jsonify({"error": "Tema inválido"}), 400

    color_map = {
        "claro": "Blanco",
        "oscuro": "Negro"
    }
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

        return jsonify({
            "success": True,
            "mensaje": f"Tema cambiado a {tema}"
        }), 200

    except Exception as e:
        if conexion:
            conexion.rollback()
        print(f"Error al cambiar tema: {e}")
        return jsonify({"error": "Error al actualizar tema"}), 500

    finally:
        cerrar_db(cursor, conexion)


# --- CAMBIAR CONTRASEÑA ---
@app.route('/perfil/cambiar-password', methods=['POST'])
@login_required
def cambiar_password():
    """Cambia la contraseña del usuario"""
    user_id = session["usuario_id"]

    # Limpiar datos
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
        
        # Verificar contraseña actual (puede ser hash o texto plano)
        password_actual_correcta = False
        if password_guardado.startswith('pbkdf2:sha256:') or password_guardado.startswith('scrypt:'):
            # Es hash
            if check_password_hash(password_guardado, actual):
                password_actual_correcta = True
        else:
            # Es texto plano
            if password_guardado == actual:
                password_actual_correcta = True
        
        if not password_actual_correcta:
            return jsonify({"error": "La contraseña actual es incorrecta"}), 401

        # Verificar que la nueva sea diferente
        # Si la guardada es hash, comparar con check_password_hash
        if password_guardado.startswith('pbkdf2:sha256:') or password_guardado.startswith('scrypt:'):
            if check_password_hash(password_guardado, nueva):
                return jsonify({"error": "La nueva contraseña debe ser diferente"}), 400
        else:
            # Si es texto plano, comparar directo
            if password_guardado == nueva:
                return jsonify({"error": "La nueva contraseña debe ser diferente"}), 400
 
        # Hashear la nueva contraseña
        nuevo_hash = generate_password_hash(nueva)
        
        cursor.execute("""
            UPDATE public."Cuentas"
            SET "Contraseña" = %s
            WHERE "ID_Cuenta" = %s
        """, (nuevo_hash, user_id))

        conexion.commit()

        return jsonify({
            "success": True,
            "mensaje": "Contraseña actualizada exitosamente"
        }), 200

    except Exception as e:
        if conexion:
            conexion.rollback()
        print(f"Error al cambiar contraseña: {e}")
        return jsonify({"error": "Error al procesar la solicitud"}), 500

    finally:
        cerrar_db(cursor, conexion)


# --- SUBIR FOTO DE PERFIL ---
@app.route('/perfil/subir-foto', methods=["POST"])
@login_required
def subir_foto():
    """Sube y actualiza la foto de perfil del usuario"""
    archivo = request.files.get("foto")

    if not archivo or archivo.filename == '':
        return jsonify({"error": "No se seleccionó ninguna imagen"}), 400

    if not allowed_file(archivo.filename):
        return jsonify({
            "error": "Formato no permitido. Usa: PNG, JPG, JPEG, GIF o WEBP"
        }), 400

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

# ==============================================================================
# RUTA: MIS NOTAS  
# ==============================================================================

@app.route("/notas")
@login_required
def mostrar_notas():
    """Muestra todas las notas activas y carpetas del usuario logueado."""
    user_id = session['usuario_id']
    conexion = None
    cursor = None

    try:
        conexion = conectar_db(dict_cursor=True)
        cursor = conexion.cursor()

        # ── 1. Datos del usuario (para el header + tema) ──────────────────────
        cursor.execute("""
            SELECT "Nombres", "Foto", "Color_principal"
            FROM public."Cuentas"
            WHERE "ID_Cuenta" = %s
        """, (user_id,))
        usuario = cursor.fetchone()

        if not usuario:
            session.clear()
            return redirect(url_for('mostrar_login'))

        # ── 2. Notas activas del usuario ──────────────────────────────────────
        cursor.execute("""
            SELECT
                "ID_Nota",
                "Titulo",
                "Descripcion",
                "Fecha_deedicion",
                "Formato",
                "Estado"
            FROM public."Notas"
            WHERE "ID_Cuenta" = %s
              AND LOWER("Estado") = 'activa'
            ORDER BY "Fecha_deedicion" DESC NULLS LAST
        """, (user_id,))
        notas = cursor.fetchall()

        # ── 3. Carpetas activas del usuario (con fecha de última modificación) ─
        cursor.execute("""
            SELECT
                c."ID_Carpeta",
                c."Nombre_carpeta",
                COUNT(n."ID_Nota")         AS "Total_notas",
                MAX(n."Fecha_deedicion")   AS "Ultima_modificacion"
            FROM public."Carpetas" c
            LEFT JOIN public."Notas" n
                   ON n."ID_Carpeta" = c."ID_Carpeta"
                  AND LOWER(n."Estado") = 'activa'
            WHERE c."ID_Cuenta" = %s
              AND LOWER(c."Estado") = 'activa'
            GROUP BY c."ID_Carpeta", c."Nombre_carpeta"
            ORDER BY "Ultima_modificacion" DESC NULLS LAST
        """, (user_id,))
        carpetas = cursor.fetchall()

        return render_template(
            "notas.html",
            notas=notas,
            carpetas=carpetas,
            usuario=usuario
        )

    except Exception as e:
        import traceback
        traceback.print_exc()
        return f"Error al cargar las notas: {str(e)}", 500

    finally:
        cerrar_db(cursor, conexion)
# ==============================================================================
# RUTAS NUEVAS — pegar justo ANTES del bloque "if __name__ == '__main__':"
# ==============================================================================


# ==============================================================================
# PAPELERA
# ==============================================================================
@app.route('/papelera')
@login_required
def papelera():
    """
    Muestra las notas en papelera del usuario con sesión activa.
    Solo accesible si hay sesión; de lo contrario redirige al login.
    """
    user_id = session['usuario_id']
    conexion = None
    cursor = None

    try:
        conexion = conectar_db(dict_cursor=True)
        cursor = conexion.cursor()

        # Datos del usuario (header + tema)
        cursor.execute("""
            SELECT "Nombres", "Foto", "Color_principal"
            FROM public."Cuentas"
            WHERE "ID_Cuenta" = %s
        """, (user_id,))
        usuario = cursor.fetchone()

        if not usuario:
            session.clear()
            return redirect(url_for('mostrar_login'))

        # Notas en papelera del usuario
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
            "fasededesarrollo.html",
            notas_papelera=notas_papelera,
            usuario=usuario
        )

    except Exception as e:
        import traceback
        traceback.print_exc()
        return f"Error al cargar la papelera: {str(e)}", 500

    finally:
        cerrar_db(cursor, conexion)


# ==============================================================================
# CREAR NOTA
# ==============================================================================
@app.route('/crear-nota')
@login_required
def crear_nota():
    """
    Página de creación de nota.
    Protegida por sesión — redirige al login si no hay sesión activa.
    Por ahora muestra la página de fase de desarrollo.
    """
    return render_template("fasededesarrollo.html")



# ==============================================================================
# RUN
# ==============================================================================
if __name__ == "__main__":
    app.run(
        debug=True,
        host="127.0.0.1",
        port=5000
    )