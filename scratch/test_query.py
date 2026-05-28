import os
import psycopg2
from dotenv import load_dotenv
import json
import datetime

load_dotenv('/home/miniyon/NoteFlow/.env')

class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (datetime.datetime, datetime.date)):
            return obj.isoformat()
        return super(DateTimeEncoder, self).default(obj)

def test_query():
    print("Conectando a Supabase para probar query...")
    conn = psycopg2.connect(
        host=os.getenv("DB_HOST"),
        database=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        port=os.getenv("DB_PORT")
    )
    cur = conn.cursor()
    
    query = """
    WITH RECURSIVE dias AS (
        SELECT current_date - 29 AS fecha
        UNION ALL
        SELECT fecha + 1 FROM dias WHERE fecha < current_date
    ),
    notas_diarias AS (
        SELECT "Fecha_decreacion"::date as fecha, COUNT(*) as cant_notas
        FROM public."Notas"
        WHERE "Fecha_decreacion" >= current_date - 30
        GROUP BY "Fecha_decreacion"::date
    ),
    cuentas_diarias AS (
        SELECT "Fecha_creacion"::date as fecha, COUNT(*) as cant_cuentas
        FROM public."Cuentas"
        WHERE "Fecha_creacion" >= current_date - 30
        GROUP BY "Fecha_creacion"::date
    ),
    compras_estimadas AS (
        SELECT 
            CASE 
                WHEN "Plan_premium" = 'quincenal' THEN ("Premium_vence" - INTERVAL '15 days')::date
                WHEN "Plan_premium" = 'mensual' THEN ("Premium_vence" - INTERVAL '1 month')::date
                WHEN "Plan_premium" = 'anual' THEN ("Premium_vence" - INTERVAL '1 year')::date
                ELSE NULL
            END as fecha,
            COUNT(*) as cant_compras,
            SUM(CASE 
                WHEN "Plan_premium" = 'quincenal' THEN 14900
                WHEN "Plan_premium" = 'mensual' THEN 24900
                WHEN "Plan_premium" = 'anual' THEN 199900
                ELSE 0
            END) as ingresos
        FROM public."Cuentas"
        WHERE "Es_premium" = TRUE AND "Premium_vence" IS NOT NULL
        GROUP BY 1
    )
    SELECT 
        d.fecha,
        COALESCE(n.cant_notas, 0) as notas,
        COALESCE(c.cant_cuentas, 0) as cuentas,
        COALESCE(co.cant_compras, 0) as compras,
        COALESCE(co.ingresos, 0) as ingresos
    FROM dias d
    LEFT JOIN notas_diarias n ON d.fecha = n.fecha
    LEFT JOIN cuentas_diarias c ON d.fecha = c.fecha
    LEFT JOIN compras_estimadas co ON d.fecha = co.fecha
    ORDER BY d.fecha ASC;
    """
    
    cur.execute(query)
    rows = cur.fetchall()
    
    print(f"Total rows: {len(rows)}")
    print(f"First row: {json.dumps(rows[0], cls=DateTimeEncoder)}")
    print(f"Last row: {json.dumps(rows[-1], cls=DateTimeEncoder)}")
    
    cur.close()
    conn.close()

if __name__ == "__main__":
    test_query()
