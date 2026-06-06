import os
import json
from dotenv import load_dotenv
from google_auth_oauthlib.flow import InstalledAppFlow

# Cargar las variables de entorno donde están GOOGLE_CLIENT_ID y SECRET
load_dotenv()

CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")

if not CLIENT_ID or not CLIENT_SECRET:
    print("Error: Falta GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET en el archivo .env")
    exit(1)

# Construir el formato de credenciales que espera Google
client_config = {
    "installed": {
        "client_id": CLIENT_ID,
        "project_id": "noteflow", 
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        "client_secret": CLIENT_SECRET,
        "redirect_uris": ["http://localhost"]
    }
}

# Permiso necesario para poder ENVIAR correos
SCOPES = ['https://www.googleapis.com/auth/gmail.send']

def main():
    print("Iniciando proceso de autorización...")
    print("Se abrirá una ventana en tu navegador web. Por favor, inicia sesión con la cuenta de Gmail desde la que quieres enviar los correos.")
    
    # Inicia el flujo de OAuth localmente
    flow = InstalledAppFlow.from_client_config(client_config, SCOPES)
    creds = flow.run_local_server(port=0)
    
    # Guarda las credenciales (que incluyen el refresh_token) en token.json
    with open('token.json', 'w') as token:
        token.write(creds.to_json())
    
    print("\n" + "="*50)
    print("¡ÉXITO!")
    print("El archivo 'token.json' se ha creado correctamente.")
    print("La aplicación NoteFlow usará este archivo para enviar correos automáticamente.")
    print("Ya puedes cerrar esta ventana.")
    print("="*50 + "\n")

if __name__ == '__main__':
    main()
