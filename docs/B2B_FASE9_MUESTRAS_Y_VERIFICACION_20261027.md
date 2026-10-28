# Muestras fiscales y avance B2B-09

Revisión local del 27/10/2026. Las siete muestras PDF y las tres fichas RUC
corresponden a la entrega anteriormente inventariada; no se interpretan como
una autorización de emisión, importación de historial o asignación de series.

## Emisores de las fichas

| RUC | Razón social según ficha aportada |
| --- | --- |
| 20175642341 | ESTACION DE SERVICIOS SAN JOSE S.A.C. |
| 20600979630 | MAX GAS SOCIEDAD ANONIMA CERRADA |
| 20614605864 | ESTACION DE SERVICIOS SAN JOSE ORIENTE S.A.C. |

Las fichas son capturas fechadas 05/10/2026; sus estados no se han consultado
en línea en esta revisión. La identidad fiscal y la distribución de sedes,
puntos y series deben confirmarse en el expediente de implantación. No se ha
insertado ni modificado ninguna empresa. El RUC del ejemplo de desarrollo del
proyecto no se utiliza para reemplazar los RUC de las fichas.

## Muestras

Los siete PDF aportados corresponden al RUC 20175642341 e incluyen 01, 03, 07
de factura, 07 de boleta, 08, 09 y 31. Son referencias de representación visual,
no originales XML ni prueba por sí solos de firma o aceptación. Ya se habían
utilizado para el renderer documentado en `FORMATOS_REFERENCIA_QA.md`.

Además existe una entrega posterior para la guía transportista 31 V250-00001973:
PDF, XML, CDR XML y ZIP del CDR. En la inspección estructural con entidades y
red deshabilitadas, el XML tiene raíz `DespatchAdvice` y el CDR
`ApplicationResponse`; ambos incluyen un elemento XMLDSig. El ID del documento
coincide con la referencia del CDR y el código leído es `0`. La presencia de
firma y esa coincidencia no validan criptográficamente la firma, la cadena de
confianza, la integridad del ZIP ni el estado de SUNAT. Esta comprobación no
incluyó una transmisión a SUNAT ni modifica datos del sistema.

Esta entrega de la guía amplía la documentación anterior de 05/10/2026, que
indicaba correctamente que en aquella entrega inicial sólo se habían recibido
PDF. Continúan sin aportarse, en esta entrega, los XML/CDR originales de las
otras seis muestras y la copia/exportación histórica completa.

## Trabajo técnico y límites

Se añadieron pruebas sintéticas de entrada, perfil, permisos, RUC/sede/serie y
versión exacta para el lector BETA del historial de notas. El conjunto con las
pruebas existentes de autoridad y evidencia aprobó **132 pruebas** sin fallos:
`output/qa/b2b-phase9-credit-history-boundaries-20261027.json`.
Estas pruebas cubren rechazos y aislamiento; no prueban el ciclo completo ni
conectan por sí mismas el lector a la fuente de versiones firmadas.

El cierre B2B-09 aún exige el circuito completo de evidencia para notas/lotes,
la recuperación integral y el ensayo de extremo a extremo. Los PDF, fichas y
XML/CDR de una guía ayudan al contraste de formatos y evidencia, pero no aportan
el historial completo ni habilitan automáticamente el piloto fiscal o el VPS.
