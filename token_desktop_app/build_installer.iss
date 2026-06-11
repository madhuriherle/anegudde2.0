; Inno Setup Script for Token Desktop App
; This script packages the Flutter Windows Release build into a single installer

[Setup]
AppId={{8A8C9E4B-1234-5678-9ABC-DEF012345678}
AppName=Token Desktop App
AppVersion=1.0
AppPublisher=Anegudde Temple
DefaultDirName={autopf}\Token Desktop App
DisableProgramGroupPage=yes
; Where the final setup.exe will be saved
OutputDir=.\Output
; The name of the final setup.exe
OutputBaseFilename=TokenApp_Setup
Compression=lzma
SolidCompression=yes
WizardStyle=modern

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
; Grab the main executable
Source: "build\windows\x64\runner\Release\token_desktop_app.exe"; DestDir: "{app}"; Flags: ignoreversion
; Grab ALL other required DLLs, data folders, and files in the Release folder
Source: "build\windows\x64\runner\Release\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
; NOTE: Don't use "Flags: ignoreversion" on any shared system files

[Icons]
Name: "{autoprograms}\Token Desktop App"; Filename: "{app}\token_desktop_app.exe"
Name: "{autodesktop}\Token Desktop App"; Filename: "{app}\token_desktop_app.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\token_desktop_app.exe"; Description: "{cm:LaunchProgram,Token Desktop App}"; Flags: nowait postinstall skipifsilent
