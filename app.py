# -*- codding_ utf-8 -*-
# Importaciones necesarias para la aplicacion de Flask
from flask import Flask, jsonify, render_template, request, redirect, url_for, session
import psycopg2  # Para conectarse a PostgreSQL
from psycopg2.extras import RealDictCursor  # Devuelve resultados tipo diccionario
from datetime import datetime  # Para manejar fechas de creacion en tiempo real

app = Flask(__name__)
app.secret_key = 'tu_clave_secreta_aqui_cambiala'  # Necesario para usar sesiones
app.static_folder = 'static'
app.static_url_path = '/static'

# Configuracion de conexion a la base de datos PostgreSQL:
DB_CONFIG = {
    'host': 'localhost',
    'database': 'Base de datos NoteFlow',
    'user': 'postgres',
    'password': '123456',
    'port': 5432
}


# Funcion para conectar a la base de datos
def conectar_db():
    """Establece conexion con la base de datos POSTGRESQL."""
    try:
        conexion = psycopg2.connect(**DB_CONFIG)
        return conexion
    except psycopg2.Error as e:
        print(f"Error al conectar la base de datos! : {e}")
        return None


# ============================================
# RUTAS PARA PÁGINAS HTML (GET)
# ============================================

@app.route('/')
def inicio():
    """Página de bienvenida"""
    return render_template("bienvenidoalapagina.html")


@app.route('/registro.html')
def mostrar_registro():
    """Muestra el formulario de registro"""
    return render_template("registro.html")


@app.route('/iniciarsesion.html')
def mostrar_login():
    """Muestra el formulario de inicio de sesión"""
    return render_template("iniciarsesion.html")


@app.route('/caracteristicas.html')
def caracteristicas():
    """Muestra la página de características"""
    return render_template("caracteristicas.html")


# ============================================
# RUTAS PARA PROCESAR FORMULARIOS (POST)
# ============================================

@app.route('/procesar-registro', methods=['POST'])
def procesar_registro():
    """Procesa el registro de un nuevo usuario"""
    conexion = None
    cursor = None
    try:
        conexion = conectar_db()
        if conexion is None:
            return jsonify({'error': 'No se pudo conectar a la base de datos'}), 500

        # Captura los datos del formulario
        datos = request.form
        Nombres = datos.get('nombre', '').strip()
        Apellidos = datos.get('apellido', '').strip()
        Telefono = datos.get('telefono', '').strip()
        Correo = datos.get('correo', '').strip()
        Usuario = datos.get('usuario', '').strip()
        Contraseña = datos.get('contraseña', '').strip()
        Color_principal = '#3498db'  # Color por defecto

        # Validar campos obligatorios
        if not all([Nombres, Apellidos, Telefono, Correo, Usuario, Contraseña]):
            return jsonify({'error': 'Todos los campos son obligatorios'}), 400

        # Validar que el teléfono sea numérico
        if not Telefono.isdigit():
            return jsonify({'error': 'El teléfono debe contener solo números'}), 400

        cursor = conexion.cursor()

        # Verificar si el usuario o correo ya existe
        cursor.execute("""
            SELECT "ID_Cuenta" FROM public."Cuentas" 
            WHERE "Usuario" = %s OR "Correo" = %s
        """, (Usuario, Correo))
        
        if cursor.fetchone():
            return jsonify({'error': 'El usuario o correo ya está registrado'}), 409

        # Generar nuevo ID
        cursor.execute('SELECT COALESCE(MAX("ID_Cuenta"), 0) + 1 FROM public."Cuentas"')
        nuevo_id = cursor.fetchone()[0]

        # Insertar nueva cuenta
        cursor.execute("""
            INSERT INTO public."Cuentas" 
            ("ID_Cuenta", "Usuario", "Contraseña", "Nombres", "Apellidos", "Telefono", "Correo", "Color_principal")
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING "ID_Cuenta";
        """, (nuevo_id, Usuario, Contraseña, Nombres, Apellidos, int(Telefono), Correo, Color_principal))

        cuenta_id = cursor.fetchone()[0]
        conexion.commit()

        # Guardar en sesión
        session['usuario_id'] = cuenta_id
        session['usuario_nombre'] = Usuario

        return jsonify({
            'success': True,
            'mensaje': 'Registro exitoso',
            'id': cuenta_id,
            'redirect': '/dashboard'
        }), 201

    except psycopg2.IntegrityError as e:
        if conexion:
            conexion.rollback()
        print(f"Error de integridad: {e}")
        return jsonify({'error': 'El usuario o correo ya existe'}), 409

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
    """Procesa el inicio de sesión"""
    conexion = None
    cursor = None
    try:
        conexion = conectar_db()
        if conexion is None:
            return jsonify({'error': 'No se pudo conectar a la base de datos'}), 500

        # Captura datos del formulario
        datos = request.form
        Usuario = datos.get('usuario', '').strip()
        Contraseña = datos.get('contraseña', '').strip()

        # Validar campos
        if not Usuario or not Contraseña:
            return jsonify({'error': 'Usuario y contraseña son obligatorios'}), 400

        cursor = conexion.cursor(cursor_factory=RealDictCursor)

        # Buscar usuario
        cursor.execute("""
            SELECT "ID_Cuenta", "Usuario", "Nombres", "Apellidos" 
            FROM public."Cuentas"
            WHERE "Usuario" = %s AND "Contraseña" = %s
        """, (Usuario, Contraseña))

        usuario = cursor.fetchone()

        if usuario:
            # Login exitoso - guardar en sesión
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


@app.route('/cerrar-sesion')
def cerrar_sesion():
    """Cierra la sesión del usuario"""
    session.clear()
    return redirect(url_for('inicio'))


@app.route('/dashboard')
def dashboard():
    """Página principal después del login (DEBES CREAR ESTE HTML)"""
    if 'usuario_id' not in session:
        return redirect(url_for('mostrar_login'))
    
    return f"""
    <h1>Bienvenido {session.get('usuario_nombre')}</h1>
    <p>Dashboard - Aquí irán tus notas</p>
    <a href="/cerrar-sesion">Cerrar Sesión</a>
    """


# ============================================
# RUTAS DE API (para consultas)
# ============================================

@app.route('/api/ver-cuentas', methods=['GET'])
def ver_cuentas():
    """Devuelve todas las cuentas registradas en formato JSON"""
    conexion = None
    cursor = None
    try:
        conexion = conectar_db()
        if conexion is None:
            return jsonify({'error': 'No se pudo conectar a la base de datos'}), 500

        cursor = conexion.cursor(cursor_factory=RealDictCursor)

        cursor.execute("""
            SELECT "ID_Cuenta", "Usuario", "Nombres", "Apellidos", "Telefono", "Correo", "Color_principal"
            FROM public."Cuentas"
            ORDER BY "ID_Cuenta" DESC;
        """)
        cuentas = cursor.fetchall()

        return jsonify(cuentas), 200

    except Exception as e:
        print(f"Error al obtener cuentas: {e}")
        return jsonify({'error': 'Error al obtener cuentas'}), 500

    finally:
        if cursor:
            cursor.close()
        if conexion:
            conexion.close()


# Punto de inicio del servidor Flask
if __name__ == '__main__':
    print("🚀 Iniciando servidor Flask...")
    app.run(debug=True, host='0.0.0.0', port=5000)