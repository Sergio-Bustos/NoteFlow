#!/usr/bin/env python3
import os
import sys
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
from supabase import create_client

# Cargar variables de entorno
load_dotenv()

DB_NAME = os.getenv("DB_NAME", "postgres")
DB_USER = os.getenv("DB_USER", "postgres.mgucnmcakffjttxfjsub")
DB_PASSWORD = os.getenv("DB_PASSWORD", "noteflow2026@sena")
DB_HOST = os.getenv("DB_HOST", "aws-1-us-west-2.pooler.supabase.com")
DB_PORT = int(os.getenv("DB_PORT", 6543))

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://mgucnmcakffjttxfjsub.supabase.co")
# IMPORTANTE: Usamos la service role key para tener permisos completos de listado y borrado sin restricciones de RLS
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

def format_size(bytes_size):
    if bytes_size < 1024:
        return f"{bytes_size} B"
    elif bytes_size < 1024 * 1024:
        return f"{bytes_size / 1024:.2f} KB"
    else:
        return f"{bytes_size / (1024 * 1024):.2f} MB"

def main():
    print("==========================================================")
    print("🗑️  INICIANDO LIMPIEZA DE ARCHIVOS HUÉRFANOS EN SUPABASE")
    print("==========================================================\n")

    if not SUPABASE_KEY:
        print("❌ ERROR: SUPABASE_SERVICE_ROLE_KEY no está configurada en el archivo .env.")
        sys.exit(1)

    # 1. Conectar a la base de datos y obtener rutas activas
    print("🔗 Conectando a PostgreSQL...")
    try:
        conn = psycopg2.connect(
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            host=DB_HOST,
            port=DB_PORT,
            sslmode="require",
            cursor_factory=RealDictCursor
        )
        cur = conn.cursor()
    except Exception as e:
        print(f"❌ ERROR: No se pudo conectar a la base de datos: {e}")
        sys.exit(1)

    print("📊 Obteniendo rutas de archivos activas en la base de datos...")
    
    # Rutas en Adjuntos
    cur.execute('SELECT "Ruta_archivo" FROM public."Adjuntos" WHERE "Ruta_archivo" IS NOT NULL')
    rutas_adjuntos = [r["Ruta_archivo"] for r in cur.fetchall()]
    
    # Fotos en Cuentas
    cur.execute('SELECT "Foto" FROM public."Cuentas" WHERE "Foto" IS NOT NULL')
    rutas_fotos = [r["Foto"] for r in cur.fetchall()]
    
    cur.close()
    conn.close()

    rutas_activas = set(rutas_adjuntos + rutas_fotos)
    print(f"✅ Se encontraron {len(rutas_activas)} archivos activos referenciados en la base de datos.\n")

    # 2. Conectar a Supabase Storage
    print("☁️ Conectando a Supabase Storage...")
    try:
        client = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        print(f"❌ ERROR: No se pudo iniciar el cliente de Supabase: {e}")
        sys.exit(1)

    folders = ["videos", "audios", "dibujos", "imagenes", "profile"]
    bucket_name = "NoteFlow"
    
    orphans = []
    total_freed_space = 0

    print("🔍 Escaneando carpetas en el bucket 'NoteFlow'...")
    for folder in folders:
        try:
            files = client.storage.from_(bucket_name).list(folder)
            if not files:
                continue
                
            print(f"📁 Carpeta: '{folder}' ({len(files)} archivos en total)")
            for f in files:
                name = f.get("name")
                if not name or name == ".emptyFolderPlaceholder":
                    continue
                
                # Reconstruir url o verificar por sufijo de nombre
                # Si ningún registro activo contiene o termina con el nombre del archivo, es huérfano
                is_active = False
                for r in rutas_activas:
                    if r.endswith(name) or name in r:
                        is_active = True
                        break
                
                if not is_active:
                    metadata = f.get("metadata", {})
                    size = metadata.get("size", 0)
                    orphans.append({
                        "folder": folder,
                        "name": name,
                        "path": f"{folder}/{name}",
                        "size": size
                    })
                    total_freed_space += size
        except Exception as e:
            print(f"⚠️ Advertencia: No se pudo escanear la carpeta '{folder}': {e}")

    print("\n----------------------------------------------------------")
    if not orphans:
        print("✨ ¡Excelente! No se encontraron archivos huérfanos en tu Storage.")
        print("Todos los archivos del bucket están actualmente asociados a alguna nota.")
        print("----------------------------------------------------------\n")
        sys.exit(0)

    print(f"🚨 Se encontraron {len(orphans)} archivos huérfanos que NO pertenecen a ninguna nota activa:")
    for o in orphans:
        print(f"  ❌ [{o['folder']}] {o['name']} ({format_size(o['size'])})")
    print(f"\n📦 Espacio total a recuperar: {format_size(total_freed_space)}")
    print("----------------------------------------------------------\n")

    # 3. Eliminar archivos huérfanos
    print("🧹 Eliminando archivos huérfanos de Supabase Storage...")
    paths_to_delete = [o["path"] for o in orphans]
    
    try:
        # Eliminamos en bloques de 50 para evitar sobrecargar la API
        chunk_size = 50
        for i in range(0, len(paths_to_delete), chunk_size):
            chunk = paths_to_delete[i:i + chunk_size]
            client.storage.from_(bucket_name).remove(chunk)
        print("\n🎉 ¡Limpieza completada con éxito!")
        print(f"✅ Se eliminaron {len(orphans)} archivos de forma segura.")
        print(f"💾 Espacio recuperado en el bucket: {format_size(total_freed_space)}")
    except Exception as e:
        print(f"❌ ERROR durante la eliminación: {e}")
        sys.exit(1)

    print("\n==========================================================")

if __name__ == "__main__":
    main()
