using System;
using System.IO;
using System.Linq;
using System.Text;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.Reflection;
using System.Security.Cryptography;
using System.Windows.Forms;
using System.Web.Script.Serialization;
using Microsoft.Win32;
namespace ImAccessibilityDesktop {
 static class UninstallProgram {
  static string Local(){
   string s=Environment.GetEnvironmentVariable("LOCALAPPDATA");
   return String.IsNullOrWhiteSpace(s)?Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData):s;
  }
  static string Expected(){return Path.GetFullPath(Path.Combine(Local(),"Programs","ImAccessibility"));}
  static string Receipt(string root){return Path.Combine(root,"installer-manifest.json");}
  static string Normalize(string value){return value.Replace('/','\\');}
  static bool SafePath(string rel){
   return !String.IsNullOrWhiteSpace(rel)&&!Path.IsPathRooted(rel)&&
    !rel.Contains("..")&&!rel.Contains(":")&&!rel.Contains("\0")&&!rel.StartsWith("\\");
  }
  static bool RuntimeFile(string rel){
   string s=Normalize(rel).ToLowerInvariant();
   return s.StartsWith("tv-reliability-v0.5\\runtime\\")||
    s.StartsWith("tv-reliability-v0.5\\viewer\\runtime\\")||
    s.StartsWith("tv-reliability-v0.5\\cast\\runtime\\")||
    s.StartsWith("tv-reliability-v0.5\\viewer\\evidence\\");
  }
  static void Verify(string root){
   if(!String.Equals(Path.GetFullPath(root).TrimEnd('\\'),Expected().TrimEnd('\\'),StringComparison.OrdinalIgnoreCase))
    throw new Exception("Unexpected installation location.");
   if(!File.Exists(Receipt(root)))throw new Exception("Verified installer receipt is missing.");
   var json=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(File.ReadAllText(Receipt(root)));
   if(Convert.ToString(json["product"])!="ImAccessibility")throw new Exception("Unrecognised installation receipt.");
   var files=json["files"] as ArrayList;if(files==null||files.Count<70)throw new Exception("Incomplete installation receipt.");
   var allowed=new HashSet<string>(StringComparer.OrdinalIgnoreCase);
   foreach(object item in files){
    var map=item as Dictionary<string,object>;if(map==null)throw new Exception("Invalid installed entry.");
    string relative=Convert.ToString(map["path"]);
    if(!SafePath(relative))throw new Exception("Unsafe installed file name.");
    string full=Path.GetFullPath(Path.Combine(root,Normalize(relative)));
    if(!full.StartsWith(root+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase))
     throw new Exception("Entry escapes application folder.");
    allowed.Add(full);
    if(!File.Exists(full))throw new Exception("An installed program file is missing: "+relative);
    if(new FileInfo(full).Length!=Convert.ToInt64(map["bytes"]))
     throw new Exception("An installed program file changed size: "+relative);
    using(var input=File.OpenRead(full))using(var hash=SHA256.Create()){
     string digest=BitConverter.ToString(hash.ComputeHash(input)).Replace("-","").ToLowerInvariant();
     if(!String.Equals(digest,Convert.ToString(map["sha256"]),StringComparison.OrdinalIgnoreCase))
      throw new Exception("An installed program file differs from its manifest: "+relative);
    }
   }
   foreach(string file in Directory.GetFiles(root,"*",SearchOption.AllDirectories)){
    string relative=file.Substring(root.Length+1);
    if(file.Equals(Receipt(root),StringComparison.OrdinalIgnoreCase))continue;
    if(!allowed.Contains(file)&&!RuntimeFile(relative))
     throw new Exception("An unrecognised file is present. No files deleted: "+relative);
   }
   string state=Path.Combine(root,"tv-reliability-v0.5","runtime","state.json");
   if(File.Exists(state)){
    string value=File.ReadAllText(state);
    var v=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(value);
    string mode=Convert.ToString(v["state"]);
    if(mode!="stopped")throw new Exception("The TV session is still running or uncertain. Stop it in the app first.");
   }
  }
  static void RemoveShortcuts(string root){
   var targets=new string[]{
    Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),"I'm-accessibility.lnk"),
    Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs),"I'm-accessibility.lnk")};
   foreach(string item in targets)try{
    if(!File.Exists(item))continue;
    var type=Type.GetTypeFromProgID("WScript.Shell");
    if(type==null)continue;
    object shell=Activator.CreateInstance(type);
    object link=type.InvokeMember("CreateShortcut",BindingFlags.InvokeMethod,null,shell,new object[]{item});
    string actual=Convert.ToString(link.GetType().InvokeMember("TargetPath",BindingFlags.GetProperty,null,link,null));
    string expected=Path.GetFullPath(Path.Combine(root,"ImAccessibility.exe"));
    if(!String.IsNullOrWhiteSpace(actual)&&String.Equals(Path.GetFullPath(actual),expected,StringComparison.OrdinalIgnoreCase))
     File.Delete(item);
   }catch{}
  }
  static void DoUninstall(string root){
   Verify(root);
   Directory.Delete(root,true);
   RemoveShortcuts(root);
   try{
    using(var key=Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall",true)){
     if(key!=null)key.DeleteSubKeyTree("ImAccessibility",false);
    }
   }catch{}
  }
  static DialogResult ConfirmUninstall(){
   // No is the default keyboard action. The exact same Windows confirmation
   // is used in normal uninstall and non-destructive GUI acceptance tests.
   return MessageBox.Show(
    "Uninstall I'm-accessibility from this Windows user account?\r\n\r\nYour saved LG settings are kept. Active TV sessions must be stopped first.",
    "Uninstall I'm-accessibility",MessageBoxButtons.YesNo,
    MessageBoxIcon.Question,MessageBoxDefaultButton.Button2);
  }
  [STAThread] static void Main(string[] args){
   if(args.Length==2&&args[0]=="--dialog-selftest"){
    try{
     string profile=Path.GetFullPath(Local()).TrimEnd(Path.DirectorySeparatorChar)+Path.DirectorySeparatorChar;
     if(!profile.StartsWith(@"D:\ImAccessibility-ClickInstaller-20261024\tests\",StringComparison.OrdinalIgnoreCase))
      throw new Exception("GUI test is limited to the disposable test area.");
     var reply=ConfirmUninstall();
     File.WriteAllText(args[1],reply.ToString()+"\r\n",Encoding.UTF8);
    }catch(Exception ex){
     File.WriteAllText(args[1],"FAILED "+ex.Message+"\r\n",Encoding.UTF8);
    }
    return;
   }
   if(args.Length==2&&args[0]=="--test-uninstall"){
    try{
     string profile=Path.GetFullPath(Local()).TrimEnd(Path.DirectorySeparatorChar)+Path.DirectorySeparatorChar;
     if(!profile.StartsWith(@"D:\ImAccessibility-ClickInstaller-20261024\tests\",StringComparison.OrdinalIgnoreCase))
      throw new Exception("Uninstall test is restricted to the disposable test area.");
     string target=Expected();Verify(target);Directory.Delete(target,true);
     if(Directory.Exists(target))throw new Exception("Test uninstall left application files.");
     File.WriteAllText(args[1],"SUCCESS Removed disposable test installation.\r\n",Encoding.UTF8);
    }catch(Exception ex){
     File.WriteAllText(args[1],"FAILED "+ex.Message+"\r\n",Encoding.UTF8);
    }
    return;
   }
   if(args.Length==2&&args[0]=="--verify"){
    try{Verify(Expected());File.WriteAllText(args[1],"VALID\r\n");}catch(Exception ex){File.WriteAllText(args[1],"INVALID: "+ex.Message+"\r\n");}return;
   }
   string root=Expected();
   // Move our own tiny uninstaller out of the application before deleting files.
   if(args.Length==0){
    string temp=Path.Combine(Path.GetTempPath(),"ImAccessibility-Uninstall-"+Guid.NewGuid().ToString("N")+".exe");
    try{
     File.Copy(Assembly.GetExecutingAssembly().Location,temp,false);
     var p=new ProcessStartInfo(temp,"--execute"){
      UseShellExecute=false,CreateNoWindow=false,WorkingDirectory=Path.GetTempPath()
     };
     Process.Start(p);
    }catch(Exception ex){MessageBox.Show(ex.Message,"Uninstaller unavailable",MessageBoxButtons.OK,MessageBoxIcon.Error);}
    return;
   }
   if(args.Length!=1||args[0]!="--execute")return;
   if(ConfirmUninstall()!=DialogResult.Yes)return;
   try{
    DoUninstall(root);
    MessageBox.Show("I'm-accessibility was uninstalled. Your personal TV setup settings were preserved.",
     "Uninstall completed",MessageBoxButtons.OK,MessageBoxIcon.Information);
   }catch(Exception ex){MessageBox.Show(ex.Message,"Uninstall stopped without deleting application files",MessageBoxButtons.OK,MessageBoxIcon.Error);}
  }
 }
}
