using System;
using System.IO;
using System.Text;
using System.Drawing;
using System.Diagnostics;
using System.Collections;
using System.Collections.Generic;
using System.Windows.Forms;
using System.Web.Script.Serialization;
using System.Net;

namespace ImAccessibilityDesktop {
 static class Engine {
  public static readonly string Root=AppDomain.CurrentDomain.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar);
  public static readonly string Node=Path.Combine(Root,"Runtime","node.exe");
  public static readonly string Ffmpeg=Path.Combine(Root,"Runtime","ffmpeg.exe");
  public static readonly string Bridge=Path.Combine(Root,"gui-config-bridge.cjs");
  public static string LocalData {get{
   string v=Environment.GetEnvironmentVariable("LOCALAPPDATA");
   return String.IsNullOrWhiteSpace(v)?Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData):v;
  }}
  public static string Settings {get{return Path.Combine(LocalData,"ImAccessibility","settings.json");}}
  public static string Quote(string s){return "\""+s.Replace("\"","\\\"")+"\"";}
  public static string Run(string op,string input,bool audio) {
   if(!File.Exists(Node)||!File.Exists(Ffmpeg)||!File.Exists(Bridge))throw new IOException("Bundled Node, FFmpeg or app controller is missing.");
   var si=new ProcessStartInfo(Node,Quote(Bridge)+" "+op);
   si.WorkingDirectory=Root;si.UseShellExecute=false;si.CreateNoWindow=true;
   si.RedirectStandardInput=true;si.RedirectStandardOutput=true;si.RedirectStandardError=true;
   si.StandardOutputEncoding=Encoding.UTF8;si.StandardErrorEncoding=Encoding.UTF8;
   si.EnvironmentVariables["PC_BRIDGE_FFMPEG_EXE"]=Ffmpeg;
   si.EnvironmentVariables["IM_ACCESSIBILITY_CONFIG_PATH"]=Settings;
   si.EnvironmentVariables["IM_ACCESSIBILITY_TV_AUDIO"]=audio?"1":"0";
   using(var p=new Process()) {
    p.StartInfo=si;p.Start();
    if(input!=null)p.StandardInput.Write(input);
    p.StandardInput.Close();
    string output=p.StandardOutput.ReadToEnd(),error=p.StandardError.ReadToEnd();
    if(!p.WaitForExit(15000)){try{p.Kill();}catch{}throw new Exception("Local "+op+" timed out.");}
    if(p.ExitCode!=0)throw new Exception(String.IsNullOrWhiteSpace(error)?output.Trim():error.Trim());
    return output.Trim();
   }
  }
  public static Dictionary<string,object> Parse(string s){return new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(s);}
  public static string Field(Dictionary<string,object> d,string k){return d!=null&&d.ContainsKey(k)&&d[k]!=null?Convert.ToString(d[k]):"";}
 }
 class Adapter {public string Name,IP,Mask;public override string ToString(){return Name+"  |  "+IP+"  ("+Mask+")";}}
 class MainWindow:Form {
  ComboBox adapters=new ComboBox();
  TextBox tvIP=new TextBox(),log=new TextBox();
  CheckBox confirm=new CheckBox(),sound=new CheckBox();
  Button save=new Button(),start=new Button(),stop=new Button(),status=new Button(),uninstall=new Button();
  Label state=new Label();
  public MainWindow(){
   Text="I'm-accessibility - Windows desktop to LG TV";Font=new Font("Segoe UI",10);
   BackColor=Color.FromArgb(247,249,250);ForeColor=Color.FromArgb(28,42,56);
   Size=new Size(775,650);MinimumSize=new Size(710,600);
   StartPosition=FormStartPosition.CenterScreen;AutoScaleMode=AutoScaleMode.Font;
   AddLabel("I'm-accessibility",28,20,680,44,20,true);
   AddLabel("Share your Windows desktop with your LG TV. TV control remains yours.",30,74,695,27);
   Panel bar=new Panel{Left=28,Top=109,Width=694,Height=2,BackColor=Color.Silver};Controls.Add(bar);
   AddLabel("1   CONNECT YOUR LG TV",28,130,680,27,11,true);
   AddLabel("PC network",30,174,117,25);
   adapters.SetBounds(156,169,547,33);adapters.DropDownStyle=ComboBoxStyle.DropDownList;Controls.Add(adapters);
   AddLabel("LG TV IP",30,218,117,26);
   tvIP.SetBounds(156,213,195,32);tvIP.MaxLength=15;Controls.Add(tvIP);
   AddLabel("Find this under LG Settings > Network. Initial supported model: OLED55CX6LA.",365,216,344,43);
   confirm.SetBounds(155,260,540,30);confirm.Text="I confirm this is the LG TV I want to connect to.";Controls.Add(confirm);
   save.Text="Save setup";save.SetBounds(155,304,172,40);Primary(save);save.Click+=(s,e)=>Save();
   Controls.Add(save);
   state.SetBounds(345,312,350,30);state.Text="Checking setup...";Controls.Add(state);
   Panel second=new Panel{Left=28,Top=367,Width=694,Height=2,BackColor=Color.Silver};Controls.Add(second);
   AddLabel("2   USE YOUR TV",28,386,675,28,11,true);
   sound.SetBounds(29,424,675,29);
   sound.Text="Enable TV speaker sound (may temporarily mute the laptop speakers)";
   Controls.Add(sound);
   start.Text="Start desktop on TV";start.SetBounds(30,468,223,44);Primary(start);Controls.Add(start);
   stop.Text="Stop TV stream";stop.SetBounds(265,468,181,44);Controls.Add(stop);
   status.Text="Refresh status";status.SetBounds(457,468,149,44);Controls.Add(status);
   uninstall.Text="Uninstall";uninstall.SetBounds(617,468,104,44);Controls.Add(uninstall);
   start.Click+=(s,e)=>StartTV();stop.Click+=(s,e)=>StopTV();status.Click+=(s,e)=>Status();
   uninstall.Click+=(s,e)=>Uninstall();
   log.SetBounds(30,529,691,74);log.Multiline=true;log.ReadOnly=true;log.ScrollBars=ScrollBars.Vertical;
   log.Anchor=AnchorStyles.Left|AnchorStyles.Right|AnchorStyles.Bottom|AnchorStyles.Top;
   log.Text="Ready. Nothing starts streaming until you press Start.";
   Controls.Add(log);
   // Intentional tab sequence: network, address, confirmation, save, sound,
   // start/stop/status, uninstall, then the read-only announcement log.
   // No keyboard shortcut starts Windows capture or arms the mouse.
   KeyPreview=true;
   KeyDown+=(sender,e)=>{if(e.KeyCode==Keys.F5){Status();e.Handled=true;e.SuppressKeyPress=true;}};
   adapters.TabIndex=0;adapters.AccessibleName="PC network connection";
   adapters.AccessibleDescription="Select the private Wi-Fi or Ethernet adapter connected to your LG television.";
   tvIP.TabIndex=1;tvIP.AccessibleName="LG television IPv4 address";
   tvIP.AccessibleDescription="The address shown in the LG television's network settings.";
   confirm.TabIndex=2;confirm.AccessibleName="Confirm this is my own LG television";
   confirm.AccessibleDescription="Required acknowledgement before saving device configuration.";
   save.TabIndex=3;save.AccessibleName="Save LG television setup";
   save.AccessibleDescription="Validate the selected network and TV address and save settings locally.";
   sound.TabIndex=4;sound.AccessibleName="Enable LG television speaker audio";
   sound.AccessibleDescription="When selected, the TV plays speaker audio and the laptop may be temporarily muted.";
   start.TabIndex=5;start.AccessibleName="Start Windows desktop streaming to LG TV";
   start.AccessibleDescription="Requires a confirmation dialog and never enables Windows mouse control automatically.";
   stop.TabIndex=6;stop.AccessibleName="Stop this application's TV stream";
   stop.AccessibleDescription="Requires confirmation; does not shut down other applications.";
   status.TabIndex=7;status.AccessibleName="Refresh TV streaming status";
   status.AccessibleDescription="Read the current TV connection state. Keyboard shortcut F5.";
   uninstall.TabIndex=8;uninstall.AccessibleName="Open accessible application uninstaller";
   uninstall.AccessibleDescription="Confirm to open Windows uninstallation; streaming must be stopped first.";
   log.TabIndex=9;log.TabStop=true;log.AccessibleName="TV application activity and status messages";
   log.AccessibleDescription="Read-only log of setup, connection and local application state.";
   state.AccessibleName="LG television setup status";
   Load+=(s,e)=>Initialize();
  }
  public object AccessibilityReport(){
   Control[] ordered={adapters,tvIP,confirm,save,sound,start,stop,status,uninstall,log};
   var records=new List<Dictionary<string,object>>();
   bool named=true,tabOrder=true,allTabStops=true;
   for(int i=0;i<ordered.Length;i++){
    Control c=ordered[i];
    if(String.IsNullOrWhiteSpace(c.AccessibleName))named=false;
    if(c.TabIndex!=i)tabOrder=false;
    if(!c.TabStop)allTabStops=false;
    records.Add(new Dictionary<string,object>{
     {"name",c.AccessibleName},{"description",c.AccessibleDescription},
     {"role",c.AccessibilityObject.Role.ToString()},{"tabIndex",c.TabIndex},
     {"tabStop",c.TabStop},{"type",c.GetType().Name}
    });
   }
   return new {window=Text,allNamed=named,tabOrderValid=tabOrder,
    allTabStops=allTabStops,controlCount=records.Count,controls=records};
  }
  void AddLabel(string text,int x,int y,int w,int h,int pt=10,bool strong=false){
   Controls.Add(new Label{Left=x,Top=y,Width=w,Height=h,Text=text,
    Font=new Font("Segoe UI",pt,strong?FontStyle.Bold:FontStyle.Regular),
    ForeColor=strong?Color.FromArgb(24,75,112):Color.FromArgb(34,48,61)});
  }
  static void Primary(Button b){b.BackColor=Color.FromArgb(17,94,142);b.ForeColor=Color.White;
   b.FlatStyle=FlatStyle.Flat;b.FlatAppearance.BorderSize=0;b.Font=new Font("Segoe UI",10,FontStyle.Bold);}
  void Log(string s){log.AppendText("\r\n"+DateTime.Now.ToString("HH:mm:ss")+"  "+s);}
  void Initialize(){
   try{
    var d=Engine.Parse(Engine.Run("doctor",null,false));
    var list=d["adapters"] as ArrayList;
    if(list!=null)foreach(object item in list){
     var map=item as Dictionary<string,object>;if(map==null)continue;
     adapters.Items.Add(new Adapter{Name=Engine.Field(map,"name"),IP=Engine.Field(map,"ip"),Mask=Engine.Field(map,"mask")});
    }
    if(adapters.Items.Count>0)adapters.SelectedIndex=0;
    if(File.Exists(Engine.Settings)){
     state.Text="Configuration already saved.";
     save.Enabled=false;confirm.Enabled=false;tvIP.ReadOnly=true;adapters.Enabled=false;
     try{
      var settings=Engine.Parse(File.ReadAllText(Engine.Settings,Encoding.UTF8));
      tvIP.Text=Engine.Field(settings["television"] as Dictionary<string,object>,"ip");
      string ip=Engine.Field(settings["network"] as Dictionary<string,object>,"localIp");
      for(int i=0;i<adapters.Items.Count;i++)if(((Adapter)adapters.Items[i]).IP==ip)adapters.SelectedIndex=i;
     }catch{Log("Existing TV settings need inspection before Start.");}
    }else state.Text="Not configured.";
    Status();
   }catch(Exception ex){Log("Setup check: "+ex.Message);start.Enabled=false;save.Enabled=false;}
  }
  void Save(){
   var a=adapters.SelectedItem as Adapter;if(a==null){Log("Select a PC network first.");return;}
   if(!confirm.Checked){Log("Confirm your LG TV before saving.");return;}
   IPAddress ip; if(!IPAddress.TryParse(tvIP.Text.Trim(),out ip)||ip.AddressFamily!=System.Net.Sockets.AddressFamily.InterNetwork){
    Log("Enter a valid TV IPv4 address.");return;
   }
   try{
    var data=new Dictionary<string,object>{{"adapterName",a.Name},{"localIp",a.IP},{"tvIp",ip.ToString()},
     {"nodeExe",Engine.Node},{"ffmpegExe",Engine.Ffmpeg}};
    Engine.Run("save",new JavaScriptSerializer().Serialize(data),false);
    state.Text="TV setup saved.";save.Enabled=false;adapters.Enabled=false;tvIP.ReadOnly=true;confirm.Enabled=false;
    Log("TV setup validated and saved locally.");
   }catch(Exception ex){Log("Setup refused: "+ex.Message);}
  }
  void StartTV(){
   if(!File.Exists(Engine.Settings)){Log("Save your TV setup first.");return;}
   string s="Open the Windows desktop stream on your selected LG TV?\r\n"+
     (sound.Checked?"TV audio will be enabled.":"TV audio will stay disabled.")+
     "\r\nWindows mouse control will remain OFF until you enable it on the TV.";
   if(MessageBox.Show(this,s,"Confirm TV start",MessageBoxButtons.YesNo,MessageBoxIcon.Question)!=DialogResult.Yes)return;
   try{Engine.Run("validate",null,false);Log(Engine.Run("start",null,sound.Checked));}
   catch(Exception ex){Log("Start refused: "+ex.Message);}
  }
  void StopTV(){
   if(MessageBox.Show(this,"Stop this TV stream only?","Confirm stop",MessageBoxButtons.YesNo,MessageBoxIcon.Question)!=DialogResult.Yes)return;
   try{Log(Engine.Run("stop",null,false));}catch(Exception ex){Log("Stop failed: "+ex.Message);}
  }
  void Status(){
   try{var d=Engine.Parse(Engine.Run("status",null,false));
    Log("State "+Engine.Field(d,"state")+" | video "+Engine.Field(d,"stream")+
     " | viewer "+Engine.Field(d,"viewer")+" | LG "+Engine.Field(d,"lg"));
   }catch(Exception ex){Log("Status: "+ex.Message);}
  }
  void Uninstall(){
   var path=Path.Combine(Engine.Root,"ImAccessibility-Uninstall.exe");
   if(!File.Exists(path)){Log("Uninstaller missing.");return;}
   if(MessageBox.Show(this,"Open the uninstaller? It will check that the TV stream is stopped.",
     "Uninstall",MessageBoxButtons.YesNo,MessageBoxIcon.Question)!=DialogResult.Yes)return;
   try{Process.Start(new ProcessStartInfo(path){UseShellExecute=true});Close();}
   catch(Exception ex){Log(ex.Message);}
  }
 }
 static class Program{
  [STAThread] static void Main(string[] args){
   if(args.Length==2&&args[0]=="--accessibility-selftest"){
    try{
     using(var window=new MainWindow()){
      File.WriteAllText(args[1],new JavaScriptSerializer().Serialize(window.AccessibilityReport()),Encoding.UTF8);
     }
    }catch(Exception ex){File.WriteAllText(args[1],"{\"error\":"+new JavaScriptSerializer().Serialize(ex.Message)+"}",Encoding.UTF8);}
    return;
   }
   if(args.Length==2&&args[0]=="--selftest"){
    try{File.WriteAllText(args[1],new JavaScriptSerializer().Serialize(new{
     app="ImAccessibility Desktop",node=File.Exists(Engine.Node),ffmpeg=File.Exists(Engine.Ffmpeg),
     bridge=File.Exists(Engine.Bridge),settingsPresent=File.Exists(Engine.Settings)
    }),Encoding.UTF8);}catch{}return;
   }
   Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);
   Application.Run(new MainWindow());
  }
 }
}
