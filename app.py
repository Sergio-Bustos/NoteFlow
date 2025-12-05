# -*- coding: utf-8 -*-

# =============================================== IMPORTACIONES DE LIBRERIAS =========================================================
import email
from flask import Flask, jsonify, render_template, request, redirect, url_for, session, send_from_directory # importacion de librerias
from flask_mail import Mail, Message
import psycopg2 # importacion de librerias
from psycopg2.extras import RealDictCursor # importacion de librerias
from google_auth_oauthlib.flow import Flow # importacion de librerias
import requests
import os # importacion de librerias
import uuid # importacion de librerias
from datetime import datetime,timedelta # <<<<< Añadir 'timedelta' para la expiración del token
import secrets # <<<<< NUEVA LIBRERÍA DE GENERACIÓN DE TOKENS
import string # <<<<< NUEVA LIBRERÍA
from dotenv import load_dotenv # <<<<< NUEVA LIBRERÍA PARA .ENV # importacion de librerias
load_dotenv()
# =====================================================================================================================================











# ======================== Configuración para permitir OAuth en http (no solo HTTPS)  para boton de Google ==========================

# --------------------------------------------------
os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"  # Permite OAuth en HTTP (no solo HTTPS) - SOLO PARA DESARROLLO


# -------------------------------
# Datos de google oauth desde .env
# -------------------------------

GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID') # se obtiene del .env
GOOGLE_CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET') # se obtiene del .env
GOOGLE_REDIRECT_URI = os.getenv('GOOGLE_REDIRECT_URI') # se obtiene del .env


# =====================================================================================================================================



# ======================== Configuración de la APP ==========================





# --------------------------------------------------
# Configuración del Flask App

app = Flask(__name__)
app.secret_key = 'tu_clave_secreta_aqui_cambiala'  # cambiar en producción
app.static_folder = 'static' # carpeta para que python la reconozca del static
app.static_url_path = '/static' # al igual que la url path

# ============================================
# CONFIGURACIÓN DE CARPETA UPLOADS
# ============================================
import os # se importa nuevamente para mejor optimizacion

# Ruta absoluta del proyecto (donde está app.py)
BASE_DIR = os.path.abspath(os.path.dirname(__file__)) # Ruta path donde se encuentra el proyecto

# Carpeta de uploads dentro del proyecto 
UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads") # Donde se subiran las cosas que suban los usuarios

# Si la carpeta NO existe, se crea automáticamente
if not os.path.exists(UPLOAD_FOLDER): # Si no existe
    os.makedirs(UPLOAD_FOLDER) # se crea automaticamente

# Se asigna la carpeta al config de Flask
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER # se le asigna






# --------------------------------------------------
# Configuración de la base de datos 
# --------------------------------------------------
DB_CONFIG = {
    'host': 'localhost', # host donde se encuentra la db
    'database': 'dbnoteflow', # nombre de la db
    'user': 'postgres', # usuario por default
    'password': '123456', # password
    'port': 5432 # puerto por default
}

# ===========================================================================


# ======================================================================
# FUNCION PARA CONECTAR LA DB
# ======================================================================



def conectar_db(dict_cursor=False):
    """Crea y devuelve una conexión a PostgreSQL. Si dict_cursor es True, 
       la conexión se configura para usar RealDictCursor por defecto."""
    try:
        # Si queremos RealDictCursor, lo pasamos al connect.
        # Esto configura el cursor_factory a nivel de CONEXIÓN.
        # RealDictCursor es necesario para la ruta /notas y dashboard
        cursor_factory = RealDictCursor if dict_cursor else None
        
        conn = psycopg2.connect(cursor_factory=cursor_factory, **DB_CONFIG)
        conn.set_client_encoding('UTF8')  # AÑADIDO
        return conn
    except psycopg2.Error as e:
        print(f"ERROR DE CONEXIÓN A POSTGRESQL: {e}")
        return None


# ==============================================================================
#                  RESTABLECIMIENTO DE CONTRASEÑA                              
# ==============================================================================



# ----------------------------------------------------------------  
# Configuración de Flask-Mail (Para restablecimiento de contraseña)
# -----------------------------------------------------------------

# --------------------------------------------------------------------------------------------------------

# Todo esto estara en el .ENV que luego se oculta con el .gitignore para la proteccion segura de NoteFlow:

app.config['MAIL_SERVER'] = os.getenv('MAIL_SERVER') 
app.config['MAIL_PORT'] = int(os.getenv('MAIL_PORT'))
app.config['MAIL_USE_TLS'] = os.getenv('MAIL_USE_TLS') == 'True'
app.config['MAIL_USE_SSL'] = os.getenv('MAIL_USE_SSL') == 'True'
app.config['MAIL_USERNAME'] = os.getenv('MAIL_USERNAME')
app.config['MAIL_PASSWORD'] = os.getenv('MAIL_PASSWORD')
app.config['MAIL_DEFAULT_SENDER'] = os.getenv('MAIL_USERNAME')
app.config['MAIL_DEFAULT_CHARSET'] = 'utf-8'

mail = Mail(app)
# --------------------------------------------------------------------------------------------------------

# --------------------------------------------------------------------------------------------------------
# PROCESO DE RESTABLECER CONTRASEÑA
# --------------------------------------------------------------------------------------------------------

# app.py (Ruta 1: Muestra el formulario inicial de olvido de contraseña)
@app.route('/olvide-contrasena')
def mostrar_olvide_contrasena(): # Funcion para mostrar el template olvido de contrasena
    """Muestra el formulario para ingresar el correo electrónico."""
    return render_template('olvide_contrasena.html') # Retorna el template olvide_contrasena.html



# app.py (Función que genera el token, lo guarda y envía el correo - TEMPORAL: RECORDAR QUE SOLO ES POR UNA HORA)
# Ruta 2: Procesar la solicitud
@app.route('/procesar-olvide-contrasena', methods=['POST'])
def procesar_olvide_contrasena(): # Funcion para procesar el olvide contraseña
    conn = None # Conexion en 0 por ahora
    cur = None # Cursor en 0 por ahora
    correo = request.form.get('correo', '').strip() # Se atrapa sin espacios el correo del formulario

    if not correo: # Si no hay nada en el campo de correo
        return jsonify({'error': 'El correo es obligatorio'}), 400 # error

    try: # try para que el programa no se detenga bruscamente
        conn = conectar_db() # variable que ejecutara la conexion
        if conn is None: # si la conexion es nula
            return jsonify({'error': 'Error de conexión a la base de datos'}), 500 # error

        cur = conn.cursor() # cursor para ejecutar procesos en la db
        
        # 1. Buscar usuario por correo
        cur.execute('SELECT "ID_Cuenta", "Usuario" FROM public."Cuentas" WHERE "Correo" = %s', (correo,)) # ejecuta y busca el id de cuenta y usuario en la tabla cuentas donde el correo sea igual al correo que se envio
        usuario_row = cur.fetchone() # fetchone para atraparlo

        # Respuesta genérica por seguridad, para no revelar si el correo existe
        if not usuario_row: # si no existe el usuario
            return jsonify({ 
                'success': True,
                'mensaje': 'Si tu correo está registrado, recibirás un enlace de restablecimiento en breve.'
            }), 200 # buen mensaje ya que esta registrado y si se le enviara el correo

        usuario_id = usuario_row[0] # se guarda el id de cuenta en la variable usuario_id
        usuario_nombre = usuario_row[1] # se atrapa el nombre del usuario con el indice 1

        # 2. Generar token seguro y fecha de expiración (e.g., 1 hora)
        token = secrets.token_urlsafe(32) #  genera una cadena de texto aleatoria, segura para URL, de 32 bytes que se almacena en la variable token. Esto se utiliza principalmente para crear tokens de seguridad únicos
        expira = datetime.now() + timedelta(hours=1) # Una hora para la expiracion a partir de cuando se envio con datetime.now()
        
        # 3. Guardar el token y la expiración en la base de datos
        cur.execute("""
            UPDATE public."Cuentas" 
            SET "reset_token" = %s, "reset_token_expira" = %s
            WHERE "ID_Cuenta" = %s
        """, (token, expira, usuario_id)) # actualiza la tabla donde se reinicia el token

        # cur.execute: Llama al método execute del cursor cur
        # UPDATE public."Cuentas": Actualizar registros existentes de la tabla Cuentas

        # ============================================================
        # SET define los campos que se van a actualizar en la tabla:
        # "reset_token_expira" se actualizará con el segundo valor %s. (esta abajo en el parentesis) = (token, expira, usuario_id)) 
        # "reset_token" se actualizará con el primer valor %s. (esta abajo en el parentesis) =  (token, expira, usuario_id)) 
        # ============================================================

        # WHERE: Es la condición que selecciona qué registro se debe actualizar: 
        # Solo se actualizará la cuenta cuyo "ID_Cuenta" coincida con el valor del tercer %s. (esta abajo en el parentesis) =  (token, expira, usuario_id)
        
        conn.commit() # guarda los cambios

        # 4. Enviar correo electrónico
        reset_url = url_for('mostrar_restablecer_contrasena', token=token, _external=True)
        
        msg = Message('Restablecimiento de Contraseña NoteFlow', recipients=[correo]) # se crea el mensaje con el asunto y el correo del destinatario
        msg.body = f"""Hola {usuario_nombre},

Has solicitado restablecer tu contraseña para NoteFlow.

Haz clic en el siguiente enlace para completar el proceso:

{reset_url}

Este enlace expirará en 1 hora.

Si no solicitaste este cambio, por favor ignora este correo.

Saludos,
Equipo NoteFlow
"""
        try: # try para que no se detenga bruscamente
            mail.send(msg) # envia el mensaje
        except Exception as mail_e: # y si da error se guuarda el error como la variable e
            print(f"Error al enviar correo: {mail_e}") # imprime al enviar el correo
            return jsonify({'error': 'Error al enviar el correo, revisa la configuración del MAIL.'}), 500 # retorna en formato JSON se da este error

        return jsonify({ # retorna en formato JSON
            'success': True, # si pasa
            'mensaje': 'Si tu correo está registrado, recibirás un enlace de restablecimiento en breve.' # mensaje
        }), 200

    except Exception as e: # y si da error se guarda el error como la variable e
        if conn: # si la conexion sigue estando
            conn.rollback() # se borra lo que no se guardo
        print(f"Error en procesar-olvide-contrasena: {e}") # se imprime el error
        return jsonify({'error': 'Error interno del servidor. Intenta más tarde.'}), 500 # y tambien en formato JSON

    finally: # finalmente se cierra cur y conn si siguen en True
        if cur: cur.close()
        if conn: conn.close()


# app.py (Ruta 3: Muestra el formulario de restablecimiento con validación de token)
@app.route('/restablecer-contrasena/<token>') # Ruta para restablecer la contraseña con el token
def mostrar_restablecer_contrasena(token): # Funcion para mostrar el restablecimiento de contraseña
    conn = None # Conexion a la base de datos
    cur = None # Cursor para ejecutar consultas
    try: # try para que no se detenga bruscamente
        conn = conectar_db() #  variable que ejecutara la conexion
        if conn is None: # si la conexion es nula
            return redirect(url_for('mostrar_login')) # redirecciona al login

        # Usamos cursor_factory=RealDictCursor para acceder a las columnas por nombre
        cur = conn.cursor(cursor_factory=RealDictCursor)

        # Buscar usuario por token y validar que no haya expirado
        cur.execute("""
            SELECT "ID_Cuenta" 
            FROM public."Cuentas" 
            WHERE "reset_token" = %s AND "reset_token_expira" > %s
        """, (token, datetime.now())) # se selecciona el id de cuenta donde el token sea igual al token que se envio y que la fecha de expiracion sea mayor a la fecha actual
        
        usuario_row = cur.fetchone() # fetchone para atraparlo

        if usuario_row: 
            # Token válido, renderizar el formulario
            return render_template("restablecer_contrasena.html", token=token, error=None)
        else:
            # Token no válido o expirado
            return render_template("restablecer_contrasena.html", token=None, error="El enlace de restablecimiento no es válido o ha expirado. Vuelve a solicitar uno.")

    except Exception as e:
        print(f"Error al verificar token: {e}")
        return render_template("restablecer_contrasena.html", token=None, error="Error interno al procesar la solicitud.")

    finally:
        if cur: cur.close()
        if conn: conn.close()

# app.py (Ruta 4: Procesa el cambio de contraseña)
@app.route('/procesar-restablecer-contrasena', methods=['POST'])
def procesar_restablecer_contrasena():
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

        # 1. Validar el token y obtener el ID del usuario
        cur.execute("""
            SELECT "ID_Cuenta" 
            FROM public."Cuentas" 
            WHERE "reset_token" = %s AND "reset_token_expira" > %s
        """, (token, datetime.now()))
        
        usuario_id_row = cur.fetchone()

        if not usuario_id_row:
            return jsonify({'error': 'El enlace ha expirado o es inválido. Intenta de nuevo.'}), 401

        usuario_id = usuario_id_row[0]

        # 2. Actualizar la contraseña y limpiar el token
        # Usamos "Contraseña" (con Ñ) para asegurar compatibilidad con la DB
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
        if conn: conn.rollback()
        print(f"Error al restablecer contraseña: {e}")
        return jsonify({'error': 'Error interno al procesar la solicitud.'}), 500

    finally:
        if cur: cur.close()
        if conn: conn.close()




# ============================================
# Creamos la ruta del /google/login para iniciar el flujo de OAuth2
# ============================================
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
            # ❌ EL CORREO NO EXISTE → MOSTRAR MENSAJE BONITO
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


# ===========================================
# Funciones de LOGICA DEL BACK END
# ===========================================



# =============================================
# FUNCION PARA OBTENER LA ETIQUETA DE CADA NOTA
# =============================================

def obtener_etiquetas_nota(nota_id, cursor): # Para obtener la etiqueta de la nota
    """
    Obtiene las etiquetas asociadas a una nota.
    Retorna lista de dicts con clave 'Nombre_etiqueta' (si se usa RealDictCursor).
    """
    cursor.execute("""
        SELECT e."ID_Etiqueta", e."Nombre_etiqueta"
        FROM public."Notas_etiquetas" ne
        JOIN public."Etiquetas" e ON ne."ID_Etiqueta" = e."ID_Etiqueta"
        WHERE ne."ID_Nota" = %s
        ORDER BY e."Nombre_etiqueta" ASC
    """, (nota_id,)) # Busqueda atravez de llaves foraneas con Inner Join
    rows = cursor.fetchall() # Funcion cursor 
    # Si salen dicts (RealDictCursor) ya están listos
    if rows and isinstance(rows[0], dict): # Si ya esta listo lo retorna
        return rows # se retorna
    # Si salen tuplas -> convertir
    return [{'ID_Etiqueta': r[0], 'Nombre_etiqueta': r[1]} for r in rows] # Se convierte si son tuplas y se muestra el id de etiqueta,el nombre de etiqueta con un bucle for y se retornara en el front end



# =============================================
# FUNCION PARA OBTENER EL ADJUNTO DE CADA NOTA
# =============================================

def verificar_adjuntos_nota(nota_id, cursor): # Para obtener los adjuntos de la nota
    """
    Devuelve True si la nota tiene al menos un adjunto en la tabla Adjuntos.
    """
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




    
# --------------------------------------------------
# Rutas públicas y vistas (páginas)
# --------------------------------------------------


# =====================================================================================
# OJO: SON SOLO RUTAS PUBLICAS,CUALQUIER USUARIO NO REGISTRADO PUEDE VERLAS,EL RESTO NO
# =====================================================================================

# =====================================
# RUTA 1: LA QUE SE MUESTRA POR DEFECTO
# =====================================

@app.route('/')
def inicio():
    """Página de bienvenida (antes de autenticarse)."""
    return render_template("bienvenidoalapagina.html")


# ===================================
# RUTA 2: LA QUE LLEVA A REGISTRARSE
# ===================================

@app.route('/registro.html')
def mostrar_registro():
    """Formulario de registro."""
    return render_template("registro.html")


# =====================================
# RUTA 3: LA QUE LLEVA A INICIAR SESION
# =====================================

@app.route('/iniciarsesion.html')
def mostrar_login():
    """Formulario de inicio de sesión."""
    return render_template("iniciarsesion.html")


# =====================================
# RUTA 4: LA QUE LLEVA A INICIAR SESION
# =====================================

@app.route('/caracteristicas.html')
def caracteristicas():
    """Página de características."""
    return render_template("caracteristicas.html")


# ============================
# RUTAS LOGICAS (NO FRONT END)
# ============================

# --------------------------------------------------
# Procesar registro
# --------------------------------------------------

@app.route('/procesar-registro', methods=['POST']) # RUTA QUE PROCESA EL METODO HTTP: POST para enviar datos al servidor (En este caso del back end a la db)


# PROCESOS DE METODO HTTP:

# GET: Se utiliza para solicitar un recurso del servidor. Por ejemplo, cuando navegas a una página web, tu navegador usa GET para obtener el contenido de esa página. Es un método "seguro" y "idempotente", lo que significa que no debería cambiar el estado del servidor y puede repetirse sin causar efectos secundarios.
# POST: Se emplea para enviar datos a un servidor para crear un nuevo recurso. Un ejemplo común es enviar un formulario de registro, donde se crea un nuevo usuario.
# PUT: Se utiliza para actualizar completamente un recurso existente. Si el recurso no existe, crea uno nuevo. Es similar a reemplazar un archivo por uno nuevo. Es idempotente.
# DELETE: Se usa para eliminar un recurso específico del servidor.
# PATCH: Se utiliza para aplicar modificaciones parciales a un recurso. A diferencia de PUT, que reemplaza todo, PATCH actualiza solo los campos que se envían. 

def procesar_registro(): # funcion que hace todo el proceso
    """
    Procesa el registro de un nuevo usuario.
    Validaciones:
      - Campos obligatorios.
      - Teléfono numérico.
      - Usuario o correo duplicados.
    NOTA: Se mantiene el mismo esquema de almacenamiento de contraseña
    que ya tengas en BD (no se cambia formato para no romper cuentas).
    """
    conexion = None # la conexion por ahora es nula
    cursor = None # al igual que el cursor
    try: # try para que el programa no se detenga bruscamente
        conexion = conectar_db() # funcion conectar_db a travez de la variable conexion
        if conexion is None: # si la conexion sigue siendo nula;
            return jsonify({'error': 'No se pudo conectar a la base de datos'}), 500  # error
        # SE ATRAPAN LOS DATOS ASI:
        datos = request.form # para recolectarlos del formulario
        Nombres = datos.get('nombre', '').strip() # .get para agarrarlos y .strip() para eliminar espacios innesecarios
        Apellidos = datos.get('apellido', '').strip() # .get para agarrarlos y .strip() para eliminar espacios innesecarios
        Telefono = datos.get('telefono', '').strip() # .get para agarrarlos y .strip() para eliminar espacios innesecarios
        Correo = datos.get('correo', '').strip() # .get para agarrarlos y .strip() para eliminar espacios innesecarios
        Usuario = datos.get('usuario', '').strip() # .get para agarrarlos y .strip() para eliminar espacios innesecarios
        Contraseña = datos.get('contraseña', '').strip() # .get para agarrarlos y .strip() para eliminar espacios innesecarios
        Color_principal = datos.get('color_principal', 'Blanco').strip() # .get para agarrarlos y .strip() para eliminar espacios innesecarios

        if not all([Nombres, Apellidos, Telefono, Correo, Usuario, Contraseña]): # si no estan todos los datos 
            return jsonify({'error': 'Todos los campos son obligatorios'}), 400 # error

        if not Telefono.isdigit(): # si el numero de telefono no es numerico
            return jsonify({'error': 'El teléfono debe contener solo números'}), 400 # error

        cursor = conexion.cursor() # se emplea cursor para que se ejecuta y se verifique un proceso en la db

        # Verificar duplicados por Usuario o Correo
        cursor.execute("""
            SELECT "ID_Cuenta" FROM public."Cuentas"
            WHERE "Usuario" = %s OR "Correo" = %s
        """, (Usuario, Correo)) # se ejecuta el cursor para seleccionar el id de cuentas donde el usuario y el correo sean los de esta tupla
        # cursor.fetchone() es un método en programación que se usa para obtener la siguiente fila de un conjunto de resultados de una consulta a una base de datos
        if cursor.fetchone(): # si es True devuelve esos datos iguales; osea ya esta registrado
            
            return jsonify({'error': 'El usuario o correo ya está registrado en NoteFlow'}), 409 # error

# Generar nuevo ID_Cuenta (MANTENEMOS ESTA LÓGICA)
# --- app.py (dentro de procesar_registro) ---

        # Generar nuevo ID_Cuenta (TU LÓGICA ORIGINAL)
        cursor.execute('SELECT COALESCE(MAX("ID_Cuenta"), 0) + 1 FROM public."Cuentas"') # Se selecciona  con cursor:
        # COALESCE en SQL es para agarrar algo; si es nulo sigue,y si no es nulo,osea obligatorio,lo consigue,lo encuentra hasta que no para
        # Basicamente consigue el ultimo valor con max para que se ahorre el trabajo de buscarlo,y luego a ese le suma 1 de,todo de la tabla cuentas
        nuevo_id = cursor.fetchone()[0]
        
        #  Añadir la fecha de creación 
        fecha_creacion = datetime.now() 

        cursor.execute("""
            INSERT INTO public."Cuentas"
            ("ID_Cuenta", "Usuario", "Contraseña", "Nombres", "Apellidos", "Telefono", "Correo", "Color_principal")
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING "ID_Cuenta";
        """, (nuevo_id, Usuario, Contraseña, Nombres, Apellidos, Telefono, Correo, Color_principal)) # ejecuta e inserta dentro de la tabla cuentas los campos dado por el usuario en el registro

        cuenta_id = cursor.fetchone()[0] # se hace fetchone para guardar el id de la cuenta del usuario con el indice de la tupla
        conexion.commit() # se guardan los cambios

        # Iniciar sesión automáticamente
        session['usuario_id'] = cuenta_id
        session['usuario_nombre'] = Usuario

        # RETORNA EN FORMATO JSON EL SGT MENSAJE:

        return jsonify({
            'success': True,
            'mensaje': 'Registro exitoso',
            'id': cuenta_id,
            'redirect': '/dashboard'
        }), 201
    # y si con el try da error:

    except Exception as e: # se da error y se le asigna a ese error la variable e
        if conexion: # y si la conexion aun sigue
            conexion.rollback()  #rollback es una operación utilizada en bases de datos para deshacer cambios que no se han confirmado todavía.
            # osea borra solo  los datos  que aún no estaban guardados con commit().
        print(f"Error al registrar el usuario: {e}") # se imprime el error
        return jsonify({'error': 'Error al procesar la solicitud'}), 500 # retorna en formato json el error para que el user vea

    finally: # finalmente
        if cursor: # si el cursor sigue se cierra:
            cursor.close() # aqui
        if conexion:  # si la conexion sigue se cierra:
            conexion.close() # aqui


# ============================
# RUTAS LOGICAS (NO FRONT END)
# ============================

# --------------------------------------------------
# Procesar login
# --------------------------------------------------

@app.route('/procesar-login', methods=['POST'])# RUTA QUE PROCESA EL METODO HTTP: POST para enviar datos al servidor (En este caso del back end a la db)


# PROCESOS DE METODO HTTP:

# GET: Se utiliza para solicitar un recurso del servidor. Por ejemplo, cuando navegas a una página web, tu navegador usa GET para obtener el contenido de esa página. Es un método "seguro" y "idempotente", lo que significa que no debería cambiar el estado del servidor y puede repetirse sin causar efectos secundarios.
# POST: Se emplea para enviar datos a un servidor para crear un nuevo recurso. Un ejemplo común es enviar un formulario de registro, donde se crea un nuevo usuario.
# PUT: Se utiliza para actualizar completamente un recurso existente. Si el recurso no existe, crea uno nuevo. Es similar a reemplazar un archivo por uno nuevo. Es idempotente.
# DELETE: Se usa para eliminar un recurso específico del servidor.
# PATCH: Se utiliza para aplicar modificaciones parciales a un recurso. A diferencia de PUT, que reemplaza todo, PATCH actualiza solo los campos que se envían. 

def procesar_login(): # funcion que procesa el inicio de sesion
    """
    Valida credenciales del usuario y crea la sesión.
    Observación: comparación de contraseña en texto plano para mantener
    retrocompatibilidad con la BD actual.
    Recomendación: migrar a hashing (bcrypt/werkzeug) en producción.
    """
    conexion = None # conexion nulo
    cursor = None # cursor nulo
    try: # para que no se detenga bruscamente
        conexion = conectar_db() # variable que ejecuta la conexion 
        if conexion is None: # si aun es none
            return jsonify({'error': 'No se pudo conectar a la base de datos'}), 500 # error

        datos = request.form # se atrapa los datos
        Usuario = datos.get('usuario', '').strip() # se agarran con .get y strip() para eliminar espacios en blanco
        Contraseña = datos.get('contraseña', '').strip()  # se agarran con .get y strip() para eliminar espacios en blanco

        if not Usuario or not Contraseña: # si no esta ninguno de los dos campos
            return jsonify({'error': 'Usuario y contraseña son obligatorios'}), 400 # error

        cursor = conexion.cursor(cursor_factory=RealDictCursor) # se agarra el metodo RealDictCursor con la conexion para obtener datos

        cursor.execute(""" 
            SELECT "ID_Cuenta", "Usuario", "Nombres", "Apellidos", "Color_principal"
            FROM public."Cuentas"
            WHERE "Usuario" = %s AND "Contraseña" = %s
        """, (Usuario, Contraseña)) # se seleccionan los datos de cuentas

        usuario = cursor.fetchone() # se usa fetchone para atraparlos

        if usuario: # si el usuario es True
            # Registrar proceso de inicio de sesión
            session['usuario_id'] = usuario['ID_Cuenta'] # se crea esa llave con el valor de usuario ID_Cuenta y analiza si son iguales
            session['usuario_nombre'] = usuario['Usuario'] # al igual que el nombre y analiza si son iguales
            # Y si fue True retorna en formato JSON:
            return jsonify({
                'success': True,
                'mensaje': 'Inicio de sesión exitoso',
                'redirect': '/dashboard'
            }), 200
        else: # y si no es True: Osea false
            return jsonify({'error': 'Usuario o contraseña incorrectos'}), 401 # error

    except Exception as e: # y si ocurre un error se le asigna al error la variable e
        print(f"Error al iniciar sesión: {e}") # error
        return jsonify({'error': 'Error al procesar la solicitud'}), 500 # se retorna en fromato JSON ese error tambien

    finally: # finalmente
        if cursor: # si cursor sigue true
            cursor.close() # se cierra
        if conexion: # al igual que conexion
            conexion.close() # aqui


# ============================
# RUTAS LOGICAS (NO FRONT END)
# ============================

# --------------------------------------------------
# Logout
# --------------------------------------------------

@app.route('/logout') 
def cerrar_sesion(): # funcion para que cerrar sesion
    """Limpia la sesión activa y redirige a la página de inicio."""
    session.clear() # se limpia la sesion .clear()
    return redirect(url_for('inicio'))  # y se retorna a la url inicio que tiene el template bienvenida.html


# --------------------------------------------------
# Endpoint para servir adjuntos guardados (descarga/preview)
# --------------------------------------------------
@app.route('/uploads/<path:filename>')
def uploaded_file(filename): # funcion para devolver los archivos que dan los usuarios
    """Devuelve archivos guardados en la carpeta uploads (solo para desarrollo)."""
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

# --------------------------------------------------
# Endpoint para subir un adjunto a una nota (simple)
# - Guarda archivo en /uploads y registra en tabla "Adjuntos"
# - Valida existencia de nota y permisos (basado en ID_Cuenta en sesión)
# --------------------------------------------------
@app.route('/nota/<int:nota_id>/adjunto', methods=['POST']) # RUTA QUE PROCESA EL METODO HTTP: POST para enviar datos al servidor (En este caso del back end a la db)
def subir_adjunto(nota_id):     # funcion para subir adjunto
    """
    Endpoint para subir un archivo y asociarlo a una nota. 
    Form-data: file -> archivo
    """
    if 'usuario_id' not in session: # si no esta el usuario id en la sesion activa
        return jsonify({'error': 'No autorizado'}), 401 # error

    archivo = request.files.get('file') # se agarra el archivo con request.files.get
    if not archivo: # si no hay archivo
        return jsonify({'error': 'No se recibió archivo'}), 400 # error en formato JSON

    # Validaciones básicas de tipo y tamaño pueden añadirse aquí
    filename_orig = archivo.filename # se agarra el nombre del archivo original
    ext = os.path.splitext(filename_orig)[1].lower() # se agarra la extension del archivo original y se convierte a minusculas
    # Generar nombre único
    filename_saved = f"{uuid.uuid4().hex}{ext}" # se genera un nombre unico con uuid4 y se le agrega la extension
    save_path = os.path.join(app.config['UPLOAD_FOLDER'], filename_saved) # se crea la ruta de guardado con la carpeta uploads y el nombre unico
    try: # para que no se detenga bruscamente
        archivo.save(save_path) # se guarda el archivo en la ruta de guardado
    except Exception as e: # y si da error se le asigna al error la variable e
        print("Error al guardar archivo:", e) # se imprime el error
        return jsonify({'error': 'Error al guardar archivo'}), 500 # error en formato JSON

    # Registrar en BD (Adjuntos)
    conexion = None   # conexion nula
    cur = None  # cursor nulo
    try: # para que no se detenga bruscamente
        conexion = conectar_db() # se conecta a la db
        cur = conexion.cursor() # se crea el cursor

        # Validar que la nota exista y pertenezca al usuario
        cur.execute("""
            SELECT "ID_Nota", "ID_Cuenta" FROM public."Notas"
            WHERE "ID_Nota" = %s
        """, (nota_id,)) # se selecciona el id de nota y el id de cuenta de la tabla notas donde el id de nota sea igual al de la tupla
        row = cur.fetchone() # se hace fetchone para atraparlo
        if not row: # si no es True
            return jsonify({'error': 'Nota no encontrada'}), 404 # error en formato JSON

        # Insertar nuevo ID_Adjunto manualmente (si tu tabla no tiene serial)
        cur.execute('SELECT COALESCE(MAX("ID_Adjunto"), 0) + 1 FROM public."Adjuntos"') # se selecciona con cursor:
        # COALESCE en SQL es para agarrar algo; si es nulo sigue,y si no es nulo,osea obligatorio,lo consigue,lo encuentra hasta que no para
        # Basicamente consigue el ultimo valor con max para que se ahorre el trabajo de buscarlo,y luego a ese le suma 1 de,todo de la tabla adjuntos   
        nuevo_id = cur.fetchone()[0] # se hace fetchone para atraparlo

        cur.execute("""
            INSERT INTO public."Adjuntos"
            ("ID_Adjunto", "ID_Nota", "Ruta_archivo", "Nombre_archivo", "Formato")
            VALUES (%s, %s, %s, %s, %s)
            RETURNING "ID_Adjunto"
        """, (nuevo_id, nota_id, save_path, filename_orig, ext.replace('.', ''))) # se inserta en la tabla adjuntos los campos dados por el usuario
        id_adj = cur.fetchone()[0] # se hace fetchone para atrapar el id del adjunto
        conexion.commit() # se guardan los cambios

        return jsonify({'success': True, 'ID_Adjunto': id_adj}), 201 # se retorna en formato JSON el id del adjunto

    except Exception as e: # y si da error se le asigna al error la variable e
        if conexion: # si la conexion sigue
            conexion.rollback() # se borran los cambios no guardados    
        print("Error registrando adjunto:", e) # se imprime el error
        return jsonify({'error': 'Error al registrar adjunto'}), 500 # error en formato JSON

    finally:  # finalmente
        if cur: # si el cursor sigue
            cur.close() # se cierra
        if conexion: # si la conexion sigue
            conexion.close() # se cierra













# --------------------------------------------------
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename
import os
from psycopg2.extras import RealDictCursor

# ---------------------------
#  PERFIL
# ---------------------------

@app.route('/perfil')
def perfil():
    if 'usuario_id' not in session:
        return redirect(url_for('mostrar_login'))

    user_id = session['usuario_id']

    conn = conectar_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("""
        SELECT "ID_Cuenta", "Nombres", "Correo", "Foto", "Color_principal"
        FROM public."Cuentas"
        WHERE "ID_Cuenta" = %s
    """, (user_id,))

    usuario = cur.fetchone()

    conn.close()

    if not usuario:
        return "Usuario no encontrado", 404

    return render_template("perfil.html", usuario=usuario)



# ---------------------------
# CAMBIAR TEMA (CLARO / OSCURO)
# ---------------------------

@app.route('/perfil/cambiar-tema', methods=['POST'])
def cambiar_tema():
    if 'usuario_id' not in session:
        return jsonify({"error": "Sesión expirada"}), 403

    tema = request.form.get("tema")
    if tema not in ["claro", "oscuro"]:
        return jsonify({"error": "Tema inválido"}), 400

    user_id = session['usuario_id']

    conn = conectar_db()
    cur = conn.cursor()

    cur.execute("""
        UPDATE public."Cuentas"
        SET color_principal = %s
        WHERE "ID_Cuenta" = %s
    """, (tema, user_id))

    conn.commit()
    cur.close()
    conn.close()

    session["color_principal"] = tema

    return jsonify({"success": True, "mensaje": "Tema actualizado"})


# ---------------------------
# CAMBIAR CONTRASEÑA
# ---------------------------

@app.route('/perfil/cambiar-password', methods=['POST'])
def cambiar_password():
    if 'usuario_id' not in session:
        return redirect(url_for("mostrar_login"))

    user_id = session["usuario_id"]

    actual = request.form["password_actual"]
    nueva = request.form["password_nueva"]
    confirm = request.form["password_confirmacion"]

    if nueva != confirm:
        return "Las nuevas contraseñas no coinciden."

    if len(nueva) > 15:
        return "La contraseña no puede superar 15 caracteres."

    conn = conectar_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute('SELECT "Contraseña" FROM public."Cuentas" WHERE "ID_Cuenta" = %s', (user_id,))
    user = cur.fetchone()

    if not user or not check_password_hash(user["Contraseña"], actual):
        return "La contraseña actual es incorrecta."

    if check_password_hash(user["Contraseñas"], nueva):
        return "La nueva contraseña no puede ser igual a la anterior."

    nueva_hash = generate_password_hash(nueva)

    cur.execute("""
        UPDATE public."Cuentas"
        SET "password" = %s
        WHERE "ID_Cuenta" = %s
    """, (nueva_hash, user_id))

    conn.commit()
    conn.close()

    return "Tu contraseña ha sido actualizada exitosamente."


# ---------------------------
# SUBIR FOTO DE PERFIL
# ---------------------------

UPLOAD_FOLDER = "static/uploads/profile"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.route('/perfil/subir-foto', methods=["POST"])
def subir_foto():
    if "usuario_id" not in session:
        return redirect(url_for("mostrar_login"))

    archivo = request.files.get("foto")

    if not archivo:
        return "No se seleccionó ninguna imagen."

    filename = secure_filename(archivo.filename)
    ruta = os.path.join(UPLOAD_FOLDER, filename)
    archivo.save(ruta)

    ruta_db = f"uploads/profile/{filename}"

    user_id = session["usuario_id"]

    conn = conectar_db()
    cur = conn.cursor()

    cur.execute("""
        UPDATE public."Cuentas"
        SET "Foto" = %s
        WHERE "ID_Cuenta" = %s
    """, (ruta_db, user_id))

    conn.commit()
    conn.close()

    return redirect(url_for("perfil"))


# ---------------------------
# CERRAR SESIÓN
# ---------------------------

@app.route("/perfil/cerrar-sesion")
def cerrar_sesion_perfil():
    session.clear()
    return redirect(url_for("mostrar_login"))


















# --------------------------------------------------
# ENDPOINTS PARA ETIQUETAS (CRUD mínimo)
# --------------------------------------------------
@app.route('/etiqueta/crear', methods=['POST'])  # RUTA QUE PROCESA EL METODO HTTP: POST para enviar datos al servidor (En este caso del back end a la db)
def crear_etiqueta():   # funcion para crear etiqueta
    """
    Crea una etiqueta nueva.
    Body form-data: nombre_etiqueta
    """
    if 'usuario_id' not in session: # si no esta el usuario id en la sesion activa
        return jsonify({'error': 'No autorizado'}), 401 # error en formato JSON

    nombre = request.form.get('nombre_etiqueta', '').strip() # se agarra el nombre de la etiqueta con request.form.get y se le quitan los espacios en blanco con strip()
    if not nombre: # si no hay nombre
        return jsonify({'error': 'Nombre obligatorio'}), 400    # error en formato JSON

    conn = None  # conexion nula
    cur = None # cursor nulo 
    try: # para que no se detenga bruscamente
        conn = conectar_db() # se conecta a la db
        cur = conn.cursor() # se crea el cursor

        # Evitar duplicados por nombre
        cur.execute("""
            SELECT "ID_Etiqueta" FROM public."Etiquetas" WHERE "Nombre_etiqueta" = %s
        """, (nombre,)) # se selecciona el id de etiqueta de la tabla etiquetas donde el nombre de la etiqueta sea igual al de la tupla
        if cur.fetchone(): # si es True devuelve esos datos iguales; osea ya esta registrado
            return jsonify({'error': 'Etiqueta ya existe'}), 409  # error en formato JSON

        cur.execute('SELECT COALESCE(MAX("ID_Etiqueta"), 0) + 1 FROM public."Etiquetas"') # se selecciona con cursor:
        nuevo = cur.fetchone()[0] # se hace fetchone para atraparlo
 
        cur.execute(""" 
            INSERT INTO public."Etiquetas" ("ID_Etiqueta", "Nombre_etiqueta")
            VALUES (%s, %s)
            RETURNING "ID_Etiqueta"
        """, (nuevo, nombre)) # se inserta en la tabla etiquetas los campos dados por el usuario 
        id_et = cur.fetchone()[0] # se hace fetchone para atrapar el id de la etiqueta
        conn.commit() # se guardan los cambios 
        return jsonify({'success': True, 'ID_Etiqueta': id_et}), 201 # se retorna en formato JSON el id de la etiqueta

    except Exception as e: # y si da error se le asigna al error la variable e
        if conn:  # si la conexion sigue
            conn.rollback() # se borran los cambios no guardados
        print("Error creando etiqueta:", e) # se imprime el error
        return jsonify({'error': 'Error interno'}), 500 # error en formato JSON

    finally: # finalmente
        if cur: # si el cursor sigue
            cur.close() # se cierra
        if conn: # si la conexion sigue
            conn.close() # se cierra

@app.route('/nota/<int:nota_id>/etiqueta/asignar', methods=['POST'])    # RUTA QUE PROCESA EL METODO HTTP: POST para enviar datos al servidor (En este caso del back end a la db) 
def asignar_etiqueta_a_nota(nota_id):  # funcion para asignar etiqueta a nota
    """
    Asigna una etiqueta existente a una nota.
    Body form-data: id_etiqueta
    """
    if 'usuario_id' not in session: # si no esta el usuario id en la sesion activa
        return jsonify({'error': 'No autorizado'}), 401 # error en formato JSON

    id_etiqueta = request.form.get('id_etiqueta') # se agarra el id de la etiqueta con request.form.get
    if not id_etiqueta: # si no hay id de etiqueta
        return jsonify({'error': 'id_etiqueta obligatorio'}), 400  # error en formato JSON

    conn = None # conexion nula
    cur = None # cursor nulo
    try: # para que no se detenga bruscamente
        conn = conectar_db() # se conecta a la db
        cur = conn.cursor() # se crea el cursor

        # Validar existencia de nota
        cur.execute('SELECT "ID_Nota", "ID_Cuenta" FROM public."Notas" WHERE "ID_Nota" = %s', (nota_id,))   # se selecciona el id de nota y el id de cuenta de la tabla notas donde el id de nota sea igual al de la tupla
        nota_row = cur.fetchone() # se hace fetchone para atraparlo 
        if not nota_row: # si no es True
            return jsonify({'error': 'Nota no encontrada'}), 404 # error en formato JSON

        # Validar existencia de etiqueta
        cur.execute('SELECT "ID_Etiqueta" FROM public."Etiquetas" WHERE "ID_Etiqueta" = %s', (id_etiqueta,))  # se selecciona el id de etiqueta de la tabla etiquetas donde el id de etiqueta sea igual al de la tupla
        if not cur.fetchone(): # si no es True
            return jsonify({'error': 'Etiqueta no encontrada'}), 404 # error en formato JSON

        # Evitar duplicados en la relación
        cur.execute("""
            SELECT 1 FROM public."Notas_etiquetas"
            WHERE "ID_Nota" = %s AND "ID_Etiqueta" = %s
        """, (nota_id, id_etiqueta)) # se selecciona 1 de la tabla notas_etiquetas donde el id de nota y el id de etiqueta sean iguales a los de la tupla
        if cur.fetchone(): # si es True devuelve esos datos iguales; osea ya esta registrado
            return jsonify({'error': 'Etiqueta ya asignada a la nota'}), 409 # error en formato JSON

        cur.execute("""
            INSERT INTO public."Notas_etiquetas" ("ID_Nota", "ID_Etiqueta")
            VALUES (%s, %s)
        """, (nota_id, id_etiqueta)) # se inserta en la tabla notas_etiquetas los campos dados por el usuario
        conn.commit() # se guardan los cambios
        return jsonify({'success': True}), 201 # se retorna en formato JSON el exito

    except Exception as e: # y si da error se le asigna al error la variable e
        if conn: # si la conexion sigue
            conn.rollback() # se borran los cambios no guardados
        print("Error asignando etiqueta:", e) # se imprime el error 
        return jsonify({'error': 'Error interno'}), 500 # error en formato JSON

    finally: # finalmente 
        if cur: # si el cursor sigue
            cur.close() # se cierra
        if conn: # si la conexion sigue
            conn.close() # se cierra

# --------------------------------------------------
# DASHBOARD (usa datos reales de la BD: etiquetas y adjuntos)
# --------------------------------------------------
@app.route('/dashboard') # ruta del dashboard
def dashboard():  # funcion para el dashboard
    """
    Carga página de dashboard con:
      - datos del usuario (Nombres, color_principal)
      - conteos: notas activas, carpetas, notas en papelera
      - listado de notas recientes (con etiquetas reales y flag de adjuntos)
    """
    if 'usuario_id' not in session: # si no esta el usuario id en la sesion activa
        return redirect(url_for('mostrar_login')) # redirige a la url mostrar login

    user_id = session['usuario_id'] # se agarra el id del usuario de la sesion activa

    conn = None # conexion nula
    cur = None # cursor nulo
    try: # para que no se detenga bruscamente
        conn = conectar_db() # se conecta a la db
        cur = conn.cursor(cursor_factory=RealDictCursor) # se crea el cursor con el metodo RealDictCursor para obtener datos

        # Datos del usuario
        cur.execute("""
            SELECT "Nombres", "Color_principal"
            FROM public."Cuentas"
            WHERE "ID_Cuenta" = %s
        """, (user_id,)) # se selecciona el nombre y el color principal de la tabla cuentas donde el id de cuenta sea igual al de la tupla
        usuario_row = cur.fetchone() # se hace fetchone para atraparlo
        if not usuario_row: # si no se encuentra el usuario
            session.clear() # si no es True se limpia la sesion
            return redirect(url_for('mostrar_login')) # redirige a la url mostrar login

        usuario_para_template = { # se crea un diccionario con los datos del usuario para el template
            'nombre': usuario_row.get('Nombres'), 
            'color_principal': usuario_row.get('Color_principal')
        } 

        # Conteos
        cur.execute(""" 
            SELECT COUNT(*) AS total_notas FROM public."Notas"
            WHERE "ID_Cuenta" = %s AND LOWER("Estado") = 'activa'
        """, (user_id,)) # se selecciona el conteo de notas de la tabla notas donde el id de cuenta sea igual al de la tupla y el estado sea activa
        total_notas = cur.fetchone()['total_notas'] # se hace fetchone para atrapar el conteo de notas activas

        cur.execute("""
            SELECT COUNT(*) AS total_carpetas FROM public."Carpetas"
            WHERE "ID_Cuenta" = %s
        """, (user_id,)) # se selecciona el conteo de carpetas de la tabla carpetas donde el id de cuenta sea igual al de la tupla
        total_carpetas = cur.fetchone()['total_carpetas'] # se hace fetchone para atrapar el conteo de carpetas

        cur.execute("""
            SELECT COUNT(*) AS notas_papelera FROM public."Notas"
            WHERE "ID_Cuenta" = %s AND LOWER("Estado") = 'papelera'
        """, (user_id,)) # se selecciona el conteo de notas de la tabla notas donde el id de cuenta sea igual al de la tupla y el estado sea papelera
        notas_papelera = cur.fetchone()['notas_papelera']  # se hace fetchone para atrapar el conteo de notas en papelera

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
        """, (user_id,)) # se seleccionan los datos de la tabla notas donde el id de cuenta sea igual al de la tupla y el estado sea activa, ordenados por fecha de edicion descendente y limitados a 6
        notas_raw = cur.fetchall() # se hace fetchall para atraparlos todos

        notas_recientes = [] # se crea una lista vacia para las notas recientes
        for nota in notas_raw: # bucle para cada nota en las notas atrapadas 
            # nota es dict por RealDictCursor
            nota_id = nota['ID_Nota'] # se agarra el id de la nota
            etiquetas = obtener_etiquetas_nota(nota_id, cur) # se obtienen las etiquetas de la nota con la funcion obtener_etiquetas_nota
            has_adj = verificar_adjuntos_nota(nota_id, cur) # se verifica si la nota tiene adjuntos con la funcion verificar_adjuntos_nota
            notas_recientes.append({
                'ID_Nota': nota_id,
                'Titulo': nota.get('Titulo'),
                'Descripcion': nota.get('Descripcion'),
                'Fecha_deedicion': nota.get('Fecha_deedicion'),
                'ID_Categorias': nota.get('ID_Categorias'),
                'Etiquetas': etiquetas,
                'Has_Adjuntos': has_adj
            }) # se agrega la nota con sus detalles a la lista de notas recientes

        return render_template( # se retorna el template dashboard.html con los datos del usuario y las notas recientes
            'dashboard.html',
            usuario=usuario_para_template,
            total_notas=total_notas,
            total_carpetas=total_carpetas,
            notas_papelera=notas_papelera,
            notas_recientes=notas_recientes
        ) # se cierra el render template

    except Exception as e: # y si da error se le asigna al error la variable e
        import traceback # se importa traceback
        traceback.print_exc() # se imprime el traceback del error
        return f"Error al cargar dashboard: {str(e)}", 500 # error

    finally: # finalmente
        if cur: # si el cursor sigue
            cur.close() # se cierra
        if conn: # si la conexion sigue
            conn.close() # se cierra

# ============================================
# RUTA: SECCIÓN NOTAS (GESTIONAR NOTAS)
# Basado en requerimientogestionarnotas.docx
# ============================================



# ---------- RUTA /notas (LISTAR + FILTRAR) ----------
# --- RUTA /NOTAS (LISTADO, BÚSQUEDA Y FILTROS) ---
from urllib.parse import urlencode # para manejar query strings


@app.route('/notas')   # ruta notas
def notas(): # funcion que ejecuta las notas
    """
    CORRECCIÓN FINAL: Lista las notas del usuario logueado con filtros y paginación.
    Asegura la extracción correcta del valor de COUNT para resolver el error '0'.
    """
    if 'usuario_id' not in session: # si no esta el usuario id en la sesion activa
        return redirect(url_for('mostrar_login')) # redirige a la url mostrar login

    user_id = session['usuario_id'] # se agarra el id del usuario de la sesion activa

    # Parámetros de la querystring (request.args)
    q = (request.args.get('q') or '').strip() # se agarra la querystring q y se le quitan los espacios en blanco con strip()
    etiqueta = request.args.get('etiqueta') or '' # se agarra la querystring etiqueta
    carpeta = request.args.get('carpeta') or '' # se agarra la querystring carpeta
    formato = request.args.get('formato') or '' # se agarra la querystring formato
    categoria = request.args.get('categoria') or '' # se agarra la querystring categoria
    estado = request.args.get('estado') or 'Activa' # se agarra la querystring estado, por defecto es Activa

    try: # para que no se detenga bruscamente
        page = int(request.args.get('page', 1)) # se agarra la querystring page, por defecto es 1 y se convierte a entero
        if page < 1: # si la pagina es menor que 1
            page = 1 # la pagina es 1
    except ValueError: # y si da error de valor
        page = 1 # la pagina es 1
    per_page = 12 # notas por pagina

    conn = None # conexion nula
    cur = None # cursor nulo
    try: # para que no se detenga bruscamente
        # CONEXIÓN: Usamos RealDictCursor (dict_cursor=True)
        conn = conectar_db(dict_cursor=True)
        cur = conn.cursor()

        # --- Obtener listas para selects (usan RealDictCursor) ---
        cur.execute('SELECT "ID_Etiqueta", "Nombre_etiqueta" FROM public."Etiquetas" ORDER BY "Nombre_etiqueta"') # se selecciona el id de etiqueta y el nombre de la etiqueta de la tabla etiquetas ordenados por nombre de etiqueta
        all_tags = cur.fetchall() # se obtienen todas las etiquetas

        cur.execute('SELECT "ID_Carpeta", "Nombre_carpeta" FROM public."Carpetas" WHERE "ID_Cuenta" = %s ORDER BY "Nombre_carpeta"', (user_id,)) # se selecciona el id de carpeta y el nombre de la carpeta de la tabla carpetas donde el id de cuenta sea igual al de la tupla, ordenados por nombre de carpeta
        all_folders = cur.fetchall() # se obtienen todas las carpetas del usuario

        cur.execute('SELECT DISTINCT "Formato" FROM public."Notas" WHERE "ID_Cuenta" = %s AND "Formato" IS NOT NULL ORDER BY "Formato"', (user_id,))  # se seleccionan los formatos distintos de la tabla notas donde el id de cuenta sea igual al de la tupla y el formato no sea nulo, ordenados por formato
        all_formats = cur.fetchall() # se obtienen todos los formatos distintos de las notas del usuario
        
        cur.execute('SELECT "ID_Categorias", "Nombre_categoria" FROM public."Categorias" ORDER BY "ID_Categorias"') # se selecciona el id de categorias y el nombre de la categoria de la tabla categorias ordenados por id de categorias
        all_categories = cur.fetchall() # se obtienen todas las categorias

        # --- Construir WHERE dinámico y parámetros ---
        where_clauses = ['n."ID_Cuenta" = %s'] # se crea una lista con la clausula where para el id de cuenta
        params = [user_id] # se crea una lista con el id del usuario
        join_etiqueta = '' # join por defecto vacio 

        if estado: # si hay estado
            where_clauses.append('LOWER(n."Estado") = LOWER(%s)') # se agrega a la lista de clausulas where la clausula para el estado en minusculas
            params.append(estado) # se agrega a la lista de parametros el estado

        if q: # si hay query de búsqueda
            where_clauses.append('(COALESCE(n."Titulo", \'\') ILIKE %s OR COALESCE(n."Descripcion", \'\') ILIKE %s OR COALESCE(n."Contenido", \'\') ILIKE %s)') # se agrega a la lista de clausulas where la clausula para el titulo, descripcion y contenido con ILIKE y COALESCE para evitar nulos
            like_q = f'%{q}%' # se crea la variable like_q con el valor de la query de búsqueda con % al inicio y al final
            params.extend([like_q, like_q, like_q]) # se agregan a la lista de parametros el like_q tres veces

        if formato: # si hay formato
            where_clauses.append('n."Formato" = %s') # se agrega a la lista de clausulas where la clausula para el formato
            params.append(formato) # se agrega a la lista de parametros el formato

        if categoria and categoria.isdigit(): # si hay categoria y es un digito
            where_clauses.append('n."ID_Categorias" = %s') # se agrega a la lista de clausulas where la clausula para el id de categorias
            params.append(int(categoria)) # se agrega a la lista de parametros el id de categorias convertido a entero
 
        if carpeta: # si hay carpeta
            if carpeta == '__SIN__': # si la carpeta es __SIN__
                where_clauses.append('n."ID_Carpeta" IS NULL') # se agrega a la lista de clausulas where la clausula para el id de carpeta nulo
            elif carpeta.isdigit(): # y si la carpeta es un digito
                where_clauses.append('n."ID_Carpeta" = %s') # se agrega a la lista de clausulas where la clausula para el id de carpeta
                params.append(int(carpeta)) # se agrega a la lista de parametros el id de carpeta convertido a entero

        if etiqueta and etiqueta.isdigit(): # si hay etiqueta y es un digito
            join_etiqueta = 'JOIN public."Notas_etiquetas" ne ON ne."ID_Nota" = n."ID_Nota"' # se crea el join para la tabla notas_etiquetas
            where_clauses.append('ne."ID_Etiqueta" = %s') # se agrega a la lista de clausulas where la clausula para el id de etiqueta
            params.append(int(etiqueta)) # se agrega a la lista de parametros el id de etiqueta convertido a entero

        where_sql = ' AND '.join(where_clauses) # se une la lista de clausulas where con AND

        # --- Contar total para paginación (FIXED) ---
        count_sql = f'''
            SELECT COUNT(DISTINCT n."ID_Nota") AS total
            FROM public."Notas" n
            {join_etiqueta} 
            WHERE {where_sql}
        '''
        cur.execute(count_sql, tuple(params))  # Ejecutamos la consulta de conteo con los parámetros
        total_row = cur.fetchone() # Esperamos: {'total': N}

        # CORRECCIÓN FINAL: Accedemos de forma segura por el nombre de la columna 'total',
        # que es lo que debe devolver RealDictCursor.
        if total_row:
            # Si RealDictCursor funciona, total_row es un diccionario.
            total = total_row.get('total', 0)
        else:
            total = 0
        
        # Aseguramos que 'total' sea un entero
        total = int(total) if total is not None else 0 
        
        total_pages = max(1, (total + per_page - 1) // per_page)
        if page > total_pages:
            page = total_pages
        
        offset = (page - 1) * per_page

        # --- Obtener notas paginadas (Retorna Dicts) ---
        fetch_sql = f'''
            SELECT DISTINCT
                n."ID_Nota",
                n."Titulo",
                n."Descripcion",
                n."Estado",
                n."ID_Carpeta",
                n."ID_Categorias",
                n."Formato",
                n."Fecha_decreacion",
                n."Fecha_deedicion"
            FROM public."Notas" n
            {join_etiqueta}
            WHERE {where_sql}
            ORDER BY n."Fecha_deedicion" DESC NULLS LAST, n."Fecha_decreacion" DESC
            LIMIT %s OFFSET %s
        '''
        cur.execute(fetch_sql, tuple(params) + (per_page, offset)) # se ejecuta la consulta con los parametros, el limite y el offset
        notas_rows = cur.fetchall() # se obtienen todas las notas paginadas

        # --- Obtener auxiliares (usa DictCursor) ---
        # Usamos un cursor auxiliar que también es RealDictCursor
        cur_aux = conn.cursor()    
        notas = [] # se crea una lista vacia para las notas
        for r in notas_rows: # bucle para cada nota en las notas paginadas
            nota_id = r['ID_Nota'] # se agarra el id de la nota 

            etiquetas_list = obtener_etiquetas_nota(nota_id, cur_aux) # se obtienen las etiquetas de la nota

            carpeta_nombre = None # nombre de carpeta por defecto nulo
            id_carpeta = r.get('ID_Carpeta') # se agarra el id de carpeta de la nota
            if id_carpeta is not None: # si el id de carpeta no es nulo
                cur_aux.execute('SELECT "Nombre_carpeta" FROM public."Carpetas" WHERE "ID_Carpeta" = %s', (id_carpeta,)) # se selecciona el nombre de la carpeta de la tabla carpetas donde el id de carpeta sea igual al de la tupla
                cf = cur_aux.fetchone() # se hace fetchone para atraparlo
                carpeta_nombre = cf.get('Nombre_carpeta') if cf else None # se agarra el nombre de la carpeta si cf es True, si no es nulo

            has_adj = verificar_adjuntos_nota(nota_id, cur_aux) # se verifica si la nota tiene adjuntos

            notas.append({ # se agrega la nota con sus detalles a la lista de notas
                'ID_Nota': nota_id,
                'Titulo': r.get('Titulo'),
                'Descripcion': r.get('Descripcion'),
                'Estado': r.get('Estado'),
                'ID_Carpeta': id_carpeta,
                'Nombre_carpeta': carpeta_nombre,
                'ID_Categorias': r.get('ID_Categorias'),
                'Formato': r.get('Formato'),
                'Fecha_decreacion': r.get('Fecha_decreacion'),
                'Fecha_deedicion': r.get('Fecha_deedicion'),
                'Etiquetas': etiquetas_list,
                'Has_Adjuntos': has_adj
            })
        
        cur_aux.close() # se cierra el cursor auxiliar

        # --- Construir querystring helpers para paginación ---
        base_params = {k: v for k, v in [
            ('q', q), ('etiqueta', etiqueta), ('carpeta', carpeta),
            ('formato', formato), ('categoria', categoria), ('estado', estado)
        ] if v} # se crea un diccionario con los parametros base para la querystring, solo si tienen valor
        
        def qs_with_page(p): # funcion para la querystring con la pagina
            if p < 1 or p > total_pages: return None # si la pagina es menor que 1 o mayor que el total de paginas, retorna nulo
            params2 = base_params.copy() # se crea una copia del diccionario de parametros base
            params2['page'] = p # se agrega la pagina al diccionario de parametros
            return urlencode(params2) # se retorna la querystring con los parametros codificados

        pagination = { # se crea un diccionario con la informacion de paginacion
            'page': page, # pagina actual 
            'per_page': per_page, # notas por pagina
            'total': total, # total de notas
            'total_pages': total_pages, # total de paginas
            'prev_querystring': qs_with_page(page - 1), # querystring de la pagina anterior
            'next_querystring': qs_with_page(page + 1) # querystring de la pagina siguiente
        }

        filtros_activos = { # se crea un diccionario con los filtros activos
            'q': q, # filtro de búsqueda
            'etiqueta': etiqueta, # filtro de etiqueta
            'carpeta': carpeta, # filtro de carpeta
            'formato': formato, # filtro de formato
            'categoria': categoria, # filtro de categoria
            'estado': estado # filtro de estado
        }
        
        return render_template(     # se retorna el template notas.html con los datos necesarios
            'notas.html',   
            usuario={'nombre': session.get('usuario_nombre'), 'color_principal': session.get('color_principal', '#3498db')}, # información del usuario
            notas=notas, # lista de notas
            all_tags=all_tags, # lista de todas las etiquetas
            all_folders=all_folders, # lista de todas las carpetas
            all_formats=all_formats, # lista de todos los formatos
            all_categories=all_categories, # lista de todas las categorias
            filtros_activos=filtros_activos, # filtros activos
            pagination=pagination # informacion de paginacion
        )

    except Exception as e: # y si da error se le asigna al error la variable e
        import traceback # se importa traceback
        traceback.print_exc()
        # Imprimir el traceback para que el usuario pueda ver el error real en la consola.
        # Devuelve el error.
        return f"Error al listar notas: {str(e)}", 500 # error

    finally: # finalmente
        if cur: # si el cursor sigue
            cur.close()     # se cierra
        if conn: # si la conexion sigue
            conn.close() # se cierra


# ---------- ACCIONES SOBRE NOTAS ----------
# Mover a papelera (estado -> 'papelera')
@app.route("/nota/<int:nota_id>/eliminar", methods=["POST"])    # RUTA QUE PROCESA EL METODO HTTP: POST para enviar datos al servidor (En este caso del back end a la db)
def mover_a_papelera(nota_id): # funcion para mover a papelera
    if "usuario_id" not in session: # si no esta el usuario id en la sesion activa
        return jsonify({"error": "No autorizado"}), 401 # error en formato JSON
    user_id = session["usuario_id"] # se agarra el id del usuario de la sesion activa
 
    conn = None # conexion nula
    cur = None # cursor nulo
    try: # para que no se detenga bruscamente
        conn = conectar_db() # se conecta a la db
        cur = conn.cursor() # se crea el cursor
        # Verificar propiedad de la nota
        cur.execute('SELECT "ID_Cuenta" FROM public."Notas" WHERE "ID_Nota" = %s', (nota_id,))  # se selecciona el id de cuenta de la tabla notas donde el id de nota sea igual al de la tupla
        row = cur.fetchone() # se hace fetchone para atraparlo
        if not row: # si no hay fila
            return jsonify({"error": "Nota no encontrada"}), 404 # error en formato JSON
        if row[0] != user_id: # si el id de cuenta no es igual al id del usuario
            return jsonify({"error": "No tienes permiso"}), 403 # error en formato JSON

        cur.execute('UPDATE public."Notas" SET "Estado" = %s WHERE "ID_Nota" = %s', ("papelera", nota_id)) # se actualiza la tabla notas para poner el estado en papelera donde el id de nota sea igual al de la tupla 
        conn.commit() # se guardan los cambios
        return jsonify({"success": True, "mensaje": "Nota movida a la papelera"}), 200 # se retorna en formato JSON el exito
    except Exception as e: # y si da error se le asigna al error la variable e
        if conn: # si la conexion sigue
            conn.rollback() # se deshacen los cambios
        print("Error mover a papelera:", e) # se imprime el error
        return jsonify({"error": "Error interno"}), 500 # error en formato JSON
    finally: # finalmente
        if cur: # si el cursor sigue
            cur.close() # se cierra
        if conn: # si la conexion sigue
            conn.close() # se cierra

# # Restaurar (papelera -> activa)
# @app.route("/nota/<int:nota_id>/restaurar", methods=["POST"])
# def restaurar_nota(nota_id):
#     if "usuario_id" not in session:
#         return jsonify({"error": "No autorizado"}), 401
#     user_id = session["usuario_id"]

#     conn = None
#     cur = None
#     try:
#         conn = conectar_db()
#         cur = conn.cursor()
#         cur.execute('SELECT "ID_Cuenta" FROM public."Notas" WHERE "ID_Nota" = %s', (nota_id,))
#         row = cur.fetchone()
#         if not row:
#             return jsonify({"error": "Nota no encontrada"}), 404
#         if row[0] != user_id:
#             return jsonify({"error": "No tienes permiso"}), 403

#         cur.execute('UPDATE public."Notas" SET "Estado" = %s WHERE "ID_Nota" = %s', ("activa", nota_id))
#         conn.commit()
#         return jsonify({"success": True, "mensaje": "Nota restaurada"}), 200
#     except Exception as e:
#         if conn:
#             conn.rollback()
#         print("Error restaurar nota:", e)
#         return jsonify({"error": "Error interno"}), 500
#     finally:
#         if cur:
#             cur.close()
#         if conn:
#             conn.close()

# # Eliminar definitivamente (borra registro y archivos adjuntos físicos)
# @app.route("/nota/<int:nota_id>/eliminar-definitivo", methods=["POST"])
# def eliminar_definitivo(nota_id):
#     if "usuario_id" not in session:
#         return jsonify({"error": "No autorizado"}), 401
#     user_id = session["usuario_id"]

#     conn = None
#     cur = None
#     try:
#         conn = conectar_db()
#         cur = conn.cursor(cursor_factory=RealDictCursor)

#         # Verificar nota y propiedad
#         cur.execute('SELECT "ID_Cuenta" FROM public."Notas" WHERE "ID_Nota" = %s', (nota_id,))
#         row = cur.fetchone()
#         if not row:
#             return jsonify({"error": "Nota no encontrada"}), 404
#         if row["ID_Cuenta"] != user_id:
#             return jsonify({"error": "No tienes permiso"}), 403

#         # Obtener adjuntos para borrado físico y registros
#         cur.execute('SELECT "Ruta_archivo" FROM public."Adjuntos" WHERE "ID_Nota" = %s', (nota_id,))
#         files = cur.fetchall()
#         # Borrar registros de adjuntos
#         cur.execute('DELETE FROM public."Adjuntos" WHERE "ID_Nota" = %s', (nota_id,))

#         # Borrar relaciones notas_etiquetas
#         cur.execute('DELETE FROM public."Notas_etiquetas" WHERE "ID_Nota" = %s', (nota_id,))

#         # Borrar nota
#         cur.execute('DELETE FROM public."Notas" WHERE "ID_Nota" = %s', (nota_id,))

#         conn.commit()

#         # Borrar archivos físicamente después de commit (no dentro de la transacción)
#         for f in files:
#             try:
#                 path = f[0] if isinstance(f, tuple) else f.get("Ruta_archivo")
#                 if path and os.path.exists(path):
#                     os.remove(path)
#             except Exception:
#                 pass

#         return jsonify({"success": True, "mensaje": "Nota eliminada definitivamente"}), 200

#     except Exception as e:
#         if conn:
#             conn.rollback()
#         import traceback
#         traceback.print_exc()
#         return jsonify({"error": "Error interno"}), 500
#     finally:
#         if cur:
#             cur.close()
#         if conn:
#             conn.close()

# # ============================================
# # ENDPOINT: MARCAR NOTA COMO FAVORITA
# # ============================================

# @app.route('/nota/<int:nota_id>/favorito', methods=['POST'])
# def toggle_favorito(nota_id):
#     """
#     Marca o desmarca una nota como favorita.
#     """
#     if 'usuario_id' not in session:
#         return jsonify({'error': 'No autorizado'}), 401
    
#     conn = None
#     cur = None
    
#     try:
#         conn = conectar_db()
#         cur = conn.cursor(cursor_factory=RealDictCursor)
        
#         # Verificar que la nota pertenece al usuario
#         cur.execute("""
#             SELECT "ID_Nota", "favorito" 
#             FROM public."Notas"
#             WHERE "ID_Nota" = %s AND "ID_Cuenta" = %s
#         """, (nota_id, session['usuario_id']))
        
#         nota = cur.fetchone()
        
#         if not nota:
#             return jsonify({'error': 'Nota no encontrada'}), 404
        
#         # Toggle: Si es True lo hace False, y viceversa
#         nuevo_estado = not nota['favorito']
        
#         cur.execute("""
#             UPDATE public."Notas"
#             SET "favorito" = %s
#             WHERE "ID_Nota" = %s
#         """, (nuevo_estado, nota_id))
        
#         conn.commit()
        
#         return jsonify({
#             'success': True,
#             'favorito': nuevo_estado
#         }), 200
        
#     except Exception as e:
#         if conn:
#             conn.rollback()
#         print(f"Error al toggle favorito: {e}")
#         return jsonify({'error': 'Error al procesar'}), 500
        
#     finally:
#         if cur:
#             cur.close()
#         if conn:
#             conn.close()


# # ============================================
# # ENDPOINT: ELIMINAR NOTA (MOVER A PAPELERA)
# # Según requerimientorestauraroeliminarnotasycarpetas.docx
# # ============================================

# @app.route('/nota/<int:nota_id>/eliminar', methods=['POST'])
# def eliminar_nota(nota_id):
#     """
#     Elimina una nota moviéndola a Papelera (eliminación temporal).
    
#     - Muestra mensaje de confirmación antes de eliminar (se hace en el front)
#     - Cambia el estado de la nota a 'Papelera'
#     - La nota se eliminará definitivamente después de 30 días (automatización)
#     """
#     if 'usuario_id' not in session:
#         return jsonify({'error': 'No autorizado'}), 401
    
#     conn = None
#     cur = None
    
#     try:
#         conn = conectar_db()
#         cur = conn.cursor()
        
#         # Verificar que la nota pertenece al usuario
#         cur.execute("""
#             SELECT "ID_Nota" 
#             FROM public."Notas"
#             WHERE "ID_Nota" = %s AND "ID_Cuenta" = %s AND "Estado" != 'Papelera'
#         """, (nota_id, session['usuario_id']))
        
#         if not cur.fetchone():
#             return jsonify({'error': 'Nota no encontrada o ya eliminada'}), 404
        
#         # Mover a papelera (cambiar estado)
#         cur.execute("""
#             UPDATE public."Notas"
#             SET "Estado" = 'Papelera',
#                 "Fecha_deedicion" = CURRENT_TIMESTAMP
#             WHERE "ID_Nota" = %s
#         """, (nota_id,))
        
#         conn.commit()
        
#         return jsonify({
#             'success': True,
#             'mensaje': 'Nota movida a papelera. Se eliminará definitivamente en 30 días.'
#         }), 200
        
#     except Exception as e:
#         if conn:
#             conn.rollback()
#         print(f"Error al eliminar nota: {e}")
#         return jsonify({'error': 'Error al procesar'}), 500
        
#     finally:
#         if cur:
#             cur.close()
#         if conn:
#             conn.close()


# # ============================================
# # ENDPOINT: RESTAURAR NOTA DESDE PAPELERA
# # ============================================

# @app.route('/nota/<int:nota_id>/restaurar', methods=['POST'])
# def restaurar_nota(nota_id):
#     """
#     Restaura una nota desde la papelera.
#     """
#     if 'usuario_id' not in session:
#         return jsonify({'error': 'No autorizado'}), 401
    
#     conn = None
#     cur = None
    
#     try:
#         conn = conectar_db()
#         cur = conn.cursor()
        
#         # Verificar que la nota está en papelera y pertenece al usuario
#         cur.execute("""
#             SELECT "ID_Nota" 
#             FROM public."Notas"
#             WHERE "ID_Nota" = %s AND "ID_Cuenta" = %s AND "Estado" = 'Papelera'
#         """, (nota_id, session['usuario_id']))
        
#         if not cur.fetchone():
#             return jsonify({'error': 'Nota no encontrada en papelera'}), 404
        
#         # Restaurar nota (cambiar estado a Activa)
#         cur.execute("""
#             UPDATE public."Notas"
#             SET "Estado" = 'Activa',
#                 "Fecha_deedicion" = CURRENT_TIMESTAMP
#             WHERE "ID_Nota" = %s
#         """, (nota_id,))
        
#         conn.commit()
        
#         return jsonify({
#             'success': True,
#             'mensaje': 'Nota restaurada exitosamente'
#         }), 200
        
#     except Exception as e:
#         if conn:
#             conn.rollback()
#         print(f"Error al restaurar nota: {e}")
#         return jsonify({'error': 'Error al procesar'}), 500
        
#     finally:
#         if cur:
#             cur.close()
#         if conn:
#             conn.close()


# # ============================================
# # ENDPOINT: ELIMINAR NOTA DEFINITIVAMENTE
# # ============================================

# @app.route('/nota/<int:nota_id>/eliminar-definitivo', methods=['POST'])
# def eliminar_definitivo(nota_id):
#     """
#     Elimina una nota de forma permanente.
#     - Solo se puede hacer desde la papelera
#     - Elimina también archivos adjuntos asociados
#     """
#     if 'usuario_id' not in session:
#         return jsonify({'error': 'No autorizado'}), 401
    
#     conn = None
#     cur = None
    
#     try:
#         conn = conectar_db()
#         cur = conn.cursor()
        
#         # Verificar que la nota está en papelera
#         cur.execute("""
#             SELECT "ID_Nota" 
#             FROM public."Notas"
#             WHERE "ID_Nota" = %s AND "ID_Cuenta" = %s AND "Estado" = 'Papelera'
#         """, (nota_id, session['usuario_id']))
        
#         if not cur.fetchone():
#             return jsonify({'error': 'Nota no encontrada en papelera'}), 404
        
#         # Eliminar adjuntos físicos primero
#         cur.execute("""
#             SELECT "Ruta_archivo"
#             FROM public."Adjuntos"
#             WHERE "ID_Nota" = %s
#         """, (nota_id,))
        
#         adjuntos = cur.fetchall()
#         for adj in adjuntos:
#             ruta = adj[0]
#             if ruta and os.path.exists(ruta):
#                 try:
#                     os.remove(ruta)
#                 except Exception as e:
#                     print(f"Error al eliminar archivo {ruta}: {e}")
        
#         # Eliminar registros de adjuntos
#         cur.execute('DELETE FROM public."Adjuntos" WHERE "ID_Nota" = %s', (nota_id,))
        
#         # Eliminar relaciones con etiquetas
#         cur.execute('DELETE FROM public."Notas_etiquetas" WHERE "ID_Nota" = %s', (nota_id,))
        
#         # Eliminar la nota definitivamente
#         cur.execute('DELETE FROM public."Notas" WHERE "ID_Nota" = %s', (nota_id,))
        
#         conn.commit()
        
#         return jsonify({
#             'success': True,
#             'mensaje': 'Nota eliminada definitivamente'
#         }), 200
        
#     except Exception as e:
#         if conn:
#             conn.rollback()
#         print(f"Error al eliminar definitivo: {e}")
#         return jsonify({'error': 'Error al procesar'}), 500
        
#     finally:
#         if cur:
#             cur.close()
#         if conn:
#             conn.close()



# --------------------------------------------------
# Run
# --------------------------------------------------
if __name__ == '__main__':
    # Modo desarrollo: debug=True. En producción desactivar debug y usar gunicorn/uwsgi.
    app.run(debug=True, host='0.0.0.0', port=5000) # se corre la app en modo debug en el host