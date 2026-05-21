#!/usr/bin/env python3
import os
import sys
import mimetypes
from supabase import create_client, Client

# ==============================================================================
# CONFIGURACIÓN DEL PROYECTO NUEVO (LLENAR CON LOS DATOS DE TU NUEVO SUPABASE)
# ==============================================================================
# El nuevo proyecto de Supabase debe estar creado en una región más cercana como
# AWS "us-east-1" (Norte de Virginia) para baja latencia (50-70ms desde Colombia).
NEW_SUPABASE_URL = "https://bfgxzmquyholydkfyrqq.supabase.co"
NEW_SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmZ3h6bXF1eWhvbHlka2Z5cnFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTIxNjU3MSwiZXhwIjoyMDk0NzkyNTcxfQ.3B7_d-TCpQFHvC-rwNhFTCMrFQCdeqhAKNfPH6p-0mw"

# ==============================================================================
# CARGAR CREDENCIALES DEL PROYECTO ACTUAL (DESDE EL ARCHIVO .ENV)
# ==============================================================================
OLD_SUPABASE_URL = None
OLD_SUPABASE_SERVICE_ROLE_KEY = None

env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")

if os.path.exists(env_path):
    print(f"[*] Cargando credenciales del proyecto actual desde: {env_path}")
    with open(env_path, "r") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                key, val = line.split("=", 1)
                key = key.strip()
                val = val.strip().strip('"').strip("'")
                if key == "SUPABASE_URL":
                    OLD_SUPABASE_URL = val
                elif key == "SUPABASE_SERVICE_ROLE_KEY":
                    OLD_SUPABASE_SERVICE_ROLE_KEY = val
else:
    print(f"[!] Error: No se encontró el archivo .env en la raíz del proyecto.")
    sys.exit(1)

if not OLD_SUPABASE_URL or not OLD_SUPABASE_SERVICE_ROLE_KEY:
    print(f"[!] Error: SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY faltan en el .env.")
    sys.exit(1)

def test_connection():
    print("\n[*] Probando conexiones a los proyectos de Supabase...")
    try:
        old_client = create_client(OLD_SUPABASE_URL, OLD_SUPABASE_SERVICE_ROLE_KEY)
        old_client.storage.list_buckets()
        print(" [+] Conexión al Supabase ACTUAL (Origen) exitosa.")
    except Exception as e:
        print(f" [!] Error conectando al Supabase ACTUAL: {e}")
        sys.exit(1)

    if NEW_SUPABASE_URL == "NUEVA_URL_DE_SUPABASE_AQUI":
        print("\n[!] Por favor edita este script y coloca las credenciales del NUEVO Supabase antes de continuar.")
        sys.exit(0)

    try:
        new_client = create_client(NEW_SUPABASE_URL, NEW_SUPABASE_SERVICE_ROLE_KEY)
        new_client.storage.list_buckets()
        print(" [+] Conexión al NUEVO Supabase (Destino) exitosa.")
    except Exception as e:
        print(f" [!] Error conectando al NUEVO Supabase: {e}")
        sys.exit(1)

    return old_client, new_client

def migrar_storage(old_client: Client, new_client: Client):
    bucket_name = "NoteFlow"
    carpetas = ["profile", "audios", "imagenes", "dibujos", "videos"]

    print(f"\n[*] Iniciando la migración del bucket de Storage '{bucket_name}'...")

    # Asegurar que el bucket exista en el nuevo proyecto
    try:
        new_client.storage.create_bucket(bucket_name, options={"public": True})
        print(f" [+] Creado nuevo bucket público '{bucket_name}' en el destino.")
    except Exception as e:
        # Si ya existe, continuar
        if "already exists" in str(e).lower():
            print(f" [*] El bucket '{bucket_name}' ya existe en el destino. Continuando...")
        else:
            print(f" [!] Advertencia al crear el bucket: {e}")

    for carpeta in carpetas:
        print(f"\n[*] Analizando carpeta '{carpeta}'...")
        try:
            # Listar archivos en la carpeta del viejo bucket
            archivos = old_client.storage.from_(bucket_name).list(carpeta, options={"limit": 1000})
            if not archivos:
                print(f"  [-] No se encontraron archivos en '{carpeta}'.")
                continue

            print(f"  [+] Encontrados {len(archivos)} elementos en '{carpeta}'. Iniciando copia...")

            for item in archivos:
                filename = item.get("name")
                # Evitar carpetas virtuales/marcadores de posición
                if not filename or filename == ".keep" or filename.startswith("."):
                    continue

                path_completo = f"{carpeta}/{filename}"
                print(f"    -> Copiando: {path_completo} ... ", end="", flush=True)

                try:
                    # 1. Descargar del viejo
                    datos_archivo = old_client.storage.from_(bucket_name).download(path_completo)
                    
                    # 2. Adivinar content-type
                    content_type, _ = mimetypes.guess_type(filename)
                    if not content_type:
                        content_type = "application/octet-stream"

                    # 3. Subir al nuevo
                    new_client.storage.from_(bucket_name).upload(
                        path=path_completo,
                        file=datos_archivo,
                        file_options={"content-type": content_type}
                    )
                    print("✅ Completado")
                except Exception as upload_err:
                    if "already exists" in str(upload_err).lower() or "duplicate" in str(upload_err).lower():
                        print("⏭️  Ya existía en destino (omitido)")
                    else:
                        print(f"❌ Error: {upload_err}")

        except Exception as folder_err:
            print(f"  [!] Error al procesar la carpeta '{carpeta}': {folder_err}")

    print("\n[+] Migración de Storage Finalizada.")

if __name__ == "__main__":
    print("======================================================================")
    print("           HERRAMIENTA DE MIGRACIÓN SUPABASE - NOTEFLOW")
    print("======================================================================")
    print(" Este script copiará todos los archivos multimedia del storage antiguo")
    print(" al nuevo proyecto de Supabase.")
    print("======================================================================")
    
    old_c, new_c = test_connection()
    
    confirmacion = input("\n⚠️ ¿Deseas iniciar la copia de archivos de Storage ahora? (s/n): ")
    if confirmacion.lower() == 's':
        migrar_storage(old_c, new_c)
    else:
        print("[*] Operación cancelada por el usuario.")
