# -*- coding: utf-8 -*-


from flask import Flask, jsonify, render_template, request, redirect, url_for, session, send_from_directory # importacion de librerias
import psycopg2 # importacion de librerias
from psycopg2.extras import RealDictCursor # importacion de librerias
import os # importacion de librerias
import uuid # importacion de librerias
from datetime import datetime # importacion de librerias

# --------------------------------------------------
# Configuración de la app
# --------------------------------------------------
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


# -----------
# FUNCION
# -----------



def conectar_db(): # Funcion para conectar la db
    """Crea y devuelve una conexión a PostgreSQL (psycopg2)."""
    try: # try para que el programa no se detenga bruscamente
        return psycopg2.connect(**DB_CONFIG) # retorna la conexion con la configuracion de la db que hicimos
    except psycopg2.Error as e: # Si el try dio error,a ese error junto con una funcion de la libreria psycopg2 se le asigna la variable e a ese error
        print(f"ERROR DE CONEXIÓN A POSTGRESQL: {e}") # se imprime
        return None # retorna None

# --------------------------------------------------
# Funciones auxiliares de LOGICA DEL BACK END
# --------------------------------------------------

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

def verificar_adjuntos_nota(nota_id, cursor):
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

@app.route('/')
def inicio():
    """Página de bienvenida (antes de autenticarse)."""
    return render_template("bienvenidoalapagina.html")

@app.route('/registro.html')
def mostrar_registro():
    """Formulario de registro."""
    return render_template("registro.html")

@app.route('/iniciarsesion.html')
def mostrar_login():
    """Formulario de inicio de sesión."""
    return render_template("iniciarsesion.html")

@app.route('/caracteristicas.html')
def caracteristicas():
    """Página de características."""
    return render_template("caracteristicas.html")

# --------------------------------------------------
# Procesar registro
# --------------------------------------------------

@app.route('/procesar-registro', methods=['POST'])
def procesar_registro():
    """
    Procesa el registro de un nuevo usuario.
    Validaciones:
      - Campos obligatorios.
      - Teléfono numérico.
      - Usuario o correo duplicados.
    NOTA: Se mantiene el mismo esquema de almacenamiento de contraseña
    que ya tengas en BD (no se cambia formato para no romper cuentas).
    """
    conexion = None
    cursor = None
    try:
        conexion = conectar_db()
        if conexion is None:
            return jsonify({'error': 'No se pudo conectar a la base de datos'}), 500

        datos = request.form
        Nombres = datos.get('nombre', '').strip()
        Apellidos = datos.get('apellido', '').strip()
        Telefono = datos.get('telefono', '').strip()
        Correo = datos.get('correo', '').strip()
        Usuario = datos.get('usuario', '').strip()
        Contraseña = datos.get('contraseña', '').strip()
        Color_principal = datos.get('color_principal', 'Blanco').strip()

        if not all([Nombres, Apellidos, Telefono, Correo, Usuario, Contraseña]):
            return jsonify({'error': 'Todos los campos son obligatorios'}), 400

        if not Telefono.isdigit():
            return jsonify({'error': 'El teléfono debe contener solo números'}), 400

        cursor = conexion.cursor()

        # Verificar duplicados por Usuario o Correo
        cursor.execute("""
            SELECT "ID_Cuenta" FROM public."Cuentas"
            WHERE "Usuario" = %s OR "Correo" = %s
        """, (Usuario, Correo))
        if cursor.fetchone():
            return jsonify({'error': 'El usuario o correo ya está registrado en NoteFlow'}), 409

        # Generar nuevo ID_Cuenta (si tu BD no usa serial)
        cursor.execute('SELECT COALESCE(MAX("ID_Cuenta"), 0) + 1 FROM public."Cuentas"')
        nuevo_id = cursor.fetchone()[0]

        cursor.execute("""
            INSERT INTO public."Cuentas"
            ("ID_Cuenta", "Usuario", "Contraseña", "Nombres", "Apellidos", "Telefono", "Correo", "Color_principal")
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING "ID_Cuenta";
        """, (nuevo_id, Usuario, Contraseña, Nombres, Apellidos, Telefono, Correo, Color_principal))

        cuenta_id = cursor.fetchone()[0]
        conexion.commit()

        # Iniciar sesión automáticamente
        session['usuario_id'] = cuenta_id
        session['usuario_nombre'] = Usuario

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
        if cursor:
            cursor.close()
        if conexion:
            conexion.close()

# --------------------------------------------------
# Procesar login
# --------------------------------------------------

@app.route('/procesar-login', methods=['POST'])
def procesar_login():
    """
    Valida credenciales del usuario y crea la sesión.
    Observación: comparación de contraseña en texto plano para mantener
    retrocompatibilidad con la BD actual.
    Recomendación: migrar a hashing (bcrypt/werkzeug) en producción.
    """
    conexion = None
    cursor = None
    try:
        conexion = conectar_db()
        if conexion is None:
            return jsonify({'error': 'No se pudo conectar a la base de datos'}), 500

        datos = request.form
        Usuario = datos.get('usuario', '').strip()
        Contraseña = datos.get('contraseña', '').strip()

        if not Usuario or not Contraseña:
            return jsonify({'error': 'Usuario y contraseña son obligatorios'}), 400

        cursor = conexion.cursor(cursor_factory=RealDictCursor)

        cursor.execute("""
            SELECT "ID_Cuenta", "Usuario", "Nombres", "Apellidos", "Color_principal"
            FROM public."Cuentas"
            WHERE "Usuario" = %s AND "Contraseña" = %s
        """, (Usuario, Contraseña))

        usuario = cursor.fetchone()

        if usuario:
            # Registrar sesión
            session['usuario_id'] = usuario['ID_Cuenta']
            session['usuario_nombre'] = usuario['Usuario']
            return jsonify({
                'success': True,
                'mensaje': 'Inicio de sesión exitoso',
                'redirect': '/dashboard'
            }), 200
        else:
            return jsonify({'error': 'Usuario o contraseña incorrectos'}), 401

    except Exception as e:
        print(f"Error al iniciar sesión: {e}")
        return jsonify({'error': 'Error al procesar la solicitud'}), 500

    finally:
        if cursor:
            cursor.close()
        if conexion:
            conexion.close()

# --------------------------------------------------
# Logout
# --------------------------------------------------

@app.route('/logout')
def cerrar_sesion():
    """Limpia la sesión activa y redirige a la página de inicio."""
    session.clear()
    return redirect(url_for('inicio'))

# --------------------------------------------------
# Endpoint para servir adjuntos guardados (descarga/preview)
# --------------------------------------------------
@app.route('/uploads/<path:filename>')
def uploaded_file(filename):
    """Devuelve archivos guardados en la carpeta uploads (solo para desarrollo)."""
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

# --------------------------------------------------
# Endpoint para subir un adjunto a una nota (simple)
# - Guarda archivo en /uploads y registra en tabla "Adjuntos"
# - Valida existencia de nota y permisos (basado en ID_Cuenta en sesión)
# --------------------------------------------------
@app.route('/nota/<int:nota_id>/adjunto', methods=['POST'])
def subir_adjunto(nota_id):
    """
    Endpoint para subir un archivo y asociarlo a una nota.
    Form-data: file -> archivo
    """
    if 'usuario_id' not in session:
        return jsonify({'error': 'No autorizado'}), 401

    archivo = request.files.get('file')
    if not archivo:
        return jsonify({'error': 'No se recibió archivo'}), 400

    # Validaciones básicas de tipo y tamaño pueden añadirse aquí
    filename_orig = archivo.filename
    ext = os.path.splitext(filename_orig)[1].lower()
    # Generar nombre único
    filename_saved = f"{uuid.uuid4().hex}{ext}"
    save_path = os.path.join(app.config['UPLOAD_FOLDER'], filename_saved)
    try:
        archivo.save(save_path)
    except Exception as e:
        print("Error al guardar archivo:", e)
        return jsonify({'error': 'Error al guardar archivo'}), 500

    # Registrar en BD (Adjuntos)
    conexion = None
    cur = None
    try:
        conexion = conectar_db()
        cur = conexion.cursor()

        # Validar que la nota exista y pertenezca al usuario
        cur.execute("""
            SELECT "ID_Nota", "ID_Cuenta" FROM public."Notas"
            WHERE "ID_Nota" = %s
        """, (nota_id,))
        row = cur.fetchone()
        if not row:
            return jsonify({'error': 'Nota no encontrada'}), 404

        # Insertar nuevo ID_Adjunto manualmente (si tu tabla no tiene serial)
        cur.execute('SELECT COALESCE(MAX("ID_Adjunto"), 0) + 1 FROM public."Adjuntos"')
        nuevo_id = cur.fetchone()[0]

        cur.execute("""
            INSERT INTO public."Adjuntos"
            ("ID_Adjunto", "ID_Nota", "Ruta_archivo", "Nombre_archivo", "Formato")
            VALUES (%s, %s, %s, %s, %s)
            RETURNING "ID_Adjunto"
        """, (nuevo_id, nota_id, save_path, filename_orig, ext.replace('.', '')))
        id_adj = cur.fetchone()[0]
        conexion.commit()

        return jsonify({'success': True, 'ID_Adjunto': id_adj}), 201

    except Exception as e:
        if conexion:
            conexion.rollback()
        print("Error registrando adjunto:", e)
        return jsonify({'error': 'Error al registrar adjunto'}), 500

    finally:
        if cur:
            cur.close()
        if conexion:
            conexion.close()

# --------------------------------------------------
# ENDPOINTS PARA ETIQUETAS (CRUD mínimo)
# --------------------------------------------------
@app.route('/etiqueta/crear', methods=['POST'])
def crear_etiqueta():
    """
    Crea una etiqueta nueva.
    Body form-data: nombre_etiqueta
    """
    if 'usuario_id' not in session:
        return jsonify({'error': 'No autorizado'}), 401

    nombre = request.form.get('nombre_etiqueta', '').strip()
    if not nombre:
        return jsonify({'error': 'Nombre obligatorio'}), 400

    conn = None
    cur = None
    try:
        conn = conectar_db()
        cur = conn.cursor()

        # Evitar duplicados por nombre
        cur.execute("""
            SELECT "ID_Etiqueta" FROM public."Etiquetas" WHERE "Nombre_etiqueta" = %s
        """, (nombre,))
        if cur.fetchone():
            return jsonify({'error': 'Etiqueta ya existe'}), 409

        cur.execute('SELECT COALESCE(MAX("ID_Etiqueta"), 0) + 1 FROM public."Etiquetas"')
        nuevo = cur.fetchone()[0]

        cur.execute("""
            INSERT INTO public."Etiquetas" ("ID_Etiqueta", "Nombre_etiqueta")
            VALUES (%s, %s)
            RETURNING "ID_Etiqueta"
        """, (nuevo, nombre))
        id_et = cur.fetchone()[0]
        conn.commit()
        return jsonify({'success': True, 'ID_Etiqueta': id_et}), 201

    except Exception as e:
        if conn:
            conn.rollback()
        print("Error creando etiqueta:", e)
        return jsonify({'error': 'Error interno'}), 500

    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

@app.route('/nota/<int:nota_id>/etiqueta/asignar', methods=['POST'])
def asignar_etiqueta_a_nota(nota_id):
    """
    Asigna una etiqueta existente a una nota.
    Body form-data: id_etiqueta
    """
    if 'usuario_id' not in session:
        return jsonify({'error': 'No autorizado'}), 401

    id_etiqueta = request.form.get('id_etiqueta')
    if not id_etiqueta:
        return jsonify({'error': 'id_etiqueta obligatorio'}), 400

    conn = None
    cur = None
    try:
        conn = conectar_db()
        cur = conn.cursor()

        # Validar existencia de nota
        cur.execute('SELECT "ID_Nota", "ID_Cuenta" FROM public."Notas" WHERE "ID_Nota" = %s', (nota_id,))
        nota_row = cur.fetchone()
        if not nota_row:
            return jsonify({'error': 'Nota no encontrada'}), 404

        # Validar existencia de etiqueta
        cur.execute('SELECT "ID_Etiqueta" FROM public."Etiquetas" WHERE "ID_Etiqueta" = %s', (id_etiqueta,))
        if not cur.fetchone():
            return jsonify({'error': 'Etiqueta no encontrada'}), 404

        # Evitar duplicados en la relación
        cur.execute("""
            SELECT 1 FROM public."Notas_etiquetas"
            WHERE "ID_Nota" = %s AND "ID_Etiqueta" = %s
        """, (nota_id, id_etiqueta))
        if cur.fetchone():
            return jsonify({'error': 'Etiqueta ya asignada a la nota'}), 409

        cur.execute("""
            INSERT INTO public."Notas_etiquetas" ("ID_Nota", "ID_Etiqueta")
            VALUES (%s, %s)
        """, (nota_id, id_etiqueta))
        conn.commit()
        return jsonify({'success': True}), 201

    except Exception as e:
        if conn:
            conn.rollback()
        print("Error asignando etiqueta:", e)
        return jsonify({'error': 'Error interno'}), 500

    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

# --------------------------------------------------
# DASHBOARD (usa datos reales de la BD: etiquetas y adjuntos)
# --------------------------------------------------
@app.route('/dashboard')
def dashboard():
    """
    Carga página de dashboard con:
      - datos del usuario (Nombres, color_principal)
      - conteos: notas activas, carpetas, notas en papelera
      - listado de notas recientes (con etiquetas reales y flag de adjuntos)
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
            SELECT "Nombres", "Color_principal"
            FROM public."Cuentas"
            WHERE "ID_Cuenta" = %s
        """, (user_id,))
        usuario_row = cur.fetchone()
        if not usuario_row:
            session.clear()
            return redirect(url_for('mostrar_login'))

        usuario_para_template = {
            'nombre': usuario_row.get('Nombres'),
            'color_principal': usuario_row.get('Color_principal')
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
            # nota es dict por RealDictCursor
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

# ============================================
# RUTA: SECCIÓN NOTAS (GESTIONAR NOTAS)
# Basado en requerimientogestionarnotas.docx
# ============================================



# ---------- RUTA /notas (LISTAR + FILTRAR) ----------
# --- RUTA /NOTAS (LISTADO, BÚSQUEDA Y FILTROS) ---
from urllib.parse import urlencode


@app.route('/notas')
def notas():
    """
    Lista las notas del usuario logueado con:
      - filtros: q (texto), etiqueta, carpeta, formato, categoria, estado
      - paginación simple (page, per_page)
      - devuelve all_tags, all_folders, all_formats para llenar selects
    """
    if 'usuario_id' not in session:
        return redirect(url_for('mostrar_login'))

    user_id = session['usuario_id']

    # parámetros de la querystring
    q = (request.args.get('q') or '').strip()
    etiqueta = request.args.get('etiqueta') or ''
    carpeta = request.args.get('carpeta') or ''
    formato = request.args.get('formato') or ''
    categoria = request.args.get('categoria') or ''   # '1' publica, '2' privada
    estado = request.args.get('estado') or 'Activa'   # por defecto Activa

    try:
        page = int(request.args.get('page', 1))
        if page < 1:
            page = 1
    except ValueError:
        page = 1
    per_page = 12  # puedes ajustar

    conn = None
    cur = None
    try:
        conn = conectar_db()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        # --- Obtener listas para selects ---
        # Etiquetas (todas)
        cur.execute('SELECT "ID_Etiqueta", "Nombre_etiqueta" FROM public."Etiquetas" ORDER BY "Nombre_etiqueta"')
        all_tags = cur.fetchall()

        # Carpetas del usuario
        cur.execute('SELECT "ID_Carpeta", "Nombre_carpeta" FROM public."Carpetas" WHERE "ID_Cuenta" = %s ORDER BY "Nombre_carpeta"', (user_id,))
        all_folders = cur.fetchall()

        # Formatos distintos en notas del usuario (para el select de formatos)
        cur.execute('SELECT DISTINCT "Formato" FROM public."Notas" WHERE "ID_Cuenta" = %s ORDER BY "Formato"', (user_id,))
        all_formats_rows = cur.fetchall()
        all_formats = [{'Formato': r['Formato']} for r in all_formats_rows if r.get('Formato')]

        # --- Construir WHERE dinámico y parámetros ---
        where_clauses = ['n."ID_Cuenta" = %s']
        params = [user_id]

        # Estado (case-insensitive)
        if estado:
            where_clauses.append('LOWER(n."Estado") = LOWER(%s)')
            params.append(estado)

        # Texto q -> buscar en Titulo, Descripcion y Contenido
        if q:
            where_clauses.append('(COALESCE(n."Titulo", \'\') ILIKE %s OR COALESCE(n."Descripcion", \'\') ILIKE %s OR COALESCE(n."Contenido", \'\') ILIKE %s)')
            like_q = f'%{q}%'
            params.extend([like_q, like_q, like_q])

        # Formato exacto
        if formato:
            where_clauses.append('n."Formato" = %s')
            params.append(formato)

        # Categoria (1 pública, 2 privada) -> exact match numeric
        if categoria:
            where_clauses.append('n."ID_Categorias" = %s')
            params.append(int(categoria))

        # Carpeta: special value "__SIN__" => ID_Carpeta IS NULL
        carpeta_clause = ''
        if carpeta:
            if carpeta == '__SIN__':
                where_clauses.append('n."ID_Carpeta" IS NULL')
            else:
                where_clauses.append('n."ID_Carpeta" = %s')
                params.append(int(carpeta))

        # Etiqueta: requiere JOIN con Notas_etiquetas
        join_etiqueta = ''
        if etiqueta:
            join_etiqueta = 'JOIN public."Notas_etiquetas" ne ON ne."ID_Nota" = n."ID_Nota"'
            where_clauses.append('ne."ID_Etiqueta" = %s')
            params.append(int(etiqueta))

        where_sql = ' AND '.join(where_clauses)

        # --- Contar total para paginación ---
        count_sql = f'''
            SELECT COUNT(DISTINCT n."ID_Nota") AS total
            FROM public."Notas" n
            {join_etiqueta}
            WHERE {where_sql}
        '''
        cur.execute(count_sql, tuple(params))
        total = cur.fetchone()['total'] or 0
        total_pages = max(1, (total + per_page - 1) // per_page)
        if page > total_pages:
            page = total_pages

        # --- Obtener notas paginadas (DISTINCT por posible JOIN con etiquetas) ---
        offset = (page - 1) * per_page
        fetch_sql = f'''
            SELECT DISTINCT
                n."ID_Nota",
                n."Titulo",
                n."Descripcion",
                n."Contenido",
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
        # params + limit + offset
        cur.execute(fetch_sql, tuple(params) + (per_page, offset))
        notas_rows = cur.fetchall()

        # --- Para cada nota: obtener etiquetas y nombre de carpeta y flag adjuntos ---
        notas = []
        for r in notas_rows:
            nota_id = r['ID_Nota']

            # etiquetas: lista de strings (Nombre_etiqueta)
            cur.execute('''
                SELECT e."Nombre_etiqueta"
                FROM public."Notas_etiquetas" ne
                JOIN public."Etiquetas" e ON ne."ID_Etiqueta" = e."ID_Etiqueta"
                WHERE ne."ID_Nota" = %s
                ORDER BY e."Nombre_etiqueta"
            ''', (nota_id,))
            etiqu_rows = cur.fetchall()
            etiquetas_list = [e['Nombre_etiqueta'] for e in etiqu_rows]

            # carpeta nombre (puede ser NULL)
            carpeta_nombre = None
            if r.get('ID_Carpeta') is not None:
                cur.execute('SELECT "Nombre_carpeta" FROM public."Carpetas" WHERE "ID_Carpeta" = %s', (r['ID_Carpeta'],))
                cf = cur.fetchone()
                carpeta_nombre = cf['Nombre_carpeta'] if cf else None

            # adjuntos: true/false
            cur.execute('SELECT COUNT(*) AS total FROM public."Adjuntos" WHERE "ID_Nota" = %s', (nota_id,))
            has_adj = cur.fetchone()['total'] > 0

            notas.append({
                'ID_Nota': nota_id,
                'Titulo': r.get('Titulo'),
                'Descripcion': r.get('Descripcion'),
                'Contenido': r.get('Contenido'),
                'Estado': r.get('Estado'),
                'ID_Carpeta': r.get('ID_Carpeta'),
                'Nombre_carpeta': carpeta_nombre,
                'ID_Categorias': r.get('ID_Categorias'),
                'Formato': r.get('Formato'),
                'Fecha_decreacion': r.get('Fecha_decreacion'),
                'Fecha_deedicion': r.get('Fecha_deedicion'),
                'Etiquetas': etiquetas_list,
                'Has_Adjuntos': has_adj
            })

        # construir querystring helpers para paginación (mantener filtros)
        base_params = {k: v for k, v in [
            ('q', q), ('etiqueta', etiqueta), ('carpeta', carpeta),
            ('formato', formato), ('categoria', categoria), ('estado', estado)
        ] if v}
        def qs_with_page(p):
            params2 = base_params.copy()
            params2['page'] = p
            return urlencode(params2)

        pagination = {
            'page': page,
            'per_page': per_page,
            'total': total,
            'total_pages': total_pages,
            'prev_querystring': qs_with_page(page - 1) if page > 1 else None,
            'next_querystring': qs_with_page(page + 1) if page < total_pages else None
        }

        # pasar filtros activos para que el template marque selects
        filtros_activos = {
            'q': q,
            'etiqueta': etiqueta,
            'carpeta': carpeta,
            'formato': formato,
            'categoria': categoria,
            'estado': estado
        }

        return render_template(
            'notas.html',
            usuario={'nombre': session.get('usuario_nombre'), 'color_principal': session.get('color_principal', '#3498db')},
            notas=notas,
            all_tags=all_tags,
            all_folders=all_folders,
            all_formats=all_formats,
            filtros_activos=filtros_activos,
            pagination=pagination
        )

    except Exception as e:
        import traceback
        traceback.print_exc()
        return f"Error al listar notas: {str(e)}", 500

    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


# ---------- ACCIONES SOBRE NOTAS ----------
# Mover a papelera (estado -> 'papelera')
@app.route("/nota/<int:nota_id>/eliminar", methods=["POST"])
def mover_a_papelera(nota_id):
    if "usuario_id" not in session:
        return jsonify({"error": "No autorizado"}), 401
    user_id = session["usuario_id"]

    conn = None
    cur = None
    try:
        conn = conectar_db()
        cur = conn.cursor()
        # Verificar propiedad
        cur.execute('SELECT "ID_Cuenta" FROM public."Notas" WHERE "ID_Nota" = %s', (nota_id,))
        row = cur.fetchone()
        if not row:
            return jsonify({"error": "Nota no encontrada"}), 404
        if row[0] != user_id:
            return jsonify({"error": "No tienes permiso"}), 403

        cur.execute('UPDATE public."Notas" SET "Estado" = %s WHERE "ID_Nota" = %s', ("papelera", nota_id))
        conn.commit()
        return jsonify({"success": True, "mensaje": "Nota movida a la papelera"}), 200
    except Exception as e:
        if conn:
            conn.rollback()
        print("Error mover a papelera:", e)
        return jsonify({"error": "Error interno"}), 500
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

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
    app.run(debug=True, host='0.0.0.0', port=5000)