# One-time setup: registers start-on-boot.ps1 to run automatically at Windows
# login. Run this once, as the user who should own the task -- elevated
# PowerShell is not required.
#
# Usage: paste into a normal PowerShell window, or run:
#   powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\shimi\repositories\productivity_app\scripts\register-start-on-boot.ps1"

$action = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument '-NoProfile -ExecutionPolicy Bypass -File "C:\Users\shimi\repositories\productivity_app\scripts\start-on-boot.ps1"'
$trigger = New-ScheduledTaskTrigger -AtLogOn
Register-ScheduledTask -TaskName "ProductivityAppStartOnBoot" -Action $action -Trigger $trigger -RunLevel Limited

# To remove it later:
#   Unregister-ScheduledTask -TaskName "ProductivityAppStartOnBoot" -Confirm:$false
