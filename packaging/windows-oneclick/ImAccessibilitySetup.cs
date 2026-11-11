using System;
using System.IO;
using System.Linq;
using System.Text;
using System.Drawing;
using System.Diagnostics;
using System.Security.Cryptography;
using System.Reflection;
using System.Collections;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.IO.Compression;
using System.Windows.Forms;
using System.Web.Script.Serialization;
using Microsoft.Win32;

namespace ImAccessibilityInstaller {
 static partial class InstallCore {
  const string PayloadResource="ImAccessibilityInstallerPayload";
  public const string Version="v0.3.21-independent-audio-guard-private-preview";
#if REBUILT_FFMPEG_PRIVATE
  public const string BuildId="recovery2.4.5-update-20261111";
#endif
  public static string LocalData {
   get {string e=Environment.GetEnvironmentVariable("LOCALAPPDATA");
    return String.IsNullOrWhiteSpace(e)?Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData):e;}
  }
  public static string Destination {get{return Path.GetFullPath(Path.Combine(LocalData,"Programs","ImAccessibility"));}}
  static string Hex(byte[] b){return BitConverter.ToString(b).Replace("-","").ToLowerInvariant();}
  static byte[] GetBytes(Stream input){
   using(var m=new MemoryStream()){input.CopyTo(m);return m.ToArray();}
  }
  static Dictionary<string,object> Manifest(ZipArchive archive){
   var entry=archive.GetEntry("installer-manifest.json");
   if(entry==null)throw new Exception("Installer manifest not found.");
   using(var stream=entry.Open()){
    var json=Encoding.UTF8.GetString(GetBytes(stream));
    var serializer=new JavaScriptSerializer();serializer.MaxJsonLength=2000000;
    var map=serializer.Deserialize<Dictionary<string,object>>(json);
    if(Convert.ToString(map["product"])!="ImAccessibility"||
       Convert.ToString(map["version"])!=Version)
     throw new Exception("Unrecognised product/version in signed-internal package.");
#if REBUILT_FFMPEG_PRIVATE
    if(!map.ContainsKey("buildId")||Convert.ToString(map["buildId"])!=BuildId)
     throw new Exception("The package does not match this private preview build.");
#endif
    return map;
   }
  }
  static ArrayList Listed(Dictionary<string,object> map){
   var entries=map["files"] as ArrayList;
   if(entries==null||entries.Count<80||entries.Count>900)throw new Exception("Manifest has an invalid number of files.");
   return entries;
  }
  static List<Dictionary<string,object>> Entries(Dictionary<string,object> map){
   var result=new List<Dictionary<string,object>>();
   foreach(object obj in Listed(map)){
    var d=obj as Dictionary<string,object>;
    if(d==null)throw new Exception("Malformed file inventory.");
    result.Add(d);
   }
   return result;
  }
  static void SafeEntry(string root,string rel,out string dest){
   if(String.IsNullOrWhiteSpace(rel)||Path.IsPathRooted(rel)||
      rel.Contains("\\")||rel.Contains("..")||rel.Contains(":")||
      rel.StartsWith("/")||rel.IndexOfAny(Path.GetInvalidPathChars())>=0)
    throw new Exception("Unsafe file path in package: "+rel);
   dest=Path.GetFullPath(Path.Combine(root,rel.Replace('/',Path.DirectorySeparatorChar)));
   if(!dest.StartsWith(root+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase))
    throw new Exception("File path escapes the installation.");
  }
  static string Hash(string file){
   using(var s=File.OpenRead(file))using(var sha=SHA256.Create())return Hex(sha.ComputeHash(s));
  }
  static void CheckDirectory(string path){
   if(Directory.Exists(path)&&((File.GetAttributes(path)&FileAttributes.ReparsePoint)!=0))
    throw new Exception("Windows directory links are not allowed in install location.");
  }
  public static string ExistingApplication(){
   string root=Destination;
   if(InstallerAction()!="open")throw new Exception("An older preview is installed. Choose Update to keep your TV settings and install the new version.");
   var map=ReadInstalledManifest(root);
   VerifyInstalled(root,map);
   VerifySamePackage(map);
   return Path.Combine(root,"ImAccessibility.exe");
  }
  public static string Install(bool test, Action<string> progress){
   using(ImAccessibilitySafety.InstallSafety.AcquireInstallLock(Destination))return InstallNew(test,progress);
  }
  static string InstallNew(bool test, Action<string> progress){
   string root=Destination;
   if(test)ImAccessibilitySafety.InstallSafety.CheckTestProfile(LocalData);
   ImAccessibilitySafety.InstallSafety.NoLinks(root);
   if(Directory.Exists(root)||File.Exists(root))
    throw new Exception("I'm-accessibility is already installed at "+root+". No overwrite was performed.");
   string parent=Path.GetDirectoryName(root);
   string profile=LocalData;
   if(!Directory.Exists(profile))throw new Exception("Windows user profile folder is missing.");
   CheckDirectory(profile);CheckDirectory(Path.GetDirectoryName(parent));CheckDirectory(parent);
   Directory.CreateDirectory(parent);
   string stage=Path.Combine(parent,".ImAccessibility-install-stage-"+Guid.NewGuid().ToString("N"));
   Directory.CreateDirectory(stage);
   bool promoted=false;
   try{
    ExtractPackage(stage,progress);
    progress("Moving the verified app into your Windows profile.");
    if(Directory.Exists(root))throw new Exception("Installation target appeared while extracting; no overwrite.");
    Directory.Move(stage,root);promoted=true;
    if(!test){
     try{CreateShortcuts(root);progress("Added Windows Start Menu / desktop shortcuts.");}
     catch(Exception ex){progress("Shortcut setup needs manual action: "+ex.Message);}
     try{RegisterUninstaller(root);}
     catch(Exception ex){progress("Windows uninstall registration incomplete: "+ex.Message);}
    }
    return root;
   }finally{
    if(!promoted&&Directory.Exists(stage))Directory.Delete(stage,true);
   }
  }
  static void ExtractPackage(string stage,Action<string> progress){
    progress("Reading the bundled application and offline runtime.");
    using(var stream=Assembly.GetExecutingAssembly().GetManifestResourceStream(PayloadResource)){
     if(stream==null)throw new Exception("Installer payload resource is missing.");
     using(var archive=new ZipArchive(stream,ZipArchiveMode.Read,false)){
      var manifest=Manifest(archive);
      var entries=Entries(manifest);
      var allNames=new HashSet<string>(StringComparer.OrdinalIgnoreCase);
      foreach(var e in entries){
       string rel=Convert.ToString(e["path"]);
       string ignored;SafeEntry(stage,rel,out ignored);
       if(!allNames.Add(rel))throw new Exception("Duplicate installer file.");
      }
      int counted=archive.Entries.Count(e=>e.Name.Length>0);
      if(counted!=entries.Count+1)throw new Exception("Installer archive has unexpected extra files.");
      int i=0;
      foreach(var e in entries){
       string rel=Convert.ToString(e["path"]),dest;
       SafeEntry(stage,rel,out dest);
       string wanted=Convert.ToString(e["sha256"]).ToLowerInvariant();
       long size=Convert.ToInt64(e["bytes"]);
       if(wanted.Length!=64||size<0||size>330000000)throw new Exception("Invalid hash or file size.");
       var zipped=archive.GetEntry(rel)??archive.GetEntry(rel.Replace('/','\\'));
       if(zipped==null||zipped.Length!=size)throw new Exception("Missing or invalid package file: "+rel);
       Directory.CreateDirectory(Path.GetDirectoryName(dest));
       using(var from=zipped.Open())using(var to=new FileStream(dest,FileMode.CreateNew,FileAccess.Write,FileShare.None))
        from.CopyTo(to);
       if(new FileInfo(dest).Length!=size||Hash(dest)!=wanted)
        throw new Exception("Package checksum verification failed: "+rel);
       i++;
       if(i==1||i%12==0||i==entries.Count)progress("Verified "+i+" / "+entries.Count+" application files.");
      }
      string receipt=Path.Combine(stage,"installer-manifest.json");
      using(var source=archive.GetEntry("installer-manifest.json").Open())
      using(var outStream=new FileStream(receipt,FileMode.CreateNew,FileAccess.Write,FileShare.None))
       source.CopyTo(outStream);
      foreach(string required in new[]{"ImAccessibility.exe","ImAccessibility-Uninstall.exe","gui-config-bridge.cjs","TVFinder.cjs",
         "Runtime/node.exe","Runtime/ffmpeg.exe","tv-reliability-v0.5/viewer/web/fast-video.js"})
       if(!allNames.Contains(required))throw new Exception("Essential application component is missing: "+required);
     }
    }
  }
  static void Shortcut(string filename,string target,string root){
   // A private acceptance build must never replace the restored owner's link.
   if(File.Exists(filename))filename=Path.Combine(Path.GetDirectoryName(filename),"I'm-accessibility (Private Preview).lnk");
   string parent=Path.GetDirectoryName(filename);
   if(File.Exists(filename))throw new Exception("An existing shortcut was preserved: "+filename);
   if(!Directory.Exists(parent))Directory.CreateDirectory(parent);
   var type=Type.GetTypeFromProgID("WScript.Shell");
   if(type==null)throw new Exception("Windows shortcut service unavailable.");
   dynamic shell=Activator.CreateInstance(type);
   dynamic link=shell.CreateShortcut(filename);
   link.TargetPath=target;link.WorkingDirectory=root;link.Description="I'm-accessibility LG desktop sharing";
   link.Save();
  }
  static void CreateShortcuts(string root){
   string exe=Path.Combine(root,"ImAccessibility.exe");
   Shortcut(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs),"I'm-accessibility.lnk"),exe,root);
   Shortcut(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),"I'm-accessibility.lnk"),exe,root);
  }
  static void RegisterUninstaller(string root){
   using(var existing=Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\ImAccessibility")){
    if(existing!=null&&!String.Equals(Convert.ToString(existing.GetValue("InstallLocation")),root,StringComparison.OrdinalIgnoreCase))
     throw new Exception("Another installation's Windows uninstall entry was preserved.");
   }
   using(var key=Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\ImAccessibility")){
    if(key==null)throw new Exception("Windows uninstall registry unavailable.");
    key.SetValue("DisplayName","I'm-accessibility (Private Preview)");
    key.SetValue("DisplayVersion","0.3.21");
    key.SetValue("Publisher","I'm-accessibility project");
    key.SetValue("InstallLocation",root);
    key.SetValue("UninstallString","\""+Path.Combine(root,"ImAccessibility-Uninstall.exe")+"\"");
    key.SetValue("NoModify",1,RegistryValueKind.DWord);
    key.SetValue("NoRepair",1,RegistryValueKind.DWord);
   }
  }
  public static string VerifyArchive(){
   using(var stream=Assembly.GetExecutingAssembly().GetManifestResourceStream(PayloadResource)){
    if(stream==null)throw new Exception("Payload not embedded.");
    using(var zip=new ZipArchive(stream,ZipArchiveMode.Read,false)){
     var manifest=Manifest(zip);var entries=Entries(manifest);
     int count=0;long bytes=0;
     foreach(var e in entries){
      string rel=Convert.ToString(e["path"]);
      if(zip.GetEntry(rel)==null&&zip.GetEntry(rel.Replace('/','\\'))==null)throw new Exception("Missing item "+rel);
      var z=zip.GetEntry(rel)??zip.GetEntry(rel.Replace('/','\\'));
      if(z.Length!=Convert.ToInt64(e["bytes"]))throw new Exception("Size differs "+rel);
      using(var reader=z.Open())using(var sha=SHA256.Create()){
       string digest=Hex(sha.ComputeHash(reader));
       if(digest!=Convert.ToString(e["sha256"]).ToLowerInvariant())
        throw new Exception("Hash differs "+rel);
      }
      count++;bytes+=z.Length;
     }
     if(zip.Entries.Count(x=>x.Name.Length>0)!=count+1)throw new Exception("Unexpected ZIP entries.");
     return "VALID version="+Version+" files="+count+" unpackedBytes="+bytes;
    }
   }
  }
 }
 sealed class InstallerWindow:Form {
  Button install=new Button();CheckBox open=new CheckBox();TextBox output=new TextBox();
  Button close=new Button();bool busy=false;
  Label destination=new Label();
  public InstallerWindow(){
#if REBUILT_FFMPEG_PRIVATE
   Text="Install or update I'm-accessibility - Recovery 2.4.5 Private Preview";
#else
   Text="Install I'm-accessibility - Recovery 2.2 Private Preview";
#endif
   BackColor=Color.FromArgb(247,249,251);
   ForeColor=Color.FromArgb(25,44,59);Font=new Font("Segoe UI",10);
   StartPosition=FormStartPosition.CenterScreen;Size=new Size(710,455);MinimumSize=new Size(675,430);
   Controls.Add(new Label{Left=28,Top=22,Width=642,Height=48,
    Text="I'm-accessibility",Font=new Font("Segoe UI",20,FontStyle.Bold),
    ForeColor=Color.FromArgb(22,85,129)});
   Controls.Add(new Label{Left=30,Top=85,Width=638,Height=58,
    Text="Install the Windows desktop-to-LG-TV app with bundled Node.js and FFmpeg.\r\nNo administrator access needed. TV streaming will NOT start during installation."});
   Controls.Add(new Label{Left=30,Top=157,Width=625,Height=23,Text="Install location:",Font=new Font("Segoe UI",10,FontStyle.Bold)});
   destination.SetBounds(30,186,633,48);destination.Text=InstallCore.Destination;
   destination.AccessibleName="Windows user installation folder";
   destination.AccessibleDescription="The per-user location where I'm-accessibility will be installed.";
   Controls.Add(destination);
   open.Text="Open the app after installation (TV remains off until you select Start)";
   open.SetBounds(30,242,635,35);open.Checked=true;
   open.TabIndex=0;open.AccessibleName="Open I'm-accessibility after installation";
   open.AccessibleDescription="Opens the application UI only; it will not start the TV stream.";
   Controls.Add(open);
   install.Text="Install I'm-accessibility";install.SetBounds(30,288,289,49);
   install.BackColor=Color.FromArgb(14,91,133);install.ForeColor=Color.White;
   install.Font=new Font("Segoe UI",11,FontStyle.Bold);install.FlatStyle=FlatStyle.Flat;
   install.FlatAppearance.BorderSize=0;install.TabIndex=1;
   install.AccessibleName="Install I'm-accessibility for this Windows user";
   install.AccessibleDescription="Verify bundled files and install the app without starting TV streaming.";
   Controls.Add(install);
   install.Click+=(s,e)=>BeginInstall();
   close.Text="Close";close.SetBounds(332,288,126,49);
   close.TabIndex=2;close.AccessibleName="Close installation without changes";
   close.AccessibleDescription="Dismiss the installer. Does not start TV streaming.";
   close.Click+=(s,e)=>Close();Controls.Add(close);
   output.SetBounds(30,355,633,53);output.Multiline=true;output.ReadOnly=true;
   output.ScrollBars=ScrollBars.Vertical;output.Text="Private installer preview. No files have been changed.";
   output.TabIndex=3;output.TabStop=true;
   output.AccessibleName="Installation progress and verification messages";
   output.AccessibleDescription="Read-only log of installed files and any errors.";
   Controls.Add(output);
   try{
    string action=InstallCore.InstallerAction();
    if(action=="open"){
     install.Text="Open installed app";install.AccessibleName="Verify and open the existing installed app";
     install.AccessibleDescription="Open this installed version without changing its files or starting TV streaming.";
     open.Enabled=false;output.Text="This version is already installed. Open the app when you are ready. No files will be overwritten.";
    }else if(action=="update"){
     install.Text="Update I'm-accessibility";install.AccessibleName="Update I'm-accessibility and keep saved TV settings";
     install.AccessibleDescription="Verify the new version, close an idle app and update it. Pairing, shortcuts and the audio safety task are kept. The TV stays off.";
     open.Text="Open the app after updating (TV remains off until you select Start)";
     open.AccessibleName="Open I'm-accessibility after updating";
     output.Text=InstallCore.UpdateDescription();
    }
   }catch(Exception ex){install.Enabled=false;open.Enabled=false;output.Text=ex.Message;}
   FormClosing+=(s,e)=>{if(busy&&e.CloseReason==CloseReason.UserClosing)e.Cancel=true;};
   KeyPreview=true;KeyDown+=(sender,e)=>{if(e.KeyCode==Keys.Escape){Close();e.Handled=true;}};

  }
  public object AccessibilityReport(){
   Control[] order={open,install};
   bool allNamed=true,validOrder=true;
   for(int i=0;i<order.Length;i++){if(String.IsNullOrWhiteSpace(order[i].AccessibleName))allNamed=false;
    if(order[i].TabIndex!=i||!order[i].TabStop)validOrder=false;}
   return new {window=Text,named=allNamed,firstTabOrderValid=validOrder,
    openRole=open.AccessibilityObject.Role.ToString(),installRole=install.AccessibilityObject.Role.ToString(),
    openName=open.AccessibleName,installName=install.AccessibleName,
    progressName=output.AccessibleName,progressFocusable=output.TabStop};
  }
  void Log(string s){if(IsHandleCreated&&!IsDisposed)BeginInvoke(new Action(()=>output.AppendText("\r\n"+s)));}
  async void BeginInstall(){
   if(busy)return;
   busy=true;install.Enabled=false;close.Enabled=false;open.Enabled=false;
   try{
    string action=InstallCore.InstallerAction();
    if(action=="open"){
     string existing=await Task.Run(()=>InstallCore.ExistingApplication());
     Process.Start(new ProcessStartInfo(existing){WorkingDirectory=InstallCore.Destination,UseShellExecute=true});
     busy=false;Close();return;
    }
    bool launch=open.Checked;
    bool update=action=="update";
    string folder=await Task.Run(()=>update?InstallCore.Update(false,Log):InstallCore.Install(false,Log));
    Log(update?"Update complete. Your saved TV settings and shortcuts have been kept.":"Installation complete. Open using the desktop or Start Menu shortcut.");
    MessageBox.Show(this,update?"I'm-accessibility was updated successfully.\r\nYour saved TV and pairing are ready. Streaming starts only when you choose Start.":
     "I'm-accessibility installed successfully.\r\nOpen the app to select your LG TV and start viewing when you're ready.",
     update?"Update complete":"Installation complete",MessageBoxButtons.OK,MessageBoxIcon.Information);
    if(launch)Process.Start(new ProcessStartInfo(Path.Combine(folder,"ImAccessibility.exe")){WorkingDirectory=folder,UseShellExecute=true});
    busy=false;Close();
   }catch(Exception ex){Log("Install or update stopped: "+ex.Message);MessageBox.Show(this,ex.Message,"Install or update did not finish",MessageBoxButtons.OK,MessageBoxIcon.Error);}
   finally{busy=false;if(!IsDisposed){install.Enabled=true;close.Enabled=true;open.Enabled=true;}}
  }
 }
 static class Program {
  [STAThread] static void Main(string[] args){
   if(args.Length==2&&args[0]=="--accessibility-selftest"){
    try{
     using(var window=new InstallerWindow()){
      File.WriteAllText(args[1],new JavaScriptSerializer().Serialize(window.AccessibilityReport()),Encoding.UTF8);
     }
    }catch(Exception ex){
     File.WriteAllText(args[1],"{\"error\":"+new JavaScriptSerializer().Serialize(ex.Message)+"}",Encoding.UTF8);
    }
    return;
   }
   if(args.Length==2&&(args[0]=="--verify"||args[0]=="--test-install"||args[0]=="--test-existing"||
      args[0]=="--test-update"||args[0]=="--test-update-fail-after-backup"||args[0]=="--test-update-fail-after-promotion")){
    try{
     string result;
     if(args[0].StartsWith("--test-update",StringComparison.Ordinal)){
      string fault=args[0]=="--test-update-fail-after-backup"?"after-backup":args[0]=="--test-update-fail-after-promotion"?"after-promotion":null;
      result=InstallCore.Update(true,s=>{},fault);
     }else if(args[0]=="--test-existing"){
      ImAccessibilitySafety.InstallSafety.CheckTestProfile(InstallCore.LocalData);
      result=InstallCore.ExistingApplication();
     }else result=args[0]=="--verify"?InstallCore.VerifyArchive():InstallCore.Install(true,s=>{});
     File.WriteAllText(args[1],"SUCCESS "+result+"\r\n",Encoding.UTF8);
    }catch(Exception ex){try{File.WriteAllText(args[1],"FAILED "+ex.ToString()+"\r\n",Encoding.UTF8);}catch{}}
    return;
   }
   if(args.Length!=0)return;
   Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);
   Application.Run(new InstallerWindow());
  }
 }
}
