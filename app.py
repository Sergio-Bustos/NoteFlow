# -*- coding: utf-8 -*-
from flask import Flask, jsonify, render_template, request, redirect, url_for, session
import psycopg2
from psycopg2.extras import RealDictCursor
import random

app = Flask(__name__)
app.secret_key = 'tu_clave_secreta_aqui_cambiala'
app.static_folder = 'static'
app.static_url_path = '/static'

# CONFIGURACIÓN DE LA BASE DE DATOS
DB_CONFIG = {
    'host': 'localhost',
    'database': 'dbnoteflow',
    'user': 'postgres',
    'password': '123456',
    'port': 5432
}

def conectar_db():
    try:
        return psycopg2.connect(**DB_CONFIG)
    except psycopg2.Error as e:
        print(f"ERROR DE CONEXIÓN A POSTGRESQL: {e}")
        return None

# ============================================
# RUTAS DE ACCESO PÚBLICO Y AUTH
# ============================================

@app.route('/')
def inicio():
    return render_template("bienvenidoalapagina.html")

@app.route('/registro.html')
def mostrar_registro():
    return render_template("registro.html")

@app.route('/iniciarsesion.html')
def mostrar_login():
    return render_template("iniciarsesion.html")

@app.route('/caracteristicas.html')
def caracteristicas():
    return render_template("caracteristicas.html")

@app.route('/procesar-registro', methods=['POST'])
def procesar_registro():
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
        Color_principal = "Blanco"

        if not all([Nombres, Apellidos, Telefono, Correo, Usuario, Contraseña]):
            return jsonify({'error': 'Todos los campos son obligatorios'}), 400

        if not Telefono.isdigit():
            return jsonify({'error': 'El teléfono debe contener solo números'}), 400

        cursor = conexion.cursor()

        cursor.execute("""
            SELECT "ID_Cuenta" FROM public."Cuentas"
            WHERE "Usuario" = %s OR "Correo" = %s
        """, (Usuario, Correo))

        if cursor.fetchone():
            return jsonify({'error': 'El usuario o correo ya está registrado en NoteFlow'}), 409

        cursor.execute('SELECT COALESCE(MAX("ID_Cuenta"), 0) + 1 FROM public."Cuentas"')
        nuevo_id = cursor.fetchone()[0]

        cursor.execute("""
            INSERT INTO public."Cuentas"
            ("ID_Cuenta", "Usuario", "Contraseña", "Nombres", "Apellidos", "Telefono", "Correo", "Color_principal")
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING "ID_Cuenta";
        """, (nuevo_id, Usuario, Contraseña, Nombres, Apellidos, int(Telefono), Correo, Color_principal))

        cuenta_id = cursor.fetchone()[0]
        conexion.commit()

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

@app.route('/procesar-login', methods=['POST'])
def procesar_login():
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

@app.route('/logout')
def cerrar_sesion():
    session.clear()
    return redirect(url_for('inicio'))

# ============================================
# FUNCIONES AUXILIARES (Simulación de datos)
# ============================================

def _obtener_tags_mock(nota_id):
    mock_tags = [
        {'nombre_etiqueta': 'Urgente'},
        {'nombre_etiqueta': 'Tarea'},
        {'nombre_etiqueta': 'Personal'},
        {'nombre_etiqueta': 'Estudio'}
    ]
    return random.sample(mock_tags, random.randint(0, 3))

def _verificar_adjuntos_mock(nota_id):
    return random.choice([True, False, False, False])

# ============================================
# RUTA DASHBOARD
# ============================================

@app.route("/dashboard")
def dashboard():
    print("➡️ Entrando a /dashboard")

    if "usuario_id" not in session:
        print("⚠️ Usuario no en sesión. Redirigiendo...")
        return redirect(url_for('mostrar_login'))

    user_id = session["usuario_id"]
    print(f"➡️ ID del usuario en sesión: {user_id}")

    conn = None
    cur = None

    try:
        print("➡️ Conectando a la base de datos...")
        conn = conectar_db()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        print("➡️ Obteniendo datos del usuario...")
        cur.execute("""
            SELECT "Nombres", "Color_principal"
            FROM public."Cuentas"
            WHERE "ID_Cuenta" = %s
        """, (user_id,))
        usuario_data = cur.fetchone()
        print(f"➡️ Datos de usuario: {usuario_data}")

        if not usuario_data:
            print("❌ Usuario no encontrado en DB")
            session.clear()
            return redirect(url_for('mostrar_login'))

        usuario_para_template = {
            'nombre': usuario_data['Nombres'],
            'color_principal': usuario_data['Color_principal']
        }

        print("➡️ Calculando estadísticas...")
        cur.execute("""
            SELECT COUNT(*) AS total_notas FROM public."Notas"
            WHERE "ID_Cuenta" = %s AND "Estado" = 'activa'
        """, (user_id,))
        total_notas = cur.fetchone()["total_notas"]
        print(f"➡️ Total notas: {total_notas}")

        cur.execute("""
            SELECT COUNT(*) AS total_carpetas FROM public."Carpetas"
            WHERE "ID_Cuenta" = %s
        """, (user_id,))
        total_carpetas = cur.fetchone()["total_carpetas"]
        print(f"➡️ Total carpetas: {total_carpetas}")

        cur.execute("""
            SELECT COUNT(*) AS notas_papelera FROM public."Notas"
            WHERE "ID_Cuenta" = %s AND "Estado" = 'papelera'
        """, (user_id,))
        notas_papelera = cur.fetchone()["notas_papelera"]
        print(f"➡️ Notas en papelera: {notas_papelera}")

        print("➡️ Cargando notas recientes...")
        cur.execute("""
            SELECT
                n."ID_Nota",
                n."Titulo",
                n."Descripcion",
                n."Fecha_deedicion",
                n."ID_Categorias"
            FROM public."Notas" n
            WHERE n."ID_Cuenta" = %s AND n."Estado" = 'activa'
            ORDER BY n."Fecha_deedicion" DESC NULLS LAST
            LIMIT 6
        """, (user_id,))
        notas_recientes_raw = cur.fetchall()
        print(f"➡️ Notas encontradas: {len(notas_recientes_raw)}")

        notas_recientes = []
        for nota in notas_recientes_raw:
            print(f"✔️ Procesando nota {nota['ID_Nota']}")
            nota['id_categoria'] = nota['ID_Categorias']
            nota['tags'] = _obtener_tags_mock(nota['ID_Nota'])
            nota['has_attachments'] = _verificar_adjuntos_mock(nota['ID_Nota'])
            notas_recientes.append(nota)

        print("➡️ Renderizando dashboard.html...")
        return render_template(
            "dashboard.html",
            usuario=usuario_para_template,
            total_notas=total_notas,
            total_carpetas=total_carpetas,
            notas_papelera=notas_papelera,
            notas_recientes=notas_recientes
        )

    except Exception as e:
        print("❌ ERROR EN DASHBOARD:")
        import traceback
        traceback.print_exc()

        return f"Error general al cargar dashboard: {str(e)}", 500

    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


# Punto de inicio del servidor Flask
if __name__ == '__main__':
    print("🚀 Iniciando servidor Flask...")
    app.run(debug=True, host='0.0.0.0', port=5000)
