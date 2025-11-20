# Importaciones nesecarias para la aplicacion de Flask
from flask import Flask,jsonify,render_template,request
import psycopg2 # Para conectarse a PostgreSQL
from psycopg2.extras import RealDictCursor # Devuelve resultados tipo diccionario
from datetime import datetime # Para manejar fechas de creacion en tiempo real
app = Flask(__name__)
# Configuracion de conexion a la base de datos PostgreSQL:
DB_CONFIG = {
    'host' :'localhost', # Indica que el servidor de la base de datos es local
    'database': 'dbnoteflow', # nombre de la db
    'user': 'postgres', # usuario o dueño de la db
    'password': '123456', # contraseña de la db
    'port': 5432 # puerto de la db
}

# Funcion para conectara a la base de datos
def conectar_db():
    """Establece conexion con la base de datos POSTGRESQL."""
    try:
        conexion = psycopg2.connect(**DB_CONFIG) # Variable para conectar la importacion la base de datos ya configurada
        return conexion # Retorna la conexion: Se logra
    except psycopg2.Error as e: # Por si no dio bien la conexion
        print(f"Error al conectar la base de datos! : {e}") # Se imprime el error
        return None # No retorna nada
    
# Pagina principal que mostara la bienvenida a la pagina
@app.route('/') # Ruta del html
def inicio(): # Funcion inicio para el primer html
    """Ruta que mostara la bienvenida"""
    return render_template('bienvenidoalapagina.html') # Renderiza y carga el .html

# Ruta para guardar los datos enviados desde el formulario
@app.route('/') # Ruta del html
def formulario(): # Funcion que mostrara el html
    """Ruta que mostara el formulario"""
@app.route('/formulario',methods= ['POST']) # Metodo http (ruta logica)


def guardar_contactos(): # Funcion para guardar cada formulario despues del metodo POST que envia los datos
    """"Guarda los datos del formulario en la base de datos"""
    conexion = None
    cursor = None
    try:
        conexion = conectar_db() # Hace la funcion de conectarse a la base de datos
        if conexion is None: # Si no se hizo la conexion
            return jsonify({'error': 'No se pudo conectar a la base de datos'}, 500) # Imprime error 500
        
        # Captura los datos enviados desde el formulario html







if __name__ == '__main__':
    app.run(debug=True)

