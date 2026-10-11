# Prompt original usado en Lovable

> Este es el prompt con el que se generó la primera versión del aplicativo en [Lovable](https://lovable.dev). Se conserva como evidencia de cómo se usó la IA para construir el demo. Algunas decisiones cambiaron durante la construcción (por ejemplo, el nombre pasó de *PizzaFlow* a *Synthex Kitchen*); el README describe el comportamiento final.

# Construir SaaS de gestión para pizzería: PizzaFlow

Crea una aplicación web funcional llamada **PizzaFlow**, un sistema de gestión de inventario, recetas, producción y ventas para una pizzería. Debe sentirse como un SaaS empresarial moderno, inspirado en la navegación modular de MiSumind.

## 1. Diseño visual y experiencia

**Paleta obligatoria:**
- Negro: `#000000`
- Verde oscuro: `#073D24`
- Verde: `#096B3D`
- Verde brillante: `#0DA65F`
- Gris claro: `#DBDBDB`

Usa fondo general gris muy claro o blanco, sidebar verde oscuro, botones principales verde brillante, textos oscuros y bordes gris claro. Mantén una estética limpia, profesional, con jerarquía visual clara, tablas compactas, tarjetas KPI, iconos consistentes, estados mediante etiquetas de color y espacios bien distribuidos. Evita degradados y efectos decorativos excesivos.

**Navegación:**
- Crea un login visual con el nombre PizzaFlow, un formulario sencillo y un botón «Ingresar». Al hacer clic, debe entrar directamente al aplicativo sin validar credenciales ni implementar autenticación.
- Dentro del aplicativo, usa un **sidebar principal fijo a la izquierda** con logo, nombre del sistema y menús: Dashboard, Inventario, Recetas, Producción, Ventas y Movimientos.
- En la parte inferior del sidebar, incluye configuración visual y perfil ficticio.
- El área de contenido debe tener encabezado con título, descripción breve, breadcrumb cuando aplique y acciones principales.
- Para crear, editar y consultar registros, usa **drawers o paneles secundarios que se abran desde la derecha**, con formularios, botones Guardar y Cancelar. No reemplaces la pantalla completa ni pierdas el contexto del módulo.
- Incluye buscador, filtros, tablas, estados vacíos, confirmaciones antes de eliminar y notificaciones de éxito o error.
- Diseño responsive para escritorio y tablet.

## 2. Datos mock y persistencia

Carga datos ficticios realistas en español para una pizzería llamada «Forno Pizza», con cantidades, costos y precios en pesos colombianos (COP).

Incluye inicialmente:

**Materias primas**
- Harina de trigo: 25 kg, costo $4.000/kg, mínimo 5 kg.
- Queso mozzarella: 12 kg, costo $28.000/kg, mínimo 3 kg.
- Salsa de tomate: 8 kg, costo $9.000/kg, mínimo 2 kg.
- Pepperoni: 4 kg, costo $32.000/kg, mínimo 1 kg.
- Champiñones: 3 kg, costo $14.000/kg, mínimo 1 kg.
- Aceite de oliva: 2 litros, costo $25.000/litro, mínimo 0,5 litros.

**Productos preparados**
- Masa de pizza: 10 unidades disponibles.
- Salsa preparada: 5 kg disponibles.

**Productos de venta**
- Pizza Margarita: precio $24.000.
- Pizza Pepperoni: precio $32.000.
- Pizza Vegetariana: precio $29.000.

Carga recetas, órdenes de producción, ventas y movimientos históricos suficientes para que el dashboard se vea completo desde el primer ingreso. Los datos deben ser coherentes entre módulos.

Los datos mock son la carga inicial, no datos estáticos. Permite crear, consultar, editar y eliminar registros. Persiste los cambios al recargar la aplicación utilizando la base de datos del proyecto si está disponible; si no, utiliza almacenamiento local persistente como alternativa para que el prototipo siga siendo funcional.

## 3. Dashboard

Diseña un dashboard ejecutivo con:
- Valor total estimado del inventario.
- Cantidad de referencias activas.
- Productos con stock bajo.
- Órdenes de producción pendientes.
- Ventas del día.
- Un gráfico de ventas de los últimos 7 días.
- Una gráfica o resumen de inventario por categoría.
- Tabla de movimientos recientes.
- Alertas de insumos que requieren reposición.

Las cifras y gráficas deben calcularse desde los datos del aplicativo y actualizarse después de registrar operaciones; no uses valores fijos para los indicadores.

## 4. Inventario

Crea un módulo con tabla de productos y filtros por categoría, estado y nivel de existencias.

Campos: nombre, código SKU, categoría (Materia prima, Preparación o Producto de venta), unidad de medida, stock actual, stock mínimo, costo unitario, precio de venta opcional y estado.

Funciones:
- Crear productos.
- Consultar detalles.
- Editar productos.
- Eliminar productos sin movimientos ni relaciones activas, solicitando confirmación.
- Buscar por nombre o SKU.
- Identificar estados: Óptimo, Stock bajo y Agotado.
- Ver el historial de movimientos de cada producto.

No permitas eliminar productos que estén vinculados a recetas u operaciones históricas; explica el motivo y ofrece desactivarlos.

## 5. Recetas

Permite definir y administrar las recetas de cada preparación o pizza.

Cada receta debe tener nombre, producto resultante, cantidad producida por receta, unidad de rendimiento, lista de ingredientes, cantidad consumida por ingrediente y costo calculado.

Incluye estas recetas iniciales:

- **Masa de pizza:** 1 kg de harina produce aproximadamente 4 bases de pizza. Usa este rendimiento para los cálculos.
- **Pizza Margarita:** 1 base de masa, 150 g de queso mozzarella y 100 g de salsa preparada.
- **Pizza Pepperoni:** 1 base de masa, 150 g de queso mozzarella, 100 g de salsa preparada y 50 g de pepperoni.
- **Pizza Vegetariana:** 1 base de masa, 150 g de queso mozzarella, 100 g de salsa preparada y 80 g de champiñones.

Permite agregar, editar y quitar ingredientes, cambiar cantidades, calcular el costo estimado de la receta y consultar la disponibilidad de materiales para producir una cantidad determinada.

Si falta un ingrediente, muestra qué producto falta y cuánto se necesita. No permitas guardar recetas con cantidades nulas o negativas ni referencias duplicadas en sus ingredientes.

## 6. Producción

Este es uno de los módulos más importantes. Debe permitir transformar materias primas en productos preparados y aumentar el inventario resultante.

Incluye:
- Listado de órdenes con código, fecha, producto a fabricar, cantidad planificada, estado y costo estimado.
- Botón «Nueva orden de producción».
- Drawer con selección de producto preparado, cantidad a producir y fecha.
- Desglose automático de ingredientes necesarios según la receta.
- Comparación entre cantidades requeridas y stock disponible.
- Estados: Borrador, Pendiente, En producción, Completada y Cancelada.
- Acciones para consultar, editar, iniciar y completar una orden.

**Reglas de negocio:**
1. Al crear una orden en borrador, no cambies las existencias.
2. Antes de iniciar o completar la producción, valida que todos los ingredientes tengan stock suficiente.
3. Al confirmar la producción, descuenta los ingredientes consumidos y aumenta el inventario del producto resultante según el rendimiento definido.
4. Registra cada entrada y salida en el módulo Movimientos, incluyendo referencia de la orden, fecha y motivo.
5. No permitas stock negativo.
6. Una orden completada no puede volver a ejecutarse ni descontar inventario dos veces.
7. No permitas eliminar físicamente órdenes que ya afectaron inventario. Permite cancelar borradores o pendientes y conserva el historial de las órdenes completadas.

Muestra una vista de detalle de la orden con los insumos, cantidades requeridas, cantidades consumidas y resultado producido.

## 7. Ventas

Crea un módulo para registrar ventas de pizzas.

La pantalla debe incluir:
- Botón «Nueva venta».
- Selector de productos de venta.
- Carrito con producto, cantidad, precio unitario, subtotal y total.
- Método de pago: Efectivo, Tarjeta o Transferencia.
- Fecha y estado de la venta.
- Listado de ventas con búsqueda por número, fecha y estado.
- Drawer para crear y consultar ventas.

Al confirmar una venta:
- Calcula automáticamente el total.
- Descuenta del inventario los componentes correspondientes a la receta de cada pizza vendida.
- Registra los movimientos de inventario con referencia a la venta.
- Guarda el detalle de productos y precios utilizados.
- Actualiza el dashboard y las existencias.

Para este MVP, las pizzas se preparan a partir de su receta al venderse, descontando sus componentes. La masa y la salsa preparada son productos intermedios: si una pizza usa salsa preparada, descuenta la salsa preparada, no vuelvas a descontar sus ingredientes originales. Solo se descuentan las materias primas cuando se ejecuta una orden de producción para fabricar una preparación.

No permitas confirmar ventas si falta algún componente. Valida todo antes de guardar la operación para evitar ventas parciales o descuentos duplicados.

Permite consultar las ventas y eliminar únicamente ventas de prueba que no estén confirmadas. Las ventas confirmadas deben conservar trazabilidad; si necesitas revertir una venta, usa una acción de anulación que revierta sus movimientos una sola vez.

## 8. Movimientos de inventario

Crea un libro de movimientos con:
- Fecha y hora.
- Producto.
- Tipo de movimiento: Entrada, Salida o Ajuste.
- Cantidad.
- Stock anterior y posterior.
- Motivo.
- Documento de referencia: producción, venta o ajuste manual.

Permite filtrar por producto, tipo y rango de fechas. Los movimientos derivados de producción y ventas deben generarse automáticamente. Los ajustes manuales requieren confirmación y deben actualizar el stock y registrar su trazabilidad.

No permitas editar o eliminar movimientos generados por operaciones confirmadas directamente desde la tabla.

## 9. Reglas técnicas y funcionales

- Implementa todos los formularios y botones; no dejes acciones decorativas.
- Usa componentes reutilizables para tablas, formularios, drawers, confirmaciones y notificaciones.
- Calcula los costos de recetas a partir del costo unitario y las cantidades consumidas.
- Maneja correctamente unidades de medida y conversiones entre kg y g, y entre litros y ml, cuando corresponda.
- Ejecuta las operaciones de inventario de forma consistente: una venta o producción debe descontar y aumentar existencias una sola vez, o no aplicar ningún cambio si falla una validación.
- Mantén las relaciones entre productos, recetas, ventas, órdenes y movimientos.
- Usa identificadores únicos y validaciones de campos obligatorios.
- No implementes autenticación, roles ni permisos.
- No añadas integraciones externas que no sean necesarias para el MVP.
- Usa datos mock iniciales coherentes, pero calcula los indicadores desde los registros reales del aplicativo.
- Si el proyecto ya tiene una base de datos conectada, reutilízala. No reconstruyas ni dupliques infraestructura existente sin necesidad.

## 10. Resultado esperado

Entrega una aplicación navegable y funcional, no un mockup estático. Prioriza la calidad visual y que pueda demostrarse el flujo completo:

**Consultar inventario → crear o editar una receta → generar una orden → validar insumos → completar producción → registrar una venta → comprobar los descuentos de inventario y revisar los movimientos.**

Al finalizar, verifica el funcionamiento de las operaciones principales, los formularios, los filtros, la persistencia y los cálculos de existencias. Mantén una experiencia profesional, clara y consistente en todos los módulos.

