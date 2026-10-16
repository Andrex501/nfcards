# ⚡ Sistema de Tarjetas Inteligentes Físicas NFC & QR (Colombia)

Plataforma completa desarrollada con **Node.js, Express, MongoDB (Mongoose) y Frontend vainilla (HTML5/CSS3/JavaScript con motor EJS)** para la administración y activación de tarjetas físicas NFC y códigos QR para negocios locales en Colombia.

---

## 📁 Estructura del Proyecto

```text
tarjetas/
├── models/
│   └── Card.js             # Modelo Mongoose de la tarjeta
├── views/
│   ├── admin.ejs           # Panel de administración (inventario y asignación)
│   ├── profile.ejs         # Landing page móvil para tarjetas asignadas
│   └── available.ejs       # Vista de tarjeta disponible para activar
├── public/
│   └── css/
│       └── style.css       # Sistema de diseño moderno y responsivo
├── .env.example            # Plantilla de variables de entorno
├── .env                    # Configuración de variables de entorno locales
├── package.json            # Dependencias del proyecto
├── seed.js                 # Script para crear tarjetas de prueba iniciales
├── server.js               # Servidor Express y endpoints del backend
└── README.md               # Documentación e instrucciones
```

---

## 🛠️ Requisitos Previos

- **Node.js** (versión 18 o superior recomendada)
- **MongoDB** en ejecución localmente (por ejemplo, en `mongodb://127.0.0.1:27017`) o un clúster en la nube como **MongoDB Atlas**.

---

## 🚀 Instalación y Ejecución Local

### 1. Instalar dependencias
Abre una terminal en la carpeta del proyecto y ejecuta:

```bash
npm install
```

### 2. Configurar variables de entorno
El archivo `.env` ya viene configurado por defecto con:

```env
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/tarjetas_nfc
```

*(Si utilizas MongoDB Atlas, reemplaza `MONGODB_URI` con tu cadena de conexión).*

### 3. (Opcional) Poblar con tarjetas de prueba
Puedes ejecutar el script de seed para crear automáticamente las tarjetas `001`, `002` y `003`:

```bash
npm run seed
```

### 4. Iniciar el servidor
Para modo producción:
```bash
npm start
```

O para modo desarrollo (con recarga automática ante cambios):
```bash
npm run dev
```

---

## 📱 Rutas y Funcionamiento

| Ruta | Método | Descripción |
| :--- | :---: | :--- |
| `GET /admin` | `GET` | Panel de control para listar tarjetas con sus **códigos QR visuales**, ver su estado y formulario de asignación. |
| `GET /admin/qr/:cardId/download` | `GET` | **Descarga directa del código QR en PNG de alta resolución (1024x1024 px)** listo para imprenta o sticker físico. |
| `GET /admin/qr/:cardId/print` | `GET` | Vista optimizada de impresión para generar el sticker o tarjeta física con su código QR e ID. |
| `POST /admin/update/:cardId` | `POST` | Asigna o actualiza los datos del negocio (`businessName`, `instagramUrl`, `whatsappNumber`, `googleReviewsUrl`) y cambia su estado a `assigned`. |
| `POST /admin/create` | `POST` | Registra una nueva tarjeta en blanco (`cardId`) en estado `available` con su respectivo QR. |
| `POST /admin/reset/:cardId` | `POST` | Restablece una tarjeta al estado `available` liberando los datos del negocio. |
| `GET /p/:cardId` | `GET` | **Ruta pública escaneada desde NFC o QR.** <br>- Si está `available`: muestra *"Tarjeta disponible para activar"*. <br>- Si está `assigned`: muestra la **Landing Page Móvil** con botones para Instagram, WhatsApp y Reseñas de Google Maps. |

> 📌 **Garantía de Enlace Estático**: El código QR apunta siempre a la URL permanente `/p/:cardId`. Aunque los datos del negocio, números o enlaces se modifiquen infinidad de veces en el panel de administración, el código QR impreso físicamente sigue funcionando sin tener que reimprimir nada.

---

## 🇨🇴 Optimizado para Colombia

- **Formateo inteligente de WhatsApp**: Permite ingresar números locales de 10 dígitos (ej. `3001234567`) y los convierte automáticamente al formato `https://wa.me/573001234567` con mensaje predeterminado.
- **Formateo de Instagram**: Acepta handles con `@` (ej. `@negociocolombia`) o URLs completas.
- **Mobile-First Design**: Diseñado específicamente para ofrecer una experiencia rápida, fluida y estética al acercar un smartphone con NFC o escanear el QR.
