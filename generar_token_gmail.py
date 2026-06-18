import os
import json
from dotenv import load_dotenv
from urllib.parse import urlparse, parse_qs
from requests_oauthlib import OAuth2Session

load_dotenv()

CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
REDIRECT_URI = "http://localhost"

if not CLIENT_ID or not CLIENT_SECRET:
    print("Error: Falta GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET en .env")
    exit(1)

SCOPES = ['https://www.googleapis.com/auth/gmail.send']

def main():
    print("="*60)
    print("  REGENERAR TOKEN GMAIL PARA NOTEFLOW")
    print("="*60)
    print()

    session = OAuth2Session(CLIENT_ID, redirect_uri=REDIRECT_URI, scope=SCOPES)
    auth_url, _ = session.authorization_url(
        "https://accounts.google.com/o/oauth2/auth",
        access_type="offline",
        prompt="consent",
        include_granted_scopes="true"
    )

    print("1. Abre esta URL en tu navegador (con noteflowservices@gmail.com):")
    print()
    print(auth_url)
    print()
    print("2. Acepta los permisos")
    print("3. Serás redirigido a http://localhost (dará error de conexión — es normal)")
    print("4. Copia la URL COMPLETA de la barra de direcciones")
    print("   (empieza con http://localhost/?code=...)")
    print("5. Pégala abajo y presiona Enter")
    print()

    redirect_url = input("URL: ").strip()
    qs = parse_qs(urlparse(redirect_url).query)
    auth_code = qs.get("code", [None])[0]

    if not auth_code:
        print("Error: No se encontró ?code=... en la URL.")
        exit(1)

    token = session.fetch_token(
        "https://oauth2.googleapis.com/token",
        code=auth_code,
        client_secret=CLIENT_SECRET,
        include_client_id=True
    )

    from datetime import datetime, timezone
    expires_at = token.get("expires_at")
    expiry_str = datetime.fromtimestamp(expires_at, tz=timezone.utc).isoformat() if expires_at else None

    creds_data = {
        "token": token.get("access_token"),
        "refresh_token": token.get("refresh_token"),
        "token_uri": "https://oauth2.googleapis.com/token",
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "scopes": SCOPES,
        "expiry": expiry_str
    }

    with open("token.json", "w") as f:
        json.dump(creds_data, f, indent=2)

    print()
    print("="*60)
    print("  ¡ÉXITO! token.json creado.")
    print("="*60)
    print()

    refresh = creds_data.get("refresh_token")
    if refresh:
        print("Nuevo GOOGLE_REFRESH_TOKEN (actualiza tu .env con esto):")
        print(refresh)
        print()
    else:
        print("ADVERTENCIA: No se obtuvo refresh_token.")
        print("Elimina el acceso en https://myaccount.google.com/security y vuelve a intentar.")

if __name__ == "__main__":
    main()
