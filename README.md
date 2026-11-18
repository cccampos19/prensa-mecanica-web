# Diseño por componente

Calculadoras de diseño de elementos de máquinas con entradas, resultados y memoria independientes. Las opciones de material y los tamaños comerciales proceden de las tablas aportadas. Una dimensión calculada se identifica como tal.

## Abrir la página de esta rama

Abre `index.html` directamente en un navegador, con los archivos de la rama en la misma carpeta. Para probarla por HTTP, ejecuta `python3 -m http.server 8000` en la raíz y abre `http://localhost:8000`. Las ecuaciones y el PDF cargan sus bibliotecas en el navegador desde un CDN.

El menú permite pasar directamente a engranes rectos, banda plana, dimensionamiento de flecha, equilibrio, rodamientos de bolas, resorte de extensión o potencia. Cada pantalla trae un ejemplo editable y el botón **Ver ejercicio de la libreta**, con el caso resuelto y sus referencias.

En **Flecha**, coloca dos apoyos y las fuerzas puntuales en Y y Z, o captura el momento y el torque de la sección. Puedes reutilizar ambas fuerzas de una corrida de engranes o de banda de esta sesión, indicando posición y orientación de montaje. El torque se ingresa por separado. El diámetro inicial se elige de los agujeros de la tabla 11-2. La iteración conserva el acero de A-20 o A-21 y entrega el diámetro continuo comprobado. Un diseño que agota el intervalo de cálculo conserva la bitácora y permite volver a intentar con otro acero.

Al modificar los datos y calcular otra vez se agrega una corrida al historial de la sesión. Las exportaciones pueden incluir la corrida seleccionada o todas las corridas del componente, con sus datos, sustituciones y diagramas.

El caso integrado de la prensa está en la rama `main` y en [GitHub Pages](https://cccampos19.github.io/prensa-mecanica-web/).
