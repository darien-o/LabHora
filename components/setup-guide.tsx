"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, AlertTriangle, ExternalLink } from "lucide-react"

export function SetupGuide() {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-6 w-6 text-green-600" />
            Guía de Configuración - Google Sheets API
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Paso 1 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline">Paso 1</Badge>
              <h3 className="font-semibold">Crear Proyecto en Google Cloud Console</h3>
            </div>
            <div className="pl-4 space-y-2">
              <p className="text-sm text-gray-600">
                1. Ve a{" "}
                <a
                  href="https://console.cloud.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline inline-flex items-center gap-1"
                >
                  Google Cloud Console <ExternalLink className="h-3 w-3" />
                </a>
              </p>
              <p className="text-sm text-gray-600">2. Crea un nuevo proyecto o selecciona uno existente</p>
              <p className="text-sm text-gray-600">3. Habilita la API de Google Sheets</p>
            </div>
          </div>

          {/* Paso 2 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline">Paso 2</Badge>
              <h3 className="font-semibold">Crear Cuenta de Servicio</h3>
            </div>
            <div className="pl-4 space-y-2">
              <p className="text-sm text-gray-600">1. Ve a "IAM y administración" → "Cuentas de servicio"</p>
              <p className="text-sm text-gray-600">2. Haz clic en "Crear cuenta de servicio"</p>
              <p className="text-sm text-gray-600">3. Completa los detalles y crea la cuenta</p>
              <p className="text-sm text-gray-600">4. Genera una clave JSON y descárgala</p>
            </div>
          </div>

          {/* Paso 3 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline">Paso 3</Badge>
              <h3 className="font-semibold">Configurar Google Sheets</h3>
            </div>
            <div className="pl-4 space-y-2">
              <p className="text-sm text-gray-600">1. Crea una nueva hoja de cálculo en Google Sheets</p>
              <p className="text-sm text-gray-600">2. Crea dos pestañas:</p>
              <div className="ml-4 space-y-1">
                <p className="text-xs text-gray-500">
                  • <strong>"Cuidadores"</strong>: Columna A con los nombres
                </p>
                <p className="text-xs text-gray-500">
                  • <strong>"Registro"</strong>: A: Fecha-Hora Entrada, B: Fecha-Hora Salida, C: Nombre, D: Tiempo Total
                </p>
              </div>
              <p className="text-sm text-gray-600">
                3. Comparte la hoja con el email de la cuenta de servicio (con permisos de editor)
              </p>
            </div>
          </div>

          {/* Paso 4 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline">Paso 4</Badge>
              <h3 className="font-semibold">Variables de Entorno</h3>
            </div>
            <div className="pl-4 space-y-2">
              <p className="text-sm text-gray-600">Configura estas variables en tu archivo .env:</p>
              <div className="bg-gray-100 p-3 rounded-md font-mono text-xs">
                <p>GOOGLE_SHEET_ID=tu_id_de_hoja_de_calculo</p>
                <p>GOOGLE_CLIENT_EMAIL=tu_email@proyecto.iam.gserviceaccount.com</p>
                <p>GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\ntu_clave_privada\n-----END PRIVATE KEY-----\n"</p>
              </div>
            </div>
          </div>

          {/* Errores Comunes */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Errores Comunes:</strong>
              <ul className="mt-2 space-y-1 text-sm">
                <li>
                  • <strong>Permission denied:</strong> La hoja no está compartida con la cuenta de servicio
                </li>
                <li>
                  • <strong>Spreadsheet not found:</strong> El ID de la hoja es incorrecto
                </li>
                <li>
                  • <strong>Invalid credentials:</strong> Las credenciales están mal configuradas
                </li>
              </ul>
            </AlertDescription>
          </Alert>

          {/* Estructura de Ejemplo */}
          <div className="space-y-3">
            <h3 className="font-semibold">Estructura de Ejemplo</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium text-sm mb-2">Pestaña "Cuidadores"</h4>
                <div className="bg-gray-50 p-3 rounded border text-xs">
                  <div className="grid grid-cols-1 gap-1">
                    <div className="font-semibold">A</div>
                    <div>María García</div>
                    <div>Juan Pérez</div>
                    <div>Ana López</div>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="font-medium text-sm mb-2">Pestaña "Registro"</h4>
                <div className="bg-gray-50 p-3 rounded border text-xs">
                  <div className="grid grid-cols-4 gap-2">
                    <div className="font-semibold">A</div>
                    <div className="font-semibold">B</div>
                    <div className="font-semibold">C</div>
                    <div className="font-semibold">D</div>
                    <div>Fecha-Hora IN</div>
                    <div>Fecha-Hora OUT</div>
                    <div>Nombre</div>
                    <div>Tiempo Total</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
