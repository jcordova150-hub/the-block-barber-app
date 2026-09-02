# Tarjetas de fidelidad — The Block Barber

App web real e independiente para llevar el control de sellos de tus clientes.
Los datos se guardan en una base de datos en la nube (MongoDB Atlas, gratis para
siempre) y el servidor corre en Render (plan gratuito). Es una app **totalmente
separada** de cualquier otra barbería — su propia base de datos, su propio link.

## Estructura de la tarjeta

10 posiciones en total: 4 sellos, luego **50% de descuento**, 4 sellos más,
luego **corte gratis**. Es decir, se necesitan **8 visitas reales** — las
posiciones 5 y 10 son las insignias de premio, no sellos que pongas tú.

## Antes de empezar

Vas a necesitar tres cuentas gratuitas:

- **MongoDB Atlas**: donde vivirán tus clientes y sus sellos, para siempre.
- **Render**: donde correrá el servidor de la app.
- **GitHub**: el paso intermedio para subir el código a Render.

---

## Paso 1 — Crear la base de datos gratuita en MongoDB Atlas

1. Ve a https://www.mongodb.com/cloud/atlas/register y crea una cuenta gratuita.
2. Al crear tu clúster, elige la opción gratuita **M0 (Free)** — es gratis para
   siempre, no una prueba temporal.
3. Crea un usuario de base de datos y anota **usuario** y **contraseña**.
4. En "Network Access", agrega `0.0.0.0/0` (acceso desde cualquier lugar) —
   necesario porque Render no tiene una IP fija. Asegúrate de que NO quede
   como entrada temporal.
5. Ve a "Database" → **Connect** → **Drivers** → copia el connection string:
   ```
   mongodb+srv://tuUsuario:<password>@nombreCluster.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
6. Reemplaza `<password>` por tu contraseña real. Ese link completo es tu
   `MONGODB_URI`.

---

## Paso 2 — Subir el código a GitHub

1. Crea una cuenta gratuita en https://github.com si no tienes una.
2. Crea un repositorio nuevo, por ejemplo `block-barber-app`.
3. Descomprime este .zip. Sube todo **menos la carpeta `node_modules`**
   (arrastra los archivos y carpetas en "uploading an existing file").
4. Confirma con "Commit changes".

---

## Paso 3 — Desplegar en Render (gratis)

1. Crea una cuenta gratuita en https://render.com.
2. **New +** → **Web Service** → conecta tu repositorio `block-barber-app`.
3. Configura:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: **Free** (revisa que no quede en un plan de pago)
4. Antes de crear el servicio, agrega la variable de entorno:
   - **Key**: `MONGODB_URI`
   - **Value**: tu connection string del Paso 1
5. **Create Web Service**. En uno o dos minutos tendrás tu URL, algo como
   `https://block-barber.onrender.com`.

---

## Cómo se usa

- **Panel de personal**: entra a tu URL de Render.
  Contraseña inicial: **BlockBarber2026!** (cámbiala desde "Editar datos del
  negocio" apenas entres).
- **Dar de alta un cliente**: nombre y teléfono, panel izquierdo.
- **Sellar una visita**: selecciona al cliente, botón "Sellar visita de hoy".
  Al llegar a 4 sellos se ilumina el 50% de descuento; al llegar a 8, el corte
  gratis.
- **Tarjeta del cliente**: cada uno tiene un QR y un link fijo que muestra su
  tarjeta **en vivo**, sin contraseña.
- **Varios empleados**: cualquiera con la contraseña de personal puede entrar
  desde su celular a la misma URL y sellar visitas.

## Nota sobre el plan gratuito de Render

El servidor se duerme tras 15 minutos sin visitas y tarda unos 20-30 segundos
en despertar. No borra ningún dato — tus clientes siguen a salvo en MongoDB
Atlas, que nunca se apaga.

## Seguridad

- La contraseña de personal protege todo lo que modifica datos.
- La tarjeta pública de cada cliente solo expone su nombre, teléfono, sellos
  y los datos del negocio — nunca la contraseña de personal.
