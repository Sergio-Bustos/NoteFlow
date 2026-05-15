-- ============================================================
-- NoteFlow — schema.sql
-- Ejecutar automáticamente al levantar Docker por primera vez.
-- Carpeta: init-db/schema.sql
-- ============================================================

-- Tabla: Cuentas
CREATE TABLE IF NOT EXISTS public."Cuentas" (
    "ID_Cuenta"          SERIAL PRIMARY KEY,
    "Usuario"            TEXT NOT NULL,
    "Contraseña"         TEXT NOT NULL,
    "Nombres"            TEXT NOT NULL,
    "Apellidos"          TEXT NOT NULL,
    "Telefono"           NUMERIC NOT NULL,
    "Correo"             TEXT NOT NULL,
    "Color_principal"    TEXT NOT NULL DEFAULT 'Blanco',
    "reset_token"        TEXT,
    "reset_token_expira" TIMESTAMP WITH TIME ZONE,
    "Foto"               TEXT,
    "Es_premium"         BOOLEAN DEFAULT FALSE,
    "Premium_vence"      TIMESTAMP WITH TIME ZONE,
    "Plan_premium"       TEXT DEFAULT 'gratis',
    "Avatar_plan"        VARCHAR(20) DEFAULT 'quincenal'
);

-- Tabla: Carpetas
CREATE TABLE IF NOT EXISTS public."Carpetas" (
    "ID_Carpeta"     SERIAL PRIMARY KEY,
    "Nombre_carpeta" TEXT NOT NULL,
    "ID_Cuenta"      INTEGER NOT NULL REFERENCES public."Cuentas"("ID_Cuenta"),
    "Estado"         TEXT NOT NULL DEFAULT 'Activa',
    "Fecha_creacion" TIMESTAMP DEFAULT NOW(),
    "Fecha_edicion"  TIMESTAMP DEFAULT NOW()
);

-- Tabla: Notas
CREATE TABLE IF NOT EXISTS public."Notas" (
    "ID_Nota"          SERIAL PRIMARY KEY,
    "Fecha_decreacion" DATE NOT NULL,
    "Contenido"        TEXT NOT NULL,
    "Descripcion"      TEXT NOT NULL,
    "Titulo"           TEXT NOT NULL,
    "Fecha_deedicion"  DATE NOT NULL,
    "Estado"           TEXT NOT NULL DEFAULT 'Activa',
    "Formato"          TEXT NOT NULL,
    "ID_Carpeta"       INTEGER REFERENCES public."Carpetas"("ID_Carpeta"),
    "ID_Cuenta"        INTEGER NOT NULL REFERENCES public."Cuentas"("ID_Cuenta")
);

-- Tabla: Etiquetas
CREATE TABLE IF NOT EXISTS public."Etiquetas" (
    "ID_Etiqueta"     SERIAL PRIMARY KEY,
    "Nombre_etiqueta" TEXT
);

-- Tabla: Notas_etiquetas (tabla puente)
CREATE TABLE IF NOT EXISTS public."Notas_etiquetas" (
    "ID_Nota"     INTEGER NOT NULL REFERENCES public."Notas"("ID_Nota"),
    "ID_Etiqueta" INTEGER NOT NULL REFERENCES public."Etiquetas"("ID_Etiqueta"),
    PRIMARY KEY ("ID_Nota", "ID_Etiqueta")
);

-- Tabla: Adjuntos
CREATE TABLE IF NOT EXISTS public."Adjuntos" (
    "ID_Adjunto"     SERIAL PRIMARY KEY,
    "Nombre_archivo" TEXT NOT NULL,
    "Formato"        TEXT NOT NULL,
    "Ruta_archivo"   TEXT NOT NULL,
    "ID_Nota"        INTEGER NOT NULL REFERENCES public."Notas"("ID_Nota")
);

-- Tabla: Tipos
CREATE TABLE IF NOT EXISTS public."Tipos" (
    "Formato" TEXT PRIMARY KEY
);

-- Tabla: Soporte
CREATE TABLE IF NOT EXISTS public."Soporte" (
    "ID_Mensaje" SERIAL PRIMARY KEY,
    "ID_Cuenta" INTEGER NOT NULL REFERENCES public."Cuentas"("ID_Cuenta"),
    "Mensaje" TEXT NOT NULL,
    "Remitente" VARCHAR(10) NOT NULL,
    "Leido" BOOLEAN DEFAULT FALSE,
    "Fecha" TIMESTAMP DEFAULT NOW()
);