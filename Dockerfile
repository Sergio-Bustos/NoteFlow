# Etapa 1: Construcción del frontend (React)
FROM node:18-alpine AS frontend
WORKDIR /app
# Copiamos la carpeta de React
# Creamos las carpetas destino donde Vite intentará guardar los archivos
RUN mkdir -p static/admin-react/dist templates
# Instalamos dependencias silenciosamente y compilamos
WORKDIR /app/admin-react
COPY admin-react/package*.json ./
ENV npm_config_update_notifier=false
RUN npm ci --no-fund --no-audit --loglevel=error
COPY admin-react/ ./
RUN npm run build

# Etapa 2: Construcción del backend (Flask)
FROM python:3.11-slim
WORKDIR /app

# Copiamos requerimientos e instalamos
COPY requirements.txt .
RUN pip install --default-timeout=100 --no-cache-dir -r requirements.txt

# Copiamos todo el proyecto
COPY . .

# Copiamos los archivos compilados de React generados en la Etapa 1
COPY --from=frontend /app/static/admin-react/dist ./static/admin-react/dist
COPY --from=frontend /app/templates/soporte_admin_react.html ./templates/soporte_admin_react.html

EXPOSE 5000
ENV FLASK_APP=app.py
ENV FLASK_RUN_HOST=0.0.0.0
ENV PYTHONUNBUFFERED=1

CMD ["flask", "run"]