# Puesta en marcha del Organizador

Son los únicos pasos que tienes que hacer tú. Todo lo demás lo hace GitHub solo.
Hazlos desde el ordenador si puedes (es más cómodo), pero el móvil también sirve.

---

## Paso 1 · Crear el proyecto de Firebase (5 min)

1. Entra en **https://console.firebase.google.com** con tu cuenta de Google.
2. **Crear un proyecto** → nombre: `organizador` → desactiva Google Analytics → **Crear proyecto**.
3. En la página del proyecto, pulsa el icono **`</>`** (Web) → apodo: `organizador` → **Registrar app**.
   Te enseña un bloque `firebaseConfig = { apiKey: …, authDomain: …, projectId: …, appId: … }`.
   **Cópialo entero y pásamelo** (no es secreto).
4. Menú izquierdo → **Compilación → Authentication** → **Comenzar** → **Google** → actívalo → elige tu correo de asistencia → **Guardar**.
5. En Authentication → **Configuración** → **Dominios autorizados** → **Agregar dominio** → `pmorenod16.github.io`.
6. Menú izquierdo → **Compilación → Firestore Database** → **Crear base de datos** → ubicación `eur3 (europe-west)` → **modo de producción** → **Crear**.

## Paso 2 · La llave de servicio de Firebase (2 min)

Sirve para que GitHub compile el APK y publique las reglas de seguridad él solo.

1. En Firebase: ⚙️ (arriba a la izquierda) → **Configuración del proyecto** → pestaña **Cuentas de servicio** → **Generar nueva clave privada** → se descarga un archivo `.json`.
2. Ábrelo con cualquier editor de texto y copia **todo** su contenido.
3. En **https://github.com/pmorenod16/organizador/settings/secrets/actions** → **New repository secret**:
   - Name: `FIREBASE_SERVICE_ACCOUNT`
   - Secret: pega el contenido del `.json`
   - **Add secret**
4. Borra el archivo `.json` descargado.

## Paso 3 · La clave de Gemini (1 min)

1. Entra en **https://aistudio.google.com/apikey** → **Crear clave de API** → cópiala.
2. En la misma página de secretos de GitHub (paso 2.3), crea otro:
   - Name: `GEMINI_API_KEY` · Secret: la clave.

## Paso 4 · Cloudflare (2 min)

El «Worker» es el pequeño servidor que lee tus calendarios y habla con Gemini sin que la clave quede a la vista.

1. Entra en **https://dash.cloudflare.com** (con la cuenta que ya usaste para el armario, o crea una gratis).
2. Arriba a la derecha: tu perfil → **My Profile** → **API Tokens** → **Create Token** → plantilla **Edit Cloudflare Workers** → **Use template** → en *Account Resources* elige tu cuenta → **Continue to summary** → **Create Token** → cópialo.
3. Secreto nuevo en GitHub: Name `CLOUDFLARE_API_TOKEN` · Secret: el token.

## Paso 5 · Activar la web (30 s)

1. **https://github.com/pmorenod16/organizador/settings/pages**
2. *Build and deployment* → Source: **Deploy from a branch** → Branch: **main** y **/ (root)** → **Save**.

## Paso 6 · Avísame

Dime «hecho» y pásame el bloque `firebaseConfig` del paso 1.3. Yo:

- lo pego en la app,
- publico el Worker y te paso su dirección,
- y lanzo la compilación del APK.

## Paso 7 · Primera entrada

1. Abre **https://pmorenod16.github.io/organizador/** → **Entrar con Google**.
2. La app te enseña un identificador largo: **cópialo y pásamelo**. Es lo que hace que solo tú puedas entrar.
3. Cuando te diga que ya está, vuelve a abrir la app: te saldrá el asistente de configuración (menos de 5 minutos).

## Paso 8 · Instalar el APK en el móvil

1. Descarga **https://github.com/pmorenod16/organizador/releases/latest/download/organizador.apk** en el Xiaomi y ábrelo → **Instalar** (si te pregunta, permite instalar apps de esta fuente).
2. Al abrirla, acepta **notificaciones** y **micrófono**.
3. En el Xiaomi, para que los avisos lleguen con la app cerrada: mantén pulsado el icono → **Información de la app** →
   - **Ahorro de batería** → **Sin restricciones**
   - **Inicio automático** → activado
4. Las actualizaciones llegan solas al abrir la app.

---

### Dónde está cada cosa (por si algún día hace falta)

| Qué | Dónde |
|---|---|
| La app web | https://pmorenod16.github.io/organizador/ |
| El APK | https://github.com/pmorenod16/organizador/releases/latest |
| Tus datos | Firebase → Firestore → `usuarios/<tu identificador>` |
| Compilaciones | https://github.com/pmorenod16/organizador/actions |
