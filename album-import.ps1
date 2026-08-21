[CmdletBinding()]
param(
    [Parameter(Position = 0, Mandatory = $true)]
    [ValidateSet('doctor','acquire','dry-run','status','review','prepare','promote','recover','help')]
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
if ($VerboseOutput) { $arguments += '--verbose' }

& node @arguments
exit $LASTEXITCODE
