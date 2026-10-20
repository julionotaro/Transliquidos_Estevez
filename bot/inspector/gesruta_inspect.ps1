# gesruta_inspect.ps1  --  SOLO LECTURA.
# Enumera las ventanas y controles de Gesruta (arbol Win32 + arbol UIA).
# NO teclea en Gesruta, NO crea/graba nada, NO instala nada. Solo lee y escribe un .txt al lado.
$ErrorActionPreference = 'Continue'
$outFile = Join-Path $PSScriptRoot 'gesruta_tree.txt'

# --- IDENTIDAD DEL EJECUTABLE (para enganchar la app por control de escritorio) ---
$idFile = Join-Path $PSScriptRoot 'gesruta_identidad.txt'
$id = New-Object System.Text.StringBuilder
try {
    $procs = Get-Process -Name gesruta -ErrorAction Stop
    foreach($p in $procs){
        [void]$id.AppendLine("PID            : " + $p.Id)
        [void]$id.AppendLine("ProcessName    : " + $p.ProcessName)
        [void]$id.AppendLine("MainWindowTitle: " + $p.MainWindowTitle)
        try { [void]$id.AppendLine("ExePath        : " + $p.MainModule.FileName) } catch { [void]$id.AppendLine("ExePath        : (no accesible)") }
        try {
            $fv = $p.MainModule.FileVersionInfo
            [void]$id.AppendLine("ProductName    : " + $fv.ProductName)
            [void]$id.AppendLine("CompanyName    : " + $fv.CompanyName)
            [void]$id.AppendLine("FileDescription: " + $fv.FileDescription)
            [void]$id.AppendLine("OriginalFilename: " + $fv.OriginalFilename)
        } catch { [void]$id.AppendLine("FileVersionInfo: (no accesible)") }
        [void]$id.AppendLine("")
    }
    if($procs.Count -eq 0){ [void]$id.AppendLine("No se encontro el proceso 'gesruta'. Abri Gesruta y reintenta.") }
} catch { [void]$id.AppendLine("No se encontro el proceso 'gesruta' (" + $_.Exception.Message + "). Abri Gesruta y reintenta.") }
[System.IO.File]::WriteAllText($idFile, $id.ToString(), (New-Object System.Text.UTF8Encoding($false)))
Write-Host ("Escrito: " + $idFile)

$csharp = @'
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Diagnostics;
public static class GesInspect {
    delegate bool EnumProc(IntPtr h, IntPtr l);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb, IntPtr l);
    [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr h, EnumProc cb, IntPtr l);
    [DllImport("user32.dll", CharSet=CharSet.Auto)] static extern int GetClassName(IntPtr h, StringBuilder s, int m);
    [DllImport("user32.dll", CharSet=CharSet.Auto)] static extern int GetWindowText(IntPtr h, StringBuilder s, int m);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] static extern int GetWindowThreadProcessId(IntPtr h, out int pid);
    static string Cls(IntPtr h){ var s=new StringBuilder(256); GetClassName(h,s,256); return s.ToString(); }
    static string Txt(IntPtr h){ var s=new StringBuilder(512); GetWindowText(h,s,512); return s.ToString(); }
    static StringBuilder o;
    static HashSet<int> pids;
    static void Walk(IntPtr h, int d){
        string t=Txt(h); if(t.Length>55) t=t.Substring(0,55);
        o.AppendLine(new string(' ', d*3) + Cls(h).PadRight(26) + " | vis" + (IsWindowVisible(h)?"1":"0") + " | '" + t + "' | " + h.ToInt64());
        EnumChildWindows(h, delegate(IntPtr c, IntPtr l){ Walk(c, d+1); return true; }, IntPtr.Zero);
    }
    public static string Dump(string proc){
        o=new StringBuilder(); pids=new HashSet<int>();
        foreach(var p in Process.GetProcessesByName(proc)) pids.Add(p.Id);
        if(pids.Count==0) return "NO se encontro el proceso '"+proc+"'. Abri Gesruta y reintenta.";
        EnumWindows(delegate(IntPtr h, IntPtr l){
            int pid; GetWindowThreadProcessId(h, out pid);
            if(pids.Contains(pid) && IsWindowVisible(h)){
                o.AppendLine();
                o.AppendLine("################ TOP-LEVEL: '"+Txt(h)+"' ("+Cls(h)+") ################");
                Walk(h,0);
            }
            return true;
        }, IntPtr.Zero);
        return o.ToString();
    }
}
'@
Add-Type -TypeDefinition $csharp -Language CSharp

$r = New-Object System.Text.StringBuilder
[void]$r.AppendLine("===== GESRUTA - ARBOL WIN32 (clase | visible | texto | hwnd) =====")
[void]$r.AppendLine("(Esto es lo que ven pywinauto[win32] y AutoHotkey[ControlSend por ClassNN])")
[void]$r.AppendLine([GesInspect]::Dump('gesruta'))
[void]$r.AppendLine("")
[void]$r.AppendLine("===== GESRUTA - ARBOL UIA (ControlType | Name | Class | AutomationId | focusable) =====")
try {
    Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
    $A = [System.Windows.Automation.AutomationElement]
    $procId = (Get-Process -Name gesruta -ErrorAction Stop)[0].Id
    $cond = New-Object System.Windows.Automation.PropertyCondition($A::ProcessIdProperty, $procId)
    $wins = $A::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children, $cond)
    [void]$r.AppendLine("Ventanas UIA del proceso: " + $wins.Count)
    foreach($w in $wins){
        [void]$r.AppendLine("---- UIA WIN: '" + $w.Current.Name + "'  class=" + $w.Current.ClassName)
        $desc = $w.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
        [void]$r.AppendLine("     descendientes UIA: " + $desc.Count)
        $n = 0
        foreach($e in $desc){
            if($n -ge 400){ [void]$r.AppendLine("     ...(truncado a 400)"); break }
            $rc = $e.Current.BoundingRectangle
            $rcs = ("L{0} T{1} W{2} H{3}" -f [int]$rc.X, [int]$rc.Y, [int]$rc.Width, [int]$rc.Height)
            [void]$r.AppendLine(("     {0} | '{1}' | {2} | {3} | kbd={4} | {5}" -f $e.Current.ControlType.ProgrammaticName, $e.Current.Name, $e.Current.ClassName, $e.Current.AutomationId, $e.Current.IsKeyboardFocusable, $rcs))
            $n++
        }
    }
} catch { [void]$r.AppendLine("UIA error: " + $_.Exception.Message) }

[System.IO.File]::WriteAllText($outFile, $r.ToString(), (New-Object System.Text.UTF8Encoding($false)))
Write-Host ("Escrito: " + $outFile)
