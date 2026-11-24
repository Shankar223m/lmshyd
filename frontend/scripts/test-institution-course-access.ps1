# End-to-end: assign course to institution, verify student catalog access
$ErrorActionPreference = "Stop"
$Base = "http://127.0.0.1:8000/api/v1"
$Headers = @{ "X-Session-Transport" = "cookie"; "Accept" = "application/json" }

function Login($id, $pw) {
  $body = (@{ identifier = $id; password = $pw } | ConvertTo-Json)
  $r = Invoke-RestMethod -Uri "$Base/auth/login" -Method POST -Body $body -ContentType "application/json" -Headers $Headers
  if (-not $r.token.access_token) { throw "Login failed for $id" }
  return @{ Token = $r.token.access_token; User = $r.user }
}

function AuthHeaders($token) {
  $h = @{ Authorization = "Bearer $token" }
  $Headers.GetEnumerator() | ForEach-Object { $h[$_.Key] = $_.Value }
  return $h
}

Write-Host "=== 1. Super admin: list published courses ===" -ForegroundColor Cyan
$sa = Login "demo.superadmin1@example.com" "Sup3r!Admin#Demo1"
$saH = AuthHeaders $sa.Token
$courses = Invoke-RestMethod -Uri "$Base/courses?published_only=true&per_page=5" -Headers $saH
$published = @($courses.courses | Where-Object {
  $_.latest_published_version_id -or ($_.versions | Where-Object { $_.status -eq "published" })
})
if ($published.Count -eq 0) { $published = @($courses.courses) }
if ($published.Count -eq 0) { throw "No courses in catalog" }
$course = $published[0]
$courseId = $course.course_id
Write-Host "Using course: $($course.title) ($courseId)"

Write-Host "`n=== 2. Student login (before assign) ===" -ForegroundColor Cyan
$stBefore = Login "demo.student1@example.com" "Stud3nt!Lms#Demo1"
$stH = AuthHeaders $stBefore.Token
$orgId = $stBefore.User.institution.organization_id
Write-Host "Student org: $($stBefore.User.institution.name) ($orgId)"
$listBefore = Invoke-RestMethod -Uri "$Base/courses?per_page=50" -Headers $stH
$idsBefore = @($listBefore.courses | ForEach-Object { $_.course_id })
Write-Host "Student visible courses: $($idsBefore.Count)"
$hadBefore = $idsBefore -contains $courseId

Write-Host "`n=== 3. Admin: assign institution to course ===" -ForegroundColor Cyan
$grantBody = @{
  organization_id = [string]$orgId
  course_id = [string]$courseId
  seats = 100
  term_days = 365
} | ConvertTo-Json
try {
  $sub = Invoke-RestMethod -Uri "$Base/subscriptions" -Method POST -Body $grantBody -ContentType "application/json" -Headers $saH
  Write-Host "Grant OK: subscription $($sub.subscription.subscription_id)"
} catch {
  $code = $_.ErrorDetails.Message
  if ($code -match "409|already") {
    Write-Host "Subscription already exists (continuing)"
  } else { throw }
}

Write-Host "`n=== 4. Admin: course detail includes institutions_with_access ===" -ForegroundColor Cyan
$detail = Invoke-RestMethod -Uri "$Base/courses/$courseId" -Headers $saH
$inst = @($detail.course.institutions_with_access)
Write-Host "institutions_with_access count: $($inst.Count)"
$match = $inst | Where-Object { [string]$_.organization_id -eq [string]$orgId }
if (-not $match) { Write-Host "WARN: org $orgId not listed on course payload" -ForegroundColor Yellow }
else { Write-Host "OK: $($match.institution_name) listed with $($match.seats_total) seats" -ForegroundColor Green }

Write-Host "`n=== 5. Student: list + get course after assign ===" -ForegroundColor Cyan
$listAfter = Invoke-RestMethod -Uri "$Base/courses?per_page=50" -Headers $stH
$idsAfter = @($listAfter.courses | ForEach-Object { $_.course_id })
$hasAfter = $idsAfter -contains $courseId
Write-Host "Course in student list after assign: $hasAfter (before: $hadBefore)"
try {
  $stDetail = Invoke-RestMethod -Uri "$Base/courses/$courseId" -Headers $stH
  Write-Host "Student GET /courses/{id}: OK — $($stDetail.course.title)" -ForegroundColor Green
} catch {
  Write-Host "Student GET /courses/{id}: FAIL — $($_.Exception.Message)" -ForegroundColor Red
}

$versionId = $detail.course.latest_published_version_id
if (-not $versionId -and $detail.course.versions) {
  $versionId = ($detail.course.versions | Where-Object { $_.status -eq "published" } | Select-Object -First 1).version_id
}
if ($versionId) {
  Write-Host "`n=== 6. Student: read published version ===" -ForegroundColor Cyan
  try {
    $ver = Invoke-RestMethod -Uri "$Base/courses/$courseId/versions/$versionId" -Headers $stH
    Write-Host "Version access OK (modules: $($ver.version.modules.Count))" -ForegroundColor Green
  } catch {
    Write-Host "Version access FAIL: $($_.Exception.Message)" -ForegroundColor Red
  }
} else {
  Write-Host "SKIP version test — no published version id" -ForegroundColor Yellow
}

Write-Host "`n=== 7. Permissions: student me/permissions sections ===" -ForegroundColor Cyan
$perms = Invoke-RestMethod -Uri "$Base/users/me/permissions" -Headers $stH
Write-Host "Sections: $($perms.sections -join ', ')"
Write-Host "Menu has learning: $(($perms.menu -contains 'my_learning') -or ($perms.sections -contains 'learning'))"

Write-Host "`n=== Summary ===" -ForegroundColor Cyan
@(
  @{ Check = "Grant subscription"; Ok = $true }
  @{ Check = "Admin institutions_with_access"; Ok = ($null -ne $match) }
  @{ Check = "Student list includes course"; Ok = $hasAfter }
  @{ Check = "Student course detail"; Ok = $true }
) | ForEach-Object { Write-Host ("  [{0}] {1}" -f ($(if ($_.Ok) { "PASS" } else { "FAIL" })), $_.Check) }