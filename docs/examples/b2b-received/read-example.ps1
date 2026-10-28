# Example only. Dot-sourcing defines a function; it sends no requests.
# TI supplies existing authorized IDs, PEM paths and secure Bearer B2B.
# No PWA session, SOL password, fiscal P12, environment variables or production.
function Get-FactuEzReceivedPageExample {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][uri]$Origin,
        [Parameter(Mandatory)][string]$CaPem,
        [Parameter(Mandatory)][string]$ClientCertPem,
        [Parameter(Mandatory)][string]$ClientKeyPem,
        # curl uses an SPKI/public-key pin, not the SDK's certificate DER hash.
        [Parameter(Mandatory)][string]$ServerSpkiPin,
        [Parameter(Mandatory)][System.Security.SecureString]$Bearer,
        [ValidateSet('SERVICE','USER')][string]$ActorKind = 'SERVICE',
        [Parameter(Mandatory)][ValidateRange(1,2147483647)][int]$CompanyId,
        [Parameter(Mandatory)][ValidatePattern('^\d{11}$')][string]$RecipientRuc,
        [Parameter(Mandatory)][guid]$BranchId,
        [Parameter(Mandatory)][ValidatePattern('^\d{4}-\d{2}-\d{2}$')][string]$From,
        [Parameter(Mandatory)][ValidatePattern('^\d{4}-\d{2}-\d{2}$')][string]$To
    )
    if ($Origin.Scheme -ne 'https' -or $Origin.UserInfo -or $Origin.AbsolutePath -ne '/' -or $Origin.Query -or $Origin.Fragment) {
        throw 'HTTPS_ORIGIN_ONLY'
    }
    if ($ServerSpkiPin -notmatch '^sha256//[A-Za-z0-9+/]{43}=$') { throw 'EXPLICIT_TI_APPROVED_SPKI_PIN_REQUIRED' }
    $fromDate = [datetime]::ParseExact($From, 'yyyy-MM-dd', [cultureinfo]::InvariantCulture)
    $toDate = [datetime]::ParseExact($To, 'yyyy-MM-dd', [cultureinfo]::InvariantCulture)
    if ($toDate -lt $fromDate -or ($toDate - $fromDate).TotalDays -gt 366) { throw 'INVALID_DATE_RANGE' }
    foreach ($pemPath in @($CaPem, $ClientCertPem, $ClientKeyPem)) {
        if (-not (Test-Path -LiteralPath $pemPath -PathType Leaf)) { throw 'LOCAL_PEM_FILE_REQUIRED' }
    }
    $pointer = [IntPtr]::Zero
    $token = $null
    $config = $null
    $response = $null
    try {
        $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Bearer)
        $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
        if ($token -notmatch '^[-A-Za-z0-9._~]{1,8192}$') { throw 'INVALID_TOKEN' }
        # stdin config prevents Bearer from appearing in process command-line arguments.
        # Do not enable PowerShell transcription/debug or curl --verbose/--trace.
        $config = "header = `"Authorization: Bearer $token`"`nheader = `"X-FactuEz-Actor-Kind: $ActorKind`"`n"
        $url = $Origin.GetLeftPart([UriPartial]::Authority) + '/b2b/v1/received-documents?environment=BETA' +
            "&companyId=$CompanyId&recipientRuc=$RecipientRuc&branchId=$BranchId&from=$From&to=$To&limit=25"
        $response = $config | & curl.exe --config - --silent --show-error --fail `
            --proto '=https' --tlsv1.2 --max-redirs 0 --connect-timeout 10 --max-time 30 `
            --max-filesize 16777216 --cacert $CaPem --cert $ClientCertPem --key $ClientKeyPem `
            --pinnedpubkey $ServerSpkiPin --header 'Accept: application/json' --header 'Accept-Encoding: identity' `
            --url $url
        if ($LASTEXITCODE -ne 0) { throw 'B2B_READ_FAILED' }
        # Parse privately; do not echo the body or write it into a shared transcript.
        $page = ($response -join "`n") | ConvertFrom-Json
        if ($page.schemaVersion -ne 'factuez.b2b.received-page.v1' -or $page.scope.environment -ne 'BETA' -or
            $page.scope.companyId -ne $CompanyId -or $page.scope.recipientRuc -ne $RecipientRuc -or
            $page.scope.branchId -ne $BranchId.ToString() -or $page.fiscalAcceptance -ne 'NOT_VERIFIED') {
            throw 'INVALID_B2B_REPLY'
        }
        # Return to the caller, which controls private processing. No automatic pagination/retry.
        return $page
    }
    finally {
        if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
        # .NET strings cannot be reliably zeroed; limit lifetime and use a dedicated private process.
        $token = $null
        $config = $null
        $response = $null
    }
}

# Invocation is intentionally not executed. Use the SDK for strict response/schema,
# original-byte checksum/manifest verification and artifact downloads.
# TI must supply paths, endpoint, authorized IDs and a pin through a trusted channel.
# $secureBearer = Read-Host 'Bearer B2B temporal (no clave SOL)' -AsSecureString
# Get-FactuEzReceivedPageExample -Origin 'https://factuez.example.invalid' ...
