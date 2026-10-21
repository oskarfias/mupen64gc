# Archivos descargables

Coloca aquí los archivos que se entregan por correo después del pago.
El nombre del archivo debe empezar con el `sku` de la opción de compra
(ver `src/data/products.js`), por ejemplo:

- `flujo-plantilla-basica.xlsx`
- `nom035-kit-15.zip`

El servidor genera un enlace de descarga personal con vigencia
(variable `DOWNLOAD_LINK_DAYS`) para cada compra pagada.
