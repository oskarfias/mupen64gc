# Pendientes y estado de cada función

## Datos comerciales por definir
Cada uno se edita en el panel. Mientras falten, quedan en borrador o sin cobrarse.

1. **Correo comercial y dominio** (Ajustes → Datos del negocio) y el remitente de correos (`PHOTO_EMAIL_FROM`).
2. **Logo definitivo** (Contenido → Logo). Mientras tanto se usa el logotipo tipográfico.
3. **Fotografías propias** para la portada y cada sección (Contenido → Imágenes del sitio), y **biografía** en "Sobre mí".
4. **Escuelas:** contenido de los paquetes básico y premium, duración de la jornada y condiciones. Por ahora cada cotización escolar queda "por completar" para que definas duración y logística.
5. **Video Tesoro:** horas de grabación, número de entrevistas y duración de la sesión. Hoy la cotización queda pendiente de duración.
6. **Negocios:** precios y entregables, que se cotizan caso por caso.
7. **Precios de fotos adicionales y de horas adicionales** (Servicios y precios → Extras).
8. **Viáticos** a otros destinos (Servicios y precios → Viáticos).
9. **Tiempos de preparación y traslado** entre servicios (Ajustes; hoy están en 0) y la **anticipación mínima** para reservar.
10. **Cancelaciones:** cómo se resuelven las cancelaciones con más de 72 horas y las reprogramaciones. Ningún reembolso es automático.
11. **Tienda:** tamaños, materiales, precios, proveedores de impresión, tiempos de producción y **tarifas de envío**. Todos los productos están en borrador.
12. **Políticas:** revisión legal de los cuatro borradores (los puntos `[REVISAR: …]`).
13. **Retención:** confirmar los 7 días de gracia antes de borrar archivos al vencer una galería y los 30 días de conservación de archivos de pedidos.
14. **Recomendaciones, poses y logística:** revisar los textos de ejemplo de cada servicio.
15. **Testimonios y portafolio:** agregarlos solo con autorización. Mientras no haya, esas secciones permanecen ocultas.

## Funciona y está probado
Con las pruebas automáticas (`npm run photo:test`, 19 pruebas) y un recorrido en navegador:

- Cotización calculada en el servidor, anticipo del 50% y saldo. Los precios históricos se conservan; los extras sin precio no se cobran y no se puede pagar una cotización incompleta.
- Si una cotización cambia después de aceptarse, se pide nueva aceptación.
- Horario de sesiones de 7:00 a 16:00, y eventos en su horario real fuera de ese rango.
- Apartado de 24 horas. Al vencer se libera la fecha y se envía un aviso. Cuatro solicitudes simultáneas por el mismo horario: solo una gana. Traslapes entre servicios bloqueados.
- Confirmación solo con pago verificado (webhook de Stripe firmado o captura de PayPal). Los webhooks repetidos no duplican pagos ni correos. Un pago tardío para una fecha ocupada queda en conflicto y te avisa.
- Conflictos con Google Calendar, usando un adaptador de prueba. Si no se puede verificar la disponibilidad, no se ofrecen horarios.
- Registro de efectivo con historial. Publicar exige saldo liquidado.
- Galerías aisladas: cambiar identificadores no da acceso y el enlace directo pide el código. Los originales se descargan idénticos y el ZIP es íntegro.
- Correo de entrega solo con contenido publicado y en la fecha programada. Vencimiento a las 3 semanas, con revocación y borrado.
- Pedidos ligados a la foto correcta. Un envío sin tarifa no se cobra. Los pedidos pagados sobreviven al vencimiento de la galería.
- Español e inglés, preferencia de idioma, `noindex` en páginas privadas, protección del panel y CSRF.
- Recorrido en navegador (celular y escritorio), sin errores: reserva → confirmación → subida real de fotos con miniaturas → cobro de saldo en efectivo → publicación → acceso del cliente → visor.

## Implementado, pero requiere configuración y una prueba con cuentas reales
- **Stripe y PayPal:** llaves, webhooks y una transacción de prueba en sandbox.
- **Google Calendar:** credenciales OAuth y conexión desde Agenda.
- **Resend:** clave y dominio verificado. Hoy los correos quedan como "no enviados".
- **Almacenamiento en la nube** (R2, B2 o S3): la firma SigV4 y las cargas multiparte están implementadas, pero no se probaron contra un bucket real.
- **Base persistente:** en el plan gratuito de Render se pierde en cada despliegue. Se necesita disco (plan Starter) o un servidor con almacenamiento persistente.
- **Documentación oficial vigente:** no se pudo consultar desde la sesión de desarrollo. Hay que validar los adaptadores en sandbox antes de abrir los pagos.

## Fuera de alcance por decisión del documento
- Venta de fotos digitales adicionales, selección de pruebas o aprobación de edición: no existen.
- Editor avanzado de fotolibros: no se simula. Solo hay selección y orden de fotos, instrucciones y revisión de diseño.
- Mensajes automáticos de WhatsApp: no se envían. El panel abre WhatsApp con el texto preparado y tú lo mandas.
