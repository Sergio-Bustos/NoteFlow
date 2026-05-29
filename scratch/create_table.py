import os
import psycopg2
from dotenv import load_dotenv

load_dotenv('/home/miniyon/NoteFlow/.env')

conn = psycopg2.connect(
    dbname=os.getenv("DB_NAME"),
    user=os.getenv("DB_USER"),
    password=os.getenv("DB_PASSWORD"),
    host=os.getenv("DB_HOST"),
    port=os.getenv("DB_PORT"),
    sslmode='require'
)

cur = conn.cursor()
cur.execute("""
CREATE TABLE IF NOT EXISTS public."Actividad_Usuario" (
    "ID_Actividad" SERIAL PRIMARY KEY,
    "ID_Cuenta" INTEGER NOT NULL REFERENCES public."Cuentas"("ID_Cuenta"),
    "ID_Nota" INTEGER REFERENCES public."Notas"("ID_Nota") ON DELETE SET NULL,
    "Fecha" DATE NOT NULL DEFAULT CURRENT_DATE,
    "Tiempo_segundos" INTEGER NOT NULL DEFAULT 0,
    "Visitas" INTEGER NOT NULL DEFAULT 1,
    UNIQUE ("ID_Cuenta", "ID_Nota", "Fecha")
);
""")
conn.commit()
cur.close()
conn.close()
print("Table created successfully")
