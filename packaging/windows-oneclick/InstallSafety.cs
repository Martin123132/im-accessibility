using System;
using System.IO;
namespace ImAccessibilitySafety {
 internal static class InstallSafety {
  internal static void NoLinks(string path) {
   for(var item=new DirectoryInfo(Path.GetFullPath(path));item!=null;item=item.Parent)
    if(item.Exists&&(item.Attributes&FileAttributes.ReparsePoint)!=0)
     throw new Exception("Linked installation/profile directories are not allowed.");
  }
  internal static void CheckTestProfile(string local) {
   string qa=Environment.GetEnvironmentVariable("IM_ACCESSIBILITY_QA_ROOT");
   if(String.IsNullOrWhiteSpace(qa))throw new Exception("Explicit disposable QA root is required.");
   qa=Path.GetFullPath(qa).TrimEnd(Path.DirectorySeparatorChar);
   string parent=Path.Combine(Path.GetTempPath(),"ImAccessibility-QA")+Path.DirectorySeparatorChar;
   Guid id;
   if(!qa.StartsWith(parent,StringComparison.OrdinalIgnoreCase)||
      !Guid.TryParseExact(Path.GetFileName(qa),"N",out id)||
      !String.Equals(Path.GetDirectoryName(qa)+Path.DirectorySeparatorChar,parent,StringComparison.OrdinalIgnoreCase)||
      !File.Exists(Path.Combine(qa,".disposable-profile"))||
      !String.Equals(Path.GetFullPath(local).TrimEnd(Path.DirectorySeparatorChar),Path.Combine(qa,"LocalAppData"),StringComparison.OrdinalIgnoreCase))
    throw new Exception("GUI test is limited to the disposable test area.");
   if(String.Equals(Path.GetFullPath(local).TrimEnd(Path.DirectorySeparatorChar),Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),StringComparison.OrdinalIgnoreCase))
    throw new Exception("The real Windows profile cannot be a test target.");
   NoLinks(local);
  }
  internal static void NoTreeLinks(string root) {
   NoLinks(root);
   foreach(string entry in Directory.GetFileSystemEntries(root)){
    var attributes=File.GetAttributes(entry);
    if((attributes&FileAttributes.ReparsePoint)!=0)throw new Exception("Linked files/directories prevent safe uninstall.");
    if((attributes&FileAttributes.Directory)!=0)NoTreeLinks(entry);
   }
  }
 }
}
