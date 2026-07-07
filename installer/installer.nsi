!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"

!ifndef SOURCE
  !define SOURCE "publish"
!endif

Name "AgnesAI Studio"
OutFile "AgnesAIStudio-Setup.exe"
InstallDir "$PROGRAMFILES64\AgnesAIStudio"
RequestExecutionLevel admin

!define MUI_ABORTWARNING
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "German"

Var WebView2Installed

Function EnsureWebView2
  StrCpy $WebView2Installed "0"
  ReadRegStr $0 HKLM "SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-9686A842D87C}" "pv"
  ${If} $0 != ""
    StrCpy $WebView2Installed "1"
  ${EndIf}
  ReadRegStr $0 HKLM "SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-9686A842D87C}" "pv"
  ${If} $0 != ""
    StrCpy $WebView2Installed "1"
  ${EndIf}
FunctionEnd

Section "Install"
  SetOutPath "$INSTDIR"
  File /r "${SOURCE}\*"

  Call EnsureWebView2
  ${If} $WebView2Installed == "0"
    IfFileExists "$INSTDIR\MicrosoftEdgeWebview2Setup.exe" 0 +2
      ExecWait '"$INSTDIR\MicrosoftEdgeWebview2Setup.exe" /silent /install' $0
  ${EndIf}

  CreateDirectory "$SMPROGRAMS\AgnesAI Studio"
  CreateShortcut "$SMPROGRAMS\AgnesAI Studio\AgnesAI Studio.lnk" "$INSTDIR\AgnesAIStudio.exe"
  CreateShortcut "$DESKTOP\AgnesAI Studio.lnk" "$INSTDIR\AgnesAIStudio.exe"

  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\AgnesAIStudio" "DisplayName" "AgnesAI Studio"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\AgnesAIStudio" "UninstallString" "$\"$INSTDIR\Uninstall.exe$\""
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\AgnesAIStudio" "DisplayIcon" "$\"$INSTDIR\AgnesAIStudio.exe$\""
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\AgnesAIStudio" "Publisher" "AgnesAI Studio"
SectionEnd

Section "Uninstall"
  Delete "$SMPROGRAMS\AgnesAI Studio\AgnesAI Studio.lnk"
  Delete "$DESKTOP\AgnesAI Studio.lnk"
  RMDir "$SMPROGRAMS\AgnesAI Studio"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\AgnesAIStudio"
SectionEnd
