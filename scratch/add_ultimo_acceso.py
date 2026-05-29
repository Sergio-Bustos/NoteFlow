import sys
import os
sys.path.append('/home/miniyon/NoteFlow')
from app import conectar_db, cerrar_db

def run_migration():
    conexion = conectar_db()
    if conexion:
        try:
            cursor = conexion.cursor()
            cursor.execute('ALTER TABLE public."Cuentas" ADD COLUMN IF NOT EXISTS "Ultimo_acceso" TIMESTAMP WITH TIME ZONE;')
            conexion.commit()
            print("Migración completada con éxito.")
        except Exception as e:
            print(f"Error: {e}")
        finally:
            cerrar_db(cursor, conexion)

if __name__ == '__main__':
    run_migration()
