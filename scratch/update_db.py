import os
import psycopg2
from dotenv import load_dotenv

load_dotenv('/home/miniyon/NoteFlow/.env')

def update_schema():
    print("Conectando a Supabase...")
    conn = psycopg2.connect(
        host=os.getenv("DB_HOST"),
        database=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        port=os.getenv("DB_PORT")
    )
    cur = conn.cursor()
    
    # Añadir Veces_premium a Cuentas si no existe
    print("Añadiendo Veces_premium a Cuentas si no existe...")
    cur.execute("""
        ALTER TABLE public."Cuentas" 
        ADD COLUMN IF NOT EXISTS "Veces_premium" INTEGER DEFAULT 0;
    """)
    
    # Inicializar Veces_premium = 1 para los que ya son premium
    print("Inicializando Veces_premium=1 para usuarios premium actuales...")
    cur.execute("""
        UPDATE public."Cuentas" 
        SET "Veces_premium" = 1 
        WHERE "Es_premium" = TRUE AND ("Veces_premium" IS NULL OR "Veces_premium" = 0);
    """)
    
    conn.commit()
    print("Esquema actualizado correctamente en Supabase.")
    
    cur.close()
    conn.close()

if __name__ == "__main__":
    update_schema()
