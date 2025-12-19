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
        } # Cierre del diccionario
    }

    # Crear Flow de Google
    flow = Flow.from_client_config( # Crear Flow de Google
        client_config, # Configuración del cliente
        scopes=[
            "https://www.googleapis.com/auth/userinfo.email",
            "https://www.googleapis.com/auth/userinfo.profile",
            "openid"
        ],
        state=session.get("state"), # Verificar el estado guardado en la sesión
        redirect_uri=os.getenv("GOOGLE_REDIRECT_URI") # Redirigir a esta URL después del login
    )

    # Obtener token
    flow.fetch_token(authorization_response=request.url) # Intercambiar el código de autorización por un token
    credentials = flow.credentials # Obtener las credenciales del flujo

    # Obtener información del usuario desde Google
    user_info = requests.get( # Hacer solicitud a la API de Google para obtener información del usuario
        "https://www.googleapis.com/oauth2/v1/userinfo", # Endpoint de la API
        params={"alt": "json", "access_token": credentials.token} # Parámetros de la solicitud
    ).json() #  Convertir la respuesta a JSON

    # -------------------------------
    # DATOS QUE NECESITAMOS
    # -------------------------------
    email = user_info.get("email") # Obtener el correo electrónico del usuario
    if not email: # Si no se pudo obtener el correo
        return "No se pudo obtener el correo desde Google.", 400 # Respuesta de error al usuario

    # -------------------------------
    # REVISAR SI EL CORREO EXISTE
    # -------------------------------
    conn = None # Conexión a la base de datos nula por ahora
    cur = None # al igual que el cursor para devolver filas en formato diccionario

    try:
        conn = conectar_db() # Conectar a la base de datos
        if conn is None: # si la conexion sigue en none:
            return "Error de conexión con la base de datos", 500 # Respuesta de error al usuario
        cur = conn.cursor()  # Crear cursor para ejecutar consultas

        # ¿Existe este correo en la BD?
        cur.execute('SELECT "ID_Cuenta" FROM public."Cuentas" WHERE "Correo" = %s', (email,)) # Consulta para verificar si el correo existe
        row = cur.fetchone() # Obtener la fila resultante

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
def mostrar_olvide_contrasena(): # Funcion que lo muestra
    """Muestra el formulario para ingresar el correo electrónico."""
    return render_template('olvide_contrasena.html') # Renderizar plantilla de olvido de contraseña

@app.route('/procesar-olvide-contrasena', methods=['POST']) # Ruta para procesar el olvido de contraseña
def procesar_olvide_contrasena(): # Funcion para procesar el olvido de contraseña
    """Genera token, lo guarda y envía el correo."""
    conn = None # Conexión a la base de datos nula por ahora
    cur = None # al igual que el cursor para devolver filas en formato diccionario
    correo = request.form.get('correo', '').strip() # Obtener y limpiar el correo del formulario

    if not correo: # Verificar que el correo esté completo
        return jsonify({'error': 'El correo es obligatorio'}), 400 # Devolver error 400 si falta el correo

    try:
        conn = conectar_db() # Conectar a la base de datos
        if conn is None: # si la conexion sigue en none:
            return jsonify({'error': 'Error de conexión a la base de datos'}), 500 # Devolver error 500

        cur = conn.cursor() # Crear cursor para ejecutar consultas
        
        cur.execute('SELECT "ID_Cuenta", "Usuario" FROM public."Cuentas" WHERE "Correo" = %s', (correo,)) # Consulta para verificar si el correo existe
        usuario_row = cur.fetchone() # Obtener la fila resultante

        if not usuario_row:# Si no se encuentra el correo
            return jsonify({  # Devolver mensaje genérico para evitar revelar si el correo existe
                'success': True,
                'mensaje': 'Si tu correo está registrado, recibirás un enlace de restablecimiento en breve.'
            }), 200 # retorna el mensaje en formato json con código 200

        usuario_id = usuario_row[0] # Obtener el ID del usuario
        usuario_nombre = usuario_row[1] # Obtener el nombre del usuario

        token = secrets.token_urlsafe(32) # Generar token seguro
        expira = datetime.now() + timedelta(hours=1) # Establecer expiración del token (1 hora)
        
        cur.execute(""" 
            UPDATE public."Cuentas" 
            SET "reset_token" = %s, "reset_token_expira" = %s
            WHERE "ID_Cuenta" = %s
        """, (token, expira, usuario_id)) # Guardar el token y su expiración en la base de datos

        conn.commit() # Confirmar los cambios en la base de datos|

        reset_url = url_for('mostrar_restablecer_contrasena', token=token, _external=True)# Generar URL de restablecimiento
         
        msg = Message('Restablecimiento de Contraseña NoteFlow', recipients=[correo]) # Crear el mensaje de correo
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
            mail.send(msg) # Enviar el correo
        except Exception as mail_e: # Manejo de errores al enviar correo
            print(f"Error al enviar correo: {mail_e}") # Imprimir error en consola
            return jsonify({'error': 'Error al enviar el correo, revisa la configuración del MAIL.'}), 500  # Devolver error 500 si falla el envío

        return jsonify({ # Devolver mensaje de éxito
            'success': True, #  Indica que la operación fue exitosa
            'mensaje': 'Si tu correo está registrado, recibirás un enlace de restablecimiento en breve.' # Mensaje genérico para evitar revelar si el correo existe
        }), 200 # retorna el mensaje en formato json con código 200

    except Exception as e: # Manejo de errores
        if conn: # si la conexion sigue
            conn.rollback() # Revertir cambios en caso de error
        print(f"Error en procesar-olvide-contrasena: {e}") # Imprimir error en consola
        return jsonify({'error': 'Error interno del servidor. Intenta más tarde.'}), 500 # Devolver error 500

    finally: # Finalmente
        if cur: # si el cursor sigue abierto
            cur.close() # Cerrar el cursor
        if conn: # si la conexion sigue abierta
            conn.close() # Cerrar la conexión

@app.route('/restablecer-contrasena/<token>') # Ruta para mostrar el formulario de restablecimiento de contraseña con token
def mostrar_restablecer_contrasena(token):  # Funcion que lo muestra
    """Muestra el formulario de restablecimiento con validación de token""" # Muestra el formulario de restablecimiento de contraseña
    conn = None # Conexión a la base de datos nula por ahora
    cur = None # al igual que el cursor para devolver filas en formato diccionario
    try:
        conn = conectar_db() # Conectar a la base de datos
        if conn is None: # si la conexion sigue en none:
            return redirect(url_for('mostrar_login')) # Redirigir al login si hay error de conexión

        cur = conn.cursor(cursor_factory=RealDictCursor) # Crear cursor para ejecutar consultas y devolver filas como diccionarios

        cur.execute("""
            SELECT "ID_Cuenta" 
            FROM public."Cuentas" 
            WHERE "reset_token" = %s AND "reset_token_expira" > %s
        """, (token, datetime.now())) # Consulta para verificar si el token es válido y no ha expirado
        
        usuario_row = cur.fetchone() # Obtener la fila resultante

        if usuario_row: # Si el token es válido
            return render_template("restablecer_contrasena.html", token=token, error=None) # Renderizar plantilla de restablecimiento con el token
        else: # Si el token no es válido o ha expirado
            return render_template("restablecer_contrasena.html", token=None, error="El enlace de restablecimiento no es válido o ha expirado. Vuelve a solicitar uno.") # Renderizar plantilla de restablecimiento sin token y con mensaje de error

    except Exception as e: # Manejo de errores
        print(f"Error al verificar token: {e}") # Imprimir error en consola
        return render_template("restablecer_contrasena.html", token=None, error="Error interno al procesar la solicitud.") # Renderizar plantilla de restablecimiento sin token y con mensaje de error

    finally: # Finalmente
        if cur: #   si el cursor sigue abierto
            cur.close() # Cerrar el cursor
        if conn: # si la conexion sigue abierta
            conn.close() # Cerrar la conexión

@app.route('/procesar-restablecer-contrasena', methods=['POST']) # Ruta para procesar el restablecimiento de contraseña
def procesar_restablecer_contrasena(): # Funcion para procesar el restablecimiento de contraseña
    """Procesa el cambio de contraseña"""
    conn = None # Conexión a la base de datos nula por ahora
    cur = None # al igual que el cursor para devolver filas en formato diccionario
    
    token = request.form.get('token', '').strip() # Obtener y limpiar el token del formulario
    nueva_contrasena = request.form.get('nueva_contrasena', '').strip() # Obtener y limpiar la nueva contraseña del formulario
    
    if not token or not nueva_contrasena: # Verificar que ambos campos estén completos
        return jsonify({'error': 'Faltan datos obligatorios.'}), 400 # Devolver error 400 si falta algún campo

    try:
        conn = conectar_db() # Conectar a la base de datos
        if conn is None: # si la conexion sigue en none:
            return jsonify({'error': 'Error de conexión a la base de datos.'}), 500 # Devolver error 500

        cur = conn.cursor() # Crear cursor para ejecutar consultas

        cur.execute("""
            SELECT "ID_Cuenta" 
            FROM public."Cuentas" 
            WHERE "reset_token" = %s AND "reset_token_expira" > %s
        """, (token, datetime.now())) # Consulta para verificar si el token es válido y no ha expirado
        
        usuario_id_row = cur.fetchone() # Obtener la fila resultante

        if not usuario_id_row: # Si el token no es válido o ha expirado
            return jsonify({'error': 'El enlace ha expirado o es inválido. Intenta de nuevo.'}), 401 # Devolver error 401

        usuario_id = usuario_id_row[0] # Obtener el ID del usuario

        cur.execute("""
            UPDATE public."Cuentas"
            SET "Contraseña" = %s, "reset_token" = NULL, "reset_token_expira" = NULL
            WHERE "ID_Cuenta" = %s
        """, (nueva_contrasena, usuario_id)) # Actualizar la contraseña y limpiar el token
        
        conn.commit() # Confirmar los cambios en la base de datos|

        return jsonify({ # Devolver mensaje de éxito
            'success': True,  # Indica que la operación fue exitosa
            'mensaje': 'Contraseña restablecida con éxito. Redirigiendo a Iniciar Sesión.', # Mensaje de éxito
            'redirect': url_for('mostrar_login') # URL de redirección al login
        }), 200 # retorna el mensaje en formato json con código 200

    except Exception as e: # Manejo de errores
        if conn: # si la conexion sigue
            conn.rollback() # Revertir cambios en caso de error
        print(f"Error al restablecer contraseña: {e}") # Imprimir error en consola
        return jsonify({'error': 'Error interno al procesar la solicitud.'}), 500 # Devolver error 500

    finally: # Finalmente
        if cur: # si el cursor sigue abierto
            cur.close() # Cerrar el cursor
        if conn: # si la conexion sigue abierta
            conn.close() # Cerrar la conexión

# ==============================================================================
# ✅ 6. CERRAR SESIÓN
# ==============================================================================
@app.route('/logout') # Ruta para cerrar sesión
def cerrar_sesion(): # Funcion para cerrar sesión
    """Limpia la sesión activa y redirige a la página de inicio.""" # Limpia la sesión activa
    session.clear() # Limpiar la sesión
    return redirect(url_for('inicio')) # Redirigir a la página de inicio"

@app.route("/perfil/cerrar-sesion")  # Ruta para cerrar sesión desde el perfil
def cerrar_sesion_perfil(): # Funcion para cerrar sesión desde el perfil
    """Cierra la sesión del usuario y redirige al login""" # Limpia la sesión activa
    session.clear() # Limpiar la sesión
    return redirect(url_for('mostrar_login')) # Redirigir a la página de inicio de sesión

# ==============================================================================
# ✅ 7. DASHBOARD CON NOTAS RECIENTES
# ==============================================================================
@app.route('/dashboard') # Ruta para el dashboard
def dashboard(): # Funcion para mostrar el dashboard
    """
    Carga página de dashboard con:
      - datos del usuario (Nombres, color_principal, Foto)
      - conteos: notas activas, carpetas, notas en papelera
      - listado de notas recientes (limit 6)
    """ # Verificar si el usuario está autenticado
    if 'usuario_id' not in session: # Si no está autenticado
        return redirect(url_for('mostrar_login')) # Redirigir al login

    user_id = session['usuario_id'] # Obtener el ID del usuario desde la sesión
  
    conn = None # Conexión a la base de datos nula por ahora
    cur = None # al igual que el cursor para devolver filas en formato diccionario
    try:
        conn = conectar_db() # Conectar a la base de datos
        cur = conn.cursor(cursor_factory=RealDictCursor) # Crear cursor para ejecutar consultas y devolver filas como diccionarios

        # Datos del usuario
        cur.execute("""
            SELECT "Nombres", "Color_principal", "Foto"
            FROM public."Cuentas"
            WHERE "ID_Cuenta" = %s
        """, (user_id,)) # Consulta para obtener datos del usuario
        usuario_row = cur.fetchone() # Obtener la fila resultante
        
        if not usuario_row: # Si no se encuentra el usuario
            session.clear() # Limpiar la sesión
            return redirect(url_for('mostrar_login')) # Redirigir al login
 
        usuario_para_template = { # Preparar datos para la plantilla
            'nombre': usuario_row.get('Nombres'), # Nombre del usuario
            'color_principal': usuario_row.get('Color_principal', 'Blanco'), # Color principal del usuario
            'foto': usuario_row.get('Foto') if usuario_row.get('Foto') else 'img/default_profile.png' # Foto del usuario o imagen por defecto
        }

        # Conteos
        cur.execute("""
            SELECT COUNT(*) AS total_notas FROM public."Notas"
            WHERE "ID_Cuenta" = %s AND LOWER("Estado") = 'activa'
        """, (user_id,)) # Consulta para contar notas activas
        total_notas = cur.fetchone()['total_notas'] # Obtener el total de notas activas

        cur.execute("""
            SELECT COUNT(*) AS total_carpetas FROM public."Carpetas"
            WHERE "ID_Cuenta" = %s
        """, (user_id,)) # Consulta para contar carpetas
        total_carpetas = cur.fetchone()['total_carpetas'] # Obtener el total de carpetas

        cur.execute("""
            SELECT COUNT(*) AS notas_papelera FROM public."Notas"
            WHERE "ID_Cuenta" = %s AND LOWER("Estado") = 'papelera'
        """, (user_id,)) # Consulta para contar notas en papelera
        notas_papelera = cur.fetchone()['notas_papelera'] # Obtener el total de notas en papelera

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
        """, (user_id,)) # Consulta para obtener notas recientes
        notas_raw = cur.fetchall() # Obtener las filas resultantes

        notas_recientes = [] # Lista para notas recientes procesadas
        for nota in notas_raw: 
            nota_id = nota['ID_Nota'] # Obtener el ID de la nota
            etiquetas = obtener_etiquetas_nota(nota_id, cur) # Obtener etiquetas de la nota
            has_adj = verificar_adjuntos_nota(nota_id, cur) # Verificar si la nota tiene adjuntos
            notas_recientes.append({ # Agregar nota procesada a la lista    
                'ID_Nota': nota_id, # ID de la nota
                'Titulo': nota.get('Titulo'), # Título de la nota
                'Descripcion': nota.get('Descripcion'), # Descripción de la nota
                'Fecha_deedicion': nota.get('Fecha_deedicion'), # Fecha de edición de la nota
                'ID_Categorias': nota.get('ID_Categorias'), # Categoría de la nota
                'Etiquetas': etiquetas, # Etiquetas asociadas a la nota
                'Has_Adjuntos': has_adj # Indica si la nota tiene adjuntos
            })

        return render_template( #   Renderizar plantilla del dashboard
            'dashboard.html', # Nombre de la plantilla
            usuario=usuario_para_template, # Datos del usuario para la plantilla
            total_notas=total_notas, # Total de notas activas
            total_carpetas=total_carpetas, # Total de carpetas
            notas_papelera=notas_papelera, # Total de notas en papelera
            notas_recientes=notas_recientes #   Notas recientes para la plantilla
        )
 
    except Exception as e: # Manejo de errores
        import traceback # Importar módulo traceback para imprimir el error completo
        traceback.print_exc() # Imprimir el error completo en consola
        return f"Error al cargar dashboard: {str(e)}", 500 # Devolver error 500

    finally: # Finalmente
        if cur:  # si el cursor sigue abierto
            cur.close() # Cerrar el cursor
        if conn: # si la conexion sigue abierta
            conn.close() # Cerrar la conexión

# ==============================================================================
# ✅ 8. SECCIÓN PERFIL COMPLETA
# ==============================================================================
@app.route('/perfil') # Ruta para la página de perfil
def perfil(): # Funcion para mostrar la página de perfil
    """Muestra la página de perfil del usuario con toda su información"""
    if 'usuario_id' not in session: # Verificar si el usuario está autenticado
        return redirect(url_for('mostrar_login')) # Redirigir al login si no está autenticado

    user_id = session['usuario_id'] # Obtener el ID del usuario desde la sesión
    conn = None # Conexión a la base de datos nula por ahora
    cur = None # al igual que el cursor para devolver filas en formato diccionario

    try:
        conn = conectar_db(dict_cursor=True) # Conectar a la base de datos con cursor de diccionario
        cur = conn.cursor() # Crear cursor para ejecutar consultas

        cur.execute("""
            SELECT "ID_Cuenta", "Usuario", "Nombres", "Apellidos", 
                   "Correo", "Telefono", "Foto", "Color_principal"
            FROM public."Cuentas"
            WHERE "ID_Cuenta" = %s
        """, (user_id,)) # Consulta para obtener datos del usuario

        usuario = cur.fetchone() # Obtener la fila resultante

        if not usuario: # Si no se encuentra el usuario
            session.clear() # Limpiar la sesión
            return redirect(url_for('mostrar_login')) # Redirigir al login

        return render_template("perfil.html", usuario=usuario) # Renderizar plantilla de perfil con datos del usuario

    except Exception as e: # Manejo de errores
        print(f"Error al cargar perfil: {e}") # Imprimir error en consola
        return "Error al cargar el perfil", 500 # Devolver error 500

    finally: #  Finalmente
        if cur: # si el cursor sigue abierto
            cur.close() # Cerrar el cursor
        if conn: # si la conexion sigue abierta
            conn.close() # Cerrar la conexión

# --- CAMBIAR TEMA ---
@app.route('/perfil/cambiar-tema', methods=['POST']) # Ruta para cambiar el tema del usuario
def cambiar_tema(): # Funcion para cambiar el tema del usuario
    """Cambia el tema del usuario entre claro y oscuro"""
    if 'usuario_id' not in session: # Verificar si el usuario está autenticado
        return jsonify({"error": "Sesión expirada"}), 403 # Devolver error 403 si no está autenticado

    tema = request.form.get("tema") # Obtener el tema del formulario
     
    if tema not in ["claro", "oscuro"]: # Verificar que el tema sea válido
        return jsonify({"error": "Tema inválido"}), 400 # Devolver error 400 si el tema es inválido

    color_map = { # Mapeo de temas a colores en la base de datos
        "claro": "Blanco", # Tema claro
        "oscuro": "Negro" # Tema oscuro
    }
    color_db = color_map.get(tema) # Obtener el color correspondiente para la base de datos

    user_id = session['usuario_id'] # Obtener el ID del usuario desde la sesión
    conn = None #   Conexión a la base de datos nula por ahora
    cur = None # al igual que el cursor para devolver filas en formato diccionario

    try: 
        conn = conectar_db() # Conectar a la base de datos
        cur = conn.cursor() # Crear cursor para ejecutar consultas

        cur.execute("""
            UPDATE public."Cuentas"
            SET "Color_principal" = %s
            WHERE "ID_Cuenta" = %s
        """, (color_db, user_id)) # Consulta para actualizar el color principal del usuario

        conn.commit() # Confirmar los cambios en la base de datos|
        session["color_principal"] = color_db # Actualizar el color en la sesión

        return jsonify({ # Devolver mensaje de éxito
            "success": True,  #Indica que la operación fue exitosa
            "mensaje": f"Tema cambiado a {tema}" # Mensaje de éxito
        }), 200 # retorna el mensaje en formato json con código 200

    except Exception as e: # Manejo de errores
        if conn: #  si la conexion sigue
            conn.rollback() # Revertir cambios en caso de error
        print(f"Error al cambiar tema: {e}") # Imprimir error en consola
        return jsonify({"error": "Error al actualizar tema"}), 500 # Devolver error 500

    finally: # Finalmente
        if cur: # si el cursor sigue abierto
            cur.close() # Cerrar el cursor
        if conn: # si la conexion sigue abierta
            conn.close() # Cerrar la conexión

# --- CAMBIAR CONTRASEÑA ---
@app.route('/perfil/cambiar-password', methods=['POST']) # Ruta para cambiar la contraseña del usuario
def cambiar_password(): # Funcion para cambiar la contraseña del usuario
    """Cambia la contraseña del usuario""" # Verificar si el usuario está autenticado
    if 'usuario_id' not in session: # Si no está autenticado
        return jsonify({"error": "Sesión expirada"}), 403 # Devolver error 403 si no está autenticado

    user_id = session["usuario_id"] # Obtener el ID del usuario desde la sesión

    actual = request.form.get("password_actual", "").strip() # Obtener y limpiar la contraseña actual
    nueva = request.form.get("password_nueva", "").strip() # Obtener y limpiar la nueva contraseña
    confirm = request.form.get("password_confirmacion", "").strip() # Obtener y limpiar la confirmación de la nueva contraseña

    if not actual or not nueva or not confirm: # Verificar que todos los campos estén completos
        return jsonify({"error": "Todos los campos son obligatorios"}), 400 # Devolver error 400 si falta algún campo

    if nueva != confirm: # Verificar que la nueva contraseña y la confirmación coincidan
        return jsonify({"error": "Las nuevas contraseñas no coinciden"}), 400 # Devolver error 400 si no coinciden

    if len(nueva) > 15: # Verificar que la nueva contraseña no supere los 15 caracteres
        return jsonify({"error": "La contraseña no puede superar 15 caracteres"}), 400 # Devolver error 400 si supera el límite

    if len(nueva) < 6: # Verificar que la nueva contraseña tenga al menos 6 caracteres
        return jsonify({"error": "La contraseña debe tener al menos 6 caracteres"}), 400 # Devolver error 400 si no cumple el mínimo

    conn = None # Conexión a la base de datos nula por ahora
    cur = None # al igual que el cursor para devolver filas en formato diccionario

    try:
        conn = conectar_db(dict_cursor=True) # Conectar a la base de datos con cursor de diccionario
        cur = conn.cursor() # Crear cursor para ejecutar consultas

        cur.execute("""
            SELECT "Contraseña" 
            FROM public."Cuentas" 
            WHERE "ID_Cuenta" = %s
        """, (user_id,)) # Consulta para obtener la contraseña actual del usuario
         
        user = cur.fetchone() # Obtener la fila resultante

        if not user: # Si no se encuentra el usuario
            return jsonify({"error": "Usuario no encontrado"}), 404 # Devolver error 404

        if user["Contraseña"] != actual: # Verificar que la contraseña actual coincida
            return jsonify({"error": "La contraseña actual es incorrecta"}), 401 # Devolver error 401 si no coincide

        if user["Contraseña"] == nueva: # Verificar que la nueva contraseña sea diferente
            return jsonify({"error": "La nueva contraseña debe ser diferente"}), 400 # Devolver error 400 si es igual
 
        cur.execute("""
            UPDATE public."Cuentas"
            SET "Contraseña" = %s
            WHERE "ID_Cuenta" = %s
        """, (nueva, user_id)) # Consulta para actualizar la contraseña del usuario

        conn.commit() # Confirmar los cambios en la base de datos|

        return jsonify({ # Devolver mensaje de éxito
            "success": True, # Indica que la operación fue exitosa
            "mensaje": "Contraseña actualizada exitosamente" # Mensaje de éxito
        }), 200 # retorna el mensaje en formato json con código 200

    except Exception as e: # Manejo de errores
        if conn: # si la conexion sigue
            conn.rollback() # Revertir cambios en caso de error
        print(f"Error al cambiar contraseña: {e}") # Imprimir error en consola
        return jsonify({"error": "Error al procesar la solicitud"}), 500 # Devolver error 500

    finally: # Finalmente
        if cur: # si el cursor sigue abierto
            cur.close() # Cerrar el cursor
        if conn: # si la conexion sigue abierta
            conn.close() # Cerrar la conexión

# --- SUBIR FOTO DE PERFIL --- 
@app.route('/perfil/subir-foto', methods=["POST"]) # Ruta para subir la foto de perfil del usuario
def subir_foto(): # Funcion para subir la foto de perfil del usuario
    """Sube y actualiza la foto de perfil del usuario""" # Verificar si el usuario está autenticado
    if "usuario_id" not in session: # Si no está autenticado
        return jsonify({"error": "Sesión expirada"}), 403 # Devolver error 403 si no está autenticado

    archivo = request.files.get("foto") # Obtener el archivo de la solicitud

    if not archivo or archivo.filename == '': # Verificar que se haya seleccionado un archivo
        return jsonify({"error": "No se seleccionó ninguna imagen"}), 400 # Devolver error 400 si no se seleccionó ningún archivo

    if not allowed_file(archivo.filename): # Verificar que el archivo tenga una extensión permitida
        return jsonify({ # Devolver error 400 si la extensión no es permitida
            "error": "Formato no permitido. Usa: PNG, JPG, JPEG, GIF o WEBP" # Mensaje de error
        }), 400 # retorna el mensaje en formato json con código 400

    user_id = session["usuario_id"] # Obtener el ID del usuario desde la sesión

    try:
        ext = os.path.splitext(archivo.filename)[1].lower() # Obtener la extensión del archivo
        filename_unique = f"user_{user_id}_{uuid.uuid4().hex}{ext}" # Generar nombre de archivo único
         
        ruta_completa = os.path.join(PROFILE_UPLOAD_FOLDER, filename_unique) # Ruta completa para guardar el archivo
        archivo.save(ruta_completa) # Guardar el archivo en la ruta especificada

        ruta_db = f"uploads/profile/{filename_unique}" # Ruta relativa para almacenar en la base de datos

        conn = None # Conexión a la base de datos nula por ahora
        cur = None # al igual que el cursor para devolver filas en formato diccionario

        try:
            conn = conectar_db() # Conectar a la base de datos
            cur = conn.cursor() # Crear cursor para ejecutar consultas

            cur.execute("""
                SELECT "Foto" FROM public."Cuentas" 
                WHERE "ID_Cuenta" = %s
            """, (user_id,)) # Consulta para obtener la foto anterior del usuario
             
            result = cur.fetchone() # Obtener la fila resultante
            foto_anterior = result[0] if result else None # Obtener la foto anterior si existe

            cur.execute("""
                UPDATE public."Cuentas"
                SET "Foto" = %s
                WHERE "ID_Cuenta" = %s
            """, (ruta_db, user_id)) # Consulta para actualizar la foto del usuario

            conn.commit() # Confirmar los cambios en la base de datos|

            if foto_anterior and foto_anterior != "uploads/profile/default_profile.png": # Si hay una foto anterior y no es la por defecto
                try:
                    ruta_anterior = os.path.join(BASE_DIR, "static", foto_anterior) # Ruta completa de la foto anterior
                    if os.path.exists(ruta_anterior): # Verificar si el archivo existe
                        os.remove(ruta_anterior) # Eliminar el archivo de la foto anterior
                except Exception as e: # Manejo de errores al eliminar la foto anterior
                    print(f"No se pudo eliminar foto anterior: {e}") # Imprimir error en consola

            return jsonify({ # Devolver mensaje de éxito
                "success": True, # Indica que la operación fue exitosa
                "mensaje": "Foto de perfil actualizada", # Mensaje de éxito
                "nueva_foto": url_for('static', filename=ruta_db) # URL de la nueva foto para actualizar en el frontend
            }), 200 # retorna el mensaje en formato json con código 200

        except Exception as e: # Manejo de errores al actualizar la base de datos
            if conn: # si la conexion sigue
                conn.rollback() # Revertir cambios en caso de error
            print(f"Error al actualizar BD: {e}") # Imprimir error en consola
            return jsonify({"error": "Error al guardar en base de datos"}), 500 # Devolver error 500

        finally: # Finalmente
            if cur: # si el cursor sigue abierto
                cur.close() # Cerrar el cursor
            if conn: # si la conexion sigue abierta
                conn.close() # Cerrar la conexión

    except Exception as e: # Manejo de errores al subir el archivo
        print(f"Error al subir archivo: {e}") # Imprimir error en consola
        return jsonify({"error": "Error al subir el archivo"}), 500 # Devolver error 500

# ==============================================================================
# RUN
# ==============================================================================
# Si se ejecuta este archivo directamente
if __name__ == "__main__":
    app.run(
        debug=True,
        host="127.0.0.1",
        port=5000
    ) # Ejecutar la aplicación Flask en modo debug