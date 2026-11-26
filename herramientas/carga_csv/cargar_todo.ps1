# Pide la cadena de conexión de Supabase (no se muestra ni se guarda) y carga los scripts 328, 329 y 330 en orden.
# El resultado queda también en carga.log (en esta carpeta) para revisarlo.
Set-Location -Path $PSScriptRoot
Write-Host ''
Write-Host 'Pegue la cadena de conexion de Supabase (Connect > Session pooler, con la contrasena de la base) y presione Enter.'
Write-Host 'No se mostrara en pantalla ni se guardara.'
$seguro = Read-Host -AsSecureString 'Cadena de conexion'
$env:SUPABASE_DB_URL = [System.Net.NetworkCredential]::new('', $seguro).Password
if (-not $env:SUPABASE_DB_URL.StartsWith('postgres')) { Write-Host 'La cadena debe empezar con postgresql://'; exit 1 }
'' | Out-File -FilePath carga.log -Encoding utf8
foreach ($n in @('328', '329', '330')) {
  node cargar.js $n 2>&1 | Tee-Object -FilePath carga.log -Append
  if ($LASTEXITCODE -ne 0) { Write-Host "Se detuvo en el script $n."; break }
}
$env:SUPABASE_DB_URL = $null
Write-Host 'FIN DE LA CARGA'
'FIN DE LA CARGA' | Out-File -FilePath carga.log -Append -Encoding utf8
