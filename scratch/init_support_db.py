import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

DB_CONFIG = {
    "host":     os.getenv("DB_HOST",     "localhost"),
    "database": os.getenv("DB_NAME",     "dbnoteflow"),
    "user":     os.getenv("DB_USER",     "postgres"),
    "password": os.getenv("DB_PASSWORD", "123456"),
    "port":     int(os.getenv("DB_PORT", 5432)),
}

def init_support_table():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        
        cur.execute("""
            CREATE TABLE IF NOT EXISTS public."Soporte" (
                "ID_Mensaje" SERIAL PRIMARY KEY,
                "ID_Cuenta" INTEGER NOT NULL REFERENCES public."Cuentas"("ID_Cuenta"),
                "Mensaje" TEXT NOT NULL,
                "Remitente" VARCHAR(10) NOT NULL,
                "Leido" BOOLEAN DEFAULT FALSE,
                "Fecha" TIMESTAMP DEFAULT NOW()
            );
        """)
        
        conn.commit()
        cur.close()
        conn.close()
        print("Tabla Soporte creada o verificada exitosamente.")
    except Exception as e:
        print(f"Error al crear tabla Soporte: {e}")

if __name__ == "__main__":
    init_support_table()
