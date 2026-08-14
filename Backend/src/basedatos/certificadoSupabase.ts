/**
 * CERTIFICADO RAÍZ DE SUPABASE
 *
 * Es lo que permite comprobar que del otro lado de la conexión está de verdad
 * Supabase y no cualquiera que se haya podido interponer. Sin esto, `ssl` solo
 * cifra el tránsito y acepta el certificado que le presenten — ver conexion.ts.
 *
 * ┌─ Supabase Root 2021 CA ─────────────────────────────────────────────────┐
 * │ Emisor    Supabase Inc (C=US, ST=Delware, L=New Castle)                 │
 * │ SHA-256   80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:               │
 * │           82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA                │
 * │ VENCE     26 de abril de 2031                                            │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * DE DÓNDE SALIÓ Y POR QUÉ SE LE PUEDE CREER. Se descargó del sitio oficial de
 * Supabase por HTTPS —canal validado contra las CA públicas, o sea independiente
 * del servidor que queremos verificar— y se comparó su huella con la raíz que
 * presenta el pooler en vivo. Coinciden. Tomarlo del propio servidor y confiar en
 * él no habría probado nada: es el que estamos tratando de autenticar.
 *
 *   https://supabase-downloads.s3.ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt
 *
 * NO ES UN SECRETO. Un certificado raíz es público por definición: lo reparte el
 * propio Supabase. Va versionado sin ningún problema.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⚠️ LO QUE PASA EL DÍA QUE ESTO NO SIRVA MÁS
 *
 * Fijar una raíz es fallar cerrado, que es lo correcto para datos personales, y
 * también significa que **si Supabase rota su CA —o si llega abril de 2031— el
 * API deja de conectar a la base y el CDA se queda sin agendamiento**. No hay
 * forma de tener las dos cosas: verificar de verdad es negarse a hablar con quien
 * no se reconoce.
 *
 * El síntoma va a ser un error de TLS que NO dice "se te venció el certificado
 * fijado": va a hablar de `SELF_SIGNED_CERT_IN_CHAIN` o de una firma inválida, y
 * manda a buscar donde no es. Si el API deja de conectar de un día para el otro
 * sin que nadie haya tocado nada, **empezá por acá**:
 *
 *   cd Backend && npx tsx scripts/verificar-tls.ts
 *
 * Ese script dice en un renglón si esta raíz todavía valida al servidor real. La
 * salida es descargar la raíz nueva del enlace de arriba y reemplazar la constante.
 * ────────────────────────────────────────────────────────────────────────────
 */
export const CERTIFICADO_RAIZ_SUPABASE = `-----BEGIN CERTIFICATE-----
MIIDxDCCAqygAwIBAgIUbLxMod62P2ktCiAkxnKJwtE9VPYwDQYJKoZIhvcNAQEL
BQAwazELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5l
dyBDYXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJh
c2UgUm9vdCAyMDIxIENBMB4XDTIxMDQyODEwNTY1M1oXDTMxMDQyNjEwNTY1M1ow
azELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5ldyBD
YXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJhc2Ug
Um9vdCAyMDIxIENBMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqQXW
QyHOB+qR2GJobCq/CBmQ40G0oDmCC3mzVnn8sv4XNeWtE5XcEL0uVih7Jo4Dkx1Q
DmGHBH1zDfgs2qXiLb6xpw/CKQPypZW1JssOTMIfQppNQ87K75Ya0p25Y3ePS2t2
GtvHxNjUV6kjOZjEn2yWEcBdpOVCUYBVFBNMB4YBHkNRDa/+S4uywAoaTWnCJLUi
cvTlHmMw6xSQQn1UfRQHk50DMCEJ7Cy1RxrZJrkXXRP3LqQL2ijJ6F4yMfh+Gyb4
O4XajoVj/+R4GwywKYrrS8PrSNtwxr5StlQO8zIQUSMiq26wM8mgELFlS/32Uclt
NaQ1xBRizkzpZct9DwIDAQABo2AwXjALBgNVHQ8EBAMCAQYwHQYDVR0OBBYEFKjX
uXY32CztkhImng4yJNUtaUYsMB8GA1UdIwQYMBaAFKjXuXY32CztkhImng4yJNUt
aUYsMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAB8spzNn+4VU
tVxbdMaX+39Z50sc7uATmus16jmmHjhIHz+l/9GlJ5KqAMOx26mPZgfzG7oneL2b
VW+WgYUkTT3XEPFWnTp2RJwQao8/tYPXWEJDc0WVQHrpmnWOFKU/d3MqBgBm5y+6
jB81TU/RG2rVerPDWP+1MMcNNy0491CTL5XQZ7JfDJJ9CCmXSdtTl4uUQnSuv/Qx
Cea13BX2ZgJc7Au30vihLhub52De4P/4gonKsNHYdbWjg7OWKwNv/zitGDVDB9Y2
CMTyZKG3XEu5Ghl1LEnI3QmEKsqaCLv12BnVjbkSeZsMnevJPs1Ye6TjjJwdik5P
o/bKiIz+Fq8=
-----END CERTIFICATE-----
`;

/**
 * Huella de la raíz de arriba. La usa `scripts/verificar-tls.ts` para comprobar
 * que lo que está en este archivo es lo que el servidor presenta, sin tener que
 * volver a descargar nada.
 */
export const HUELLA_RAIZ_SUPABASE =
  "80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA";

/** Vencimiento de la raíz, para que el script pueda avisar antes de que muerda. */
export const VENCE_RAIZ_SUPABASE = "2031-04-26";
