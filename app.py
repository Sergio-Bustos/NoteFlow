# -*- coding: utf-8 -*-

# =============================================== IMPORTACIONES =========================================================
from flask import Flask, jsonify, render_template, request, redirect, url_for, session # Importaciones nesesarias de Flask
from flask_mail import Mail, Message # Importaciones para enviar correos
import psycopg2 # Importación para conectar con PostgreSQL
from psycopg2.extras import RealDictCursor # Cursor que devuelve diccionarios
from google_auth_oauthlib.flow import Flow # Importación para OAuth con Google
import requests # Importación para hacer solicitudes HTTP
import os # Importación para manejo de rutas y variables de entorno
import uuid # Importación para generar IDs únicos 
from datetime import datetime, timedelta # Importaciones para manejo de fechas y tiempos
import secrets # Importación para generar tokens seguros
from werkzeug.utils import secure_filename # Importación para asegurar nombres de archivos
from dotenv import load_dotenv # Importación para cargar variables de entorno desde .env
load_dotenv() # Cargar variables de entorno desde archivo .env
# =====================================================================================================================

# ======================== Configuración OAuth en HTTP (desarrollo) ==========================
os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1" 
# Datos de Google OAuth desde .env 
GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID')
GOOGLE_CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET')
GOOGLE_REDIRECT_URI = os.getenv('GOOGLE_REDIRECT_URI')
# ============================================================================================

# ======================== Configuración de Flask ==========================
app = Flask(__name__)
app.secret_key = 'tu_clave_secreta_aqui_cambiala'
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
    'host': 'localhost', 
    'database': 'dbnoteflow',
    'user': 'postgres',
    'password': '123456',
    'port': 5432
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
# FUNCIÓN: Conectar a la base de datos
# ======================================================================
def conectar_db(dict_cursor=False): # Funcion para conectar a PostgreSQL
    """Crea y devuelve una conexión a PostgreSQL.""" 
    try: # try para que el programa no se caiga si hay un error
        cursor_factory = RealDictCursor if dict_cursor else None # Elegir tipo de cursor
        conn = psycopg2.connect(cursor_factory=cursor_factory, **DB_CONFIG) # Conectar a la base de datos
        conn.set_client_encoding('UTF8') # Asegurar codificación UTF-8
        return conn # Devolver la conexión
    except psycopg2.Error as e: # Manejo de errores de conexión con variable e
        print(f"ERROR DE CONEXIÓN A POSTGRESQL: {e}")  # Imprimir error en consola
        return None # Devolver None si hay error

# ======================================================================
# FUNCIÓN: Verificar extensión de archivo
# ======================================================================
def allowed_file(filename): # Verificar si el archivo tiene una extensión permitida
    """Verifica si la extensión del archivo es válida"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS # las anteriores que guardamos en el diccionario

# ======================================================================
# FUNCIÓN: Obtener etiquetas de una nota (para notas recientes)
# ======================================================================
def obtener_etiquetas_nota(nota_id, cursor):  # Funcion para obtener etiquetas de una nota
    """Obtiene las etiquetas asociadas a una nota."""
    cursor.execute(""" 
        SELECT e."ID_Etiqueta", e."Nombre_etiqueta"
        FROM public."Notas_etiquetas" ne
        JOIN public."Etiquetas" e ON ne."ID_Etiqueta" = e."ID_Etiqueta"
        WHERE ne."ID_Nota" = %s
        ORDER BY e."Nombre_etiqueta" ASC
    """, (nota_id,)) # Selecciona el id y el nonmbre de la etiqueta donde el id sea el mismo que el de la nota
    # Ejecuta la consulta SQL para obtener las etiquetas de la nota
    rows = cursor.fetchall()
    if rows and isinstance(rows[0], dict): # Si el cursor devuelve diccionarios
        return rows # Devolver las filas tal cual
    return [{'ID_Etiqueta': r[0], 'Nombre_etiqueta': r[1]} for r in rows] # Devolver las filas como diccionarios

# ======================================================================
# FUNCIÓN: Verificar si una nota tiene adjuntos (para notas recientes)
# ======================================================================  
def verificar_adjuntos_nota(nota_id, cursor): # Funcion para verificar si una nota tiene adjuntos
    """Devuelve True si la nota tiene al menos un adjunto.""" 
    cursor.execute("""
        SELECT COUNT(*) AS total
        FROM public."Adjuntos"
        WHERE "ID_Nota" = %s
    """, (nota_id,)) # Consulta para contar adjuntos de la nota
    row = cursor.fetchone() # Obtener la fila resultante
    if isinstance(row, dict): # Si el cursor devuelve diccionarios
        total = row.get('total', 0) # Obtener el total desde el diccionario
    else: # Si el cursor devuelve tuplas
        total = row[0] # Obtener el total desde la tupla
    return int(total) > 0 # Devolver True si hay al menos un adjunto

# ==============================================================================
#  1. PÁGINA DE BIENVENIDA
# ==============================================================================
@app.route('/') # Ruta principal
def inicio(): # Funcion que lo muestra
    """Página de bienvenida (antes de autenticarse)."""
    return render_template("bienvenidoalapagina.html") # Renderizar plantilla de bienvenida

@app.route('/caracteristicas.html') # Ruta de características
def caracteristicas(): # Funcion que lo muestra
    """Página de características."""
    return render_template("caracteristicas.html") # Renderizar plantilla de características

# ==============================================================================
#  2. REGISTRARSE
# ==============================================================================
@app.route('/registro.html') # Ruta de registro
def mostrar_registro(): # Funcion que lo muestra
    """Formulario de registro."""
    return render_template("registro.html") # Renderizar plantilla de registro

@app.route('/procesar-registro', methods=['POST']) # Ruta para procesar el registro
def procesar_registro(): # Funcion para procesar el registro
    """Procesa el registro de un nuevo usuario.""" 
    conexion = None # Conexion a la base de datos nula por ahora
    cursor = None # al igual que el cursor para devolver filas en formato diccionario
    try: # try para que el programa no se caiga si hay un error
        conexion = conectar_db() # Conectar a la base de datos
        if conexion is None: # si la conexion sigue en none:
            return jsonify({'error': 'No se pudo conectar a la base de datos'}), 500 # Devolver error 500

        datos = request.form # Obtener datos del formulario
        Nombres = datos.get('nombre', '').strip() # Obtener y limpiar cada campo del formulario
        Apellidos = datos.get('apellido', '').strip() # Obtener y limpiar cada campo del formulario
        Telefono = datos.get('telefono', '').strip() # Obtener y limpiar cada campo del formulario
        Correo = datos.get('correo', '').strip() # Obtener y limpiar cada campo del formulario
        Usuario = datos.get('usuario', '').strip() # Obtener y limpiar cada campo del formulario
        Contraseña = datos.get('contraseña', '').strip() # Obtener y limpiar cada campo del formulario
        Color_principal = datos.get('color_principal', 'Blanco').strip() # Obtener y limpiar cada campo del formulario

        if not all([Nombres, Apellidos, Telefono, Correo, Usuario, Contraseña]): # Verificar que todos los campos estén completos
            return jsonify({'error': 'Todos los campos son obligatorios'}), 400 # Devolver error 400 si falta algún campo

        if not Telefono.isdigit(): # Verificar que el teléfono contenga solo números
            return jsonify({'error': 'El teléfono debe contener solo números'}), 400 # Devolver error 400 si el teléfono no es válido

        cursor = conexion.cursor() # Crear cursor para ejecutar consultas

        # Verificar duplicados
        cursor.execute("""
            SELECT "ID_Cuenta" FROM public."Cuentas"
            WHERE "Usuario" = %s OR "Correo" = %s
        """, (Usuario, Correo)) # Consulta para verificar si el usuario o correo ya existen
        
        if cursor.fetchone(): # Si se encuentra alguna fila
            return jsonify({'error': 'El usuario o correo ya está registrado en NoteFlow'}), 409

        # Generar nuevo ID_Cuenta
        cursor.execute('SELECT COALESCE(MAX("ID_Cuenta"), 0) + 1 FROM public."Cuentas"') # Consulta para obtener el siguiente ID disponible
        nuevo_id = cursor.fetchone()[0] # Obtener el nuevo ID

        cursor.execute("""
            INSERT INTO public."Cuentas"
            ("ID_Cuenta", "Usuario", "Contraseña", "Nombres", "Apellidos", "Telefono", "Correo", "Color_principal")
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING "ID_Cuenta";
        """, (nuevo_id, Usuario, Contraseña, Nombres, Apellidos, Telefono, Correo, Color_principal)) # Insertar nuevo usuario en la base de datos

        cuenta_id = cursor.fetchone()[0] # Obtener el ID de la cuenta recién creada
        conexion.commit() # Confirmar los cambios en la base de datos

        # Iniciar sesión automáticamente
        session['usuario_id'] = cuenta_id # Guardar el ID de usuario en la sesión
        session['usuario_nombre'] = Usuario # Guardar el nombre de usuario en la sesión

        return jsonify({ 
            'success': True,
            'mensaje': 'Registro exitoso',
            'id': cuenta_id,
            'redirect': '/dashboard'
        }), 201 # retorna el mensaje en formato json con código 201

    except Exception as e: # Manejo de errores
        if conexion: # si la conexion sigue
            conexion.rollback() # Revertir cambios en caso de error
        print(f"Error al registrar el usuario: {e}") # Imprimir error en consola
        return jsonify({'error': 'Error al procesar la solicitud'}), 500 # Devolver error 500

    finally:  # Finalmente
        if cursor: # si el cursor sigue abierto
            cursor.close() # Cerrar el cursor
        if conexion: # si la conexion sigue abierta
            conexion.close() # Cerrar la conexión

# ==============================================================================
# 3. INICIAR SESIÓN (Usuario/Contraseña)
# ==============================================================================
@app.route('/iniciarsesion.html') # Ruta de inicio de sesión
def mostrar_login(): # funcion que lo muestra
    """Formulario de inicio de sesión."""
    return render_template("iniciarsesion.html") # Renderizar plantilla de inicio de sesión

@app.route('/procesar-login', methods=['POST']) # Ruta para procesar el inicio de sesión
def procesar_login(): # Funcion para procesar el inicio de sesión
    """Valida credenciales del usuario y crea la sesión."""
    conexion = None # Conexion a la base de datos nula por ahora
    cursor = None # al igual que el cursor para devolver filas en formato diccionario
    try: # try para que el programa no se caiga si hay un error
        conexion = conectar_db() # Conectar a la base de datos
        if conexion is None: # si la conexion sigue en none:
            return jsonify({'error': 'No se pudo conectar a la base de datos'}), 500 # Devolver error 500

        datos = request.form # Obtener datos del formulario 
        Usuario = datos.get('usuario', '').strip() # Obtener y limpiar cada campo del formulario
        Contraseña = datos.get('contraseña', '').strip() # Obtener y limpiar cada campo del formulario

        if not Usuario or not Contraseña: # Verificar que ambos campos estén completos
            return jsonify({'error': 'Usuario y contraseña son obligatorios'}), 400 # Devolver error 400 si falta algún campo

        cursor = conexion.cursor(cursor_factory=RealDictCursor) # Crear cursor para ejecutar consultas y devolver filas como diccionarios

        cursor.execute(""" 
            SELECT "ID_Cuenta", "Usuario", "Nombres", "Apellidos", "Color_principal"
            FROM public."Cuentas"
            WHERE "Usuario" = %s AND "Contraseña" = %s
        """, (Usuario, Contraseña)) # Consulta para verificar credenciales

        usuario = cursor.fetchone() # Obtener la fila resultante

        if usuario: # Si se encuentra el usuario
            session['usuario_id'] = usuario['ID_Cuenta'] # Guardar el ID de usuario en la sesión
            session['usuario_nombre'] = usuario['Usuario'] # Guardar el nombre de usuario en la sesión
            
            return jsonify({ 
                'success': True,
                'mensaje': 'Inicio de sesión exitoso',
                'redirect': '/dashboard'
            }), 200 # retorna el mensaje en formato json con código 200
        else:
            return jsonify({'error': 'Usuario o contraseña incorrectos'}), 401 # Devolver error 401 si las credenciales son incorrectas

    except Exception as e: # Manejo de errores
        print(f"Error al iniciar sesión: {e}") # Imprimir error en consola
        return jsonify({'error': 'Error al procesar la solicitud'}), 500 # Devolver error 500

    finally: # Finalmente
        if cursor: # si el cursor sigue abierto
            cursor.close() # Cerrar el cursor
        if conexion: # si la conexion sigue abierta
            conexion.close() # Cerrar la conexión

# ==============================================================================
# 4. INICIAR SESIÓN CON GOOGLE
# ==============================================================================
@app.route("/google/login") # Iniciar login con Google
def google_login(): # Definimos la función para manejar el login con Google

    client_config = { # Configuración del cliente para Google OAuth
        "web": { 
            "client_id": os.getenv("GOOGLE_CLIENT_ID"),
            "project_id": "note-flow",
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "client_secret": os.getenv("Google_CLIENT_SECRET"),
            "redirect_uris": [os.getenv("GOOGLE_REDIRECT_URI")]
        }
    }

    flow = Flow.from_client_config( # Crear Flow de Google
        client_config, 
        scopes=[ 
            "https://www.googleapis.com/auth/userinfo.email",
            "https://www.googleapis.com/auth/userinfo.profile",
            "openid"
        ],
        redirect_uri=os.getenv("GOOGLE_REDIRECT_URI") # Redirigir a esta URL después del login
    )

    authorization_url, state = flow.authorization_url( # Obtener URL de autorización
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent"
    )

    session["state"] = state # Guardar el estado en la sesión para verificar después
    return redirect(authorization_url) # Redirigir al usuario a la URL de autorización de Google


# ========================================================================
# Creamos la ruta del /google/callback para manejar la respuesta de Google
# ========================================================================
@app.route("/google/callback") # Manejar la respuesta de Google después del login
def google_callback(): # Definimos la función para manejar el callback de Google
    
    client_config = { # Configuración del cliente para Google OAuth
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

    # Crear Flow de Google
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

    # Obtener token
    flow.fetch_token(authorization_response=request.url)
    credentials = flow.credentials

    # Obtener información del usuario desde Google
    user_info = requests.get(
        "https://www.googleapis.com/oauth2/v1/userinfo",
        params={"alt": "json", "access_token": credentials.token}
    ).json()

    # -------------------------------
    # DATOS QUE NECESITAMOS
    # -------------------------------
    email = user_info.get("email")
    if not email:
        return "No se pudo obtener el correo desde Google.", 400

    # -------------------------------
    # REVISAR SI EL CORREO EXISTE
    # -------------------------------
    conn = None
    cur = None

    try:
        conn = conectar_db()
        if conn is None:
            return "Error de conexión con la base de datos", 500
        cur = conn.cursor()

        # ¿Existe este correo en la BD?
        cur.execute('SELECT "ID_Cuenta" FROM public."Cuentas" WHERE "Correo" = %s', (email,))
        row = cur.fetchone()

        if not row:
            #  EL CORREO NO EXISTE → MOSTRAR template de cuenta no registrada
            return render_template("cuenta_no_registrada.html")

        # ✔ Usuario encontrado → iniciar sesión normal
        user_id = int(row[0])

        session["usuario_id"] = user_id
        session["usuario_nombre"] = user_info.get("name") or email

        return redirect("/dashboard") # Redirigir al dashboard después del login

    except Exception as e: # Manejo de errores
        print("Error en google_callback:", e) # Imprimir el error en consola
        return "Error interno al procesar login con Google.", 500 # Respuesta de error al usuario

    finally: # Cerrar conexiones
        if cur: cur.close() # Cerrar cursor
        if conn: conn.close() # Cerrar conexión


# ==============================================================================
# 5. OLVIDÉ MI CONTRASEÑA (Restablecer)
# ==============================================================================
@app.route('/olvide-contrasena') # Ruta para mostrar el formulario de olvido de contraseña
def mostrar_olvide_contrasena(): 
    """Muestra el formulario para ingresar el correo electrónico."""
    return render_template('olvide_contrasena.html')

@app.route('/procesar-olvide-contrasena', methods=['POST'])
def procesar_olvide_contrasena():
    """Genera token, lo guarda y envía el correo."""
    conn = None
    cur = None
    correo = request.form.get('correo', '').strip()

    if not correo:
        return jsonify({'error': 'El correo es obligatorio'}), 400

    try:
        conn = conectar_db()
        if conn is None:
            return jsonify({'error': 'Error de conexión a la base de datos'}), 500

        cur = conn.cursor()
        
        cur.execute('SELECT "ID_Cuenta", "Usuario" FROM public."Cuentas" WHERE "Correo" = %s', (correo,))
        usuario_row = cur.fetchone()

        if not usuario_row:
            return jsonify({
                'success': True,
                'mensaje': 'Si tu correo está registrado, recibirás un enlace de restablecimiento en breve.'
            }), 200

        usuario_id = usuario_row[0]
        usuario_nombre = usuario_row[1]

        token = secrets.token_urlsafe(32)
        expira = datetime.now() + timedelta(hours=1)
        
        cur.execute("""
            UPDATE public."Cuentas" 
            SET "reset_token" = %s, "reset_token_expira" = %s
            WHERE "ID_Cuenta" = %s
        """, (token, expira, usuario_id))

        conn.commit()

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
        if conn:
            conn.rollback()
        print(f"Error en procesar-olvide-contrasena: {e}")
        return jsonify({'error': 'Error interno del servidor. Intenta más tarde.'}), 500

    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

@app.route('/restablecer-contrasena/<token>')
def mostrar_restablecer_contrasena(token):
    """Muestra el formulario de restablecimiento con validación de token"""
    conn = None
    cur = None
    try:
        conn = conectar_db()
        if conn is None:
            return redirect(url_for('mostrar_login'))

        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute("""
            SELECT "ID_Cuenta" 
            FROM public."Cuentas" 
            WHERE "reset_token" = %s AND "reset_token_expira" > %s
        """, (token, datetime.now()))
        
        usuario_row = cur.fetchone()

        if usuario_row:
            return render_template("restablecer_contrasena.html", token=token, error=None)
        else:
            return render_template("restablecer_contrasena.html", token=None, error="El enlace de restablecimiento no es válido o ha expirado. Vuelve a solicitar uno.")

    except Exception as e:
        print(f"Error al verificar token: {e}")
        return render_template("restablecer_contrasena.html", token=None, error="Error interno al procesar la solicitud.")

    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

@app.route('/procesar-restablecer-contrasena', methods=['POST'])
def procesar_restablecer_contrasena():
    """Procesa el cambio de contraseña"""
    conn = None
    cur = None
    
    token = request.form.get('token', '').strip()
    nueva_contrasena = request.form.get('nueva_contrasena', '').strip()
    
    if not token or not nueva_contrasena:
        return jsonify({'error': 'Faltan datos obligatorios.'}), 400

    try:
        conn = conectar_db()
        if conn is None:
            return jsonify({'error': 'Error de conexión a la base de datos.'}), 500

        cur = conn.cursor()

        cur.execute("""
            SELECT "ID_Cuenta" 
            FROM public."Cuentas" 
            WHERE "reset_token" = %s AND "reset_token_expira" > %s
        """, (token, datetime.now()))
        
        usuario_id_row = cur.fetchone()

        if not usuario_id_row:
            return jsonify({'error': 'El enlace ha expirado o es inválido. Intenta de nuevo.'}), 401

        usuario_id = usuario_id_row[0]

        cur.execute("""
            UPDATE public."Cuentas"
            SET "Contraseña" = %s, "reset_token" = NULL, "reset_token_expira" = NULL
            WHERE "ID_Cuenta" = %s
        """, (nueva_contrasena, usuario_id))
        
        conn.commit()

        return jsonify({
            'success': True, 
            'mensaje': 'Contraseña restablecida con éxito. Redirigiendo a Iniciar Sesión.',
            'redirect': url_for('mostrar_login')
        }), 200

    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Error al restablecer contraseña: {e}")
        return jsonify({'error': 'Error interno al procesar la solicitud.'}), 500

    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

# ==============================================================================
# ✅ 6. CERRAR SESIÓN
# ==============================================================================
@app.route('/logout')
def cerrar_sesion():
    """Limpia la sesión activa y redirige a la página de inicio."""
    session.clear()
    return redirect(url_for('inicio'))

@app.route("/perfil/cerrar-sesion")
def cerrar_sesion_perfil():
    """Cierra la sesión del usuario y redirige al login"""
    session.clear()
    return redirect(url_for('mostrar_login'))

# ==============================================================================
# ✅ 7. DASHBOARD CON NOTAS RECIENTES
# ==============================================================================
@app.route('/dashboard')
def dashboard():
    """
    Carga página de dashboard con:
      - datos del usuario (Nombres, color_principal, Foto)
      - conteos: notas activas, carpetas, notas en papelera
      - listado de notas recientes (limit 6)
    """
    if 'usuario_id' not in session:
        return redirect(url_for('mostrar_login'))

    user_id = session['usuario_id']

    conn = None
    cur = None
    try:
        conn = conectar_db()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        # Datos del usuario
        cur.execute("""
            SELECT "Nombres", "Color_principal", "Foto"
            FROM public."Cuentas"
            WHERE "ID_Cuenta" = %s
        """, (user_id,))
        usuario_row = cur.fetchone()
        
        if not usuario_row:
            session.clear()
            return redirect(url_for('mostrar_login'))

        usuario_para_template = {
            'nombre': usuario_row.get('Nombres'),
            'color_principal': usuario_row.get('Color_principal', 'Blanco'),
            'foto': usuario_row.get('Foto') if usuario_row.get('Foto') else 'img/default_profile.png'
        }

        # Conteos
        cur.execute("""
            SELECT COUNT(*) AS total_notas FROM public."Notas"
            WHERE "ID_Cuenta" = %s AND LOWER("Estado") = 'activa'
        """, (user_id,))
        total_notas = cur.fetchone()['total_notas']

        cur.execute("""
            SELECT COUNT(*) AS total_carpetas FROM public."Carpetas"
            WHERE "ID_Cuenta" = %s
        """, (user_id,))
        total_carpetas = cur.fetchone()['total_carpetas']

        cur.execute("""
            SELECT COUNT(*) AS notas_papelera FROM public."Notas"
            WHERE "ID_Cuenta" = %s AND LOWER("Estado") = 'papelera'
        """, (user_id,))
        notas_papelera = cur.fetchone()['notas_papelera']

        # Notas recientes (limit 6)
        cur.execute("""
            SELECT
                n."ID_Nota",
                n."Titulo",
                n."Descripcion",
                n."Fecha_deedicion",
                n."ID_Categorias"
            FROM public."Notas" n
            WHERE n."ID_Cuenta" = %s AND LOWER(n."Estado") = 'activa'
            ORDER BY n."Fecha_deedicion" DESC NULLS LAST
            LIMIT 6
        """, (user_id,))
        notas_raw = cur.fetchall()

        notas_recientes = []
        for nota in notas_raw:
            nota_id = nota['ID_Nota']
            etiquetas = obtener_etiquetas_nota(nota_id, cur)
            has_adj = verificar_adjuntos_nota(nota_id, cur)
            notas_recientes.append({
                'ID_Nota': nota_id,
                'Titulo': nota.get('Titulo'),
                'Descripcion': nota.get('Descripcion'),
                'Fecha_deedicion': nota.get('Fecha_deedicion'),
                'ID_Categorias': nota.get('ID_Categorias'),
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
        if cur:
            cur.close()
        if conn:
            conn.close()

# ==============================================================================
# ✅ 8. SECCIÓN PERFIL COMPLETA
# ==============================================================================
@app.route('/perfil')
def perfil():
    """Muestra la página de perfil del usuario con toda su información"""
    if 'usuario_id' not in session:
        return redirect(url_for('mostrar_login'))

    user_id = session['usuario_id']
    conn = None
    cur = None

    try:
        conn = conectar_db(dict_cursor=True)
        cur = conn.cursor()

        cur.execute("""
            SELECT "ID_Cuenta", "Usuario", "Nombres", "Apellidos", 
                   "Correo", "Telefono", "Foto", "Color_principal"
            FROM public."Cuentas"
            WHERE "ID_Cuenta" = %s
        """, (user_id,))

        usuario = cur.fetchone()

        if not usuario:
            session.clear()
            return redirect(url_for('mostrar_login'))

        return render_template("perfil.html", usuario=usuario)

    except Exception as e:
        print(f"Error al cargar perfil: {e}")
        return "Error al cargar el perfil", 500

    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

# --- CAMBIAR TEMA ---
@app.route('/perfil/cambiar-tema', methods=['POST'])
def cambiar_tema():
    """Cambia el tema del usuario entre claro y oscuro"""
    if 'usuario_id' not in session:
        return jsonify({"error": "Sesión expirada"}), 403

    tema = request.form.get("tema")
    
    if tema not in ["claro", "oscuro"]:
        return jsonify({"error": "Tema inválido"}), 400

    color_map = {
        "claro": "Blanco",
        "oscuro": "Negro"
    }
    color_db = color_map.get(tema)

    user_id = session['usuario_id']
    conn = None
    cur = None

    try:
        conn = conectar_db()
        cur = conn.cursor()

        cur.execute("""
            UPDATE public."Cuentas"
            SET "Color_principal" = %s
            WHERE "ID_Cuenta" = %s
        """, (color_db, user_id))

        conn.commit()
        session["color_principal"] = color_db

        return jsonify({
            "success": True, 
            "mensaje": f"Tema cambiado a {tema}"
        }), 200

    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Error al cambiar tema: {e}")
        return jsonify({"error": "Error al actualizar tema"}), 500

    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

# --- CAMBIAR CONTRASEÑA ---
@app.route('/perfil/cambiar-password', methods=['POST'])
def cambiar_password():
    """Cambia la contraseña del usuario"""
    if 'usuario_id' not in session:
        return jsonify({"error": "Sesión expirada"}), 403

    user_id = session["usuario_id"]

    actual = request.form.get("password_actual", "").strip()
    nueva = request.form.get("password_nueva", "").strip()
    confirm = request.form.get("password_confirmacion", "").strip()

    if not actual or not nueva or not confirm:
        return jsonify({"error": "Todos los campos son obligatorios"}), 400

    if nueva != confirm:
        return jsonify({"error": "Las nuevas contraseñas no coinciden"}), 400

    if len(nueva) > 15:
        return jsonify({"error": "La contraseña no puede superar 15 caracteres"}), 400

    if len(nueva) < 6:
        return jsonify({"error": "La contraseña debe tener al menos 6 caracteres"}), 400

    conn = None
    cur = None

    try:
        conn = conectar_db(dict_cursor=True)
        cur = conn.cursor()

        cur.execute("""
            SELECT "Contraseña" 
            FROM public."Cuentas" 
            WHERE "ID_Cuenta" = %s
        """, (user_id,))
        
        user = cur.fetchone()

        if not user:
            return jsonify({"error": "Usuario no encontrado"}), 404

        if user["Contraseña"] != actual:
            return jsonify({"error": "La contraseña actual es incorrecta"}), 401

        if user["Contraseña"] == nueva:
            return jsonify({"error": "La nueva contraseña debe ser diferente"}), 400

        cur.execute("""
            UPDATE public."Cuentas"
            SET "Contraseña" = %s
            WHERE "ID_Cuenta" = %s
        """, (nueva, user_id))

        conn.commit()

        return jsonify({
            "success": True,
            "mensaje": "Contraseña actualizada exitosamente"
        }), 200

    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Error al cambiar contraseña: {e}")
        return jsonify({"error": "Error al procesar la solicitud"}), 500

    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

# --- SUBIR FOTO DE PERFIL ---
@app.route('/perfil/subir-foto', methods=["POST"])
def subir_foto():
    """Sube y actualiza la foto de perfil del usuario"""
    if "usuario_id" not in session:
        return jsonify({"error": "Sesión expirada"}), 403

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

        conn = None
        cur = None

        try:
            conn = conectar_db()
            cur = conn.cursor()

            cur.execute("""
                SELECT "Foto" FROM public."Cuentas" 
                WHERE "ID_Cuenta" = %s
            """, (user_id,))
            
            result = cur.fetchone()
            foto_anterior = result[0] if result else None

            cur.execute("""
                UPDATE public."Cuentas"
                SET "Foto" = %s
                WHERE "ID_Cuenta" = %s
            """, (ruta_db, user_id))

            conn.commit()

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
            if conn:
                conn.rollback()
            print(f"Error al actualizar BD: {e}")
            return jsonify({"error": "Error al guardar en base de datos"}), 500

        finally:
            if cur:
                cur.close()
            if conn:
                conn.close()

    except Exception as e:
        print(f"Error al subir archivo: {e}")
        return jsonify({"error": "Error al subir el archivo"}), 500

# ==============================================================================
# RUN
# ==============================================================================
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)