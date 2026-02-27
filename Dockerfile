#Imagen base para el contenedor osea que sistema operativo se va a usar, en este caso es una imagen de python 3.11 en su version slim que es mas ligera

FROM python:3.11-slim

#Ahore creamos el lugar de trabajo dentro del contenedor que crearemos 

WORKDIR /app

#Copiamos ahora los requerimientos del proyecto al contenedor para que se puedan instalar las dependencias necesarias

COPY requirements.txt .

#Instalamos las dependencias necesarias para el proyecto

RUN pip install --no-cache-dir -r requirements.txt

#Ahora copiamos todo el proyecto al contenedor 

COPY . . 

#Usamos el puerto que usa flask que seria el 5000

EXPOSE 5000

#Usamos unas variables para que flask trabaje mejor en el contenedor 

ENV FLASK_APP=app.py
ENV FLASK_RUN_HOST=0.0.0.0

#Y ya finalmente usamos el comando para ejecutar la aplicacion de flask

CMD ["flask", "run"]


