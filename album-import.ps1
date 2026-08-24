[CmdletBinding()]
param(
    [Parameter(Position = 0, Mandatory = $true)]
    [ValidateSet('doctor','discover','acquire','finalize-acquisition','taxonomy','dry-run','status','review','prepare','promote','recover','help')]
    [string]$Command,
    [Alias('Input')]
    [string]$InputPath,
    [string]$Batch,
    [string]$Apply,
    [string]$Transaction,
    [string]$CandidateFingerprint,
    [switch]$Json,
    [switch]$Refresh,
    [ValidateRange(1,4)]
    [int]$Concurrency,
    [ValidateRange(1,2147483647)]
    [int]$Limit,
    [ValidateRange(1,2147483647)]
    [int]$ArtistLimit,
    [string]$Types,
    [switch]$FromCurrentArtists,
    [switch]$VerboseOutput
)

$operator = Join-Path $PSScriptRoot 'scripts\catalog\content-pipeline\operator.mjs'
$arguments = @($operator, $Command)
if ($InputPath) { $arguments += @('--input', $InputPath) }
if ($Batch) { $arguments += @('--batch', $Batch) }
if ($Apply) { $arguments += @('--apply', $Apply) }
if ($Transaction) { $arguments += @('--transaction', $Transaction) }
if ($CandidateFingerprint) { $arguments += @('--candidate-fingerprint', $CandidateFingerprint) }
if ($Json) { $arguments += '--json' }
if ($Refresh) { $arguments += '--refresh' }
if ($PSBoundParameters.ContainsKey('Concurrency')) { $arguments += @('--concurrency', [string]$Concurrency) }
if ($PSBoundParameters.ContainsKey('Limit')) { $arguments += @('--limit', [string]$Limit) }
if ($PSBoundParameters.ContainsKey('ArtistLimit')) { $arguments += @('--artist-limit', [string]$ArtistLimit) }
if ($Types) { $arguments += @('--types', $Types) }
if ($FromCurrentArtists) { $arguments += '--from-current-artists' }
if ($VerboseOutput) { $arguments += '--verbose' }

& node @arguments
exit $LASTEXITCODE
