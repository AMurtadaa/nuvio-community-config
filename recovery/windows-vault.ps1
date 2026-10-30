param([ValidateSet('Seal','Open')][string]$Mode,[Parameter(Mandatory=$true)][string]$Path)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Security
[Console]::InputEncoding=[Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
if($Mode -eq 'Seal') {
  $plain=[Console]::In.ReadToEnd()
  if([string]::IsNullOrWhiteSpace($plain)){throw 'No backup supplied.'}
  $bytes=[Text.Encoding]::UTF8.GetBytes($plain)
  $protected=[Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect($bytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser))
  $envelope=@{format='nuvio-windows-vault';version=1;protection='Windows DPAPI CurrentUser';data=$protected}|ConvertTo-Json -Compress
  $temp=$Path+'.new'
  [IO.File]::WriteAllText($temp,$envelope,[Text.UTF8Encoding]::new($false))
  Move-Item -LiteralPath $temp -Destination $Path -Force
  [Array]::Clear($bytes,0,$bytes.Length)
} else {
  $e=Get-Content -LiteralPath $Path -Raw|ConvertFrom-Json
  if($e.format -ne 'nuvio-windows-vault' -or $e.version -ne 1){throw 'Unsupported vault.'}
  $bytes=[Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String($e.data),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
  try{[Console]::Out.Write([Text.Encoding]::UTF8.GetString($bytes))}
  finally{[Array]::Clear($bytes,0,$bytes.Length)}
}
