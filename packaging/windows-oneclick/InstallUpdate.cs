using System;
using System.IO;
using System.Text;
using System.Linq;
using System.Diagnostics;
using System.Collections.Generic;
using System.IO.Compression;
using System.Text.RegularExpressions;
using System.Web.Script.Serialization;

namespace ImAccessibilityInstaller {
 static partial class InstallCore {
  static Dictionary<string,object> ReadInstalledManifest(string root) {
   ImAccessibilitySafety.InstallSafety.NoLinks(root);
   string receipt=Path.Combine(root,"installer-manifest.json");
   if(!File.Exists(receipt))throw new IOException("This folder has no installation receipt. Your files have been preserved; the update cannot verify them.");
   if(new FileInfo(receipt).Length>2000000)throw new IOException("The installation receipt is too large. Your files have been preserved.");
   var serializer=new JavaScriptSerializer();serializer.MaxJsonLength=2000000;
   var map=serializer.Deserialize<Dictionary<string,object>>(File.ReadAllText(receipt));
   if(map==null||!map.ContainsKey("product")||!map.ContainsKey("version")||
      Convert.ToString(map["product"])!="ImAccessibility"||Convert.ToString(map["version"])!=Version)
    throw new IOException("This installation is not a recognised I'm-accessibility preview. No files have been changed.");
   Entries(map);
   return map;
  }
  static string InstalledBuild(Dictionary<string,object> map) {
   return map.ContainsKey("buildId")?Convert.ToString(map["buildId"]):"";
  }
  static System.Version ReleaseNumber(string build) {
   // Early 0.3.21 previews did not yet carry a build ID. They are predecessors,
   // not newer versions. Unknown nonempty identifiers are never guessed.
   if(String.IsNullOrEmpty(build))return new System.Version(0,0,0);
   var match=Regex.Match(build,@"^recovery([0-9]{1,4})\.([0-9]{1,4})(?:\.([0-9]{1,4}))?-[a-z0-9-]+$");
   if(!match.Success)throw new IOException("The installed version cannot be identified. No files have been changed.");
   return new System.Version(Int32.Parse(match.Groups[1].Value),Int32.Parse(match.Groups[2].Value),
    match.Groups[3].Success?Int32.Parse(match.Groups[3].Value):0);
  }
  static string IncomingBuild {
   get {
#if REBUILT_FFMPEG_PRIVATE
    return BuildId;
#else
    return "recovery2.2-original-runtime";
#endif
   }
  }
  public static string InstallerAction() {
   if(File.Exists(Destination))throw new IOException("A file already occupies the installation location. It has been preserved.");
   if(!Directory.Exists(Destination))return "install";
   string old=InstalledBuild(ReadInstalledManifest(Destination));
   int order=ReleaseNumber(old).CompareTo(ReleaseNumber(IncomingBuild));
   if(order>0)throw new IOException("A newer version is already installed. Use its existing shortcut. This older installer will not replace it.");
   if(order==0&&!String.Equals(old,IncomingBuild,StringComparison.Ordinal))
    throw new IOException("A different build with the same version number is installed. It has been preserved.");
   return order<0?"update":"open";
  }
  public static string UpdateDescription() {
   var number=ReleaseNumber(InstalledBuild(ReadInstalledManifest(Destination)));
   string old=number.Major==0?"An earlier preview":"Recovery "+number.ToString(3);
   return old+" is installed. Update to Recovery "+ReleaseNumber(IncomingBuild).ToString(3)+
    ". Your saved TV, pairing and shortcuts will be kept. Stop any TV stream first; an idle app will close automatically.";
  }
  static bool RuntimeFile(string rel) {
   string name=rel.Replace('\\','/').ToLowerInvariant();
   return name.StartsWith("tv-reliability-v0.5/runtime/")||
    name.StartsWith("tv-reliability-v0.5/viewer/runtime/")||
    name.StartsWith("tv-reliability-v0.5/cast/runtime/")||
    name.StartsWith("tv-reliability-v0.5/viewer/evidence/");
  }
  static void VerifyInstalled(string root,Dictionary<string,object> map) {
   ImAccessibilitySafety.InstallSafety.NoTreeLinks(root);
   var names=new HashSet<string>(StringComparer.OrdinalIgnoreCase);
   foreach(var entry in Entries(map)) {
    string rel=Convert.ToString(entry["path"]),full;SafeEntry(root,rel,out full);
    if(!names.Add(rel))throw new IOException("Duplicate installed file in the receipt.");
    if(!File.Exists(full)||new FileInfo(full).Length!=Convert.ToInt64(entry["bytes"])||
       !String.Equals(Hash(full),Convert.ToString(entry["sha256"]),StringComparison.OrdinalIgnoreCase))
     throw new IOException("The installed app could not be verified: "+rel+". Your files have been preserved.");
   }
   foreach(string required in new[]{"ImAccessibility.exe","ImAccessibility-Uninstall.exe","Runtime/node.exe","Runtime/ffmpeg.exe"})
    if(!names.Contains(required))throw new IOException("The installation receipt is missing an essential file: "+required);
   foreach(string file in Directory.GetFiles(root,"*",SearchOption.AllDirectories)) {
    string rel=file.Substring(root.Length+1).Replace('\\','/');
    if(rel=="installer-manifest.json"||names.Contains(rel)||RuntimeFile(rel))continue;
    throw new IOException("An unrecognised file is present: "+rel+". The update has preserved it and your current app.");
   }
  }
  static void VerifySamePackage(Dictionary<string,object> installed) {
   using(var stream=System.Reflection.Assembly.GetExecutingAssembly().GetManifestResourceStream(PayloadResource))
   using(var archive=new ZipArchive(stream,ZipArchiveMode.Read,false)) {
    var incoming=Entries(Manifest(archive));var old=Entries(installed);
    if(old.Count!=incoming.Count)throw new IOException("The installed build differs from this package. No files have been changed.");
    var expected=incoming.ToDictionary(x=>Convert.ToString(x["path"]),StringComparer.OrdinalIgnoreCase);
    foreach(var file in old) {
     Dictionary<string,object> wanted;
     if(!expected.TryGetValue(Convert.ToString(file["path"]),out wanted)||
        Convert.ToInt64(file["bytes"])!=Convert.ToInt64(wanted["bytes"])||
        !String.Equals(Convert.ToString(file["sha256"]),Convert.ToString(wanted["sha256"]),StringComparison.OrdinalIgnoreCase))
      throw new IOException("The installed build differs from this package. No files have been changed.");
    }
   }
  }
  static void RequireStopped(string root) {
   foreach(string rel in new[]{"tv-reliability-v0.5/viewer/runtime/speaker-route.json",
    "tv-reliability-v0.5/runtime/host-lock.json","tv-reliability-v0.5/runtime/stop-request.json"})
    if(File.Exists(Path.Combine(root,rel.Replace('/',Path.DirectorySeparatorChar))))
     throw new IOException("Stop the TV stream and wait for laptop sound to return, then choose Update again. No uninstall is needed and no files have been changed.");
   string state=Path.Combine(root,"tv-reliability-v0.5","runtime","state.json");
   if(File.Exists(state)) {
    var map=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(File.ReadAllText(state));
    if(map==null||!map.ContainsKey("state")||Convert.ToString(map["state"])!="stopped")
     throw new IOException("The TV session is still running or has not finished stopping. Choose Stop in the app, then Update again. No uninstall is needed.");
   }
  }
  static void CloseIdleApplication(string root,Action<string> progress) {
   foreach(var process in Process.GetProcesses()) {
    try {
     string exe;
     try{exe=process.MainModule.FileName;}
     catch(System.ComponentModel.Win32Exception){continue;}
     catch(InvalidOperationException){continue;}
     if(!exe.StartsWith(root+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase))continue;
     if(!String.Equals(exe,Path.Combine(root,"ImAccessibility.exe"),StringComparison.OrdinalIgnoreCase)||process.MainWindowHandle==IntPtr.Zero)
      throw new IOException("The TV or audio service is still closing. Wait a moment, then choose Update again. Your current app is unchanged.");
     RequireStopped(root);
     progress("Closing the idle app before updating.");
     if(!process.CloseMainWindow()||!process.WaitForExit(15000))
      throw new IOException("The app has not closed yet. Finish any message in its window, then choose Update again. No files have been changed.");
    }finally{process.Dispose();}
   }
  }
  static void DisposeFiles(List<FileStream> files) {foreach(var file in files)file.Dispose();files.Clear();}
  static void DeleteScratch(string path,string parent,string prefix) {
   string full=Path.GetFullPath(path);
   Guid id;
   if(!String.Equals(Path.GetDirectoryName(full),parent,StringComparison.OrdinalIgnoreCase)||
      !Path.GetFileName(full).StartsWith(prefix,StringComparison.Ordinal)||
      !Guid.TryParseExact(Path.GetFileName(full).Substring(prefix.Length),"N",out id))
    throw new IOException("Refusing to remove an unexpected update folder.");
   if(Directory.Exists(full)){ImAccessibilitySafety.InstallSafety.NoTreeLinks(full);Directory.Delete(full,true);}
  }
  public static string Update(bool test,Action<string> progress,string fault=null) {
   if(test)ImAccessibilitySafety.InstallSafety.CheckTestProfile(LocalData);
   if(fault!=null&&(!test||(fault!="after-backup"&&fault!="after-promotion")))throw new IOException("Unsupported update test.");
   string root=Destination,parent=Path.GetDirectoryName(root);
   using(ImAccessibilitySafety.InstallSafety.AcquireInstallLock(root)) {
    if(InstallerAction()!="update")throw new IOException("No newer version is available in this installer. Your installed app is unchanged.");
    var old=ReadInstalledManifest(root);VerifyInstalled(root,old);RequireStopped(root);
    string stage=Path.Combine(parent,".ImAccessibility-update-stage-"+Guid.NewGuid().ToString("N"));
    string backup=Path.Combine(parent,".ImAccessibility-update-backup-"+Guid.NewGuid().ToString("N"));
    string oldReceipt=Hash(Path.Combine(root,"installer-manifest.json"));
    var held=new List<FileStream>();bool moved=false,promoted=false,committed=false;
    Dictionary<string,object> incoming=null;
    Directory.CreateDirectory(stage);
    try {
     ExtractPackage(stage,progress);
     incoming=ReadInstalledManifest(stage);VerifyInstalled(stage,incoming);
     RequireStopped(root);CloseIdleApplication(root,progress);RequireStopped(root);
     VerifyInstalled(root,old);
     // Verify exclusive access before replacement. Windows cannot rename the
     // containing directory while these handles are open, so release them
     // immediately before the exchange. The installer mutex remains held;
     // a conflicting Windows file lock makes the rename fail without a swap.
     foreach(var entry in Entries(old)) {
      string full;SafeEntry(root,Convert.ToString(entry["path"]),out full);
      var file=new FileStream(full,FileMode.Open,FileAccess.Read,FileShare.None);held.Add(file);
      using(var hash=System.Security.Cryptography.SHA256.Create())
       if(file.Length!=Convert.ToInt64(entry["bytes"])||!String.Equals(Hex(hash.ComputeHash(file)),Convert.ToString(entry["sha256"]),StringComparison.OrdinalIgnoreCase))
        throw new IOException("An installed file changed during verification. The current app has been preserved.");
     }
     var receipt=new FileStream(Path.Combine(root,"installer-manifest.json"),FileMode.Open,FileAccess.Read,FileShare.None);held.Add(receipt);
     using(var hash=System.Security.Cryptography.SHA256.Create())
      if(Hex(hash.ComputeHash(receipt))!=oldReceipt)throw new IOException("The installation receipt changed during verification.");
     RequireStopped(root);
     DisposeFiles(held);
     progress("Installing the update. Your TV settings and shortcuts are being kept.");
     Directory.Move(root,backup);moved=true;
     if(fault=="after-backup")throw new IOException("Disposable QA interruption after backup.");
     Directory.Move(stage,root);promoted=true;
     VerifyInstalled(root,incoming);
     if(fault=="after-promotion")throw new IOException("Disposable QA interruption after promotion.");
     // The path, shortcuts, uninstall registration and on-demand audio-task
     // action stay the same. Do not remove/re-register any of those resources.
     committed=true;
    }catch(Exception failure) {
     DisposeFiles(held);
     if(moved) {
      try {
       if(promoted) {
        VerifyInstalled(root,incoming);
        ImAccessibilitySafety.InstallSafety.NoTreeLinks(root);Directory.Delete(root,true);
       }
       if(Directory.Exists(root)||File.Exists(root))throw new IOException("The original install location is occupied.");
       Directory.Move(backup,root);moved=false;VerifyInstalled(root,old);
      }catch(Exception rollback){throw new IOException("The update did not finish. Your previous files are preserved at "+backup+". Recovery could not finish: "+rollback.Message,failure);}
      throw new IOException("The update did not finish. Your previous version and saved TV settings have been restored. "+failure.Message,failure);
     }
     throw;
    }finally {
     DisposeFiles(held);
     try{DeleteScratch(stage,parent,".ImAccessibility-update-stage-");}catch(Exception ex){progress("Update staging cleanup: "+ex.Message);}
    }
    if(committed) {
     try{VerifyInstalled(backup,old);DeleteScratch(backup,parent,".ImAccessibility-update-backup-");}
     catch(Exception){progress("Update complete. A previous-version backup was retained because it could not be safely removed.");}
    }
    return root;
   }
  }
 }
}
