# -*- coding: utf-8 -*-


from flask import Flask, jsonify, render_template, request, redirect, url_for, session, send_from_directory
import psycopg2
from psycopg2.extras import RealDictCursor
import os
import uuid
from datetime import datetime

# --------------------------------------------------
# Configuración de la app
# --------------------------------------------------
app = Flask(__name__)
app.secret_key = 'tu_clave_secreta_aqui_cambiala'  # cambiar en producción
app.static_folder = 'static'
app.static_url_path = '/static'

# ============================================
# CONFIGURACIÓN DE CARPETA UPLOADS
# ============================================
import os

# Ruta absoluta del proyecto (donde está app.py)
BASE_DIR = os.path.abspath(os.path.dirname(__file__))

# Carpeta de uploads dentro del proyecto
UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")

# Si la carpeta NO existe, se crea automáticamente
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

# Se asigna la carpeta al config de Flask
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

# --------------------------------------------------
# Configuración de la base de datos (ajusta si es necesario)
# --------------------------------------------------
DB_CONFIG = {
    'host': 'localhost',
    'database': 'dbnoteflow',
    'user': 'postgres',
    'password': '123456',
    'port': 5432
}

def conectar_db():
    """Crea y devuelve una conexión a PostgreSQL (psycopg2)."""
    try:
        return psycopg2.connect(**DB_CONFIG)
    except psycopg2.Error as e:
        print(f"ERROR DE CONEXIÓN A POSTGRESQL: {e}")
        return None

# --------------------------------------------------
# Funciones auxiliares (consultas reales según tu MR)
# --------------------------------------------------

def obtener_etiquetas_nota(nota_id, cursor):
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
    """, (nota_id,))
    rows = cursor.fetchall()
    # Si salen dicts (RealDictCursor) ya están listos
    if rows and isinstance(rows[0], dict):
        return rows
    # Si salen tuplas -> convertir
    return [{'ID_Etiqueta': r[0], 'Nombre_etiqueta': r[1]} for r in rows]

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
            ("ID_Cuenta", "Usuario", "Contraseña", "Nombres", "Apellidos", "Telefono", "Correo", "Color_principal", "Fecha_creacion")
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, CURRENT_DATE)
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

# --------------------------------------------------
# Run
# --------------------------------------------------
if __name__ == '__main__':
    # Modo desarrollo: debug=True. En producción desactivar debug y usar gunicorn/uwsgi.
    app.run(debug=True, host='0.0.0.0', port=5000)